const { test } = require('node:test');
const assert = require('node:assert/strict');
const templates = require('../src/templates.js');

// A customer signed up for a ride and got a confirmation whose "Requesting
// Member:" cell listed the member's name twice and both phone numbers twice.
// buildRidesConfirmedRequestTemplate wrapped the already-complete member
// address block with a second copy of the name and phones; every other
// template emits the block on its own.
const baseRow = {
  serviceName: 'Ride: Medical Appnt',
  status: 'Confirmed',
  memberName: 'Dunnigan, John',
  memberPhone: '401-539-2595',
  memberCell: '401-782-7287',
  memberAddress: '250 Gardiner Road',
  memberCity: 'Richmond',
  memberState: 'RI',
  memberZip: '02892',
  description: 'Round trip ride to a morning appointment.',
  destination: 'South County Health Medical Office Building',
  address: '70 Kenyon Avenue',
  city: 'South Kingstown',
  state: 'RI',
  zip: '02879',
  serviceDate: '2026-09-28',
  startTime: '10:30:00',
  apptTime: '11:00:00',
  returnTime: '11:30:00',
  finishTime: '12:00:00',
  transportationType: 'Round Trip',
};

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
];

// Pull out just the "Requesting Member:" cell so the assertions do not trip
// over the name in the salutation or the phones in the closing paragraph.
function memberCell(html) {
  const match = html.match(/Requesting\s*(?:<br>)?\s*Member:<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
  assert.ok(match, 'no "Requesting Member:" cell found in the rendered email');
  return match[1];
}

function countOf(haystack, needle) {
  return haystack.split(needle).length - 1;
}

for (const [name, render] of cases) {
  test(`${name} states the member's name once in the member block`, () => {
    const cell = memberCell(render(baseRow));
    assert.equal(countOf(cell, baseRow.memberName), 1,
      `${name} repeated the member's name in the member block`);
  });

  test(`${name} states each of the member's phone numbers once`, () => {
    const cell = memberCell(render(baseRow));
    assert.equal(countOf(cell, baseRow.memberPhone), 1,
      `${name} repeated the member's landline in the member block`);
    assert.equal(countOf(cell, baseRow.memberCell), 1,
      `${name} repeated the member's cell in the member block`);
  });

  test(`${name} states the member's street address once`, () => {
    const cell = memberCell(render(baseRow));
    assert.equal(countOf(cell, baseRow.memberAddress), 1,
      `${name} repeated the member's street address in the member block`);
  });
}
