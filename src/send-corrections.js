'use strict';

// One-off: re-send each Ride: service request (id <= 2003) as a CORRECTED
// open-request email to the same volunteers. The original emails showed ride
// times 4h ahead (old UTC-rendering bug, since fixed in templates.js); this
// re-renders the corrected DB rows through the current Eastern-time template.
//
// Operator-run (NOT run by the agent):
//   node src/send-corrections.js --dry-run   # list targets + recipients, send nothing
//   node src/send-corrections.js             # send (set TEST_RECIPIENTS first for a test pass)

require('dotenv/config');
const mysql = require('mysql2/promise');

function getDbConfig() {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'vg',
  };
}

const TARGET_QUERY = `
  SELECT id
  FROM service_request
  WHERE id <= 2003 AND service_name LIKE 'Ride:%'
  ORDER BY id
`;

async function getTargetIds() {
  const conn = await mysql.createConnection(getDbConfig());
  try {
    const [rows] = await conn.query(TARGET_QUERY);
    return rows.map((r) => r.id);
  } finally {
    await conn.end();
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const ids = await getTargetIds();
  console.log(`Found ${ids.length} target Ride: service request(s) (id <= 2003): ${ids.join(', ')}`);
  if (dryRun) console.log('[DRY RUN] no emails will be sent.');
}

// Require-safe: only run when invoked directly, so tests can import helpers
// without sending email or querying the DB.
if (require.main === module) {
  main().catch((err) => {
    console.error('FATAL:', err.message);
    process.exit(1);
  });
}

module.exports = {};
