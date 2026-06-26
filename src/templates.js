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
    service_name,
    member_name,
    member_phone,
    member_cell,
    member_address,
    member_city,
    member_state,
    member_zip,
    description,
    service_notes,
  } = requestData;

  const memberAddress = member_address
    ? `${member_name}<br>${member_address}<br>${member_city}, ${member_state} ${member_zip}<br>${member_phone || ''}<br>${member_cell ? `Cell: ${member_cell}` : ''}`
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
                    The Village Common of RI is seeking someone to provide ${service_name} for ${member_name}.</div>
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
                              ${memberAddress}
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
                    Special instructions/info: ${service_notes || ''}<br><br>
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
    service_name,
    member_name,
    member_phone,
    member_cell,
    member_address,
    member_city,
    member_state,
    member_zip,
    description,
    service_notes,
    emergency_contact_name,
    emergency_contact_relationship,
    emergency_contact_phone,
  } = requestData;

  const memberAddress = member_address
    ? `${member_name}<br>${member_address}<br>${member_city}, ${member_state} ${member_zip}<br>${member_phone || ''}<br>${member_cell ? `Cell: ${member_cell}` : ''}`
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
                    Thank you for agreeing to help The Village Common of RI provide ${service_name} for ${member_name}.<br>
                    Short Description: ${description || ''}<br><br>
                    You are now confirmed as a service provider for this service request.</div>
                    <div style='margin-left:15px;margin-top:4px;margin-bottom:10px;'>
                      <table style='font-family: Arial, sans-serif; font-size: 12px; font-weight: normal;' cellspacing='0' cellpadding='3' border='0'>
                        <tbody>
                          <tr>
                            <td>Service:</td>
                            <td>${service_name}</td>
                          </tr>
                          <tr>
                            <td>Requesting Member:</td>
                            <td>
                              ${memberAddress}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <br>
                    Special Instructions for this member: ${service_notes || ''}<br><br>
                    Please call the member as soon as possible to arrange a time that works for both of you.<br>
                    <br>
                    If you have any questions or need to cancel this service, please call 401-441-5240 or reply to this email.<br>
                    <br>
                    ${emergency_contact_name ? `Member's Emergency Contact:<br>${emergency_contact_name}<br>${emergency_contact_relationship || ''}<br>${emergency_contact_phone || ''}<br><br>` : ''}
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
    service_name,
    member_name,
    member_phone,
    member_cell,
    member_address,
    member_city,
    member_state,
    member_zip,
    description,
    address,
    city,
    state,
    zip,
    destination,
    start_at,
    appt_time,
    return_time,
    finish_at,
    transportation_type,
    service_notes,
  } = requestData;

  const startDate = formatDateOnly(start_at);
  const pickupTime = formatTimeOnly(start_at);
  const appointmentTime = formatTimeOnly(appt_time);
  const returnPickupTime = formatTimeOnly(return_time);
  const dropoffTime = formatTimeOnly(finish_at);

  const memberAddress = member_address
    ? `${member_name}<br>${member_address}<br>${member_city}, ${member_state} ${member_zip}<br>${member_phone || ''}<br>${member_cell ? `${member_cell} (cell)` : ''}`
    : '';
  const startingLocation = member_address ? `Home - ${member_address} ${member_city}, ${member_state} ${member_zip}` : '';
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
                    The Village Common of RI is seeking someone to provide ${service_name} for ${member_name}<br>
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
                              ${memberAddress}
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
                          ${transportation_type ? `<tr>
                            <td valign='top'>Transportation:</td>
                            <td>${transportation_type}</td>
                          </tr>` : ''}
                        </tbody>
                      </table>
                    </div>
                    <br>Members Special Instructions: ${service_notes || ''}<br>
                    <br>
                    Please let us know if you can help with this ${service_name} request by replying to this email.<br>
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
    service_name,
    member_name,
    member_phone,
    member_cell,
    member_address,
    member_city,
    member_state,
    member_zip,
    description,
    address,
    city,
    state,
    zip,
    destination,
    start_at,
    appt_time,
    return_time,
    finish_at,
    transportation_type,
    service_notes,
    emergency_contact_name,
    emergency_contact_relationship,
    emergency_contact_phone,
  } = requestData;

  const startDate = formatDateOnly(start_at);
  const pickupTime = formatTimeOnly(start_at);
  const appointmentTime = formatTimeOnly(appt_time);
  const returnPickupTime = formatTimeOnly(return_time);
  const dropoffTime = formatTimeOnly(finish_at);

  const memberAddress = member_address
    ? `${member_name}<br>${member_address}<br>${member_city}, ${member_state} ${member_zip}<br>${member_phone || ''}<br>${member_cell ? `${member_cell} (cell)` : ''}`
    : '';
  const startingLocation = member_address ? `Home - ${member_address} ${member_city}, ${member_state} ${member_zip}` : '';
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
                    Thank you for agreeing to help The Village Common of RI provide ${service_name} for ${member_name}.<br>
                    Short Description: ${description || ''}<br><br>
                    You are now confirmed as a service provider for this service request.<br>
                    <div style='margin-left:15px;margin-top:4px;margin-bottom:10px;'>
                      <table cellpadding='3' cellspacing='0' border='0' style='font-family:Arial, Sans-Serif; font-size:12px; font-weight:normal;'>
                        <tbody>
                          <tr>
                            <td>Service:</td>
                            <td>${service_name}</td>
                          </tr>
                          <tr>
                            <td>Date:</td>
                            <td>${startDate}</td>
                          </tr>
                          <tr>
                            <td valign='top'>Requesting Member:</td>
                            <td valign='top'>
                              ${member_name}<br>
                              ${memberAddress}<br>
                              ${member_phone || ''}<br>
                              ${member_cell ? `cell: ${member_cell}` : ''}
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
                          ${transportation_type ? `<tr>
                            <td valign='top'>Transportation:</td>
                            <td>${transportation_type}</td>
                          </tr>` : ''}
                        </tbody>
                      </table>
                    </div>
                    <br>
                    Special Instructions for this member: ${service_notes || ''}<br><br>
                    Please call the member as soon as possible and let them know you will be their service provider. In addition, call the night before or the day of the service to reconfirm with the member.<br>
                    <br>
                    If you have any questions or need to cancel this service, please call 401-441-5240 or reply to this email.<br>
                    <br>
                    ${emergency_contact_name ? `Member's Emergency Contact:<br>${emergency_contact_name}<br>${emergency_contact_relationship || ''}<br>${emergency_contact_phone || ''}<br><br>` : ''}
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
    service_name,
    member_name,
    member_phone,
    member_cell,
    member_address,
    member_city,
    member_state,
    member_zip,
    description,
    address,
    city,
    state,
    zip,
    destination,
    start_at,
    transportation_type,
    service_notes,
  } = requestData;

  const startDate = formatDateOnly(start_at);
  const memberAddress = member_address
    ? `${member_name}<br>${member_address}<br>${member_city}, ${member_state} ${member_zip}<br>${member_cell ? `${member_cell} (cell)` : ''}`
    : '';
  const startingLocation = member_address ? `Home - ${member_address} ${member_city}, ${member_state} ${member_zip}` : '';
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
                    The Village Common of RI is seeking someone to provide ${service_name} for ${member_name} on ${startDate}.
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
                              ${memberAddress}
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
                          ${transportation_type ? `<tr>
                            <td valign='top'>Transportation:</td>
                            <td>${transportation_type}</td>
                          </tr>` : ''}
                        </tbody>
                      </table>
                    </div>
                    <br>Members Special Instructions: ${service_notes || ''}<br>
                    <br>
                    Please let us know if you can help with this ${service_name} request by replying to this email.<br>
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
    service_name,
    member_name,
    member_phone,
    member_cell,
    member_address,
    member_city,
    member_state,
    member_zip,
    description,
    address,
    city,
    state,
    zip,
    destination,
    start_at,
    transportation_type,
    service_notes,
    emergency_contact_name,
    emergency_contact_relationship,
    emergency_contact_phone,
  } = requestData;

  const startDate = formatDateOnly(start_at);
  const memberAddress = member_address
    ? `${member_name}<br>${member_address}<br>${member_city}, ${member_state} ${member_zip}<br>${member_cell ? `cell: ${member_cell}` : ''}`
    : '';
  const startingLocation = member_address ? `Home - ${member_address} ${member_city}, ${member_state} ${member_zip}` : '';
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
                    Thank you for agreeing to help The Village Common of RI provide ${service_name} for ${member_name}.<br><br>
                    Short Description: ${description || ''}<br><br>
                    You are now confirmed as a service provider for this service request.
                    <div style='margin-left:15px;margin-top:4px;margin-bottom:10px;'>
                      <table cellpadding='3' cellspacing='0' border='0' style='font-family:Arial, Sans-Serif; font-size:12px; font-weight:normal;'>
                        <tbody>
                          <tr>
                            <td>Service:</td>
                            <td>${service_name}</td>
                          </tr>
                          <tr>
                            <td>Date:</td>
                            <td>${startDate} (The time is flexible)</td>
                          </tr>
                          <tr>
                            <td valign='top'>Requesting Member:</td>
                            <td valign='top'>
                              ${memberAddress}
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
                          ${transportation_type ? `<tr>
                            <td valign='top'>Transportation:</td>
                            <td>${transportation_type}</td>
                          </tr>` : ''}
                        </tbody>
                      </table>
                    </div>
                    <br>
                    Special Instructions for this member: ${service_notes || ''}<br><br>
                    Please call the member as soon as possible to let them know you will be their service provider. In addition, call the night before or the day of the service to reconfirm with the member.<br>
                    <br>
                    If you have any questions or need to cancel this service, please call 401-441-5240 or reply to this email.<br>
                    <br>
                    ${emergency_contact_name ? `Member's Emergency Contact:<br>${emergency_contact_name}<br>${emergency_contact_relationship || ''}<br>${emergency_contact_phone || ''}<br><br>` : ''}
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
    service_name,
    member_name,
    member_phone,
    member_cell,
    member_address,
    member_city,
    member_state,
    member_zip,
    description,
    service_notes,
  } = requestData;

  const memberAddress = member_address
    ? `${member_name}<br>${member_address}<br>${member_city}, ${member_state} ${member_zip}<br>Home:<br>Cell: ${member_cell || ''}`
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
                    The Village Common of RI is seeking someone to provide ${service_name} for ${member_name}.
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
                              ${memberAddress}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <br>
                    NOTE: The date and time for this service request are flexible, to be arranged with the member. Please ignore the date in the subject line of this email. It is only for our current records and will be updated once a service date is set.<br>
                    <br>
                    Special instructions/info: ${service_notes || ''}<br><br>
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
    service_name,
    member_name,
    member_phone,
    member_cell,
    member_address,
    member_city,
    member_state,
    member_zip,
    description,
    service_notes,
    emergency_contact_name,
    emergency_contact_relationship,
    emergency_contact_phone,
  } = requestData;

  const memberAddress = member_address
    ? `${member_name}<br>${member_address}<br>${member_city}, ${member_state} ${member_zip}<br>${member_phone ? `Home: ${member_phone}<br>` : ''}${member_cell ? `Cell: ${member_cell}` : ''}`
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
                    Thank you for agreeing to help The Village Common of RI provide ${service_name} for ${member_name}.<br><br>
                    Short Description: ${description || ''}<br><br>
                    You are now confirmed as a service provider for this service request.
                    <div style='margin-left:15px;margin-top:4px;margin-bottom:10px;'>
                      <table cellpadding='3' cellspacing='0' border='0' style='font-family:Arial, Sans-Serif; font-size:12px; font-weight:normal;'>
                        <tbody>
                          <tr>
                            <td>Service:</td>
                            <td>${service_name}</td>
                          </tr>
                          <tr>
                            <td valign='top'>Requesting Member:</td>
                            <td valign='top'>
                              ${memberAddress}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <br>
                    Special Instructions for this member: ${service_notes || ''}<br><br>
                    Please call the member as soon as possible to arrange a time that works for both of you.<br>
                    <br>
                    If you have any questions or need to cancel this service, please call 401-441-5240 or reply to this email.<br>
                    <br>
                    ${emergency_contact_name ? `Member's Emergency Contact:<br>${emergency_contact_name}<br>${emergency_contact_relationship || ''}<br>${emergency_contact_phone || ''}<br><br>` : ''}
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
    service_name,
    description,
    address,
    city,
    state,
    zip,
    destination,
    start_at,
    appt_time,
    return_time,
    finish_at,
    transportation_type,
    service_notes,
  } = requestData;

  const startDate = formatDateOnly(start_at);
  const pickupTime = formatTimeOnly(start_at);
  const appointmentTime = formatTimeOnly(appt_time);
  const returnPickupTime = formatTimeOnly(return_time);
  const dropoffTime = formatTimeOnly(finish_at);

  const destinationAddress = destination && address
    ? `${destination}<br><a href='https://maps.google.com/maps?q=${encodeURIComponent(`${address},${city},${state},${zip}`).replace(/%20/g, '+')}' target='_blank'>${address}</a><br><br>${city}, ${state} ${zip}`
    : (destination || '');

  const volunteerContact = [
    volunteerData.full_name,
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
                            <td>${service_name}</td>
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
                          ${transportation_type ? `<tr>
                            <td valign='top'>Transportation:</td>
                            <td>${transportation_type}</td>
                          </tr>` : ''}
                        </tbody>
                      </table>
                    </div>
                    <br>
                    Your service provider(s) will be:<br><br>
                    ${volunteerContact}<br><br>
                    ${service_notes ? `<br>` : ''}
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
    service_name,
    description,
    service_notes,
  } = requestData;

  const volunteerContact = [
    volunteerData.full_name,
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
                            <td>${service_name}</td>
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
    service_name,
    description,
    address,
    city,
    state,
    zip,
    destination,
    start_at,
    transportation_type,
    service_notes,
  } = requestData;

  const startDate = formatDateOnly(start_at);
  const destinationAddress = destination && address
    ? `${destination}<br><a href='https://maps.google.com/maps?q=${encodeURIComponent(`${address},${city},${state},${zip}`).replace(/%20/g, '+')}' target='_blank'>${address}</a><br><br>${city}, ${state} ${zip}`
    : (destination || '');

  const volunteerContact = [
    volunteerData.full_name,
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
                            <td>${service_name}</td>
                          </tr>
                          <tr>
                            <td>Date:</td>
                            <td>${startDate} (The time is flexible)</td>
                          </tr>
                          <tr>
                            <td valign='top'>Destination:</td>
                            <td valign='top'>${destinationAddress}</td>
                          </tr>
                          ${transportation_type ? `<tr>
                            <td valign='top'>Transportation:</td>
                            <td>${transportation_type}</td>
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
    service_name,
    description,
    service_notes,
  } = requestData;

  const volunteerContact = [
    volunteerData.full_name,
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
                            <td>${service_name}</td>
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
};
