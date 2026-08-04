const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const { buildMemberWelcomeTemplate } = require('../src/templates');

function freshGmail() {
  delete require.cache[require.resolve('../src/gmail.js')];
  delete require.cache[require.resolve('../src/config.js')];
  return require('../src/gmail.js');
}

// buildRawMessage returns base64url; decode it to assert on MIME structure.
function decodeRaw(raw) {
  return Buffer.from(raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

// The real send path (src/email-processor.js WELCOME_LOGO) attaches the logo
// under this literal cid. That is the "emitted Content-ID" side of the seam;
// the template side below is parsed out of the real rendered HTML, not
// hardcoded, so the test fails if either side is renamed independently.
const SEND_PATH_LOGO_CID = 'tvcri-logo';

test('welcome template cid matches the Content-ID emitted for the real logo attachment', () => {
  const html = buildMemberWelcomeTemplate({ firstName: 'Zelda', villageName: 'Wood River' });

  // Derive the cid from the real rendered template — not a hardcoded literal.
  const match = html.match(/src="cid:([^"]+)"/);
  assert.ok(match, 'expected an <img src="cid:..."> reference in the welcome template');
  const templateCid = match[1];

  // This is the actual seam: the template's cid must equal the cid the send
  // path attaches the logo under.
  assert.equal(templateCid, SEND_PATH_LOGO_CID);

  const { buildRawMessage } = freshGmail();
  const logoBuffer = fs.readFileSync(path.join(__dirname, '..', 'assets', 'tvcri-logo.jpg'));

  const msg = decodeRaw(buildRawMessage({
    to: 'member@example.com',
    subject: 'Welcome',
    html,
    from: 'The Village Common of RI <services@villagecommonri.org>',
    inlineImages: [{
      cid: SEND_PATH_LOGO_CID,
      contentType: 'image/jpeg',
      content: logoBuffer.toString('base64'),
    }],
  }));

  assert.ok(
    msg.includes(`Content-ID: <${templateCid}>`),
    `expected message to contain Content-ID: <${templateCid}>`
  );
});
