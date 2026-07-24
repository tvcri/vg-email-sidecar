const { test } = require('node:test')
const assert = require('node:assert/strict')
const { buildMemberReminderTemplate } = require('../src/templates.js')

const volunteerData = {
  id: 7,
  fullName: 'Joanne Miller',
  email: 'j.millerxxx@gmail.com',
  phone: null,
  cell: '401-465-0405',
}

const ridesRequest = {
  serviceName: 'Ride: Medical Appnt',
  memberName: 'Zelda Blow',
  memberAddress: '10 Happy Street',
  memberCity: 'Providence',
  memberState: 'RI',
  memberZip: '02906',
  memberCell: '401-555-0101',
  description: 'Round-trip ride to medical appointment.',
  serviceDate: '2025-12-29',
  timesFlexible: false,
  startTime: '08:00:00',
  start: 'Laurelmead Cooperative',
  startAddress: '355 Blackstone Blvd',
  startCity: 'Providence',
  startState: 'RI',
  startZip: '02906',
  destination: 'Rhode Island Eye Institute',
  address: '150 East Manning Street',
  city: 'Providence',
  state: 'RI',
  zip: '02906',
}

const errandsRequest = {
  serviceName: 'Errand: Pick up/delivery',
  memberName: 'Zelda Blow',
  memberAddress: '10 Happy Street',
  memberCity: 'Providence',
  memberState: 'RI',
  memberZip: '02906',
  memberCell: '401-555-0101',
  description: 'Pick up medication at CVS and deliver to Zelda.',
  serviceDate: '2025-12-29',
  timesFlexible: true,
  startTime: null,
  destination: 'CVS',
  address: '481 Angell Street',
  city: 'Providence',
  state: 'RI',
  zip: '02906',
}

const homeHelpRequest = {
  serviceName: 'Household Chores/Handy Help',
  memberName: 'Zelda Blow',
  memberAddress: '10 Happy Street',
  memberCity: 'Providence',
  memberState: 'RI',
  memberZip: '02906',
  memberCell: '401-555-0101',
  description: 'Change a light bulb in a ceiling fixture.',
  serviceDate: '2025-12-29',
  timesFlexible: true,
  startTime: null,
  destination: null,
}

const techRequest = {
  serviceName: 'Tech Support',
  memberName: 'Zelda Blow',
  memberAddress: '10 Happy Street',
  memberCity: 'Providence',
  memberState: 'RI',
  memberZip: '02906',
  memberCell: '401-555-0101',
  description: 'Zelda has a new iPhone 17 and needs help setting it up.',
  serviceDate: '2025-12-29',
  timesFlexible: true,
  startTime: null,
  destination: null,
}

const allRequests = [ridesRequest, errandsRequest, homeHelpRequest, techRequest]

test('renders the member intro, provider heading, and closing copy for every service type', () => {
  for (const rd of allRequests) {
    const html = buildMemberReminderTemplate('Zelda', volunteerData, rd)
    assert.match(html, /Hello Zelda\./)
    assert.match(html, /This is a reminder about a service you requested with <strong>The Village Common of RI<\/strong>\./)
    assert.match(html, /<u>Your service provider\(s\)<\/u>/)
    assert.match(html, /<u>Short Description<\/u>/)
    // PDF wording: "reply to the email", not "this email"
    assert.match(html, /please call 401-441-5240 or reply to the email\./)
    assert.match(html, new RegExp(rd.serviceName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    assert.match(html, new RegExp(rd.description.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
})

test('shows the time for a timed ride and the flexible note otherwise', () => {
  const ridesHtml = buildMemberReminderTemplate('Zelda', volunteerData, ridesRequest)
  assert.match(ridesHtml, /Monday, December 29, 2025 at 8:00 AM/)
  assert.doesNotMatch(ridesHtml, /The time is flexible/)

  // The gap before the flexible note is a literal &nbsp; entity (matching the
  // volunteer reminder's spacing), not whitespace - so match the entity.
  for (const rd of [errandsRequest, homeHelpRequest, techRequest]) {
    const html = buildMemberReminderTemplate('Zelda', volunteerData, rd)
    assert.match(html, /Monday, December 29, 2025 &nbsp;\(The time is flexible\)/)
    assert.doesNotMatch(html, / at \d+:\d{2} (AM|PM)/)
  }
})

test('renders provider contact in PDF order: name, phone, email', () => {
  const html = buildMemberReminderTemplate('Zelda', volunteerData, ridesRequest)
  const nameIdx = html.indexOf('Joanne Miller')
  const phoneIdx = html.indexOf('401-465-0405 (cell)')
  const emailIdx = html.indexOf('mailto:j.millerxxx@gmail.com')
  assert.ok(nameIdx !== -1, 'provider name missing')
  assert.ok(phoneIdx !== -1, 'provider cell missing')
  assert.ok(emailIdx !== -1, 'provider email missing')
  assert.ok(nameIdx < phoneIdx && phoneIdx < emailIdx, 'expected name, then phone, then email')
})

test('falls back to landline without the cell suffix, and drops missing pieces cleanly', () => {
  const landlineOnly = { ...volunteerData, cell: null, phone: '401-331-0000' }
  let html = buildMemberReminderTemplate('Zelda', landlineOnly, ridesRequest)
  assert.match(html, /401-331-0000/)
  assert.doesNotMatch(html, /\(cell\)/)

  const noContact = { ...volunteerData, cell: null, phone: null, email: null }
  html = buildMemberReminderTemplate('Zelda', noContact, ridesRequest)
  assert.match(html, /Joanne Miller/)
  assert.doesNotMatch(html, /mailto:/)
  // filter-and-join: no dangling <br> chain after the lone name
  assert.doesNotMatch(html, /Joanne Miller<br><br>\s*<br>/)
})

// The customer's member template deliberately omits the dispatch detail the
// volunteer reminder carries. Pin the absences so they cannot creep back in.
test('omits Requesting Member, Starting Location, and Destination for every service type', () => {
  for (const rd of allRequests) {
    const html = buildMemberReminderTemplate('Zelda', volunteerData, rd)
    assert.doesNotMatch(html, /Requesting Member/)
    assert.doesNotMatch(html, /Starting Location/)
    assert.doesNotMatch(html, /Destination/)
    // the member's own home address never appears
    assert.doesNotMatch(html, /10 Happy Street/)
  }
})

test('never renders the literal string null for missing fields', () => {
  const bareRequest = {
    serviceName: 'Tech Support', memberName: 'Zelda Blow',
    memberAddress: null, memberCity: null, memberState: null, memberZip: null,
    memberCell: null, description: 'Set up a new tablet.',
    serviceDate: '2025-12-29', timesFlexible: true, startTime: null, destination: null,
  }
  const bareVolunteer = { id: 7, fullName: 'Joanne Miller', email: null, phone: null, cell: null }
  assert.doesNotMatch(buildMemberReminderTemplate('Zelda', bareVolunteer, bareRequest), /null/)
})
