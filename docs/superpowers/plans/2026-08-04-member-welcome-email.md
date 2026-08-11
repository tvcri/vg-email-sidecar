# Member Welcome Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Handle the new `member_welcome` notification event: send the customer-approved welcome email (logo letterhead, village-name confirmation sentence) to a newly activated member.

**Architecture:** A payload-driven branch in the polling processor, modeled on the existing `enroll_ineligible` branch: `notification_event` rows carry `eventType='member_welcome'`, `serviceRequestId` NULL, and `payload='{"memberPersonId": N}'`. The sidecar looks the person up at send time (with a new village join on `GET_PERSON`), renders a plain-body template, and sends it with the org logo attached as a CID inline image — the first inline-image email, so `gmail.js` gains optional `multipart/related` support.

**Tech Stack:** Node 24+ (`node --test` runner, `node:assert/strict`), mysql2, googleapis Gmail API. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-04-member-welcome-email-design.md`

## Global Constraints

- Work on the `member-welcome-email` branch (already exists, has the spec commits). Never commit to `main`.
- Subject line, exactly: `Welcome to The Village Common of Rhode Island!` (`[TEST]`-prefixed in test mode).
- Bold sentence: `This email confirms your new membership in <villageName> Village.` — title-case `Village` appended to the bare `village.name`. Fallback when no village: `This email confirms your new membership in your village.` (lowercase — generic, not a proper name).
- Email body ends at the sign-off `The Village Common of Rhode Island` — no signature block: never render "Gabriella", "Member & Volunteer Coordinator", or "ext. 2".
- Logo CID is the string `tvcri-logo`; the `<img>` sits above the greeting.
- `buildRawMessage` without `inlineImages` must produce byte-for-byte the same output as today.
- The producer (VG app inserting the event row) is out of scope; nothing in this plan touches `db.js` or `http-listener.js`.
- Tests run with `npm test` (which runs `node --test`). No DB or network access in tests.

---

### Task 1: Logo asset + Dockerfile

The 1600×843 source JPEG is already saved at `scratch/tvcri-logo-original.jpg` (fetched from the .eml's Gmail-signature URL; `scratch/` is gitignored). Produce the repo-committed email asset and make sure the container image ships it.

**Files:**
- Create: `assets/tvcri-logo.jpg` (binary, committed)
- Modify: `Dockerfile` (add one COPY line after `COPY src ./src`)

**Interfaces:**
- Produces: `assets/tvcri-logo.jpg` — 400px-wide JPEG; Task 5 reads it with `fs.readFileSync(path.join(__dirname, '..', 'assets', 'tvcri-logo.jpg'))` and Task 6 reads it from `path.join(__dirname, 'assets', 'tvcri-logo.jpg')`.

- [ ] **Step 1: Resize the logo**

```bash
mkdir -p assets
magick scratch/tvcri-logo-original.jpg -resize 400x -quality 85 assets/tvcri-logo.jpg
```

- [ ] **Step 2: Verify the result**

Run: `identify assets/tvcri-logo.jpg` (or `file assets/tvcri-logo.jpg`)
Expected: JPEG, 400×211 (400px wide, aspect preserved), well under 50KB.

- [ ] **Step 3: Add the assets directory to the container image**

In `Dockerfile`, immediately after the line `COPY src ./src`, add:

```dockerfile
COPY assets ./assets
```

(The processor loads the logo at require time — a container without `assets/` would crash at startup, so the image must ship it.)

- [ ] **Step 4: Commit**

```bash
git add assets/tvcri-logo.jpg Dockerfile
git commit -m "feat: add resized TVCRI logo asset for welcome email"
```

---

### Task 2: GET_PERSON village join

**Files:**
- Modify: `src/queries.js` (the `GET_PERSON` constant, currently lines 106–110)
- Create: `test/person-query.test.js`

**Interfaces:**
- Produces: `GET_PERSON` rows gain a `villageName` column (string or NULL). `db.getPerson(personId)` therefore resolves to `{ id, fullName, email, phone, cell, villageName }`. Existing callers (volunteer lookups in the confirmed/cancelled/reminder branches) ignore the extra field.

- [ ] **Step 1: Write the failing test**

Create `test/person-query.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { GET_PERSON } = require('../src/queries');

test('person query selects villageName via a left join on village', () => {
  const sql = GET_PERSON;
  assert.match(sql, /v\.name AS villageName/);
  assert.match(sql, /LEFT JOIN village v ON p\.villageId = v\.id/);
  assert.match(sql, /FROM person p/);
  // Existing fields the volunteer-lookup callers rely on are still selected.
  assert.match(sql, /p\.fullName/);
  assert.match(sql, /p\.email/);
  assert.match(sql, /p\.phone/);
  assert.match(sql, /p\.cell/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/person-query.test.js`
Expected: FAIL — `GET_PERSON` has no `villageName` / no join yet.

- [ ] **Step 3: Update the query**

In `src/queries.js`, replace:

```js
const GET_PERSON = `
  SELECT id, fullName, email, phone, cell
  FROM person
  WHERE id = ?
`;
```

with:

```js
// villageName feeds the member_welcome template's bold sentence; NULL when the
// person has no village. LEFT JOIN so volunteer lookups through this query are
// unaffected.
const GET_PERSON = `
  SELECT p.id, p.fullName, p.email, p.phone, p.cell, v.name AS villageName
  FROM person p
  LEFT JOIN village v ON p.villageId = v.id
  WHERE p.id = ?
`;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/person-query.test.js`
Expected: PASS.

Run: `npm test`
Expected: all existing tests still pass (nothing else asserts on `GET_PERSON`).

- [ ] **Step 5: Commit**

```bash
git add src/queries.js test/person-query.test.js
git commit -m "feat: include villageName in GET_PERSON via village join"
```

---

### Task 3: Inline-image (CID) support in gmail.js

**Files:**
- Modify: `src/gmail.js` (`buildRawMessage`, `sendEmail`, `module.exports`)
- Modify: `test/gmail.test.js` (append new tests)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `sendEmail({ to, bcc, subject, html, kind, inlineImages })` and exported `buildRawMessage({ to, bcc, subject, html, from, inlineImages })`. `inlineImages` is an optional array of `{ cid: string, contentType: string, content: string /* base64 */ }`. Task 5 calls `sendEmail` with `inlineImages: [{ cid: 'tvcri-logo', contentType: 'image/jpeg', content: <base64> }]`.

- [ ] **Step 1: Write the failing tests**

Append to `test/gmail.test.js`:

```js
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
```

Note: `freshGmail()` is already defined at the top of this test file. These tests never call `sendEmail`, so no SA key or network is involved — but `buildRawMessage` must be exported for them to see it (Step 3).

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/gmail.test.js`
Expected: the three new tests FAIL (`buildRawMessage` is not exported); the four existing tests still pass.

- [ ] **Step 3: Implement**

In `src/gmail.js`, replace the whole `buildRawMessage` function with:

```js
function buildRawMessage({ to, bcc, subject, html, from, inlineImages }) {
  // Gmail requires a recipient somewhere (To, Cc, or Bcc) — not specifically a
  // To: header. When `to` is omitted we send a "blind" message carried by Bcc:
  // and leave out To: entirely, so guard against the no-recipient case.
  if (!to && !bcc) {
    throw new Error('buildRawMessage requires either a "to" or "bcc" recipient');
  }

  const headers = [
    `From: ${from}`,
    ...(to ? [`To: ${to}`] : []),
    ...(bcc ? [`Bcc: ${bcc}`] : []),
    `Subject: ${encodeHeader(subject)}`,
    'MIME-Version: 1.0',
  ];

  let messageParts;
  if (!inlineImages || inlineImages.length === 0) {
    messageParts = [
      ...headers,
      'Content-Type: text/html; charset=UTF-8',
      '',
      html,
    ];
  } else {
    // multipart/related: the HTML part first, then each image part referenced
    // from the HTML by cid:. A fixed boundary is safe — every part we emit is
    // base64 or our own HTML, neither of which contains the marker.
    const boundary = 'vg-sidecar-related-8c4f1d2e';
    messageParts = [
      ...headers,
      `Content-Type: multipart/related; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      '',
      html,
      ...inlineImages.flatMap((img) => [
        `--${boundary}`,
        `Content-Type: ${img.contentType}`,
        'Content-Transfer-Encoding: base64',
        `Content-ID: <${img.cid}>`,
        `Content-Disposition: inline; filename="${img.cid}"`,
        '',
        // RFC 2045 asks for encoded lines of at most 76 characters.
        img.content.match(/.{1,76}/g).join('\r\n'),
      ]),
      `--${boundary}--`,
    ];
  }

  const message = messageParts.join('\r\n');

  return Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
```

In `sendEmail`, add `inlineImages` to the destructured parameter and pass it through:

```js
async function sendEmail({ to, bcc, subject, html, kind, inlineImages }) {
```

and inside, the `buildRawMessage` call becomes:

```js
    const raw = buildRawMessage({
      to,
      bcc,
      subject,
      html,
      from: `${getMailboxDisplayName(mailbox)} <${mailbox}>`,
      inlineImages,
    });
```

Change the export line to:

```js
module.exports = { sendEmail, verifyCredentials, buildRawMessage };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/gmail.test.js`
Expected: all tests PASS (three new + four pre-existing).

- [ ] **Step 5: Commit**

```bash
git add src/gmail.js test/gmail.test.js
git commit -m "feat: optional CID inline images in buildRawMessage (multipart/related)"
```

---

### Task 4: Welcome template

**Files:**
- Modify: `src/templates.js` (new builder after `buildEnrollIneligibleTemplate`, ~line 1636; add to `module.exports`)
- Create: `test/member-welcome-template.test.js`

**Interfaces:**
- Consumes: nothing from other tasks (the `cid:tvcri-logo` reference is satisfied at send time by Task 5 and at preview time by Task 6).
- Produces: `buildMemberWelcomeTemplate({ firstName, villageName })` → HTML string. Exported from `src/templates.js`.

- [ ] **Step 1: Write the failing tests**

Create `test/member-welcome-template.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildMemberWelcomeTemplate, applyEnrollTestBanner } = require('../src/templates');

test('welcome template renders greeting, approved copy, and sign-off', () => {
  const html = buildMemberWelcomeTemplate({ firstName: 'Zelda', villageName: 'Wood River' });
  assert.ok(html.includes('Dear Zelda,'));
  assert.ok(html.includes('Welcome to The Village Common of Rhode Island!'));
  assert.ok(html.includes('Your membership has been activated by our membership coordinator based on your completed application.'));
  assert.ok(html.includes('<b>This email confirms your new membership in Wood River Village.</b>'));
  assert.ok(html.includes('<a href="http://www.villagecommonri.org">www.villagecommonri.org</a>'));
  assert.ok(html.includes('401-228-8683'));
  assert.ok(html.includes('We hope to see you soon!'));
  assert.ok(html.includes('The Village Common of Rhode Island'));
});

test('welcome template greets generically without a first name', () => {
  const html = buildMemberWelcomeTemplate({ firstName: null, villageName: 'Barrington' });
  assert.ok(html.includes('Hello,'));
});

test('welcome template renders the logo exactly once, above the greeting', () => {
  const html = buildMemberWelcomeTemplate({ firstName: 'Zelda', villageName: 'Wood River' });
  const occurrences = html.split('src="cid:tvcri-logo"').length - 1;
  assert.equal(occurrences, 1);
  assert.ok(html.indexOf('cid:tvcri-logo') < html.indexOf('Dear Zelda,'));
});

test('welcome template falls back to generic village wording', () => {
  const html = buildMemberWelcomeTemplate({ firstName: 'Zelda', villageName: null });
  assert.ok(html.includes('<b>This email confirms your new membership in your village.</b>'));
  assert.ok(!html.includes('null'));
});

test('welcome template has no signature block', () => {
  const html = buildMemberWelcomeTemplate({ firstName: 'Zelda', villageName: 'Wood River' });
  assert.ok(!html.includes('Gabriella'));
  assert.ok(!html.includes('Member & Volunteer Coordinator'));
  assert.ok(!html.includes('ext. 2'));
});

test('enroll test banner injects into the welcome template', () => {
  const html = applyEnrollTestBanner(
    buildMemberWelcomeTemplate({ firstName: 'Zelda', villageName: 'Wood River' }),
    'zelda@example.com'
  );
  assert.ok(html.includes('TEST MODE:'));
  assert.ok(html.includes('zelda@example.com'));
  assert.ok(html.indexOf('TEST MODE:') < html.indexOf('Dear Zelda,'));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/member-welcome-template.test.js`
Expected: FAIL — `buildMemberWelcomeTemplate` is not a function.

- [ ] **Step 3: Implement the builder**

In `src/templates.js`, after `buildEnrollIneligibleTemplate` (ends ~line 1636), add:

```js
// New-member welcome/confirmation email. Approved customer copy 2026-07-13
// with two 2026-08-04 corrections: the personal signature block is removed
// (the body ends at the sign-off line), and the bold sentence names the
// member's village ("membership in Wood River Village."), falling back to the
// generic "your village" when the member has none. The logo renders at the
// top, letterhead-style, as a CID inline image the send path attaches — see
// the member_welcome branch in email-processor.js.
function buildMemberWelcomeTemplate({ firstName, villageName }) {
  const greeting = firstName ? `Dear ${firstName},` : 'Hello,';
  const membershipPlace = villageName ? `${villageName} Village` : 'your village';
  return `<html>
<body style="font-family:Arial, Sans-Serif; font-size:12px; font-weight:normal;">
  <p><img src="cid:tvcri-logo" width="200" alt="The Village Common of Rhode Island &mdash; Aging Better Together!"></p>
  <p>${greeting}</p>
  <p>Welcome to The Village Common of Rhode Island!</p>
  <p>Your membership has been activated by our membership coordinator based on your completed application.</p>
  <p><b>This email confirms your new membership in ${membershipPlace}.</b></p>
  <p>To access our website, visit <a href="http://www.villagecommonri.org">www.villagecommonri.org</a>. This is where you can find information on upcoming events and other programming.</p>
  <p>If you have any questions about the membership process, please contact our office at 401-228-8683.</p>
  <p>We hope to see you soon!</p>
  <p>The Village Common of Rhode Island</p>
</body>
</html>`;
}
```

Add `buildMemberWelcomeTemplate,` to the `module.exports` object at the bottom of the file (it starts at ~line 1871).

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/member-welcome-template.test.js`
Expected: all PASS. (The banner test passes because `applyEnrollTestBanner` anchors on the `<body>` tag, which this template has.)

- [ ] **Step 5: Commit**

```bash
git add src/templates.js test/member-welcome-template.test.js
git commit -m "feat: member welcome email template"
```

---

### Task 5: member_welcome send branch

**Files:**
- Modify: `src/email-processor.js` (imports at top; new branch in `pollOnce` directly after the `enroll_ineligible` branch, which ends ~line 454)
- Modify: `src/config.js` (stale comment, lines 5–7)
- Modify: `README.md` (new event-type section after the `reminder` section, before "Unknown event types are marked failed." ~line 120)

**Interfaces:**
- Consumes: `buildMemberWelcomeTemplate({ firstName, villageName })` (Task 4); `sendEmail({ to, subject, html, kind, inlineImages })` (Task 3); `getPerson(personId)` resolving `{ id, fullName, email, phone, cell, villageName }` (Task 2); `assets/tvcri-logo.jpg` (Task 1).
- Produces: the running sidecar handles `eventType='member_welcome'` rows.

- [ ] **Step 1: Add imports and the logo constant**

In `src/email-processor.js`:

At the top of the file (before the existing `require` block), add:

```js
const fs = require('fs');
const path = require('path');
```

Add `buildMemberWelcomeTemplate,` to the existing destructured `require('./templates')` list (alongside `buildEnrollIneligibleTemplate`).

After the `require` block (below `SERVICE_TYPE_TO_CAPABILITY` is fine, but directly after the requires is clearest), add:

```js
// Logo attached inline to member_welcome emails (see buildMemberWelcomeTemplate,
// which references it as cid:tvcri-logo). Loaded once at require time: the file
// is small, static, and ships in the image (Dockerfile COPYs assets/), so a
// missing file is a broken deployment and should fail fast at startup.
const WELCOME_LOGO = {
  cid: 'tvcri-logo',
  contentType: 'image/jpeg',
  content: fs.readFileSync(path.join(__dirname, '..', 'assets', 'tvcri-logo.jpg')).toString('base64'),
};
```

- [ ] **Step 2: Add the branch**

In `pollOnce`, directly after the `enroll_ineligible` branch's closing `continue;` + `}` (~line 454) and before `const requestData = await getServiceRequest(...)`, add:

```js
      if (event.eventType === 'member_welcome') {
        // Payload-driven event: no service request. Enqueued by the VG app
        // when the membership coordinator activates a membership.
        const payload = typeof event.payload === 'string'
          ? JSON.parse(event.payload)
          : (event.payload || {});
        if (!payload.memberPersonId) {
          console.error(`member_welcome event #${event.id} has no payload memberPersonId`);
          await markNotificationFailed(event.id);
          failed++;
          continue;
        }
        // Look the person up at send time so the email uses fresh name/email
        // (and the village for the confirmation sentence).
        const person = await getPerson(payload.memberPersonId);
        if (!person || !person.email) {
          console.error(`member_welcome event #${event.id}: person ${payload.memberPersonId} not found or has no email`);
          await markNotificationFailed(event.id);
          failed++;
          continue;
        }
        const testConfig = getTestConfig();
        const to = testConfig.overrideRecipients ? testConfig.overrideRecipients.join(', ') : person.email;
        const subject = buildSubject('Welcome to The Village Common of Rhode Island!', !!testConfig.overrideRecipients);
        let html = buildMemberWelcomeTemplate({
          firstName: getFirstName(person.fullName),
          villageName: person.villageName,
        });
        if (testConfig.overrideRecipients) {
          html = applyEnrollTestBanner(html, person.email);
        }
        const result = await sendEmail({ to, subject, html, kind: event.eventType, inlineImages: [WELCOME_LOGO] });
        if (result.success) {
          console.log(`[${new Date().toISOString()}] Member welcome email sent to person #${person.id}`);
          await markNotificationSent(event.id, [person.id]);
          sent++;
        } else {
          console.error(`[${new Date().toISOString()}] Failed to send member welcome email: ${result.error}`);
          await markNotificationFailed(event.id);
          failed++;
        }
        continue;
      }
```

(`getPerson`, `getTestConfig`, `buildSubject`, `getFirstName`, `applyEnrollTestBanner`, and `sendEmail` are all already imported/defined in this file.)

- [ ] **Step 3: Update the stale config comment**

In `src/config.js`, the comment above `MAILBOX_BY_KIND` currently ends with:

```js
// (enroll_pin is the webhook PIN send). member_welcome is reserved for a
// planned event type that has no handler yet. Unlisted kinds -> DEFAULT_MAILBOX.
```

Replace those two lines with:

```js
// (enroll_pin is the webhook PIN send). Unlisted kinds -> DEFAULT_MAILBOX.
```

- [ ] **Step 4: Document the event type in README.md**

In `README.md`, after the `reminder` section and immediately before the line `Unknown event types are marked failed.` (~line 120), add:

```markdown
### `member_welcome` — membership activated

Payload-driven (no service request): the row carries `serviceRequestId` NULL
and `payload = '{"memberPersonId": <person.id>}'`, inserted by the VG app when
the membership coordinator activates a membership (requires the migration-0017
`payload` column). The sidecar looks the person up at send time and emails
them the approved welcome/confirmation copy — the org logo at top (attached
as a CID inline image), and a bold sentence naming the member's village
("…membership in Wood River Village."). Sent from
`volunteer@villagecommonri.org`. Subject:
`Welcome to The Village Common of Rhode Island!`. A person with no email (or
a payload with no `memberPersonId`) marks the event failed.
```

- [ ] **Step 5: Run the full suite and a syntax check**

Run: `npm test`
Expected: all tests pass — this task adds no unit tests (the branch lives in `pollOnce`, which the repo does not unit-test; no mocking harness), but the suite loads `email-processor.js`, so it proves the new module-scope asset load and imports don't throw.

Run: `node --check src/email-processor.js && node --check src/config.js`
Expected: no output (clean parse).

- [ ] **Step 6: Commit**

```bash
git add src/email-processor.js src/config.js README.md
git commit -m "feat: handle member_welcome events with welcome email"
```

---

### Task 6: Preview page + final verification

**Files:**
- Modify: `preview-templates.js`

**Interfaces:**
- Consumes: `buildMemberWelcomeTemplate` (Task 4), `assets/tvcri-logo.jpg` (Task 1).
- Produces: `preview/member-welcome.html` for browser/customer review.

- [ ] **Step 1: Wire the template into the preview script**

In `preview-templates.js`:

Add `buildMemberWelcomeTemplate,` to the destructured `require('./src/templates')` list.

Before the `renders` array, add:

```js
// The email references the logo as a CID inline attachment; browsers can't
// resolve cid:, so the preview substitutes a data URI of the same asset.
const logoDataUri = 'data:image/jpeg;base64,' +
  fs.readFileSync(path.join(__dirname, 'assets', 'tvcri-logo.jpg')).toString('base64');
```

At the end of the `renders` array, add:

```js
  // New-member welcome/confirmation email (member_welcome events).
  ['member-welcome.html', buildMemberWelcomeTemplate({ firstName: 'Zelda', villageName: 'Wood River' })
    .replace('cid:tvcri-logo', logoDataUri)],
  ['member-welcome-no-village.html', buildMemberWelcomeTemplate({ firstName: 'Zelda', villageName: null })
    .replace('cid:tvcri-logo', logoDataUri)],
```

- [ ] **Step 2: Generate and inspect the previews**

Run: `node preview-templates.js`
Expected: output lists `Wrote .../preview/member-welcome.html` and `member-welcome-no-village.html` among the rest.

Open `preview/member-welcome.html` in a browser (or render it): logo at top at 200px, then the greeting and approved copy, bold sentence reading "…membership in Wood River Village.", ending at the sign-off with no signature block. The no-village variant reads "…membership in your village."

- [ ] **Step 3: Run the full test suite one last time**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add preview-templates.js
git commit -m "feat: preview pages for member welcome email"
```

---

## Out of scope (deliberately)

- The VG-app producer (the INSERT on membership activation) — separate work in the village-green repo against the event contract in the spec.
- Unit tests for the `pollOnce` branch — the repo has no mocking harness for it; end-to-end verification is a `TEST_RECIPIENTS` run against the dev DB before go-live.
- The README `reminder` section's stale "never the member" wording (outdated since PR #14) — pre-existing, not this feature's edit.
