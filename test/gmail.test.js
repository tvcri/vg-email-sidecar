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

test('verifyCredentials throws when token file is missing', async () => {
  process.env.GMAIL_TOKEN_PATH = '/nonexistent/path/token.json';
  delete require.cache[require.resolve('../src/gmail.js')];
  delete require.cache[require.resolve('../src/config.js')];
  const { verifyCredentials } = require('../src/gmail.js');

  await assert.rejects(
    () => verifyCredentials(),
    (err) => {
      assert.match(err.message, /ENOENT/);
      return true;
    }
  );

  delete process.env.GMAIL_TOKEN_PATH;
});

test('verifyCredentials warns but resolves when Gmail API rejects the token', async () => {
  const TEMP_TOKEN2 = path.join(require('os').tmpdir(), 'test-token2.json');
  fs.writeFileSync(TEMP_TOKEN2, JSON.stringify({
    client_id: 'id',
    client_secret: 'secret',
    refresh_token: 'bad-refresh',
  }));
  process.env.GMAIL_TOKEN_PATH = TEMP_TOKEN2;

  delete require.cache[require.resolve('../src/gmail.js')];
  delete require.cache[require.resolve('../src/config.js')];

  const googleapis = require('googleapis');
  const origGmail = googleapis.google.gmail.bind(googleapis.google);
  googleapis.google.gmail = () => ({
    users: {
      getProfile: async () => { throw new Error('invalid_grant'); },
    },
  });

  const { verifyCredentials } = require('../src/gmail.js');

  const warnings = [];
  const origWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));

  const result = await verifyCredentials();
  assert.equal(result, false, 'expected false on API failure');

  assert.ok(warnings.some(w => w.includes('invalid_grant')), 'expected warning about API failure');

  console.warn = origWarn;
  googleapis.google.gmail = origGmail;
  fs.unlinkSync(TEMP_TOKEN2);
  delete process.env.GMAIL_TOKEN_PATH;
});
