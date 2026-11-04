const { test } = require('node:test')
const assert = require('node:assert/strict')
const { easternToday, pauseSuppressesOpen } = require('../src/pause.js')
const { GET_VOLUNTEERS_BY_CAPABILITY } = require('../src/queries.js')

const mar = { pauseStartDate: '2027-03-01', pauseEndDate: '2027-03-15' }
const all = { ...mar, pauseScope: 'all' }
const win = { ...mar, pauseScope: 'window' }

test('all scope suppresses while today is covered', () => {
  assert.equal(pauseSuppressesOpen(all, { today: '2027-03-05', serviceDate: '2027-04-02' }), true)
  assert.equal(pauseSuppressesOpen({ ...all, pauseEndDate: null }, { today: '2030-01-01', serviceDate: '2027-04-02' }), true)
  assert.equal(pauseSuppressesOpen({ ...all, pauseStartDate: null, pauseEndDate: null }, { today: '2027-03-05', serviceDate: '2027-04-02' }), true)
})

test('window scope suppresses when the service date is covered', () => {
  assert.equal(pauseSuppressesOpen(win, { today: '2027-02-20', serviceDate: '2027-03-10' }), true)
  assert.equal(pauseSuppressesOpen(win, { today: '2027-03-05', serviceDate: '2027-04-02' }), false)
})

test('worked example from the spec (pause Mar 1 - Mar 15)', () => {
  const a = { today: '2027-03-05', serviceDate: '2027-04-02' }
  const b = { today: '2027-02-20', serviceDate: '2027-03-10' }
  assert.equal(pauseSuppressesOpen(all, a), true)
  assert.equal(pauseSuppressesOpen(all, b), false)
  assert.equal(pauseSuppressesOpen(win, a), false)
  assert.equal(pauseSuppressesOpen(win, b), true)
})

test('boundary dates are covered', () => {
  for (const d of ['2027-03-01', '2027-03-15']) {
    assert.equal(pauseSuppressesOpen(all, { today: d, serviceDate: '2027-06-01' }), true)
    assert.equal(pauseSuppressesOpen(win, { today: '2027-01-01', serviceDate: d }), true)
  }
  for (const d of ['2027-02-28', '2027-03-16']) {
    assert.equal(pauseSuppressesOpen(all, { today: d, serviceDate: '2027-06-01' }), false)
    assert.equal(pauseSuppressesOpen(win, { today: '2027-01-01', serviceDate: d }), false)
  }
})

test('no pause never suppresses', () => {
  const none = { pauseStartDate: null, pauseEndDate: null, pauseScope: null }
  assert.equal(pauseSuppressesOpen(none, { today: '2027-03-05', serviceDate: '2027-03-05' }), false)
  assert.equal(pauseSuppressesOpen({}, { today: '2027-03-05', serviceDate: '2027-03-05' }), false)
})

test('expired pause never suppresses', () => {
  const t = { today: '2027-06-01', serviceDate: '2027-06-02' }
  assert.equal(pauseSuppressesOpen(all, t), false)
  assert.equal(pauseSuppressesOpen(win, t), false)
})

test('easternToday gives the Eastern civil date', () => {
  assert.equal(easternToday(new Date('2026-11-01T03:30:00Z')), '2026-10-31')
})

test('volunteers query joins volunteer_pause and aliases its columns', () => {
  assert.match(GET_VOLUNTEERS_BY_CAPABILITY, /LEFT JOIN volunteer_pause vp ON vp\.volunteerId = v\.id/)
  assert.match(GET_VOLUNTEERS_BY_CAPABILITY, /DATE_FORMAT\(vp\.startDate, '%Y-%m-%d'\) AS pauseStartDate/)
  assert.match(GET_VOLUNTEERS_BY_CAPABILITY, /DATE_FORMAT\(vp\.endDate, '%Y-%m-%d'\) AS pauseEndDate/)
  assert.match(GET_VOLUNTEERS_BY_CAPABILITY, /vp\.scope AS pauseScope/)
})
