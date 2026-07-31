const { test } = require('node:test');
const assert = require('node:assert/strict');
const templates = require('../src/templates.js');

// Members are required to have a physical address, so the memberAddress branch
// of every contact block is the one that matters in production.
//
// A member with a landline but no cell is common (306 of 1972 person rows in
// the dev DB). Every template that shows member contact info must render the
// landline for them - several templates previously only looked at memberCell,
// so those members' emails carried no phone number at all.
const baseRow = {
  serviceName: 'Ride: Medical Appnt',
  status: 'Open',
  memberName: 'Zelda Blow',
  memberAddress: '45 Benefit St',
  memberCity: 'Providence',
  memberState: 'RI',
  memberZip: '02903',
  description: 'Doctor visit',
  destination: 'Dr. Office',
  address: '1 Hospital Way',
  city: 'Providence',
  state: 'RI',
  zip: '02905',
  serviceDate: '2025-12-29',
  startTime: '09:00:00',
  apptTime: '10:30:00',
};

const LANDLINE = '401-331-0000';
const CELL = '401-465-0405';

const volunteer = { fullName: 'Vera Volunteer', email: 'vera@example.com', cell: null, phone: null };

// Every template that renders a member contact block, keyed by service type so
// each builder gets a serviceName it actually recognizes.
const cases = [
  ['RidesOpen', row => templates.buildRidesOpenRequestTemplate('Vera', row)],
  ['RidesConfirmed', row => templates.buildRidesConfirmedRequestTemplate('Vera', row)],
  ['ErrandsOpen', row => templates.buildErrandsOpenRequestTemplate('Vera', { ...row, serviceName: 'Errand: Shopping' })],
  ['ErrandsConfirmed', row => templates.buildErrandsConfirmedRequestTemplate('Vera', { ...row, serviceName: 'Errand: Shopping' })],
  ['HomeHelpOpen', row => templates.buildHomeHelpOpenRequestTemplate('Vera', { ...row, serviceName: 'Household Chores/Handy Help' })],
  ['HomeHelpConfirmed', row => templates.buildHomeHelpConfirmedRequestTemplate('Vera', { ...row, serviceName: 'Household Chores/Handy Help' })],
  ['TechSupportOpen', row => templates.buildTechSupportOpenRequestTemplate('Vera', { ...row, serviceName: 'Tech Support' })],
  ['TechSupportConfirmed', row => templates.buildTechSupportConfirmedRequestTemplate('Vera', { ...row, serviceName: 'Tech Support' })],
  ['Reminder', row => templates.buildReminderTemplate('Vera', row)],
];

// buildCancelledTemplate is deliberately excluded: the cancellation notice
// shows the member's name and address with no phone at all, by design - the
// service is off, so there is nothing left to coordinate by phone.

// The customer-reported bug: landline present, cell absent.
for (const [name, render] of cases) {
  test(`${name} renders the member's landline when there is no cell`, () => {
    const html = render({ ...baseRow, memberPhone: LANDLINE, memberCell: null });
    assert.match(html, new RegExp(LANDLINE), `${name} dropped the member's landline`);
  });
}

// The cell must keep working, and must not have been traded away for the landline.
for (const [name, render] of cases) {
  test(`${name} renders the member's cell when there is no landline`, () => {
    const html = render({ ...baseRow, memberPhone: null, memberCell: CELL });
    assert.match(html, new RegExp(CELL), `${name} dropped the member's cell`);
  });
}

// When a member has both, both must appear - a volunteer may need either one.
for (const [name, render] of cases) {
  test(`${name} renders both numbers when the member has both`, () => {
    const html = render({ ...baseRow, memberPhone: LANDLINE, memberCell: CELL });
    assert.match(html, new RegExp(LANDLINE), `${name} dropped the member's landline`);
    assert.match(html, new RegExp(CELL), `${name} dropped the member's cell`);
  });
}

// A member with neither number must not leave a dangling label like "Home:"
// with nothing after it (the TechSupportOpen template did exactly that).
for (const [name, render] of cases) {
  test(`${name} leaves no empty phone label when the member has no numbers`, () => {
    const html = render({ ...baseRow, memberPhone: null, memberCell: null });
    assert.doesNotMatch(html, /(Home|Cell):\s*(<br>|<\/td>)/i,
      `${name} rendered a phone label with no number after it`);
    assert.doesNotMatch(html, /\bnull\b/, `${name} contains literal "null"`);
  });
}
