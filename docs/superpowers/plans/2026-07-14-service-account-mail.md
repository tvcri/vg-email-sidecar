# Service-Account Mail (Multi-Mailbox Sending) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the per-account OAuth2 refresh-token Gmail auth with a domain-wide-delegated service account (`google.auth.JWT` + `subject`), so the sidecar can send each message kind from its assigned mailbox without callers tracking mailboxes.

**Architecture:** Two behavior-isolated phases. Task 1 swaps auth only — every send still comes from `services@` — so an auth failure can't be confused with a routing failure. Task 2 adds a message-kind → mailbox map (policy in `config.js`), a `kind` parameter on `sendEmail`, and a per-mailbox JWT client cache (a JWT client's `subject` is fixed at construction). Task 3 amends the not-yet-executed volunteer-enrollment plan in the village-green repo so its new send paths are written against the new signature.

**Tech Stack:** `googleapis` (already a dependency — `google.auth.JWT` ships with it), node:test, CommonJS.

## Global Constraints

- **Repo:** `/home/csmig/dev/tvcri/vg-email-sidecar`. Branch: `service-account-mail`, cut from `main` (NOT from `wall-clock-times`, which carries unrelated WIP). Task 3 edits one file in `/home/csmig/dev/village-green`.
- **Tests:** `npm test` (node --test) from the repo root.
- **Prerequisite (done):** service account exists with domain-wide delegation for scope `https://www.googleapis.com/auth/gmail.send`; the user holds the key JSON. The executor needs the user to state the key file's path once (Task 1 Step 5); it is a secret — **never commit it, never print its contents**.
- **Mailbox assignments (customer-confirmed 2026-07-14, fixed constants):**
  - `open`, `confirmed`, `cancelled`, `reminder` → `services@villagecommonri.org`
  - `enroll_pin`, `enroll_ineligible` (enrollment feature, pending) → `village-green@villagecommonri.org`
  - `member_welcome` (reserved; event type not yet designed) → `volunteer@villagecommonri.org`
  - Anything unmapped → `services@villagecommonri.org`
- **The refresh-token path is retired in Task 1** (no dual-auth fallback period): `GMAIL_TOKEN_PATH` and `services-mailer-token.json` handling are removed once the SA send is verified.
- **Real-send verifications** in this plan send only to the developer's own address — `TEST_RECIPIENTS` protection is a recipient-resolution concern above `sendEmail` and does not apply to direct `sendEmail` calls.
- **Commit format:** plain `feat:` / `refactor:` (sidecar convention).

## Design Decisions

1. **Callers pass a message `kind`, never a mailbox.** `sendEmail({ to, bcc, subject, html, kind })` resolves the mailbox internally via the config map. Omitted/unknown `kind` → `services@`, which keeps the one-off scripts (`send-corrections.js`, `send-apology.js`) working unchanged.
2. **Policy lives in `config.js`** (`MAILBOX_BY_KIND`, display names); `gmail.js` stays mechanism-only (JWT cache, MIME building, send).
3. **`userId: 'me'` is unchanged** — with impersonation, `'me'` resolves to the JWT's `subject`.
4. **Display names:** `services@` and `volunteer@` present as `The Village Common of RI` (today's name); `village-green@` presents as `Village Green`. One-line change in the map if the customer wants different wording.
5. **`member_welcome` is a reserved map entry only.** No event handling is added; an actual `member_welcome` row would still be marked failed by the unknown-type branch, which is correct until that feature is designed.
6. **Env var `GMAIL_SA_KEY_PATH`** (default `./vg-mailer-sa-key.json`) replaces `GMAIL_TOKEN_PATH`, mirroring the old pattern.

## File Structure

- Modify: `src/config.js` — `getGmailConfig` → `saKeyPath`; add mailbox map + lookups (Task 2)
- Modify: `src/gmail.js` — JWT auth + client cache (Task 1); `kind` resolution + From header (Task 2)
- Modify: `src/email-processor.js` — pass `kind: event.eventType` at each send site (Task 2)
- Modify: `test/gmail.test.js` — rewrite credential tests for the SA key file (Task 1)
- Create: `test/mailbox-config.test.js` — map lookup tests (Task 2)
- Modify: `.gitignore`, `.env.example` (Task 1)
- Modify (other repo): `/home/csmig/dev/village-green/scratch/superpowers/plans/2026-07-14-volunteer-enrollment.md` (Task 3)

---

### Task 1: JWT auth swap — behavior-neutral, everything still from `services@`

**Files:**
- Modify: `src/gmail.js`
- Modify: `src/config.js` (only `getGmailConfig`)
- Modify: `test/gmail.test.js`
- Modify: `.gitignore`, `.env.example`

**Interfaces:**
- Consumes: `GMAIL_SA_KEY_PATH` env var → service-account key JSON containing `client_email` and `private_key`
- Produces: `sendEmail({ to, bcc, subject, html })` (signature unchanged this task) sending as `services@` via JWT; `verifyCredentials()` validating the SA key file; internal `getAuthClient(mailbox)` cache that Task 2 reuses

- [ ] **Step 1: Create the branch and confirm a clean baseline**

```bash
cd /home/csmig/dev/tvcri/vg-email-sidecar
git checkout main && git pull && git checkout -b service-account-mail
npm test
```
Expected: existing tests pass.

- [ ] **Step 2: Rewrite the credential tests (failing first)**

Replace the entire contents of `test/gmail.test.js` (all four existing tests concern the retired token file; the require-cache-busting pattern is kept):

```js
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `verifyCredentials` still checks `client_id`/`client_secret`/`refresh_token`, and `getGmailConfig` has no `saKeyPath`.

- [ ] **Step 4: Implement the swap**

In `src/config.js`, replace `getGmailConfig`:
```js
function getGmailConfig() {
  return {
    saKeyPath: process.env.GMAIL_SA_KEY_PATH || './vg-mailer-sa-key.json',
  };
}
```
(The old `fromAddress`/`fromName` fields were duplicates of constants in `gmail.js`; grep for `fromAddress|fromName` first — as of planning, nothing consumes them — and drop them.)

In `src/gmail.js`, replace the auth section (everything above `encodeHeader` plus `verifyCredentials` and the `sendEmail` auth line):
```js
const fs = require('fs');
const { google } = require('googleapis');
const { getGmailConfig } = require('./config');

const FROM_ADDRESS = 'services@villagecommonri.org';
const FROM_NAME = 'The Village Common of RI';
const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';

// One JWT client per impersonated mailbox: subject is fixed at construction.
// Domain-wide delegation lets the service account send as any domain mailbox.
const authClients = new Map();

function buildAuthClient(mailbox) {
  const { saKeyPath } = getGmailConfig();
  const { client_email, private_key } = JSON.parse(
    fs.readFileSync(saKeyPath, 'utf8')
  );
  return new google.auth.JWT({
    email: client_email,
    key: private_key,
    scopes: [GMAIL_SEND_SCOPE],
    subject: mailbox,
  });
}

function getAuthClient(mailbox) {
  if (!authClients.has(mailbox)) {
    authClients.set(mailbox, buildAuthClient(mailbox));
  }
  return authClients.get(mailbox);
}
```

Replace `verifyCredentials`:
```js
function verifyCredentials() {
  const { saKeyPath } = getGmailConfig();
  const key = JSON.parse(fs.readFileSync(saKeyPath, 'utf8')); // throws if missing/unreadable
  const missing = ['client_email', 'private_key'].filter(k => !key[k]);
  if (missing.length > 0) {
    console.warn(`Service-account key file is missing required fields: ${missing.join(', ')}`);
    return false;
  }
  return true;
}
```

In `sendEmail`, change only the auth line:
```js
    const auth = getAuthClient(FROM_ADDRESS);
```
(`encodeHeader`, `buildRawMessage`, the rest of `sendEmail`, and `module.exports` are unchanged. With impersonation, `userId: 'me'` resolves to the JWT `subject`.)

Housekeeping:
- `.gitignore`: replace the `services-mailer-token.json` line with:
  ```
  vg-mailer-sa-key.json
  *-sa-key.json
  ```
- `.env.example`: replace the `GMAIL_TOKEN_PATH` block with:
  ```
  # Gmail Configuration
  # Path to the service-account key JSON (client_email, private_key). The SA has
  # domain-wide delegation for gmail.send and impersonates the sending mailbox.
  GMAIL_SA_KEY_PATH=./vg-mailer-sa-key.json
  ```

- [ ] **Step 5: Place the real key and update the local `.env` (user input needed once)**

Ask the user for the SA key JSON's location; copy or reference it and set `GMAIL_SA_KEY_PATH` in the (gitignored) `.env`, replacing `GMAIL_TOKEN_PATH`. Confirm the key file is NOT tracked: `git status --porcelain` must not list it.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Real-send verification as `services@`**

```bash
node -e "
require('dotenv/config');
const { sendEmail } = require('./src/gmail');
sendEmail({ to: 'carlsmigielski@gmail.com', subject: 'SA auth test: services@', html: '<p>Phase 1 OK</p>' })
  .then(r => console.log(r));
"
```
Expected: `{ success: true, messageId: '...' }` and the message arrives **from `The Village Common of RI <services@villagecommonri.org>`**. If it fails with `unauthorized_client`, the DWD scope/client authorization in the Workspace admin console doesn't match the SA — stop and resolve before proceeding.

- [ ] **Step 8: Remove the retired token file from the working tree if present, and commit**

```bash
git add src/gmail.js src/config.js test/gmail.test.js .gitignore .env.example
git commit -m "refactor: Gmail auth via service-account JWT (domain-wide delegation)"
```

---

### Task 2: Message-kind → mailbox routing

**Files:**
- Modify: `src/config.js` (map + lookups)
- Modify: `src/gmail.js` (`kind` param, From header)
- Modify: `src/email-processor.js` (pass `kind` at each send site)
- Create: `test/mailbox-config.test.js`

**Interfaces:**
- Consumes: Task 1's `getAuthClient(mailbox)`
- Produces: `sendEmail({ to, bcc, subject, html, kind })` — `kind` optional, resolved via `getMailboxForKind`; `config.js` exports `getMailboxForKind(kind)` → mailbox string and `getMailboxDisplayName(mailbox)` → display string. The volunteer-enrollment work (Task 3 amendment) calls `sendEmail` with `kind: 'enroll_pin'` / `kind: 'enroll_ineligible'`.

- [ ] **Step 1: Write the failing map tests**

Create `test/mailbox-config.test.js`:
```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getMailboxForKind, getMailboxDisplayName } = require('../src/config');

test('current SR event kinds send from services@', () => {
  for (const kind of ['open', 'confirmed', 'cancelled', 'reminder']) {
    assert.equal(getMailboxForKind(kind), 'services@villagecommonri.org');
  }
});

test('enrollment kinds send from village-green@', () => {
  assert.equal(getMailboxForKind('enroll_pin'), 'village-green@villagecommonri.org');
  assert.equal(getMailboxForKind('enroll_ineligible'), 'village-green@villagecommonri.org');
});

test('member_welcome is reserved to volunteer@', () => {
  assert.equal(getMailboxForKind('member_welcome'), 'volunteer@villagecommonri.org');
});

test('unknown or missing kind falls back to services@', () => {
  assert.equal(getMailboxForKind('mystery'), 'services@villagecommonri.org');
  assert.equal(getMailboxForKind(undefined), 'services@villagecommonri.org');
});

test('display names resolve per mailbox with a default', () => {
  assert.equal(getMailboxDisplayName('services@villagecommonri.org'), 'The Village Common of RI');
  assert.equal(getMailboxDisplayName('village-green@villagecommonri.org'), 'Village Green');
  assert.equal(getMailboxDisplayName('volunteer@villagecommonri.org'), 'The Village Common of RI');
  assert.equal(getMailboxDisplayName('other@villagecommonri.org'), 'The Village Common of RI');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `getMailboxForKind is not a function`.

- [ ] **Step 3: Implement the map and lookups**

In `src/config.js`, add above the function definitions:
```js
const DEFAULT_MAILBOX = 'services@villagecommonri.org';
const DEFAULT_DISPLAY_NAME = 'The Village Common of RI';

// Sending mailbox per message kind (customer assignments, 2026-07-14).
// Kinds are notification_event.eventType values plus sidecar-internal kinds
// (enroll_pin is the webhook PIN send). member_welcome is reserved for a
// planned event type that has no handler yet. Unlisted kinds -> DEFAULT_MAILBOX.
const MAILBOX_BY_KIND = {
  open: 'services@villagecommonri.org',
  confirmed: 'services@villagecommonri.org',
  cancelled: 'services@villagecommonri.org',
  reminder: 'services@villagecommonri.org',
  enroll_pin: 'village-green@villagecommonri.org',
  enroll_ineligible: 'village-green@villagecommonri.org',
  member_welcome: 'volunteer@villagecommonri.org',
};

const MAILBOX_DISPLAY_NAMES = {
  'services@villagecommonri.org': 'The Village Common of RI',
  'village-green@villagecommonri.org': 'Village Green',
  'volunteer@villagecommonri.org': 'The Village Common of RI',
};

function getMailboxForKind(kind) {
  return MAILBOX_BY_KIND[kind] || DEFAULT_MAILBOX;
}

function getMailboxDisplayName(mailbox) {
  return MAILBOX_DISPLAY_NAMES[mailbox] || DEFAULT_DISPLAY_NAME;
}
```
Add `getMailboxForKind` and `getMailboxDisplayName` to `module.exports`.

In `src/gmail.js`:
1. Change the config import: `const { getGmailConfig, getMailboxForKind, getMailboxDisplayName } = require('./config');`
2. Delete the `FROM_ADDRESS` and `FROM_NAME` constants.
3. Replace `sendEmail`:
```js
// kind selects the sending mailbox (see MAILBOX_BY_KIND in config.js).
// Callers never pass a mailbox; omitted/unknown kinds send from services@.
async function sendEmail({ to, bcc, subject, html, kind }) {
  try {
    const mailbox = getMailboxForKind(kind);
    const auth = getAuthClient(mailbox);
    const gmail = google.gmail({ version: 'v1', auth });

    const raw = buildRawMessage({
      to,
      bcc,
      subject,
      html,
      from: `${getMailboxDisplayName(mailbox)} <${mailbox}>`,
    });

    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    });

    return { success: true, messageId: res.data.id };
  } catch (error) {
    console.error('Failed to send email:', error.message);
    return { success: false, error: error.message };
  }
}
```

In `src/email-processor.js`, add `kind: event.eventType` to every `sendEmail` call inside `pollOnce()` — there are five (open BCC send; confirmed volunteer + member sends; cancelled volunteer + member sends), e.g.:
```js
const result = await sendEmail({ bcc: recipients.bcc, subject, html: finalHtml, kind: event.eventType });
```
All five map to `services@`, so this step is behavior-neutral. Leave `send-corrections.js`/`send-apology.js` untouched — no `kind` means `services@`, their current behavior.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (all files).

- [ ] **Step 5: Real-send verification of impersonation for the other two mailboxes**

```bash
node -e "
require('dotenv/config');
const { sendEmail } = require('./src/gmail');
(async () => {
  console.log(await sendEmail({ to: 'carlsmigielski@gmail.com', subject: 'SA test: village-green@', html: '<p>enroll kind</p>', kind: 'enroll_pin' }));
  console.log(await sendEmail({ to: 'carlsmigielski@gmail.com', subject: 'SA test: volunteer@', html: '<p>member_welcome kind</p>', kind: 'member_welcome' }));
})();
"
```
Expected: both `{ success: true }`; inbox shows one message from **`Village Green <village-green@villagecommonri.org>`** and one from **`The Village Common of RI <volunteer@villagecommonri.org>`**. This proves DWD works for all three mailboxes — the entire point of the refactor.

- [ ] **Step 6: End-to-end regression through the poll loop**

Insert one synthetic `open` event against the dev DB and confirm it still sends from `services@` with `TEST_RECIPIENTS` (mirrors the existing dev flow; use an existing service request id):
```bash
docker exec village-green-orch-db-1 mysql -uroot -prootpw vg -N -e "SELECT id FROM service_request ORDER BY id DESC LIMIT 1;"
docker exec village-green-orch-db-1 mysql -uroot -prootpw vg -e "INSERT INTO notification_event (eventType, serviceRequestId) VALUES ('open', <that id>);"
DB_HOST=127.0.0.1 DB_PORT=60001 DB_USER=root DB_PASSWORD=rootpw DB_NAME=vg \
TEST_RECIPIENTS='carlsmigielski@gmail.com' \
node -e "require('dotenv/config'); require('./src/email-processor').pollOnce().then(() => process.exit(0))"
```
Expected: `[TEST]`-prefixed open-request email from `services@`; row marked sent. Clean up: `DELETE FROM notification_event WHERE id = <new row id>;` (delete the specific inserted row, not all events).

- [ ] **Step 7: Commit**

```bash
git add src/config.js src/gmail.js src/email-processor.js test/mailbox-config.test.js
git commit -m "feat: per-kind sending mailboxes via service-account impersonation"
```

---

### Task 3: Amend the volunteer-enrollment plan for the new `sendEmail` signature

**Files:**
- Modify: `/home/csmig/dev/village-green/scratch/superpowers/plans/2026-07-14-volunteer-enrollment.md`

The enrollment plan (not yet executed) writes new `sendEmail` call sites in its Tasks 6–7. Amend it so those are born with the right kinds. This task edits a plan document only — no code.

- [ ] **Step 1: Amend enrollment-plan Task 6 (`http-listener.js`)**

In the `handleSendPin` code block, change the send line to pass the kind, and drop the local mailbox concern entirely — the `[TEST]` subject handling stays:
```js
  const result = await sendEmailFn({ to, subject, html, kind: 'enroll_pin' });
```
In the same task's `test/http-listener.test.js` block, extend the first test's assertions with:
```js
  assert.equal(calls[0].kind, 'enroll_pin');
```
Also update Task 6's **Interfaces → Consumes** line to read: `sendEmail({ to, bcc, subject, html, kind })` from `src/gmail.js` (kind selects the sending mailbox; `enroll_pin` → `village-green@`).

- [ ] **Step 2: Amend enrollment-plan Task 7 (`email-processor.js` branch)**

In the `enroll_ineligible` dispatch block, change the send line to:
```js
        const result = await sendEmail({ to, subject, html, kind: event.eventType });
```

- [ ] **Step 3: Amend the enrollment plan's Global Constraints**

Add one bullet:
```markdown
- **Prerequisite:** the sidecar's `service-account-mail` branch (docs/superpowers/plans/2026-07-14-service-account-mail.md in vg-email-sidecar) must be merged to its `main` before cutting the `enrollment` branch — Tasks 6–7 are written against the post-refactor `sendEmail({ ..., kind })` signature, and enrollment mail sends from `village-green@`.
```

- [ ] **Step 4: Commit (village-green repo)**

```bash
cd /home/csmig/dev/village-green
git add scratch/superpowers/plans/2026-07-14-volunteer-enrollment.md
git commit -m "docs(enroll): align plan with sidecar service-account mail refactor"
```

---

## Merge Sequencing

1. `service-account-mail` → sidecar `main` (Tasks 1–2 complete, verified).
2. Then cut the sidecar `enrollment` branch per the volunteer-enrollment plan.
3. The dormant `wall-clock-times` WIP branch rebases over `main` whenever it resumes; its conflict surface with this change is `email-processor.js` only.

## Self-Review (performed at planning time)

- **Requirement coverage:** JWT + subject impersonation (Task 1), callers pass no mailbox (design #1, Task 2), all three assignments including reserved `member_welcome` (Task 2 map + tests), refresh-token retirement (Task 1), enrollment integration (Task 3).
- **Placeholders:** none — full code in every step.
- **Type consistency:** `getAuthClient(mailbox)` produced in Task 1, consumed in Task 2; `getMailboxForKind`/`getMailboxDisplayName` names match between config, gmail.js, and tests; `kind` values match `notification_event.eventType` strings plus `enroll_pin`.
