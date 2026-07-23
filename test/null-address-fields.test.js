const { test } = require('node:test');
const assert = require('node:assert/strict');
const templates = require('../src/templates.js');

// A service_request row where every nullable address component is null - the
// worst case (mysql2 hands back JS null for a NULL column, and LPAD(NULL,...)
// is NULL). No address field should ever render the literal string "null".
const nullRow = {
  serviceName: 'Ride: Medical Appnt',
  status: 'Member cancelled',
  memberName: 'Zelda Blow',
  memberAddress: '45 Benefit St',
  memberCity: null,
  memberState: null,
  memberZip: null,
  memberPhone: null,
  memberCell: null,
  description: 'Doctor visit',
  destination: 'Dr. Office',
  address: '1 Hospital Way',
  city: null,
  state: null,
  zip: null,
  start: 'Sunrise Senior Living',
  startAddress: '100 Main St',
  startCity: null,
  startState: null,
  startZip: null,
  serviceDate: '2025-12-29',
  startTime: '09:00:00',
  apptTime: '10:30:00',
};

const volunteer = { fullName: 'Vera Volunteer', email: 'vera@example.com', cell: null, phone: null };

const cases = [
  ['RidesOpen', () => templates.buildRidesOpenRequestTemplate('Vera', nullRow)],
  ['RidesConfirmed', () => templates.buildRidesConfirmedRequestTemplate('Vera', nullRow)],
  ['ErrandsOpen', () => templates.buildErrandsOpenRequestTemplate('Vera', { ...nullRow, serviceName: 'Errand: Shopping' })],
  ['ErrandsConfirmed', () => templates.buildErrandsConfirmedRequestTemplate('Vera', { ...nullRow, serviceName: 'Errand: Shopping' })],
  ['HomeHelpOpen', () => templates.buildHomeHelpOpenRequestTemplate('Vera', { ...nullRow, serviceName: 'Household Chores/Handy Help' })],
  ['HomeHelpConfirmed', () => templates.buildHomeHelpConfirmedRequestTemplate('Vera', { ...nullRow, serviceName: 'Household Chores/Handy Help' })],
  ['TechSupportOpen', () => templates.buildTechSupportOpenRequestTemplate('Vera', { ...nullRow, serviceName: 'Tech Support' })],
  ['TechSupportConfirmed', () => templates.buildTechSupportConfirmedRequestTemplate('Vera', { ...nullRow, serviceName: 'Tech Support' })],
  ['RidesMemberConfirmed', () => templates.buildRidesMemberConfirmedTemplate('Zelda', volunteer, nullRow)],
  ['ErrandsMemberConfirmed', () => templates.buildErrandsMemberConfirmedTemplate('Zelda', volunteer, { ...nullRow, serviceName: 'Errand: Shopping' })],
  ['Cancelled', () => templates.buildCancelledTemplate('Vera', nullRow)],
];

for (const [name, render] of cases) {
  test(`${name} never renders the literal "null" for null address fields`, () => {
    const html = render();
    assert.doesNotMatch(html, /\bnull\b/, `${name} contains literal "null"`);
  });
}

// The zip fix must not corrupt a valid zip.
test('a valid zip still renders when present', () => {
  const html = templates.buildRidesOpenRequestTemplate('Vera', {
    ...nullRow, memberZip: '02903', zip: '02905', startZip: '02886',
  });
  assert.match(html, /02903/);
  assert.match(html, /02905/);
  assert.match(html, /02886/);
});
