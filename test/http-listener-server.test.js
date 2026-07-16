const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { startHttpListener } = require('../src/http-listener');

// Boot a listener with a given key on an OS-assigned port, run fn(baseUrl),
// then close. Captures console.log/error output for reject-path assertions.
async function withServer(key, fn) {
  const prevKey = process.env.VG_ENROLL_SIDECAR_KEY;
  const prevPort = process.env.HTTP_PORT;
  const prevHost = process.env.HTTP_HOST;
  if (key === undefined) delete process.env.VG_ENROLL_SIDECAR_KEY;
  else process.env.VG_ENROLL_SIDECAR_KEY = key;
  process.env.HTTP_PORT = '0';
  process.env.HTTP_HOST = '127.0.0.1';

  const logs = [];
  const origLog = console.log;
  const origErr = console.error;
  console.log = (...a) => { logs.push(a.join(' ')); };
  console.error = (...a) => { logs.push(a.join(' ')); };

  const server = startHttpListener();
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    await fn(baseUrl, logs);
  } finally {
    console.log = origLog;
    console.error = origErr;
    await new Promise((resolve) => server.close(resolve));
    if (prevKey === undefined) delete process.env.VG_ENROLL_SIDECAR_KEY;
    else process.env.VG_ENROLL_SIDECAR_KEY = prevKey;
    if (prevPort === undefined) delete process.env.HTTP_PORT; else process.env.HTTP_PORT = prevPort;
    if (prevHost === undefined) delete process.env.HTTP_HOST; else process.env.HTTP_HOST = prevHost;
  }
}

function post(baseUrl, { authHeader, body }) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const headers = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) };
    if (authHeader) headers.Authorization = authHeader;
    const req = http.request(`${baseUrl}/internal/send-pin`, { method: 'POST', headers }, (res) => {
      let out = '';
      res.on('data', (c) => { out += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: out }));
    });
    req.on('error', reject);
    req.end(data);
  });
}

const PIN = '424242';

test('unset key rejects every request with 401', async () => {
  await withServer(undefined, async (baseUrl, logs) => {
    const res = await post(baseUrl, { authHeader: 'Bearer anything', body: { email: 'v@x.com', pin: PIN } });
    assert.equal(res.status, 401);
    assert.ok(!logs.join('\n').includes(PIN), 'PIN must not be logged on reject');
  });
});

test('wrong token is rejected with 401 and never logs the PIN', async () => {
  await withServer('right-secret', async (baseUrl, logs) => {
    const res = await post(baseUrl, { authHeader: 'Bearer wrong-secret', body: { email: 'v@x.com', pin: PIN } });
    assert.equal(res.status, 401);
    assert.ok(!logs.join('\n').includes(PIN), 'PIN must not be logged on reject');
  });
});

test('missing Authorization header is rejected with 401', async () => {
  await withServer('right-secret', async (baseUrl) => {
    const res = await post(baseUrl, { body: { email: 'v@x.com', pin: PIN } });
    assert.equal(res.status, 401);
  });
});

test('valid token is accepted with 202', async () => {
  // No Gmail creds in the test env: handleSendPin runs fire-and-forget after
  // the 202 is written, so its async failure does not affect the response.
  await withServer('right-secret', async (baseUrl) => {
    const res = await post(baseUrl, { authHeader: 'Bearer right-secret', body: { email: 'v@x.com', pin: PIN } });
    assert.equal(res.status, 202);
    assert.ok(res.body.includes('accepted'));
  });
});
