import { icon } from "../components/icons.js";
import { escapeHtml } from "../utils/escape.js";
import { getTheme, resolveTheme, setTheme } from "../theme.js";
import { AuthError, firstName, logIn, passwordStrength, resetPassword, signUp, takeNext, validateEmail } from "../auth/student-auth.js";

// ---------------------------------------------------------------------------------------------
// Student login, sign-up and "forgot password". Demo only: see js/auth/student-auth.js.
// The hero (left on desktop, banner on phones) stays on screen when you switch between the three
// screens, so the woven logo animation plays once, not on every tab change.
// ---------------------------------------------------------------------------------------------

const KINDS = {
  login: { title: "Welcome back", sub: "Log in to see today's classes, deadlines and drives.", doc: "Log in" },
  signup: { title: "Create your account", sub: "Takes a minute. Then UniCue is ready for your semester.", doc: "Sign up" },
  forgot: { title: "Reset your password", sub: "Choose a new password for the account saved on this phone.", doc: "Reset password" }
};

/** The woven U and C, drawn as strokes so it can be inked in. Same paths as assets/logo. */
function weaveMark(cls = "") {
  const C = "M468 165H141A58.5 58.5 0 0 0 141 282H468";
  const U = "M189 44V337A76 76 0 0 0 341 337V44";
  return `<svg class="auth-mark ${cls}" viewBox="0 0 512 512" role="img" aria-label="UniCue logo">
  <defs>
    <clipPath id="am-h1"><rect x="149" y="130" width="80" height="70"/></clipPath><clipPath id="am-a1"><rect x="143" y="130" width="92" height="70"/></clipPath>
    <clipPath id="am-h2"><rect x="301" y="245" width="80" height="70"/></clipPath><clipPath id="am-a2"><rect x="295" y="245" width="92" height="70"/></clipPath>
  </defs>
  <rect class="am-tile" width="512" height="512" rx="112" fill="#14152B"/>
  <g fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path class="am-c" pathLength="1" d="${C}" stroke="#F5A623" stroke-width="40"/>
    <path class="am-u-gap" pathLength="1" d="${U}" stroke="#14152B" stroke-width="62" stroke-linecap="butt"/>
    <path class="am-u" pathLength="1" d="${U}" stroke="#fff" stroke-width="40"/>
    <g class="am-stitch">
      <g clip-path="url(#am-h1)"><path d="${C}" stroke="#14152B" stroke-width="62" stroke-linecap="butt"/></g><g clip-path="url(#am-a1)"><path d="${C}" stroke="#F5A623" stroke-width="40"/></g>
      <g clip-path="url(#am-h2)"><path d="${C}" stroke="#14152B" stroke-width="62" stroke-linecap="butt"/></g><g clip-path="url(#am-a2)"><path d="${C}" stroke="#F5A623" stroke-width="40"/></g>
    </g>
  </g>
</svg>`;
}

const ring = `<svg viewBox="0 0 44 44" width="44" height="44" aria-hidden="true"><circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="5"/><circle cx="22" cy="22" r="18" fill="none" stroke="#3ecf9a" stroke-width="5" stroke-linecap="round" stroke-dasharray="97.3 113.1" transform="rotate(-90 22 22)"/></svg>`;

function heroHtml() {
  return `<section class="auth-hero" aria-label="About UniCue">
  <svg class="auth-weave" viewBox="0 0 512 512" aria-hidden="true"><path d="M468 165H141A58.5 58.5 0 0 0 141 282H468" fill="none" stroke="currentColor" stroke-width="30" stroke-linecap="round"/><path d="M189 44V337A76 76 0 0 0 341 337V44" fill="none" stroke="currentColor" stroke-width="30" stroke-linecap="round"/></svg>
  <div class="auth-hero-inner">
    <div class="auth-brand">${weaveMark()}<span class="auth-word">UniCue</span></div>
    <p class="auth-tagline">Know what matters.</p>
    <p class="auth-lede">Attendance, deadlines, messages and placement drives for LPU students, in one calm place.</p>
    <ul class="auth-preview" aria-hidden="true">
      <li class="pv pv-1"><span class="pv-ico">${ring}</span><span class="pv-text"><strong>Safe to skip today</strong><span>You stay above 85%.</span></span></li>
      <li class="pv pv-2"><span class="pv-ico pv-amber">${icon("deadlines", 22)}</span><span class="pv-text"><strong>Quiz due tomorrow</strong><span>Reminder at 6:00 PM.</span></span></li>
      <li class="pv pv-3"><span class="pv-ico pv-indigo">${icon("placement", 22)}</span><span class="pv-text"><strong>Drive closes in 6 hours</strong><span>Register before 5:00 PM.</span></span></li>
    </ul>
  </div>
</section>`;
}

const themeButton = () => {
  const dark = resolveTheme(getTheme()) === "dark";
  return `<button type="button" class="auth-theme" data-auth-theme aria-label="${dark ? "Switch to light theme" : "Switch to dark theme"}">${icon(dark ? "sun" : "moon", 20)}</button>`;
};

function field({ name, label, type = "text", ico, autocomplete, placeholder, toggle = false, extra = "", inputmode = "" }) {
  return `<div class="field" data-field="${name}">
  <label for="f-${name}">${label}</label>
  <div class="control">
    <span class="control-ico">${icon(ico, 20)}</span>
    <input class="auth-input${toggle ? " has-toggle" : ""}" id="f-${name}" name="${name}" type="${type}" autocomplete="${autocomplete}" placeholder="${placeholder}" ${inputmode ? `inputmode="${inputmode}"` : ""} autocapitalize="${name === "name" ? "words" : "none"}" spellcheck="false" aria-describedby="err-${name}${extra ? ` hint-${name}` : ""}" required>
    ${toggle ? `<button type="button" class="reveal" data-reveal="f-${name}" aria-label="Show password" aria-pressed="false"><span class="r-show">${icon("eye", 20)}</span><span class="r-hide">${icon("eyeOff", 20)}</span></button>` : ""}
  </div>
  ${extra}
  <p class="field-error" id="err-${name}" role="alert" hidden></p>
</div>`;
}

const strengthMeter = `<div class="meter" id="hint-password" aria-live="polite"><span class="meter-bars" data-score="0"><i></i><i></i><i></i><i></i></span><span class="meter-label">At least 8 characters.</span></div>`;

function formHtml(kind) {
  const submit = label => `<button class="auth-submit" type="submit"><span class="s-label">${label}</span><span class="s-spin" aria-hidden="true"></span></button>`;
  const formError = `<p class="auth-error" data-form-error role="alert" hidden>${icon("alert", 18)}<span></span></p>`;
  if (kind === "signup") {
    return `<form class="auth-form" id="auth-form" data-kind="signup" novalidate>
    ${field({ name: "name", label: "Full name", ico: "profile", autocomplete: "name", placeholder: "Your name" })}
    ${field({ name: "email", label: "Email", type: "email", ico: "mail", autocomplete: "email", placeholder: "you@example.com", inputmode: "email" })}
    ${field({ name: "password", label: "Password", type: "password", ico: "lock", autocomplete: "new-password", placeholder: "At least 8 characters", toggle: true, extra: strengthMeter })}
    ${field({ name: "confirm", label: "Confirm password", type: "password", ico: "lock", autocomplete: "new-password", placeholder: "Re-enter your password", toggle: true })}
    ${formError}${submit("Create account")}
  </form>`;
  }
  if (kind === "forgot") {
    return `<form class="auth-form" id="auth-form" data-kind="forgot" novalidate>
    ${field({ name: "email", label: "Email", type: "email", ico: "mail", autocomplete: "email", placeholder: "you@example.com", inputmode: "email" })}
    ${field({ name: "password", label: "New password", type: "password", ico: "lock", autocomplete: "new-password", placeholder: "At least 8 characters", toggle: true, extra: strengthMeter })}
    ${field({ name: "confirm", label: "Confirm new password", type: "password", ico: "lock", autocomplete: "new-password", placeholder: "Re-enter your password", toggle: true })}
    ${formError}${submit("Reset password")}
    <a class="auth-back" href="#/login">Back to log in</a>
  </form>`;
  }
  return `<form class="auth-form" id="auth-form" data-kind="login" novalidate>
    ${field({ name: "email", label: "Email", type: "email", ico: "mail", autocomplete: "email", placeholder: "you@example.com", inputmode: "email" })}
    ${field({ name: "password", label: "Password", type: "password", ico: "lock", autocomplete: "current-password", placeholder: "Enter your password", toggle: true })}
    <div class="auth-row">
      <label class="check"><input type="checkbox" name="remember" checked><span class="check-box">${icon("check", 14)}</span><span>Remember me</span></label>
      <a class="auth-link" href="#/forgot">Forgot password?</a>
    </div>
    ${formError}${submit("Log in")}
  </form>`;
}

/** The right-hand side (or the card under the banner on phones). Replaced whenever the screen changes. */
export function renderAuthSide(kind = "login") {
  const k = KINDS[kind] ? kind : "login";
  const meta = KINDS[k];
  const tabs = k === "forgot" ? "" : `<nav class="auth-switch" aria-label="Account">
      <a href="#/login" ${k === "login" ? 'aria-current="page"' : ""}>Log in</a><a href="#/signup" ${k === "signup" ? 'aria-current="page"' : ""}>Sign up</a></nav>`;
  return `<div class="auth-side" data-auth-side data-kind="${k}">
  <div class="auth-card" data-auth-card>
    ${tabs}
    <div class="auth-body" data-auth-body>
      <h1 class="auth-title">${meta.title}</h1>
      <p class="auth-sub">${meta.sub}</p>
      ${formHtml(k)}
    </div>
    <p class="auth-demo">${icon("shield", 16)}<span>Your account data stays on this phone and is never sent anywhere.</span></p>
    <a class="auth-admin" href="#/admin">${icon("shield", 18)}<span>Log in as admin</span></a>
  </div>
</div>`;
}

export function renderAuthScreen(kind = "login") {
  return `<div class="auth" data-auth>${heroHtml()}${themeButton()}${renderAuthSide(kind)}</div>`;
}

/** Paint the auth screen into `app`. Keeps the hero when it is already there. */
export function mountAuth(app, kind, { navigate }) {
  const k = KINDS[kind] ? kind : "login";
  const existing = app.querySelector("[data-auth]");
  if (existing) existing.querySelector("[data-auth-side]").outerHTML = renderAuthSide(k);
  else {
    app.innerHTML = renderAuthScreen(k);
    app.querySelector("[data-auth-theme]").addEventListener("click", event => {
      const now = resolveTheme(getTheme()) === "dark" ? "light" : "dark";
      setTheme(now);
      const btn = event.currentTarget;
      btn.innerHTML = icon(now === "dark" ? "sun" : "moon", 20);
      btn.setAttribute("aria-label", now === "dark" ? "Switch to light theme" : "Switch to dark theme");
    });
  }
  document.title = `${KINDS[k].doc} · UniCue`;
  bindAuth(app.querySelector("[data-auth-side]"), { navigate });
}

// ---------------------------------------------------------------------------------------------
// Behaviour
// ---------------------------------------------------------------------------------------------

const reducedMotion = () => globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function setFieldError(form, name, message) {
  const wrap = form.querySelector(`[data-field="${name}"]`);
  if (!wrap) return;
  const out = wrap.querySelector(".field-error");
  const input = wrap.querySelector("input");
  out.textContent = message || "";
  out.hidden = !message;
  wrap.classList.toggle("invalid", Boolean(message));
  if (message) input.setAttribute("aria-invalid", "true"); else input.removeAttribute("aria-invalid");
}
function setFormError(form, message) {
  const box = form.querySelector("[data-form-error]");
  box.querySelector("span").textContent = message || "";
  box.hidden = !message;
}

/** Client-side checks that run before anything is looked up. Returns { field: message }. */
export function checkFields(kind, v) {
  const errors = {};
  if (kind === "signup" && !/\p{L}.*\p{L}|\p{L}{2}/u.test(String(v.name || "").trim())) errors.name = "Enter your name (at least 2 letters).";
  if (!validateEmail(v.email)) errors.email = String(v.email || "").trim() ? "Enter a valid email, like you@example.com." : "Enter your email.";
  if (kind === "login") { if (!v.password) errors["password"] = "Enter your password."; }
  else {
    if (!passwordStrength(v.password).ok) errors["password"] = "Use at least 8 characters.";
    if (!v.confirm) errors.confirm = "Re-enter your password.";
    else if (v.password !== v.confirm) errors.confirm = "The two passwords don't match.";
  }
  return errors;
}

function bindMeter(form) {
  const pw = form.querySelector('[name="password"]');
  const meter = form.querySelector(".meter");
  if (!pw || !meter) return;
  const bars = meter.querySelector(".meter-bars");
  const label = meter.querySelector(".meter-label");
  pw.addEventListener("input", () => {
    const s = passwordStrength(pw.value);
    bars.dataset.score = String(s.score);
    label.textContent = s.label || "At least 8 characters.";
    meter.dataset.state = s.score >= 3 ? "good" : s.score === 2 ? "okay" : s.score === 1 ? "weak" : "";
    const confirm = form.querySelector('[name="confirm"]');
    if (confirm?.value) setFieldError(form, "confirm", confirm.value === pw.value ? "" : "The two passwords don't match.");
  });
}

async function showWelcome(side, user, navigate) {
  const card = side.querySelector("[data-auth-card]");
  card.classList.add("is-done");
  card.innerHTML = `<div class="auth-done" role="status"><span class="done-badge"><svg viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="23" fill="none" stroke="currentColor" stroke-width="3.5" pathLength="1"/><path d="M15 27l8 8 14-16" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" pathLength="1"/></svg></span>
    <h1 class="auth-title">Welcome, ${escapeHtml(firstName(user))}</h1><p class="auth-sub">Opening your dashboard…</p></div>`;
  await wait(reducedMotion() ? 450 : 1150);
  navigate(takeNext() || "#/");
}

export function bindAuth(side, { navigate }) {
  const form = side.querySelector("#auth-form");
  if (!form) return;
  const kind = form.dataset.kind;
  bindMeter(form);

  form.querySelectorAll("[data-reveal]").forEach(btn => btn.addEventListener("click", () => {
    const input = form.querySelector(`#${btn.dataset.reveal}`);
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    btn.setAttribute("aria-pressed", String(show));
    btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
    btn.classList.toggle("on", show);
  }));

  // Tidy as you type: clear a field's message once the person starts fixing it.
  form.addEventListener("input", event => {
    const name = event.target?.name;
    if (!name) return;
    setFormError(form, "");
    if (name !== "confirm" && name !== "password") setFieldError(form, name, "");
    if (name === "password" && kind === "login") setFieldError(form, name, "");
    if (name === "confirm") setFieldError(form, "confirm", "");
  });
  form.querySelector('[name="email"]')?.addEventListener("blur", event => {
    const v = event.target.value.trim();
    if (v && !validateEmail(v)) setFieldError(form, "email", "Enter a valid email, like you@example.com.");
  });
  form.querySelector('[name="confirm"]')?.addEventListener("blur", event => {
    const pw = form.querySelector('[name="password"]').value;
    if (event.target.value && event.target.value !== pw) setFieldError(form, "confirm", "The two passwords don't match.");
  });

  let busy = false;
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (busy) return;
    const data = Object.fromEntries(new FormData(form).entries());
    data.remember = Boolean(form.elements.remember?.checked);
    const names = ["name", "email", "password", "confirm"].filter(n => form.querySelector(`[data-field="${n}"]`));
    names.forEach(n => setFieldError(form, n, ""));
    setFormError(form, "");

    const errors = checkFields(kind, data);
    const first = names.find(n => errors[n]);
    if (first) {
      names.forEach(n => setFieldError(form, n, errors[n] || ""));
      form.querySelector(`[name="${first}"]`).focus();
      shake(side);
      return;
    }

    busy = true;
    form.classList.add("is-busy");
    const button = form.querySelector(".auth-submit");
    button.disabled = true;
    try {
      await wait(reducedMotion() ? 0 : 650);       // a short beat so the button shows it is working
      const user = kind === "signup" ? await signUp(data) : kind === "forgot" ? await resetPassword(data) : await logIn(data);
      await showWelcome(side, user, navigate);
    } catch (error) {
      busy = false;
      form.classList.remove("is-busy");
      button.disabled = false;
      if (error instanceof AuthError && error.field && form.querySelector(`[data-field="${error.field}"]`)) {
        setFieldError(form, error.field, error.message);
        form.querySelector(`[name="${error.field}"]`).focus();
      } else setFormError(form, error instanceof AuthError ? error.message : "Something went wrong. Please try again.");
      shake(side);
    }
  });
}

function shake(side) {
  const card = side.querySelector("[data-auth-card]");
  if (!card || reducedMotion()) return;
  card.classList.remove("shake");
  void card.offsetWidth;           // restart the animation
  card.classList.add("shake");
}
