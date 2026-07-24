// service_request.serviceDate and the TIME columns (startTime, finishTime,
// apptTime, returnTime) are wall-clock civil values, not instants - they are
// already in Eastern local time and carry no timezone of their own. Never
// construct a JS Date from them or timezone-convert them; parse the calendar
// fields directly. queries.js casts serviceDate with DATE_FORMAT(...) in SQL
// (matching village-green's own API) so mysql2 hands back a plain
// 'YYYY-MM-DD' string instead of auto-hydrating a DATE column into a JS Date
// at server-local midnight. The TIME columns arrive as 'HH:MM:SS' strings.
function formatServiceDate(serviceDate) {
  if (!serviceDate) return '';
  const [year, month, day] = serviceDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleString('en-US', {
    timeZone: 'UTC',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatCivilTime(timeString) {
  if (!timeString) return '';
  const [hourStr, minuteStr] = timeString.split(':');
  const hour24 = Number(hourStr);
  const minute = Number(minuteStr);
  const period = hour24 < 12 ? 'AM' : 'PM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${period}`;
}

// mysql2 hands back JS null for a NULL column (and LPAD(NULL,...) is NULL), so a
// missing zip/city/state would interpolate the literal string "null" into the
// address blocks. Coalesce every nullable address component to '' up front so no
// template can print "null". Non-address fields (names, dates, notes) are left
// untouched - they have their own `|| ''` guards where needed.
const ADDRESS_FIELDS = [
  'address', 'city', 'state', 'zip',
  'memberAddress', 'memberCity', 'memberState', 'memberZip',
  'start', 'startAddress', 'startCity', 'startState', 'startZip', 'startPhone',
  'memberPhone', 'memberCell',
];

function withBlankAddressNulls(rd) {
  const out = { ...rd };
  for (const f of ADDRESS_FIELDS) {
    if (out[f] == null) out[f] = '';
  }
  return out;
}

// Starting location for a service request. Prefers the authoritative start*
// fields (added by the VG sr-starting-address migration); falls back to the
// requesting member's home address when they are NULL or the columns don't exist
// yet (older schema, or legacy rows that were never backfilled). The `start` name label is
// optional decoration - the address is the substance - so we key off
// startAddress alone, mirroring how the home fallback needs no label beyond
// "Home". Matches the legacy one-line style; startPhone is intentionally not
// shown and no map link is added.
function formatStartingLocation(rd) {
  if (rd.startAddress) {
    const label = rd.start ? `${rd.start} - ` : '';
    return `${label}${rd.startAddress} ${rd.startCity}, ${rd.startState} ${rd.startZip}`;
  }
  if (rd.memberAddress) {
    return `Home - ${rd.memberAddress} ${rd.memberCity}, ${rd.memberState} ${rd.memberZip}`;
  }
  return '';
}

function buildHomeHelpOpenRequestTemplate(volunteerName, requestData) {
  requestData = withBlankAddressNulls(requestData);
  const {
    serviceName,
    memberName,
    memberPhone,
    memberCell,
    memberAddress,
    memberCity,
    memberState,
    memberZip,
    description,
    serviceNotes,
  } = requestData;

  const memberAddressBlock = memberAddress
    ? `${memberName}<br>${memberAddress}<br>${memberCity}, ${memberState} ${memberZip}<br>${memberPhone || ''}<br>${memberCell ? `Cell: ${memberCell}` : ''}`
    : '';

  const html = `<html>
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
                    <div>Hello,<br><br>
                    The Village Common of RI is seeking someone to provide ${serviceName} for ${memberName}.</div>
                    <div></div>
                    <div style='margin-left:15px;margin-top:4px;margin-bottom:10px;'>
                      <table style='font-family: Arial, sans-serif; font-size: 12px; font-weight: normal; width: 310px; height: 100px;' cellspacing='0' cellpadding='3' border='0'>
                        <tbody>
                          <tr>
                            <td>Short Description:</td>
                            <td>${description || ''}</td>
                          </tr>
                          <tr>
                            <td>Requesting Member:</td>
                            <td>
                              ${memberAddressBlock}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                      <table cellspacing='0' cellpadding='3' border='0' style='color: rgb(0, 0, 0); height: 19.600000023841858px; width: 307.60000002384186px; font-size: 12px; font-family: Arial, sans-serif; text-align: left;'>
                        <tbody>
                          <tr>
                            <td style='text-align: left;'><br></td>
                            <td style='text-align: left;'>&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <br>
                    Special instructions/info: ${serviceNotes || ''}<br><br>
                    Please let us know if you can help with this request by replying to this email.<br>
                    <br>
                    Thanks for all you do.<br>
                    <br>
                    The Village Common of RI<br>
                    <br>
                    &nbsp;<br>
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

  return html;
}

function buildHomeHelpConfirmedRequestTemplate(volunteerName, requestData) {
  requestData = withBlankAddressNulls(requestData);
  const {
    serviceName,
    memberName,
    memberPhone,
    memberCell,
    memberAddress,
    memberCity,
    memberState,
    memberZip,
    description,
    serviceNotes,
    emergencyContactName,
    emergencyContactRelationship,
    emergencyContactPhone,
  } = requestData;

  const memberAddressBlock = memberAddress
    ? `${memberName}<br>${memberAddress}<br>${memberCity}, ${memberState} ${memberZip}<br>${memberPhone || ''}<br>${memberCell ? `Cell: ${memberCell}` : ''}`
    : '';

  const html = `<html>
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
                    <div>Dear ${volunteerName},<br><br>
                    Thank you for agreeing to help The Village Common of RI provide ${serviceName} for ${memberName}.<br>
                    Short Description: ${description || ''}<br><br>
                    You are now confirmed as a service provider for this service request.</div>
                    <div style='margin-left:15px;margin-top:4px;margin-bottom:10px;'>
                      <table style='font-family: Arial, sans-serif; font-size: 12px; font-weight: normal;' cellspacing='0' cellpadding='3' border='0'>
                        <tbody>
                          <tr>
                            <td>Service:</td>
                            <td>${serviceName}</td>
                          </tr>
                          <tr>
                            <td>Requesting Member:</td>
                            <td>
                              ${memberAddressBlock}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <br>
                    Special Instructions for this member: ${serviceNotes || ''}<br><br>
                    Please call the member as soon as possible to arrange a time that works for both of you.<br>
                    <br>
                    If you have any questions or need to cancel this service, please call 401-441-5240 or reply to this email.<br>
                    <br>
                    ${emergencyContactName ? `Member's Emergency Contact:<br>${emergencyContactName}<br>${emergencyContactRelationship || ''}<br>${emergencyContactPhone || ''}<br><br>` : ''}
                    Thanks for all you do.<br><br>
                    The Village Common of RI<br>
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

  return html;
}

function buildRidesOpenRequestTemplate(volunteerName, requestData) {
  requestData = withBlankAddressNulls(requestData);
  const {
    serviceName,
    memberName,
    memberPhone,
    memberCell,
    memberAddress,
    memberCity,
    memberState,
    memberZip,
    description,
    address,
    city,
    state,
    zip,
    destination,
    serviceDate,
    timesFlexible,
    startTime,
    apptTime,
    returnTime,
    finishTime,
    transportationType,
    serviceNotes,
  } = requestData;

  const startDate = formatServiceDate(serviceDate);
  const pickupTime = formatCivilTime(startTime);
  const appointmentTime = formatCivilTime(apptTime);
  const returnPickupTime = formatCivilTime(returnTime);
  const dropoffTime = formatCivilTime(finishTime);

  const memberAddressBlock = memberAddress
    ? `${memberName}<br>${memberAddress}<br>${memberCity}, ${memberState} ${memberZip}<br>${memberPhone || ''}<br>${memberCell ? `${memberCell} (cell)` : ''}`
    : '';
  const startingLocation = formatStartingLocation(requestData);
  const destinationAddress = destination && address ? `${destination}<br>${address}<br>${city}, ${state} ${zip}` : (destination || '');
  const mapUrl = destination && address ? `https://maps.google.com/maps?q=${encodeURIComponent(`${address},${city},${state},${zip}`).replace(/%20/g, '+')}` : '';

  const html = `<html>
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
                    Hello,<br><br>
                    The Village Common of RI is seeking someone to provide ${serviceName} for ${memberName}<br>
                    on ${startDate}${timesFlexible ? ' (times flexible)' : ''}.<br>
                    <div style='margin-left:15px;margin-top:4px;margin-bottom:10px;'>
                      <table cellpadding='3' cellspacing='0' border='0' style='font-family:Arial, Sans-Serif; font-size:12px; font-weight:normal;'>
                        <tbody>
                          <tr>
                            <td>Short Description:</td>
                            <td>${description || ''}</td>
                          </tr>
                          <tr>
                            <td valign='top'>Requesting Member:</td>
                            <td valign='top'>
                              ${memberAddressBlock}
                            </td>
                          </tr>
                          <tr>
                            <td valign='top'>Starting Location:</td>
                            <td valign='top'>
                              ${startingLocation}
                            </td>
                          </tr>
                          ${pickupTime ? `<tr>
                            <td valign='top'>Initial Pickup Time</td>
                            <td valign='top'>${pickupTime}</td>
                          </tr>` : ''}
                          ${appointmentTime ? `<tr>
                            <td valign='top'>Arrival Time</td>
                            <td valign='top'>${appointmentTime}</td>
                          </tr>` : ''}
                          <tr>
                            <td valign='top'>Destination:</td>
                            <td valign='top'>
                              ${destinationAddress}
                              ${mapUrl ? `<br><br><a href='${mapUrl}' target='_blank'>Show destination on map</a>` : ''}
                            </td>
                          </tr>
                          ${returnPickupTime ? `<tr>
                            <td valign='top'>Return Pickup Time</td>
                            <td valign='top'>${returnPickupTime}</td>
                          </tr>` : ''}
                          ${dropoffTime ? `<tr>
                            <td valign='top'>Drop-off Time</td>
                            <td valign='top'>${dropoffTime}</td>
                          </tr>` : ''}
                          ${transportationType ? `<tr>
                            <td valign='top'>Transportation:</td>
                            <td>${transportationType}</td>
                          </tr>` : ''}
                        </tbody>
                      </table>
                    </div>
                    <br>Members Special Instructions: ${serviceNotes || ''}<br>
                    <br>
                    Please let us know if you can help with this ${serviceName} request by replying to this email.<br>
                    <br>
                    Thanks for all you do.<br>
                    <br>
                    The Village Common of RI<br>
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

  return html;
}

function buildRidesConfirmedRequestTemplate(volunteerName, requestData) {
  requestData = withBlankAddressNulls(requestData);
  const {
    serviceName,
    memberName,
    memberPhone,
    memberCell,
    memberAddress,
    memberCity,
    memberState,
    memberZip,
    description,
    address,
    city,
    state,
    zip,
    destination,
    serviceDate,
    timesFlexible,
    startTime,
    apptTime,
    returnTime,
    finishTime,
    transportationType,
    serviceNotes,
    emergencyContactName,
    emergencyContactRelationship,
    emergencyContactPhone,
  } = requestData;

  const startDate = formatServiceDate(serviceDate);
  const pickupTime = formatCivilTime(startTime);
  const appointmentTime = formatCivilTime(apptTime);
  const returnPickupTime = formatCivilTime(returnTime);
  const dropoffTime = formatCivilTime(finishTime);

  const memberAddressBlock = memberAddress
    ? `${memberName}<br>${memberAddress}<br>${memberCity}, ${memberState} ${memberZip}<br>${memberPhone || ''}<br>${memberCell ? `${memberCell} (cell)` : ''}`
    : '';
  const startingLocation = formatStartingLocation(requestData);
  const destinationAddress = destination && address ? `${destination}<br>${address}<br>${city}, ${state} ${zip}` : (destination || '');
  const mapUrl = destination && address ? `https://maps.google.com/maps?q=${encodeURIComponent(`${address},${city},${state},${zip}`).replace(/%20/g, '+')}` : '';

  const html = `<html>
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
                    Dear ${volunteerName},<br><br>
                    Thank you for agreeing to help The Village Common of RI provide ${serviceName} for ${memberName}.<br>
                    Short Description: ${description || ''}<br><br>
                    You are now confirmed as a service provider for this service request.<br>
                    <div style='margin-left:15px;margin-top:4px;margin-bottom:10px;'>
                      <table cellpadding='3' cellspacing='0' border='0' style='font-family:Arial, Sans-Serif; font-size:12px; font-weight:normal;'>
                        <tbody>
                          <tr>
                            <td>Service:</td>
                            <td>${serviceName}</td>
                          </tr>
                          <tr>
                            <td>Date:</td>
                            <td>${startDate}${timesFlexible ? ' (times flexible)' : ''}</td>
                          </tr>
                          <tr>
                            <td valign='top'>Requesting Member:</td>
                            <td valign='top'>
                              ${memberName}<br>
                              ${memberAddressBlock}<br>
                              ${memberPhone || ''}<br>
                              ${memberCell ? `cell: ${memberCell}` : ''}
                            </td>
                          </tr>
                          <tr>
                            <td valign='top'>Starting Location:</td>
                            <td valign='top'>
                              ${startingLocation}
                            </td>
                          </tr>
                          ${pickupTime ? `<tr>
                            <td valign='top'>Initial Pickup Time</td>
                            <td valign='top'>${pickupTime}</td>
                          </tr>` : ''}
                          ${appointmentTime ? `<tr>
                            <td valign='top'>Arrival Time</td>
                            <td valign='top'>${appointmentTime}</td>
                          </tr>` : ''}
                          <tr>
                            <td valign='top'>Destination:</td>
                            <td valign='top'>
                              ${destinationAddress}
                              ${mapUrl ? `<br><br><a href='${mapUrl}' target='_blank'>Show on map</a>` : ''}
                            </td>
                          </tr>
                          ${returnPickupTime ? `<tr>
                            <td valign='top'>Return Pickup Time</td>
                            <td valign='top'>${returnPickupTime}</td>
                          </tr>` : ''}
                          ${dropoffTime ? `<tr>
                            <td valign='top'>Drop-off Time</td>
                            <td valign='top'>${dropoffTime}</td>
                          </tr>` : ''}
                          ${transportationType ? `<tr>
                            <td valign='top'>Transportation:</td>
                            <td>${transportationType}</td>
                          </tr>` : ''}
                        </tbody>
                      </table>
                    </div>
                    <br>
                    Special Instructions for this member: ${serviceNotes || ''}<br><br>
                    Please call the member as soon as possible and let them know you will be their service provider. In addition, call the night before or the day of the service to reconfirm with the member.<br>
                    <br>
                    If you have any questions or need to cancel this service, please call 401-441-5240 or reply to this email.<br>
                    <br>
                    ${emergencyContactName ? `Member's Emergency Contact:<br>${emergencyContactName}<br>${emergencyContactRelationship || ''}<br>${emergencyContactPhone || ''}<br><br>` : ''}
                    Thanks for all you do.<br><br>
                    The Village Common of RI<br>
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

  return html;
}

function buildErrandsOpenRequestTemplate(volunteerName, requestData) {
  requestData = withBlankAddressNulls(requestData);
  const {
    serviceName,
    memberName,
    memberPhone,
    memberCell,
    memberAddress,
    memberCity,
    memberState,
    memberZip,
    description,
    address,
    city,
    state,
    zip,
    destination,
    serviceDate,
    transportationType,
    serviceNotes,
  } = requestData;

  const startDate = formatServiceDate(serviceDate);
  const memberAddressBlock = memberAddress
    ? `${memberName}<br>${memberAddress}<br>${memberCity}, ${memberState} ${memberZip}<br>${memberCell ? `${memberCell} (cell)` : ''}`
    : '';
  const startingLocation = formatStartingLocation(requestData);
  const destinationAddress = destination && address ? `${destination}<br>${address}<br><br>${city}, ${state} ${zip}` : (destination || '');
  const mapUrl = destination && address ? `https://maps.google.com/maps?q=${encodeURIComponent(`${address},${city},${state},${zip}`).replace(/%20/g, '+')}` : '';

  const html = `<html>
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
                    Hello,<br><br>
                    The Village Common of RI is seeking someone to provide ${serviceName} for ${memberName} on ${startDate}.
                    <div style='margin-left:15px;margin-top:4px;margin-bottom:10px;'>
                      <table cellpadding='3' cellspacing='0' border='0' style='font-family:Arial, Sans-Serif; font-size:12px; font-weight:normal;'>
                        <tbody>
                          <tr>
                            <td valign='top'>Short<br>Description:</td>
                            <td valign='top'>${description || ''}</td>
                          </tr>
                          <tr>
                            <td valign='top'>Requesting<br>Member:</td>
                            <td valign='top'>
                              ${memberAddressBlock}
                            </td>
                          </tr>
                          <tr>
                            <td valign='top'>Starting<br>Location:</td>
                            <td valign='top'>
                              ${startingLocation}
                            </td>
                          </tr>
                          <tr>
                            <td valign='top'>Destination:</td>
                            <td valign='top'>
                              ${destinationAddress}
                              ${mapUrl ? `<br><a href='${mapUrl}' target='_blank'>Show destination on map</a>` : ''}
                            </td>
                          </tr>
                          ${transportationType ? `<tr>
                            <td valign='top'>Transportation:</td>
                            <td>${transportationType}</td>
                          </tr>` : ''}
                        </tbody>
                      </table>
                    </div>
                    <br>Members Special Instructions: ${serviceNotes || ''}<br>
                    <br>
                    Please let us know if you can help with this ${serviceName} request by replying to this email.<br>
                    <br>
                    Thanks for all you do.<br>
                    <br>
                    The Village Common of RI<br>
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

  return html;
}

function buildErrandsConfirmedRequestTemplate(volunteerName, requestData) {
  requestData = withBlankAddressNulls(requestData);
  const {
    serviceName,
    memberName,
    memberPhone,
    memberCell,
    memberAddress,
    memberCity,
    memberState,
    memberZip,
    description,
    address,
    city,
    state,
    zip,
    destination,
    serviceDate,
    transportationType,
    serviceNotes,
    emergencyContactName,
    emergencyContactRelationship,
    emergencyContactPhone,
  } = requestData;

  const startDate = formatServiceDate(serviceDate);
  const memberAddressBlock = memberAddress
    ? `${memberName}<br>${memberAddress}<br>${memberCity}, ${memberState} ${memberZip}<br>${memberCell ? `cell: ${memberCell}` : ''}`
    : '';
  const startingLocation = formatStartingLocation(requestData);
  const destinationAddress = destination && address ? `${destination}<br>${address}<br><br>${city}, ${state} ${zip}` : (destination || '');
  const mapUrl = destination && address ? `https://maps.google.com/maps?q=${encodeURIComponent(`${address},${city},${state},${zip}`).replace(/%20/g, '+')}` : '';

  const html = `<html>
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
                    Dear ${volunteerName},<br><br>
                    Thank you for agreeing to help The Village Common of RI provide ${serviceName} for ${memberName}.<br><br>
                    Short Description: ${description || ''}<br><br>
                    You are now confirmed as a service provider for this service request.
                    <div style='margin-left:15px;margin-top:4px;margin-bottom:10px;'>
                      <table cellpadding='3' cellspacing='0' border='0' style='font-family:Arial, Sans-Serif; font-size:12px; font-weight:normal;'>
                        <tbody>
                          <tr>
                            <td>Service:</td>
                            <td>${serviceName}</td>
                          </tr>
                          <tr>
                            <td>Date:</td>
                            <td>${startDate} (The time is flexible)</td>
                          </tr>
                          <tr>
                            <td valign='top'>Requesting Member:</td>
                            <td valign='top'>
                              ${memberAddressBlock}
                            </td>
                          </tr>
                          <tr>
                            <td valign='top'>Starting Location:</td>
                            <td valign='top'>
                              ${startingLocation}
                            </td>
                          </tr>
                          <tr>
                            <td valign='top'>Destination:</td>
                            <td valign='top'>
                              ${destinationAddress}
                              ${mapUrl ? `<br><a href='${mapUrl}' target='_blank'>Show on map</a>` : ''}
                            </td>
                          </tr>
                          ${transportationType ? `<tr>
                            <td valign='top'>Transportation:</td>
                            <td>${transportationType}</td>
                          </tr>` : ''}
                        </tbody>
                      </table>
                    </div>
                    <br>
                    Special Instructions for this member: ${serviceNotes || ''}<br><br>
                    Please call the member as soon as possible to let them know you will be their service provider. In addition, call the night before or the day of the service to reconfirm with the member.<br>
                    <br>
                    If you have any questions or need to cancel this service, please call 401-441-5240 or reply to this email.<br>
                    <br>
                    ${emergencyContactName ? `Member's Emergency Contact:<br>${emergencyContactName}<br>${emergencyContactRelationship || ''}<br>${emergencyContactPhone || ''}<br><br>` : ''}
                    Thanks for all you do.<br><br>
                    The Village Common of RI<br>
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

  return html;
}

function buildTechSupportOpenRequestTemplate(volunteerName, requestData) {
  requestData = withBlankAddressNulls(requestData);
  const {
    serviceName,
    memberName,
    memberPhone,
    memberCell,
    memberAddress,
    memberCity,
    memberState,
    memberZip,
    description,
    serviceNotes,
  } = requestData;

  const memberAddressBlock = memberAddress
    ? `${memberName}<br>${memberAddress}<br>${memberCity}, ${memberState} ${memberZip}<br>Home:<br>Cell: ${memberCell || ''}`
    : '';

  const html = `<html>
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
                    Hello,<br><br>
                    The Village Common of RI is seeking someone to provide ${serviceName} for ${memberName}.
                    <div style='margin-left:15px;margin-top:4px;margin-bottom:10px;'>
                      <table cellpadding='3' cellspacing='0' border='0' style='font-family:Arial, Sans-Serif; font-size:12px; font-weight:normal;'>
                        <tbody>
                          <tr>
                            <td valign='top'>Short Description:</td>
                            <td valign='top'>${description || ''}</td>
                          </tr>
                          <tr>
                            <td valign='top'>Requesting Member:</td>
                            <td valign='top'>
                              ${memberAddressBlock}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <br>
                    NOTE: The date and time for this service request are flexible, to be arranged with the member. Please ignore the date in the subject line of this email. It is only for our current records and will be updated once a service date is set.<br>
                    <br>
                    Special instructions/info: ${serviceNotes || ''}<br><br>
                    Please let us know if you can help with this request by replying to this email.<br>
                    <br>
                    Thanks for all you do.<br>
                    <br>
                    The Village Common of RI<br>
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

  return html;
}

function buildTechSupportConfirmedRequestTemplate(volunteerName, requestData) {
  requestData = withBlankAddressNulls(requestData);
  const {
    serviceName,
    memberName,
    memberPhone,
    memberCell,
    memberAddress,
    memberCity,
    memberState,
    memberZip,
    description,
    serviceNotes,
    emergencyContactName,
    emergencyContactRelationship,
    emergencyContactPhone,
  } = requestData;

  const memberAddressBlock = memberAddress
    ? `${memberName}<br>${memberAddress}<br>${memberCity}, ${memberState} ${memberZip}<br>${memberPhone ? `Home: ${memberPhone}<br>` : ''}${memberCell ? `Cell: ${memberCell}` : ''}`
    : '';

  const html = `<html>
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
                    Dear ${volunteerName},<br><br>
                    Thank you for agreeing to help The Village Common of RI provide ${serviceName} for ${memberName}.<br><br>
                    Short Description: ${description || ''}<br><br>
                    You are now confirmed as a service provider for this service request.
                    <div style='margin-left:15px;margin-top:4px;margin-bottom:10px;'>
                      <table cellpadding='3' cellspacing='0' border='0' style='font-family:Arial, Sans-Serif; font-size:12px; font-weight:normal;'>
                        <tbody>
                          <tr>
                            <td>Service:</td>
                            <td>${serviceName}</td>
                          </tr>
                          <tr>
                            <td valign='top'>Requesting Member:</td>
                            <td valign='top'>
                              ${memberAddressBlock}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <br>
                    Special Instructions for this member: ${serviceNotes || ''}<br><br>
                    Please call the member as soon as possible to arrange a time that works for both of you.<br>
                    <br>
                    If you have any questions or need to cancel this service, please call 401-441-5240 or reply to this email.<br>
                    <br>
                    ${emergencyContactName ? `Member's Emergency Contact:<br>${emergencyContactName}<br>${emergencyContactRelationship || ''}<br>${emergencyContactPhone || ''}<br><br>` : ''}
                    Thanks for all you do.<br><br>
                    The Village Common of RI<br>
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

  return html;
}

function buildRidesMemberConfirmedTemplate(memberFirstName, volunteerData, requestData) {
  requestData = withBlankAddressNulls(requestData);
  const {
    serviceName,
    description,
    address,
    city,
    state,
    zip,
    destination,
    serviceDate,
    timesFlexible,
    startTime,
    apptTime,
    returnTime,
    finishTime,
    transportationType,
    serviceNotes,
  } = requestData;

  const startDate = formatServiceDate(serviceDate);
  const pickupTime = formatCivilTime(startTime);
  const appointmentTime = formatCivilTime(apptTime);
  const returnPickupTime = formatCivilTime(returnTime);
  const dropoffTime = formatCivilTime(finishTime);

  const destinationAddress = destination && address
    ? `${destination}<br><a href='https://maps.google.com/maps?q=${encodeURIComponent(`${address},${city},${state},${zip}`).replace(/%20/g, '+')}' target='_blank'>${address}</a><br><br>${city}, ${state} ${zip}`
    : (destination || '');
  const startingLocation = formatStartingLocation(requestData);

  const volunteerContact = [
    volunteerData.fullName,
    volunteerData.email ? `<a href='mailto:${volunteerData.email}'>${volunteerData.email}</a>` : '',
    volunteerData.cell ? `${volunteerData.cell}  (cell)` : (volunteerData.phone || ''),
  ].filter(Boolean).join('<br>');

  const html = `<html>
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
                    Hello ${memberFirstName}.<br><br>
                    <div style='margin-left:15px;margin-top:4px;margin-bottom:10px;'>
                      <table cellpadding='3' cellspacing='0' border='0' style='font-family:Arial, Sans-Serif; font-size:12px; font-weight:normal;'>
                        <tbody>
                          <tr>
                            <td>Short Description:</td>
                            <td>${description || ''}</td>
                          </tr>
                          <tr>
                            <td>Service:</td>
                            <td>${serviceName}</td>
                          </tr>
                          <tr>
                            <td>Date:</td>
                            <td>${startDate}${timesFlexible ? ' (times flexible)' : ''}</td>
                          </tr>
                          ${pickupTime ? `<tr>
                            <td valign='top'>Initial Pickup Time</td>
                            <td valign='top'>${pickupTime}</td>
                          </tr>` : ''}
                          ${appointmentTime ? `<tr>
                            <td valign='top'>Arrival Time</td>
                            <td valign='top'>${appointmentTime}</td>
                          </tr>` : ''}
                          <tr>
                            <td valign='top'>Starting Location:</td>
                            <td valign='top'>${startingLocation}</td>
                          </tr>
                          <tr>
                            <td valign='top'>Destination:</td>
                            <td valign='top'>
                              ${destinationAddress}
                            </td>
                          </tr>
                          ${returnPickupTime ? `<tr>
                            <td valign='top'>Return Pickup Time</td>
                            <td valign='top'>${returnPickupTime}</td>
                          </tr>` : ''}
                          ${dropoffTime ? `<tr>
                            <td valign='top'>Drop-off Time</td>
                            <td valign='top'>${dropoffTime}</td>
                          </tr>` : ''}
                          ${transportationType ? `<tr>
                            <td valign='top'>Transportation:</td>
                            <td>${transportationType}</td>
                          </tr>` : ''}
                        </tbody>
                      </table>
                    </div>
                    <br>
                    Your service provider(s) will be:<br><br>
                    ${volunteerContact}<br><br>
                    ${serviceNotes ? `<br>` : ''}
                    If you have any questions or need to cancel this service, please call  401-441-5240  or reply to the email.<br>
                    <br>
                    The Village Common of RI<br>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td>
              <div style='font-size:10px;font-style:italic;color:#666666'>
                This email was sent in response to the use of the ClubExpress platform and website by The Village Common of RI. It was generated by:<br>
                ClubExpress<br>
                <a href='#' style='color:#1a0dab;'>1213 W. Morehead Street, 5th Floor</a><br>
                Charlotte, NC 28208
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return html;
}

function buildHomeHelpMemberConfirmedTemplate(memberFirstName, volunteerData, requestData) {
  requestData = withBlankAddressNulls(requestData);
  const {
    serviceName,
    description,
    serviceNotes,
  } = requestData;

  const volunteerContact = [
    volunteerData.fullName,
    volunteerData.email ? `<a href='mailto:${volunteerData.email}'>${volunteerData.email}</a>` : '',
    volunteerData.cell ? `${volunteerData.cell}  (cell)` : (volunteerData.phone || ''),
  ].filter(Boolean).join('<br>');

  const html = `<html>
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
                    Hello ${memberFirstName}.<br><br>
                    <div style='margin-left:15px;margin-top:4px;margin-bottom:10px;'>
                      <table cellpadding='3' cellspacing='0' border='0' style='font-family:Arial, Sans-Serif; font-size:12px; font-weight:normal;'>
                        <tbody>
                          <tr>
                            <td>Short Description:</td>
                            <td>${description || ''}</td>
                          </tr>
                          <tr>
                            <td>Service:</td>
                            <td>${serviceName}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <br>
                    Your service provider(s) will be:<br><br>
                    ${volunteerContact}<br><br>
                    If you have any questions or need to cancel this service, please call  401-441-5240  or reply to the email.<br>
                    <br>
                    The Village Common of RI<br>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td>
              <div style='font-size:10px;font-style:italic;color:#666666'>
                This email was sent in response to the use of the ClubExpress platform and website by The Village Common of RI. It was generated by:<br>
                ClubExpress<br>
                <a href='#' style='color:#1a0dab;'>1213 W. Morehead Street, 5th Floor</a><br>
                Charlotte, NC 28208
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return html;
}

function buildErrandsMemberConfirmedTemplate(memberFirstName, volunteerData, requestData) {
  requestData = withBlankAddressNulls(requestData);
  const {
    serviceName,
    description,
    address,
    city,
    state,
    zip,
    destination,
    serviceDate,
    transportationType,
    serviceNotes,
  } = requestData;

  const startDate = formatServiceDate(serviceDate);
  const destinationAddress = destination && address
    ? `${destination}<br><a href='https://maps.google.com/maps?q=${encodeURIComponent(`${address},${city},${state},${zip}`).replace(/%20/g, '+')}' target='_blank'>${address}</a><br><br>${city}, ${state} ${zip}`
    : (destination || '');
  const startingLocation = formatStartingLocation(requestData);

  const volunteerContact = [
    volunteerData.fullName,
    volunteerData.email ? `<a href='mailto:${volunteerData.email}'>${volunteerData.email}</a>` : '',
    volunteerData.cell ? `${volunteerData.cell}  (cell)` : (volunteerData.phone || ''),
  ].filter(Boolean).join('<br>');

  const html = `<html>
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
                    Hello ${memberFirstName}.<br><br>
                    <div style='margin-left:15px;margin-top:4px;margin-bottom:10px;'>
                      <table cellpadding='3' cellspacing='0' border='0' style='font-family:Arial, Sans-Serif; font-size:12px; font-weight:normal;'>
                        <tbody>
                          <tr>
                            <td>Short Description:</td>
                            <td>${description || ''}</td>
                          </tr>
                          <tr>
                            <td>Service:</td>
                            <td>${serviceName}</td>
                          </tr>
                          <tr>
                            <td>Date:</td>
                            <td>${startDate} (The time is flexible)</td>
                          </tr>
                          <tr>
                            <td valign='top'>Starting Location:</td>
                            <td valign='top'>${startingLocation}</td>
                          </tr>
                          <tr>
                            <td valign='top'>Destination:</td>
                            <td valign='top'>${destinationAddress}</td>
                          </tr>
                          ${transportationType ? `<tr>
                            <td valign='top'>Transportation:</td>
                            <td>${transportationType}</td>
                          </tr>` : ''}
                        </tbody>
                      </table>
                    </div>
                    <br>
                    Your service provider(s) will be:<br><br>
                    ${volunteerContact}<br><br>
                    If you have any questions or need to cancel this service, please call  401-441-5240  or reply to the email.<br>
                    <br>
                    The Village Common of RI<br>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td>
              <div style='font-size:10px;font-style:italic;color:#666666'>
                This email was sent in response to the use of the ClubExpress platform and website by The Village Common of RI. It was generated by:<br>
                ClubExpress<br>
                <a href='#' style='color:#1a0dab;'>1213 W. Morehead Street, 5th Floor</a><br>
                Charlotte, NC 28208
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return html;
}

function buildTechSupportMemberConfirmedTemplate(memberFirstName, volunteerData, requestData) {
  requestData = withBlankAddressNulls(requestData);
  const {
    serviceName,
    description,
    serviceNotes,
  } = requestData;

  const volunteerContact = [
    volunteerData.fullName,
    volunteerData.email ? `<a href='mailto:${volunteerData.email}'>${volunteerData.email}</a>` : '',
    volunteerData.cell ? `${volunteerData.cell}  (cell)` : (volunteerData.phone || ''),
  ].filter(Boolean).join('<br>');

  const html = `<html>
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
                    Hello ${memberFirstName}.<br><br>
                    <div style='margin-left:15px;margin-top:4px;margin-bottom:10px;'>
                      <table cellpadding='3' cellspacing='0' border='0' style='font-family:Arial, Sans-Serif; font-size:12px; font-weight:normal;'>
                        <tbody>
                          <tr>
                            <td>Short Description:</td>
                            <td>${description || ''}</td>
                          </tr>
                          <tr>
                            <td>Service:</td>
                            <td>${serviceName}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <br>
                    Your service provider(s) will be:<br><br>
                    ${volunteerContact}<br><br>
                    If you have any questions or need to cancel this service, please call  401-441-5240  or reply to the email.<br>
                    <br>
                    The Village Common of RI<br>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td>
              <div style='font-size:10px;font-style:italic;color:#666666'>
                This email was sent in response to the use of the ClubExpress platform and website by The Village Common of RI. It was generated by:<br>
                ClubExpress<br>
                <a href='#' style='color:#1a0dab;'>1213 W. Morehead Street, 5th Floor</a><br>
                Charlotte, NC 28208
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return html;
}

// Volunteer-facing cancellation notice. Cancellation notices are identical
// across all service types in the samples: only the Service value and
// whether a time is shown vary. Rides include the pickup time (startTime);
// the other service types are flexible and show the date only.
function buildCancelledTemplate(recipientFirstName, requestData) {
  requestData = withBlankAddressNulls(requestData);
  const {
    serviceName,
    status,
    memberName,
    memberAddress,
    memberCity,
    memberState,
    memberZip,
    serviceDate,
    startTime,
  } = requestData;

  const dateOnly = formatServiceDate(serviceDate);
  const timeOnly = formatCivilTime(startTime);
  // Rides show date and pickup time; other service types show the date only.
  const dateTime = serviceName && serviceName.startsWith('Ride:') && timeOnly
    ? `${dateOnly} ${timeOnly}`
    : dateOnly;

  const memberAddressBlock = memberAddress
    ? `${memberName}<br>${memberAddress}<br>${memberCity}, ${memberState} ${memberZip}`
    : memberName || '';

  const html = `<html>
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
                    Dear ${recipientFirstName},<br><br>
                    <strong>THE FOLLOWING SERVICE REQUEST THAT YOU WERE CONFIRMED FOR HAS BEEN CANCELLED.</strong>
                    <div style='margin-left:15px;margin-top:4px;margin-bottom:10px;'>
                      <table cellpadding='3' cellspacing='0' border='0' style='font-family:Arial, Sans-Serif; font-size:12px; font-weight:normal;'>
                        <tbody>
                          <tr>
                            <td valign='top'>Reason:</td>
                            <td valign='top'>${status || 'Cancelled'}</td>
                          </tr>
                          <tr>
                            <td valign='top'>Service:</td>
                            <td valign='top'>${serviceName}</td>
                          </tr>
                          <tr>
                            <td valign='top'>Date/Time:</td>
                            <td valign='top'>${dateTime}</td>
                          </tr>
                          <tr>
                            <td valign='top'>Requesting Member:</td>
                            <td valign='top'>
                              ${memberAddressBlock}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <br>
                    If you have any questions, please call 401-441-5240.<br>
                    <br>
                    Thanks for all you do.<br>
                    <br>
                    The Village Common of RI<br>
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

  return html;
}

// Member-facing cancellation notice. Copy matches the legacy ClubExpress
// sample exactly, including the "if a volunteer was confirmed" line, which
// is shown unconditionally regardless of whether one was actually assigned.
function buildMemberCancelledTemplate(memberFirstName, requestData) {
  requestData = withBlankAddressNulls(requestData);
  const { serviceName, status, serviceDate, startTime } = requestData;

  const dateOnly = formatServiceDate(serviceDate);
  const timeOnly = formatCivilTime(startTime);
  const dateTime = serviceName && serviceName.startsWith('Ride:') && timeOnly
    ? `${dateOnly} ${timeOnly}`
    : dateOnly;

  const html = `<html>
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
                    Hello ${memberFirstName}.<br><br>
                    A service you requested has been cancelled.
                    <div style='margin-left:15px;margin-top:4px;margin-bottom:10px;'>
                      <table cellpadding='3' cellspacing='0' border='0' style='font-family:Arial, Sans-Serif; font-size:12px; font-weight:normal;'>
                        <tbody>
                          <tr>
                            <td valign='top'>Reason:</td>
                            <td valign='top'>${status || 'Cancelled'}</td>
                          </tr>
                          <tr>
                            <td valign='top'>Service:</td>
                            <td valign='top'>${serviceName}</td>
                          </tr>
                          <tr>
                            <td valign='top'>Date/Time:</td>
                            <td valign='top'>${dateTime}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <br>
                    If a volunteer provider was confirmed for this request, s/he has also been sent a copy of this email.<br>
                    <br>
                    If you have any questions or need to reschedule this service, please call 401-441-5240 or reply to the email.<br>
                    <br>
                    Thanks for your support.<br>
                    <br>
                    The Village Common of RI<br>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td>
              <div style='font-size:10px;font-style:italic;color:#666666'>
                This email was sent in response to the use of the ClubExpress platform and website by The Village Common of RI. It was generated by:<br>
                ClubExpress<br>
                <a href='#' style='color:#1a0dab;'>1213 W. Morehead Street, 5th Floor</a><br>
                Charlotte, NC 28208
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return html;
}

function buildEnrollPinTemplate({ firstName, pin, kind }) {
  const greeting = firstName ? `Dear ${firstName},` : 'Hello,';
  const intro = kind === 'existing_account'
    ? `Our records show you may already have a Village Green account. Enter the PIN below on the enrollment page to continue &mdash; you will be able to sign in, or get a new temporary password if you never finished setting up.`
    : `Enter the PIN below on the enrollment page to finish setting up your Village Green account.`;
  return `<html>
<body style="font-family:Arial, Sans-Serif; font-size:12px; font-weight:normal;">
  <p>${greeting}</p>
  <p>${intro}</p>
  <p style="font-size:24px; font-weight:bold; letter-spacing:6px;">${pin}</p>
  <p>This PIN expires in 15 minutes and can be used once. If you did not request it, you can safely ignore this email.</p>
  <p>The Village Common of RI</p>
</body>
</html>`;
}

// Test-mode banner for the enrollment emails. Unlike applyTestBanner in
// email-processor.js (which anchors to the SR templates' nested-table markup),
// the enroll templates are plain <p> bodies, so we inject right after the
// opening <body> tag. intendedEmail is the address the mail would have gone to.
function applyEnrollTestBanner(html, intendedEmail) {
  const notice = `<div style="margin:0 0 16px; padding:10px; background-color:#fff3cd; border:1px solid #ffc107; border-radius:4px; font-size:11px; color:#333;"><strong style="color:#856404;">TEST MODE:</strong> This email was sent to test recipients. Intended recipient would have been:<br><br>${intendedEmail}</div>`;
  return html.replace(/(<body[^>]*>)/, `$1\n  ${notice}`);
}

function buildEnrollIneligibleTemplate({ firstName }) {
  const greeting = firstName ? `Dear ${firstName},` : 'Hello,';
  return `<html>
<body style="font-family:Arial, Sans-Serif; font-size:12px; font-weight:normal;">
  <p>${greeting}</p>
  <p>Thanks for your interest in Village Green. At this time we are only setting up
  online accounts for volunteers. Your email is registered with The Village Common
  of RI as a member, so no online account is needed &mdash; please contact your village
  office for help with service requests.</p>
  <p>The Village Common of RI</p>
</body>
</html>`;
}

// Reminder notice sent to both the assigned volunteer and the member two days
// before the service date. One builder covers all four service types: the four
// customer template PDFs share a single layout and differ only in data, so the
// variation is expressed as three conditionals rather than four near-identical
// builders.
//
// Starting Location is RIDES ONLY - confirmed customer intent. Note the Errands
// open/confirmed templates in this file render that row from an earlier misread;
// do not copy that behavior here, and do not "fix" those templates from this
// feature.
function buildReminderTemplate(recipientFirstName, requestData) {
  requestData = withBlankAddressNulls(requestData);
  const {
    serviceName,
    memberName,
    memberAddress,
    memberCity,
    memberState,
    memberZip,
    memberCell,
    description,
    destination,
    address,
    city,
    state,
    zip,
    serviceDate,
    timesFlexible,
    startTime,
  } = requestData;

  const dateOnly = formatServiceDate(serviceDate);
  const timeOnly = formatCivilTime(startTime);
  // Rides carry a startTime; the other service types are flagged flexible. The
  // distinction is in the data, so no service-type check is needed here.
  const dateTime = startTime && !timesFlexible && timeOnly
    ? `${dateOnly} at ${timeOnly}`
    : `${dateOnly} &nbsp;(The time is flexible)`;

  const memberAddressBlock = memberAddress
    ? `${memberName}<br>${memberAddress}<br>${memberCity}, ${memberState} ${memberZip}${memberCell ? `<br><br>${memberCell} (cell)` : ''}`
    : (memberName || '');

  const isRide = !!serviceName && serviceName.startsWith('Ride:');
  const startingLocationRow = isRide
    ? `<tr>
                            <td valign='top'>Starting Location:</td>
                            <td valign='top'>${formatStartingLocation(requestData)}</td>
                          </tr>`
    : '';

  const destinationAddress = destination && address
    ? `${destination}<br>${address}<br><br>${city}, ${state} ${zip}`
    : (destination || '');
  const destinationBlock = destination
    ? `<u>Destination</u><br>${destinationAddress}<br><br>`
    : '';

  const html = `<html>
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
                    This is a reminder about a service request with <strong>The Village Common of RI</strong> for which you are scheduled.<br><br>
                    <div style='margin-left:15px;margin-top:4px;margin-bottom:10px;'>
                      <table cellpadding='3' cellspacing='0' border='0' style='font-family:Arial, Sans-Serif; font-size:12px; font-weight:normal;'>
                        <tbody>
                          <tr>
                            <td valign='top'>Service:</td>
                            <td valign='top'><strong>${serviceName}</strong></td>
                          </tr>
                          <tr>
                            <td valign='top'>Date/Time:</td>
                            <td valign='top'><strong>${dateTime}</strong></td>
                          </tr>
                          <tr>
                            <td valign='top'>Requesting Member:</td>
                            <td valign='top'>
                              ${memberAddressBlock}
                            </td>
                          </tr>
                          ${startingLocationRow}
                        </tbody>
                      </table>
                    </div>
                    <u>Short Description</u><br>
                    ${description || ''}<br><br>
                    ${destinationBlock}
                    If you have any questions or need to cancel this service, please call 401-441-5240 or reply to this email.<br>
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

  return html;
}

module.exports = {
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
  buildReminderTemplate,
  buildEnrollPinTemplate,
  buildEnrollIneligibleTemplate,
  applyEnrollTestBanner,
  formatStartingLocation,
};
