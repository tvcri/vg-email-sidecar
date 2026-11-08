const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  buildRidesOpenRequestTemplate,
  buildRidesConfirmedRequestTemplate,
  buildErrandsOpenRequestTemplate,
  buildErrandsConfirmedRequestTemplate,
  buildRidesMemberConfirmedTemplate,
  buildErrandsMemberConfirmedTemplate,
  buildReminderTemplate,
} = require('../src/templates.js');
const { GET_SERVICE_REQUEST_DESTINATIONS } = require('../src/queries');

const volunteer = { fullName: 'Vera Volunteer', email: 'vera@example.com', cell: '401-555-0000' };

// The flat columns mirror the first destination (VG writes them on every save).
const rides = {
  serviceName: 'Ride: Medical Appnt',
  memberName: 'Zelda Blow',
  memberAddress: '45 Benefit St',
  memberCity: 'Providence',
  memberState: 'RI',
  memberZip: '02903',
  description: 'Two stops',
  destination: 'Dr. Office',
  address: '1 Hospital Way',
  city: 'Providence',
  state: 'RI',
  zip: '02905',
  serviceDate: '2025-12-29',
  startTime: '09:00:00',
  destinations: [
    { destination: 'Dr. Office', address: '1 Hospital Way', city: 'Providence', state: 'RI', zip: '02905', phone: null },
    { destination: 'CVS Pharmacy', address: '9 Thayer St', city: 'Providence', state: 'RI', zip: '02906', phone: null },
  ],
};
const errands = { ...rides, serviceName: 'Errand: Pick up/delivery' };

const builders = [
  ['RidesOpen', (rd) => buildRidesOpenRequestTemplate('Vera', rd), rides],
  ['RidesConfirmed', (rd) => buildRidesConfirmedRequestTemplate('Vera', rd), rides],
  ['ErrandsOpen', (rd) => buildErrandsOpenRequestTemplate('Vera', rd), errands],
  ['ErrandsConfirmed', (rd) => buildErrandsConfirmedRequestTemplate('Vera', rd), errands],
  ['RidesMemberConfirmed', (rd) => buildRidesMemberConfirmedTemplate('Zelda', volunteer, rd), rides],
  ['ErrandsMemberConfirmed', (rd) => buildErrandsMemberConfirmedTemplate('Zelda', volunteer, rd), errands],
  ['Reminder', (rd) => buildReminderTemplate('Vera', rd), rides],
];

for (const [name, build, rd] of builders) {
  test(`${name}: lists every destination, in order`, () => {
    const html = build(rd);
    const first = html.indexOf('Dr. Office');
    const second = html.indexOf('CVS Pharmacy');
    assert.ok(first > -1 && second > first, 'both destinations appear, first one first');
    assert.match(html, /9 Thayer St/);
    assert.match(html, /Providence, RI 02906/);
  });

  test(`${name}: a single destination renders as it did before the list existed`, () => {
    const { destinations, ...flatOnly } = rd;
    const withList = build({ ...rd, destinations: destinations.slice(0, 1) });
    assert.equal(withList, build(flatOnly));
    assert.doesNotMatch(withList, /Destinations/);
  });

  test(`${name}: an empty list falls back to the flat columns`, () => {
    const { destinations, ...flatOnly } = rd;
    assert.equal(build({ ...rd, destinations: [] }), build(flatOnly));
  });
}

// Every email with map links today gets one per destination.
for (const [name, build, rd] of builders.filter(([n]) => n !== 'Reminder')) {
  test(`${name}: a map link for each destination`, () => {
    const html = build(rd);
    assert.match(html, /maps\.google\.com\/maps\?q=1\+Hospital\+Way/);
    assert.match(html, /maps\.google\.com\/maps\?q=9\+Thayer\+St/);
  });
}

for (const [name, build, rd] of builders.filter(([n]) => n !== 'Reminder')) {
  test(`${name}: labels the row Destinations when there are several`, () => {
    assert.match(build(rd), /Destinations:/);
  });
}

test('Reminder: heading reads Destinations when there are several', () => {
  assert.match(buildReminderTemplate('Vera', rides), /<u>Destinations<\/u>/);
});

test('destinations with null fields never print "null"', () => {
  const rd = {
    ...rides,
    destinations: [
      rides.destinations[0],
      { destination: 'Library', address: null, city: null, state: null, zip: null, phone: null },
    ],
  };
  for (const [, build] of builders) {
    const html = build(rd);
    assert.match(html, /Library/);
    assert.doesNotMatch(html, /null/);
  }
});

test('destinations query reads the child table in entry order', () => {
  assert.match(GET_SERVICE_REQUEST_DESTINATIONS, /FROM service_request_destination/);
  assert.match(GET_SERVICE_REQUEST_DESTINATIONS, /WHERE serviceRequestId = \?/);
  assert.match(GET_SERVICE_REQUEST_DESTINATIONS, /ORDER BY id/);
  assert.match(GET_SERVICE_REQUEST_DESTINATIONS, /LPAD\(zip, 5, '0'\) AS zip/);
});

// getServiceRequest against a stubbed connection: the second query is the
// destination list, which must not break a schema that lacks the table.
function withStubbedConnection(destinationsResult, fn) {
  const mysql = require('mysql2/promise');
  const original = mysql.createConnection;
  mysql.createConnection = async () => ({
    query: async (sql) => {
      if (!sql.includes('service_request_destination')) return [[{ id: 7, destination: 'Dr. Office' }]];
      if (destinationsResult instanceof Error) throw destinationsResult;
      return [destinationsResult];
    },
    end: async () => {},
  });
  delete require.cache[require.resolve('../src/db.js')];
  return fn(require('../src/db.js')).finally(() => {
    mysql.createConnection = original;
    delete require.cache[require.resolve('../src/db.js')];
  });
}

test('getServiceRequest attaches the destination list', () =>
  withStubbedConnection([{ destination: 'A' }, { destination: 'B' }], async (db) => {
    const rd = await db.getServiceRequest(7);
    assert.deepEqual(rd.destinations.map((d) => d.destination), ['A', 'B']);
  }));

test('getServiceRequest falls back to no list before VG migration 0032', () =>
  withStubbedConnection(Object.assign(new Error('no table'), { code: 'ER_NO_SUCH_TABLE' }), async (db) => {
    const rd = await db.getServiceRequest(7);
    assert.deepEqual(rd.destinations, []);
    assert.equal(rd.destination, 'Dr. Office');
  }));

test('getServiceRequest still surfaces other destination query errors', () =>
  withStubbedConnection(Object.assign(new Error('boom'), { code: 'ER_LOCK_DEADLOCK' }), async (db) => {
    await assert.rejects(db.getServiceRequest(7), /boom/);
  }));

test('no blank line between a destination street and its city line', () => {
  for (const [, build, rd] of builders) {
    assert.doesNotMatch(build(rd), /(Hospital Way|Thayer St)(<\/a>)?<br><br>Providence/);
  }
});
