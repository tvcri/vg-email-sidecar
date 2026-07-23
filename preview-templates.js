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
  buildMemberCancelledTemplate,
} = require('./src/templates');

const volunteerData = {
  fullName: 'Joanne Miller',
  email: 'j.millerxxx@gmail.com',
  phone: null,
  cell: '401-465-0405',
};

const ridesRequest = {
  id: 1001,
  serviceName: 'Ride: Activity/Event',
  memberName: 'Zelda Fitzgerald',
  memberEmail: 'zelda@example.com',
  memberPhone: '401-555-0100',
  memberCell: '401-555-0101',
  memberAddress: '45 Benefit St',
  memberCity: 'Providence',
  memberState: 'RI',
  memberZip: '02903',
  description: 'This is a test request. Please do not take any action.',
  serviceDate: '2025-12-26',
  timesFlexible: false,
  startTime: '06:00:00',
  apptTime: '06:30:00',
  returnTime: null,
  finishTime: '07:00:00',
  // Authoritative start* fields (VG sr-starting-address migration). Errands below intentionally
  // omits them so its preview exercises the member-home fallback.
  start: 'Laurelmead Cooperative',
  startAddress: '355 Blackstone Blvd',
  startCity: 'Providence',
  startState: 'RI',
  startZip: '02906',
  startPhone: '401-555-0102',
  destination: 'Roger Williams Park Zoo',
  address: '1000 Elmwood Ave',
  city: 'Providence',
  state: 'RI',
  zip: '02907',
  transportationType: 'Round Trip',
  serviceNotes: 'Member uses a walker.',
  emergencyContactName: 'Scott Fitzgerald',
  emergencyContactRelationship: 'Son',
  emergencyContactPhone: '401-555-0199',
};

const homeHelpRequest = {
  id: 1002,
  serviceName: 'Household Chores/Handy Help',
  memberName: 'Zelda Fitzgerald',
  memberEmail: 'zelda@example.com',
  memberPhone: '401-555-0100',
  memberCell: null,
  memberAddress: '45 Benefit St',
  memberCity: 'Providence',
  memberState: 'RI',
  memberZip: '02903',
  description: 'Help moving furniture in living room.',
  serviceNotes: 'Second floor, no elevator.',
  emergencyContactName: null,
  emergencyContactRelationship: null,
  emergencyContactPhone: null,
};

const errandsRequest = {
  id: 1003,
  serviceName: 'Errand: Shopping',
  memberName: 'Zelda Fitzgerald',
  memberEmail: 'zelda@example.com',
  memberPhone: '401-555-0100',
  memberCell: '401-555-0101',
  memberAddress: '45 Benefit St',
  memberCity: 'Providence',
  memberState: 'RI',
  memberZip: '02903',
  description: 'Pick up groceries from Stop & Shop.',
  serviceDate: '2025-12-27',
  timesFlexible: true,
  destination: 'Stop & Shop',
  address: '550 Plainfield St',
  city: 'Providence',
  state: 'RI',
  zip: '02909',
  transportationType: null,
  serviceNotes: '',
  emergencyContactName: null,
  emergencyContactRelationship: null,
  emergencyContactPhone: null,
};

const techRequest = {
  id: 1004,
  serviceName: 'Tech Support',
  memberName: 'Zelda Fitzgerald',
  memberEmail: 'zelda@example.com',
  memberPhone: '401-555-0100',
  memberCell: null,
  memberAddress: '45 Benefit St',
  memberCity: 'Providence',
  memberState: 'RI',
  memberZip: '02903',
  description: 'Help setting up new iPad and email app.',
  serviceNotes: 'Member is not very tech-savvy, please be patient.',
  emergencyContactName: null,
  emergencyContactRelationship: null,
  emergencyContactPhone: null,
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
  // Cancellation notices go to the confirmed volunteer (if any) and the member.
  // Rides show date + pickup time; the other (flexible) service types show the
  // date only.
  ['cancel-rides.html',        buildCancelledTemplate('Joanne', ridesRequest)],
  ['cancel-errands.html',      buildCancelledTemplate('Joanne', errandsRequest)],
  ['cancel-rides-member.html', buildMemberCancelledTemplate('Zelda', ridesRequest)],
  ['cancel-errands-member.html', buildMemberCancelledTemplate('Zelda', errandsRequest)],
];

for (const [filename, html] of renders) {
  const filePath = path.join(outDir, filename);
  fs.writeFileSync(filePath, html);
  console.log(`Wrote ${filePath}`);
}

console.log('\nOpen any file above in a browser to preview.');
