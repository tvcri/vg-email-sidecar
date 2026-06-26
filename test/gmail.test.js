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
