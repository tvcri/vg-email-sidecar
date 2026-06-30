# Repeat Open Request Ordinal + Test Mode Subject Prefix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prefix repeat volunteer solicitation emails with an ordinal in the subject and body (2nd/SECOND REQUEST, etc.), and prefix every outgoing email subject with `[TEST]` when `TEST_RECIPIENTS` is active.

**Architecture:** Add a SQL query and db function to count prior successful `open` notifications. Add pure helpers `getSubjectOrdinal`, `getBodyOrdinalPrefix`, `buildSubject`, and `buildOpenSubjectAndDescription` in the processor. Wire `buildSubject` into all four event branches for the `[TEST]` prefix; wire `buildOpenSubjectAndDescription` into the `open` branch for the ordinal. No template changes.

**Tech Stack:** Node.js (CommonJS), mysql2/promise, node:test

## Global Constraints

- Ordinal prefix applies to `open` event type only (subject and description body).
- `[TEST]` prefix applies to all event types, subject line only.
- When both apply, `[TEST]` comes first: `"[TEST] 2nd SR Request #..."`.
- First send (`priorCount === 0`) produces no ordinal change to subject or body.
- Count query: `sent_at IS NOT NULL` only (excludes failed and unsent rows).
- Ordinal range: 1 → 2nd/SECOND, 2 → 3rd/THIRD, 3 → 4th/FOURTH. `priorCount >= 4` logs a warning and applies no prefix.
- Template functions receive no new parameters; description prefix applied via local `requestData` copy.
- Test mode detected via `getTestConfig().overrideRecipients !== null`; `isTestMode` is already returned by all `resolveRecipients*` functions.
- Test runner: `node --test`.

---

### Task 1: Add SQL query and db function for prior open count

**Files:**
- Modify: `src/queries.js`
- Modify: `src/db.js`

**Interfaces:**
- Produces: `getPriorOpenCount(serviceRequestId: number): Promise<number>` — exported from `src/db.js`

- [ ] **Step 1: Add the SQL constant to `src/queries.js`**

Add before the `module.exports` block:

```js
const GET_PRIOR_OPEN_COUNT = `
  SELECT COUNT(*) AS prior_count
  FROM notification_event
  WHERE service_request_id = ?
    AND event_type = 'open'
    AND sent_at IS NOT NULL
`;
```

Add `GET_PRIOR_OPEN_COUNT` to the `module.exports` object.

- [ ] **Step 2: Add `getPriorOpenCount` to `src/db.js`**

Add after `getVolunteersByCapability`:

```js
async function getPriorOpenCount(serviceRequestId) {
  const conn = await createConnection();
  try {
    const [rows] = await conn.query(queries.GET_PRIOR_OPEN_COUNT, [serviceRequestId]);
    return rows[0].prior_count;
  } finally {
    await conn.end();
  }
}
```

Add `getPriorOpenCount` to the `module.exports` object.

- [ ] **Step 3: Commit**

```bash
git add src/queries.js src/db.js
git commit -m "feat: add getPriorOpenCount query and db function"
```

---

### Task 2: Add subject helper functions and unit tests

**Files:**
- Modify: `src/email-processor.js`
- Modify: `test/email-processor.test.js`

**Interfaces:**
- Consumes: nothing from earlier tasks (pure functions)
- Produces:
  - `getSubjectOrdinal(priorCount: number): string | null` — exported from `src/email-processor.js`
  - `getBodyOrdinalPrefix(priorCount: number): string | null` — exported from `src/email-processor.js`
  - `buildSubject(baseSubject: string, isTestMode: boolean): string` — exported from `src/email-processor.js`

- [ ] **Step 1: Write failing tests in `test/email-processor.test.js`**

Add after the existing tests (update the destructure at the top of the file to include the new exports):

```js
const { deriveRecipientsForEvent, getSubjectOrdinal, getBodyOrdinalPrefix, buildSubject } = require('../src/email-processor.js')

// getSubjectOrdinal
test('getSubjectOrdinal returns null for first send', () => {
  assert.equal(getSubjectOrdinal(0), null)
})
test('getSubjectOrdinal returns 2nd for second send', () => {
  assert.equal(getSubjectOrdinal(1), '2nd')
})
test('getSubjectOrdinal returns 3rd for third send', () => {
  assert.equal(getSubjectOrdinal(2), '3rd')
})
test('getSubjectOrdinal returns 4th for fourth send', () => {
  assert.equal(getSubjectOrdinal(3), '4th')
})
test('getSubjectOrdinal returns null for fifth or more send', () => {
  assert.equal(getSubjectOrdinal(4), null)
  assert.equal(getSubjectOrdinal(99), null)
})

// getBodyOrdinalPrefix
test('getBodyOrdinalPrefix returns null for first send', () => {
  assert.equal(getBodyOrdinalPrefix(0), null)
})
test('getBodyOrdinalPrefix returns SECOND REQUEST for second send', () => {
  assert.equal(getBodyOrdinalPrefix(1), 'SECOND REQUEST')
})
test('getBodyOrdinalPrefix returns THIRD REQUEST for third send', () => {
  assert.equal(getBodyOrdinalPrefix(2), 'THIRD REQUEST')
})
test('getBodyOrdinalPrefix returns FOURTH REQUEST for fourth send', () => {
  assert.equal(getBodyOrdinalPrefix(3), 'FOURTH REQUEST')
})
test('getBodyOrdinalPrefix returns null for fifth or more send', () => {
  assert.equal(getBodyOrdinalPrefix(4), null)
  assert.equal(getBodyOrdinalPrefix(99), null)
})

// buildSubject
test('buildSubject returns base subject in non-test mode', () => {
  assert.equal(
    buildSubject('SR Request #27143-For Mary Lou Foley-Service Date: 6/22/2026', false),
    'SR Request #27143-For Mary Lou Foley-Service Date: 6/22/2026'
  )
})
test('buildSubject prepends [TEST] in test mode', () => {
  assert.equal(
    buildSubject('SR Request #27143-For Mary Lou Foley-Service Date: 6/22/2026', true),
    '[TEST] SR Request #27143-For Mary Lou Foley-Service Date: 6/22/2026'
  )
})
test('buildSubject prepends [TEST] before ordinal in test mode', () => {
  assert.equal(
    buildSubject('2nd SR Request #27143-For Mary Lou Foley-Service Date: 6/22/2026', true),
    '[TEST] 2nd SR Request #27143-For Mary Lou Foley-Service Date: 6/22/2026'
  )
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
node --test test/email-processor.test.js
```

Expected: failures referencing undefined exports.

- [ ] **Step 3: Implement the helper functions in `src/email-processor.js`**

Add after the `getCapabilityFromServiceType` function (around line 115):

```js
const SUBJECT_ORDINALS = [null, '2nd', '3rd', '4th'];
const BODY_ORDINALS = [null, 'SECOND REQUEST', 'THIRD REQUEST', 'FOURTH REQUEST'];

function getSubjectOrdinal(priorCount) {
  if (priorCount >= SUBJECT_ORDINALS.length) {
    console.warn(`Unexpected prior open count: ${priorCount}; no subject ordinal applied`);
    return null;
  }
  return SUBJECT_ORDINALS[priorCount];
}

function getBodyOrdinalPrefix(priorCount) {
  if (priorCount >= BODY_ORDINALS.length) {
    console.warn(`Unexpected prior open count: ${priorCount}; no body ordinal applied`);
    return null;
  }
  return BODY_ORDINALS[priorCount];
}

function buildSubject(baseSubject, isTestMode) {
  return isTestMode ? `[TEST] ${baseSubject}` : baseSubject;
}
```

Update `module.exports` at the bottom:

```js
module.exports = { pollOnce, deriveRecipientsForEvent, getSubjectOrdinal, getBodyOrdinalPrefix, buildSubject };
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
node --test test/email-processor.test.js
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/email-processor.js test/email-processor.test.js
git commit -m "feat: add getSubjectOrdinal, getBodyOrdinalPrefix, buildSubject helpers"
```

---

### Task 3: Wire `[TEST]` prefix into all event-type subject lines

**Files:**
- Modify: `src/email-processor.js`

**Interfaces:**
- Consumes: `buildSubject(baseSubject, isTestMode)` — defined in Task 2

Note: `isTestMode` is already available in each branch via the return value of `resolveRecipientsForOpenRequest`, `resolveRecipientsForConfirmedRequest`, and `resolveRecipientsForCancelledRequest`. The `reminder` branch currently logs a warning and marks failed — no subject to update there.

- [ ] **Step 1: Update the `open` branch subject line**

In the `sendToBccVolunteers` branch (around line 302), the subject is currently built as:

```js
const subject = `SR Request #${subjectNumber}-For ${requestData.member_name}-Service Date: ${formatDateForSubject(requestData.start_at)}`;
```

Replace with:

```js
const baseSubject = `SR Request #${subjectNumber}-For ${requestData.member_name}-Service Date: ${formatDateForSubject(requestData.start_at)}`;
const subject = buildSubject(baseSubject, recipients.isTestMode);
```

- [ ] **Step 2: Update the `confirmed` branch subject line**

In the `confirmed` branch (around line 329), the subject is currently:

```js
const subject = `SR Conf #${subjectNumber}-For ${requestData.member_name}-Service Date: ${formatDateForSubject(requestData.start_at)}`;
```

Replace with:

```js
const baseSubject = `SR Conf #${subjectNumber}-For ${requestData.member_name}-Service Date: ${formatDateForSubject(requestData.start_at)}`;
const subject = buildSubject(baseSubject, recipients.isTestMode);
```

- [ ] **Step 3: Update the `cancelled` branch subject line**

In the `cancelled` branch (around line 383), the subject is currently:

```js
const subject = `SR Cancel #${subjectNumber}-For ${requestData.member_name}-Service Date: ${formatDateForSubject(requestData.start_at)}`;
```

Replace with:

```js
const baseSubject = `SR Cancel #${subjectNumber}-For ${requestData.member_name}-Service Date: ${formatDateForSubject(requestData.start_at)}`;
const subject = buildSubject(baseSubject, recipients.isTestMode);
```

- [ ] **Step 4: Run all tests**

```bash
node --test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/email-processor.js
git commit -m "feat: prepend [TEST] to subject line in test mode for all event types"
```

---

### Task 4: Wire ordinal into the open-event send path

**Files:**
- Modify: `src/email-processor.js`
- Modify: `test/email-processor.test.js`

**Interfaces:**
- Consumes:
  - `getPriorOpenCount(serviceRequestId)` from `src/db.js` (Task 1)
  - `getSubjectOrdinal(priorCount)` — defined in Task 2
  - `getBodyOrdinalPrefix(priorCount)` — defined in Task 2
  - `buildSubject(baseSubject, isTestMode)` — defined in Task 2
- Produces: `buildOpenSubjectAndDescription({ subjectNumber, memberName, startAt, description, serviceRequestId, isTestMode, getPriorOpenCountFn }): Promise<{ subject: string, description: string }>` — exported from `src/email-processor.js`

- [ ] **Step 1: Import `getPriorOpenCount` in `src/email-processor.js`**

Update the existing destructured require at the top:

```js
const {
  markNotificationSent,
  markNotificationFailed,
  getServiceRequest,
  getPerson,
  getVolunteersByCapability,
  getPendingEmailEvents,
  getPriorOpenCount,
} = require('./db');
```

- [ ] **Step 2: Write failing tests in `test/email-processor.test.js`**

Update the destructure at the top to include `buildOpenSubjectAndDescription`:

```js
const { deriveRecipientsForEvent, getSubjectOrdinal, getBodyOrdinalPrefix, buildSubject, buildOpenSubjectAndDescription } = require('../src/email-processor.js')
```

Add after the existing tests:

```js
// buildOpenSubjectAndDescription
test('buildOpenSubjectAndDescription: first send, non-test mode', async () => {
  const result = await buildOpenSubjectAndDescription({
    subjectNumber: '27143',
    memberName: 'Mary Lou Foley',
    startAt: '2026-06-22T14:00:00Z',
    description: 'Member needs a ride.',
    serviceRequestId: 1,
    isTestMode: false,
    getPriorOpenCountFn: async () => 0,
  })
  assert.equal(result.subject, 'SR Request #27143-For Mary Lou Foley-Service Date: 6/22/2026')
  assert.equal(result.description, 'Member needs a ride.')
})

test('buildOpenSubjectAndDescription: first send, test mode', async () => {
  const result = await buildOpenSubjectAndDescription({
    subjectNumber: '27143',
    memberName: 'Mary Lou Foley',
    startAt: '2026-06-22T14:00:00Z',
    description: 'Member needs a ride.',
    serviceRequestId: 1,
    isTestMode: true,
    getPriorOpenCountFn: async () => 0,
  })
  assert.equal(result.subject, '[TEST] SR Request #27143-For Mary Lou Foley-Service Date: 6/22/2026')
  assert.equal(result.description, 'Member needs a ride.')
})

test('buildOpenSubjectAndDescription: second send, non-test mode', async () => {
  const result = await buildOpenSubjectAndDescription({
    subjectNumber: '27143',
    memberName: 'Mary Lou Foley',
    startAt: '2026-06-22T14:00:00Z',
    description: 'Member needs a ride.',
    serviceRequestId: 1,
    isTestMode: false,
    getPriorOpenCountFn: async () => 1,
  })
  assert.equal(result.subject, '2nd SR Request #27143-For Mary Lou Foley-Service Date: 6/22/2026')
  assert.equal(result.description, 'SECOND REQUEST Member needs a ride.')
})

test('buildOpenSubjectAndDescription: second send, test mode', async () => {
  const result = await buildOpenSubjectAndDescription({
    subjectNumber: '27143',
    memberName: 'Mary Lou Foley',
    startAt: '2026-06-22T14:00:00Z',
    description: 'Member needs a ride.',
    serviceRequestId: 1,
    isTestMode: true,
    getPriorOpenCountFn: async () => 1,
  })
  assert.equal(result.subject, '[TEST] 2nd SR Request #27143-For Mary Lou Foley-Service Date: 6/22/2026')
  assert.equal(result.description, 'SECOND REQUEST Member needs a ride.')
})
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
node --test test/email-processor.test.js
```

Expected: failures with "buildOpenSubjectAndDescription is not a function".

- [ ] **Step 4: Implement `buildOpenSubjectAndDescription` in `src/email-processor.js`**

Add after `buildSubject`:

```js
async function buildOpenSubjectAndDescription({ subjectNumber, memberName, startAt, description, serviceRequestId, isTestMode, getPriorOpenCountFn }) {
  const priorCount = await getPriorOpenCountFn(serviceRequestId);
  const subjectOrdinal = getSubjectOrdinal(priorCount);
  const bodyPrefix = getBodyOrdinalPrefix(priorCount);

  const dateStr = formatDateForSubject(startAt);
  const baseSubject = subjectOrdinal
    ? `${subjectOrdinal} SR Request #${subjectNumber}-For ${memberName}-Service Date: ${dateStr}`
    : `SR Request #${subjectNumber}-For ${memberName}-Service Date: ${dateStr}`;

  const subject = buildSubject(baseSubject, isTestMode);

  const finalDescription = bodyPrefix
    ? `${bodyPrefix} ${description}`
    : description;

  return { subject, description: finalDescription };
}
```

Update `module.exports`:

```js
module.exports = { pollOnce, deriveRecipientsForEvent, getSubjectOrdinal, getBodyOrdinalPrefix, buildSubject, buildOpenSubjectAndDescription };
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
node --test test/email-processor.test.js
```

Expected: all tests pass.

- [ ] **Step 6: Replace the open-event subject line in `pollOnce` with `buildOpenSubjectAndDescription`**

In the `sendToBccVolunteers` branch, remove the `baseSubject`/`subject` lines added in Task 3 Step 1 and replace the block up to the `getOpenRequestTemplate` call:

**Before (after Task 3):**
```js
if (routing.sendToBccVolunteers) {
  const recipients = await resolveRecipientsForOpenRequest(requestData);
  if (recipients) {
    const baseSubject = `SR Request #${subjectNumber}-For ${requestData.member_name}-Service Date: ${formatDateForSubject(requestData.start_at)}`;
    const subject = buildSubject(baseSubject, recipients.isTestMode);
    const html = getOpenRequestTemplate(requestData.service_name, 'Volunteer', requestData);
```

**After:**
```js
if (routing.sendToBccVolunteers) {
  const recipients = await resolveRecipientsForOpenRequest(requestData);
  if (recipients) {
    const { subject, description: openDescription } = await buildOpenSubjectAndDescription({
      subjectNumber,
      memberName: requestData.member_name,
      startAt: requestData.start_at,
      description: requestData.description,
      serviceRequestId: event.service_request_id,
      isTestMode: recipients.isTestMode,
      getPriorOpenCountFn: getPriorOpenCount,
    });
    const openRequestData = openDescription !== requestData.description
      ? { ...requestData, description: openDescription }
      : requestData;
    const html = getOpenRequestTemplate(requestData.service_name, 'Volunteer', openRequestData);
```

- [ ] **Step 7: Run all tests**

```bash
node --test
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/email-processor.js test/email-processor.test.js
git commit -m "feat: apply ordinal prefix to repeat open request subject and description"
```
