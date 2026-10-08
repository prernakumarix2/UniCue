import test from "node:test";
import assert from "node:assert/strict";
import { smartPastePlacement } from "../js/domain/placement-paste.js";

const NOW = new Date(2026, 9, 6);
const RAW = `Announcement
Reporting

Infosys is hiring: Campus Recruitment Drive 2027
Dear Students,
Company: Infosys
Role: Systems Engineer
CTC: 4.5 LPA
Location: Pune, Mysore
Eligible Batch: 2027
Eligible Programs: B.Tech CSE, IT
Eligibility:
- Minimum 6.5 CGPA
- No active backlogs
Selection Process:
1. Online test
2. Technical interview
3. HR round
Last date to register: 21 Oct 2026 5:00 PM
Drive Date: 25/10/2026 9:30 AM
Documents Required:
- Resume
- Photo ID
Apply: https://ums.lpu.in/drive/77.
Contact: tpc@lpu.in
`;

test("fills labelled fields from a realistic notice", () => {
  const r = smartPastePlacement(RAW, NOW);
  assert.equal(r.company, "Infosys"); assert.equal(r.role, "Systems Engineer");
  assert.equal(r.salary, "4.5 LPA"); assert.equal(r.workLocations, "Pune, Mysore");
  assert.equal(r.eligibleBatches, "2027"); assert.equal(r.eligiblePrograms, "B.Tech CSE, IT");
  assert.equal(r.eligibility, "Minimum 6.5 CGPA\nNo active backlogs");
  assert.equal(r.selectionProcess, "1. Online test\n2. Technical interview\n3. HR round");
  assert.equal(r.documentsRequired, "Resume\nPhoto ID");
  assert.equal(r.driveType, "Placement");
  assert.equal(r.contactPerson, "tpc@lpu.in");
});
test("dates: labelled deadline with time, drive date, application link without trailing dot", () => {
  const r = smartPastePlacement(RAW, NOW);
  assert.equal(r.applicationDeadline, "2026-10-21T17:00");
  assert.equal(r.driveDate, "2026-10-25T09:30");
  assert.equal(r.applicationUrl, "https://ums.lpu.in/drive/77");
});
test("no labels: company guessed from the headline, missing role/deadline are called out in notes", () => {
  const r = smartPastePlacement("Google is hiring interns\nApply soon at https://x.example/apply", NOW);
  assert.equal(r.company, "Google"); assert.equal(r.driveType, "Internship");
  assert.ok(r.notes.some(n => /Couldn't find the role/.test(n)));
  assert.ok(r.notes.some(n => /No application deadline/.test(n)));
});
test("deadline without a time uses 11:59 PM and says so; unlabelled 'last date' line is found", () => {
  const r = smartPastePlacement("TCS Campus Drive\nRegister before the last date: 30 Oct\nRole: Analyst", NOW);
  assert.equal(r.applicationDeadline, "2026-10-30T23:59");
  assert.ok(r.notes.some(n => /11:59 PM/.test(n)));
});
test("empty input is safe; an unknown 'Online test - 60 min' line inside a section is kept, not treated as a label", () => {
  assert.equal(smartPastePlacement("", NOW).company, "");
  const r = smartPastePlacement("Selection Process:\nOnline test - 60 minutes\nInterview - technical", NOW);
  assert.equal(r.selectionProcess, "Online test - 60 minutes\nInterview - technical");
});
