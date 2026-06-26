const fs = require('fs');
const { google } = require('googleapis');
const { getGmailConfig } = require('./config');

const FROM_ADDRESS = 'services@villagecommonri.org';
const FROM_NAME = 'The Village Common of RI';

function buildAuthClient() {
  const { tokenPath } = getGmailConfig();
  const { client_id, client_secret, refresh_token } = JSON.parse(
    fs.readFileSync(tokenPath, 'utf8')
  );
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret);
  oAuth2Client.setCredentials({ refresh_token });
  return oAuth2Client;
}

function encodeHeader(text) {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(text)) return text;
  return `=?UTF-8?B?${Buffer.from(text, 'utf8').toString('base64')}?=`;
}

function buildRawMessage({ to, bcc, subject, html, from }) {
  // Gmail requires a recipient somewhere (To, Cc, or Bcc) — not specifically a
  // To: header. When `to` is omitted we send a "blind" message carried by Bcc:
  // and leave out To: entirely, so guard against the no-recipient case.
  if (!to && !bcc) {
    throw new Error('buildRawMessage requires either a "to" or "bcc" recipient');
  }

  const messageParts = [
    `From: ${from}`,
    ...(to ? [`To: ${to}`] : []),
    ...(bcc ? [`Bcc: ${bcc}`] : []),
    `Subject: ${encodeHeader(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    '',
    html,
  ];
  const message = messageParts.join('\r\n');

  return Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function sendEmail({ to, bcc, subject, html }) {
  try {
    const auth = buildAuthClient();
    const gmail = google.gmail({ version: 'v1', auth });

    const raw = buildRawMessage({
      to,
      bcc,
      subject,
      html,
      from: `${FROM_NAME} <${FROM_ADDRESS}>`,
    });

    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    });

    return { success: true, messageId: res.data.id };
  } catch (error) {
    console.error('Failed to send email:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = { sendEmail };
