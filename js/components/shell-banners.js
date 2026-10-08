import { escapeHtml } from "../utils/escape.js";
import { icon } from "./icons.js";

export function emergencyBannerHtml(item) {
  if (!item) return "";
  return `<div class="shell-banner banner-emergency" role="alert"><a class="banner-main" href="#/information/${encodeURIComponent(item.id)}"><span class="badge badge-Critical">${escapeHtml(item.importance === "Critical" ? "Critical" : "Notice")}</span><strong>${escapeHtml(item.title)}</strong></a><button type="button" class="banner-close" data-dismiss-banner="${escapeHtml(item.id)}" aria-label="Dismiss notice">×</button></div>`;
}

const COPY = {
  prompt: ["Install UniCue", "Opens like an app and works offline.", "Install"],
  ios: ["Add UniCue to your Home Screen", "Tap Share, then Add to Home Screen. It also helps your phone keep your saved data.", "Got it"],
  "ios-safari": ["Open in Safari to install", "This browser can't add apps. Open the link in Safari, then tap Share and Add to Home Screen.", "Got it"]
};

export function installBannerHtml(mode) {
  const c = COPY[mode];
  if (!c) return "";
  return `<div class="shell-banner banner-install" role="region" aria-label="Install"><span class="banner-ico">${icon("home", 20)}</span><span class="banner-text"><strong>${escapeHtml(c[0])}</strong><span>${escapeHtml(c[1])}</span></span><button type="button" class="chip-button" data-install-action="${mode}">${escapeHtml(c[2])}</button><button type="button" class="banner-close" data-install-dismiss aria-label="Hide for now">×</button></div>`;
}

export function installCardHtml(mode) {
  const c = COPY[mode === "none" ? "" : mode];
  if (!c) return "";
  return `<section class="card"><h2>Install UniCue</h2><p class="muted">${escapeHtml(c[1])}</p>${mode === "prompt" ? `<button type="button" class="button button-primary" data-install-action="prompt">Install app</button>` : ""}</section>`;
}

export function updateBannerHtml() {
  return `<div class="shell-banner banner-update" role="status"><span class="banner-text"><strong>UniCue was updated</strong><span>Tap refresh to get the latest version.</span></span><button type="button" class="chip-button" data-reload-app>Refresh</button></div>`;
}
