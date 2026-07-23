const { test } = require('node:test');
const assert = require('node:assert/strict');
const { GET_SERVICE_REQUEST } = require('../src/queries');

test('service-request query selects the start* columns', () => {
  const sql = GET_SERVICE_REQUEST;
  assert.match(sql, /\bsr\.start\b/);
  assert.match(sql, /\bsr\.startAddress\b/);
  assert.match(sql, /\bsr\.startCity\b/);
  assert.match(sql, /\bsr\.startState\b/);
  assert.match(sql, /LPAD\(sr\.startZip, 5, '0'\) as startZip/);
  assert.match(sql, /\bsr\.startPhone\b/);
  assert.match(sql, /FROM service_request sr/);
});
