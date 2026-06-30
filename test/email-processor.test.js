const { test } = require('node:test')
const assert = require('node:assert/strict')
const { deriveRecipientsForEvent, getSubjectOrdinal, getBodyOrdinalPrefix, buildSubject, buildOpenSubjectAndDescription } = require('../src/email-processor.js')

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

test('buildOpenSubjectAndDescription: legacy SR first send treated as 2nd request', async () => {
  const result = await buildOpenSubjectAndDescription({
    subjectNumber: '27143',
    memberName: 'Mary Lou Foley',
    startAt: '2026-06-22T14:00:00Z',
    description: 'Member needs a ride.',
    serviceRequestId: 1,
    requestNumber: '27143',
    isTestMode: false,
    getPriorOpenCountFn: async () => 0,
  })
  assert.equal(result.subject, '2nd SR Request #27143-For Mary Lou Foley-Service Date: 6/22/2026')
  assert.equal(result.description, 'SECOND REQUEST Member needs a ride.')
})

test('buildOpenSubjectAndDescription: legacy SR second send treated as 3rd request', async () => {
  const result = await buildOpenSubjectAndDescription({
    subjectNumber: '27143',
    memberName: 'Mary Lou Foley',
    startAt: '2026-06-22T14:00:00Z',
    description: 'Member needs a ride.',
    serviceRequestId: 1,
    requestNumber: '27143',
    isTestMode: false,
    getPriorOpenCountFn: async () => 1,
  })
  assert.equal(result.subject, '3rd SR Request #27143-For Mary Lou Foley-Service Date: 6/22/2026')
  assert.equal(result.description, 'THIRD REQUEST Member needs a ride.')
})
