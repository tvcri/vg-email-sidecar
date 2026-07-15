const { test } = require('node:test');
const assert = require('node:assert/strict');
const { handleSendPin } = require('../src/http-listener');

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
  delete process.env.TEST_RECIPIENTS;
});

test('handleSendPin rejects a body without email or pin', async () => {
  const calls = [];
  const result = await handleSendPin({ email: 'vol@example.com' }, async (msg) => { calls.push(msg); return { success: true }; });
  assert.equal(result.ok, false);
  assert.equal(calls.length, 0);
});
