const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  buildRidesOpenRequestTemplate,
  buildRidesConfirmedRequestTemplate,
  buildRidesMemberConfirmedTemplate,
} = require('../src/templates.js');

// apptTime populated so the arrival-time row renders.
const ridesRequest = {
  serviceName: 'Ride: Medical Appnt',
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

const volunteer = { fullName: 'Vera Volunteer', email: 'vera@example.com', cell: '401-555-0000' };

test('RidesOpen labels the appointment time row "Arrival Time"', () => {
  const html = buildRidesOpenRequestTemplate('Vera', ridesRequest);
  assert.match(html, /Arrival Time/);
  assert.doesNotMatch(html, /Appointment Time/);
});

test('RidesConfirmed labels the appointment time row "Arrival Time"', () => {
  const html = buildRidesConfirmedRequestTemplate('Vera', ridesRequest);
  assert.match(html, /Arrival Time/);
  assert.doesNotMatch(html, /Appointment Time/);
});

test('RidesMemberConfirmed labels the appointment time row "Arrival Time"', () => {
  const html = buildRidesMemberConfirmedTemplate('Zelda', volunteer, ridesRequest);
  assert.match(html, /Arrival Time/);
  assert.doesNotMatch(html, /Appointment Time/);
});
