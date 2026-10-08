import test from "node:test";
import assert from "node:assert/strict";
import { validateCourse, calculatePercentage, getAttendanceStatus, calculateAllowableAbsences, calculateRequiredClasses } from "../js/domain/attendance.js";

test("7/10 at 75% target: 70%, below target, must attend next 2", () => {
  assert.equal(calculatePercentage(7, 10), 70);
  assert.equal(getAttendanceStatus(7, 10, 75), "Below Target");
  assert.equal(calculateRequiredClasses(7, 10, 75), 2);
  assert.equal(calculateAllowableAbsences(7, 10, 75), 0);
});
test("0/0 is Not Started, never 0%", () => {
  assert.equal(calculatePercentage(0, 0), null);
  assert.equal(getAttendanceStatus(0, 0, 75), "Not Started");
});
test("allowable absences", () => {
  assert.equal(calculateAllowableAbsences(9, 10, 75), 2);
  assert.equal(calculateAllowableAbsences(8, 10, 75), 0);
  assert.equal(calculateAllowableAbsences(10, 10, 100), 0);
});
test("at target / above target", () => {
  assert.equal(getAttendanceStatus(15, 20, 75), "At Target");
  assert.equal(getAttendanceStatus(19, 20, 75), "Above Target");
  assert.equal(calculateRequiredClasses(15, 20, 75), 0);
});
test("100% target below 100% can never be recovered", () => {
  assert.equal(calculateRequiredClasses(9, 10, 100), Infinity);
});
test("validation", () => {
  assert.equal(validateCourse({ name: "", conducted: 1, attended: 1, target: 75 }).valid, false);
  assert.equal(validateCourse({ name: "A", conducted: 5, attended: 6, target: 75 }).valid, false);
  assert.equal(validateCourse({ name: "A", conducted: -1, attended: 0, target: 75 }).valid, false);
  assert.equal(validateCourse({ name: "A", conducted: 5.5, attended: 2, target: 75 }).valid, false);
  assert.equal(validateCourse({ name: "A", conducted: 5, attended: 2, target: 101 }).valid, false);
  assert.equal(validateCourse({ name: "A", conducted: 5, attended: 2, target: -1 }).valid, false);
  assert.equal(validateCourse({ name: "A", conducted: 10, attended: 7, target: 75 }).valid, true);
});
