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

// buildRawMessage returns base64url; decode it to assert on MIME structure.
function decodeRaw(raw) {
  return Buffer.from(raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

test('buildRawMessage without inlineImages is single-part text/html', () => {
  const { buildRawMessage } = freshGmail();
  const msg = decodeRaw(buildRawMessage({
    to: 'member@example.com',
    subject: 'Hello',
    html: '<html><body>hi</body></html>',
    from: 'The Village Common of RI <services@villagecommonri.org>',
  }));
  assert.ok(msg.includes('Content-Type: text/html; charset=UTF-8'));
  assert.ok(!msg.includes('multipart/related'));
  assert.ok(!msg.includes('Content-ID'));
});

test('buildRawMessage with inlineImages builds multipart/related with a CID part', () => {
  const { buildRawMessage } = freshGmail();
  const msg = decodeRaw(buildRawMessage({
    to: 'member@example.com',
    subject: 'Hello',
    html: '<html><body><img src="cid:tvcri-logo"></body></html>',
    from: 'The Village Common of RI <volunteer@villagecommonri.org>',
    inlineImages: [{
      cid: 'tvcri-logo',
      contentType: 'image/jpeg',
      content: Buffer.from('fake-jpeg-bytes').toString('base64'),
    }],
  }));
  assert.match(msg, /Content-Type: multipart\/related; boundary="[^"]+"/);
  assert.ok(msg.includes('Content-Type: text/html; charset=UTF-8'));
  assert.ok(msg.includes('Content-Type: image/jpeg'));
  assert.ok(msg.includes('Content-Transfer-Encoding: base64'));
  assert.ok(msg.includes('Content-ID: <tvcri-logo>'));
  assert.ok(msg.includes('Content-Disposition: inline'));
  assert.ok(msg.includes(Buffer.from('fake-jpeg-bytes').toString('base64')));
  // HTML part comes before the image part; message ends with the closing boundary.
  assert.ok(msg.indexOf('text/html') < msg.indexOf('image/jpeg'));
  const boundary = msg.match(/boundary="([^"]+)"/)[1];
  assert.ok(msg.trimEnd().endsWith(`--${boundary}--`));
});

test('buildRawMessage with an empty inlineImages array stays single-part', () => {
  const { buildRawMessage } = freshGmail();
  const msg = decodeRaw(buildRawMessage({
    to: 'member@example.com',
    subject: 'Hello',
    html: '<html><body>hi</body></html>',
    from: 'The Village Common of RI <services@villagecommonri.org>',
    inlineImages: [],
  }));
  assert.ok(msg.includes('Content-Type: text/html; charset=UTF-8'));
  assert.ok(!msg.includes('multipart/related'));
});
