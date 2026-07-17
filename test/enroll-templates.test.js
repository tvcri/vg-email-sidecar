const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildEnrollPinTemplate, buildEnrollIneligibleTemplate, applyEnrollTestBanner } = require('../src/templates');

test('PIN template includes the PIN, greeting, and expiry note', () => {
  const html = buildEnrollPinTemplate({ firstName: 'Jane', pin: '123456', kind: 'new' });
  assert.ok(html.includes('123456'));
  assert.ok(html.includes('Dear Jane,'));
  assert.ok(html.includes('15 minutes'));
});

test('PIN template mentions an existing account for kind existing_account', () => {
  const html = buildEnrollPinTemplate({ firstName: 'Jane', pin: '123456', kind: 'existing_account' });
  assert.ok(html.includes('already have'));
});

test('PIN template greets generically without a first name', () => {
  const html = buildEnrollPinTemplate({ firstName: null, pin: '654321', kind: 'new' });
  assert.ok(html.includes('Hello,'));
});

test('ineligible template explains volunteers-only', () => {
  const html = buildEnrollIneligibleTemplate({ firstName: 'Bob' });
  assert.ok(html.includes('Dear Bob,'));
  assert.ok(html.includes('volunteers'));
});

test('applyEnrollTestBanner injects the intended email into the PIN template', () => {
  const html = applyEnrollTestBanner(
    buildEnrollPinTemplate({ firstName: 'Jane', pin: '123456', kind: 'new' }),
    'vol@example.com'
  );
  assert.ok(html.includes('TEST MODE:'));
  assert.ok(html.includes('vol@example.com'));
  // Banner sits inside the body, before the greeting — proving the <body>
  // anchor matched (a no-op replace would leave neither in this order).
  assert.ok(html.indexOf('TEST MODE:') < html.indexOf('Dear Jane,'));
});

test('applyEnrollTestBanner injects into the ineligible template too', () => {
  const html = applyEnrollTestBanner(
    buildEnrollIneligibleTemplate({ firstName: 'Bob' }),
    'member@example.com'
  );
  assert.ok(html.includes('TEST MODE:'));
  assert.ok(html.includes('member@example.com'));
  assert.ok(html.indexOf('TEST MODE:') < html.indexOf('Dear Bob,'));
});
