# Automatic Reminder Emails Implementation Plan

> ⚠️ **HISTORICAL ARTIFACT — superseded in three places. Do not read this as a
> description of current behavior; see the spec and `README.md` instead.**
>
> This plan was executed as written, then corrected during review:
> 1. **Recipients:** reminders go to the **assigned volunteer ONLY, never the
>    member**. The code snippets below still say "and the member" — that was
>    reversed in `e1a72ad` after the customer's sample emails showed every one
>    addressed to the volunteer.
> 2. **The example `EVENT`** is a plain daily UTC schedule recreated by hand at
>    each DST boundary, not the hourly Eastern-hour-gated version below
>    (`8ff491a`).
> 3. **Template layout** was restructured to a single left margin (`527183e`).
>
> Also note Task 4's Step 5 wrongly assumed `preview/` is git-tracked; it is
> gitignored, and the generated previews are local build artifacts.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send a reminder email to the assigned volunteer at 7am Eastern, two days before the service date, for Confirmed service requests. *(Original text said "and the member" — see the correction notice above.)*

**Architecture:** One new template builder in `src/templates.js` (three data-driven conditionals, no per-service-type dispatcher), a real `reminder` branch replacing the stub in `src/email-processor.js`, and a documented example MySQL `EVENT` that enqueues rows. The polling loop, queries, and Gmail layer are untouched — the poller already picks up any pending row regardless of `eventType`.

**Tech Stack:** Node.js (CommonJS), `node --test`, MySQL 8.4, `mysql2/promise`, Gmail API via `googleapis`.

**Spec:** `docs/superpowers/specs/2026-07-23-reminder-emails-design.md`
**Issue:** [tvcri/village-green#62](https://github.com/tvcri/village-green/issues/62)

## Global Constraints

- **CommonJS only** — `require`/`module.exports`. No ESM.
- **Wall-clock dates.** `serviceDate` is `'YYYY-MM-DD'` and the TIME columns are `'HH:MM:SS'` civil strings. Never build a JS `Date` from them or timezone-convert them. Use the existing `formatServiceDate()` and `formatCivilTime()` helpers.
- **Starting Location is Rides only.** Not Errands, not Home Help, not Tech Support. The existing Errands templates wrongly carry the row — **leave them untouched**; correcting them is out of scope.
- **Never print `"null"`.** Call `withBlankAddressNulls(requestData)` first in every template builder.
- **Test style:** `node:test` + `node:assert/strict`, pure functions only. This repo has **no DB or Gmail mocking harness** and this plan does not add one.
- **Exact closing copy:** `If you have any questions or need to cancel this service, please call 401-441-5240 or reply to this email.`
- **Exact intro copy:** `This is a reminder about a service request with The Village Common of RI for which you are scheduled.`
- Run the full suite with `npm test`. Baseline before this work: **97 passing, 0 failing.**

## File Structure

| File | Change | Responsibility |
| --- | --- | --- |
| `src/templates.js` | Modify (add builder + export) | `buildReminderTemplate` — renders the reminder HTML |
| `src/email-processor.js` | Modify (add predicate, replace stub at :535-539, add resolver, extend exports at :556) | `shouldSkipReminder`, `resolveRecipientsForReminder`, the real send branch |
| `test/reminder-templates.test.js` | Create | Template rendering + Rides-only rule |
| `test/reminder-routing.test.js` | Create | `shouldSkipReminder` + subject building |
| `preview-templates.js` | Modify | Render four reminder previews |
| `docs/examples/reminder-event.sql` | Create | The example EVENT (not applied) |
| `README.md` | Modify | Document the reminder flow and the EVENT |

**Task order rationale:** Task 1 builds the template (pure, no dependencies). Task 2 adds the skip predicate (pure). Task 3 wires the send branch using both. Task 4 is docs + preview. Each task ends green and committable.

---

### Task 1: Reminder template

**Files:**
- Modify: `src/templates.js` (add builder before `module.exports` at :1638; add to exports)
- Test: `test/reminder-templates.test.js` (create)

**Interfaces:**
- Consumes: existing `formatServiceDate`, `formatCivilTime`, `formatStartingLocation`, `withBlankAddressNulls` (all already defined in `src/templates.js`).
- Produces: `buildReminderTemplate(recipientFirstName: string, requestData: object) -> string` (HTML). Used by Task 3 and Task 4.

- [ ] **Step 1: Write the failing test**

Create `test/reminder-templates.test.js`:

```js
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { buildReminderTemplate } = require('../src/templates.js')

const ridesRequest = {
  serviceName: 'Ride: Medical Appnt',
  memberName: 'Zelda Blow',
  memberAddress: '10 Happy Street',
  memberCity: 'Providence',
  memberState: 'RI',
  memberZip: '02906',
  memberCell: '401-465-0405',
  description: 'Round-trip ride to medical appointment.',
  serviceDate: '2025-12-29',
  timesFlexible: false,
  startTime: '08:00:00',
  start: null,
  startAddress: null,
  destination: 'Rhode Island Eye Institute',
  address: '150 East Manning Street',
  city: 'Providence',
  state: 'RI',
  zip: '02906',
}

const errandsRequest = {
  serviceName: 'Errand: Pick up/delivery',
  memberName: 'Zelda Blow',
  memberAddress: '10 Happy Street',
  memberCity: 'Providence',
  memberState: 'RI',
  memberZip: '02906',
  memberCell: '401-465-0405',
  description: 'Pick up medication at CVS and deliver to Zelda.',
  serviceDate: '2025-12-29',
  timesFlexible: true,
  startTime: null,
  destination: 'CVS',
  address: '481 Angell Street',
  city: 'Providence',
  state: 'RI',
  zip: '02906',
}

const homeHelpRequest = {
  serviceName: 'Household Chores/Handy Help',
  memberName: 'Zelda Blow',
  memberAddress: '10 Happy Street',
  memberCity: 'Providence',
  memberState: 'RI',
  memberZip: '02906',
  memberCell: '401-465-0405',
  description: 'Change a light bulb in a ceiling fixture.',
  serviceDate: '2025-12-29',
  timesFlexible: true,
  startTime: null,
  destination: null,
}

const techRequest = {
  serviceName: 'Tech Support',
  memberName: 'Zelda Blow',
  memberAddress: '10 Happy Street',
  memberCity: 'Providence',
  memberState: 'RI',
  memberZip: '02906',
  memberCell: '401-465-0405',
  description: 'Zelda has a new iPhone 17 and needs help setting it up.',
  serviceDate: '2025-12-29',
  timesFlexible: true,
  startTime: null,
  destination: null,
}

test('renders the shared reminder intro and closing copy for every service type', () => {
  for (const rd of [ridesRequest, errandsRequest, homeHelpRequest, techRequest]) {
    const html = buildReminderTemplate('Joanne', rd)
    assert.match(html, /This is a reminder about a service request with <strong>The Village Common of RI<\/strong> for which you are scheduled\./)
    assert.match(html, /please call 401-441-5240 or reply to this email\./)
    assert.match(html, new RegExp(rd.serviceName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
})

test('shows the time for a timed ride and the flexible note otherwise', () => {
  const ridesHtml = buildReminderTemplate('Joanne', ridesRequest)
  assert.match(ridesHtml, /Monday, December 29, 2025 at 8:00 AM/)
  assert.doesNotMatch(ridesHtml, /The time is flexible/)

  // The gap before the flexible note is a literal &nbsp; entity (matching the
  // spacing in the customer PDFs), not whitespace - so match the entity.
  for (const rd of [errandsRequest, homeHelpRequest, techRequest]) {
    const html = buildReminderTemplate('Joanne', rd)
    assert.match(html, /Monday, December 29, 2025 &nbsp;\(The time is flexible\)/)
    assert.doesNotMatch(html, / at \d+:\d{2} (AM|PM)/)
  }
})

test('renders the requesting member block with the home address and cell', () => {
  const html = buildReminderTemplate('Joanne', ridesRequest)
  assert.match(html, /Zelda Blow/)
  assert.match(html, /10 Happy Street/)
  assert.match(html, /Providence, RI 02906/)
  assert.match(html, /401-465-0405 \(cell\)/)
})

test('shows Starting Location for rides only', () => {
  const ridesHtml = buildReminderTemplate('Joanne', ridesRequest)
  assert.match(ridesHtml, /Starting Location/)

  for (const rd of [errandsRequest, homeHelpRequest, techRequest]) {
    const html = buildReminderTemplate('Joanne', rd)
    assert.doesNotMatch(html, /Starting Location/)
  }
})

test('prefers the authoritative start address over member home for rides', () => {
  const html = buildReminderTemplate('Joanne', {
    ...ridesRequest,
    start: 'Laurelmead Cooperative',
    startAddress: '355 Blackstone Blvd',
    startCity: 'Providence',
    startState: 'RI',
    startZip: '02906',
  })
  assert.match(html, /Laurelmead Cooperative - 355 Blackstone Blvd/)
})

test('omits the Destination heading when there is no destination', () => {
  const withDest = buildReminderTemplate('Joanne', ridesRequest)
  assert.match(withDest, /Destination/)
  assert.match(withDest, /Rhode Island Eye Institute/)

  for (const rd of [homeHelpRequest, techRequest]) {
    const html = buildReminderTemplate('Joanne', rd)
    assert.doesNotMatch(html, /Destination/)
  }
})

// Output-level regression guard. Note this passes even if the
// withBlankAddressNulls() call is removed, because the template's own
// conditionals already suppress nulls on these paths - it pins the rendered
// output, not the guard. Keep the withBlankAddressNulls() call regardless: it
// is the file-wide convention and protects future edits that interpolate an
// address field unconditionally.
test('never renders the literal string null for missing address parts', () => {
  const cases = [
    // nothing but a name
    {
      serviceName: 'Tech Support', memberName: 'Zelda Blow',
      memberAddress: null, memberCity: null, memberState: null, memberZip: null,
      memberCell: null, description: 'Set up a new tablet.',
      serviceDate: '2025-12-29', timesFlexible: true, startTime: null, destination: null,
    },
    // street present but city/state/zip missing - exercises the interpolated block
    {
      serviceName: 'Ride: Medical Appnt', memberName: 'Zelda Blow',
      memberAddress: '10 Happy Street', memberCity: null, memberState: null, memberZip: null,
      memberCell: null, description: 'Ride to appointment.',
      serviceDate: '2025-12-29', timesFlexible: false, startTime: '08:00:00',
      start: null, startAddress: null,
      destination: 'CVS', address: '481 Angell Street', city: null, state: null, zip: null,
    },
  ]
  for (const rd of cases) {
    assert.doesNotMatch(buildReminderTemplate('Joanne', rd), /null/)
  }
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/reminder-templates.test.js`
Expected: FAIL — `buildReminderTemplate is not a function`.

- [ ] **Step 3: Write the implementation**

In `src/templates.js`, insert immediately before `module.exports` (currently line 1638):

```js
// Reminder notice sent to both the assigned volunteer and the member two days
// before the service date. One builder covers all four service types: the four
// customer template PDFs share a single layout and differ only in data, so the
// variation is expressed as three conditionals rather than four near-identical
// builders.
//
// Starting Location is RIDES ONLY - confirmed customer intent. Note the Errands
// open/confirmed templates in this file render that row from an earlier misread;
// do not copy that behavior here, and do not "fix" those templates from this
// feature.
function buildReminderTemplate(recipientFirstName, requestData) {
  requestData = withBlankAddressNulls(requestData);
  const {
    serviceName,
    memberName,
    memberAddress,
    memberCity,
    memberState,
    memberZip,
    memberCell,
    description,
    destination,
    address,
    city,
    state,
    zip,
    serviceDate,
    timesFlexible,
    startTime,
  } = requestData;

  const dateOnly = formatServiceDate(serviceDate);
  const timeOnly = formatCivilTime(startTime);
  // Rides carry a startTime; the other service types are flagged flexible. The
  // distinction is in the data, so no service-type check is needed here.
  const dateTime = startTime && !timesFlexible && timeOnly
    ? `${dateOnly} at ${timeOnly}`
    : `${dateOnly} &nbsp;(The time is flexible)`;

  const memberAddressBlock = memberAddress
    ? `${memberName}<br>${memberAddress}<br>${memberCity}, ${memberState} ${memberZip}${memberCell ? `<br><br>${memberCell} (cell)` : ''}`
    : (memberName || '');

  const isRide = !!serviceName && serviceName.startsWith('Ride:');
  const startingLocationRow = isRide
    ? `<tr>
                            <td valign='top'>Starting Location:</td>
                            <td valign='top'>${formatStartingLocation(requestData)}</td>
                          </tr>`
    : '';

  const destinationAddress = destination && address
    ? `${destination}<br>${address}<br><br>${city}, ${state} ${zip}`
    : (destination || '');
  const destinationBlock = destination
    ? `<u>Destination</u><br>${destinationAddress}<br><br>`
    : '';

  const html = `<html>
<body style="font-family:Arial, Sans-Serif; font-size:12px; font-weight:normal;">
  <table border='0' cellpadding='50' cellspacing='0' style='background-color: #b2b2b2;width: 100%;'>
    <tr>
      <td align='center'>
        <table border='0' cellpadding='4' cellspacing='0' style='background-color:white; width:600px;border-width:1px;border-color:Black; border-style:solid;border-radius:10px;'>
          <tr>
            <td>
              <table cellpadding='0' cellspacing='0' border='0'>
                <tr>
                  <td style='font-weight: bold; font-size: 24px; font-family: Arial, Sans-Serif;padding:10px 5px;border-bottom:1px solid #cdcdcd;width:100%;'>
                    The Village Common of RI
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td>
              <table cellpadding='15' cellspacing='0' border='0'>
                <tr>
                  <td align='left' style='font-family: Arial, Sans-Serif;font-size:12px;font-weight:normal;border-bottom:1px solid #cdcdcd;'>
                    This is a reminder about a service request with <strong>The Village Common of RI</strong> for which you are scheduled.<br><br>
                    <div style='margin-left:15px;margin-top:4px;margin-bottom:10px;'>
                      <table cellpadding='3' cellspacing='0' border='0' style='font-family:Arial, Sans-Serif; font-size:12px; font-weight:normal;'>
                        <tbody>
                          <tr>
                            <td valign='top'>Service:</td>
                            <td valign='top'><strong>${serviceName}</strong></td>
                          </tr>
                          <tr>
                            <td valign='top'>Date/Time:</td>
                            <td valign='top'><strong>${dateTime}</strong></td>
                          </tr>
                          <tr>
                            <td valign='top'>Requesting Member:</td>
                            <td valign='top'>
                              ${memberAddressBlock}
                            </td>
                          </tr>
                          ${startingLocationRow}
                        </tbody>
                      </table>
                    </div>
                    <u>Short Description</u><br>
                    ${description || ''}<br><br>
                    ${destinationBlock}
                    If you have any questions or need to cancel this service, please call 401-441-5240 or reply to this email.<br>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td>
              <div style='font-size:10px;font-style:italic;color:#666666'>
                This email was sent in response to the use of the Village Green platform by The Village Common of RI.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return html;
}
```

Then add `buildReminderTemplate,` to the `module.exports` object.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/reminder-templates.test.js`
Expected: PASS — 7 tests.

Then run the full suite: `npm test`
Expected: **104 passing, 0 failing** (97 baseline + 7 new).

- [ ] **Step 5: Commit**

```bash
git add src/templates.js test/reminder-templates.test.js
git commit -m "feat: add reminder email template

One builder for all four service types; the supplied PDFs share a single
layout and differ only in data. Starting Location is rides-only per customer
intent, and the empty Destination heading in the home-help/tech PDFs is
dropped rather than reproduced."
```

---

### Task 2: Skip predicate for non-Confirmed requests

**Files:**
- Modify: `src/email-processor.js` (add function before `pollOnce`; add to exports at :556)
- Test: `test/reminder-routing.test.js` (create)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `shouldSkipReminder(requestData: object) -> boolean`. Used by Task 3.

**Why a separate pure function:** this repo has no DB or Gmail mocking harness and deliberately tests only pure pieces (see README "Testing"). Extracting the decision keeps it covered without inventing a mock layer.

- [ ] **Step 1: Write the failing test**

Create `test/reminder-routing.test.js`:

```js
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { shouldSkipReminder, buildSubject } = require('../src/email-processor.js')

test('does not skip a Confirmed request', () => {
  assert.equal(shouldSkipReminder({ status: 'Confirmed', volunteerPersonId: 42 }), false)
})

test('skips a request that is no longer Confirmed', () => {
  for (const status of ['Member cancelled', 'Volunteer cancelled', 'Hub cancelled', 'Completed', 'Open', 'Unmatched']) {
    assert.equal(shouldSkipReminder({ status, volunteerPersonId: 42 }), true, `expected skip for ${status}`)
  }
})

test('skips a Confirmed request that has lost its volunteer', () => {
  assert.equal(shouldSkipReminder({ status: 'Confirmed', volunteerPersonId: null }), true)
})

test('reminder subject follows the SR Reminder convention', () => {
  const base = 'SR Reminder #23869-For Zelda Blow-Service Date: 12/29/2025'
  assert.equal(buildSubject(base, false), base)
  assert.equal(buildSubject(base, true), `[TEST] ${base}`)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/reminder-routing.test.js`
Expected: FAIL — `shouldSkipReminder is not a function`.

- [ ] **Step 3: Write the implementation**

In `src/email-processor.js`, add immediately after `deriveRecipientsForEvent` (which ends at line 190):

```js
// A reminder row is enqueued at 07:00 ET, but pending rows are durable and the
// pending-events query has no age filter - if the sidecar is down or behind at
// that moment, the row is delivered whenever it next runs. Re-check the request
// at send time so a request cancelled during that gap does not get a reminder.
// status is already on the row getServiceRequest() fetched, so this costs no
// extra query.
function shouldSkipReminder(requestData) {
  if (requestData.status !== 'Confirmed') return true;
  if (!requestData.volunteerPersonId) return true;
  return false;
}
```

Add `shouldSkipReminder` to the `module.exports` list on line 556.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/reminder-routing.test.js`
Expected: PASS — 4 tests.

Run: `npm test`
Expected: **108 passing, 0 failing.**

- [ ] **Step 5: Commit**

```bash
git add src/email-processor.js test/reminder-routing.test.js
git commit -m "feat: add shouldSkipReminder predicate

Guards the case where the sidecar is down or behind at 07:00 and delivers a
reminder for a request that was cancelled in the meantime."
```

---

### Task 3: Reminder send branch

**Files:**
- Modify: `src/email-processor.js` — add `resolveRecipientsForReminder` after `resolveRecipientsForCancelledRequest` (ends :323); replace the stub at :535-539; add the template import at :12-29

**Interfaces:**
- Consumes: `buildReminderTemplate` (Task 1), `shouldSkipReminder` (Task 2), and existing `getPerson`, `getTestConfig`, `sendEmail`, `markNotificationSent`, `markNotificationFailed`, `applyTestBanner`, `getFirstName`, `formatDateForSubject`, `buildSubject`.
- Produces: the working `reminder` event path. Nothing later depends on it.

**No new test:** the send branch lives inside `pollOnce`, which needs a DB and the Gmail API. Its two decision points are already covered by Task 2 (`shouldSkipReminder`) and Task 1 (the template). Verification is the preview in Task 4 plus a live TEST_RECIPIENTS run.

- [ ] **Step 1: Add the template import**

In `src/email-processor.js`, add `buildReminderTemplate,` to the destructured `require('./templates')` block (lines 12-29), after `buildMemberCancelledTemplate,`.

- [ ] **Step 2: Add the recipient resolver**

Insert after `resolveRecipientsForCancelledRequest` (ends line 323):

```js
// Mirrors resolveRecipientsForCancelledRequest. Callers must have already run
// shouldSkipReminder, so volunteerPersonId is guaranteed non-null here.
async function resolveRecipientsForReminder(requestData) {
  const testConfig = getTestConfig();

  const volunteer = await getPerson(requestData.volunteerPersonId);

  if (!volunteer || !volunteer.email) {
    console.warn(`Volunteer person not found or has no email: ${requestData.volunteerPersonId}`);
  }

  const memberEmail = requestData.memberEmail;

  const intendedRecipients = [];
  if (volunteer && volunteer.email) {
    intendedRecipients.push({ fullName: volunteer.fullName, email: volunteer.email });
  }
  if (memberEmail) {
    intendedRecipients.push({ fullName: requestData.memberName, email: memberEmail });
  }

  if (testConfig.overrideRecipients) {
    console.log(`[TEST MODE] Using override recipients: ${testConfig.overrideRecipients.join(', ')}`);
    return {
      volunteerEmail: (volunteer && volunteer.email) ? testConfig.overrideRecipients.join(', ') : null,
      memberEmail: memberEmail ? testConfig.overrideRecipients.join(', ') : null,
      volunteer,
      memberName: requestData.memberName,
      intendedRecipients,
      isTestMode: true,
    };
  }

  return {
    volunteerEmail: (volunteer && volunteer.email) ? volunteer.email : null,
    memberEmail: memberEmail || null,
    volunteer,
    memberName: requestData.memberName,
    intendedRecipients: null,
    isTestMode: false,
  };
}
```

- [ ] **Step 3: Replace the stub**

Replace lines 535-539 of `src/email-processor.js` — currently:

```js
      } else if (event.eventType === 'reminder') {
        console.warn(`[${new Date().toISOString()}] No template yet for eventType=${event.eventType}, marking failed`);
        await markNotificationFailed(event.id);
        failed++;
```

with:

```js
      } else if (event.eventType === 'reminder') {
        if (shouldSkipReminder(requestData)) {
          console.log(`[${new Date().toISOString()}] SR #${requestData.id} is ${requestData.status} with volunteer ${requestData.volunteerPersonId || 'none'}; skipping reminder`);
          await markNotificationSent(event.id, []);
          sent++;
          continue;
        }

        const recipients = await resolveRecipientsForReminder(requestData);
        const baseSubject = `SR Reminder #${subjectNumber}-For ${requestData.memberName}-Service Date: ${formatDateForSubject(requestData.serviceDate)}`;
        const subject = buildSubject(baseSubject, recipients.isTestMode);

        // Each email's banner names only its own intended recipient, not the
        // combined list of everyone notified for this event.
        const volunteerIntended = recipients.volunteer
          ? (recipients.intendedRecipients || []).find(r => r.email === recipients.volunteer.email)
          : null;
        const memberIntended = (recipients.intendedRecipients || []).find(r => r.fullName === recipients.memberName);

        let anySuccess = false;

        if (recipients.volunteerEmail) {
          const html = buildReminderTemplate(getFirstName(recipients.volunteer.fullName), requestData);
          const finalHtml = recipients.isTestMode && volunteerIntended
            ? applyTestBanner(html, `${volunteerIntended.fullName} (${volunteerIntended.email})`)
            : html;
          const result = await sendEmail({ to: recipients.volunteerEmail, subject, html: finalHtml, kind: event.eventType });
          if (result.success) {
            console.log(`[${new Date().toISOString()}] Volunteer reminder email sent: ${subject}`);
            recipientPersonIds.push(recipients.volunteer.id);
            anySuccess = true;
          } else {
            console.error(`[${new Date().toISOString()}] Failed to send volunteer reminder email: ${result.error}`);
          }
        }

        if (recipients.memberEmail) {
          const html = buildReminderTemplate(getFirstName(recipients.memberName), requestData);
          const finalHtml = recipients.isTestMode && memberIntended
            ? applyTestBanner(html, `${memberIntended.fullName} (${memberIntended.email})`)
            : html;
          const result = await sendEmail({ to: recipients.memberEmail, subject, html: finalHtml, kind: event.eventType });
          if (result.success) {
            console.log(`[${new Date().toISOString()}] Member reminder email sent: ${subject}`);
            if (requestData.memberPersonId) recipientPersonIds.push(Number(requestData.memberPersonId));
            anySuccess = true;
          } else {
            console.error(`[${new Date().toISOString()}] Failed to send member reminder email: ${result.error}`);
          }
        }

        if (anySuccess) {
          await markNotificationSent(event.id, recipientPersonIds);
          sent++;
        } else {
          console.warn(`[${new Date().toISOString()}] SR #${requestData.id} reminder had no reachable recipients`);
          await markNotificationFailed(event.id);
          failed++;
        }
```

- [ ] **Step 4: Verify the suite still passes**

Run: `npm test`
Expected: **108 passing, 0 failing** — unchanged from Task 2; this task adds no tests.

Then confirm the module still loads (catches typos and bad destructuring):

Run: `node -e "require('./src/email-processor.js'); console.log('loads ok')"`
Expected: `loads ok`

- [ ] **Step 5: Commit**

```bash
git add src/email-processor.js
git commit -m "feat: send reminder emails instead of failing the event

Replaces the reminder stub with a real send branch mirroring the cancelled
branch: skip-if-not-Confirmed, then one email each to the assigned volunteer
and the member, marking sent if either succeeds."
```

---

### Task 4: Preview pages, example EVENT, and README

**Files:**
- Modify: `preview-templates.js`
- Create: `docs/examples/reminder-event.sql`
- Modify: `README.md` (replace the `### \`reminder\`` section, currently "Routed but **no template exists yet**")

**Interfaces:**
- Consumes: `buildReminderTemplate` (Task 1).
- Produces: four `preview/reminder-*.html` files, the example SQL, and updated docs.

- [ ] **Step 1: Add reminder previews**

In `preview-templates.js`, add `buildReminderTemplate,` to the `require('./src/templates')` destructure, then add these four entries to the end of the `renders` array:

```js
  // Reminder notices go to the assigned volunteer and the member two days
  // before the service date. Starting Location appears on rides only.
  ['reminder-rides.html',   buildReminderTemplate('Joanne', ridesRequest)],
  ['reminder-errands.html', buildReminderTemplate('Joanne', errandsRequest)],
  ['reminder-homhelp.html', buildReminderTemplate('Joanne', homeHelpRequest)],
  ['reminder-techsup.html', buildReminderTemplate('Joanne', techRequest)],
```

- [ ] **Step 2: Generate and eyeball the previews**

Run: `node preview-templates.js`
Expected: output includes four new `Wrote .../preview/reminder-*.html` lines.

Verify the rides-only rule actually held in the rendered output:

Run: `grep -c "Starting Location" preview/reminder-rides.html preview/reminder-errands.html preview/reminder-homhelp.html preview/reminder-techsup.html`
Expected: `reminder-rides.html:1`, and `:0` for the other three.

Open `preview/reminder-rides.html` in a browser and compare against `scratch/template-reminder-ride.pdf` page 2.

- [ ] **Step 3: Write the example EVENT**

Create `docs/examples/reminder-event.sql`:

```sql
-- EXAMPLE ONLY - not applied by this repo.
--
-- Enqueues reminder notification_event rows. This belongs to the village-green
-- migrations (see tvcri/village-green#62); it lives here as a reviewed
-- reference because the sidecar is what consumes the rows.
--
-- Business rule: send reminders at 7am Eastern, two days before the service
-- date, for Confirmed requests that have an assigned volunteer.
--
-- Why hourly rather than daily: a fixed-UTC daily schedule cannot hold 7am ET
-- across DST. 7am ET is 11:00 UTC in summer but 12:00 UTC in winter, and a
-- STARTS expression is evaluated once at CREATE time and then advanced by
-- exactly 24h forever - so it would silently drift by an hour each spring and
-- fall. Running hourly and gating on the Eastern hour is self-correcting.
--
-- Prerequisites:
--   * mysql.time_zone_name must be populated, or CONVERT_TZ returns NULL and
--     the WHERE clause silently matches nothing. Verify with:
--       SELECT CONVERT_TZ('2026-01-24 07:00:00','America/New_York','UTC');
--     -- expect 2026-01-24 12:00:00 (and 11:00:00 for a July date)
--   * SET GLOBAL event_scheduler = ON;
--
-- Idempotent: the NOT EXISTS guard means an hourly re-run, a scheduler
-- restart, or a manual re-run cannot double-queue a reminder.

CREATE EVENT vg_reminder_enqueue
ON SCHEDULE EVERY 1 HOUR
DO
  INSERT INTO notification_event (eventType, serviceRequestId)
  SELECT 'reminder', sr.id
  FROM service_request sr
  WHERE HOUR(CONVERT_TZ(NOW(), 'UTC', 'America/New_York')) = 7
    AND sr.status = 'Confirmed'
    AND sr.volunteerPersonId IS NOT NULL
    AND sr.serviceDate = DATE(CONVERT_TZ(NOW(), 'UTC', 'America/New_York')) + INTERVAL 2 DAY
    AND NOT EXISTS (
      SELECT 1 FROM notification_event ne
      WHERE ne.serviceRequestId = sr.id
        AND ne.eventType = 'reminder');

-- To preview what a run would enqueue, without inserting:
--
--   SELECT sr.id, sr.serviceName, sr.serviceDate
--   FROM service_request sr
--   WHERE sr.status = 'Confirmed'
--     AND sr.volunteerPersonId IS NOT NULL
--     AND sr.serviceDate = DATE(CONVERT_TZ(NOW(),'UTC','America/New_York')) + INTERVAL 2 DAY
--     AND NOT EXISTS (
--       SELECT 1 FROM notification_event ne
--       WHERE ne.serviceRequestId = sr.id AND ne.eventType = 'reminder');
```

- [ ] **Step 4: Update the README**

In `README.md`, replace the current `reminder` section:

```markdown
### `reminder`

Routed but **no template exists yet** — events are logged with a warning and
marked failed. Unknown event types are also marked failed.
```

with:

```markdown
### `reminder` — service is two days away

Sent to the assigned volunteer and the member (skipped if the member has no
email). Subject: `SR Reminder #…`. One shared template covers all four service
types; **Starting Location appears on rides only**.

Reminder rows are enqueued by a MySQL scheduled `EVENT` owned by the
village-green migrations, not by the API — see `docs/examples/reminder-event.sql`
for a documented reference implementation and its prerequisites
(`mysql.time_zone_name` populated, `event_scheduler` ON).

Because pending rows are durable and are not age-filtered, a reminder queued
while the sidecar is down is delivered whenever it next runs. The branch
therefore re-checks the request at send time: anything no longer `Confirmed`,
or that has lost its volunteer, is **marked sent without emailing** rather than
marked failed — skipping is the correct outcome, and a `failedAt` row would
read as a false alarm during triage.

Unknown event types are marked failed.
```

- [ ] **Step 5: Commit**

```bash
git add preview-templates.js preview/reminder-*.html docs/examples/reminder-event.sql README.md
git commit -m "docs: reminder previews, example enqueue EVENT, README

The EVENT runs hourly gated on the Eastern hour because a fixed-UTC daily
schedule drifts across DST (7am ET is 1100 UTC in summer, 1200 in winter)."
```

---

## Verification

After Task 4:

- [ ] `npm test` → **108 passing, 0 failing**
- [ ] `node preview-templates.js` → writes 4 reminder previews with no errors
- [ ] `grep -c "Starting Location" preview/reminder-*.html` → 1 for rides, 0 for the rest
- [ ] Each preview visually matches its PDF in `scratch/`, except the deliberate Starting Location addition on rides

**Before going live** (needs a human, out of scope for the plan):
1. Set `TEST_RECIPIENTS` in `.env`, insert a reminder row by hand for a Confirmed SR two days out, and confirm both emails arrive with the `[TEST]` prefix and banner.
2. Apply the EVENT in village-green, verify `CONVERT_TZ` and `event_scheduler` on that server first.
3. Watch the first 07:00 ET run.

## Out of Scope

- Reminders for any status other than `Confirmed` (including `Open` and `Unmatched`) — needs copy the customer has not supplied.
- Removing the Starting Location row from the existing Errands templates — real, but a separate issue.
- The partial-success retry gap (issue #2) — the reminder branch matches every other branch.
- A DB/Gmail mocking harness.
- Any migration in this repo; the EVENT ships as an example.
