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
