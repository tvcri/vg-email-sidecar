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
