const fs = require('fs');
const { google } = require('googleapis');

const TOKEN_PATH = './services-mailer-token.json';
const FROM_ADDRESS = 'services@villagecommonri.org';
const FROM_NAME = 'The Village Common of RI';

function buildAuthClient() {
  const { client_id, client_secret, refresh_token } = JSON.parse(
    fs.readFileSync(TOKEN_PATH, 'utf8')
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
  const messageParts = [
    `From: ${from}`,
    `To: ${to}`,
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
