const {
  markEmailEventSent,
  getServiceRequest,
  getPerson,
  getVolunteersByCapability,
  getPendingEmailEvents,
} = require('./db');
const { sendEmail } = require('./gmail');
const { getTestConfig } = require('./config');
const {
  buildHomeHelpOpenRequestTemplate,
  buildHomeHelpConfirmedRequestTemplate,
  buildRidesOpenRequestTemplate,
  buildRidesConfirmedRequestTemplate,
  buildErrandsOpenRequestTemplate,
  buildErrandsConfirmedRequestTemplate,
  buildTechSupportOpenRequestTemplate,
  buildTechSupportConfirmedRequestTemplate,
  buildRidesMemberConfirmedTemplate,
  buildHomeHelpMemberConfirmedTemplate,
  buildErrandsMemberConfirmedTemplate,
  buildTechSupportMemberConfirmedTemplate,
} = require('./templates');

const SERVICE_TYPE_TO_CAPABILITY = {
  'Ride: Medical Appnt': 'Rides',
  'Ride: Shopping': 'Rides',
  'Ride: Activity/Event': 'Rides',
  'Ride: Personal Care': 'Rides',
  'Ride: Other': 'Rides',
  'Household Chores/Handy Help': 'Home Help',
  'Tech Support': 'Tech Support',
  'Errand: Shopping': 'Errands',
  'Errand: Pick up/delivery': 'Errands',
  'Errand: Other': 'Errands',
};

// Service dates are stored as UTC; the subject must show the Eastern-time date so
// it matches the body and the volunteer's local date (the server runs as UTC).
function formatDateForSubject(isoDateTime) {
  if (!isoDateTime) return '';
  const date = new Date(isoDateTime);
  // en-US M/D/YYYY in Eastern time.
  return date.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
  });
}

function getFirstName(fullName) {
  if (!fullName) return '';
  // Handle "Last, First" format
  if (fullName.includes(',')) {
    const parts = fullName.split(',');
    return parts[1].trim().split(' ')[0];
  }
  // Handle "First Last" format
  return fullName.split(' ')[0];
}

function getOpenRequestTemplate(serviceName, volunteerName, requestData) {
  if (serviceName === 'Household Chores/Handy Help') {
    return buildHomeHelpOpenRequestTemplate(volunteerName, requestData);
  }
  if (serviceName.startsWith('Ride:')) {
    return buildRidesOpenRequestTemplate(volunteerName, requestData);
  }
  if (serviceName.startsWith('Errand:')) {
    return buildErrandsOpenRequestTemplate(volunteerName, requestData);
  }
  if (serviceName === 'Tech Support') {
    return buildTechSupportOpenRequestTemplate(volunteerName, requestData);
  }
  return buildRidesOpenRequestTemplate(volunteerName, requestData);
}

function getConfirmedRequestTemplate(serviceName, volunteerName, requestData) {
  if (serviceName === 'Household Chores/Handy Help') {
    return buildHomeHelpConfirmedRequestTemplate(volunteerName, requestData);
  }
  if (serviceName.startsWith('Ride:')) {
    return buildRidesConfirmedRequestTemplate(volunteerName, requestData);
  }
  if (serviceName.startsWith('Errand:')) {
    return buildErrandsConfirmedRequestTemplate(volunteerName, requestData);
  }
  if (serviceName === 'Tech Support') {
    return buildTechSupportConfirmedRequestTemplate(volunteerName, requestData);
  }
  return buildRidesConfirmedRequestTemplate(volunteerName, requestData);
}


function getMemberConfirmedTemplate(serviceName, memberFirstName, volunteerData, requestData) {
  if (serviceName === 'Household Chores/Handy Help') {
    return buildHomeHelpMemberConfirmedTemplate(memberFirstName, volunteerData, requestData);
  }
  if (serviceName.startsWith('Ride:')) {
    return buildRidesMemberConfirmedTemplate(memberFirstName, volunteerData, requestData);
  }
  if (serviceName.startsWith('Errand:')) {
    return buildErrandsMemberConfirmedTemplate(memberFirstName, volunteerData, requestData);
  }
  if (serviceName === 'Tech Support') {
    return buildTechSupportMemberConfirmedTemplate(memberFirstName, volunteerData, requestData);
  }
  return buildRidesMemberConfirmedTemplate(memberFirstName, volunteerData, requestData);
}

function getCapabilityFromServiceType(serviceName) {
  return SERVICE_TYPE_TO_CAPABILITY[serviceName] || null;
}

async function resolveRecipientsForOpenRequest(requestData) {
  const testConfig = getTestConfig();
  const capability = getCapabilityFromServiceType(requestData.service_name);

  if (!capability) {
    console.warn(`Unknown service type: ${requestData.service_name}`);
    return null;
  }

  const volunteers = await getVolunteersByCapability(requestData.village_id, capability);

  if (volunteers.length === 0) {
    console.warn(`No volunteers found for capability: ${capability}`);
    return null;
  }

  const volunteerEmails = volunteers.map(v => v.email).filter(Boolean);
  if (volunteerEmails.length === 0) {
    console.warn(`No volunteer emails found for capability: ${capability}`);
    return null;
  }

  const bccList = volunteerEmails.join(', ');

  if (testConfig.overrideRecipients) {
    console.log(`[TEST MODE] Using override recipients: ${testConfig.overrideRecipients.join(', ')}`);
    return {
      bcc: testConfig.overrideRecipients.join(', '),
      volunteerNames: volunteers.map(v => v.full_name),
      intendedVolunteers: volunteers,
      isTestMode: true,
    };
  }

  return {
    bcc: bccList,
    volunteerNames: volunteers.map(v => v.full_name),
    intendedVolunteers: null,
    isTestMode: false,
  };
}

async function resolveRecipientsForConfirmedRequest(event, requestData) {
  const testConfig = getTestConfig();

  const volunteer = await getPerson(event.volunteer_person_id);

  if (!volunteer || !volunteer.email) {
    console.warn(`Volunteer person not found or has no email: ${event.volunteer_person_id}`);
    return null;
  }

  const memberEmail = requestData.member_email;

  const intendedRecipients = [{ full_name: volunteer.full_name, email: volunteer.email }];
  if (memberEmail) {
    intendedRecipients.push({ full_name: requestData.member_name, email: memberEmail });
  }

  if (testConfig.overrideRecipients) {
    console.log(`[TEST MODE] Using override recipients: ${testConfig.overrideRecipients.join(', ')}`);
    return {
      volunteerEmail: testConfig.overrideRecipients.join(', '),
      memberEmail: testConfig.overrideRecipients.join(', '),
      volunteer,
      memberName: requestData.member_name,
      intendedRecipients,
      isTestMode: true,
    };
  }

  return {
    volunteerEmail: volunteer.email,
    memberEmail: memberEmail || null,
    volunteer,
    memberName: requestData.member_name,
    intendedRecipients: null,
    isTestMode: false,
  };
}

async function pollOnce() {
  const events = await getPendingEmailEvents();

  if (events.length === 0) {
    console.log(`[${new Date().toISOString()}] No pending email events`);
    return;
  }

  console.log(`[${new Date().toISOString()}] Found ${events.length} pending email event(s)`);

  let sent = 0;
  let failed = 0;

  for (const event of events) {
    try {
      console.log(`[${new Date().toISOString()}] Processing service request #${event.service_request_id}`);
      const requestData = await getServiceRequest(event.service_request_id);

      if (!requestData) {
        console.error(`Service request not found: ${event.service_request_id}`);
        failed++;
        continue;
      }

      let recipients = null;
      let html = '';
      let subject = '';
      let subjectPrefix = '';

      if (event.volunteer_person_id) {
        recipients = await resolveRecipientsForConfirmedRequest(event, requestData);
        if (recipients) {
          subjectPrefix = 'SR Conf';
          subject = `${subjectPrefix} #${requestData.id}-For ${requestData.member_name}-Service Date: ${formatDateForSubject(requestData.start_at)}`;

          const volunteerHtml = getConfirmedRequestTemplate(requestData.service_name, getFirstName(recipients.volunteer.full_name), requestData);
          const memberFirstName = getFirstName(recipients.memberName);
          const memberHtml = getMemberConfirmedTemplate(requestData.service_name, memberFirstName, recipients.volunteer, requestData);

          const addTestNotice = (baseHtml, intendedList) => {
            const notice = `<tr>
            <td>
              <div style='margin: 20px 15px; padding: 10px; background-color: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; font-size: 11px; color: #333;'>
                <strong style='color: #856404;'>TEST MODE:</strong> This email was sent to test recipients. Intended recipients would have been:<br><br>
                ${intendedList}
              </div>
            </td>
          </tr>`;
            return baseHtml.replace('</table>\n      </td>\n    </tr>\n  </table>\n</body>', `${notice}</table>\n      </td>\n    </tr>\n  </table>\n</body>`);
          };

          // Send volunteer email
          let finalVolunteerHtml = volunteerHtml;
          if (recipients.isTestMode) {
            const intendedStr = (recipients.intendedRecipients || [])
              .map(r => `${r.full_name} (${r.email})`).join('<br>');
            finalVolunteerHtml = addTestNotice(volunteerHtml, intendedStr);
          }
          const volunteerResult = await sendEmail({
            to: recipients.volunteerEmail,
            subject,
            html: finalVolunteerHtml,
          });

          if (volunteerResult.success) {
            console.log(`[${new Date().toISOString()}] Volunteer email sent: ${subject}`);
          } else {
            console.error(`[${new Date().toISOString()}] Failed to send volunteer email: ${volunteerResult.error}`);
            failed++;
          }

          // Send member email (only if member has an email address)
          if (recipients.memberEmail) {
            let finalMemberHtml = memberHtml;
            if (recipients.isTestMode) {
              const intendedStr = (recipients.intendedRecipients || [])
                .map(r => `${r.full_name} (${r.email})`).join('<br>');
              finalMemberHtml = addTestNotice(memberHtml, intendedStr);
            }
            const memberResult = await sendEmail({
              to: recipients.memberEmail,
              subject,
              html: finalMemberHtml,
            });

            if (memberResult.success) {
              console.log(`[${new Date().toISOString()}] Member email sent: ${subject}`);
            } else {
              console.error(`[${new Date().toISOString()}] Failed to send member email: ${memberResult.error}`);
              failed++;
            }
          }

          if (volunteerResult.success) {
            if (!recipients.isTestMode) {
              await markEmailEventSent(event.id);
            }
            sent++;
          }
        } else {
          failed++;
        }
      } else {
        recipients = await resolveRecipientsForOpenRequest(requestData);
        if (recipients) {
          html = getOpenRequestTemplate(requestData.service_name, 'Volunteer', requestData);
          subjectPrefix = 'SR Request';
        }
      }

      if (!event.volunteer_person_id && recipients && html) {
        // subject = `The Village Common of RI - ${subjectPrefix} #${requestData.id}-For ${requestData.member_name}-Service Date: ${formatDateForSubject(requestData.start_at)}`;
        subject = `${subjectPrefix} #${requestData.id}-For ${requestData.member_name}-Service Date: ${formatDateForSubject(requestData.start_at)}`;

        let finalHtml = html;
        if (recipients.isTestMode) {
          let intendedRecipientsList = '';
          if (recipients.intendedRecipients && recipients.intendedRecipients.length > 0) {
            intendedRecipientsList = recipients.intendedRecipients
              .map(r => `${r.full_name} (${r.email})`)
              .join('<br>');
          } else if (recipients.intendedVolunteers && recipients.intendedVolunteers.length > 0) {
            intendedRecipientsList = recipients.intendedVolunteers
              .map(v => `${v.full_name} (${v.email})`)
              .join('<br>');
          } else if (recipients.intendedVolunteer) {
            intendedRecipientsList = `${recipients.intendedVolunteer.full_name} (${recipients.intendedVolunteer.email})`;
          }

          const testNotice = `<tr>
            <td>
              <div style='margin: 20px 15px; padding: 10px; background-color: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; font-size: 11px; color: #333;'>
                <strong style='color: #856404;'>TEST MODE:</strong> This email was sent to test recipients. Intended recipients would have been:<br><br>
                ${intendedRecipientsList}
              </div>
            </td>
          </tr>`;

          finalHtml = html.replace('</table>\n      </td>\n    </tr>\n  </table>\n</body>', `${testNotice}</table>\n      </td>\n    </tr>\n  </table>\n</body>`);
        }

        const result = await sendEmail({
          bcc: recipients.bcc,
          subject,
          html: finalHtml,
        });

        if (result.success) {
          console.log(`[${new Date().toISOString()}] Email sent: ${subject}`);
          if (!recipients.isTestMode) {
            await markEmailEventSent(event.id);
          }
          sent++;
        } else {
          console.error(`[${new Date().toISOString()}] Failed to send email: ${result.error}`);
          failed++;
        }
      } else if (!event.volunteer_person_id) {
        failed++;
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error processing event ${event.id}:`, error.message);
      failed++;
    }
  }

  console.log(`[${new Date().toISOString()}] Poll complete: ${sent} sent, ${failed} failed`);
}

module.exports = { pollOnce };
