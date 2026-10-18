const { test } = require('node:test');
const assert = require('node:assert/strict');
const templates = require('../src/templates.js');

// Joanne Miller's 2026-10-16 edits to the volunteer confirmation emails:
// "You are now confirmed as a volunteer" moves up, a bold "Important" call-the-
// member line follows it, Short Description drops below both, the old closing
// "Please call the member..." paragraph (with its "night before" reconfirm) is
// gone, and empty Special Instructions say so explicitly. "Service provider"
// is retired from every outgoing email.
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
  serviceNotes: 'Uses a walker; please allow extra time.',
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

const volunteer = { fullName: 'Vera Volunteer', email: 'vera@example.com', cell: '401-555-0000' };

const HELPING = 'Important: Please be sure to call the member as soon as possible to let them know you will be helping them and to arrange the details.';

const confirmations = [
  ['RidesConfirmed', row => templates.buildRidesConfirmedRequestTemplate('Vera', row),
    'Important: Please be sure to call the member as soon as possible to let them know you will be their driver and to confirm details of the ride.'],
  ['ErrandsConfirmed', row => templates.buildErrandsConfirmedRequestTemplate('Vera', { ...row, serviceName: 'Errand: Shopping' }),
    'Important: Please be sure to call the member as soon as possible to let them know you will be doing their errand and to confirm details.'],
  ['HomeHelpConfirmed', row => templates.buildHomeHelpConfirmedRequestTemplate('Vera', { ...row, serviceName: 'Household Chores/Handy Help' }),
    HELPING],
  ['TechSupportConfirmed', row => templates.buildTechSupportConfirmedRequestTemplate('Vera', { ...row, serviceName: 'Tech Support' }),
    HELPING],
];

const EMPTY_NOTES = 'Special Instructions for this member: <em>There are no special instructions for this member.</em>';

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

for (const [name, render, important] of confirmations) {
  test(`${name} opens thank-you, confirmed, Important, then Short Description`, () => {
    const html = render(baseRow);
    const thanks = html.indexOf('Thank you for agreeing to help');
    const confirmed = html.indexOf('You are now confirmed as a volunteer for this service request.');
    const imp = html.indexOf(important);
    const short = html.indexOf('Short Description:');
    const table = html.indexOf('Service:</td>');
    assert.ok(thanks !== -1 && confirmed !== -1 && imp !== -1 && short !== -1 && table !== -1);
    assert.ok(thanks < confirmed && confirmed < imp && imp < short && short < table,
      'paragraphs out of order');
    // a blank line between each opening paragraph
    assert.match(html, /for Dunnigan, John\.<br><br>\s*You are now confirmed/);
    assert.match(html, /this service request\.<br><br>\s*<strong>Important:/);
    assert.match(html, /<\/strong><br><br>\s*Short Description:/);
  });

  test(`${name} renders the exact bold Important sentence`, () => {
    const html = render(baseRow);
    assert.match(html, new RegExp(`<strong>${escapeRegExp(important)}</strong>`));
  });

  test(`${name} says volunteer, not service provider`, () => {
    const html = render(baseRow);
    assert.doesNotMatch(html, /provider/i);
  });

  test(`${name} drops the closing "Please call the member" paragraph`, () => {
    const html = render(baseRow);
    assert.doesNotMatch(html, /Please call the member/);
    assert.doesNotMatch(html, /night before/);
    assert.match(html, /Special Instructions for this member: [^\n]*<br>\s*<br>\s*If you have any questions or need to cancel/);
  });

  for (const empty of [null, undefined, '', '   ']) {
    test(`${name} states there are no special instructions when notes are ${JSON.stringify(empty) ?? 'undefined'}`, () => {
      const html = render({ ...baseRow, serviceNotes: empty });
      assert.ok(html.includes(EMPTY_NOTES), 'missing the no-special-instructions sentence');
    });
  }

  test(`${name} renders the notes as given when present`, () => {
    const html = render(baseRow);
    assert.ok(html.includes('Special Instructions for this member: Uses a walker; please allow extra time.<br>'));
    assert.doesNotMatch(html, /There are no special instructions/);
  });
}

test('open-request templates keep their Special Instructions wording', () => {
  const rides = templates.buildRidesOpenRequestTemplate('Vera', { ...baseRow, serviceNotes: '' });
  assert.match(rides, /Members Special Instructions: <br>/);
  assert.doesNotMatch(rides, /There are no special instructions/);
});

const memberTemplates = [
  ['RidesMemberConfirmed', () => templates.buildRidesMemberConfirmedTemplate('Zelda', volunteer, baseRow)],
  ['ErrandsMemberConfirmed', () => templates.buildErrandsMemberConfirmedTemplate('Zelda', volunteer, { ...baseRow, serviceName: 'Errand: Shopping' })],
  ['HomeHelpMemberConfirmed', () => templates.buildHomeHelpMemberConfirmedTemplate('Zelda', volunteer, { ...baseRow, serviceName: 'Household Chores/Handy Help' })],
  ['TechSupportMemberConfirmed', () => templates.buildTechSupportMemberConfirmedTemplate('Zelda', volunteer, { ...baseRow, serviceName: 'Tech Support' })],
  ['MemberReminder', () => templates.buildMemberReminderTemplate('Zelda', volunteer, baseRow)],
  ['MemberCancelled', () => templates.buildMemberCancelledTemplate('Zelda', { ...baseRow, status: 'Member cancelled' })],
];

for (const [name, render] of memberTemplates) {
  test(`${name} renders no "provider" wording`, () => {
    assert.doesNotMatch(render(), /provider/i);
  });
}

for (const [name, render] of memberTemplates.slice(0, 4)) {
  test(`${name} introduces the volunteer(s)`, () => {
    assert.match(render(), /Your volunteer\(s\) will be:/);
  });
}
