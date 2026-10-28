const { test, beforeEach } = require('node:test')
const assert = require('node:assert/strict')

// Seam: swap the db and gmail functions before the processor destructures them.
const db = require('../src/db.js')
const gmail = require('../src/gmail.js')

let pool, sentCalls, marked
db.getPendingEmailEvents = async () => [{ id: 7, eventType: 'open', serviceRequestId: 70 }]
db.getServiceRequest = async () => ({
  id: 70, requestNumber: null, serviceName: 'Ride: Shopping', villageId: 1,
  serviceDate: '2030-06-10', memberName: 'Example, Pat', description: 'x', volunteerPersonId: null,
})
db.getVolunteersByCapability = async () => pool
db.getPriorOpenCount = async () => 0
db.markNotificationSent = async (id, ids) => { marked.push({ id, status: 'sent', ids }) }
db.markNotificationFailed = async (id) => { marked.push({ id, status: 'failed' }) }
gmail.sendEmail = async (msg) => { sentCalls.push(msg); return { success: true } }

const { pollOnce } = require('../src/email-processor.js')

// An open-ended 'all' pause covers whatever today is.
const pausedAll = { pauseStartDate: null, pauseEndDate: null, pauseScope: 'all' }
const pausedWindow = { pauseStartDate: '2030-06-01', pauseEndDate: '2030-06-15', pauseScope: 'window' }
const none = { pauseStartDate: null, pauseEndDate: null, pauseScope: null }

beforeEach(() => {
  delete process.env.TEST_RECIPIENTS
  sentCalls = []
  marked = []
})

test('every volunteer paused: marked sent with no recipients, nothing emailed', async () => {
  pool = [
    { id: 1, fullName: 'A, Pat', email: 'a@example.test', ...pausedAll },
    { id: 2, fullName: 'B, Sam', email: 'b@example.test', ...pausedWindow },
  ]
  await pollOnce()
  assert.equal(sentCalls.length, 0)
  assert.deepEqual(marked, [{ id: 7, status: 'sent', ids: [] }])
})

test('mixed pool: only unpaused volunteers are BCCd and recorded', async () => {
  pool = [
    { id: 1, fullName: 'A, Pat', email: 'a@example.test', ...pausedAll },
    { id: 2, fullName: 'B, Sam', email: 'b@example.test', ...pausedWindow },
    { id: 3, fullName: 'C, Lee', email: 'c@example.test', ...none },
  ]
  await pollOnce()
  assert.equal(sentCalls.length, 1)
  assert.equal(sentCalls[0].bcc, 'c@example.test')
  assert.deepEqual(marked, [{ id: 7, status: 'sent', ids: [3] }])
})

test('empty pool still fails, so it is not mistaken for a pause', async () => {
  pool = []
  await pollOnce()
  assert.equal(sentCalls.length, 0)
  assert.deepEqual(marked, [{ id: 7, status: 'failed' }])
})
