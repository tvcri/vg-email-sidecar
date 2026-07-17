const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const TEMP_KEY = path.join(require('os').tmpdir(), 'test-sa-key.json');

function freshGmail() {
  delete require.cache[require.resolve('../src/gmail.js')];
  delete require.cache[require.resolve('../src/config.js')];
  return require('../src/gmail.js');
}

test('sendEmail is exported when the SA key path is configured', () => {
  fs.writeFileSync(TEMP_KEY, JSON.stringify({
    client_email: 'mailer@project.iam.gserviceaccount.com',
    private_key: '-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----\n',
  }));
  process.env.GMAIL_SA_KEY_PATH = TEMP_KEY;

  const { sendEmail } = freshGmail();
  assert.equal(typeof sendEmail, 'function');

  fs.unlinkSync(TEMP_KEY);
  delete process.env.GMAIL_SA_KEY_PATH;
});

test('verifyCredentials throws when the key file is missing', () => {
  process.env.GMAIL_SA_KEY_PATH = '/nonexistent/path/sa-key.json';
  const { verifyCredentials } = freshGmail();

  assert.throws(
    () => verifyCredentials(),
    (err) => {
      assert.match(err.message, /ENOENT/);
      return true;
    }
  );

  delete process.env.GMAIL_SA_KEY_PATH;
});

test('verifyCredentials warns and returns false when key fields are missing', () => {
  fs.writeFileSync(TEMP_KEY, JSON.stringify({ client_email: 'mailer@project.iam.gserviceaccount.com' }));
  process.env.GMAIL_SA_KEY_PATH = TEMP_KEY;
  const { verifyCredentials } = freshGmail();

  const warnings = [];
  const origWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));

  const result = verifyCredentials();
  assert.equal(result, false);
  assert.ok(warnings.some(w => w.includes('private_key')));

  console.warn = origWarn;
  fs.unlinkSync(TEMP_KEY);
  delete process.env.GMAIL_SA_KEY_PATH;
});

test('verifyCredentials returns true when all required fields are present', () => {
  fs.writeFileSync(TEMP_KEY, JSON.stringify({
    client_email: 'mailer@project.iam.gserviceaccount.com',
    private_key: '-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----\n',
  }));
  process.env.GMAIL_SA_KEY_PATH = TEMP_KEY;
  const { verifyCredentials } = freshGmail();

  assert.equal(verifyCredentials(), true);

  fs.unlinkSync(TEMP_KEY);
  delete process.env.GMAIL_SA_KEY_PATH;
});
