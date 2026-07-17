const { test } = require('node:test');
const assert = require('node:assert/strict');
const { handleSendPin, isAuthorized } = require('../src/http-listener');

function reqWith(authHeader) {
  return { headers: authHeader === undefined ? {} : { authorization: authHeader } };
}

test('isAuthorized returns false when the key is unset (fail-closed)', () => {
  assert.equal(isAuthorized(reqWith('Bearer whatever'), undefined), false);
  assert.equal(isAuthorized(reqWith('Bearer whatever'), ''), false);
});

test('isAuthorized returns false when the Authorization header is missing', () => {
  assert.equal(isAuthorized(reqWith(undefined), 'secret'), false);
});

test('isAuthorized returns false for a non-bearer scheme', () => {
  assert.equal(isAuthorized(reqWith('Basic secret'), 'secret'), false);
});

test('isAuthorized returns false for a wrong token (incl. length mismatch)', () => {
  assert.equal(isAuthorized(reqWith('Bearer wrong'), 'secret'), false);
  assert.equal(isAuthorized(reqWith('Bearer sec'), 'secret'), false);   // shorter
  assert.equal(isAuthorized(reqWith('Bearer secretxx'), 'secret'), false); // longer
});

test('isAuthorized returns true for an exact bearer match', () => {
  assert.equal(isAuthorized(reqWith('Bearer secret'), 'secret'), true);
});

test('handleSendPin sends the PIN email to the requested address', async () => {
  delete process.env.TEST_RECIPIENTS;
  const calls = [];
  const sendEmailFn = async (msg) => { calls.push(msg); return { success: true, messageId: 'x' }; };
  const result = await handleSendPin({ email: 'vol@example.com', pin: '123456', firstName: 'Jane', kind: 'new' }, sendEmailFn);
  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].to, 'vol@example.com');
  assert.equal(calls[0].subject, 'Your Village Green enrollment PIN');
  assert.ok(calls[0].html.includes('123456'));
  assert.equal(calls[0].kind, 'enroll_pin');
});

test('handleSendPin redirects to TEST_RECIPIENTS when set', async () => {
  process.env.TEST_RECIPIENTS = 'tester@example.com';
  const calls = [];
  const sendEmailFn = async (msg) => { calls.push(msg); return { success: true, messageId: 'x' }; };
  await handleSendPin({ email: 'vol@example.com', pin: '123456', firstName: 'Jane', kind: 'new' }, sendEmailFn);
  assert.equal(calls[0].to, 'tester@example.com');
  assert.ok(calls[0].subject.startsWith('[TEST]'));
  // The test-mode body reports who the PIN was actually intended for.
  assert.ok(calls[0].html.includes('TEST MODE:'));
  assert.ok(calls[0].html.includes('vol@example.com'));
  delete process.env.TEST_RECIPIENTS;
});

test('handleSendPin omits the test banner when not in test mode', async () => {
  delete process.env.TEST_RECIPIENTS;
  const calls = [];
  const sendEmailFn = async (msg) => { calls.push(msg); return { success: true }; };
  await handleSendPin({ email: 'vol@example.com', pin: '123456', firstName: 'Jane', kind: 'new' }, sendEmailFn);
  assert.ok(!calls[0].html.includes('TEST MODE:'));
});

test('handleSendPin rejects a body without email or pin', async () => {
  const calls = [];
  const result = await handleSendPin({ email: 'vol@example.com' }, async (msg) => { calls.push(msg); return { success: true }; });
  assert.equal(result.ok, false);
  assert.equal(calls.length, 0);
});
