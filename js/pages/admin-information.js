import { informationRepository } from "../repositories/information-repository.js";
import { placementRepository } from "../repositories/placement-repository.js";
import {
  INFORMATION_CATEGORIES, INFORMATION_IMPORTANCE, parseInformationForm,
  formatImportantDatesText, formatAttachmentsText, formatContactsText
} from "../domain/information.js";
import { smartPaste, findSimilar } from "../domain/smart-paste.js";
import { formatImportantDatesText as fmtDates, formatContactsText as fmtContacts } from "../domain/information.js";
import { parsePlacementForm, findSimilarPlacements } from "../domain/placements.js";
import { smartPastePlacement } from "../domain/placement-paste.js";
import { infoCard } from "./information.js";
import { informationDetailHtml } from "./information-detail.js";
import { placementDetailHtml } from "./placement-detail.js";
import { escapeHtml } from "../utils/escape.js";
import { getCurrentAdmin } from "../admin/auth.js";
import { errorState } from "../components/error-state.js";
import { icon } from "../components/icons.js";

/* ---------------- Information editor ---------------- */

// A copy starts as a draft with no ids/dates from the original. Banner and expiry are not carried over.
const copyOf = (item, extra = {}) => { const { id, createdAt, updatedAt, publishedAt, createdBy, updatedBy, ...rest } = item; return { ...rest, status: "draft", ...extra }; };

export async function renderInformationEditor({ id, templateId } = {}) {
  const admin = await getCurrentAdmin();
  if (!admin) return accessRequired();
  try {
    if (templateId) {
      const source = await informationRepository.getById(templateId, { fresh: true });
      if (!source) return errorState("Information not found", "The message to copy may have been deleted.");
      return informationForm(copyOf(source, { banner: false, expiresAt: "" }), { copy: true });
    }
    const item = id ? await informationRepository.getById(id, { fresh: true }) : null;
    if (id && !item) return errorState("Information not found", "It may have been deleted.");
    return informationForm(item);
  } catch (error) {
    return errorState("Unable to load information", error.message);
  }
}

export function bindInformationEditor(root, { id, navigate }) {
  bindSmartPaste(root, id);
  bindPreview(root, {
    formId: "information-editor",
    parse: data => parseInformationForm(data),
    transform: (data, form) => ({ ...data, verified: Boolean(form.elements.namedItem("verified")?.checked), banner: Boolean(form.elements.namedItem("banner")?.checked) }),
    build: value => { const now = new Date().toISOString(); const item = { ...value, id: "preview", status: "published", publishedAt: now, updatedAt: now };
      return `<p class="preview-label">In the Messages list</p>${infoCard(item)}<p class="preview-label">When opened</p>${informationDetailHtml(item)}`; }
  });
  bindEditor(root, {
    formId: "information-editor",
    parse: data => parseInformationForm(data),
    save: (payload, uid) => id
      ? informationRepository.update(id, { ...payload, updatedBy: uid })
      : informationRepository.create({ ...payload, createdBy: uid, updatedBy: uid }),
    done: () => navigate("#/admin/information"),
    transform: (data, form) => ({ ...data, verified: Boolean(form.elements.namedItem("verified")?.checked), banner: Boolean(form.elements.namedItem("banner")?.checked) })
  });
}

function informationForm(item, { copy = false } = {}) {
  const v = name => escapeHtml(item?.[name] ?? "");
  const option = (current, value, label = value) => `<option value="${escapeHtml(value)}" ${current === value ? "selected" : ""}>${escapeHtml(label)}</option>`;
  return `<div class="page-header"><a class="back-link" href="#/admin/information">${icon("chevron", 16)} Messages</a><h1 class="page-title">${copy ? "New Message (copy)" : item ? "Edit Message" : "New Message"}</h1><p class="page-subtitle">Students see this in the Messages tab.</p></div>
  <form id="information-editor" class="form-stack admin-form" novalidate>
    <fieldset class="smart-paste"><legend>Smart paste</legend>
      <label>Paste the notice exactly as it appears in UMS<textarea id="smart-paste-input" rows="5" placeholder="Paste here, then tap Auto-fill. You can still edit every field."></textarea></label>
      <button type="button" class="button button-secondary" id="smart-paste-run">Auto-fill from pasted text</button>
      <ul class="smart-notes" id="smart-paste-notes" hidden></ul>
    </fieldset>
    <fieldset><legend>Message</legend>
    <label>Title<input name="title" required maxlength="200" value="${v("title")}" placeholder="Short, clear headline"></label>
    <div class="form-grid two">
      <label>Category<select name="category">${INFORMATION_CATEGORIES.map(x => option(item?.category, x)).join("")}</select></label>
      <label>Importance<select name="importance">${INFORMATION_IMPORTANCE.map(x => option(item?.importance || "Normal", x)).join("")}</select></label>
    </div>
    <label class="checkbox-row"><input type="checkbox" name="banner" ${item?.banner ? "checked" : ""}> Emergency banner: show at the top of every screen until it expires or a student dismisses it</label>
    <label>What students must do <span class="muted">(one line, shown on the card)</span><input name="summary" maxlength="200" value="${v("summary")}" placeholder="e.g. Register on UMS before 21 Oct, 5 PM"></label>
    <label>Company <span class="muted">(optional, groups repeat updates)</span><input name="company" maxlength="80" value="${v("company")}" placeholder="e.g. Google"></label>
    <div id="similar-warning" class="similar-warning" hidden></div>
    <label>Content<textarea name="content" rows="8" required placeholder="Paste the notice text. Remove repeated headings.">${v("content")}</textarea></label>
    </fieldset>
    <fieldset><legend>Source</legend>
      <label>Source name<input name="sourceName" value="${v("sourceName")}" placeholder="e.g. LPU UMS announcement"></label>
      <label>Official source URL<input type="url" name="sourceUrl" value="${v("sourceUrl")}" placeholder="https://"></label>
      <label class="checkbox-row"><input type="checkbox" name="verified" ${item?.verified ? "checked" : ""}> Verified by UniCue admin (source/content checked)</label>
    </fieldset>
    <fieldset><legend>What the student should do</legend>
      <label>Action label<input name="actionLabel" value="${escapeHtml(item?.action?.label || "")}" placeholder="e.g. Register on UMS"></label>
      <label>Action URL<input type="url" name="actionUrl" value="${escapeHtml(item?.action?.url || "")}" placeholder="https://"></label>
      <label>Important dates <span class="muted">(one per line: Label | YYYY-MM-DD | HH:MM, time optional)</span><textarea name="importantDatesText" rows="3" placeholder="Last date to register | 2026-10-21 | 17:00">${escapeHtml(formatImportantDatesText(item?.importantDates))}</textarea></label>
    </fieldset>
    <fieldset><legend>Attachments and contacts</legend>
      <label>Attachments <span class="muted">(one per line: Name | https://link)</span><textarea name="attachmentsText" rows="3">${escapeHtml(formatAttachmentsText(item?.attachments))}</textarea></label>
      <label>Contacts <span class="muted">(one per line: Label | value)</span><textarea name="contactsText" rows="3">${escapeHtml(formatContactsText(item?.contacts))}</textarea></label>
    </fieldset>
    <fieldset><legend>Publishing</legend>
      <div class="form-grid">
        <label>Published at<input type="datetime-local" name="publishedAt" value="${localValue(item?.publishedAt)}"></label>
        <label>Expires at<input type="datetime-local" name="expiresAt" value="${localValue(item?.expiresAt)}"></label>
      </div>
      <label>Status<select name="status">${option(item?.status || "draft", "draft", "Draft (hidden from students)")}${option(item?.status || "draft", "published", "Published (visible to students)")}${option(item?.status || "draft", "expired", "Expired (hidden from list)")}</select></label>
    </fieldset>
    <div id="information-editor-errors" class="form-errors" role="alert"></div>
    <div class="sticky-actions"><a class="button button-secondary" href="#/admin/information">Cancel</a><button class="button button-secondary" type="button" data-preview>Preview</button><button class="button button-primary" type="submit">Save message</button></div>
  </form>
  <div id="preview-panel" class="preview-panel" hidden aria-live="polite"></div>`;
}

/* ---------------- Placement editor ---------------- */

export async function renderPlacementEditor({ id, templateId } = {}) {
  const admin = await getCurrentAdmin();
  if (!admin) return accessRequired();
  try {
    if (templateId) {
      const source = await placementRepository.getById(templateId, { fresh: true });
      if (!source) return errorState("Placement not found", "The placement to copy may have been deleted.");
      return placementForm(copyOf(source, { applicationDeadline: "", driveDate: "" }), { copy: true });
    }
    const item = id ? await placementRepository.getById(id, { fresh: true }) : null;
    if (id && !item) return errorState("Placement not found", "It may have been deleted.");
    return placementForm(item);
  } catch (error) {
    return errorState("Unable to load placement", error.message);
  }
}

export function bindPlacementEditor(root, { id, navigate }) {
  bindPlacementPaste(root, id);
  bindPreview(root, {
    formId: "placement-editor",
    parse: data => parsePlacementForm(data),
    build: value => `<p class="preview-label">When opened</p>${placementDetailHtml({ ...value, id: "preview", status: value.status === "closed" ? "closed" : "published" })}`
  });
  bindEditor(root, {
    formId: "placement-editor",
    parse: data => parsePlacementForm(data),
    save: (payload, uid) => id
      ? placementRepository.update(id, { ...payload, updatedBy: uid })
      : placementRepository.create({ ...payload, createdBy: uid, updatedBy: uid }),
    done: () => navigate("#/admin/placements")
  });
}

function placementForm(item, { copy = false } = {}) {
  const v = name => escapeHtml(item?.[name] ?? "");
  const text = (label, name, extra = "") => `<label>${label}<input name="${name}" value="${v(name)}" ${extra}></label>`;
  const area = (label, name, rows) => `<label>${label}<textarea name="${name}" rows="${rows}">${v(name)}</textarea></label>`;
  const status = item?.status || "draft";
  const opt = (value, label) => `<option value="${value}" ${status === value ? "selected" : ""}>${label}</option>`;
  return `<div class="page-header"><a class="back-link" href="#/admin/placements">${icon("chevron", 16)} Placements</a><h1 class="page-title">${copy ? "New Placement (copy)" : item ? "Edit Placement" : "New Placement"}</h1><p class="page-subtitle">Keep the official LPU application link as the action point.</p></div>
  <form id="placement-editor" class="form-stack admin-form" novalidate>
    <fieldset class="smart-paste"><legend>Smart paste</legend>
      <label>Paste the company notice as it appears in UMS<textarea id="smart-paste-input" rows="5" placeholder="Works best with lines like Company:, Role:, CTC:, Location:, Eligibility:, Selection Process:, Last date:"></textarea></label>
      <button type="button" class="button button-secondary" id="smart-paste-run">Auto-fill from pasted text</button>
      <ul class="smart-notes" id="smart-paste-notes" hidden></ul>
    </fieldset>
    <div id="similar-warning" class="similar-warning" hidden></div>
    <fieldset><legend>Opportunity</legend>
      ${text("Company", "company", 'required maxlength="150"')}
      ${text("Role", "role", 'required maxlength="150"')}
      <div class="form-grid two">${text("Drive type", "driveType", 'placeholder="Placement"')}${text("Drive code", "driveCode")}</div>
      <div class="form-grid two">${text("Eligible batches", "eligibleBatches")}${text("Eligible programs", "eligiblePrograms")}</div>
      ${area("Eligibility", "eligibility", 3)}
      <div class="form-grid two">${text("Salary / package", "salary", 'placeholder="450000 or 4.5 LPA"')}${text("Bond", "bond")}</div>
      ${text("Work locations", "workLocations", 'placeholder="Pune, Noida, Bangalore"')}
    </fieldset>
    <fieldset><legend>Dates</legend>
      <label>Application deadline<input type="datetime-local" name="applicationDeadline" value="${localValue(item?.applicationDeadline)}"></label>
      <label>Drive date<input type="datetime-local" name="driveDate" value="${localValue(item?.driveDate)}"></label>
      <label>Joining date<input type="datetime-local" name="joiningDate" value="${localValue(item?.joiningDate)}"></label>
    </fieldset>
    <fieldset><legend>Details</legend>
      ${area("Job description", "jobDescription", 8)}
      ${area("Skills", "skills", 4)}
      ${area("Selection process", "selectionProcess", 5)}
      ${area("Documents required", "documentsRequired", 4)}
      ${area("Special requirements", "specialRequirements", 4)}
      ${text("Dress code", "dressCode")}
    </fieldset>
    <fieldset><legend>Contact and official sources</legend>
      ${text("Contact person", "contactPerson")}
      ${area("TPC information", "tpcInfo", 4)}
      ${text("Company website", "companyWebsite", 'type="url" placeholder="https://"')}
      ${text("Official source URL", "officialSource", 'type="url" placeholder="https://"')}
      ${text("Official application URL", "applicationUrl", 'type="url" placeholder="https://"')}
    </fieldset>
    <fieldset><legend>Publishing</legend>
      <label>Status<select name="status">${opt("draft", "Draft (hidden from students)")}${opt("published", "Published (visible to students)")}${opt("closed", "Closed (visible, marked Closed)")}</select></label>
    </fieldset>
    <div id="placement-editor-errors" class="form-errors" role="alert"></div>
    <div class="sticky-actions"><a class="button button-secondary" href="#/admin/placements">Cancel</a><button class="button button-secondary" type="button" data-preview>Preview</button><button class="button button-primary" type="submit">Save placement</button></div>
  </form>
  <div id="preview-panel" class="preview-panel" hidden aria-live="polite"></div>`;
}

/* ---------------- Shared ---------------- */

function bindEditor(root, { formId, parse, save, done, transform }) {
  const form = root.querySelector(`#${formId}`);
  if (!form) return;
  const box = root.querySelector(`#${formId}-errors`);
  const submit = form.querySelector('button[type="submit"]');
  let saving = false;

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (saving) return; // prevents duplicate documents on double-tap
    box.textContent = "";
    let data = Object.fromEntries(new FormData(form).entries());
    if (transform) data = transform(data, form);
    const { value, errors } = parse(data);
    if (errors.length) { box.innerHTML = errors.map(escapeHtml).join("<br>"); return; }

    saving = true; submit.disabled = true; const label = submit.textContent; submit.textContent = "Saving…";
    try {
      const admin = await getCurrentAdmin();
      if (!admin) throw new Error("Your admin session has expired. Sign in again.");
      await save(value, admin.uid);
      done();
    } catch (error) {
      box.textContent = error.message || "Unable to save.";
      saving = false; submit.disabled = false; submit.textContent = label;
    }
  });
}

function localValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = n => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function accessRequired() {
  return `<div class="page-header"><h1 class="page-title">Admin access required</h1><p class="muted">Sign in with the configured administrator account.</p><a class="button button-primary" href="#/admin">Admin Login</a></div>`;
}

/* ---------------- Smart paste + similar-message warning ---------------- */

function bindSmartPaste(root, editingId) {
  const form = root.querySelector("#information-editor");
  if (!form) return;
  const field = name => form.elements.namedItem(name);
  const warning = root.querySelector("#similar-warning");
  let existing = null; // loaded once, only for this admin session (one read per message)

  const loadExisting = async () => {
    if (existing) return existing;
    try { existing = await informationRepository.getAll(); } catch { existing = []; }
    return existing;
  };
  const checkSimilar = async () => {
    const draft = { title: field("title").value, company: field("company").value, category: field("category").value };
    if (draft.title.trim().length < 6) { warning.hidden = true; return; }
    const matches = findSimilar(draft, await loadExisting(), { excludeId: editingId || "" });
    if (!matches.length) { warning.hidden = true; return; }
    warning.hidden = false;
    warning.innerHTML = `<strong>Similar message already exists.</strong> Edit it instead of posting a repeat?<br>${matches.map(m => `<a href="#/admin/information/${encodeURIComponent(m.item.id)}/edit">${escapeHtml(m.item.title)}</a> <span class="muted">(${escapeHtml(m.reason)}, ${escapeHtml(m.item.status)})</span>`).join("<br>")}`;
  };

  root.querySelector("#smart-paste-run")?.addEventListener("click", async () => {
    const result = smartPaste(root.querySelector("#smart-paste-input").value);
    const notes = root.querySelector("#smart-paste-notes");
    if (!result.content) { notes.hidden = false; notes.innerHTML = "<li>Paste some text first.</li>"; return; }
    const set = (name, value) => { const el = field(name); if (el && value !== undefined && value !== "") el.value = value; };
    set("title", result.title); set("category", result.category); set("importance", result.importance);
    set("content", result.content); set("summary", result.summary); set("company", result.company);
    if (!field("sourceName").value) set("sourceName", "UMS");
    set("actionUrl", result.actionUrl); if (result.actionUrl && !field("actionLabel").value) set("actionLabel", "Open link");
    set("importantDatesText", fmtDates(result.importantDates)); set("contactsText", fmtContacts(result.contacts));
    notes.hidden = false;
    notes.innerHTML = result.notes.map(n => `<li>${escapeHtml(n)}</li>`).join("");
    await checkSimilar();
  });
  let timer;
  ["title", "company"].forEach(name => field(name)?.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(checkSimilar, 500); }));
}

/* ---------------- Preview as student (nothing is saved) ---------------- */
function bindPreview(root, { formId, parse, build, transform }) {
  const form = root.querySelector(`#${formId}`);
  const panel = root.querySelector("#preview-panel");
  const button = form?.querySelector("[data-preview]");
  if (!form || !panel || !button) return;
  button.addEventListener("click", () => {
    let data = Object.fromEntries(new FormData(form).entries());
    if (transform) data = transform(data, form);
    const { value, errors } = parse(data);
    panel.hidden = false;
    if (errors.length) { panel.innerHTML = `<div class="form-errors" role="alert">${errors.map(escapeHtml).join("<br>")}</div>`; return; }
    panel.innerHTML = `<p class="preview-note"><strong>Preview.</strong> This is what students will see. Nothing is saved yet.</p><div class="preview-frame" inert>${build(value)}</div>`;
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

/* ---------------- Placement smart paste + same-company warning ---------------- */
function bindPlacementPaste(root, editingId) {
  const form = root.querySelector("#placement-editor");
  if (!form) return;
  const field = name => form.elements.namedItem(name);
  const warning = root.querySelector("#similar-warning");
  let existing = null;
  const load = async () => { if (existing) return existing; try { existing = await placementRepository.getAll(); } catch { existing = []; } return existing; };
  const check = async () => {
    const matches = findSimilarPlacements({ company: field("company").value, role: field("role").value }, await load(), { excludeId: editingId || "" });
    if (!matches.length) { warning.hidden = true; return; }
    warning.hidden = false;
    warning.innerHTML = `<strong>This company already has a drive.</strong> Edit it instead of adding a repeat?<br>${matches.slice(0, 3).map(m => `<a href="#/admin/placements/${encodeURIComponent(m.item.id)}/edit">${escapeHtml(m.item.company)} — ${escapeHtml(m.item.role || "Role")}</a> <span class="muted">(${escapeHtml(m.reason)}, ${escapeHtml(m.item.status || "draft")})</span>`).join("<br>")}`;
  };
  root.querySelector("#smart-paste-run")?.addEventListener("click", async () => {
    const r = smartPastePlacement(root.querySelector("#smart-paste-input").value);
    const notes = root.querySelector("#smart-paste-notes");
    notes.hidden = false;
    if (!r.company && !r.role && !r.eligibility && !r.selectionProcess && !r.applicationDeadline) { notes.innerHTML = "<li>Paste the notice text first.</li>"; return; }
    for (const name of ["company", "role", "driveType", "eligibleBatches", "eligiblePrograms", "eligibility", "salary", "bond", "workLocations", "jobDescription", "skills", "selectionProcess", "contactPerson", "documentsRequired", "specialRequirements", "applicationUrl", "applicationDeadline", "driveDate"]) {
      const el = field(name); if (el && r[name]) el.value = r[name];
    }
    notes.innerHTML = r.notes.map(n => `<li>${escapeHtml(n)}</li>`).join("");
    await check();
  });
  let timer;
  ["company", "role"].forEach(name => field(name)?.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(check, 500); }));
}
