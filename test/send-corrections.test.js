const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  formatDateForSubject,
  buildSubject,
  injectCorrectionNotice,
  injectTestBanner,
} = require('../src/send-corrections.js');

test('formatDateForSubject renders M/D/YYYY in Eastern time', () => {
  // 2026-07-02 04:00:00 UTC == 2026-07-02 00:00 EDT -> same calendar day.
  assert.equal(formatDateForSubject('2026-07-02T04:00:00Z'), '7/2/2026');
  // 2026-07-02 02:00:00 UTC == 2026-07-01 22:00 EDT -> previous day in Eastern.
  assert.equal(formatDateForSubject('2026-07-02T02:00:00Z'), '7/1/2026');
  assert.equal(formatDateForSubject(null), '');
});

test('buildSubject prefixes CORRECTED and uses the SR Request format', () => {
  const subject = buildSubject({ id: 1530, member_name: 'McGaw, Lee', start_at: '2026-07-02T04:00:00Z' });
  assert.equal(subject, 'CORRECTED: SR Request #1530-For McGaw, Lee-Service Date: 7/2/2026');
});

test('injectCorrectionNotice inserts the bold red notice above the content row', () => {
  const anchor = "<td align='left' style='font-family: Arial, Sans-Serif;font-size:12px;font-weight:normal;border-bottom:1px solid #cdcdcd;'>";
  const html = `<tr>\n<td>HEADER</td>\n</tr>\n<tr>\n${anchor}Hello,</td>\n</tr>`;
  const out = injectCorrectionNotice(html);
  assert.match(out, /INCORRECT TIMES/);
  assert.match(out, /We apologize for this error/);
  assert.match(out, /font-weight:bold/);
  assert.match(out, /background-color:#fdecea/);
  // Notice appears before the original content cell, and the anchor is preserved.
  assert.ok(out.indexOf('INCORRECT TIMES') < out.indexOf('Hello,'), 'notice precedes content');
  assert.ok(out.includes(anchor), 'content anchor preserved');
});

test('injectCorrectionNotice throws when the anchor is absent', () => {
  assert.throws(() => injectCorrectionNotice('<html>no anchor here</html>'), /anchor not found/);
});

test('injectTestBanner lists intended recipients before the closing table', () => {
  const html = "<body>X</table>\n      </td>\n    </tr>\n  </table>\n</body>";
  const out = injectTestBanner(html, [
    { full_name: 'Neill Barber', email: 'neill@example.com' },
    { full_name: 'Linda Flinton', email: 'linda@example.com' },
  ]);
  assert.match(out, /TEST MODE:/);
  assert.match(out, /Neill Barber \(neill@example.com\)/);
  assert.match(out, /Linda Flinton \(linda@example.com\)/);
});
