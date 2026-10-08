// End-to-end check of the admin -> Firestore -> student flow.
// Runs the REAL app modules inside jsdom against an in-memory Firebase fake that mirrors firestore.rules.
// This is NOT a substitute for testing against the live Firebase project / real browser.
import test, { before } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { JSDOM } from "jsdom";

register("./fakes/hooks.js", import.meta.url);
const { state } = await import("./fakes/state.js");

const dom = new JSDOM("<!doctype html><div id='root'></div>", { url: "https://example.test/UniCue/", pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, FormData: dom.window.FormData,
  HashChangeEvent: dom.window.HashChangeEvent, localStorage: dom.window.localStorage
});
globalThis.confirm = () => true;
Object.defineProperty(globalThis, "location", { value: dom.window.location, configurable: true });

const { adminLogin, adminLogout, getCurrentAdmin } = await import("../js/admin/auth.js");
const { informationRepository } = await import("../js/repositories/information-repository.js");
const { placementRepository } = await import("../js/repositories/placement-repository.js");
const adminPages = await import("../js/pages/admin-information.js");
const manager = await import("../js/pages/admin.js");
const { renderInformation, bindInformation } = await import("../js/pages/information.js");
const { renderInformationDetail } = await import("../js/pages/information-detail.js");
const { renderPlacementList, bindPlacement } = await import("../js/pages/placement.js");
const { renderPlacementDetail } = await import("../js/pages/placement-detail.js");
const { renderHome } = await import("../js/pages/home.js");

const ADMIN = { email: "admin@unicue.com", uid: state.adminUid };
before(() => {
  state.accounts[ADMIN.email] = { uid: ADMIN.uid, password: "test-pw" };
  state.accounts["student@x.com"] = { uid: "someone-else", password: "test-pw" };
});

const root = () => document.querySelector("#root");
const tick = () => new Promise(resolve => setTimeout(resolve, 20));
async function submitForm(formId, values) {
  const form = root().querySelector(`#${formId}`);
  for (const [name, value] of Object.entries(values)) {
    const field = form.elements[name];
    assert.ok(field, `form field "${name}" must exist`);
    if (field.type === "checkbox") field.checked = Boolean(value); else field.value = value;
  }
  form.dispatchEvent(new dom.window.Event("submit", { cancelable: true, bubbles: true }));
  await tick();
}
const navigateLog = [];
const navigate = path => navigateLog.push(path);

test("admin login: wrong password rejected, non-admin account rejected, admin accepted", async () => {
  await assert.rejects(adminLogin(ADMIN.email, "wrong"));
  await assert.rejects(adminLogin("student@x.com", "test-pw"), /not authorized/i);
  assert.equal(state.user, null, "non-admin must be signed out again");
  await adminLogin(ADMIN.email, "test-pw");
  assert.equal((await getCurrentAdmin()).uid, ADMIN.uid);
});

test("INFORMATION: create published item through the real editor form", async () => {
  root().innerHTML = await adminPages.renderInformationEditor();
  adminPages.bindInformationEditor(root(), { navigate });
  await submitForm("information-editor", {
    title: "Mid-term datesheet", category: "Examination", importance: "Critical", content: "Line one\nLine two",
    sourceName: "LPU UMS", sourceUrl: "https://ums.lpu.in/notice", verified: true,
    actionLabel: "Open UMS", actionUrl: "https://ums.lpu.in/register",
    importantDatesText: "Registration closes | 2026-10-21 | 17:00\nExam starts | 2026-11-02",
    attachmentsText: "Datesheet | https://example.com/d.pdf", contactsText: "Exam cell | exam@lpu.in",
    expiresAt: "2099-01-01T10:00", status: "published"
  });
  assert.deepEqual(navigateLog.at(-1), "#/admin/information");
  const saved = [...state.docs.information.values()];
  assert.equal(saved.length, 1);
  const item = saved[0];
  assert.equal(item.status, "published");
  assert.equal(item.createdBy, ADMIN.uid);
  assert.equal(item.action.url, "https://ums.lpu.in/register");
  assert.equal(item.importantDates.length, 2);
  assert.equal(item.attachments.length, 1);
  assert.equal(item.contacts.length, 1);
  assert.equal(item.verified, true);
  assert.ok(item.createdAt.toDate, "server timestamp stored");
});

test("INFORMATION: validation errors block save and nothing is written", async () => {
  const before = state.docs.information.size;
  root().innerHTML = await adminPages.renderInformationEditor();
  adminPages.bindInformationEditor(root(), { navigate });
  await submitForm("information-editor", { title: "", content: "", status: "draft" });
  assert.equal(state.docs.information.size, before);
  assert.match(root().querySelector("#information-editor-errors").textContent, /Title is required/);
});

test("INFORMATION: draft is saved but hidden from students", async () => {
  root().innerHTML = await adminPages.renderInformationEditor();
  adminPages.bindInformationEditor(root(), { navigate });
  await submitForm("information-editor", { title: "Secret draft", category: "Other", importance: "Normal", content: "not yet", status: "draft" });
  assert.equal(state.docs.information.size, 2);
});

test("ADMIN MANAGER lists both, one-click Publish / Unpublish / Expire / Delete work and refresh", async () => {
  root().innerHTML = await manager.renderAdminManager("Information");
  assert.match(root().textContent, /Mid-term datesheet/);
  assert.match(root().textContent, /Secret draft/);
  manager.bindAdminManager(root(), "Information", navigate);
  const draftId = [...state.docs.information].find(([, d]) => d.title === "Secret draft")[0];

  root().querySelector(`[data-admin-status="published"][data-id="${draftId}"]`).click(); await tick();
  assert.equal(state.docs.information.get(draftId).status, "published");
  assert.ok(state.docs.information.get(draftId).publishedAt, "publishedAt stamped on first publish");
  assert.equal(state.docs.information.get(draftId).updatedBy, ADMIN.uid);

  root().innerHTML = await manager.renderAdminManager("Information");
  manager.bindAdminManager(root(), "Information", navigate);
  root().querySelector(`[data-admin-status="expired"][data-id="${draftId}"]`).click(); await tick();
  assert.equal(state.docs.information.get(draftId).status, "expired");

  root().innerHTML = await manager.renderAdminManager("Information");
  manager.bindAdminManager(root(), "Information", navigate);
  root().querySelector(`[data-admin-delete="${draftId}"]`).click(); await tick();
  assert.equal(state.docs.information.has(draftId), false);
});

test("STUDENT (signed out): sees published info, not drafts; detail has expected sections in order", async () => {
  // add a draft + a manually expired item as admin first
  await informationRepository.create({ title: "Hidden draft", category: "Other", importance: "Normal", content: "x", status: "draft" });
  await informationRepository.create({ title: "Old news", category: "Other", importance: "Normal", content: "x", status: "expired" });
  await adminLogout();
  assert.equal(await getCurrentAdmin(), null);

  const { html, items } = await renderInformation();
  assert.equal(items.length, 1);
  assert.match(html, /Mid-term datesheet/);
  assert.match(html, /badge-Critical/);
  assert.doesNotMatch(html, /Hidden draft|Old news/);

  root().innerHTML = html;
  bindInformation(root(), items);
  const search = root().querySelector("#information-search");
  search.value = "zzz-no-match"; search.dispatchEvent(new dom.window.Event("input"));
  assert.match(root().querySelector("#information-results").textContent, /No active information/);
  search.value = "datesheet"; search.dispatchEvent(new dom.window.Event("input"));
  assert.match(root().querySelector("#information-results").textContent, /Mid-term datesheet/);

  const id = [...state.docs.information].find(([, d]) => d.title === "Mid-term datesheet")[0];
  const detail = await renderInformationDetail(id);
  const order = ["Important dates", "Action required", "Details", "Attachments", "Source", "Contact"].map(h => detail.indexOf(`<h2>${h}</h2>`));
  assert.ok(order.every(i => i > 0), `all sections present: ${order}`);
  assert.deepEqual([...order].sort((a, b) => a - b), order, "sections are in spec order");
  assert.match(detail, /21 Oct 2026|Oct 21, 2026/);
  assert.match(detail, /noopener noreferrer/);
  assert.doesNotMatch(detail, /This information has expired/);

  const draftId = [...state.docs.information].find(([, d]) => d.title === "Hidden draft")[0];
  assert.match(await renderInformationDetail(draftId), /permission/i, "student cannot read a draft by direct link");
});

test("STUDENT cannot write anything (server-side rules model)", async () => {
  await assert.rejects(informationRepository.create({ title: "hack", status: "published" }), /permission/i);
  await assert.rejects(placementRepository.create({ company: "x", status: "published" }), /permission/i);
  const id = [...state.docs.information.keys()][0];
  await assert.rejects(informationRepository.update(id, { title: "defaced" }), /permission/i);
  await assert.rejects(informationRepository.remove(id), /permission/i);
  assert.notEqual(state.docs.information.get(id).title, "defaced");
  // signed-in but NOT the admin uid:
  await adminLogin("student@x.com", "test-pw").catch(() => {});
  state.user = { uid: "someone-else" };
  await assert.rejects(informationRepository.create({ title: "hack", status: "published" }), /permission/i);
  assert.equal(await getCurrentAdmin(), null);
  state.user = null;
});

test("expired-by-date item: hidden from list, direct link says it has expired", async () => {
  state.user = { uid: ADMIN.uid };
  const created = await informationRepository.create({
    title: "Past deadline notice", category: "Academic", importance: "Important", content: "c", status: "published",
    publishedAt: "2020-01-01T00:00:00.000Z", expiresAt: "2020-02-01T00:00:00.000Z"
  });
  state.user = null;
  const { html } = await renderInformation();
  assert.doesNotMatch(html, /Past deadline notice/);
  assert.match(await renderInformationDetail(created.id), /This information has expired/);
});

test("PLACEMENT: create, publish, close, reopen, student visibility", async () => {
  state.user = { uid: ADMIN.uid };
  const future = new Date(Date.now() + 5 * 86400000); const pad = n => String(n).padStart(2, "0");
  const local = `${future.getFullYear()}-${pad(future.getMonth() + 1)}-${pad(future.getDate())}T10:00`;

  root().innerHTML = await adminPages.renderPlacementEditor();
  adminPages.bindPlacementEditor(root(), { navigate });
  await submitForm("placement-editor", {
    company: "Acme Corp", role: "SDE Intern", driveType: "Internship", workLocations: "Pune", salary: "6 LPA",
    skills: "React, Node", eligibility: "CGPA 7+", applicationDeadline: local,
    applicationUrl: "https://ums.lpu.in/apply", officialSource: "https://ums.lpu.in/drive/1", status: "published"
  });
  root().innerHTML = await adminPages.renderPlacementEditor();
  adminPages.bindPlacementEditor(root(), { navigate });
  await submitForm("placement-editor", { company: "Draft Co", role: "QA", status: "draft" });
  assert.equal(state.docs.placements.size, 2);
  const acme = [...state.docs.placements].find(([, d]) => d.company === "Acme Corp");
  assert.equal(acme[1].status, "published");
  assert.equal(acme[1].createdBy, ADMIN.uid);
  assert.ok(acme[1].applicationDeadline.endsWith("Z"), "deadline stored as ISO");

  state.user = null;
  let items = await placementRepository.getPublished();
  assert.deepEqual(items.map(i => i.company), ["Acme Corp"], "draft not visible to students");
  assert.match(await renderPlacementDetail(acme[0]), /Apply through official LPU process/);
  assert.match(await renderPlacementDetail(acme[0]), /does not process applications/);

  // admin closes it via the manager
  state.user = { uid: ADMIN.uid };
  root().innerHTML = await manager.renderAdminManager("Placements");
  manager.bindAdminManager(root(), "Placements", navigate);
  root().querySelector(`[data-admin-status="closed"][data-id="${acme[0]}"]`).click(); await tick();
  assert.equal(state.docs.placements.get(acme[0]).status, "closed");

  state.user = null;
  items = await placementRepository.getPublished();
  assert.equal(items.length, 1, "closed placement stays visible to students");
  const listHtml = renderPlacementList(items);
  assert.match(listHtml, /Closed/);
  root().innerHTML = listHtml; bindPlacement(root(), items);
  const select = root().querySelector("#placement-status");
  select.value = "Open"; select.dispatchEvent(new dom.window.Event("change"));
  assert.match(root().querySelector("#placement-results").textContent, /No opportunities found/);
  select.value = "Closed"; select.dispatchEvent(new dom.window.Event("change"));
  assert.match(root().querySelector("#placement-results").textContent, /Acme Corp/);

  // reopen, then delete
  state.user = { uid: ADMIN.uid };
  root().innerHTML = await manager.renderAdminManager("Placements");
  manager.bindAdminManager(root(), "Placements", navigate);
  root().querySelector(`[data-admin-status="published"][data-id="${acme[0]}"]`).click(); await tick();
  assert.equal(state.docs.placements.get(acme[0]).status, "published");
  root().innerHTML = await manager.renderAdminManager("Placements");
  manager.bindAdminManager(root(), "Placements", navigate);
  root().querySelector(`[data-admin-delete="${acme[0]}"]`).click(); await tick();
  assert.equal(state.docs.placements.has(acme[0]), false);
  state.user = null;
});

test("HOME renders even when Firebase fails, local sections intact", async () => {
  localStorage.setItem("unicue_attendance", JSON.stringify([{ id: "c1", name: "DSA", code: "205", conducted: 10, attended: 7, target: 75 }]));
  localStorage.setItem("unicue_deadlines", JSON.stringify([{ id: "d1", title: "Lab 3", type: "Lab", dueDate: "2099-10-21", completed: false }]));
  const original = informationRepository.getPublished;
  informationRepository.getPublished = async () => { throw new Error("Can't reach the server."); };
  const html = await renderHome();
  informationRepository.getPublished = original;
  assert.match(html, /DSA/);
  assert.match(html, /below target/);
  assert.match(html, /Lab 3/);
  assert.match(html, /Due Oct 21, 2099|Due 21 Oct 2099/);
  assert.doesNotMatch(html, /11:59/);
  assert.match(html, /Notices are unavailable right now/);
});

test("QUOTA: a student session costs few reads, and admin edits propagate via the version doc", async () => {
  const { resetContentCache } = await import("../js/repositories/content-sync.js");
  // Admin publishes one message (this bumps meta/content).
  state.user = { uid: ADMIN.uid };
  resetContentCache();
  const created = await informationRepository.create({ title: "Quota notice", category: "General", importance: "Normal", content: "x", status: "published", publishedAt: new Date().toISOString() });
  assert.ok(state.docs.meta.get("content").version > 0, "publish must bump the version doc");
  state.user = null;
  resetContentCache();

  // Student opens the app and visits Home, Messages, Placement, a detail page, then Home again.
  state.reads = 0;
  await renderHome();
  await renderInformation();
  await renderPlacementList(await placementRepository.getPublished());
  await renderInformationDetail(created.id);
  await renderHome();
  const firstSession = state.reads;
  assert.ok(firstSession <= 1 + state.docs.information.size + state.docs.placements.size, `first session read ${firstSession} docs`);

  // Same visit again (app reopened: memory cleared, localStorage kept) => version doc only.
  const saved = Object.entries(localStorage).filter(([k]) => k.startsWith("unicue_cache_"));
  resetContentCache(); saved.forEach(([k, v]) => localStorage.setItem(k, v));
  state.reads = 0;
  await renderHome(); await renderInformation();
  assert.equal(state.reads, 1, "unchanged content must cost exactly the 1 version read");

  // Admin edits => next open refetches and shows the change.
  state.user = { uid: ADMIN.uid };
  await informationRepository.update(created.id, { title: "Quota notice (edited)", status: "published" });
  state.user = null;
  const stored = Object.entries(localStorage).filter(([k]) => k.startsWith("unicue_cache_"));
  resetContentCache(); stored.forEach(([k, v]) => localStorage.setItem(k, v));
  const items = await informationRepository.getPublished();
  assert.ok(items.some(i => i.title === "Quota notice (edited)"), "student must see the edit after the version bump");
  state.user = { uid: ADMIN.uid };
  await informationRepository.remove(created.id);
  state.user = null;
});
