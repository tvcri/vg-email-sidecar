# Repeat Open Request Ordinal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prefix the subject line and description with an ordinal (2nd, SECOND REQUEST, etc.) when a volunteer solicitation email is a repeat send for the same service request.

**Architecture:** Add a SQL query and db function to count prior successful `open` notifications for a service request. Add two pure ordinal-mapping helpers in the processor. In the `open` send branch, fetch the count, derive the ordinal strings, and apply them to the subject and a local copy of `requestData` before template rendering — no template changes needed.

**Tech Stack:** Node.js (CommonJS), mysql2/promise, node:test

## Global Constraints

- Only `open` event type is affected; all other event types are unchanged.
- First send (`priorCount === 0`) produces no change to existing subject or body format.
- Count query excludes failed and unsent rows (`sent_at IS NOT NULL` only).
- Template functions receive no new parameters; description prefix is applied via a local `requestData` copy.
- Ordinal range: 1 → 2nd/SECOND, 2 → 3rd/THIRD, 3 → 4th/FOURTH. `priorCount >= 4` logs a warning and applies no prefix.
- Test runner: `node --test` (no Jest/Mocha).

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

### Task 2: Add ordinal helper functions and unit tests

**Files:**
- Modify: `src/email-processor.js`
- Modify: `test/email-processor.test.js`

**Interfaces:**
- Consumes: nothing from earlier tasks (pure functions)
- Produces:
  - `getSubjectOrdinal(priorCount: number): string | null` — exported from `src/email-processor.js`
  - `getBodyOrdinalPrefix(priorCount: number): string | null` — exported from `src/email-processor.js`

- [ ] **Step 1: Write failing tests in `test/email-processor.test.js`**

Add after the existing tests:

```js
const { getSubjectOrdinal, getBodyOrdinalPrefix } = require('../src/email-processor.js')

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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
node --test test/email-processor.test.js
```

Expected: failures with "getSubjectOrdinal is not a function" (or similar).

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
```

Add `getSubjectOrdinal` and `getBodyOrdinalPrefix` to the `module.exports` at the bottom of the file:

```js
module.exports = { pollOnce, deriveRecipientsForEvent, getSubjectOrdinal, getBodyOrdinalPrefix };
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
node --test test/email-processor.test.js
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/email-processor.js test/email-processor.test.js
git commit -m "feat: add getSubjectOrdinal and getBodyOrdinalPrefix helpers"
```

---

### Task 3: Wire ordinal into the open-event send path

**Files:**
- Modify: `src/email-processor.js`
- Modify: `test/email-processor.test.js`

**Interfaces:**
- Consumes:
  - `getPriorOpenCount(serviceRequestId)` from `src/db.js`
  - `getSubjectOrdinal(priorCount)` — defined in this file (Task 2)
  - `getBodyOrdinalPrefix(priorCount)` — defined in this file (Task 2)

- [ ] **Step 1: Import `getPriorOpenCount` in `src/email-processor.js`**

The existing destructured require at the top of the file:

```js
const {
  markNotificationSent,
  markNotificationFailed,
  getServiceRequest,
  getPerson,
  getVolunteersByCapability,
  getPendingEmailEvents,
} = require('./db');
```

Add `getPriorOpenCount` to that destructure:

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

- [ ] **Step 2: Write failing integration tests in `test/email-processor.test.js`**

These tests mock the db and gmail modules. Add them after the existing tests. First check whether `test/email-processor.test.js` already has a mock setup — if it does, follow the same pattern. If not, use `node:test`'s `mock.module` (Node 22+) or manual injection. Given the current codebase uses no dependency injection, the simplest approach is to add a thin wrapper for injection. See Step 3 for how the production code changes to support this.

Add to `test/email-processor.test.js`:

```js
const { buildOpenSubjectAndDescription } = require('../src/email-processor.js')

test('buildOpenSubjectAndDescription: first send returns unchanged subject and description', async () => {
  const result = await buildOpenSubjectAndDescription({
    subjectNumber: '27143',
    memberName: 'Mary Lou Foley',
    startAt: '2026-06-22T14:00:00Z',
    serviceName: 'Ride: Medical Appnt',
    description: 'Member needs a ride.',
    getPriorOpenCountFn: async () => 0,
    serviceRequestId: 1,
  })
  assert.equal(result.subject, 'SR Request #27143-For Mary Lou Foley-Service Date: 6/22/2026')
  assert.equal(result.description, 'Member needs a ride.')
})

test('buildOpenSubjectAndDescription: second send prefixes subject and description', async () => {
  const result = await buildOpenSubjectAndDescription({
    subjectNumber: '27143',
    memberName: 'Mary Lou Foley',
    startAt: '2026-06-22T14:00:00Z',
    serviceName: 'Ride: Medical Appnt',
    description: 'Member needs a ride.',
    getPriorOpenCountFn: async () => 1,
    serviceRequestId: 1,
  })
  assert.equal(result.subject, '2nd SR Request #27143-For Mary Lou Foley-Service Date: 6/22/2026')
  assert.equal(result.description, 'SECOND REQUEST Member needs a ride.')
})

test('buildOpenSubjectAndDescription: third send prefixes subject and description', async () => {
  const result = await buildOpenSubjectAndDescription({
    subjectNumber: '27143',
    memberName: 'Mary Lou Foley',
    startAt: '2026-06-22T14:00:00Z',
    serviceName: 'Ride: Medical Appnt',
    description: 'Member needs a ride.',
    getPriorOpenCountFn: async () => 2,
    serviceRequestId: 1,
  })
  assert.equal(result.subject, '3rd SR Request #27143-For Mary Lou Foley-Service Date: 6/22/2026')
  assert.equal(result.description, 'THIRD REQUEST Member needs a ride.')
})
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
node --test test/email-processor.test.js
```

Expected: failures with "buildOpenSubjectAndDescription is not a function".

- [ ] **Step 4: Extract `buildOpenSubjectAndDescription` helper in `src/email-processor.js`**

Add this function after the `getBodyOrdinalPrefix` function from Task 2:

```js
async function buildOpenSubjectAndDescription({ subjectNumber, memberName, startAt, description, serviceRequestId, getPriorOpenCountFn }) {
  const priorCount = await getPriorOpenCountFn(serviceRequestId);
  const subjectOrdinal = getSubjectOrdinal(priorCount);
  const bodyPrefix = getBodyOrdinalPrefix(priorCount);

  const dateStr = formatDateForSubject(startAt);
  const subject = subjectOrdinal
    ? `${subjectOrdinal} SR Request #${subjectNumber}-For ${memberName}-Service Date: ${dateStr}`
    : `SR Request #${subjectNumber}-For ${memberName}-Service Date: ${dateStr}`;

  const finalDescription = bodyPrefix
    ? `${bodyPrefix} ${description}`
    : description;

  return { subject, description: finalDescription };
}
```

Export it:

```js
module.exports = { pollOnce, deriveRecipientsForEvent, getSubjectOrdinal, getBodyOrdinalPrefix, buildOpenSubjectAndDescription };
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
node --test test/email-processor.test.js
```

Expected: all tests pass.

- [ ] **Step 6: Wire `buildOpenSubjectAndDescription` into `pollOnce`**

In `pollOnce`, find the `sendToBccVolunteers` branch (around line 299). Replace the existing subject construction and `getOpenRequestTemplate` call:

**Before:**
```js
if (routing.sendToBccVolunteers) {
  const recipients = await resolveRecipientsForOpenRequest(requestData);
  if (recipients) {
    const subject = `SR Request #${subjectNumber}-For ${requestData.member_name}-Service Date: ${formatDateForSubject(requestData.start_at)}`;
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
