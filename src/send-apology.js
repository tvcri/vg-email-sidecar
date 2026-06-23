require('dotenv/config');

const { sendEmail } = require('./gmail');

const volunteerEmails = [
  'NEILL.BARBER@gmail.com',
  'barn62577@gmail.com',
  'lindaflinton@gmail.com',
  'maryforman2017@gmail.com',
  'caribcowgirl@hotmail.com',
  'bgooding88@gmail.com',
  'chrs.hwlnd@gmail.com',
  'larrylacroix@ymail.com',
  'katesea45@gmail.com',
  'dlischio628@gmail.com',
  'March.madness@outlook.com',
  'katetmccarthy3@gmail.com',
  'sheila.m.nixon.smn@gmail.com',
  'roneil1083@gmail.com',
  'crazycoots2@icloud.com',
  'hs.schwartz@gmail.com',
  'cslick@cox.net',
  'slingdig@gmail.com',
  'laurens5960@gmail.com',
];

const htmlBody = `<html>
<body style="font-family:Arial, Sans-Serif; font-size:12px; font-weight:normal;">
  <table border='0' cellpadding='50' cellspacing='0' style='background-color: #b2b2b2;width: 100%;'>
    <tr>
      <td align='center'>
        <table border='0' cellpadding='4' cellspacing='0' style='background-color:white; width:600px;border-width:1px;border-color:Black; border-style:solid;border-radius:10px;'>
          <tr>
            <td>
              <table cellpadding='0' cellspacing='0' border='0'>
                <tr>
                  <td style='font-weight: bold; font-size: 24px; font-family: Arial, Sans-Serif;padding:10px 5px;border-bottom:1px solid #cdcdcd;width:100%;'>
                    The Village Common of RI
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td>
              <table cellpadding='15' cellspacing='0' border='0'>
                <tr>
                  <td align='left' style='font-family: Arial, Sans-Serif;font-size:12px;font-weight:normal;border-bottom:1px solid #cdcdcd;'>
                    We apologize for accidentally sending a TEST email to you early this morning.<br><br>
                    <strong>PLEASE DISREGARD.</strong> Service Request emails sent around 1 am this morning are not actual Service Requests.<br><br>
                    Thank you for your understanding.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td>
              <div style='font-size:10px;font-style:italic;color:#666666'>
                This email was sent in response to the use of the Village Green platform by The Village Common of RI.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

async function sendApologies() {
  console.log(`Sending apology emails to ${volunteerEmails.length} volunteers...`);

  let sent = 0;
  let failed = 0;

  for (const email of volunteerEmails) {
    try {
      const result = await sendEmail({
        to: 'services@villagecommonri.org',
        bcc: email,
        subject: 'Apology - Test Email Sent in Error',
        html: htmlBody,
      });

      if (result.success) {
        console.log(`✓ Sent to ${email}`);
        sent++;
      } else {
        console.error(`✗ Failed to send to ${email}: ${result.error}`);
        failed++;
      }
    } catch (error) {
      console.error(`✗ Error sending to ${email}: ${error.message}`);
      failed++;
    }
  }

  console.log(`\nApology send complete: ${sent} sent, ${failed} failed`);
}

sendApologies().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
