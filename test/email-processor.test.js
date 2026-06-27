const { test } = require('node:test')
const assert = require('node:assert/strict')
const { deriveRecipientsForEvent } = require('../src/email-processor.js')

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
