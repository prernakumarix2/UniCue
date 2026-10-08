import test from "node:test";
import assert from "node:assert/strict";
import { getPlacementStatus, normalizePlacement, validatePlacement, filterPlacements, parsePlacementForm, placementStatusPatch } from "../js/domain/placements.js";

const now = new Date("2026-10-10T12:00:00Z");
const h = hours => new Date(now.getTime() + hours * 3600000).toISOString();

test("derived status: Open / Closing Soon / Closed", () => {
  assert.equal(getPlacementStatus({ status: "published" }, now), "Open");
  assert.equal(getPlacementStatus({ status: "published", applicationDeadline: h(24 * 10) }, now), "Open");
  assert.equal(getPlacementStatus({ status: "published", applicationDeadline: h(24) }, now), "Closing Soon");
  assert.equal(getPlacementStatus({ status: "published", applicationDeadline: h(-1) }, now), "Closed");
  assert.equal(getPlacementStatus({ status: "closed", applicationDeadline: h(500) }, now), "Closed");
});
test("editor status select is stored (draft/published/closed) - close works", () => {
  for (const status of ["draft", "published", "closed"]) {
    assert.equal(normalizePlacement({ company: "A", role: "B", status }).status, status);
  }
  assert.equal(normalizePlacement({ company: "A", role: "B", published: true }).status, "published"); // legacy checkbox
  assert.equal(normalizePlacement({ company: "A", role: "B", status: "weird" }).status, "draft");
});
test("normalize does not send createdAt/updatedAt/published (server timestamps own these)", () => {
  const out = normalizePlacement({ company: "A", role: "B" });
  for (const k of ["createdAt", "updatedAt", "published"]) assert.equal(k in out, false);
});
test("bad dates do not throw and are reported", () => {
  const { value, errors } = parsePlacementForm({ company: "A", role: "B", applicationDeadline: "garbage" });
  assert.equal(value.applicationDeadline, "");
  assert.ok(errors.some(e => /deadline/i.test(e)));
});
test("validation: required, urls", () => {
  assert.ok(validatePlacement(normalizePlacement({})).company);
  assert.ok(validatePlacement(normalizePlacement({ company: "A", role: "B", applicationUrl: "javascript:x" })).applicationUrl);
  assert.deepEqual(validatePlacement(normalizePlacement({ company: "A", role: "B", applicationUrl: "https://ums.lpu.in/a" })), {});
});
test("list: open first by soonest deadline, closed last", () => {
  const items = [
    { id: "closed", company: "Z", status: "closed", applicationDeadline: h(-48) },
    { id: "later", company: "B", status: "published", applicationDeadline: h(24 * 9) },
    { id: "soon", company: "C", status: "published", applicationDeadline: h(24) },
    { id: "none", company: "A", status: "published" }
  ];
  assert.deepEqual(filterPlacements(items, {}, now).map(i => i.id), ["soon", "later", "none", "closed"]);
  assert.deepEqual(filterPlacements(items, { status: "Closed" }, now).map(i => i.id), ["closed"]);
});
test("search by company, skill, location", () => {
  const items = [{ id: "1", company: "Acme", role: "SDE", skills: "React, Node", workLocations: "Pune", status: "published" }];
  for (const q of ["acme", "react", "pune", "sde"]) assert.equal(filterPlacements(items, { query: q }, now).length, 1, q);
  assert.equal(filterPlacements(items, { query: "java" }, now).length, 0);
});
test("one-click status patch", () => {
  assert.deepEqual(placementStatusPatch("closed"), { status: "closed" });
});
