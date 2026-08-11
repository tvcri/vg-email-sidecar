const { test } = require('node:test');
const assert = require('node:assert/strict');
const { GET_PERSON } = require('../src/queries');

test('person query selects villageName via a left join on village', () => {
  const sql = GET_PERSON;
  assert.match(sql, /v\.name AS villageName/);
  assert.match(sql, /LEFT JOIN village v ON p\.villageId = v\.id/);
  assert.match(sql, /FROM person p/);
  // Existing fields the volunteer-lookup callers rely on are still selected.
  assert.match(sql, /p\.fullName/);
  assert.match(sql, /p\.email/);
  assert.match(sql, /p\.phone/);
  assert.match(sql, /p\.cell/);
});
