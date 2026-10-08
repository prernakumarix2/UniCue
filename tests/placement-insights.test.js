import test from "node:test";
import assert from "node:assert/strict";
import { parseSteps, parseEligibilityRules, checkEligibility, closingWithin, closesIn } from "../js/domain/placement-insights.js";

test("parseSteps: arrows, numbered lines, round labels, detail after colon", () => {
  assert.deepEqual(parseSteps("Online test -> Technical interview → HR").map(s => s.title), ["Online test", "Technical interview", "HR"]);
  const s = parseSteps("Round 1: Aptitude test - 60 minutes\n2. Technical interview\n- HR round");
  assert.deepEqual(s.map(x => x.title), ["Aptitude test", "Technical interview", "HR round"]);
  assert.equal(s[0].detail, "60 minutes");
  assert.deepEqual(parseSteps(""), []);
});
test("parseEligibilityRules: cgpa, backlog variants, nothing", () => {
  assert.deepEqual(parseEligibilityRules("Minimum 6.5 CGPA, no active backlogs"), { minCgpa: 6.5, maxBacklogs: 0 });
  assert.deepEqual(parseEligibilityRules("CGPA of 7 and above. Up to 1 backlog allowed"), { minCgpa: 7, maxBacklogs: 1 });
  assert.equal(parseEligibilityRules("60% in 10th and 12th").minCgpa, null);
  assert.deepEqual(parseEligibilityRules("Open to all B.Tech students"), { minCgpa: null, maxBacklogs: null });
});
test("checkEligibility: ok, warn, unknown (missing profile / no rules)", () => {
  const rules = { minCgpa: 6.5, maxBacklogs: 0 };
  assert.equal(checkEligibility(rules, { cgpa: 7.2, backlogs: 0 }).status, "ok");
  const warn = checkEligibility(rules, { cgpa: 6, backlogs: 0 });
  assert.equal(warn.status, "warn"); assert.match(warn.reasons[0], /6\.5/);
  assert.equal(checkEligibility(rules, { cgpa: 8, backlogs: 2 }).status, "warn");
  assert.equal(checkEligibility(rules, {}).status, "unknown");
  assert.equal(checkEligibility({ minCgpa: null, maxBacklogs: null }, { cgpa: 9, backlogs: 0 }).status, "unknown");
  assert.equal(checkEligibility(rules, { cgpa: 5, backlogs: "" }).status, "warn", "a failed rule wins over a missing field");
});
test("closingWithin / closesIn", () => {
  const now = new Date("2026-10-05T10:00:00");
  const items = [
    { id: "a", applicationDeadline: "2026-10-05T18:00:00" }, { id: "b", applicationDeadline: "2026-10-09T18:00:00" },
    { id: "c", applicationDeadline: "2026-10-05T09:00:00" }, { id: "d", applicationDeadline: "2026-10-06T12:00:00", status: "closed" }
  ];
  assert.deepEqual(closingWithin(items, 48, now).map(i => i.id), ["a"]);
  assert.equal(closesIn("2026-10-05T18:00:00", now).text, "Closes in 8 h");
  assert.equal(closesIn("2026-10-08T10:30:00", now).text, "Closes in 3 days");
  assert.equal(closesIn("2026-10-05T09:00:00", now).tone, "closed");
  assert.equal(closesIn("nope", now), null);
});
