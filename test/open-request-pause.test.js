const { test } = require('node:test')
const assert = require('node:assert/strict')

// Seam: swap the db function before the processor destructures it.
const db = require('../src/db.js')
let pool = []
db.getVolunteersByCapability = async () => pool
const { resolveRecipientsForOpenRequest } = require('../src/email-processor.js')

const req = { serviceName: 'Ride: Shopping', villageId: 1, serviceDate: '2027-04-02' }
const pausedAll = { pauseStartDate: '2027-03-01', pauseEndDate: '2027-03-15', pauseScope: 'all' }
const none = { pauseStartDate: null, pauseEndDate: null, pauseScope: null }

test('all-paused pool is suppressed, not failed', async () => {
  pool = [{ id: 1, fullName: 'A, Pat', email: 'a@example.test', ...pausedAll }]
  assert.deepEqual(await resolveRecipientsForOpenRequest(req, '2027-03-05'), { suppressed: true })
})

test('empty pool stays null (failed)', async () => {
  pool = []
  assert.equal(await resolveRecipientsForOpenRequest(req, '2027-03-05'), null)
})

test('paused volunteers are left out of the BCC', async () => {
  pool = [
    { id: 1, fullName: 'A, Pat', email: 'a@example.test', ...pausedAll },
    { id: 2, fullName: 'B, Sam', email: 'b@example.test', ...none },
  ]
  const r = await resolveRecipientsForOpenRequest(req, '2027-03-05')
  assert.equal(r.bcc, 'b@example.test')
  assert.deepEqual(r.resolvedVolunteers.map(v => v.id), [2])
})
