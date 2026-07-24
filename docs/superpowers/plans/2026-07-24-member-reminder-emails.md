# Member Reminder Emails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The existing `reminder` notification event sends a second email — to the requesting member — using the customer's new member-facing template, alongside the unchanged volunteer reminder.

**Architecture:** One new builder `buildMemberReminderTemplate` in `src/templates.js` (single layout for all service types, per the customer). The `reminder` branch in `src/email-processor.js` grows a best-effort member send mirroring the `confirmed` branch's two-recipient semantics: the volunteer send gates the event outcome; the member send is logged on failure and silently skipped when the member has no email.

**Tech Stack:** Node.js (CommonJS), `node:test` + `node:assert/strict`, no mocking harness (only pure functions are unit-tested).

**Spec:** `docs/superpowers/specs/2026-07-24-member-reminder-emails-design.md`

## Global Constraints

- Work on the existing `member-reminder-emails` branch (already created; the spec is its first commit). Never commit to local `main`.
- Run tests with `npm test` (runs `node --test`); the full suite must pass before every commit.
- `serviceDate`/`startTime` are wall-clock civil strings — never construct a JS `Date` from them (file-header rule in `src/templates.js`).
- Every template builder calls `withBlankAddressNulls(requestData)` first (file-wide convention).
- Member reminder copy comes verbatim from `scratch/template-reminder-member.pdf`: closing is "…or reply to the email." ("the", not "this").
- The member reminder renders **no** Requesting Member block, **no** Starting Location (even for Rides), **no** Destination.
- No changes to `queries.js`, `db.js`, `gmail.js`, the polling loop, or the `vg_reminder_enqueue` EVENT.
- No new logging/observability behavior — reuse the confirmed branch's per-send log-line pattern exactly.

---

### Task 1: `buildMemberReminderTemplate`

**Files:**
- Modify: `src/templates.js` (new function before `module.exports`, plus export)
- Test: `test/member-reminder-templates.test.js` (new)

**Interfaces:**
- Consumes: existing helpers in `src/templates.js` — `withBlankAddressNulls(rd)`, `formatServiceDate(serviceDate)`, `formatCivilTime(timeString)`.
- Produces: `buildMemberReminderTemplate(memberFirstName, volunteerData, requestData) → string` (HTML). `volunteerData` is a `getPerson()` row: `{ id, fullName, email, phone, cell }`. Exported from `src/templates.js`; Task 3 imports it in `src/email-processor.js`.

- [ ] **Step 1: Write the failing tests**

Create `test/member-reminder-templates.test.js`:

```js
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { buildMemberReminderTemplate } = require('../src/templates.js')

const volunteerData = {
  id: 7,
  fullName: 'Joanne Miller',
  email: 'j.millerxxx@gmail.com',
  phone: null,
  cell: '401-465-0405',
}

const ridesRequest = {
  serviceName: 'Ride: Medical Appnt',
  memberName: 'Zelda Blow',
  memberAddress: '10 Happy Street',
  memberCity: 'Providence',
  memberState: 'RI',
  memberZip: '02906',
  memberCell: '401-555-0101',
  description: 'Round-trip ride to medical appointment.',
  serviceDate: '2025-12-29',
  timesFlexible: false,
  startTime: '08:00:00',
  start: 'Laurelmead Cooperative',
  startAddress: '355 Blackstone Blvd',
  startCity: 'Providence',
  startState: 'RI',
  startZip: '02906',
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
  memberCell: '401-555-0101',
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
  memberCell: '401-555-0101',
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
  memberCell: '401-555-0101',
  description: 'Zelda has a new iPhone 17 and needs help setting it up.',
  serviceDate: '2025-12-29',
  timesFlexible: true,
  startTime: null,
  destination: null,
}

const allRequests = [ridesRequest, errandsRequest, homeHelpRequest, techRequest]

test('renders the member intro, provider heading, and closing copy for every service type', () => {
  for (const rd of allRequests) {
    const html = buildMemberReminderTemplate('Zelda', volunteerData, rd)
    assert.match(html, /Hello Zelda\./)
    assert.match(html, /This is a reminder about a service you requested with <strong>The Village Common of RI<\/strong>\./)
    assert.match(html, /<u>Your service provider\(s\)<\/u>/)
    assert.match(html, /<u>Short Description<\/u>/)
    // PDF wording: "reply to the email", not "this email"
    assert.match(html, /please call 401-441-5240 or reply to the email\./)
    assert.match(html, new RegExp(rd.serviceName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    assert.match(html, new RegExp(rd.description.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
})

test('shows the time for a timed ride and the flexible note otherwise', () => {
  const ridesHtml = buildMemberReminderTemplate('Zelda', volunteerData, ridesRequest)
  assert.match(ridesHtml, /Monday, December 29, 2025 at 8:00 AM/)
  assert.doesNotMatch(ridesHtml, /The time is flexible/)

  // The gap before the flexible note is a literal &nbsp; entity (matching the
  // volunteer reminder's spacing), not whitespace - so match the entity.
  for (const rd of [errandsRequest, homeHelpRequest, techRequest]) {
    const html = buildMemberReminderTemplate('Zelda', volunteerData, rd)
    assert.match(html, /Monday, December 29, 2025 &nbsp;\(The time is flexible\)/)
    assert.doesNotMatch(html, / at \d+:\d{2} (AM|PM)/)
  }
})

test('renders provider contact in PDF order: name, phone, email', () => {
  const html = buildMemberReminderTemplate('Zelda', volunteerData, ridesRequest)
  const nameIdx = html.indexOf('Joanne Miller')
  const phoneIdx = html.indexOf('401-465-0405 (cell)')
  const emailIdx = html.indexOf('mailto:j.millerxxx@gmail.com')
  assert.ok(nameIdx !== -1, 'provider name missing')
  assert.ok(phoneIdx !== -1, 'provider cell missing')
  assert.ok(emailIdx !== -1, 'provider email missing')
  assert.ok(nameIdx < phoneIdx && phoneIdx < emailIdx, 'expected name, then phone, then email')
})

test('falls back to landline without the cell suffix, and drops missing pieces cleanly', () => {
  const landlineOnly = { ...volunteerData, cell: null, phone: '401-331-0000' }
  let html = buildMemberReminderTemplate('Zelda', landlineOnly, ridesRequest)
  assert.match(html, /401-331-0000/)
  assert.doesNotMatch(html, /\(cell\)/)

  const noContact = { ...volunteerData, cell: null, phone: null, email: null }
  html = buildMemberReminderTemplate('Zelda', noContact, ridesRequest)
  assert.match(html, /Joanne Miller/)
  assert.doesNotMatch(html, /mailto:/)
  // filter-and-join: no dangling <br> chain after the lone name
  assert.doesNotMatch(html, /Joanne Miller<br><br>\s*<br>/)
})

// The customer's member template deliberately omits the dispatch detail the
// volunteer reminder carries. Pin the absences so they cannot creep back in.
test('omits Requesting Member, Starting Location, and Destination for every service type', () => {
  for (const rd of allRequests) {
    const html = buildMemberReminderTemplate('Zelda', volunteerData, rd)
    assert.doesNotMatch(html, /Requesting Member/)
    assert.doesNotMatch(html, /Starting Location/)
    assert.doesNotMatch(html, /Destination/)
    // the member's own home address never appears
    assert.doesNotMatch(html, /10 Happy Street/)
  }
})

test('never renders the literal string null for missing fields', () => {
  const bareRequest = {
    serviceName: 'Tech Support', memberName: 'Zelda Blow',
    memberAddress: null, memberCity: null, memberState: null, memberZip: null,
    memberCell: null, description: 'Set up a new tablet.',
    serviceDate: '2025-12-29', timesFlexible: true, startTime: null, destination: null,
  }
  const bareVolunteer = { id: 7, fullName: 'Joanne Miller', email: null, phone: null, cell: null }
  assert.doesNotMatch(buildMemberReminderTemplate('Zelda', bareVolunteer, bareRequest), /null/)
})
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npm test -- test/member-reminder-templates.test.js`
Expected: FAIL — `buildMemberReminderTemplate is not a function` (it is not exported yet).

- [ ] **Step 3: Implement the builder**

In `src/templates.js`, insert the following function between the end of `buildReminderTemplate` and `module.exports`:

```js
// Member-facing reminder - one layout for every service type (customer
// template, 2026-07-24; scratch/template-reminder-member.pdf). Unlike the
// volunteer reminder there is no Requesting Member block, no Starting
// Location, and no Destination: the member knows their own address, and the
// provider section replaces the dispatch detail.
function buildMemberReminderTemplate(memberFirstName, volunteerData, requestData) {
  requestData = withBlankAddressNulls(requestData);
  const {
    serviceName,
    description,
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

  // PDF order: name, phone, email. Cell preferred over landline, as in the
  // member-confirmed templates.
  const providerContact = [
    volunteerData.fullName,
    volunteerData.cell ? `${volunteerData.cell} (cell)` : (volunteerData.phone || ''),
    volunteerData.email ? `<a href='mailto:${volunteerData.email}'>${volunteerData.email}</a>` : '',
  ].filter(Boolean).join('<br>');

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
                    Hello ${memberFirstName}.<br>
                    This is a reminder about a service you requested with <strong>The Village Common of RI</strong>.<br><br>
                    <div style='margin-left:15px;margin-top:4px;margin-bottom:10px;'>
                      <table cellpadding='0' cellspacing='0' border='0' style='font-family:Arial, Sans-Serif; font-size:12px; font-weight:normal;'>
                        <tbody>
                          <tr>
                            <td valign='top' style='padding-right:12px;padding-bottom:3px;'>Service:</td>
                            <td valign='top' style='padding-bottom:3px;'><strong>${serviceName}</strong></td>
                          </tr>
                          <tr>
                            <td valign='top' style='padding-right:12px;'>Date/Time:</td>
                            <td valign='top'><strong>${dateTime}</strong></td>
                          </tr>
                        </tbody>
                      </table>
                      <br>
                      <u>Your service provider(s)</u><br>
                      ${providerContact}<br><br>
                      <u>Short Description</u><br>
                      ${description || ''}<br><br>
                      If you have any questions or need to cancel this service, please call 401-441-5240 or reply to the email.<br>
                    </div>
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

Then add the export to `module.exports`, immediately after `buildReminderTemplate,`:

```js
  buildReminderTemplate,
  buildMemberReminderTemplate,
```

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: all tests PASS (the new file plus the existing suite, unchanged).

- [ ] **Step 5: Commit**

```bash
git add src/templates.js test/member-reminder-templates.test.js
git commit -m "feat: member reminder email template"
```

---

### Task 2: Routing flag `sendToMember: true` for reminders

**Files:**
- Modify: `src/email-processor.js` (the `deriveRecipientsForEvent` reminder entry, currently around lines 189–201)
- Test: `test/email-processor.test.js` (the reminder routing test, currently lines 33–42)

**Interfaces:**
- Consumes: nothing new.
- Produces: `deriveRecipientsForEvent('reminder', requestData)` returns `{ sendToBccVolunteers: false, sendToVolunteer: true, sendToMember: true }`. (As before, the reminder send branch does not consult this entry; the flag is the documented routing record.)

- [ ] **Step 1: Update the routing test to the new expectation**

In `test/email-processor.test.js`, replace the reminder test and its comment block (the `// Reminders go to the assigned volunteer ONLY...` comment through the end of that `test(...)`) with:

```js
// Reminders go to the assigned volunteer AND the member. Originally
// volunteer-only; the customer supplied a member-facing reminder template on
// 2026-07-24 (docs/superpowers/specs/2026-07-24-member-reminder-emails-design.md).
test('reminder sends to the volunteer and the member', () => {
  const result = deriveRecipientsForEvent('reminder', { volunteerPersonId: 42 })
  assert.equal(result.sendToVolunteer, true)
  assert.equal(result.sendToMember, true)
  assert.equal(result.sendToBccVolunteers, false)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- test/email-processor.test.js`
Expected: FAIL — `reminder sends to the volunteer and the member` asserts `sendToMember` `true !== false`.

- [ ] **Step 3: Update `deriveRecipientsForEvent`**

In `src/email-processor.js`, replace the reminder comment block and entry inside `deriveRecipientsForEvent` (everything from `// Reminders go to the ASSIGNED VOLUNTEER ONLY` through the closing brace of `if (eventType === 'reminder') { ... }`) with:

```js
  // Reminders go to the assigned volunteer AND the member. Originally
  // volunteer-only (the customer's first four sample emails were all
  // volunteer-facing); on 2026-07-24 the customer supplied a member-facing
  // reminder template, so the member now gets one too - see
  // docs/superpowers/specs/2026-07-24-member-reminder-emails-design.md.
  //
  // NOTE: the reminder send branch in pollOnce does NOT consult this entry - it
  // gates on what resolveRecipientsForReminder resolved (shouldSkipReminder
  // already guarantees an assigned volunteer). Editing the flags here will NOT
  // change reminder routing; change the branch itself.
  if (eventType === 'reminder') {
    return { sendToBccVolunteers: false, sendToVolunteer: true, sendToMember: true }
  }
```

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/email-processor.js test/email-processor.test.js
git commit -m "feat: route reminder events to member as well as volunteer"
```

---

### Task 3: Member send in the reminder branch

**Files:**
- Modify: `src/email-processor.js` — the `require('./templates')` import list, `resolveRecipientsForReminder` (currently around lines 350–377), and the `event.eventType === 'reminder'` branch in `pollOnce` (currently around lines 589–626)

**Interfaces:**
- Consumes: `buildMemberReminderTemplate(memberFirstName, volunteerData, requestData)` from Task 1; existing `buildReminderTemplate`, `getFirstName`, `buildSubject`, `applyTestBanner`, `sendEmail`, `markNotificationSent`, `markNotificationFailed`.
- Produces: `resolveRecipientsForReminder(requestData)` now returns `{ volunteerEmail, memberEmail, volunteer, memberName, intendedRecipients, isTestMode }` — same shape as `resolveRecipientsForConfirmedRequest`, except it keeps its existing no-reachable-volunteer early return (an object with `volunteerEmail: null`, not `null`).

No new unit tests: the branch lives inside `pollOnce`, which needs a live DB and the Gmail API, and this repo deliberately has no mocking harness. Both decision points are already covered as pure functions (`shouldSkipReminder` in Task 2's file, routing in Task 2). End-to-end verification is Task 4's previews plus a `TEST_RECIPIENTS` run before go-live.

- [ ] **Step 1: Import the new builder**

In the `require('./templates')` destructuring at the top of `src/email-processor.js`, add one line after `buildReminderTemplate,`:

```js
  buildReminderTemplate,
  buildMemberReminderTemplate,
```

- [ ] **Step 2: Extend `resolveRecipientsForReminder`**

Replace the whole function, including its leading comment, with:

```js
// Reminders go to the assigned volunteer and the member (member added
// 2026-07-24 when the customer supplied a member-facing template). Callers
// must have already run shouldSkipReminder, so volunteerPersonId is guaranteed
// non-null here. The member send is best-effort: memberEmail is null when the
// member has no email, and the branch skips that send. An unreachable
// volunteer fails the whole event (matching the confirmed branch) - the member
// template lists the provider's contact info, so there is nothing useful to
// send the member without one.
async function resolveRecipientsForReminder(requestData) {
  const testConfig = getTestConfig();

  const volunteer = await getPerson(requestData.volunteerPersonId);

  if (!volunteer || !volunteer.email) {
    console.warn(`Volunteer person not found or has no email: ${requestData.volunteerPersonId}`);
    return {
      volunteerEmail: null,
      memberEmail: null,
      volunteer,
      memberName: requestData.memberName,
      intendedRecipients: null,
      isTestMode: !!testConfig.overrideRecipients,
    };
  }

  const memberEmail = requestData.memberEmail;

  const intendedRecipients = [{ fullName: volunteer.fullName, email: volunteer.email }];
  if (memberEmail) {
    intendedRecipients.push({ fullName: requestData.memberName, email: memberEmail });
  }

  if (testConfig.overrideRecipients) {
    console.log(`[TEST MODE] Using override recipients: ${testConfig.overrideRecipients.join(', ')}`);
    return {
      volunteerEmail: testConfig.overrideRecipients.join(', '),
      // Only redirect a member send to the test recipients when the member
      // actually has an email in prod; otherwise keep it null so test mode
      // mirrors prod (which skips the member send) instead of fabricating an
      // extra email and recording a member recipient prod would never notify.
      memberEmail: memberEmail ? testConfig.overrideRecipients.join(', ') : null,
      volunteer,
      memberName: requestData.memberName,
      intendedRecipients,
      isTestMode: true,
    };
  }

  return {
    volunteerEmail: volunteer.email,
    memberEmail: memberEmail || null,
    volunteer,
    memberName: requestData.memberName,
    intendedRecipients: null,
    isTestMode: false,
  };
}
```

- [ ] **Step 3: Extend the reminder branch in `pollOnce`**

Replace the body of the `} else if (event.eventType === 'reminder') {` branch (from the `shouldSkipReminder` check through the `markNotificationFailed`/`failed++` at its end) with:

```js
        if (shouldSkipReminder(requestData)) {
          console.log(`[${new Date().toISOString()}] SR #${requestData.id} is ${requestData.status} with volunteer ${requestData.volunteerPersonId || 'none'}; skipping reminder`);
          await markNotificationSent(event.id, []);
          sent++;
          continue;
        }

        // Two recipients, confirmed-branch semantics: the volunteer send gates
        // the event outcome; the member send is best-effort.
        const recipients = await resolveRecipientsForReminder(requestData);

        if (!recipients.volunteerEmail) {
          console.warn(`[${new Date().toISOString()}] SR #${requestData.id} reminder has no reachable volunteer`);
          await markNotificationFailed(event.id);
          failed++;
          continue;
        }

        const baseSubject = `SR Reminder #${subjectNumber}-For ${requestData.memberName}-Service Date: ${formatDateForSubject(requestData.serviceDate)}`;
        const subject = buildSubject(baseSubject, recipients.isTestMode);

        const volunteerHtml = buildReminderTemplate(getFirstName(recipients.volunteer.fullName), requestData);
        const memberHtml = buildMemberReminderTemplate(getFirstName(recipients.memberName), recipients.volunteer, requestData);

        let finalVolunteerHtml = volunteerHtml;
        let finalMemberHtml = memberHtml;
        if (recipients.isTestMode) {
          // Each email's banner should name only its own actual intended
          // recipient, not the combined list of everyone notified for this event.
          const [volunteerIntended, memberIntended] = recipients.intendedRecipients || [];
          if (volunteerIntended) {
            finalVolunteerHtml = applyTestBanner(volunteerHtml, `${volunteerIntended.fullName} (${volunteerIntended.email})`);
          }
          if (memberIntended) {
            finalMemberHtml = applyTestBanner(memberHtml, `${memberIntended.fullName} (${memberIntended.email})`);
          }
        }

        const volunteerResult = await sendEmail({ to: recipients.volunteerEmail, subject, html: finalVolunteerHtml, kind: event.eventType });
        if (volunteerResult.success) {
          console.log(`[${new Date().toISOString()}] Volunteer reminder email sent: ${subject}`);
          recipientPersonIds.push(recipients.volunteer.id);
        } else {
          console.error(`[${new Date().toISOString()}] Failed to send volunteer reminder email: ${volunteerResult.error}`);
        }

        if (recipients.memberEmail) {
          const memberResult = await sendEmail({ to: recipients.memberEmail, subject, html: finalMemberHtml, kind: event.eventType });
          if (memberResult.success) {
            console.log(`[${new Date().toISOString()}] Member reminder email sent: ${subject}`);
            if (requestData.memberPersonId) recipientPersonIds.push(Number(requestData.memberPersonId));
          } else {
            console.error(`[${new Date().toISOString()}] Failed to send member reminder email: ${memberResult.error}`);
          }
        }

        if (volunteerResult.success) {
          await markNotificationSent(event.id, recipientPersonIds);
          sent++;
        } else {
          await markNotificationFailed(event.id);
          failed++;
        }
```

(This drops the old `// Single recipient: the assigned volunteer...` comment — it is no longer true.)

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: all tests PASS (this task changes only DB/Gmail-coupled code paths; the suite guards against accidental breakage of the pure exports).

- [ ] **Step 5: Commit**

```bash
git add src/email-processor.js
git commit -m "feat: send member reminder email alongside volunteer reminder"
```

---

### Task 4: Preview pages

**Files:**
- Modify: `preview-templates.js` (import, stale comment, and the `renders` array)

**Interfaces:**
- Consumes: `buildMemberReminderTemplate` from Task 1.
- Produces: `preview/reminder-member-{rides,errands,homhelp,techsup}.html` for visual comparison against `scratch/template-reminder-member.pdf`.

- [ ] **Step 1: Add the member reminder renders**

In `preview-templates.js`:

1. Add `buildMemberReminderTemplate,` to the `require('./src/templates')` destructuring, after `buildReminderTemplate,`.
2. Replace the stale comment above the reminder entries in `renders`:

```js
  // Reminder notices go to the assigned volunteer and the member two days
  // before the service date. Volunteer reminders show Starting Location on
  // rides only; member reminders never show it (customer template, 2026-07-24).
```

3. After the four existing `reminder-*.html` entries, add:

```js
  ['reminder-member-rides.html',   buildMemberReminderTemplate('Zelda', volunteerData, ridesRequest)],
  ['reminder-member-errands.html', buildMemberReminderTemplate('Zelda', volunteerData, errandsRequest)],
  ['reminder-member-homhelp.html', buildMemberReminderTemplate('Zelda', volunteerData, homeHelpRequest)],
  ['reminder-member-techsup.html', buildMemberReminderTemplate('Zelda', volunteerData, techRequest)],
```

- [ ] **Step 2: Generate and eyeball the previews**

Run: `node preview-templates.js`
Expected: `Wrote .../preview/reminder-member-rides.html` (and the other three) among the output lines. Open `preview/reminder-member-rides.html` and compare against `scratch/template-reminder-member.pdf`: greeting, Service/Date-Time pair with bold values, provider block (name / cell / email), Short Description, closing line; no member address, Starting Location, or Destination.

- [ ] **Step 3: Run the full suite**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add preview-templates.js
git commit -m "chore: preview pages for member reminder template"
```

(`preview/` output is gitignored — commit only `preview-templates.js`, never the generated HTML.)

---

## Verification before merge

- `npm test` — full suite green.
- `node preview-templates.js` and a side-by-side of `preview/reminder-member-rides.html` vs `scratch/template-reminder-member.pdf`.
- Before go-live: a `TEST_RECIPIENTS` run against the dev DB (127.0.0.1:60001) with a Confirmed SR two days out, confirming both the volunteer and member reminder emails arrive with the `[TEST]` subject and per-recipient banners.
