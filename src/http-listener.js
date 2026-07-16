const http = require('node:http');
const { sendEmail } = require('./gmail');
const { getTestConfig, getHttpConfig } = require('./config');
const { buildEnrollPinTemplate, applyEnrollTestBanner } = require('./templates');

const PIN_SUBJECT = 'Your Village Green enrollment PIN';

// The PIN fast path: the API POSTs { email, pin, firstName, kind } without
// awaiting; the plaintext PIN exists only in memory here. Never log body.pin.
async function handleSendPin(body, sendEmailFn = sendEmail) {
  const { email, pin, firstName, kind } = body || {};
  if (!email || !pin) {
    return { ok: false, error: 'email and pin are required' };
  }
  const testConfig = getTestConfig();
  const to = testConfig.overrideRecipients ? testConfig.overrideRecipients.join(', ') : email;
  const subject = testConfig.overrideRecipients ? `[TEST] ${PIN_SUBJECT}` : PIN_SUBJECT;
  let html = buildEnrollPinTemplate({ firstName, pin, kind });
  if (testConfig.overrideRecipients) {
    html = applyEnrollTestBanner(html, email);
  }
  const result = await sendEmailFn({ to, subject, html, kind: 'enroll_pin' });
  if (result.success) {
    console.log(`[${new Date().toISOString()}] Enrollment PIN email sent to ${to}`);
  } else {
    console.error(`[${new Date().toISOString()}] Failed to send enrollment PIN email: ${result.error}`);
  }
  return { ok: result.success };
}

function startHttpListener() {
  const { port, host } = getHttpConfig();
  const server = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/internal/send-pin') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end('{"error":"not found"}');
      return;
    }
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      let body;
      try {
        body = JSON.parse(data);
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end('{"error":"invalid JSON"}');
        return;
      }
      if (!body.email || !body.pin) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end('{"error":"email and pin are required"}');
        return;
      }
      // Accept immediately; the send is fire-and-forget from the API's side.
      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end('{"accepted":true}');
      handleSendPin(body).catch((err) => {
        console.error(`[${new Date().toISOString()}] send-pin handler error: ${err.message}`);
      });
    });
  });
  server.listen(port, host, () => {
    console.log(`HTTP listener for /internal/send-pin on ${host}:${port}`);
  });
  return server;
}

module.exports = { startHttpListener, handleSendPin, PIN_SUBJECT };
