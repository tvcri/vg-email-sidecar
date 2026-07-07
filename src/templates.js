// Service request datetimes are stored in the DB as UTC. Emails are read by
// Rhode Island volunteers, so all times/dates must be displayed in Eastern time.
// Pin the timeZone explicitly so rendering is correct regardless of the server's
// own timezone (the production host runs as UTC).
const DISPLAY_TIME_ZONE = 'America/New_York';

function formatDateOnly(isoDateTime) {
  if (!isoDateTime) return '';
  const date = new Date(isoDateTime);
  return date.toLocaleString('en-US', {
    timeZone: DISPLAY_TIME_ZONE,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatTimeOnly(isoDateTime) {
  if (!isoDateTime) return '';
  const date = new Date(isoDateTime);
  return date.toLocaleString('en-US', {
    timeZone: DISPLAY_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function buildHomeHelpOpenRequestTemplate(volunteerName, requestData) {
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
    startAt,
    apptTime,
    returnTime,
    finishAt,
    transportationType,
    serviceNotes,
  } = requestData;

  const startDate = formatDateOnly(startAt);
  const pickupTime = formatTimeOnly(startAt);
  const appointmentTime = formatTimeOnly(apptTime);
  const returnPickupTime = formatTimeOnly(returnTime);
  const dropoffTime = formatTimeOnly(finishAt);

  const memberAddressBlock = memberAddress
    ? `${memberName}<br>${memberAddress}<br>${memberCity}, ${memberState} ${memberZip}<br>${memberPhone || ''}<br>${memberCell ? `${memberCell} (cell)` : ''}`
    : '';
  const startingLocation = memberAddress ? `Home - ${memberAddress} ${memberCity}, ${memberState} ${memberZip}` : '';
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
                    on ${startDate}.<br>
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
                            <td valign='top'>Appointment Time</td>
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
    startAt,
    apptTime,
    returnTime,
    finishAt,
    transportationType,
    serviceNotes,
    emergencyContactName,
    emergencyContactRelationship,
    emergencyContactPhone,
  } = requestData;

  const startDate = formatDateOnly(startAt);
  const pickupTime = formatTimeOnly(startAt);
  const appointmentTime = formatTimeOnly(apptTime);
  const returnPickupTime = formatTimeOnly(returnTime);
  const dropoffTime = formatTimeOnly(finishAt);

  const memberAddressBlock = memberAddress
    ? `${memberName}<br>${memberAddress}<br>${memberCity}, ${memberState} ${memberZip}<br>${memberPhone || ''}<br>${memberCell ? `${memberCell} (cell)` : ''}`
    : '';
  const startingLocation = memberAddress ? `Home - ${memberAddress} ${memberCity}, ${memberState} ${memberZip}` : '';
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
                            <td>${startDate}</td>
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
                            <td valign='top'>Appointment Time</td>
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
    startAt,
    transportationType,
    serviceNotes,
  } = requestData;

  const startDate = formatDateOnly(startAt);
  const memberAddressBlock = memberAddress
    ? `${memberName}<br>${memberAddress}<br>${memberCity}, ${memberState} ${memberZip}<br>${memberCell ? `${memberCell} (cell)` : ''}`
    : '';
  const startingLocation = memberAddress ? `Home - ${memberAddress} ${memberCity}, ${memberState} ${memberZip}` : '';
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
    startAt,
    transportationType,
    serviceNotes,
    emergencyContactName,
    emergencyContactRelationship,
    emergencyContactPhone,
  } = requestData;

  const startDate = formatDateOnly(startAt);
  const memberAddressBlock = memberAddress
    ? `${memberName}<br>${memberAddress}<br>${memberCity}, ${memberState} ${memberZip}<br>${memberCell ? `cell: ${memberCell}` : ''}`
    : '';
  const startingLocation = memberAddress ? `Home - ${memberAddress} ${memberCity}, ${memberState} ${memberZip}` : '';
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
  const {
    serviceName,
    description,
    address,
    city,
    state,
    zip,
    destination,
    startAt,
    apptTime,
    returnTime,
    finishAt,
    transportationType,
    serviceNotes,
  } = requestData;

  const startDate = formatDateOnly(startAt);
  const pickupTime = formatTimeOnly(startAt);
  const appointmentTime = formatTimeOnly(apptTime);
  const returnPickupTime = formatTimeOnly(returnTime);
  const dropoffTime = formatTimeOnly(finishAt);

  const destinationAddress = destination && address
    ? `${destination}<br><a href='https://maps.google.com/maps?q=${encodeURIComponent(`${address},${city},${state},${zip}`).replace(/%20/g, '+')}' target='_blank'>${address}</a><br><br>${city}, ${state} ${zip}`
    : (destination || '');

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
                            <td>${startDate}</td>
                          </tr>
                          ${pickupTime ? `<tr>
                            <td valign='top'>Initial Pickup Time</td>
                            <td valign='top'>${pickupTime}</td>
                          </tr>` : ''}
                          ${appointmentTime ? `<tr>
                            <td valign='top'>Appointment Time</td>
                            <td valign='top'>${appointmentTime}</td>
                          </tr>` : ''}
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
  const {
    serviceName,
    description,
    address,
    city,
    state,
    zip,
    destination,
    startAt,
    transportationType,
    serviceNotes,
  } = requestData;

  const startDate = formatDateOnly(startAt);
  const destinationAddress = destination && address
    ? `${destination}<br><a href='https://maps.google.com/maps?q=${encodeURIComponent(`${address},${city},${state},${zip}`).replace(/%20/g, '+')}' target='_blank'>${address}</a><br><br>${city}, ${state} ${zip}`
    : (destination || '');

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
// whether a time is shown vary. Rides include the pickup time (startAt);
// the other service types are flexible and show the date only.
function buildCancelledTemplate(recipientFirstName, requestData) {
  const {
    serviceName,
    status,
    memberName,
    memberAddress,
    memberCity,
    memberState,
    memberZip,
    startAt,
  } = requestData;

  const dateOnly = formatDateOnly(startAt);
  const timeOnly = formatTimeOnly(startAt);
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
  const { serviceName, status, startAt } = requestData;

  const dateOnly = formatDateOnly(startAt);
  const timeOnly = formatTimeOnly(startAt);
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
};
