const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const TEMP_TOKEN = path.join(require('os').tmpdir(), 'test-token.json');

test('buildAuthClient reads token path from getGmailConfig()', () => {
  fs.writeFileSync(TEMP_TOKEN, JSON.stringify({
    client_id: 'id',
    client_secret: 'secret',
    refresh_token: 'refresh',
  }));
  process.env.GMAIL_TOKEN_PATH = TEMP_TOKEN;

  delete require.cache[require.resolve('../src/gmail.js')];
  delete require.cache[require.resolve('../src/config.js')];
  const { sendEmail } = require('../src/gmail.js');

  assert.equal(typeof sendEmail, 'function');

  fs.unlinkSync(TEMP_TOKEN);
  delete process.env.GMAIL_TOKEN_PATH;
});

test('verifyCredentials throws when token file is missing', () => {
  process.env.GMAIL_TOKEN_PATH = '/nonexistent/path/token.json';
  delete require.cache[require.resolve('../src/gmail.js')];
  delete require.cache[require.resolve('../src/config.js')];
  const { verifyCredentials } = require('../src/gmail.js');

  assert.throws(
    () => verifyCredentials(),
    (err) => {
      assert.match(err.message, /ENOENT/);
      return true;
    }
  );

  delete process.env.GMAIL_TOKEN_PATH;
});

test('verifyCredentials warns and returns false when token file is missing required fields', () => {
  const TEMP_TOKEN2 = path.join(require('os').tmpdir(), 'test-token2.json');
  fs.writeFileSync(TEMP_TOKEN2, JSON.stringify({ client_id: 'id' }));
  process.env.GMAIL_TOKEN_PATH = TEMP_TOKEN2;

  delete require.cache[require.resolve('../src/gmail.js')];
  delete require.cache[require.resolve('../src/config.js')];
  const { verifyCredentials } = require('../src/gmail.js');

  const warnings = [];
  const origWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));

  const result = verifyCredentials();
  assert.equal(result, false);
  assert.ok(warnings.some(w => w.includes('client_secret') && w.includes('refresh_token')));

  console.warn = origWarn;
  fs.unlinkSync(TEMP_TOKEN2);
  delete process.env.GMAIL_TOKEN_PATH;
});

test('verifyCredentials returns true when all required fields are present', () => {
  const TEMP_TOKEN3 = path.join(require('os').tmpdir(), 'test-token3.json');
  fs.writeFileSync(TEMP_TOKEN3, JSON.stringify({
    client_id: 'id',
    client_secret: 'secret',
    refresh_token: 'refresh',
  }));
  process.env.GMAIL_TOKEN_PATH = TEMP_TOKEN3;

  delete require.cache[require.resolve('../src/gmail.js')];
  delete require.cache[require.resolve('../src/config.js')];
  const { verifyCredentials } = require('../src/gmail.js');

  const result = verifyCredentials();
  assert.equal(result, true);

  fs.unlinkSync(TEMP_TOKEN3);
  delete process.env.GMAIL_TOKEN_PATH;
});
