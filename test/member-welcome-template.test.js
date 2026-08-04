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
