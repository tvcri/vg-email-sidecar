const { test } = require('node:test')
const assert = require('node:assert/strict')
const { buildReminderTemplate } = require('../src/templates.js')

const ridesRequest = {
  serviceName: 'Ride: Medical Appnt',
  memberName: 'Zelda Blow',
  memberAddress: '10 Happy Street',
  memberCity: 'Providence',
  memberState: 'RI',
  memberZip: '02906',
  memberCell: '401-465-0405',
  description: 'Round-trip ride to medical appointment.',
  serviceDate: '2025-12-29',
  timesFlexible: false,
  startTime: '08:00:00',
  start: null,
  startAddress: null,
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
  memberCell: '401-465-0405',
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
  memberCell: '401-465-0405',
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
  memberCell: '401-465-0405',
  description: 'Zelda has a new iPhone 17 and needs help setting it up.',
  serviceDate: '2025-12-29',
  timesFlexible: true,
  startTime: null,
  destination: null,
}

test('renders the shared reminder intro and closing copy for every service type', () => {
  for (const rd of [ridesRequest, errandsRequest, homeHelpRequest, techRequest]) {
    const html = buildReminderTemplate('Joanne', rd)
    assert.match(html, /This is a reminder about a service request with <strong>The Village Common of RI<\/strong> for which you are scheduled\./)
    assert.match(html, /please call 401-441-5240 or reply to this email\./)
    assert.match(html, new RegExp(rd.serviceName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
})

test('shows the time for a timed ride and the flexible note otherwise', () => {
  const ridesHtml = buildReminderTemplate('Joanne', ridesRequest)
  assert.match(ridesHtml, /Monday, December 29, 2025 at 8:00 AM/)
  assert.doesNotMatch(ridesHtml, /The time is flexible/)

  // The gap before the flexible note is a literal &nbsp; entity (matching the
  // spacing in the customer PDFs), not whitespace - so match the entity.
  for (const rd of [errandsRequest, homeHelpRequest, techRequest]) {
    const html = buildReminderTemplate('Joanne', rd)
    assert.match(html, /Monday, December 29, 2025 &nbsp;\(The time is flexible\)/)
    assert.doesNotMatch(html, / at \d+:\d{2} (AM|PM)/)
  }
})

test('renders the requesting member block with the home address and cell', () => {
  const html = buildReminderTemplate('Joanne', ridesRequest)
  assert.match(html, /Zelda Blow/)
  assert.match(html, /10 Happy Street/)
  assert.match(html, /Providence, RI 02906/)
  assert.match(html, /401-465-0405 \(cell\)/)
})

test('shows Starting Location for rides only', () => {
  const ridesHtml = buildReminderTemplate('Joanne', ridesRequest)
  assert.match(ridesHtml, /Starting Location/)

  for (const rd of [errandsRequest, homeHelpRequest, techRequest]) {
    const html = buildReminderTemplate('Joanne', rd)
    assert.doesNotMatch(html, /Starting Location/)
  }
})

test('prefers the authoritative start address over member home for rides', () => {
  const html = buildReminderTemplate('Joanne', {
    ...ridesRequest,
    start: 'Laurelmead Cooperative',
    startAddress: '355 Blackstone Blvd',
    startCity: 'Providence',
    startState: 'RI',
    startZip: '02906',
  })
  assert.match(html, /Laurelmead Cooperative - 355 Blackstone Blvd/)
})

test('omits the Destination heading when there is no destination', () => {
  const withDest = buildReminderTemplate('Joanne', ridesRequest)
  assert.match(withDest, /Destination/)
  assert.match(withDest, /Rhode Island Eye Institute/)

  for (const rd of [homeHelpRequest, techRequest]) {
    const html = buildReminderTemplate('Joanne', rd)
    assert.doesNotMatch(html, /Destination/)
  }
})

// Output-level regression guard. Note this passes even if the
// withBlankAddressNulls() call is removed, because the template's own
// conditionals already suppress nulls on these paths - it pins the rendered
// output, not the guard. Keep the withBlankAddressNulls() call regardless: it
// is the file-wide convention and protects future edits that interpolate an
// address field unconditionally.
test('never renders the literal string null for missing address parts', () => {
  const cases = [
    // nothing but a name
    {
      serviceName: 'Tech Support', memberName: 'Zelda Blow',
      memberAddress: null, memberCity: null, memberState: null, memberZip: null,
      memberCell: null, description: 'Set up a new tablet.',
      serviceDate: '2025-12-29', timesFlexible: true, startTime: null, destination: null,
    },
    // street present but city/state/zip missing - exercises the interpolated block
    {
      serviceName: 'Ride: Medical Appnt', memberName: 'Zelda Blow',
      memberAddress: '10 Happy Street', memberCity: null, memberState: null, memberZip: null,
      memberCell: null, description: 'Ride to appointment.',
      serviceDate: '2025-12-29', timesFlexible: false, startTime: '08:00:00',
      start: null, startAddress: null,
      destination: 'CVS', address: '481 Angell Street', city: null, state: null, zip: null,
    },
  ]
  for (const rd of cases) {
    assert.doesNotMatch(buildReminderTemplate('Joanne', rd), /null/)
  }
})
