import test from "node:test";
import assert from "node:assert/strict";
import { installMode } from "../js/utils/install.js";
import { pickBanner, messagesForCompany } from "../js/domain/inbox.js";
import { normalizeInformation } from "../js/domain/information.js";

const NOW = Date.parse("2026-10-06T10:00:00Z");
const ANDROID = "Mozilla/5.0 (Linux; Android 15) Chrome/130";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit Safari/604.1";

test("installMode: waits for visit 2, hides when installed or recently dismissed", () => {
  assert.equal(installMode({ hasPrompt: true, visits: 1, now: NOW }), "none");
  assert.equal(installMode({ hasPrompt: true, visits: 2, now: NOW }), "prompt");
  assert.equal(installMode({ hasPrompt: true, visits: 5, standalone: true, now: NOW }), "none");
  assert.equal(installMode({ hasPrompt: true, visits: 5, dismissedAt: NOW - 3 * 86400000, now: NOW }), "none");
  assert.equal(installMode({ hasPrompt: true, visits: 5, dismissedAt: NOW - 20 * 86400000, now: NOW }), "prompt");
});
test("installMode: iPhone gets the manual hint, in-app browsers are told to open Safari, Android without prompt gets nothing", () => {
  assert.equal(installMode({ userAgent: IPHONE, visits: 3, now: NOW }), "ios");
  assert.equal(installMode({ userAgent: IPHONE + " Instagram 300.0", visits: 3, now: NOW }), "ios-safari");
  assert.equal(installMode({ userAgent: ANDROID, visits: 3, now: NOW }), "none");
});
test("pickBanner: newest active flagged message, skips dismissed/expired/unpublished/unflagged", () => {
  const now = new Date("2026-10-06T10:00:00Z");
  const items = [
    { id: "a", banner: true, status: "published", publishedAt: "2026-10-01T00:00:00Z", title: "Old" },
    { id: "b", banner: true, status: "published", publishedAt: "2026-10-05T00:00:00Z", title: "New" },
    { id: "c", banner: true, status: "published", publishedAt: "2026-10-06T00:00:00Z", expiresAt: "2026-10-05T00:00:00Z" },
    { id: "d", banner: true, status: "draft", publishedAt: "2026-10-06T05:00:00Z" },
    { id: "e", status: "published", publishedAt: "2026-10-06T06:00:00Z" }
  ];
  assert.equal(pickBanner(items, [], now).id, "b");
  assert.equal(pickBanner(items, ["b"], now).id, "a");
  assert.equal(pickBanner(items, ["a", "b"], now), null);
  assert.equal(pickBanner([], [], now), null);
});
test("messagesForCompany: explicit company and title guess, newest first, case-insensitive", () => {
  const items = [
    { id: "1", title: "Google drive: registrations open", category: "Placement", status: "published", publishedAt: "2026-10-01T00:00:00Z" },
    { id: "2", title: "Anything", company: "GOOGLE", status: "published", publishedAt: "2026-10-04T00:00:00Z" },
    { id: "3", title: "Infosys drive: open", category: "Placement", status: "published", publishedAt: "2026-10-03T00:00:00Z" },
    { id: "4", title: "Google drive reminder", category: "Placement", status: "draft", publishedAt: "2026-10-05T00:00:00Z" }
  ];
  assert.deepEqual(messagesForCompany(items, "google", new Date("2026-10-06")).map(i => i.id), ["2", "1"]);
  assert.deepEqual(messagesForCompany(items, "", new Date()), []);
});
test("banner flag is saved as a boolean", () => {
  const base = { title: "T", category: "Other", importance: "Critical", content: "c", status: "published" };
  assert.equal(normalizeInformation({ ...base, banner: true }).banner, true);
  assert.equal(normalizeInformation(base).banner, false);
});
