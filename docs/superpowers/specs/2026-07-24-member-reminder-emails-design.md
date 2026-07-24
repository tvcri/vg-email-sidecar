# Member Reminder Emails

**Date:** 2026-07-24
**Status:** Approved, ready for implementation plan
**Supersedes:** the "assigned volunteer ONLY" recipient rule in
[2026-07-23-reminder-emails-design.md](2026-07-23-reminder-emails-design.md)

## Problem

The reminder feature (PR #13) sends a reminder to the **assigned volunteer
only**. That was correct at the time: the customer's four sample emails were all
volunteer-facing, and the 2026-07-23 spec noted that a member-facing reminder
"would need its own copy and template; the customer has not asked for one."

On 2026-07-24 the customer supplied exactly that:
`scratch/template-reminder-member.pdf`, a ClubExpress reminder addressed **to
the member** ("Hello Zelda. This is a reminder about a service you requested
…"), with the volunteer's contact info under "Your service provider(s)". The
customer confirmed **one template for all service types**.

The same `reminder` notification event must now produce **two** emails: the
existing volunteer reminder (unchanged) plus a new member reminder.

## Customer template

Per the PDF (SR #23869, member Zelda Blow, volunteer Joanne Miller):

```
Hello Zelda.
This is a reminder about a service you requested with The Village Common of RI.

  Service:      Ride: Medical Appnt
  Date/Time:    Monday, December 29, 2025 at 8:00 AM

Your service provider(s)
Joanne Miller
401-465-0405
j.millerxxx@gmail.com

Short Description
Round-trip ride to medical appointment.

If you have any questions or need to cancel this service, please call
401-441-5240 or reply to the email.
```

Notable **omissions** relative to the volunteer reminder: no Requesting Member
address block, no Starting Location, no Destination. These are omissions in the
customer's template, not rendering artifacts — the member knows their own
address, and the provider section replaces the dispatch detail.

## Scope

`vg-email-sidecar` only. **No changes** to the `vg_reminder_enqueue` EVENT, the
polling loop, `queries.js`, `db.js`, or `gmail.js`. The existing event row
drives both sends; `GET_SERVICE_REQUEST` already returns `memberEmail` and
`memberPersonId`, and `getPerson()` already returns the volunteer's `cell` /
`phone`.

## Design

### 1. Template — `src/templates.js`

One new builder:

```js
buildMemberReminderTemplate(memberFirstName, volunteerData, requestData)
```

Used for **all service types** — no per-type dispatch, matching the customer's
single template. Follows file conventions: `withBlankAddressNulls(requestData)`
first, the shared outer-table chrome, the sidecar's Village Green footer (same
as `buildReminderTemplate`, not the PDF's ClubExpress footer).

Body:

- `Hello <memberFirstName>.` then "This is a reminder about a service you
  requested with **The Village Common of RI**."
- `Service:` / `Date/Time:` label/value pairs with bold values, using the same
  markup and the **same date/time conditional** as `buildReminderTemplate`:
  `startTime && !timesFlexible` renders `<date> at <time>`, otherwise
  `<date> (The time is flexible)`. The distinction is data-driven; no
  service-type check.
- `Your service provider(s)` as an underlined heading, then the volunteer's
  contact in the PDF's order: **name, phone, email**. Phone prefers
  `volunteerData.cell` with the `(cell)` suffix, falling back to
  `volunteerData.phone` — the member-confirmed templates' rule. Email is a
  `mailto:` link. Absent pieces are dropped (filter-and-join, no blank lines).
- `Short Description` as an underlined heading, then `description`.
- Closing: "If you have any questions or need to cancel this service, please
  call 401-441-5240 or reply to the email." (PDF wording — "the email", where
  the volunteer reminder says "this email".)

Deliberately **not** rendered: member address block, Starting Location (even
for Rides), Destination — per the customer template.

### 2. Send branch — `src/email-processor.js`

Extend the existing `reminder` branch to the two-recipient shape of the
`confirmed` branch.

**`resolveRecipientsForReminder`** additionally returns `memberEmail` (from
`requestData.memberEmail`), `memberName`, and `intendedRecipients` for the
test-mode banner. The `TEST_RECIPIENTS` override redirects the member send
**only when the member has an email in prod** — the confirmed branch's
"don't fabricate a member send test mode would record but prod would skip"
rule. The volunteer-resolution and early-return behavior is unchanged.

**Send semantics — mirrors `confirmed`:**

- Same subject for both emails:
  `SR Reminder #<n>-For <member>-Service Date: <date>`, `[TEST]`-prefixed in
  test mode.
- Volunteer email built with `buildReminderTemplate` (unchanged); member email
  with `buildMemberReminderTemplate`, passing
  `getFirstName(requestData.memberName)` and the resolved volunteer.
- **The volunteer send gates the event outcome**: sent (recording the
  volunteer's person id) or failed. The member send is best-effort: on success
  record `memberPersonId`; on failure log and continue. A member with no email
  is silently skipped, volunteer still notified.
- In test mode, each email's banner names only its own intended recipient.
- This inherits the known partial-success retry gap (issue #2), consistent
  with the `confirmed` and `cancelled` branches; not fixed here.

**`shouldSkipReminder` is unchanged** — `Confirmed` with an assigned volunteer,
or nobody gets a reminder. The member template presupposes a provider to list,
so the gate applies to both recipients.

**`deriveRecipientsForEvent`** reminder entry becomes
`{ sendToBccVolunteers: false, sendToVolunteer: true, sendToMember: true }`.
The long "reminders never go to the member" comment there, and the matching
one on `resolveRecipientsForReminder`, are rewritten to reflect the new
customer direction (and the NOTE that the branch doesn't consult the routing
entry is re-checked against the new branch shape).

### 3. Tests & preview

**Template tests** (new `test/member-reminder-templates.test.js`, following
`test/reminder-templates.test.js`):

- Renders the intro copy, `Your service provider(s)`, and the 401-441-5240
  closing for a representative service type of each family.
- Provider contact renders name, phone, and email in order; cell preferred
  over landline; missing email/phone drop cleanly.
- Timed ride renders `at 8:00 AM`; `timesFlexible` renders
  `(The time is flexible)`.
- **Absence pins:** no `Requesting Member`, no `Starting Location` (including
  for a Ride), no `Destination` heading.
- Null-address fixture renders no literal `"null"`.

**Routing tests** (`test/reminder-routing.test.js`): `deriveRecipientsForEvent`
for `reminder` now returns `sendToMember: true`.

The send branch itself is not unit-tested (lives in `pollOnce`; repo has no
mocking harness). End-to-end verification: preview pages plus a
`TEST_RECIPIENTS` run before go-live.

**Preview:** `preview/reminder-member-*.html` pages via `preview-templates.js`
for comparison against the PDF.

## Non-goals

- No change to the volunteer reminder template or its recipient rule.
- No change to the enqueue EVENT, gating statuses, or schedule.
- No per-service-type member reminder copy — one template, per the customer.
- No fix for the partial-success retry gap (issue #2).
