# New Member Welcome Email

**Date:** 2026-08-04
**Status:** Approved, ready for implementation plan

## Problem

The customer wants an automatic confirmation/welcome email sent to a member
when the membership coordinator activates their membership. The approved copy
arrived in `scratch/Welcome_to_The_Village_Common_of_Rhode_Island!.eml`
(drafted by Gabriella Laurenzo, approved by Caroline Dillon, forwarded
2026-07-13). A follow-up correction removed the personal signature block: the
email ends at the first "The Village Common of Rhode Island" sign-off line —
no coordinator name/title/extension and no logo image.

The `member_welcome` kind was reserved ahead of time in `src/config.js`
(mailbox `volunteer@villagecommonri.org`, display name "The Village Common of
RI") but has no handler.

Unlike every SR-driven event, a welcome email is not about a service request,
so `notification_event.serviceRequestId` semantics do not fit. The codebase
already has a precedent for exactly this: `enroll_ineligible` is a
payload-driven event with `serviceRequestId` NULL and its inputs in the
`payload` JSON column (VG migration 0017).

## Approved copy

Subject: `Welcome to The Village Common of Rhode Island!`

```
Dear (new member),

Welcome to The Village Common of Rhode Island!

Your membership has been activated by our membership coordinator based on
your completed application.

**This email confirms your new membership in <village> village.**   <- bold

To access our website, visit www.villagecommonri.org. This is where you can
find information on upcoming events and other programming.

If you have any questions about the membership process, please contact our
office at 401-228-8683.

We hope to see you soon!

The Village Common of Rhode Island
```

`(new member)` is filled with the member's **first name**
(`getFirstName(person.fullName)`), matching the other member-facing templates.
The email ends at the sign-off line — **no** signature block ("Gabriella
Laurenzo", "Member & Volunteer Coordinator", "ext. 2", website link line) and
**no** logo image. The one bold sentence is preserved; www.villagecommonri.org
in the body is a link.

The bold sentence is a 2026-08-04 customer correction to the approved draft
(which read "membership for your village"): "for" becomes "in", and the
member's actual village name is substituted — e.g. "membership in Wood River
village." `village.name` stores the bare name ("Wood River"), so the template
appends the word "village". When the member's `person.villageId` is NULL, fall
back to the original generic wording, "membership in your village."

## Scope

`vg-email-sidecar` only. The **producer is out of scope**: the main
village-green app will insert the event row when the coordinator activates a
membership — separate work in that repo, against the contract below. No
changes to `db.js`, `gmail.js`, or `http-listener.js`; `queries.js` gets one
extension to `GET_PERSON` (below).

## Event contract (for the VG-side producer)

```sql
INSERT INTO notification_event (eventType, serviceRequestId, payload)
VALUES ('member_welcome', NULL, '{"memberPersonId": <person.id>}');
```

- `serviceRequestId` NULL — same as `enroll_ineligible`.
- `payload.memberPersonId` is the `person.id` of the activated member. The
  sidecar looks the person up **at send time** (fresh name/email), rather than
  snapshotting email/name into the payload.
- Requires the migration-0017 `payload` column. Safe: the producer does not
  exist until new VG work lands, which is post-0017, so `member_welcome` rows
  can never appear on a pre-0017 schema. The existing startup schema probe in
  `db.js` needs no change.

## Design

### 1. Query — `src/queries.js`

`GET_PERSON` gains the person's village name via a join:

```sql
SELECT p.id, p.fullName, p.email, p.phone, p.cell, v.name AS villageName
FROM person p
LEFT JOIN village v ON p.villageId = v.id
WHERE p.id = ?
```

`villageName` is NULL when the person has no village. The extra field is
harmless to the existing `getPerson` callers (volunteer lookups in the
confirmed/cancelled/reminder branches), and one query keeps the welcome
branch to a single lookup.

### 2. Template — `src/templates.js`

One new builder:

```js
buildMemberWelcomeTemplate({ firstName, villageName })
```

Plain `<p>`-body style like the enroll templates (Arial, Sans-Serif, 12px
inline body style) — **not** the nested-table SR chrome. Greeting is
`Dear <firstName>,` with the enroll templates' `Hello,` fallback when
`firstName` is empty. Body is the approved copy above: bold confirmation
sentence via `<b>` reading `membership in <villageName> village.` (or
`membership in your village.` when `villageName` is empty),
`www.villagecommonri.org` as an `<a href="http://www.villagecommonri.org">`
link, office number 401-228-8683 as text, ending at "The Village Common of
Rhode Island".

Exported from the module and wired into `preview-templates.js`.

### 3. Send branch — `src/email-processor.js`

A new payload-driven early branch in `pollOnce`, alongside the
`enroll_ineligible` branch (before the `getServiceRequest` call):

1. Parse `event.payload` (tolerate string or object, as the existing branch
   does). Missing `memberPersonId` → error log + `markNotificationFailed`.
2. `getPerson(payload.memberPersonId)`. Person not found or no email → error
   log + `markNotificationFailed` (nothing to send; matches
   `enroll_ineligible`'s missing-email handling).
3. Subject `Welcome to The Village Common of Rhode Island!`, `[TEST]`-prefixed
   in test mode via `buildSubject`.
4. Template inputs: `getFirstName(person.fullName)` and `person.villageName`
   from the extended `GET_PERSON` row.
5. `TEST_RECIPIENTS` override redirects the send; the banner is
   `applyEnrollTestBanner(html, person.email)` — the plain-body banner variant
   that matches this template's markup.
6. `sendEmail({ to, subject, html, kind: 'member_welcome' })` — the existing
   mailbox mapping routes it from `volunteer@villagecommonri.org`.
7. Success → `markNotificationSent(event.id, [person.id])` (recording the
   member as recipient); failure → `markNotificationFailed`.

`deriveRecipientsForEvent` is untouched — like `enroll_ineligible`, this event
never reaches the SR routing logic.

### 4. Tests & preview

**Template tests** (new `test/member-welcome-template.test.js`, following
`test/enroll-templates.test.js`):

- Renders the greeting with first name; `Hello,` fallback without one.
- Contains the key copy: activation sentence, bold confirmation sentence with
  the village name ("membership in Wood River village."), website link,
  401-228-8683, "We hope to see you soon!", and the sign-off.
- NULL/empty `villageName` renders the "membership in your village." fallback
  (and no literal "null").
- **Absence pins:** no "Gabriella", no "Member & Volunteer Coordinator",
  no "ext. 2", no `<img`.

**Query test** (`test/service-request-query.test.js` conventions): `GET_PERSON`
includes `villageName` and left-joins `village` (existing callers unaffected).

**Processor tests** (`test/email-processor.test.js` conventions): the send
branch lives in `pollOnce`, which the repo does not unit-test (no mocking
harness) — same stance as the member-reminder spec. End-to-end verification:
preview page plus a `TEST_RECIPIENTS` run before go-live. The existing
`mailbox-config.test.js` case for `member_welcome` → `volunteer@` already
covers routing; the config comment calling `member_welcome` "reserved for a
planned event type that has no handler yet" is updated.

**Preview:** a `preview/member-welcome.html` page via `preview-templates.js`.

## Non-goals

- No VG-side producer implementation (separate work, separate repo).
- No new notification_event columns or migrations.
- No signature block or logo image handling.
- No per-village customization beyond the village name in the bold sentence.
