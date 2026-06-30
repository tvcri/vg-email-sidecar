const {
  markNotificationSent,
  markNotificationFailed,
  getServiceRequest,
  getPerson,
  getVolunteersByCapability,
  getPendingEmailEvents,
  getPriorOpenCount,
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
  buildCancelledTemplate,
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

const SUBJECT_ORDINALS = [null, '2nd', '3rd', '4th'];
const BODY_ORDINALS = [null, 'SECOND REQUEST', 'THIRD REQUEST', 'FOURTH REQUEST'];

function getSubjectOrdinal(priorCount) {
  if (priorCount >= SUBJECT_ORDINALS.length) {
    console.warn(`Unexpected prior open count: ${priorCount}; no subject ordinal applied`);
    return null;
  }
  return SUBJECT_ORDINALS[priorCount];
}

function getBodyOrdinalPrefix(priorCount) {
  if (priorCount >= BODY_ORDINALS.length) {
    console.warn(`Unexpected prior open count: ${priorCount}; no body ordinal applied`);
    return null;
  }
  return BODY_ORDINALS[priorCount];
}

function buildSubject(baseSubject, isTestMode) {
  return isTestMode ? `[TEST] ${baseSubject}` : baseSubject;
}

async function buildOpenSubjectAndDescription({ subjectNumber, memberName, startAt, description, serviceRequestId, isTestMode, getPriorOpenCountFn }) {
  const priorCount = await getPriorOpenCountFn(serviceRequestId);
  const subjectOrdinal = getSubjectOrdinal(priorCount);
  const bodyPrefix = getBodyOrdinalPrefix(priorCount);

  const dateStr = formatDateForSubject(startAt);
  const baseSubject = subjectOrdinal
    ? `${subjectOrdinal} SR Request #${subjectNumber}-For ${memberName}-Service Date: ${dateStr}`
    : `SR Request #${subjectNumber}-For ${memberName}-Service Date: ${dateStr}`;

  const subject = buildSubject(baseSubject, isTestMode);

  const finalDescription = bodyPrefix
    ? `${bodyPrefix} ${description}`
    : description;

  return { subject, description: finalDescription };
}

function applyTestBanner(html, intendedList) {
  const notice = `<tr>
            <td>
              <div style='margin: 20px 15px; padding: 10px; background-color: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; font-size: 11px; color: #333;'>
                <strong style='color: #856404;'>TEST MODE:</strong> This email was sent to test recipients. Intended recipients would have been:<br><br>
                ${intendedList}
              </div>
            </td>
          </tr>`;
  return html.replace('</table>\n      </td>\n    </tr>\n  </table>\n</body>', `${notice}</table>\n      </td>\n    </tr>\n  </table>\n</body>`);
}

function deriveRecipientsForEvent(eventType, requestData) {
  if (eventType === 'open') {
    return { sendToBccVolunteers: true, sendToVolunteer: false, sendToMember: false }
  }
  if (eventType === 'confirmed') {
    return { sendToBccVolunteers: false, sendToVolunteer: true, sendToMember: true }
  }
  if (eventType === 'cancelled') {
    const hasVolunteer = !!requestData.volunteer_person_id
    return { sendToBccVolunteers: false, sendToVolunteer: hasVolunteer, sendToMember: true }
  }
  if (eventType === 'reminder') {
    return { sendToBccVolunteers: false, sendToVolunteer: true, sendToMember: true }
  }
  return { sendToBccVolunteers: false, sendToVolunteer: false, sendToMember: false }
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
      // resolvedVolunteers is the real capability-matched pool, recorded in
      // recipients regardless of test mode. intendedVolunteers drives the
      // test-mode banner only.
      resolvedVolunteers: volunteers,
      intendedVolunteers: volunteers,
      isTestMode: true,
    };
  }

  return {
    bcc: bccList,
    volunteerNames: volunteers.map(v => v.full_name),
    resolvedVolunteers: volunteers,
    intendedVolunteers: null,
    isTestMode: false,
  };
}

async function resolveRecipientsForConfirmedRequest(requestData) {
  const testConfig = getTestConfig();

  const volunteer = await getPerson(requestData.volunteer_person_id);

  if (!volunteer || !volunteer.email) {
    console.warn(`Volunteer person not found or has no email: ${requestData.volunteer_person_id}`);
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
      // Only redirect a member send to the test recipients when the member
      // actually has an email in prod; otherwise keep it null so test mode
      // mirrors prod (which skips the member send) instead of fabricating an
      // extra email and recording a member recipient prod would never notify.
      memberEmail: memberEmail ? testConfig.overrideRecipients.join(', ') : null,
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

async function resolveRecipientsForCancelledRequest(requestData) {
  const testConfig = getTestConfig();

  const volunteer = await getPerson(requestData.volunteer_person_id);

  if (!volunteer || !volunteer.email) {
    console.warn(`Volunteer person not found or has no email: ${requestData.volunteer_person_id}`);
    return null;
  }

  const intendedRecipients = [{ full_name: volunteer.full_name, email: volunteer.email }];

  if (testConfig.overrideRecipients) {
    console.log(`[TEST MODE] Using override recipients: ${testConfig.overrideRecipients.join(', ')}`);
    return {
      volunteerEmail: testConfig.overrideRecipients.join(', '),
      volunteer,
      intendedRecipients,
      isTestMode: true,
    };
  }

  return {
    volunteerEmail: volunteer.email,
    volunteer,
    intendedRecipients: null,
    isTestMode: false,
  };
}

async function pollOnce() {
  const events = await getPendingEmailEvents();

  if (events.length === 0) {
    console.log(`[${new Date().toISOString()}] No pending notification events`);
    return;
  }

  console.log(`[${new Date().toISOString()}] Found ${events.length} pending notification event(s)`);

  let sent = 0;
  let failed = 0;

  for (const event of events) {
    try {
      console.log(`[${new Date().toISOString()}] Processing event #${event.id} (${event.event_type}) for SR #${event.service_request_id}`);
      const requestData = await getServiceRequest(event.service_request_id);

      if (!requestData) {
        console.error(`Service request not found: ${event.service_request_id}`);
        await markNotificationFailed(event.id);
        failed++;
        continue;
      }

      const routing = deriveRecipientsForEvent(event.event_type, requestData);
      const recipientPersonIds = [];

      // Legacy service requests carry a request_number from the old system that
      // volunteers recognize; show it in the subject when present, otherwise the
      // new database id.
      const subjectNumber = requestData.request_number || requestData.id;

      if (routing.sendToBccVolunteers) {
        const recipients = await resolveRecipientsForOpenRequest(requestData);
        if (recipients) {
          const { subject, description: openDescription } = await buildOpenSubjectAndDescription({
            subjectNumber,
            memberName: requestData.member_name,
            startAt: requestData.start_at,
            description: requestData.description,
            serviceRequestId: event.service_request_id,
            isTestMode: recipients.isTestMode,
            getPriorOpenCountFn: getPriorOpenCount,
          });
          const openRequestData = openDescription !== requestData.description
            ? { ...requestData, description: openDescription }
            : requestData;
          const html = getOpenRequestTemplate(requestData.service_name, 'Volunteer', openRequestData);
          let finalHtml = html;
          if (recipients.isTestMode) {
            const intendedStr = (recipients.intendedVolunteers || [])
              .map(v => `${v.full_name} (${v.email})`).join('<br>');
            finalHtml = applyTestBanner(html, intendedStr);
          }
          const result = await sendEmail({ bcc: recipients.bcc, subject, html: finalHtml });
          if (result.success) {
            console.log(`[${new Date().toISOString()}] Email sent: ${subject}`);
            recipientPersonIds.push(...recipients.resolvedVolunteers.map(v => v.id));
            await markNotificationSent(event.id, recipientPersonIds);
            sent++;
          } else {
            console.error(`[${new Date().toISOString()}] Failed to send email: ${result.error}`);
            await markNotificationFailed(event.id);
            failed++;
          }
        } else {
          await markNotificationFailed(event.id);
          failed++;
        }

      } else if (routing.sendToVolunteer && event.event_type === 'confirmed') {
        const recipients = await resolveRecipientsForConfirmedRequest(requestData);
        if (recipients) {
          const baseSubject = `SR Conf #${subjectNumber}-For ${requestData.member_name}-Service Date: ${formatDateForSubject(requestData.start_at)}`;
          const subject = buildSubject(baseSubject, recipients.isTestMode);
          const volunteerHtml = getConfirmedRequestTemplate(requestData.service_name, getFirstName(recipients.volunteer.full_name), requestData);
          const memberHtml = getMemberConfirmedTemplate(requestData.service_name, getFirstName(recipients.memberName), recipients.volunteer, requestData);

          let finalVolunteerHtml = volunteerHtml;
          let finalMemberHtml = memberHtml;
          if (recipients.isTestMode) {
            const intendedStr = (recipients.intendedRecipients || [])
              .map(r => `${r.full_name} (${r.email})`).join('<br>');
            finalVolunteerHtml = applyTestBanner(volunteerHtml, intendedStr);
            finalMemberHtml = applyTestBanner(memberHtml, intendedStr);
          }

          const volunteerResult = await sendEmail({ to: recipients.volunteerEmail, subject, html: finalVolunteerHtml });
          if (volunteerResult.success) {
            console.log(`[${new Date().toISOString()}] Volunteer email sent: ${subject}`);
            recipientPersonIds.push(recipients.volunteer.id);
          } else {
            console.error(`[${new Date().toISOString()}] Failed to send volunteer email: ${volunteerResult.error}`);
          }

          if (recipients.memberEmail) {
            const memberResult = await sendEmail({ to: recipients.memberEmail, subject, html: finalMemberHtml });
            if (memberResult.success) {
              console.log(`[${new Date().toISOString()}] Member email sent: ${subject}`);
              if (requestData.member_person_id) recipientPersonIds.push(Number(requestData.member_person_id));
            } else {
              console.error(`[${new Date().toISOString()}] Failed to send member email: ${memberResult.error}`);
            }
          }

          if (volunteerResult.success) {
            await markNotificationSent(event.id, recipientPersonIds);
            sent++;
          } else {
            await markNotificationFailed(event.id);
            failed++;
          }
        } else {
          await markNotificationFailed(event.id);
          failed++;
        }

      } else if (event.event_type === 'cancelled') {
        // The cancellation notice in the samples goes to the volunteer who was
        // confirmed for the request. With no confirmed volunteer there is no one
        // to notify, so the event is complete with no recipients.
        if (!requestData.volunteer_person_id) {
          console.log(`[${new Date().toISOString()}] SR #${requestData.id} cancelled with no confirmed volunteer; nothing to send`);
          await markNotificationSent(event.id, recipientPersonIds);
          sent++;
        } else {
          const recipients = await resolveRecipientsForCancelledRequest(requestData);
          if (recipients) {
            const baseSubject = `SR Cancel #${subjectNumber}-For ${requestData.member_name}-Service Date: ${formatDateForSubject(requestData.start_at)}`;
            const subject = buildSubject(baseSubject, recipients.isTestMode);
            const html = buildCancelledTemplate(getFirstName(recipients.volunteer.full_name), requestData);
            let finalHtml = html;
            if (recipients.isTestMode) {
              const intendedStr = (recipients.intendedRecipients || [])
                .map(r => `${r.full_name} (${r.email})`).join('<br>');
              finalHtml = applyTestBanner(html, intendedStr);
            }
            const result = await sendEmail({ to: recipients.volunteerEmail, subject, html: finalHtml });
            if (result.success) {
              console.log(`[${new Date().toISOString()}] Cancellation email sent: ${subject}`);
              recipientPersonIds.push(recipients.volunteer.id);
              await markNotificationSent(event.id, recipientPersonIds);
              sent++;
            } else {
              console.error(`[${new Date().toISOString()}] Failed to send cancellation email: ${result.error}`);
              await markNotificationFailed(event.id);
              failed++;
            }
          } else {
            await markNotificationFailed(event.id);
            failed++;
          }
        }

      } else if (event.event_type === 'reminder') {
        console.warn(`[${new Date().toISOString()}] No template yet for event_type=${event.event_type}, marking failed`);
        await markNotificationFailed(event.id);
        failed++;

      } else {
        console.warn(`[${new Date().toISOString()}] Unknown event_type=${event.event_type}`);
        await markNotificationFailed(event.id);
        failed++;
      }

    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error processing event ${event.id}:`, error.message);
      await markNotificationFailed(event.id);
      failed++;
    }
  }

  console.log(`[${new Date().toISOString()}] Poll complete: ${sent} sent, ${failed} failed`);
}

module.exports = { pollOnce, deriveRecipientsForEvent, getSubjectOrdinal, getBodyOrdinalPrefix, buildSubject, buildOpenSubjectAndDescription };
