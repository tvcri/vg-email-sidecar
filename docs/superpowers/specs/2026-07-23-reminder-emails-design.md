# Automatic Reminder Emails

**Date:** 2026-07-23
**Status:** Approved, ready for implementation plan
**Issue:** [tvcri/village-green#62](https://github.com/tvcri/village-green/issues/62)

## Problem

Members and volunteers get no reminder ahead of a scheduled service. The
`reminder` event type is half-scaffolded on both sides but was never finished:

- `notification_event.eventType` already lists `'reminder'` as a valid value
  (VG migration 0005).
- `deriveRecipientsForEvent` in `src/email-processor.js` already routes it:
  `{ sendToVolunteer: true, sendToMember: true }`.
- The send branch is a stub — it logs a warning and marks the event **failed**:

```js
} else if (event.eventType === 'reminder') {
  console.warn(`... No template yet for eventType=${event.eventType}, marking failed`);
  await markNotificationFailed(event.id);
```

- Nothing inserts a `reminder` row today. There is no trigger.

Two things are missing: something to **enqueue** reminders on a schedule, and a
**template + send branch** to deliver them.

## Customer requirements

From issue #62 and its comment thread:

1. **Schedule:** "Send reminder emails at 7am two days before the service date."
2. **Qualifying requests:** `Confirmed` only, with an assigned volunteer. The
   supplied template copy — "a service request ... for which you are
   scheduled" — presupposes a confirmed assignment. Unmatched `Open` requests
   get no reminder; that would need different copy the customer has not
   supplied.
3. **Recipients:** the **assigned volunteer only — never the member**
   (corrected 2026-07-23; see below).
4. **Templates:** page 2 of `scratch/template-reminder-{ride,errand,help,tech}.pdf`.
5. **Starting Location:** **Rides only** — see "Starting Location" below.

## Scope

Two artifacts across two repos; only one ships as code here.

| Artifact | Repo | Deliverable |
| --- | --- | --- |
| Template + send branch + tests | `vg-email-sidecar` (this repo) | Working code |
| Scheduled `EVENT` that enqueues rows | `village-green` (migrations) | **Documented example only** |

Per issue #62 the enqueue mechanism is a MySQL scheduled `EVENT` owned by the
village-green migrations. This spec delivers it as a **reviewed example**
(`docs/examples/reminder-event.sql` + README section). It is not applied, and no
migration is added here.

**No changes** to the polling loop, `queries.js`, `db.js`, or `gmail.js`. The
poller already picks up any pending row regardless of `eventType`, and
`GET_SERVICE_REQUEST` already selects every field the reminder needs
(including `status`).

## Design

### 1. Template — `src/templates.js`

One builder, `buildReminderTemplate(recipientFirstName, requestData)`, following
the conventions of the surrounding file: `withBlankAddressNulls(requestData)`
first, the shared outer-table chrome, and no map link (the PDFs have none).

Body, per the PDFs:

```
This is a reminder about a service request with The Village Common of RI
for which you are scheduled.

Service:            <serviceName>
Date/Time:          <date> at <time>   |   <date>  (The time is flexible)
Requesting Member:  <memberName> / <memberAddress> / <city, state zip> / <cell> (cell)
Starting Location:  <formatStartingLocation(rd)>       -- RIDES ONLY

Short Description
<description>

Destination                                            -- omitted when absent
<destination> / <address> / <city, state zip>

If you have any questions or need to cancel this service, please call
401-441-5240 or reply to this email.
```

Three data-driven conditionals — no service-type dispatcher:

1. **Date/Time** — `startTime && !timesFlexible` renders
   `${formatServiceDate(serviceDate)} at ${formatCivilTime(startTime)}`;
   otherwise `${formatServiceDate(serviceDate)}  (The time is flexible)`.
   In the PDFs only the Ride shows a time, but that follows from the *data*
   (rides carry a `startTime`, the others are flagged flexible), so no
   service-type check is needed.
2. **Starting Location** — emitted only when
   `serviceName.startsWith('Ride:')`, reusing the existing
   `formatStartingLocation()` helper and the existing row markup.
3. **Destination** — the whole block is emitted only when `destination` is set,
   reusing the established `destination && address` idiom. This drops the bare,
   content-less "Destination" heading the Home Help and Tech Support PDFs show
   (a ClubExpress rendering artifact, not a deliberate design).

**One builder, not four.** The four PDFs are a single layout; their only
differences are the two conditionals above. Four builders would be ~450 lines of
byte-identical copy-paste encoding a distinction that does not exist, and four
places to edit for every future copy change. If the customer later asks for
per-type reminder copy, split it then.

**Member address** is the member's **home** address, as the PDFs show — this
block is labeled "Requesting Member" (who they are, how to reach them), not
"where to go". Uses the established `memberAddressBlock` pattern with the
`(cell)` suffix, matching `buildCancelledTemplate`.

#### Starting Location

The reminder shows a Starting Location row for **Rides only**. Home Help and
Tech Support happen at the member's home, and the customer does not want it on
Errands.

Note that `src/templates.js` today *does* render a Starting Location row in the
three **Errands** templates. That reflects an earlier misreading of customer
intent, confirmed with the customer on 2026-07-23. Those templates are
**deliberately left untouched** — removing the row would be an unrequested
change to live customer-facing email and belongs to its own issue.

This is the one place the reminder **intentionally departs from the supplied
PDFs**, which predate the start-address work (PR #12) and show no Starting
Location row. The departure is deliberate, not a template bug.

### 2. Send branch — `src/email-processor.js`

Replace the stub. Structure mirrors the `cancelled` branch, which already solves
the same two-recipient, partial-success shape.

**Status re-check.** Extracted as a pure, exported predicate so it is testable
without a DB — this repo has no mocking harness and tests only pure pieces:

```js
function shouldSkipReminder(requestData) {
  if (requestData.status !== 'Confirmed') return true;
  if (!requestData.volunteerPersonId) return true;
  return false;
}
```

Used by the branch as:

```js
if (shouldSkipReminder(requestData)) {
  console.log(`... SR #${requestData.id} is ${requestData.status}; skipping reminder`);
  await markNotificationSent(event.id, []);
  continue;
}
```

Costs nothing — `status` is already in the row `getServiceRequest()` fetched.
This is not guarding the ~60s poll gap; it guards the case where **the sidecar
is down or behind**. Pending rows are durable and the pending query has no age
filter, so a reminder queued at 07:00 during a deploy or restart sends whenever
the sidecar returns — potentially long after the request was cancelled. Marked
**sent, not failed**, since skipping is the correct outcome, and a `failedAt`
row would read as a false alarm during triage.

**Recipients — the assigned volunteer ONLY.** `resolveRecipientsForReminder`
resolves the volunteer via `getPerson(volunteerPersonId)` and honors the
`TEST_RECIPIENTS` override. It does not read `memberEmail`.

> **Corrected 2026-07-23.** This spec originally routed reminders to the
> volunteer *and* the member, carried over from issue #62's scaffolding
> (`sendToMember: true`). The customer's four sample emails contradict that and
> were the evidence nobody checked: every one is addressed **to the volunteer**
> (Joanne Miller), while the requesting member in the body is a different
> person (Zelda Blow). The copy — "a service request … for which you are
> scheduled" — describes a volunteer's obligation, not a member's request, and
> the body carries the member's address and cell as dispatch detail while
> giving a member no volunteer to contact. Members already learn who is coming
> from the `confirmed` email. A member-facing reminder would need its own copy
> and template; the customer has not asked for one.

**Subject.** `SR Reminder #<n>-For <member>-Service Date: <date>` where `<n>` is
`requestData.requestNumber || requestData.id` and `<date>` comes from
`formatDateForSubject`. Wrapped in `buildSubject()` for `[TEST]` mode. This
follows the sidecar's existing `SR Request #` / `SR Conf #` / `SR Cancel #`
convention rather than the PDFs' `The Village Common of RI - Reminder - SR #…`
(Gmail already shows the org as the sender).

**Send.** One email to the volunteer. `applyTestBanner` names that recipient in
test mode. Mark sent on success (recording the volunteer's person id); mark
failed if the send fails, or if the volunteer has no reachable email.

Because there is exactly one recipient, this branch needs no `anySuccess`
bookkeeping and is **not** subject to the partial-success retry gap (issue #2)
that affects the two-recipient `confirmed` and `cancelled` branches.

### 3. Enqueue EVENT — documented example

```sql
-- 11:00 UTC = 7am EDT. In winter use 12:00 UTC (7am EST) - see DST below.
CREATE EVENT vg_reminder_enqueue
ON SCHEDULE EVERY 1 DAY
STARTS '2026-07-24 11:00:00'
DO
  INSERT INTO notification_event (eventType, serviceRequestId)
  SELECT 'reminder', sr.id
  FROM service_request sr
  WHERE sr.status = 'Confirmed'
    AND sr.volunteerPersonId IS NOT NULL
    AND sr.serviceDate = DATE(NOW()) + INTERVAL 2 DAY
    AND NOT EXISTS (
      SELECT 1 FROM notification_event ne
      WHERE ne.serviceRequestId = sr.id
        AND ne.eventType = 'reminder');
```

Insert shape matches `ServiceRequestService.writeNotificationEvent`:
`INSERT INTO notification_event (eventType, serviceRequestId)`.

**DST — operational decision (customer, 2026-07-23).** The production database
runs on UTC and `ON SCHEDULE ... STARTS` is evaluated **once, at `CREATE` time**,
then advanced by exactly 24h forever — so a daily event does not follow a DST
change on its own. 7am ET is **11:00 UTC during EDT** and **12:00 UTC during
EST** (both verified against the dev DB).

The accepted practice is to **drop and recreate the event at each DST boundary**
with the correct UTC time, rather than making the event self-adjusting. An
earlier draft ran the event hourly and gated the body on the Eastern hour; that
was rejected as 24× the firings to avoid a twice-yearly manual step. Between
boundaries the event fires at a stable UTC time; a missed boundary sends
reminders an hour early or late until corrected, which is tolerable for this
notice.

This also removes the `CONVERT_TZ` dependency entirely, and with it the
`mysql.time_zone_name` failure mode (an unpopulated table makes `CONVERT_TZ`
return `NULL`, silently matching no rows).

**Idempotent.** The `NOT EXISTS` guard means a re-run, a scheduler restart, or a
manual re-run cannot double-queue a reminder.

**Wall-clock comparison.** `serviceDate` is a civil date compared against a bare
date — consistent with this repo's wall-clock rule. Plain `DATE(NOW())` is
correct **because the event fires mid-morning UTC**, where the UTC and Eastern
calendar dates agree. Verified boundaries: at 03:00 UTC (EDT) and 04:00 UTC
(EST) the Eastern date is still the previous day, so an event scheduled before
04:00/05:00 UTC would need the Eastern date computed explicitly.

**Selectivity** (measured against the dev-DB snapshot, 2026-07-23). Live
`service_request` statuses are `Completed`, `Confirmed`, `Member cancelled`,
`Unmatched`, `Open`, `Hub cancelled`, `Volunteer cancelled` — note `Unmatched`
is distinct from `Open`, and neither qualifies. `Confirmed` rows with a NULL
`volunteerPersonId`: **0**, so that guard is defensive (it makes the send
branch's precondition explicit) rather than load-bearing. Busiest single service
date: **25** qualifying requests, so the 07:00 burst is ~25 rows — a few seconds
through the serial poll loop.

**Prerequisites** (verified against the dev DB, MySQL 8.4.2, 2026-07-23):

- `@@event_scheduler` must be `ON` (verified `ON` on dev). This is the only
  prerequisite; the final design uses no `CONVERT_TZ`, so the timezone tables
  are not required.
- Note the brief's "1100 UTC" is 7am ET **only during EDT**; in winter 7am ET is
  1200 UTC. Hence the twice-yearly recreate.

### 4. Tests & preview

**`test/reminder-templates.test.js`:**

- All four service types render the shared body copy and the `401-441-5240`
  closing line.
- Date/Time: timed ride renders `at 8:00 AM`; a `timesFlexible` request renders
  `(The time is flexible)` and no time.
- Starting Location: a Rides reminder **contains** `Starting Location`;
  Errands, Home Help, and Tech Support reminders **do not** — this pins the
  Rides-only rule so it cannot silently regress.
- Destination: rendered when populated; the heading is **absent** when not.
- Null-address safety: a fixture with `NULL` address components renders no
  literal `"null"` (the `withBlankAddressNulls` contract).
- Subject: `SR Reminder #…` uses `requestNumber` when present, else `id`.

**`test/reminder-routing.test.js`:**

- `shouldSkipReminder` returns `false` for `Confirmed` with a volunteer, and
  `true` for every other status (`Member cancelled`, `Volunteer cancelled`,
  `Hub cancelled`, `Completed`, `Open`, `Unmatched`) and for `Confirmed` with a
  null volunteer.
- `buildSubject` applies the `[TEST]` prefix to the `SR Reminder #…` subject.

The send branch itself is **not** unit-tested: it lives inside `pollOnce`, which
needs a live DB and the Gmail API, and this repo deliberately has no mocking
harness (README, "Testing"). Its two decision points are covered as pure
functions above; end-to-end verification is the preview pages plus a
`TEST_RECIPIENTS` run before go-live.

**Preview:** four `preview/reminder-*.html` pages via `preview-templates.js`, so
the rendering can be compared against the customer's PDFs before go-live.

## Non-goals

- No reminders for any status other than `Confirmed` — in particular `Open` and
  `Unmatched` (which are distinct statuses) get none. Reminding a request with
  no assigned volunteer needs copy the customer has not supplied.
- No second or escalating reminder; one per request, enforced by `NOT EXISTS`.
- No change to the Errands / Rides open-confirmed templates, including the
  Errands Starting Location row discussed above.
- No fix for the partial-success retry gap (issue #2) — consistent with all
  existing branches.
- No refactor of the shared template chrome duplicated across the 14 builders;
  worthwhile, but its own issue.
- No migration applied in this repo; the `EVENT` ships as an example.
