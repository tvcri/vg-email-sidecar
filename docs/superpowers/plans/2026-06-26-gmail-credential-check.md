# Gmail Credential Check at Startup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface broken Gmail credentials at startup rather than waiting for the first email send.

**Architecture:** Add `verifyCredentials()` to `gmail.js` (which already owns all auth logic), fix `gmail.js` to read the token path from config rather than a hardcoded constant, and call `verifyCredentials()` from `startSidecar()` in `index.js` between DB init and first poll.

**Tech Stack:** Node.js (CommonJS), `googleapis` v173, Node built-in test runner (`node --test`)

## Global Constraints

- CommonJS modules (`require`/`module.exports`) — no ESM
- No new npm dependencies
- Test file must be runnable with `node --test` from repo root
- All new tests go in `test/`

---

### Task 1: Fix token path — read from config in `gmail.js`

**Files:**
- Modify: `src/gmail.js:1-5` (remove `TOKEN_PATH` constant, import `getGmailConfig`)
- Modify: `src/gmail.js:8-15` (`buildAuthClient` — use config path)
- Test: `test/gmail.test.js` (new file)

**Interfaces:**
- Consumes: `getGmailConfig()` from `./config` — returns `{ tokenPath: string, fromAddress: string, fromName: string }`
- Produces: no interface change — `buildAuthClient()` is internal; `sendEmail()` signature unchanged

- [ ] **Step 1: Write a failing test that confirms `buildAuthClient` reads the path from config**

Create `test/gmail.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

// Point GMAIL_TOKEN_PATH at a temp file so buildAuthClient can be exercised
// without the real token file.
const TEMP_TOKEN = path.join(require('os').tmpdir(), 'test-token.json');

test('buildAuthClient reads token path from getGmailConfig()', () => {
  fs.writeFileSync(TEMP_TOKEN, JSON.stringify({
    client_id: 'id',
    client_secret: 'secret',
    refresh_token: 'refresh',
  }));
  process.env.GMAIL_TOKEN_PATH = TEMP_TOKEN;

  // Re-require to pick up env change (clear cache first)
  delete require.cache[require.resolve('../src/gmail.js')];
  delete require.cache[require.resolve('../src/config.js')];
  const { sendEmail } = require('../src/gmail.js');

  // sendEmail is exported — if buildAuthClient blows up on a bad path, the
  // require itself would throw. Getting here means the path was read correctly.
  assert.equal(typeof sendEmail, 'function');

  fs.unlinkSync(TEMP_TOKEN);
  delete process.env.GMAIL_TOKEN_PATH;
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
node --test test/gmail.test.js
```

Expected: FAIL — `Error: ENOENT` or similar because `gmail.js` still uses the hardcoded `./services-mailer-token.json` path, not the env-configured one.

- [ ] **Step 3: Update `src/gmail.js` — remove hardcoded path, use config**

Replace the top of `src/gmail.js`:

```js
const fs = require('fs');
const { google } = require('googleapis');
const { getGmailConfig } = require('./config');

const FROM_ADDRESS = 'services@villagecommonri.org';
const FROM_NAME = 'The Village Common of RI';

function buildAuthClient() {
  const { tokenPath } = getGmailConfig();
  const { client_id, client_secret, refresh_token } = JSON.parse(
    fs.readFileSync(tokenPath, 'utf8')
  );
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret);
  oAuth2Client.setCredentials({ refresh_token });
  return oAuth2Client;
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
node --test test/gmail.test.js
```

Expected: PASS

- [ ] **Step 5: Run full test suite to confirm no regressions**

```bash
node --test
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/gmail.js test/gmail.test.js
git commit -m "refactor: read Gmail token path from config instead of hardcoded constant"
```

---

### Task 2: Add `verifyCredentials()` to `gmail.js`

**Files:**
- Modify: `src/gmail.js` (add `verifyCredentials`, export it)
- Modify: `test/gmail.test.js` (add tests for `verifyCredentials`)

**Interfaces:**
- Produces: `verifyCredentials()` — `async function(): Promise<void>` — throws if token file is missing/unreadable; resolves (with a `console.warn`) if the Gmail API probe fails; resolves silently on success

- [ ] **Step 1: Write failing tests for `verifyCredentials`**

Append to `test/gmail.test.js`:

```js
const { test, mock } = require('node:test');

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

test('verifyCredentials warns but resolves when Gmail API rejects the token', async (t) => {
  const TEMP_TOKEN2 = path.join(require('os').tmpdir(), 'test-token2.json');
  fs.writeFileSync(TEMP_TOKEN2, JSON.stringify({
    client_id: 'id',
    client_secret: 'secret',
    refresh_token: 'bad-refresh',
  }));
  process.env.GMAIL_TOKEN_PATH = TEMP_TOKEN2;

  delete require.cache[require.resolve('../src/gmail.js')];
  delete require.cache[require.resolve('../src/config.js')];

  // Stub googleapis so the getProfile call throws
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

  await assert.doesNotReject(() => verifyCredentials());

  assert.ok(warnings.some(w => w.includes('invalid_grant')), 'expected warning about API failure');

  console.warn = origWarn;
  googleapis.google.gmail = origGmail;
  fs.unlinkSync(TEMP_TOKEN2);
  delete process.env.GMAIL_TOKEN_PATH;
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
node --test test/gmail.test.js
```

Expected: FAIL — `verifyCredentials is not a function`

- [ ] **Step 3: Implement `verifyCredentials` in `src/gmail.js`**

Add after `buildAuthClient`:

```js
async function verifyCredentials() {
  const auth = buildAuthClient(); // throws if file missing/unreadable
  try {
    const gmail = google.gmail({ version: 'v1', auth });
    await gmail.users.getProfile({ userId: 'me' });
  } catch (error) {
    console.warn(`Gmail credential probe failed: ${error.message}`);
  }
}
```

Add `verifyCredentials` to the exports:

```js
module.exports = { sendEmail, verifyCredentials };
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
node --test test/gmail.test.js
```

Expected: all tests in this file pass

- [ ] **Step 5: Run full test suite**

```bash
node --test
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/gmail.js test/gmail.test.js
git commit -m "feat: add verifyCredentials() to gmail.js with file-missing hard fail and API probe warn"
```

---

### Task 3: Call `verifyCredentials()` from `startSidecar()` in `index.js`

**Files:**
- Modify: `src/index.js` (import `verifyCredentials`, call it after DB init)

**Interfaces:**
- Consumes: `verifyCredentials()` from `./gmail` — `async function(): Promise<void>`, throws on missing token file

- [ ] **Step 1: Update `src/index.js` to call `verifyCredentials` at startup**

Replace the require at the top and the body of `startSidecar`:

```js
require('dotenv/config');

const { initializePool, closePool } = require('./db');
const { pollOnce } = require('./email-processor');
const { getPollConfig } = require('./config');
const { verifyCredentials } = require('./gmail');

let pollInterval = null;

async function startSidecar() {
  try {
    console.log('Initializing database pool...');
    console.log('DB config:', {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      database: process.env.DB_NAME,
    });
    await initializePool();
    console.log('Database pool initialized');

    console.log('Verifying Gmail credentials...');
    await verifyCredentials();
    console.log('Gmail credentials OK');

    console.log('Running initial poll...');
    await pollOnce();

    const pollConfig = getPollConfig();
    console.log(`Starting poll loop every ${pollConfig.intervalMs}ms`);
    pollInterval = setInterval(async () => {
      try {
        await pollOnce();
      } catch (error) {
        console.error('Error during poll cycle:', error.message);
      }
    }, pollConfig.intervalMs);
  } catch (error) {
    console.error('Failed to start sidecar:', error.message);
    process.exit(1);
  }
}
```

- [ ] **Step 2: Manually verify — missing token file causes exit**

Temporarily rename the token file and start the sidecar:

```bash
mv services-mailer-token.json services-mailer-token.json.bak
node src/index.js
```

Expected output includes:
```
Verifying Gmail credentials...
Failed to start sidecar: ENOENT: no such file or directory ...
```
And the process exits with code 1. Restore the file:

```bash
mv services-mailer-token.json.bak services-mailer-token.json
```

- [ ] **Step 3: Run full test suite**

```bash
node --test
```

Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
git add src/index.js
git commit -m "feat: verify Gmail credentials at startup before entering poll loop"
```
