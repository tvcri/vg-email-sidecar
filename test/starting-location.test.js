const { test } = require('node:test');
const assert = require('node:assert/strict');
const { formatStartingLocation } = require('../src/templates.js');

const home = {
  memberAddress: '45 Benefit St',
  memberCity: 'Providence',
  memberState: 'RI',
  memberZip: '02903',
};

test('uses start* fields with the start label when startAddress is present', () => {
  const out = formatStartingLocation({
    ...home,
    start: 'Sunrise Senior Living',
    startAddress: '100 Main St',
    startCity: 'Warwick',
    startState: 'RI',
    startZip: '02886',
  });
  assert.equal(out, 'Sunrise Senior Living - 100 Main St Warwick, RI 02886');
});

test('omits the " - " prefix when start label is absent but startAddress is present', () => {
  const out = formatStartingLocation({
    ...home,
    startAddress: '100 Main St',
    startCity: 'Warwick',
    startState: 'RI',
    startZip: '02886',
  });
  assert.equal(out, '100 Main St Warwick, RI 02886');
});

test('falls back to member home when startAddress is absent', () => {
  const out = formatStartingLocation(home);
  assert.equal(out, 'Home - 45 Benefit St Providence, RI 02903');
});

test('returns empty string when neither start nor member address is present', () => {
  assert.equal(formatStartingLocation({}), '');
});
