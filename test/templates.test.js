const { test } = require('node:test')
const assert = require('node:assert/strict')
const { buildCancelledTemplate, buildMemberCancelledTemplate } = require('../src/templates.js')

const ridesRequest = {
  serviceName: 'Ride: Medical Appnt',
  status: 'Member cancelled',
  memberName: 'Zelda Blow',
  memberAddress: '45 Benefit St',
  memberCity: 'Providence',
  memberState: 'RI',
  memberZip: '02903',
  startAt: '2025-12-29T14:00:00Z',
}

const errandsRequest = {
  serviceName: 'Errand: Pick up/delivery',
  status: 'Member cancelled',
  memberName: 'Zelda Blow',
  startAt: '2025-12-29T14:00:00Z',
}

test('buildMemberCancelledTemplate greets the member and states the cancellation', () => {
  const html = buildMemberCancelledTemplate('Zelda', errandsRequest)
  assert.match(html, /Hello Zelda\./)
  assert.match(html, /A service you requested has been cancelled\./)
  assert.match(html, /Reason:<\/td>\s*<td valign='top'>Member cancelled/)
  assert.match(html, /Service:<\/td>\s*<td valign='top'>Errand: Pick up\/delivery/)
})

test('buildMemberCancelledTemplate includes the volunteer-copy notice unconditionally', () => {
  const html = buildMemberCancelledTemplate('Zelda', errandsRequest)
  assert.match(html, /If a volunteer provider was confirmed for this request, s\/he has also been sent a copy of this email\./)
})

test('buildMemberCancelledTemplate shows pickup time for rides, date only for flexible services', () => {
  const ridesHtml = buildMemberCancelledTemplate('Zelda', ridesRequest)
  const errandsHtml = buildMemberCancelledTemplate('Zelda', errandsRequest)
  assert.match(ridesHtml, /Date\/Time:<\/td>\s*<td valign='top'>\w+, \w+ \d+, \d{4} \d+:\d{2}/)
  assert.match(errandsHtml, /Date\/Time:<\/td>\s*<td valign='top'>\w+, \w+ \d+, \d{4}<\/td>/)
})

test('buildCancelledTemplate (volunteer) retains confirmed-for-request phrasing', () => {
  const html = buildCancelledTemplate('Joanne', ridesRequest)
  assert.match(html, /Dear Joanne,/)
  assert.match(html, /THE FOLLOWING SERVICE REQUEST THAT YOU WERE CONFIRMED FOR HAS BEEN CANCELLED/)
})
