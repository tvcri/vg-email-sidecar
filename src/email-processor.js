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
  buildMemberCancelledTemplate,
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

// service_request.serviceDate is a wall-clock civil date ('YYYY-MM-DD'), not an
// instant - it is already the correct calendar day and must never be run through
// new Date(isoString) + a timeZone option (see templates.js for the same trap).
function formatDateForSubject(serviceDate) {
  if (!serviceDate) return '';
  const [year, month, day] = serviceDate.split('-').map(Number);
  return `${month}/${day}/${year}`;
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

async function buildOpenSubjectAndDescription({ subjectNumber, memberName, serviceDate, description, serviceRequestId, requestNumber, isTestMode, getPriorOpenCountFn }) {
  const dbCount = await getPriorOpenCountFn(serviceRequestId);
  // Legacy SRs (non-null requestNumber) had their first notification in the old system;
  // add 1 so the ordinal accounts for that presumed-sent original.
  const priorCount = dbCount + (requestNumber ? 1 : 0);

  if (priorCount >= SUBJECT_ORDINALS.length) {
    console.warn(`Unexpected prior open count: ${priorCount} for SR ${serviceRequestId}; no ordinal prefix applied`);
  }

  const subjectOrdinal = SUBJECT_ORDINALS[priorCount] ?? null;
  const bodyPrefix = BODY_ORDINALS[priorCount] ?? null;

  const dateStr = formatDateForSubject(serviceDate);
  const baseSubject = `${subjectOrdinal ? subjectOrdinal + ' ' : ''}SR Request #${subjectNumber}-For ${memberName}-Service Date: ${dateStr}`;
  const subject = buildSubject(baseSubject, isTestMode);

  const finalDescription = bodyPrefix
    ? `${bodyPrefix} ${description ?? ''}`
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
    const hasVolunteer = !!requestData.volunteerPersonId
    return { sendToBccVolunteers: false, sendToVolunteer: hasVolunteer, sendToMember: true }
  }
  if (eventType === 'reminder') {
    return { sendToBccVolunteers: false, sendToVolunteer: true, sendToMember: true }
  }
  return { sendToBccVolunteers: false, sendToVolunteer: false, sendToMember: false }
}

async function resolveRecipientsForOpenRequest(requestData) {
  const testConfig = getTestConfig();
  const capability = getCapabilityFromServiceType(requestData.serviceName);

  if (!capability) {
    console.warn(`Unknown service type: ${requestData.serviceName}`);
    return null;
  }

  const volunteers = await getVolunteersByCapability(requestData.villageId, capability);

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
      volunteerNames: volunteers.map(v => v.fullName),
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
    volunteerNames: volunteers.map(v => v.fullName),
    resolvedVolunteers: volunteers,
    intendedVolunteers: null,
    isTestMode: false,
  };
}

async function resolveRecipientsForConfirmedRequest(requestData) {
  const testConfig = getTestConfig();

  const volunteer = await getPerson(requestData.volunteerPersonId);

  if (!volunteer || !volunteer.email) {
    console.warn(`Volunteer person not found or has no email: ${requestData.volunteerPersonId}`);
    return null;
  }

  const memberEmail = requestData.memberEmail;

  const intendedRecipients = [{ fullName: volunteer.fullName, email: volunteer.email }];
  if (memberEmail) {
    intendedRecipients.push({ fullName: requestData.memberName, email: memberEmail });
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
      memberName: requestData.memberName,
      intendedRecipients,
      isTestMode: true,
    };
  }

  return {
    volunteerEmail: volunteer.email,
    memberEmail: memberEmail || null,
    volunteer,
    memberName: requestData.memberName,
    intendedRecipients: null,
    isTestMode: false,
  };
}

async function resolveRecipientsForCancelledRequest(requestData) {
  const testConfig = getTestConfig();

  const volunteer = requestData.volunteerPersonId
    ? await getPerson(requestData.volunteerPersonId)
    : null;

  if (requestData.volunteerPersonId && (!volunteer || !volunteer.email)) {
    console.warn(`Volunteer person not found or has no email: ${requestData.volunteerPersonId}`);
  }

  const memberEmail = requestData.memberEmail;

  const intendedRecipients = [];
  if (volunteer && volunteer.email) {
    intendedRecipients.push({ fullName: volunteer.fullName, email: volunteer.email });
  }
  if (memberEmail) {
    intendedRecipients.push({ fullName: requestData.memberName, email: memberEmail });
  }

  if (testConfig.overrideRecipients) {
    console.log(`[TEST MODE] Using override recipients: ${testConfig.overrideRecipients.join(', ')}`);
    return {
      volunteerEmail: (volunteer && volunteer.email) ? testConfig.overrideRecipients.join(', ') : null,
      memberEmail: memberEmail ? testConfig.overrideRecipients.join(', ') : null,
      volunteer,
      memberName: requestData.memberName,
      intendedRecipients,
      isTestMode: true,
    };
  }

  return {
    volunteerEmail: (volunteer && volunteer.email) ? volunteer.email : null,
    memberEmail: memberEmail || null,
    volunteer,
    memberName: requestData.memberName,
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
      console.log(`[${new Date().toISOString()}] Processing event #${event.id} (${event.eventType}) for SR #${event.serviceRequestId}`);
      const requestData = await getServiceRequest(event.serviceRequestId);

      if (!requestData) {
        console.error(`Service request not found: ${event.serviceRequestId}`);
        await markNotificationFailed(event.id);
        failed++;
        continue;
      }

      const routing = deriveRecipientsForEvent(event.eventType, requestData);
      const recipientPersonIds = [];

      // Legacy service requests carry a requestNumber from the old system that
      // volunteers recognize; show it in the subject when present, otherwise the
      // new database id.
      const subjectNumber = requestData.requestNumber || requestData.id;

      if (routing.sendToBccVolunteers) {
        const recipients = await resolveRecipientsForOpenRequest(requestData);
        if (recipients) {
          const { subject, description: openDescription } = await buildOpenSubjectAndDescription({
            subjectNumber,
            memberName: requestData.memberName,
            serviceDate: requestData.serviceDate,
            description: requestData.description,
            serviceRequestId: event.serviceRequestId,
            requestNumber: requestData.requestNumber,
            isTestMode: recipients.isTestMode,
            getPriorOpenCountFn: getPriorOpenCount,
          });
          const openRequestData = openDescription !== requestData.description
            ? { ...requestData, description: openDescription }
            : requestData;
          const html = getOpenRequestTemplate(requestData.serviceName, 'Volunteer', openRequestData);
          let finalHtml = html;
          if (recipients.isTestMode) {
            const intendedStr = (recipients.intendedVolunteers || [])
              .map(v => `${v.fullName} (${v.email})`).join('<br>');
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

      } else if (routing.sendToVolunteer && event.eventType === 'confirmed') {
        const recipients = await resolveRecipientsForConfirmedRequest(requestData);
        if (recipients) {
          const baseSubject = `SR Conf #${subjectNumber}-For ${requestData.memberName}-Service Date: ${formatDateForSubject(requestData.serviceDate)}`;
          const subject = buildSubject(baseSubject, recipients.isTestMode);
          const volunteerHtml = getConfirmedRequestTemplate(requestData.serviceName, getFirstName(recipients.volunteer.fullName), requestData);
          const memberHtml = getMemberConfirmedTemplate(requestData.serviceName, getFirstName(recipients.memberName), recipients.volunteer, requestData);

          let finalVolunteerHtml = volunteerHtml;
          let finalMemberHtml = memberHtml;
          if (recipients.isTestMode) {
            // Each email's banner should name only its own actual intended
            // recipient, not the combined list of everyone notified for this event.
            const [volunteerIntended, memberIntended] = recipients.intendedRecipients || [];
            if (volunteerIntended) {
              finalVolunteerHtml = applyTestBanner(volunteerHtml, `${volunteerIntended.fullName} (${volunteerIntended.email})`);
            }
            if (memberIntended) {
              finalMemberHtml = applyTestBanner(memberHtml, `${memberIntended.fullName} (${memberIntended.email})`);
            }
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
              if (requestData.memberPersonId) recipientPersonIds.push(Number(requestData.memberPersonId));
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

      } else if (event.eventType === 'cancelled') {
        const recipients = await resolveRecipientsForCancelledRequest(requestData);
        const baseSubject = `SR Cancel #${subjectNumber}-For ${requestData.memberName}-Service Date: ${formatDateForSubject(requestData.serviceDate)}`;
        const subject = buildSubject(baseSubject, recipients.isTestMode);

        // Each email's banner should name only its own actual intended
        // recipient, not the combined list of everyone notified for this event.
        const volunteerIntended = recipients.volunteer
          ? (recipients.intendedRecipients || []).find(r => r.email === recipients.volunteer.email)
          : null;
        const memberIntended = (recipients.intendedRecipients || []).find(r => r.fullName === recipients.memberName);

        let anySuccess = false;

        if (routing.sendToVolunteer && recipients.volunteerEmail) {
          const html = buildCancelledTemplate(getFirstName(recipients.volunteer.fullName), requestData);
          const finalHtml = recipients.isTestMode && volunteerIntended
            ? applyTestBanner(html, `${volunteerIntended.fullName} (${volunteerIntended.email})`)
            : html;
          const result = await sendEmail({ to: recipients.volunteerEmail, subject, html: finalHtml });
          if (result.success) {
            console.log(`[${new Date().toISOString()}] Volunteer cancellation email sent: ${subject}`);
            recipientPersonIds.push(recipients.volunteer.id);
            anySuccess = true;
          } else {
            console.error(`[${new Date().toISOString()}] Failed to send volunteer cancellation email: ${result.error}`);
          }
        }

        if (routing.sendToMember && recipients.memberEmail) {
          const html = buildMemberCancelledTemplate(getFirstName(recipients.memberName), requestData);
          const finalHtml = recipients.isTestMode && memberIntended
            ? applyTestBanner(html, `${memberIntended.fullName} (${memberIntended.email})`)
            : html;
          const result = await sendEmail({ to: recipients.memberEmail, subject, html: finalHtml });
          if (result.success) {
            console.log(`[${new Date().toISOString()}] Member cancellation email sent: ${subject}`);
            if (requestData.memberPersonId) recipientPersonIds.push(Number(requestData.memberPersonId));
            anySuccess = true;
          } else {
            console.error(`[${new Date().toISOString()}] Failed to send member cancellation email: ${result.error}`);
          }
        }

        if (anySuccess) {
          await markNotificationSent(event.id, recipientPersonIds);
          sent++;
        } else {
          console.warn(`[${new Date().toISOString()}] SR #${requestData.id} cancelled but no recipients could be emailed`);
          await markNotificationFailed(event.id);
          failed++;
        }

      } else if (event.eventType === 'reminder') {
        console.warn(`[${new Date().toISOString()}] No template yet for eventType=${event.eventType}, marking failed`);
        await markNotificationFailed(event.id);
        failed++;

      } else {
        console.warn(`[${new Date().toISOString()}] Unknown eventType=${event.eventType}`);
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
