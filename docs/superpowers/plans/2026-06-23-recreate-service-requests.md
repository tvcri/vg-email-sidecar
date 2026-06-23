# Recreate Service Requests From Sent Email — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a one-off Node utility that parses the original "open request" emails attached to `./Recovery_2.eml` and emits reviewable SQL (`INSERT INTO service_request`) to restore deleted rows #1024–#1040 with their original IDs.

**Architecture:** A small pipeline under `src/recreate/`: `eml-source` reads the local `.eml` and yields one record per attachment; the pure `parser` extracts fields from each subject + HTML body; `resolver` looks up `member_person_id`/`village_id`/existing ids in the live DB; `sql-writer` renders `INSERT`s (commenting out any flagged row); `index` orchestrates and writes `out.sql` + `report.json`. No Gmail, no OAuth, no network, no DB writes.

**Tech Stack:** Node.js (CommonJS, matching the repo), `mailparser` for MIME/quoted-printable decoding, `mysql2/promise` (already a dep) for read-only DB lookups, `dotenv` (already a dep), and the built-in `node:test` runner + `node:assert` for tests.

## Global Constraints

- CommonJS modules (`require`/`module.exports`) — the repo is `"type": "commonjs"`.
- DB access is **read-only**; the utility never writes to the database.
- All recovered rows have `status = 'Open'` and `volunteer_person_id = NULL`.
- `village_id` is `NOT NULL` on `service_request`; a row whose `village_id` cannot be resolved must be emitted **commented out**.
- Forced explicit `id` in every `INSERT` (preserve original IDs).
- Source default path: `./Recovery_2.eml`. Outputs: `./out.sql`, `./report.json` (all three are git-ignored — already configured).
- Tests run via `npm test` → `node --test`. No network or live Gmail in any test.
- DB config comes from `.env` via the existing pattern in `src/db.js` (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`).

---

## File Structure

```
src/recreate/
  index.js         # CLI entry: arg parsing, orchestration, writes out.sql + report.json
  eml-source.js    # read .eml, walk MIME, return [{ id, filename, subject, dateHeader, bodyHtml }]
  parser.js        # PURE: parseSubject(subject) + parseBody(html) -> field objects
  resolver.js      # DB lookups: resolveMember(name), existingIds(ids)
  sql-writer.js    # renderInsert(row, warnings), renderSkipped(id), renderDuplicate(...) ; value escaping
test/recreate/
  parser.test.js
  sql-writer.test.js
  eml-source.test.js
  fixtures/sample.eml      # tiny 2-attachment .eml built in-test or committed (PII-scrubbed)
```

`package.json` gets `mailparser` added to `dependencies` and `test` script changed to `node --test`.

---

### Task 1: Project setup — test runner + mailparser

**Files:**
- Modify: `package.json`

**Interfaces:**
- Consumes: nothing.
- Produces: `npm test` runs `node --test`; `mailparser` available via `require('mailparser')`.

- [ ] **Step 1: Add mailparser and set the test script**

Run:

```bash
cd /home/csmig/dev/tvcri/vg-email-sidecar
npm install mailparser
```

Then edit `package.json` `scripts.test` from the placeholder to:

```json
  "scripts": {
    "start": "node src/index.js",
    "test": "node --test"
  },
```

- [ ] **Step 2: Verify the test runner works with zero tests**

Run: `npm test`
Expected: exits 0 with output like "tests 0" / "pass 0" (no failure). If it errors that no test files exist, that is fine for now — proceed; later tasks add tests.

- [ ] **Step 3: Verify mailparser loads**

Run: `node -e "require('mailparser'); console.log('ok')"`
Expected: prints `ok`.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add mailparser dep and node:test runner for recovery utility"
```

---

### Task 2: `parser.js` — parse the subject line

**Files:**
- Create: `src/recreate/parser.js`
- Test: `test/recreate/parser.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `parseSubject(subject: string) -> { id: number|null, memberName: string|null, serviceDate: string|null }`
    where `serviceDate` is an ISO date string `YYYY-MM-DD` (no time), or `null` if unparseable.

Subject format (verified): `SR Request #1030-For McGaw, Lee-Service Date: 7/2/2026`.
Note the member name itself can contain a comma (`Last, First`) and an apostrophe (`O'Connell, Carol Ann`), so split on the literal markers `-For ` and `-Service Date: `, not on commas.

- [ ] **Step 1: Write the failing test**

Create `test/recreate/parser.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseSubject } = require('../../src/recreate/parser');

test('parseSubject extracts id, member, ISO date', () => {
  const r = parseSubject('SR Request #1030-For McGaw, Lee-Service Date: 7/2/2026');
  assert.equal(r.id, 1030);
  assert.equal(r.memberName, 'McGaw, Lee');
  assert.equal(r.serviceDate, '2026-07-02');
});

test('parseSubject handles apostrophe in member name', () => {
  const r = parseSubject("SR Request #1028-For O'Connell, Carol Ann-Service Date: 7/1/2026");
  assert.equal(r.id, 1028);
  assert.equal(r.memberName, "O'Connell, Carol Ann");
  assert.equal(r.serviceDate, '2026-07-01');
});

test('parseSubject returns nulls on garbage', () => {
  const r = parseSubject('totally unrelated subject');
  assert.equal(r.id, null);
  assert.equal(r.memberName, null);
  assert.equal(r.serviceDate, null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/recreate/parser.test.js`
Expected: FAIL — `Cannot find module '../../src/recreate/parser'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/recreate/parser.js`:

```js
'use strict';

// "SR Request #1030-For McGaw, Lee-Service Date: 7/2/2026"
const SUBJECT_RE = /^SR Request #(\d+)-For (.+)-Service Date:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/;

function parseSubject(subject) {
  const m = SUBJECT_RE.exec((subject || '').trim());
  if (!m) return { id: null, memberName: null, serviceDate: null };
  const [, id, memberName, mo, day, year] = m;
  const iso = `${year}-${mo.padStart(2, '0')}-${day.padStart(2, '0')}`;
  return { id: Number(id), memberName: memberName.trim(), serviceDate: iso };
}

module.exports = { parseSubject };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/recreate/parser.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/recreate/parser.js test/recreate/parser.test.js
git commit -m "feat(recreate): parse SR Request subject line into id/member/date"
```

---

### Task 3: `parser.js` — parse the HTML body

**Files:**
- Modify: `src/recreate/parser.js`
- Test: `test/recreate/parser.test.js`

**Interfaces:**
- Consumes: `parseSubject` (same module).
- Produces:
  - `parseBody(html: string) -> { serviceName, description, destination, address, city, state, zip, transportationType }`
    Each field is a trimmed string or `null` when its labeled cell is absent.
  - `serviceName` comes from the sentence `...seeking someone to provide <X> for <member>`.
  - `description` from the `Short Description:` table cell.
  - `destination`/`address`/`city`/`state`/`zip` from the `Destination:` cell (Rides/Errands only); parsed from the `<br>`-separated lines `Name<br>street<br>city, ST zip`. When the Destination cell is absent (Home Help / Tech Support), all five are `null`.
  - `transportationType` from the `Transportation:` cell.

These are best-effort HTML-table extractions. Use small regexes against the
known template markup (verified labels: `Short Description:`, `Destination:`,
`Transportation:`, and the `seeking someone to provide … for` sentence). Do not
pull member contact fields — those come from the live DB, not the email.

- [ ] **Step 1: Write the failing test**

Append to `test/recreate/parser.test.js`:

```js
const { parseBody } = require('../../src/recreate/parser');

const RIDE_BODY = `
<html><body>
The Village Common of RI is seeking someone to provide Ride: Medical Appnt for McGaw, Lee<br>
on Thursday, July 2, 2026.
<table><tbody>
  <tr><td>Short Description:</td><td>Member requests a round-trip ride for a medical appointment.</td></tr>
  <tr><td valign='top'>Destination:</td><td valign='top'>Miriam Hospital<br>164 Summit Ave<br>Providence, RI 02906
      <br><br><a href='x'>Show destination on map</a></td></tr>
  <tr><td valign='top'>Transportation:</td><td>Wheelchair accessible</td></tr>
</tbody></table>
</body></html>`;

const HOMEHELP_BODY = `
<html><body>
The Village Common of RI is seeking someone to provide Household Chores/Handy Help for Lang, Lois.
<table><tbody>
  <tr><td>Short Description:</td><td>Help moving boxes in the garage.</td></tr>
  <tr><td>Requesting Member:</td><td>Lang, Lois<br>1 Main St<br>Barrington, RI 02806</td></tr>
</tbody></table>
</body></html>`;

test('parseBody extracts service name, description, destination for a ride', () => {
  const r = parseBody(RIDE_BODY);
  assert.equal(r.serviceName, 'Ride: Medical Appnt');
  assert.equal(r.description, 'Member requests a round-trip ride for a medical appointment.');
  assert.equal(r.destination, 'Miriam Hospital');
  assert.equal(r.address, '164 Summit Ave');
  assert.equal(r.city, 'Providence');
  assert.equal(r.state, 'RI');
  assert.equal(r.zip, '02906');
  assert.equal(r.transportationType, 'Wheelchair accessible');
});

test('parseBody leaves destination fields null when no Destination cell', () => {
  const r = parseBody(HOMEHELP_BODY);
  assert.equal(r.serviceName, 'Household Chores/Handy Help');
  assert.equal(r.description, 'Help moving boxes in the garage.');
  assert.equal(r.destination, null);
  assert.equal(r.address, null);
  assert.equal(r.city, null);
  assert.equal(r.state, null);
  assert.equal(r.zip, null);
  assert.equal(r.transportationType, null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/recreate/parser.test.js`
Expected: FAIL — `parseBody is not a function`.

- [ ] **Step 3: Write minimal implementation**

Add to `src/recreate/parser.js` (before `module.exports`):

```js
function stripTags(s) {
  return s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

// Return the inner HTML of the <td> that follows a <td> whose text matches `label`.
function cellAfterLabel(html, label) {
  // matches: <td ...>LABEL</td> <td ...>VALUE</td>
  const re = new RegExp(
    `<td[^>]*>\\s*${label}\\s*</td>\\s*<td[^>]*>([\\s\\S]*?)</td>`,
    'i'
  );
  const m = re.exec(html);
  return m ? m[1] : null;
}

function parseBody(html) {
  html = html || '';

  let serviceName = null;
  const sn = /seeking someone to provide\s+([\s\S]*?)\s+for\s/i.exec(html);
  if (sn) serviceName = stripTags(sn[1]);

  const descRaw = cellAfterLabel(html, 'Short Description:');
  const description = descRaw ? stripTags(descRaw) : null;

  const transRaw = cellAfterLabel(html, 'Transportation:');
  const transportationType = transRaw ? stripTags(transRaw) : null;

  let destination = null, address = null, city = null, state = null, zip = null;
  const destRaw = cellAfterLabel(html, 'Destination:');
  if (destRaw) {
    // Drop any trailing map link, then split on <br>.
    const cleaned = destRaw.replace(/<a\b[\s\S]*?<\/a>/gi, '');
    const lines = cleaned
      .split(/<br\s*\/?>/i)
      .map(stripTags)
      .filter(Boolean);
    if (lines[0]) destination = lines[0];
    if (lines[1]) address = lines[1];
    const cityLine = lines[2]; // "Providence, RI 02906"
    if (cityLine) {
      const cm = /^(.*?),\s*([A-Za-z]{2})\s+(\d{5})/.exec(cityLine);
      if (cm) { city = cm[1].trim(); state = cm[2]; zip = cm[3]; }
      else city = cityLine;
    }
  }

  return { serviceName, description, destination, address, city, state, zip, transportationType };
}
```

And update the export line:

```js
module.exports = { parseSubject, parseBody };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/recreate/parser.test.js`
Expected: PASS (5 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/recreate/parser.js test/recreate/parser.test.js
git commit -m "feat(recreate): parse service request HTML body fields"
```

---

### Task 4: `sql-writer.js` — value escaping + INSERT rendering

**Files:**
- Create: `src/recreate/sql-writer.js`
- Test: `test/recreate/sql-writer.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `sqlValue(v) -> string` — `NULL` for null/undefined; numbers bare; everything else single-quoted with `'` doubled.
  - `renderInsert(row, warnings) -> string` — a full `INSERT INTO service_request (...) VALUES (...);` statement. `row` is an object keyed by column name. If `warnings` is a non-empty array, prepend a `-- WARNING: <reason>` line per warning **and** comment out every line of the statement (prefix each line with `-- `).
  - `renderSkipped(id) -> string` — `-- SKIPPED id=<id> (already exists in service_request)`.
  - `renderDuplicate(id, count) -> string` — `-- WARNING: duplicate id <id> — <count> source emails; operator must choose one` (the rows themselves are rendered commented-out by the caller via `renderInsert` with a duplicate warning).
  - `COLUMNS` — exported array fixing column order:
    `['id','village_id','member_person_id','volunteer_person_id','status','service_name','transportation_type','created_at','start_at','description','destination','address','city','state','zip']`

- [ ] **Step 1: Write the failing test**

Create `test/recreate/sql-writer.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sqlValue, renderInsert, renderSkipped } = require('../../src/recreate/sql-writer');

test('sqlValue handles nulls, numbers, and quote escaping', () => {
  assert.equal(sqlValue(null), 'NULL');
  assert.equal(sqlValue(undefined), 'NULL');
  assert.equal(sqlValue(1030), '1030');
  assert.equal(sqlValue("O'Connell"), "'O''Connell'");
});

test('renderInsert produces a runnable statement for a clean row', () => {
  const row = { id: 1030, village_id: 1, member_person_id: 42, volunteer_person_id: null,
    status: 'Open', service_name: 'Ride: Medical Appnt', transportation_type: null,
    created_at: null, start_at: '2026-07-02', description: "round trip",
    destination: 'Miriam', address: '164 Summit Ave', city: 'Providence', state: 'RI', zip: '02906' };
  const sql = renderInsert(row, []);
  assert.match(sql, /^INSERT INTO service_request/);
  assert.match(sql, /1030/);
  assert.match(sql, /'Open'/);
  assert.ok(!sql.split('\n').some(l => l.startsWith('-- ')), 'clean row is not commented out');
});

test('renderInsert comments out a flagged row and lists warnings', () => {
  const row = { id: 1031, village_id: null, member_person_id: null, status: 'Open' };
  const sql = renderInsert(row, ['village_id must be set manually']);
  const lines = sql.split('\n');
  assert.ok(lines[0].startsWith('-- WARNING: village_id must be set manually'));
  assert.ok(lines.slice(1).every(l => l.startsWith('-- ')), 'every statement line commented out');
});

test('renderSkipped emits a comment', () => {
  assert.equal(renderSkipped(1024), '-- SKIPPED id=1024 (already exists in service_request)');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/recreate/sql-writer.test.js`
Expected: FAIL — `Cannot find module '../../src/recreate/sql-writer'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/recreate/sql-writer.js`:

```js
'use strict';

const COLUMNS = [
  'id', 'village_id', 'member_person_id', 'volunteer_person_id', 'status',
  'service_name', 'transportation_type', 'created_at', 'start_at',
  'description', 'destination', 'address', 'city', 'state', 'zip',
];

function sqlValue(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

function commentOut(text) {
  return text.split('\n').map((l) => `-- ${l}`).join('\n');
}

function renderInsert(row, warnings) {
  const cols = COLUMNS.join(', ');
  const vals = COLUMNS.map((c) => sqlValue(row[c])).join(', ');
  const stmt = `INSERT INTO service_request (${cols})\nVALUES (${vals});`;
  if (warnings && warnings.length) {
    const header = warnings.map((w) => `-- WARNING: ${w}`).join('\n');
    return `${header}\n${commentOut(stmt)}`;
  }
  return stmt;
}

function renderSkipped(id) {
  return `-- SKIPPED id=${id} (already exists in service_request)`;
}

function renderDuplicate(id, count) {
  return `-- WARNING: duplicate id ${id} — ${count} source emails; operator must choose one`;
}

module.exports = { COLUMNS, sqlValue, renderInsert, renderSkipped, renderDuplicate };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/recreate/sql-writer.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/recreate/sql-writer.js test/recreate/sql-writer.test.js
git commit -m "feat(recreate): SQL value escaping and INSERT/comment rendering"
```

---

### Task 5: `eml-source.js` — read the .eml and yield attachment records

**Files:**
- Create: `src/recreate/eml-source.js`
- Test: `test/recreate/eml-source.test.js`

**Interfaces:**
- Consumes: `mailparser` (`simpleParser`).
- Produces:
  - `async readEml(path: string) -> Array<{ id: number|null, filename: string, subject: string, dateHeader: string|null, bodyHtml: string }>`
    One element per `message/rfc822` attachment. `id` is parsed from the attachment filename (`SR Request #<id>-...`). `subject`, `dateHeader`, `bodyHtml` come from the parsed inner message. Throws if the file cannot be read.

`mailparser`'s `simpleParser` exposes `message/rfc822` attachments with
`contentType === 'message/rfc822'` and a `content` Buffer of the nested raw
message; parse that nested buffer with `simpleParser` again to get its
`subject`, `date`, and `html`.

- [ ] **Step 1: Write the failing test**

Create `test/recreate/eml-source.test.js`. It builds a tiny outer email with one nested `message/rfc822` attachment in-memory, writes it to a temp file, and asserts extraction:

```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readEml } = require('../../src/recreate/eml-source');

function buildSampleEml() {
  const inner = [
    'From: The Village Common of RI <services@villagecommonri.org>',
    'Subject: SR Request #1030-For McGaw, Lee-Service Date: 7/2/2026',
    'Date: Mon, 22 Jun 2026 09:08:00 -0400',
    'Content-Type: text/html; charset=UTF-8',
    '',
    '<html><body>seeking someone to provide Ride: Medical Appnt for McGaw, Lee</body></html>',
  ].join('\r\n');

  const boundary = 'BOUND123';
  return [
    'From: me <me@example.com>',
    'Subject: Recovery 2',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: message/rfc822;',
    ' name="SR Request #1030-For McGaw, Lee-Service Date: 7/2/2026.eml"',
    'Content-Disposition: attachment;',
    ' filename="SR Request #1030-For McGaw, Lee-Service Date: 7/2/2026.eml"',
    '',
    inner,
    `--${boundary}--`,
    '',
  ].join('\r\n');
}

test('readEml returns one record per rfc822 attachment with id/subject/html', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eml-'));
  const file = path.join(dir, 'sample.eml');
  fs.writeFileSync(file, buildSampleEml());

  const records = await readEml(file);
  assert.equal(records.length, 1);
  const r = records[0];
  assert.equal(r.id, 1030);
  assert.match(r.subject, /SR Request #1030-For McGaw, Lee/);
  assert.match(r.bodyHtml, /seeking someone to provide Ride: Medical Appnt/);
  assert.ok(r.dateHeader, 'dateHeader present');
});

test('readEml throws a clear error on a missing file', async () => {
  await assert.rejects(() => readEml('/no/such/file.eml'), /ENOENT|not found|no such/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/recreate/eml-source.test.js`
Expected: FAIL — `Cannot find module '../../src/recreate/eml-source'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/recreate/eml-source.js`:

```js
'use strict';

const fs = require('node:fs/promises');
const { simpleParser } = require('mailparser');

// "SR Request #1030-For ...": pull the id from the attachment filename or subject.
function idFromText(text) {
  const m = /#(\d+)/.exec(text || '');
  return m ? Number(m[1]) : null;
}

async function readEml(path) {
  const raw = await fs.readFile(path); // throws ENOENT with the path if missing
  const outer = await simpleParser(raw);

  const records = [];
  for (const att of outer.attachments || []) {
    if (att.contentType !== 'message/rfc822') continue;
    const inner = await simpleParser(att.content);
    const filename = att.filename || inner.subject || '';
    records.push({
      id: idFromText(filename) ?? idFromText(inner.subject),
      filename,
      subject: inner.subject || '',
      dateHeader: inner.date ? inner.date.toISOString() : null,
      bodyHtml: inner.html || inner.textAsHtml || '',
    });
  }
  return records;
}

module.exports = { readEml };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/recreate/eml-source.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Sanity-check against the real file (manual, no assertion)**

Run:

```bash
node -e "require('./src/recreate/eml-source').readEml('./Recovery_2.eml').then(r => console.log('attachments:', r.length, 'ids:', r.map(x=>x.id).join(',')))"
```

Expected: `attachments: 17 ids: 1024,1025,...,1040` (order may vary).

- [ ] **Step 6: Commit**

```bash
git add src/recreate/eml-source.js test/recreate/eml-source.test.js
git commit -m "feat(recreate): read .eml and yield one record per rfc822 attachment"
```

---

### Task 6: `resolver.js` — DB lookups (member + existing ids)

**Files:**
- Create: `src/recreate/resolver.js`

**Interfaces:**
- Consumes: `mysql2/promise`, `dotenv` (loaded by `index.js` before use), and the same `.env` keys as `src/db.js`.
- Produces:
  - `async resolveMember(fullName) -> { memberPersonId: number|null, villageId: number|null, warning: string|null }`
    Looks up `person` by exact `full_name`. Exactly one match → ids returned, `warning` null. Zero matches → both null, `warning = "member '<name>' not found in person; member_person_id and village_id need manual fill"`. Multiple matches → both null, `warning = "member '<name>' matched N person rows; resolve manually"`.
  - `async existingIds(ids: number[]) -> Set<number>` — subset of `ids` already present in `service_request`.
  - `async withConnection(fn)` — internal helper that opens a connection, runs `fn(conn)`, and always closes (mirrors `src/db.js`).

This task has **no unit test** (it is a thin live-DB wrapper); it is exercised by the Task 7 integration smoke run against the real DB. Keep it minimal.

- [ ] **Step 1: Write the implementation**

Create `src/recreate/resolver.js`:

```js
'use strict';

const mysql = require('mysql2/promise');

function dbConfig() {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'vg',
  };
}

async function withConnection(fn) {
  const conn = await mysql.createConnection(dbConfig());
  try {
    return await fn(conn);
  } finally {
    await conn.end();
  }
}

async function resolveMember(fullName) {
  return withConnection(async (conn) => {
    const [rows] = await conn.query(
      'SELECT id, village_id FROM person WHERE full_name = ?',
      [fullName]
    );
    if (rows.length === 1) {
      return { memberPersonId: rows[0].id, villageId: rows[0].village_id, warning: null };
    }
    if (rows.length === 0) {
      return {
        memberPersonId: null, villageId: null,
        warning: `member '${fullName}' not found in person; member_person_id and village_id need manual fill`,
      };
    }
    return {
      memberPersonId: null, villageId: null,
      warning: `member '${fullName}' matched ${rows.length} person rows; resolve manually`,
    };
  });
}

async function existingIds(ids) {
  if (!ids.length) return new Set();
  return withConnection(async (conn) => {
    const [rows] = await conn.query(
      'SELECT id FROM service_request WHERE id IN (?)',
      [ids]
    );
    return new Set(rows.map((r) => r.id));
  });
}

module.exports = { resolveMember, existingIds, withConnection };
```

- [ ] **Step 2: Verify it loads and queries the live DB (read-only smoke)**

Run:

```bash
node -e "require('dotenv').config(); const r=require('./src/recreate/resolver'); (async()=>{ console.log(await r.resolveMember('McGaw, Lee')); console.log('existing in 1024..1040:', [...(await r.existingIds([1024,1030,1040]))]); })().catch(e=>console.error(e.message))"
```

Expected: a `{ memberPersonId: <n>, villageId: 1, warning: null }` object, and `existing in 1024..1040: []` (none exist).

- [ ] **Step 3: Commit**

```bash
git add src/recreate/resolver.js
git commit -m "feat(recreate): DB resolver for member ids and existing service_request ids"
```

---

### Task 7: `index.js` — CLI orchestration + outputs

**Files:**
- Create: `src/recreate/index.js`

**Interfaces:**
- Consumes: `readEml` (Task 5), `parseSubject`/`parseBody` (Tasks 2–3), `resolveMember`/`existingIds` (Task 6), `renderInsert`/`renderSkipped`/`renderDuplicate` (Task 4).
- Produces: a runnable CLI — `node src/recreate/index.js [--in PATH] [--out PATH]` — that writes `out.sql` and `report.json`.

Orchestration logic (mirrors the spec's data flow):

1. Load `.env`. Parse `--in` (default `./Recovery_2.eml`) and `--out` (default `./out.sql`).
2. `records = await readEml(inPath)`.
3. Compute `dupIds` = ids appearing more than once (safety guard).
4. `existing = await existingIds(distinct ids)`.
5. For each record sorted by `id` then `filename`:
   - If `id` is null → warning `"could not parse id from filename '<filename>'"`, render commented-out insert with the raw fields it has.
   - Else if `id` in `existing` → `renderSkipped(id)`, push skip to report, continue.
   - Else: parse subject + body; resolve member; collect warnings (member warning, duplicate-id warning, missing-service_name warning); build the `row`; `renderInsert(row, warnings)`.
6. Write all SQL lines (joined with blank lines) to `out.sql`, with a commented transaction wrapper. Write `report.json` with one entry per record.
7. Print a one-line summary to stdout.

- [ ] **Step 1: Write the implementation**

Create `src/recreate/index.js`:

```js
'use strict';

require('dotenv').config();
const fs = require('node:fs');
const { readEml } = require('./eml-source');
const { parseSubject, parseBody } = require('./parser');
const { resolveMember, existingIds } = require('./resolver');
const { renderInsert, renderSkipped, COLUMNS } = require('./sql-writer');

function parseArgs(argv) {
  const args = { in: './Recovery_2.eml', out: './out.sql' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--in') args.in = argv[++i];
    else if (argv[i] === '--out') args.out = argv[++i];
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const records = await readEml(args.in);

  const idCounts = new Map();
  for (const r of records) idCounts.set(r.id, (idCounts.get(r.id) || 0) + 1);
  const dupIds = new Set([...idCounts].filter(([, n]) => n > 1).map(([id]) => id));

  const distinctIds = [...new Set(records.map((r) => r.id).filter((x) => x != null))];
  const existing = await existingIds(distinctIds);

  const sorted = [...records].sort(
    (a, b) => (a.id ?? 1e9) - (b.id ?? 1e9) || a.filename.localeCompare(b.filename)
  );

  const sqlBlocks = [];
  const report = [];

  for (const rec of sorted) {
    const entry = { id: rec.id, filename: rec.filename, warnings: [], outcome: '' };

    if (rec.id == null) {
      entry.outcome = 'unparsed-id';
      entry.warnings.push(`could not parse id from filename '${rec.filename}'`);
      sqlBlocks.push(renderInsert({ status: 'Open' }, entry.warnings));
      report.push(entry);
      continue;
    }

    if (existing.has(rec.id)) {
      entry.outcome = 'skipped-exists';
      sqlBlocks.push(renderSkipped(rec.id));
      report.push(entry);
      continue;
    }

    const subj = parseSubject(rec.subject);
    const body = parseBody(rec.bodyHtml);
    const member = await resolveMember(subj.memberName || '');

    const warnings = [];
    if (dupIds.has(rec.id)) {
      warnings.push(`duplicate id ${rec.id} — ${idCounts.get(rec.id)} source emails; operator must choose one`);
    }
    if (member.warning) warnings.push(member.warning);
    if (member.villageId == null) warnings.push('village_id must be set manually (NOT NULL)');
    if (!body.serviceName) warnings.push('service_name could not be parsed from body');

    const row = {
      id: rec.id,
      village_id: member.villageId,
      member_person_id: member.memberPersonId,
      volunteer_person_id: null,
      status: 'Open',
      service_name: body.serviceName,
      transportation_type: body.transportationType,
      created_at: rec.dateHeader ? rec.dateHeader.slice(0, 19).replace('T', ' ') : null,
      start_at: subj.serviceDate, // date only; time-of-day not recovered
      description: body.description,
      destination: body.destination,
      address: body.address,
      city: body.city,
      state: body.state,
      zip: body.zip,
    };

    entry.outcome = warnings.length ? 'flagged' : 'clean';
    entry.warnings = warnings;
    entry.member = { name: subj.memberName, personId: member.memberPersonId, villageId: member.villageId };
    sqlBlocks.push(renderInsert(row, warnings));
    report.push(entry);
  }

  const header = [
    '-- Service request recovery — review before running.',
    `-- Source: ${args.in}`,
    `-- Generated: ${new Date().toISOString()}`,
    '-- Columns: ' + COLUMNS.join(', '),
    '-- Uncomment any flagged (-- WARNING) statements after fixing them.',
    '-- BEGIN;',
    '',
  ].join('\n');
  const footer = '\n-- COMMIT;\n';

  fs.writeFileSync(args.out, header + sqlBlocks.join('\n\n') + footer);
  fs.writeFileSync('./report.json', JSON.stringify(report, null, 2));

  const clean = report.filter((r) => r.outcome === 'clean').length;
  const flagged = report.filter((r) => r.outcome === 'flagged').length;
  const skipped = report.filter((r) => r.outcome === 'skipped-exists').length;
  console.log(`Wrote ${args.out} and report.json — ${report.length} records: ${clean} clean, ${flagged} flagged, ${skipped} skipped.`);
}

main().catch((err) => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
```

- [ ] **Step 2: Run it against the real source file**

Run: `node src/recreate/index.js --in ./Recovery_2.eml --out ./out.sql`
Expected: prints a summary like `17 records: 17 clean, 0 flagged, 0 skipped.` (some may be flagged if a member name doesn't match `person` — that is correct behavior, not a failure).

- [ ] **Step 3: Inspect the output**

Run: `grep -c '^INSERT INTO service_request' out.sql` (expect the count of clean rows) and open `out.sql` to confirm flagged rows (if any) are commented out with `-- WARNING` headers. Confirm `report.json` lists all 17 ids.

- [ ] **Step 4: Verify the generated SQL is syntactically valid without executing it**

Run (dry parse — wraps in a rolled-back transaction so nothing is written):

```bash
node -e "require('dotenv').config(); const fs=require('fs'),mysql=require('mysql2/promise'); (async()=>{ const sql=fs.readFileSync('out.sql','utf8').split('\n').filter(l=>!l.startsWith('--')).join('\n'); const c=await mysql.createConnection({host:process.env.DB_HOST,port:+process.env.DB_PORT,user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME,multipleStatements:true}); await c.query('START TRANSACTION'); try{ await c.query(sql); console.log('SQL parsed+applied in tx OK'); } finally { await c.query('ROLLBACK'); await c.end(); } })().catch(e=>{console.error('SQL ERROR:',e.message);process.exit(1)})"
```

Expected: `SQL parsed+applied in tx OK` (the transaction is rolled back, so the DB is unchanged). If it errors, fix the offending column/value in the generator and regenerate.

- [ ] **Step 5: Commit**

```bash
git add src/recreate/index.js
git commit -m "feat(recreate): CLI orchestration writing out.sql and report.json"
```

---

### Task 8: Documentation

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: nothing.
- Produces: a short "Service request recovery (one-off)" section.

- [ ] **Step 1: Append the section to `README.md`**

Add at the end of `README.md`:

```markdown
## Service Request Recovery (one-off utility)

Recreates deleted `service_request` rows from the original "open request" emails
collected in `./Recovery_2.eml` (one `message/rfc822` attachment per request).

```bash
node src/recreate/index.js --in ./Recovery_2.eml --out ./out.sql
```

Outputs:
- `out.sql` — `INSERT INTO service_request` statements with explicit original IDs.
  Clean rows are runnable; any row needing manual attention (e.g. an unresolved
  `village_id`) is preceded by `-- WARNING:` and **commented out** — fix and
  uncomment before running.
- `report.json` — per-attachment audit log (id, member, warnings, outcome).

The utility is read-only against the DB and makes no network/Gmail calls. Review
`out.sql` and run it manually against `vg`. `Recovery_2.eml`, `out.sql`, and
`report.json` are git-ignored (member PII).
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: document the service request recovery utility"
```

---

## Self-Review

**Spec coverage:**
- Source = local `Recovery_2.eml`, no Gmail/OAuth → Tasks 1, 5. ✓
- Flat `message/rfc822 → text/html`, QP decode → Task 5 (mailparser handles QP). ✓
- Subject → id/member/date; body → service_name/description/destination/transport → Tasks 2, 3. ✓
- `village_id` NOT NULL; unresolved → commented out → Task 4 (renderInsert) + Task 7 (warning). ✓
- Forced explicit id; status Open; volunteer NULL → Task 7 row build. ✓
- Skip ids already in DB → Task 6 `existingIds` + Task 7. ✓
- Duplicate-id safety guard (flag all) → Task 7 `dupIds` + Task 4 warning. ✓
- Outputs `out.sql` (commented tx wrapper) + `report.json` → Task 7. ✓
- No live writes; SQL validated under rollback → Task 7 Step 4. ✓
- TDD on pure parser + sql-writer; eml-source via sample fixture → Tasks 2–5 tests. ✓
- created_at from Date header; start_at = service date (date only) → Task 7 row build. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code; commands have expected output. ✓

**Type consistency:** `parseSubject`→`{id,memberName,serviceDate}`, `parseBody`→`{serviceName,...}`, `resolveMember`→`{memberPersonId,villageId,warning}`, `existingIds`→`Set`, `renderInsert(row,warnings)`, `COLUMNS` order used consistently in Task 4 and Task 7. ✓

**Note on member match:** `start_at` is stored date-only (`YYYY-MM-DD`); the column is `datetime`, which accepts it (midnight). Times-of-day from the body are out of scope per the spec's "best-effort"; `appt_time`/`return_time`/`phone`/`instructions`/`finish_at`/`request_number` are intentionally not in `COLUMNS` (left to DB defaults / NULL).
