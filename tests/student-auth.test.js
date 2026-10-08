import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

const mem = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; };
beforeEach(() => { globalThis.localStorage = mem(); globalThis.sessionStorage = mem(); });
const A = await import("../js/auth/student-auth.js");
const { checkFields } = await import("../js/pages/auth.js");

test("sign up, log out, log in with the right password only", async () => {
  const user = await A.signUp({ name: "  Aarav   Singh ", email: "Aarav@Example.com ", password: "correct horse", confirm: "correct horse" });
  assert.deepEqual(user, { name: "Aarav Singh", email: "aarav@example.com" });
  assert.equal(A.isLoggedIn(), true);
  assert.ok(!JSON.stringify(localStorage.getItem("unicue_students")).includes("correct horse"), "password is never stored in plain text");
  A.logOut();
  assert.equal(A.isLoggedIn(), false);
  await assert.rejects(A.logIn({ email: "aarav@example.com", password: "nope nope" }), e => e.field === "password");
  await assert.rejects(A.logIn({ email: "ghost@example.com", password: "whatever1" }), e => e.field === "email");
  assert.equal((await A.logIn({ email: "AARAV@example.com", password: "correct horse" })).name, "Aarav Singh");
});
test("sign up rejects bad input and duplicate emails", async () => {
  await assert.rejects(A.signUp({ name: "A", email: "a@b.co", password: "12345678", confirm: "12345678" }), e => e.field === "name");
  await assert.rejects(A.signUp({ name: "Asha", email: "not-an-email", password: "12345678", confirm: "12345678" }), e => e.field === "email");
  await assert.rejects(A.signUp({ name: "Asha", email: "a@b.co", password: "short", confirm: "short" }), e => e.field === "password");
  await assert.rejects(A.signUp({ name: "Asha", email: "a@b.co", password: "12345678", confirm: "123456789" }), e => e.field === "confirm");
  await A.signUp({ name: "Asha", email: "a@b.co", password: "12345678", confirm: "12345678" });
  await assert.rejects(A.signUp({ name: "Asha", email: "A@B.co", password: "12345678", confirm: "12345678" }), e => e.field === "email");
});
test("'keep me logged in' off keeps the session out of localStorage", async () => {
  await A.signUp({ name: "Ria", email: "ria@x.in", password: "12345678", confirm: "12345678" });
  await A.logIn({ email: "ria@x.in", password: "12345678", remember: false });
  assert.equal(localStorage.getItem("unicue_session"), null);
  assert.equal(A.getSession().email, "ria@x.in");
  await A.logIn({ email: "ria@x.in", password: "12345678", remember: true });
  assert.ok(localStorage.getItem("unicue_session"));
});
test("password reset replaces the password", async () => {
  await A.signUp({ name: "Dev", email: "dev@x.in", password: "oldpassword", confirm: "oldpassword" });
  A.logOut();
  await A.resetPassword({ email: "dev@x.in", password: "newpassword", confirm: "newpassword" });
  A.logOut();
  await assert.rejects(A.logIn({ email: "dev@x.in", password: "oldpassword" }));
  await A.logIn({ email: "dev@x.in", password: "newpassword" });
});
test("password strength and corrupt storage", () => {
  assert.equal(A.passwordStrength("").score, 0);
  assert.equal(A.passwordStrength("abc").label, "Too short");
  assert.equal(A.passwordStrength("abcdefgh").score, 2);
  assert.equal(A.passwordStrength("Abcdefgh12!x").score, 4);
  localStorage.setItem("unicue_session", "{not json");
  assert.equal(A.getSession(), null);
  localStorage.setItem("unicue_students", "[1,2]");
  assert.equal(A.isLoggedIn(), false);
});
test("return-to link only accepts in-app hashes, never auth screens", () => {
  A.rememberNext("#/login"); assert.equal(A.takeNext(), "");
  A.rememberNext("https://evil.example"); assert.equal(A.takeNext(), "");
  A.rememberNext("#/shared/abc"); assert.equal(A.takeNext(), "#/shared/abc");
  assert.equal(A.takeNext(), "", "it is used once");
});
test("form checks give one message per field", () => {
  assert.deepEqual(checkFields("login", { email: "", password: "" }), { email: "Enter your email.", password: "Enter your password." });
  const e = checkFields("signup", { name: "Z", email: "z@z.in", password: "12345678", confirm: "1234" });
  assert.ok(e.name && e.confirm && !e.email && !e.password);
});
