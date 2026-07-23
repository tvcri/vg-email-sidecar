const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  buildRidesOpenRequestTemplate,
  buildRidesConfirmedRequestTemplate,
  buildErrandsOpenRequestTemplate,
  buildErrandsConfirmedRequestTemplate,
  buildRidesMemberConfirmedTemplate,
  buildErrandsMemberConfirmedTemplate,
} = require('../src/templates.js');

const volunteer = { fullName: 'Vera Volunteer', email: 'vera@example.com', cell: '401-555-0000' };

// No start* fields: legacy / pre-migration row. Should render the member home.
const homeRequest = {
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
};

// Same request with authoritative start* fields populated.
const startRequest = {
  ...homeRequest,
  start: 'Sunrise Senior Living',
  startAddress: '100 Main St',
  startCity: 'Warwick',
  startState: 'RI',
  startZip: '02886',
};

const errandsHome = { ...homeRequest, serviceName: 'Errand: Pick up/delivery' };
const errandsStart = { ...startRequest, serviceName: 'Errand: Pick up/delivery' };

const volunteerBuilders = [
  ['RidesOpen', buildRidesOpenRequestTemplate, homeRequest, startRequest],
  ['RidesConfirmed', buildRidesConfirmedRequestTemplate, homeRequest, startRequest],
  ['ErrandsOpen', buildErrandsOpenRequestTemplate, errandsHome, errandsStart],
  ['ErrandsConfirmed', buildErrandsConfirmedRequestTemplate, errandsHome, errandsStart],
];

for (const [name, build, homeReq, startReq] of volunteerBuilders) {
  test(`${name}: falls back to member home when start* is absent`, () => {
    const html = build('Vera', homeReq);
    assert.match(html, /Home - 45 Benefit St Providence, RI 02903/);
  });

  test(`${name}: uses authoritative start* fields when present`, () => {
    const html = build('Vera', startReq);
    assert.match(html, /Sunrise Senior Living - 100 Main St Warwick, RI 02886/);
    assert.doesNotMatch(html, /Home - 45 Benefit St/);
  });
}

const memberBuilders = [
  ['RidesMemberConfirmed', buildRidesMemberConfirmedTemplate, homeRequest, startRequest],
  ['ErrandsMemberConfirmed', buildErrandsMemberConfirmedTemplate, errandsHome, errandsStart],
];

for (const [name, build, homeReq, startReq] of memberBuilders) {
  test(`${name}: adds a Starting Location row`, () => {
    const html = build('Zelda', volunteer, homeReq);
    assert.match(html, /Starting Location:/);
  });

  test(`${name}: shows member home for start when start* is absent`, () => {
    const html = build('Zelda', volunteer, homeReq);
    assert.match(html, /Home - 45 Benefit St Providence, RI 02903/);
  });

  test(`${name}: shows authoritative start* when present`, () => {
    const html = build('Zelda', volunteer, startReq);
    assert.match(html, /Sunrise Senior Living - 100 Main St Warwick, RI 02886/);
    assert.doesNotMatch(html, /Home - 45 Benefit St/);
  });
}
