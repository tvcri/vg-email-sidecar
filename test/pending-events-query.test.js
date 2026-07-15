const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  getPendingEventsQuery,
  setPendingEventsHasPayload,
} = require('../src/queries');

test('query selects payload when the column is present (post-0017 schema)', () => {
  setPendingEventsHasPayload(true);
  const sql = getPendingEventsQuery();
  assert.match(sql, /\bpayload\b/);
  assert.match(sql, /FROM notification_event/);
});

test('query omits payload when the column is absent (pre-0017 / prod main)', () => {
  setPendingEventsHasPayload(false);
  const sql = getPendingEventsQuery();
  assert.doesNotMatch(sql, /\bpayload\b/);
  assert.match(sql, /id, eventType, serviceRequestId, createdAt/);
  assert.match(sql, /WHERE sentAt IS NULL AND failedAt IS NULL/);
});

// Restore the default so import order can't leak state into other suites.
test.after(() => setPendingEventsHasPayload(true));
