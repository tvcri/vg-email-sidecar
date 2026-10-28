const { test } = require('node:test')
const assert = require('node:assert/strict')
const mysql = require('mysql2/promise')
const { GET_VOLUNTEERS_BY_CAPABILITY } = require('../src/queries')

// Runs GET_VOLUNTEERS_BY_CAPABILITY against a real VG database at migration
// 0031 or later. Opt-in: set SIDECAR_DB_TEST=1 plus the usual DB_* variables.
// It borrows two active volunteers from one capability pool, pauses them
// inside a transaction, and always rolls back, so any populated VG database
// (the test/api harness, a side copy of a prod dump) works and is left as is.
const enabled = process.env.SIDECAR_DB_TEST === '1'

test('volunteer pool carries pause columns without duplicating anyone', { skip: !enabled && 'set SIDECAR_DB_TEST=1 to run' }, async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'vg',
    timezone: 'Z',
  })
  try {
    await conn.beginTransaction()
    const [[pick]] = await conn.query(`
      SELECT p.villageId, c.name AS capability
        FROM active_volunteer v
        JOIN person p ON v.personId = p.id
        JOIN volunteer_capability vc ON v.id = vc.volunteerId
        JOIN capability c ON vc.capabilityId = c.id
       WHERE p.villageId IS NOT NULL
       GROUP BY p.villageId, c.name
      HAVING COUNT(DISTINCT v.id) >= 3
       LIMIT 1`)
    assert.ok(pick, 'needs a village + capability pool of at least 3 active volunteers')
    const args = [pick.villageId, pick.capability]

    const [before] = await conn.query(GET_VOLUNTEERS_BY_CAPABILITY, args)
    assert.ok(before.every(r => r.pauseScope === null && r.pauseStartDate === null && r.pauseEndDate === null))

    const [[a], [b]] = await Promise.all(before.slice(0, 2).map(r =>
      conn.query('SELECT id FROM volunteer WHERE personId = ?', [r.id]).then(([rows]) => rows)))
    await conn.query(`DELETE FROM volunteer_pause WHERE volunteerId IN (?, ?)`, [a.id, b.id])
    await conn.query(`INSERT INTO volunteer_pause (volunteerId, startDate, endDate, scope) VALUES
      (?, NULL, '2030-03-15', 'all'), (?, '2030-03-01', '2030-03-15', 'window')`, [a.id, b.id])

    const [after] = await conn.query(GET_VOLUNTEERS_BY_CAPABILITY, args)
    assert.deepEqual(after.map(r => r.id).sort(), before.map(r => r.id).sort())
    const byId = Object.fromEntries(after.map(r => [r.id, r]))
    const [pa, pb] = before.slice(0, 2).map(r => byId[r.id])
    // Civil strings, not Date objects: pause.js compares them lexically.
    assert.deepEqual([pa.pauseStartDate, pa.pauseEndDate, pa.pauseScope], [null, '2030-03-15', 'all'])
    assert.deepEqual([pb.pauseStartDate, pb.pauseEndDate, pb.pauseScope], ['2030-03-01', '2030-03-15', 'window'])
    assert.ok(after.filter(r => r.id !== pa.id && r.id !== pb.id).every(r => r.pauseScope === null))
  } finally {
    await conn.rollback()
    await conn.end()
  }
})
