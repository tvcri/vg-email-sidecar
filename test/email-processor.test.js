const { test } = require('node:test')
const assert = require('node:assert/strict')
const { deriveRecipientsForEvent, getSubjectOrdinal, getBodyOrdinalPrefix, buildSubject } = require('../src/email-processor.js')

test('open event sends BCC to volunteers, not to member or specific volunteer', () => {
  const result = deriveRecipientsForEvent('open', { volunteer_person_id: null })
  assert.equal(result.sendToBccVolunteers, true)
  assert.equal(result.sendToVolunteer, false)
  assert.equal(result.sendToMember, false)
})

test('confirmed event sends to member and volunteer', () => {
  const result = deriveRecipientsForEvent('confirmed', { volunteer_person_id: 42 })
  assert.equal(result.sendToVolunteer, true)
  assert.equal(result.sendToMember, true)
  assert.equal(result.sendToBccVolunteers, false)
})

test('cancelled with volunteer sends to member and volunteer', () => {
  const result = deriveRecipientsForEvent('cancelled', { volunteer_person_id: 42 })
  assert.equal(result.sendToVolunteer, true)
  assert.equal(result.sendToMember, true)
  assert.equal(result.sendToBccVolunteers, false)
})

test('cancelled without volunteer sends to member only', () => {
  const result = deriveRecipientsForEvent('cancelled', { volunteer_person_id: null })
  assert.equal(result.sendToVolunteer, false)
  assert.equal(result.sendToMember, true)
  assert.equal(result.sendToBccVolunteers, false)
})

test('reminder sends to member and volunteer', () => {
  const result = deriveRecipientsForEvent('reminder', { volunteer_person_id: 42 })
  assert.equal(result.sendToVolunteer, true)
  assert.equal(result.sendToMember, true)
  assert.equal(result.sendToBccVolunteers, false)
})

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
