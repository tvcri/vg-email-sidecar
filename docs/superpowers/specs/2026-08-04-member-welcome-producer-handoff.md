# Member Welcome Email — VG-side Producer Handoff

**Date:** 2026-08-04
**Audience:** a session working in `/home/csmig/dev/village-green` (the API repo)
**Status:** requirements + findings, not yet a plan. Brainstorm/plan this in the VG repo before implementing.
**Consumer side:** COMPLETE on the `member-welcome-email` branch of `vg-email-sidecar`
(spec: `docs/superpowers/specs/2026-08-04-member-welcome-email-design.md`)

## What already exists (do not rebuild)

The sidecar consumes the event end to end: it polls `notification_event`, looks the
member up, renders the customer-approved welcome copy with the org logo, and sends
from `volunteer@villagecommonri.org`. It is tested and reviewed. **Nothing in the
sidecar needs to change for this work.**

What is missing is the producer: **nothing in village-green ever inserts a
`member_welcome` row.** That is this handoff.

## The event contract (the sidecar's side of the interface)

```sql
INSERT INTO notification_event (eventType, serviceRequestId, payload)
VALUES ('member_welcome', NULL, '{"memberPersonId": <person.id>}');
```

- `eventType` is exactly `member_welcome`.
- `serviceRequestId` is NULL — this is a payload-driven event, not tied to a service request.
- `payload.memberPersonId` is `person.id` (NOT `member.id` — getting this wrong sends
  the email to the wrong person or none at all).
- The sidecar looks the person up **at send time**, so name/email/village are always
  fresh. Do not snapshot them into the payload.
- The sidecar marks the event failed (no email, no crash) when: the payload has no
  `memberPersonId`, the person does not exist, or the person has no email. A member
  without an email address is a normal, silent no-op.

## ⚠️ The hazard this work must solve

**This is the whole difficulty of the task. Read before designing anything.**

Dev-DB counts as of 2026-08-04:

| Members by status | Count |
|---|---|
| Active | 826 |
| Dropped | 524 |
| Active **with an email address** | **712** |

The obvious implementation — "insert the event when a member is saved with
`status = 'Active'`" — would email **712 existing members** the first time each of
their records is touched, welcoming long-standing members to a village they joined
years ago. A bulk edit or an import script would do it to all of them at once.
Production counts are larger.

The producer must fire **only on the transition into Active**, never on a save that
finds the member already Active. Design for this explicitly and test it explicitly.

Three further facts that make the hazard sharper:

1. **`member.status` is an unconstrained `varchar(50)`** (`10-vg-tables.sql`, `member`
   table) — no enum, no check constraint. `'Active'` is a convention, not a guarantee.
   Whatever comparison you write should be as tolerant as the data requires (consider
   how existing code compares status) and must not silently treat an unexpected value
   as an activation.
2. **Reactivation is real**: 524 members are `Dropped`, and Dropped → Active is a
   legitimate transition a coordinator performs. Decide deliberately whether a
   returning member gets a welcome email again — this is a **customer question**, not
   a technical one. My recommendation is to ask the customer; the copy ("Your
   membership has been activated … confirms your new membership") reads oddly for
   someone who was a member for ten years, dropped for one, and came back.
3. **There are two write paths, not one.** Both can set status:
   - `MemberService.putMember` (`api/source/service/MemberService.js:20-41`) — grants
     or fully replaces the member role; INSERTs when no member row exists, UPDATEs
     when one does.
   - `MemberService.patchMember` (`api/source/service/MemberService.js:44-54`) —
     partial update; this is the one `test/api/tests/members/lifecycle.test.js:85-88`
     uses to move a member to `Dropped`, so it is equally a status-transition path.
   A guard on only one of them leaves a hole.

## Where the code goes

`MemberService.putMember` already runs its writes inside a
`dbUtils.retryOnDeadlock2({ transactionFn: async (connection) => { … } })`
transaction, and reads the prior row at line 23-25:

```js
const [existing] = await connection.query(
  'SELECT id FROM member WHERE personId = ?', [personId]
)
```

That SELECT currently fetches only `id`. Fetching `status` alongside it gives you the
before-state, and comparing it to the incoming body's status inside the same
transaction is how you detect a genuine transition. The notification INSERT should use
that **same `connection`**, so the event is atomic with the member write — the
established pattern in this repo:

`api/source/service/ServiceRequestService.js:21-37` (`writeNotificationEvent`) takes a
`connection` and is called inside the SR transaction. Follow that, not the
`EnrollmentService` pattern (`EnrollmentService.js:158-166`), which fires
`dbUtils.pool.query` outside any transaction — acceptable there because no row was
being written alongside it, but wrong here.

`patchMember` currently has no prior-state read at all, so it needs one added to make
the same determination.

Note that `ServiceRequestService.writeNotificationEvent` is **not reusable as-is**: it
requires a `serviceRequestId`, derives `eventType` from an SR status map, and has no
`payload` parameter. Either write a small member-specific helper, or generalize —
that is a design decision for the VG session. There is no generic
`enqueueNotification` helper in the repo today.

## Schema — nothing to migrate

`notification_event` already has everything needed. Migration `0017-enrollment.js`
added the `payload` JSON column and made `serviceRequestId` nullable. **No new
migration is required for this feature** — a welcome addition, since it means no
schema-sync work against `sql/current/10-vg-tables.sql`.

One cleanup worth folding in: the `eventType` column comment still reads
`'open | confirmed | cancelled | reminder'`, already stale (it omits
`enroll_ineligible`) and about to get staler. Updating it is optional and cosmetic.

## Testing

The pattern to copy is `test/api/tests/service-request/lifecycle.test.js:34-38`, which
asserts an event was enqueued by querying the table directly through the `withDb`
helper:

```js
async function notificationEvents (serviceRequestId) {
  const [rows] = await withDb(c =>
    c.query('SELECT eventType FROM notification_event WHERE serviceRequestId = ?', [serviceRequestId]))
  return rows.map(r => r.eventType)
}
```

Payload-driven events have no `serviceRequestId` to key on, so query by eventType plus
a JSON path — `WHERE eventType = 'member_welcome' AND JSON_EXTRACT(payload, '$.memberPersonId') = ?`.
There is no existing test for `enroll_ineligible` to copy from; this would be the
first payload-driven event assertion in the suite.

**The tests that actually matter** — the first two are the hazard above, and are worth
more than all the others combined:

1. Saving a member who is **already Active** enqueues **nothing**. Test via both
   `putMember` and `patchMember`.
2. A genuine transition (no member row → Active, and Dropped → Active if the customer
   wants reactivation emails) enqueues **exactly one** row.
3. The payload carries `memberPersonId` = the **person** id, and `serviceRequestId` is
   NULL.
4. Activating twice in a row produces exactly one event, not two.
5. A member activated with no email address still enqueues normally — the sidecar
   handles the no-email case by marking the event failed, and the producer should not
   be second-guessing deliverability.

## Open questions for the customer (resolve before implementing)

1. **Reactivation**: does a Dropped → Active member get the welcome email again?
   (Recommend: no, or reworded copy — see hazard #2 above.)
2. **Backfill**: confirm explicitly that the 826 existing Active members must **never**
   receive this. I have assumed so, and the whole transition-guard design follows from
   it, but it should be stated out loud rather than assumed.
3. **Household/secondary members**: `member` has `primaryPersonId` and `secondaryType`
   columns, so a household can have secondary members. Does each activated person get
   their own welcome email, or only the primary? The sidecar sends one email per
   event row, so this is purely a producer-side decision about how many rows to write.

## Verification before go-live

The sidecar side has never sent a real `member_welcome` email — its send branch has no
unit test (no mocking harness for the polling loop; documented decision). So the first
real end-to-end run matters:

1. Point a sidecar instance at the dev DB with `TEST_RECIPIENTS` set to your own
   address.
2. Activate a test member through the VG API.
3. Confirm exactly one row appears, the sidecar picks it up within its poll interval,
   and the delivered email renders the logo at top (it travels as a CID inline
   attachment; some clients show it as an attachment too, which is expected) with the
   correct village name in the bold sentence.
4. Re-save that same member and confirm **no second row** is enqueued.

Step 4 is the one that proves the hazard is handled.
