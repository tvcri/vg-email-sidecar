const { test } = require('node:test');
const assert = require('node:assert/strict');
const templates = require('../src/templates.js');

// Every outgoing email should credit Village Green, never the legacy
// ClubExpress system (its footer once lingered in the member-facing
// confirmation and cancellation templates).
const row = {
  serviceName: 'Ride: Medical Appnt',
  status: 'Member cancelled',
  memberName: 'Dunnigan, John',
  memberPhone: '401-539-2595',
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
};
const errand = { ...row, serviceName: 'Errand: Shopping' };
const homeHelp = { ...row, serviceName: 'Household Chores/Handy Help' };
const tech = { ...row, serviceName: 'Tech Support' };
const volunteer = { fullName: 'Vera Volunteer', email: 'vera@example.com', cell: '401-555-0000' };

const emails = [
  ['HomeHelpOpen', () => templates.buildHomeHelpOpenRequestTemplate('Vera', homeHelp)],
  ['HomeHelpConfirmed', () => templates.buildHomeHelpConfirmedRequestTemplate('Vera', homeHelp)],
  ['RidesOpen', () => templates.buildRidesOpenRequestTemplate('Vera', row)],
  ['RidesConfirmed', () => templates.buildRidesConfirmedRequestTemplate('Vera', row)],
  ['ErrandsOpen', () => templates.buildErrandsOpenRequestTemplate('Vera', errand)],
  ['ErrandsConfirmed', () => templates.buildErrandsConfirmedRequestTemplate('Vera', errand)],
  ['TechSupportOpen', () => templates.buildTechSupportOpenRequestTemplate('Vera', tech)],
  ['TechSupportConfirmed', () => templates.buildTechSupportConfirmedRequestTemplate('Vera', tech)],
  ['RidesMemberConfirmed', () => templates.buildRidesMemberConfirmedTemplate('Zelda', volunteer, row)],
  ['HomeHelpMemberConfirmed', () => templates.buildHomeHelpMemberConfirmedTemplate('Zelda', volunteer, homeHelp)],
  ['ErrandsMemberConfirmed', () => templates.buildErrandsMemberConfirmedTemplate('Zelda', volunteer, errand)],
  ['TechSupportMemberConfirmed', () => templates.buildTechSupportMemberConfirmedTemplate('Zelda', volunteer, tech)],
  ['Cancelled', () => templates.buildCancelledTemplate('Vera', row)],
  ['MemberCancelled', () => templates.buildMemberCancelledTemplate('Zelda', row)],
  ['Reminder', () => templates.buildReminderTemplate('Vera', row)],
  ['MemberReminder', () => templates.buildMemberReminderTemplate('Zelda', volunteer, row)],
  ['EnrollPin', () => templates.buildEnrollPinTemplate({ firstName: 'Zelda', pin: '123456', kind: 'member' })],
  ['EnrollIneligible', () => templates.buildEnrollIneligibleTemplate({ firstName: 'Zelda' })],
  ['MemberWelcome', () => templates.buildMemberWelcomeTemplate({ firstName: 'Zelda', villageName: 'Bristol' })],
];

for (const [name, render] of emails) {
  test(`${name} does not mention ClubExpress`, () => {
    const html = render();
    assert.doesNotMatch(html, /club\s*express/i);
    assert.doesNotMatch(html, /Morehead/);
  });
}
