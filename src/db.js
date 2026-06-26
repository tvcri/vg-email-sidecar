const mysql = require('mysql2/promise');
const queries = require('./queries');

function getDbConfig() {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'vg',
    timezone: 'Z',
  };
}

async function createConnection() {
  return mysql.createConnection(getDbConfig());
}

async function initializePool() {
  const conn = await createConnection();
  await conn.end();
  return true;
}

async function getPendingEmailEvents() {
  const conn = await createConnection();
  try {
    const [rows] = await conn.query(queries.GET_PENDING_EVENTS);
    return rows;
  } finally {
    await conn.end();
  }
}

async function markEmailEventSent(eventId) {
  const conn = await createConnection();
  try {
    await conn.query(queries.MARK_EMAIL_SENT, [eventId]);
  } finally {
    await conn.end();
  }
}

async function getServiceRequest(serviceRequestId) {
  const conn = await createConnection();
  try {
    const [rows] = await conn.query(queries.GET_SERVICE_REQUEST, [serviceRequestId]);
    return rows[0] || null;
  } finally {
    await conn.end();
  }
}

async function getVolunteer(volunteerId) {
  const conn = await createConnection();
  try {
    const [rows] = await conn.query(queries.GET_VOLUNTEER, [volunteerId]);
    return rows[0] || null;
  } finally {
    await conn.end();
  }
}

async function getPerson(personId) {
  const conn = await createConnection();
  try {
    const [rows] = await conn.query(queries.GET_PERSON, [personId]);
    return rows[0] || null;
  } finally {
    await conn.end();
  }
}

async function getVolunteersByCapability(villageId, capabilityName) {
  const conn = await createConnection();
  try {
    const [rows] = await conn.query(queries.GET_VOLUNTEERS_BY_CAPABILITY, [villageId, capabilityName]);
    return rows;
  } finally {
    await conn.end();
  }
}

async function closePool() {
  // No-op for simple connection approach
}

module.exports = {
  initializePool,
  getPendingEmailEvents,
  markEmailEventSent,
  getServiceRequest,
  getPerson,
  getVolunteersByCapability,
  closePool,
};
