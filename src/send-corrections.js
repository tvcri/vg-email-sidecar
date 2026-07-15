'use strict';

// One-off: re-send each Ride: service request (id 1024..2003) as a CORRECTED
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
const { sendEmail } = require('./gmail');

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
  WHERE id >= 1024 AND id <= 2003 AND serviceName LIKE 'Ride:%'
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

// service_request.serviceDate is a wall-clock civil date ('YYYY-MM-DD'), not an
// instant - see the identical helper in email-processor.js. Never run it
// through new Date(isoString) + a timeZone option.
function formatDateForSubject(serviceDate) {
  if (!serviceDate) return '';
  const [year, month, day] = serviceDate.split('-').map(Number);
  return `${month}/${day}/${year}`;
}

function buildSubject(requestData) {
  return `CORRECTED: SR Request #${requestData.id}-For ${requestData.memberName}-Service Date: ${formatDateForSubject(requestData.serviceDate)}`;
}

// Mirrors resolveRecipientsForOpenRequest in email-processor.js, fixed to the
// 'Rides' capability. Returns null when there are no volunteer emails to send to.
async function resolveRecipients(requestData) {
  const testConfig = getTestConfig();
  const volunteers = await getVolunteersByCapability(requestData.villageId, 'Rides');
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

// The opening <tr> of the first content row in buildRidesOpenRequestTemplate's
// output (the row whose cell starts with "Hello,"). Unique within one rendered
// ride email. We insert our notice row as a sibling immediately before it, so the
// markup stays valid (no stray/empty <tr>).
const CONTENT_ROW_OPEN =
  "<tr>\n                  <td align='left' style='font-family: Arial, Sans-Serif;font-size:12px;font-weight:normal;border-bottom:1px solid #cdcdcd;'>";

const CORRECTION_NOTICE_ROW = `<tr>
                  <td>
                    <div style='margin:20px 15px; padding:12px; background-color:#fdecea; border:1px solid #f5c2c0; border-radius:4px; font-weight:bold; color:#611a15;'>
                      This Service Request was previously sent with INCORRECT TIMES. The original email showed times 4 hours ahead of what the Member requested. The content below has been corrected. We apologize for this error as we migrate our service request pipeline.
                    </div>
                  </td>
                </tr>
                `;

function injectCorrectionNotice(html) {
  if (!html.includes(CONTENT_ROW_OPEN)) {
    throw new Error('correction-notice anchor not found in rendered template');
  }
  // Insert the notice row as a sibling <tr> immediately before the content row.
  return html.replace(CONTENT_ROW_OPEN, CORRECTION_NOTICE_ROW + CONTENT_ROW_OPEN);
}

function injectTestBanner(html, intendedVolunteers) {
  const list = (intendedVolunteers || [])
    .map((v) => `${v.fullName} (${v.email})`)
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
  console.log(`Found ${ids.length} target Ride: service request(s) (id 1024..2003).`);
  if (dryRun) console.log('[DRY RUN] no emails will be sent.');

  let sent = 0, skipped = 0, failed = 0;

  for (const id of ids) {
    try {
      const requestData = await getServiceRequest(id);
      if (!requestData) {
        console.warn(`SR #${id}: not found, skipping`);
        skipped++;
        continue;
      }

      const recipients = await resolveRecipients(requestData);
      if (!recipients) {
        console.warn(`SR #${id}: no volunteers for 'Rides', skipping`);
        skipped++;
        continue;
      }

      const subject = buildSubject(requestData);

      if (dryRun) {
        console.log(`SR #${id} -> [${recipients.bcc}]${recipients.isTestMode ? ' (TEST MODE)' : ''} :: ${subject}`);
        skipped++;
        continue;
      }

      let html = buildRidesOpenRequestTemplate('Volunteer', requestData);
      html = injectCorrectionNotice(html);
      if (recipients.isTestMode) {
        html = injectTestBanner(html, recipients.intendedVolunteers);
      }

      const result = await sendEmail({
        to: 'services@villagecommonri.org',
        bcc: recipients.bcc,
        subject,
        html,
      });

      if (result.success) {
        console.log(`SR #${id}: sent -- ${subject}`);
        sent++;
      } else {
        console.error(`SR #${id}: send failed -- ${result.error}`);
        failed++;
      }
    } catch (err) {
      console.error(`SR #${id}: error -- ${err.message}`);
      failed++;
    }
  }

  console.log(`\nCorrection run complete: ${sent} sent, ${skipped} skipped, ${failed} failed.`);
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
