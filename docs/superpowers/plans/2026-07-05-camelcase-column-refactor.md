# camelCase Column Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the sidecar's SQL and JavaScript to the database's new camelCase column names, renaming the corresponding JS identifiers throughout so code matches the schema.

**Architecture:** The database migrated *column* names to camelCase (table names are still snake_case, e.g. `service_request.requestNumber`). The sidecar's SQL selected snake_case columns and its JS consumed snake_case row properties (`requestData.member_name`, `event.event_type`, destructured template locals). Because every snake_case identifier is a whole-word token unique to this rename (underscore is a word character, so `\bperson_id\b` cannot match inside `member_person_id`), one global word-bounded sed over the eight affected files performs the entire rename coherently — SQL column refs, SQL aliases, JS property reads, destructuring, and test fixtures all flip together. Rendered email HTML contains only data *values*, never these key names, so a byte-diff of rendered previews before/after proves output is unchanged.

**Tech Stack:** Node.js (CommonJS), mysql2, `node --test` runner, GNU sed. Dev database: MariaDB at 127.0.0.1:60001, user `vg`, password `vgpw`, database `vg`.

## Global Constraints

- Table names remain snake_case (`service_request`, `notification_event`, `active_member`, `active_volunteer`, `person`, `volunteer_capability`, `capability`). Only column names changed.
- New column names verified against the dev DB via `information_schema.COLUMNS` (see mapping table below) — the DB is the source of truth.
- Rendered email HTML must be **byte-identical** before and after the refactor (verified by diffing `preview/` output).
- No new dependencies. No behavior changes. `npm test` (i.e. `node --test`) must pass.
- Do not touch `out.sql`, `report.json`, `preview/*.html` committed artifacts (they regenerate), `.superpowers/`, or `scratch/`.

## Identifier Mapping (complete)

Every snake_case token to rename, everywhere it appears (SQL column refs, SQL aliases, JS properties/locals, test fixtures, log strings, comments):

| snake_case | camelCase |
|---|---|
| `request_number` | `requestNumber` |
| `service_name` | `serviceName` |
| `village_id` | `villageId` |
| `member_person_id` | `memberPersonId` |
| `volunteer_person_id` | `volunteerPersonId` |
| `start_at` | `startAt` |
| `appt_time` | `apptTime` |
| `return_time` | `returnTime` |
| `finish_at` | `finishAt` |
| `transportation_type` | `transportationType` |
| `member_name` | `memberName` |
| `member_email` | `memberEmail` |
| `member_phone` | `memberPhone` |
| `member_cell` | `memberCell` |
| `member_address` | `memberAddress` |
| `member_city` | `memberCity` |
| `member_state` | `memberState` |
| `member_zip` | `memberZip` |
| `emergency_contact_name` | `emergencyContactName` |
| `emergency_contact_relationship` | `emergencyContactRelationship` |
| `emergency_contact_phone` | `emergencyContactPhone` |
| `service_notes` | `serviceNotes` |
| `full_name` | `fullName` |
| `person_id` | `personId` |
| `event_type` | `eventType` |
| `service_request_id` | `serviceRequestId` |
| `created_at` | `createdAt` |
| `sent_at` | `sentAt` |
| `failed_at` | `failedAt` |
| `prior_count` | `priorCount` |
| `volunteer_id` | `volunteerId` |
| `capability_id` | `capabilityId` |

Unchanged single-word columns: `id`, `status`, `description`, `instructions`, `address`, `city`, `state`, `zip`, `destination`, `phone`, `cell`, `email`, `recipients`, `name`, `active`.

**Files affected** (from grep of the tokens above; all other files have zero matches):
`src/queries.js`, `src/db.js`, `src/email-processor.js`, `src/templates.js`, `src/send-corrections.js`, `test/email-processor.test.js`, `test/send-corrections.test.js`, `preview-templates.js`.

---

### Task 1: Global rename to camelCase

**Files:**
- Modify: `src/queries.js` (all 7 query strings)
- Modify: `src/db.js:83` (`rows[0].prior_count`)
- Modify: `src/email-processor.js` (row property reads throughout)
- Modify: `src/templates.js` (destructuring + ~216 lines of interpolations)
- Modify: `src/send-corrections.js` (`TARGET_QUERY` + property reads)
- Modify: `preview-templates.js` (sample-data object keys)
- Test: `test/email-processor.test.js`, `test/send-corrections.test.js`

**Interfaces:**
- Consumes: current snake_case code (baseline).
- Produces: row objects and `requestData` with camelCase keys (`requestNumber`, `serviceName`, `villageId`, `memberPersonId`, `volunteerPersonId`, `startAt`, `apptTime`, `returnTime`, `finishAt`, `transportationType`, `memberName`, `memberEmail`, `memberPhone`, `memberCell`, `memberAddress`, `memberCity`, `memberState`, `memberZip`, `emergencyContactName`, `emergencyContactRelationship`, `emergencyContactPhone`, `serviceNotes`); event objects with `eventType`, `serviceRequestId`, `createdAt`; person/volunteer objects with `fullName`, `personId`; `getPriorOpenCount` returns from alias `priorCount`. Task 2 verifies these against the live dev DB.

- [ ] **Step 1: Capture baseline preview renders (BEFORE any code change)**

```bash
cd /home/csmig/dev/tvcri/vg-email-sidecar
node preview-templates.js
mkdir -p /tmp/claude-1000/-home-csmig-dev-tvcri-vg-email-sidecar/f0e2deff-f152-4995-a12c-e21370139b74/scratchpad/preview-baseline
cp preview/*.html /tmp/claude-1000/-home-csmig-dev-tvcri-vg-email-sidecar/f0e2deff-f152-4995-a12c-e21370139b74/scratchpad/preview-baseline/
npm test
```

Expected: previews written, all tests PASS (baseline green).

- [ ] **Step 2: Flip test fixtures to camelCase (failing tests first)**

In `test/email-processor.test.js`, change all five `deriveRecipientsForEvent` fixture keys from `volunteer_person_id` to `volunteerPersonId` (lines 6, 13, 20, 27, 34), e.g.:

```js
const result = deriveRecipientsForEvent('cancelled', { volunteerPersonId: 42 })
```

In `test/send-corrections.test.js` line 19–20, change the `buildSubject` fixture:

```js
const subject = buildSubject({ id: 1530, memberName: 'McGaw, Lee', startAt: '2026-07-02T04:00:00Z' });
```

Also rename `full_name` → `fullName` in the `injectTestBanner` fixture objects (lines 48–49).

- [ ] **Step 3: Run tests to verify the renamed-fixture tests fail**

Run: `npm test`
Expected: FAIL — `cancelled with volunteer sends to member and volunteer` (code still reads `volunteer_person_id`, gets `undefined`, so `sendToVolunteer` is `false`), and `buildSubject prefixes CORRECTED…` (subject renders `undefined`). The `injectTestBanner` test still passes (it reads `v.full_name` in src until Step 4 — expected).

- [ ] **Step 4: Apply the global rename with word-bounded sed**

> **Execution note (discovered during implementation):** `src/templates.js` already used `memberAddress` as a *derived* local (the formatted member contact block built from the raw `member_address` field), so the plain sed produces `const memberAddress = memberAddress` — a SyntaxError. Before running the mapping sed on `src/templates.js`, first rename the pre-existing derived local out of the way: `sed -i 's/\bmemberAddress\b/memberAddressBlock/g' src/templates.js`. This was the only such collision (verified by grepping HEAD for all camelCase targets; matches in other files are non-colliding function parameters).

```bash
cd /home/csmig/dev/tvcri/vg-email-sidecar
sed -i -E '
s/\brequest_number\b/requestNumber/g;
s/\bservice_name\b/serviceName/g;
s/\bvillage_id\b/villageId/g;
s/\bmember_person_id\b/memberPersonId/g;
s/\bvolunteer_person_id\b/volunteerPersonId/g;
s/\bstart_at\b/startAt/g;
s/\bappt_time\b/apptTime/g;
s/\breturn_time\b/returnTime/g;
s/\bfinish_at\b/finishAt/g;
s/\btransportation_type\b/transportationType/g;
s/\bmember_name\b/memberName/g;
s/\bmember_email\b/memberEmail/g;
s/\bmember_phone\b/memberPhone/g;
s/\bmember_cell\b/memberCell/g;
s/\bmember_address\b/memberAddress/g;
s/\bmember_city\b/memberCity/g;
s/\bmember_state\b/memberState/g;
s/\bmember_zip\b/memberZip/g;
s/\bemergency_contact_name\b/emergencyContactName/g;
s/\bemergency_contact_relationship\b/emergencyContactRelationship/g;
s/\bemergency_contact_phone\b/emergencyContactPhone/g;
s/\bservice_notes\b/serviceNotes/g;
s/\bfull_name\b/fullName/g;
s/\bperson_id\b/personId/g;
s/\bevent_type\b/eventType/g;
s/\bservice_request_id\b/serviceRequestId/g;
s/\bcreated_at\b/createdAt/g;
s/\bsent_at\b/sentAt/g;
s/\bfailed_at\b/failedAt/g;
s/\bprior_count\b/priorCount/g;
s/\bvolunteer_id\b/volunteerId/g;
s/\bcapability_id\b/capabilityId/g;
' src/queries.js src/db.js src/email-processor.js src/templates.js src/send-corrections.js test/email-processor.test.js test/send-corrections.test.js preview-templates.js
```

After sed, `src/queries.js` GET_SERVICE_REQUEST must read (spot-check it matches):

```sql
SELECT
  sr.id,
  sr.requestNumber,
  sr.serviceName,
  sr.villageId,
  sr.memberPersonId,
  sr.volunteerPersonId,
  sr.status,
  sr.description,
  sr.instructions,
  sr.startAt,
  sr.apptTime,
  sr.returnTime,
  sr.finishAt,
  sr.address,
  sr.city,
  sr.state,
  LPAD(sr.zip, 5, '0') as zip,
  sr.destination,
  sr.phone,
  sr.transportationType,
  mp.id as memberPersonId,
  mp.fullName as memberName,
  mp.email as memberEmail,
  mp.phone as memberPhone,
  mp.cell as memberCell,
  mp.address as memberAddress,
  mp.city as memberCity,
  mp.state as memberState,
  LPAD(mp.zip, 5, '0') as memberZip,
  mp.emergencyContactName,
  mp.emergencyContactRelationship,
  mp.emergencyContactPhone,
  m.serviceNotes
FROM service_request sr
LEFT JOIN person mp ON sr.memberPersonId = mp.id
LEFT JOIN active_member m ON mp.id = m.personId
WHERE sr.id = ?
```

(Note the pre-existing duplicate alias `memberPersonId` — `sr.memberPersonId` then `mp.id as memberPersonId` — is preserved as-is; both always carry the same value because of the join condition. Renaming only, no behavior change.)

- [ ] **Step 5: Verify no snake_case tokens remain and table names survived**

```bash
cd /home/csmig/dev/tvcri/vg-email-sidecar
grep -rnE '\b(request_number|service_name|village_id|member_person_id|volunteer_person_id|start_at|appt_time|return_time|finish_at|transportation_type|member_name|member_email|member_phone|member_cell|member_address|member_city|member_state|member_zip|emergency_contact_name|emergency_contact_relationship|emergency_contact_phone|service_notes|full_name|person_id|event_type|service_request_id|created_at|sent_at|failed_at|prior_count|volunteer_id|capability_id)\b' src/ test/ preview-templates.js; echo "exit=$?"
grep -cE 'FROM (service_request|notification_event|person|active_member|active_volunteer|volunteer_capability|capability)\b|JOIN (person|active_member|active_volunteer|volunteer_capability|capability)\b' src/queries.js
```

Expected: first grep prints nothing, `exit=1`; second grep shows table names intact (non-zero count).

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test`
Expected: ALL PASS.

- [ ] **Step 7: Regenerate previews and byte-diff against baseline**

```bash
cd /home/csmig/dev/tvcri/vg-email-sidecar
node preview-templates.js
diff -r /tmp/claude-1000/-home-csmig-dev-tvcri-vg-email-sidecar/f0e2deff-f152-4995-a12c-e21370139b74/scratchpad/preview-baseline preview/
echo "diff exit=$?"
```

Expected: no output, `diff exit=0` (byte-identical HTML).

- [ ] **Step 8: Commit**

```bash
cd /home/csmig/dev/tvcri/vg-email-sidecar
git add src/queries.js src/db.js src/email-processor.js src/templates.js src/send-corrections.js test/email-processor.test.js test/send-corrections.test.js preview-templates.js
git commit -m "refactor: adopt camelCase column names after DB migration

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Live verification against the dev database

**Files:**
- Create: `/tmp/claude-1000/-home-csmig-dev-tvcri-vg-email-sidecar/f0e2deff-f152-4995-a12c-e21370139b74/scratchpad/verify-queries.js` (scratchpad only — NOT committed)

**Interfaces:**
- Consumes: `src/db.js` exports (`getPendingEmailEvents()`, `getServiceRequest(id)`, `getPerson(id)`, `getVolunteersByCapability(villageId, capabilityName)`, `getPriorOpenCount(serviceRequestId)`) from Task 1, now returning camelCase keys.
- Produces: evidence that every query executes against the migrated schema and returns the expected camelCase keys. Read-only — do not run `markNotificationSent`/`markNotificationFailed` (they UPDATE rows).

- [ ] **Step 1: Write the verification script**

```js
// verify-queries.js — read-only smoke test of every SELECT against the dev DB.
process.env.DB_HOST = '127.0.0.1';
process.env.DB_PORT = '60001';
process.env.DB_USER = 'vg';
process.env.DB_PASSWORD = 'vgpw';
process.env.DB_NAME = 'vg';

const mysql = require('mysql2/promise');
const db = require('/home/csmig/dev/tvcri/vg-email-sidecar/src/db.js');

function assertKeys(label, obj, keys) {
  const missing = keys.filter((k) => !(k in obj));
  if (missing.length) throw new Error(`${label}: missing keys ${missing.join(', ')} (got: ${Object.keys(obj).join(', ')})`);
  console.log(`OK ${label}: ${Object.keys(obj).join(', ')}`);
}

async function main() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1', port: 60001, user: 'vg', password: 'vgpw', database: 'vg',
  });
  // Pick a real SR that has a member, and any person id, straight from the DB.
  const [[sr]] = await conn.query(
    'SELECT id, villageId, memberPersonId FROM service_request WHERE memberPersonId IS NOT NULL ORDER BY id DESC LIMIT 1'
  );
  await conn.end();
  if (!sr) throw new Error('no service_request rows with a member in dev DB');

  const events = await db.getPendingEmailEvents();
  console.log(`OK GET_PENDING_EVENTS: ${events.length} pending row(s)`);
  if (events[0]) assertKeys('pending event', events[0], ['id', 'eventType', 'serviceRequestId', 'createdAt']);

  const req = await db.getServiceRequest(sr.id);
  assertKeys(`GET_SERVICE_REQUEST #${sr.id}`, req, [
    'id', 'requestNumber', 'serviceName', 'villageId', 'memberPersonId', 'volunteerPersonId',
    'status', 'description', 'instructions', 'startAt', 'apptTime', 'returnTime', 'finishAt',
    'address', 'city', 'state', 'zip', 'destination', 'phone', 'transportationType',
    'memberName', 'memberEmail', 'memberPhone', 'memberCell', 'memberAddress', 'memberCity',
    'memberState', 'memberZip', 'emergencyContactName', 'emergencyContactRelationship',
    'emergencyContactPhone', 'serviceNotes',
  ]);

  const person = await db.getPerson(sr.memberPersonId);
  assertKeys(`GET_PERSON #${sr.memberPersonId}`, person, ['id', 'fullName', 'email', 'phone', 'cell']);

  const vols = await db.getVolunteersByCapability(sr.villageId, 'Rides');
  console.log(`OK GET_VOLUNTEERS_BY_CAPABILITY: ${vols.length} volunteer(s) for village ${sr.villageId} / Rides`);
  if (vols[0]) assertKeys('volunteer', vols[0], ['id', 'fullName', 'email']);

  const count = await db.getPriorOpenCount(sr.id);
  if (typeof count !== 'number' && typeof count !== 'bigint') {
    throw new Error(`GET_PRIOR_OPEN_COUNT returned ${typeof count}: ${count} — priorCount alias broken?`);
  }
  console.log(`OK GET_PRIOR_OPEN_COUNT #${sr.id}: ${count}`);

  console.log('\nAll queries verified against dev DB.');
}

main().catch((err) => { console.error('FAIL:', err.message); process.exit(1); });
```

- [ ] **Step 2: Run it**

Run: `node /tmp/claude-1000/-home-csmig-dev-tvcri-vg-email-sidecar/f0e2deff-f152-4995-a12c-e21370139b74/scratchpad/verify-queries.js`
Expected output: `OK …` line for each query, ending `All queries verified against dev DB.` If any query errors with `Unknown column`, the mapping missed a column — fix `src/queries.js` against `information_schema.COLUMNS`, re-run `npm test`, amend the Task 1 commit.

- [ ] **Step 3: Verify GET_VOLUNTEER query (not exported by db.js) directly**

`queries.GET_VOLUNTEER` has no db.js wrapper; check its SQL parses and the columns exist:

```bash
mysql -h 127.0.0.1 -P 60001 -u vg -pvgpw vg -e "
SELECT v.id, v.personId, p.fullName, p.email
FROM active_volunteer v JOIN person p ON v.personId = p.id
LIMIT 1;"
```

Expected: one row (or empty set) with headers `id personId fullName email`, no `Unknown column` error.

- [ ] **Step 4: Final test sweep and cleanup**

```bash
cd /home/csmig/dev/tvcri/vg-email-sidecar && npm test && git status --short
```

Expected: all tests PASS; only `preview/*.html` may show as modified (regenerated, byte-identical content — leave or restore with `git checkout -- preview/` if diff-clean). Nothing else uncommitted.

---

## Self-Review

1. **Spec coverage:** The spec is "refactor sidecar for camelCase columns." Task 1 renames SQL + all JS consumers (every file with a matching token per the repo-wide grep); Task 2 proves the queries run against the migrated dev DB. `src/config.js`, `src/index.js`, `src/gmail.js`, `src/send-apology.js`, `test/gmail.test.js` have zero matching tokens — confirmed by grep, no task needed.
2. **Placeholder scan:** All steps carry exact commands, exact code, expected output. No TBDs.
3. **Type consistency:** camelCase names in Task 2's `assertKeys` lists match Task 1's mapping table and the `information_schema.COLUMNS` output captured during planning (e.g. `apptTime`, `emergencyContactRelationship`, `serviceNotes`, `fullName`, `personId`).
