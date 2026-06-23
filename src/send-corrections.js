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
const { getServiceRequest, getVolunteersByCapability } = require('./db');
const { getTestConfig } = require('./config');
const { buildRidesOpenRequestTemplate } = require('./templates');

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

// Eastern M/D/YYYY for the subject line (copied from email-processor.js: the
// server runs as UTC, so the timezone must be pinned to match the body).
function formatDateForSubject(isoDateTime) {
  if (!isoDateTime) return '';
  const date = new Date(isoDateTime);
  return date.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
  });
}

function buildSubject(requestData) {
  return `CORRECTED: SR Request #${requestData.id}-For ${requestData.member_name}-Service Date: ${formatDateForSubject(requestData.start_at)}`;
}

// Mirrors resolveRecipientsForOpenRequest in email-processor.js, fixed to the
// 'Rides' capability. Returns null when there are no volunteer emails to send to.
async function resolveRecipients(requestData) {
  const testConfig = getTestConfig();
  const volunteers = await getVolunteersByCapability(requestData.village_id, 'Rides');
  const volunteerEmails = volunteers.map((v) => v.email).filter(Boolean);
  if (volunteerEmails.length === 0) return null;

  if (testConfig.overrideRecipients) {
    return {
      bcc: testConfig.overrideRecipients.join(', '),
      intendedVolunteers: volunteers,
      isTestMode: true,
    };
  }
  return {
    bcc: volunteerEmails.join(', '),
    intendedVolunteers: null,
    isTestMode: false,
  };
}

// The opening tag of the first content cell in buildRidesOpenRequestTemplate's
// output. Unique within one rendered ride email. We insert our row right before it.
const CONTENT_CELL_OPEN =
  "<td align='left' style='font-family: Arial, Sans-Serif;font-size:12px;font-weight:normal;border-bottom:1px solid #cdcdcd;'>";

const CORRECTION_NOTICE_ROW = `<tr>
  <td>
    <div style='margin:20px 15px; padding:12px; background-color:#fdecea; border:1px solid #f5c2c0; border-radius:4px; font-weight:bold; color:#611a15;'>
      This Service Request was previously sent with INCORRECT TIMES. The original email showed times 4 hours ahead of what the Member requested. The content below has been corrected. We apologize for this error as we migrate our service request pipeline.
    </div>
  </td>
</tr>
                <tr>
                  `;

function injectCorrectionNotice(html) {
  if (!html.includes(CONTENT_CELL_OPEN)) {
    throw new Error('correction-notice anchor not found in rendered template');
  }
  // Replace only the first occurrence (the content row), closing our notice row
  // and re-opening the content <tr> + <td>.
  return html.replace(CONTENT_CELL_OPEN, CORRECTION_NOTICE_ROW + CONTENT_CELL_OPEN);
}

function injectTestBanner(html, intendedVolunteers) {
  const list = (intendedVolunteers || [])
    .map((v) => `${v.full_name} (${v.email})`)
    .join('<br>');
  const banner = `<tr>
            <td>
              <div style='margin: 20px 15px; padding: 10px; background-color: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; font-size: 11px; color: #333;'>
                <strong style='color: #856404;'>TEST MODE:</strong> This email was sent to test recipients. Intended recipients would have been:<br><br>
                ${list}
              </div>
            </td>
          </tr>`;
  return html.replace('</table>\n      </td>\n    </tr>\n  </table>\n</body>', `${banner}</table>\n      </td>\n    </tr>\n  </table>\n</body>`);
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

module.exports = { formatDateForSubject, buildSubject, injectCorrectionNotice, injectTestBanner };
