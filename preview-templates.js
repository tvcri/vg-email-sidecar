#!/usr/bin/env node
// Renders all confirmed templates (volunteer + member) with sample data and
// writes them to preview/ as HTML files you can open in a browser.

const fs = require('fs');
const path = require('path');
const {
  buildHomeHelpConfirmedRequestTemplate,
  buildRidesConfirmedRequestTemplate,
  buildErrandsConfirmedRequestTemplate,
  buildTechSupportConfirmedRequestTemplate,
  buildRidesMemberConfirmedTemplate,
  buildHomeHelpMemberConfirmedTemplate,
  buildErrandsMemberConfirmedTemplate,
  buildTechSupportMemberConfirmedTemplate,
  buildCancelledTemplate,
} = require('./src/templates');

const volunteerData = {
  full_name: 'Joanne Miller',
  email: 'j.millerxxx@gmail.com',
  phone: null,
  cell: '401-465-0405',
};

const ridesRequest = {
  id: 1001,
  service_name: 'Ride: Activity/Event',
  member_name: 'Zelda Fitzgerald',
  member_email: 'zelda@example.com',
  member_phone: '401-555-0100',
  member_cell: '401-555-0101',
  member_address: '45 Benefit St',
  member_city: 'Providence',
  member_state: 'RI',
  member_zip: '02903',
  description: 'This is a test request. Please do not take any action.',
  start_at: '2025-12-26T11:00:00Z',   // 6:00 AM ET
  appt_time: null,
  return_time: null,
  finish_at: '2025-12-26T12:00:00Z',  // 7:00 AM ET
  destination: 'Roger Williams Park Zoo',
  address: '1000 Elmwood Ave',
  city: 'Providence',
  state: 'RI',
  zip: '02907',
  transportation_type: 'Round Trip',
  service_notes: 'Member uses a walker.',
  emergency_contact_name: 'Scott Fitzgerald',
  emergency_contact_relationship: 'Son',
  emergency_contact_phone: '401-555-0199',
};

const homeHelpRequest = {
  id: 1002,
  service_name: 'Household Chores/Handy Help',
  member_name: 'Zelda Fitzgerald',
  member_email: 'zelda@example.com',
  member_phone: '401-555-0100',
  member_cell: null,
  member_address: '45 Benefit St',
  member_city: 'Providence',
  member_state: 'RI',
  member_zip: '02903',
  description: 'Help moving furniture in living room.',
  service_notes: 'Second floor, no elevator.',
  emergency_contact_name: null,
  emergency_contact_relationship: null,
  emergency_contact_phone: null,
};

const errandsRequest = {
  id: 1003,
  service_name: 'Errand: Shopping',
  member_name: 'Zelda Fitzgerald',
  member_email: 'zelda@example.com',
  member_phone: '401-555-0100',
  member_cell: '401-555-0101',
  member_address: '45 Benefit St',
  member_city: 'Providence',
  member_state: 'RI',
  member_zip: '02903',
  description: 'Pick up groceries from Stop & Shop.',
  start_at: '2025-12-27T15:00:00Z',
  destination: 'Stop & Shop',
  address: '550 Plainfield St',
  city: 'Providence',
  state: 'RI',
  zip: '02909',
  transportation_type: null,
  service_notes: '',
  emergency_contact_name: null,
  emergency_contact_relationship: null,
  emergency_contact_phone: null,
};

const techRequest = {
  id: 1004,
  service_name: 'Tech Support',
  member_name: 'Zelda Fitzgerald',
  member_email: 'zelda@example.com',
  member_phone: '401-555-0100',
  member_cell: null,
  member_address: '45 Benefit St',
  member_city: 'Providence',
  member_state: 'RI',
  member_zip: '02903',
  description: 'Help setting up new iPad and email app.',
  service_notes: 'Member is not very tech-savvy, please be patient.',
  emergency_contact_name: null,
  emergency_contact_relationship: null,
  emergency_contact_phone: null,
};

const outDir = path.join(__dirname, 'preview');
fs.mkdirSync(outDir, { recursive: true });

const renders = [
  ['rides-volunteer.html',   buildRidesConfirmedRequestTemplate('Joanne', ridesRequest)],
  ['rides-member.html',      buildRidesMemberConfirmedTemplate('Zelda', volunteerData, ridesRequest)],
  ['homhelp-volunteer.html', buildHomeHelpConfirmedRequestTemplate('Joanne', homeHelpRequest)],
  ['homhelp-member.html',    buildHomeHelpMemberConfirmedTemplate('Zelda', volunteerData, homeHelpRequest)],
  ['errands-volunteer.html', buildErrandsConfirmedRequestTemplate('Joanne', errandsRequest)],
  ['errands-member.html',    buildErrandsMemberConfirmedTemplate('Zelda', volunteerData, errandsRequest)],
  ['techsup-volunteer.html', buildTechSupportConfirmedRequestTemplate('Joanne', techRequest)],
  ['techsup-member.html',    buildTechSupportMemberConfirmedTemplate('Zelda', volunteerData, techRequest)],
  // Cancellation notice goes to the confirmed volunteer. Rides show date + pickup
  // time; the other (flexible) service types show the date only.
  ['cancel-rides.html',      buildCancelledTemplate('Joanne', ridesRequest)],
  ['cancel-errands.html',    buildCancelledTemplate('Joanne', errandsRequest)],
];

for (const [filename, html] of renders) {
  const filePath = path.join(outDir, filename);
  fs.writeFileSync(filePath, html);
  console.log(`Wrote ${filePath}`);
}

console.log('\nOpen any file above in a browser to preview.');
