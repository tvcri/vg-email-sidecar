const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  getServiceRequestQuery,
  setServiceRequestHasStart,
} = require('../src/queries');

test('query selects start columns when they are present (post-0016 schema)', () => {
  setServiceRequestHasStart(true);
  const sql = getServiceRequestQuery();
  assert.match(sql, /\bsr\.start\b/);
  assert.match(sql, /\bsr\.startAddress\b/);
  assert.match(sql, /\bsr\.startCity\b/);
  assert.match(sql, /\bsr\.startState\b/);
  assert.match(sql, /LPAD\(sr\.startZip, 5, '0'\) as startZip/);
  assert.match(sql, /\bsr\.startPhone\b/);
  assert.match(sql, /FROM service_request sr/);
});

test('query omits start columns when they are absent (pre-0016 / prod main)', () => {
  setServiceRequestHasStart(false);
  const sql = getServiceRequestQuery();
  assert.doesNotMatch(sql, /\bsr\.start\b/);
  assert.doesNotMatch(sql, /startAddress/);
  assert.doesNotMatch(sql, /startPhone/);
  // Destination columns and the member join are unaffected.
  assert.match(sql, /\bsr\.destination\b/);
  assert.match(sql, /FROM service_request sr/);
});

// Restore the default so import order can't leak state into other suites.
test.after(() => setServiceRequestHasStart(true));
