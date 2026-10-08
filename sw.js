// UniCue service worker.
// - App shell is precached (each file individually, so one miss can't break the rest).
// - Same-origin files: network-first (so deployed updates show up) with cache fallback for offline.
// - Firebase SDK modules (versioned, immutable URLs): cache-first.
// - Firestore/Auth API traffic is never intercepted.
// Bump CACHE_NAME whenever the APP_SHELL list changes.
const CACHE_NAME = "unicue-static-v21";
const NETWORK_TIMEOUT_MS = 4000;
const APP_SHELL = [
  "./",
  "./assets/icons/apple-touch-icon.png",
  "./assets/icons/favicon-32.png",
  "./assets/icons/favicon.svg",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-512.png",
  "./css/app.css",
  "./data/holidays.json",
  "./data/university-guide.json",
  "./index.html",
  "./js/admin/auth.js",
  "./js/auth/student-auth.js",
  "./js/pages/auth.js",
  "./js/app.js",
  "./js/theme.js",
  "./js/components/bottom-nav.js",
  "./js/components/empty-state.js",
  "./js/components/error-state.js",
  "./js/components/header.js",
  "./js/components/icons.js",
  "./js/components/index.js",
  "./js/components/skeleton.js",
  "./js/components/toast.js",
  "./js/domain/attendance.js",
  "./js/domain/deadlines.js",
  "./js/domain/backup.js",
  "./js/domain/holidays.js",
  "./js/domain/ics.js",
  "./js/domain/inbox.js",
  "./js/domain/smart-paste.js",
  "./js/domain/backup-reminder.js",
  "./js/utils/backup-state.js",
  "./js/pages/privacy.js",
  "./js/domain/placement-paste.js",
  "./js/domain/semester.js",
  "./js/pages/admin-semester.js",
  "./js/repositories/semester-repository.js",
  "./js/domain/setup.js",
  "./js/domain/course-share.js",
  "./js/pages/setup-shared.js",
  "./js/domain/timetable.js",
  "./js/pages/timetable.js",
  "./js/utils/xlsx-lite.js",
  "./js/utils/csv.js",
  "./js/app-config.js",
  "./js/pages/company.js",
  "./js/components/shell-banners.js",
  "./js/utils/install.js",
  "./js/utils/banner-state.js",
  "./js/domain/deadline-tools.js",
  "./js/pages/deadline-shared.js",
  "./js/utils/share.js",
  "./js/domain/trip.js",
  "./js/domain/placement-insights.js",
  "./js/utils/placement-prefs.js",
  "./js/domain/information.js",
  "./js/domain/placements.js",
  "./js/domain/planner.js",
  "./js/domain/today.js",
  "./js/firebase/auth.js",
  "./js/firebase/client.js",
  "./js/firebase/config.js",
  "./js/firebase/firestore.js",
  "./js/pages/admin-information.js",
  "./js/pages/admin.js",
  "./js/pages/attendance.js",
  "./js/pages/course-detail.js",
  "./js/pages/course-form.js",
  "./js/pages/deadline-form.js",
  "./js/pages/deadlines.js",
  "./js/pages/home.js",
  "./js/pages/leave-planner.js",
  "./js/pages/information-detail.js",
  "./js/pages/information.js",
  "./js/pages/more.js",
  "./js/pages/placement-detail.js",
  "./js/pages/placement.js",
  "./js/pages/settings.js",
  "./js/repositories/attendance-repository.js",
  "./js/repositories/deadline-repository.js",
  "./js/repositories/content-sync.js",
  "./js/repositories/information-repository.js",
  "./js/repositories/local-storage.js",
  "./js/repositories/placement-repository.js",
  "./js/router.js",
  "./js/state/store.js",
  "./js/utils/dates.js",
  "./js/utils/download.js",
  "./js/utils/escape.js",
  "./js/utils/formatting.js",
  "./js/utils/ids.js",
  "./js/utils/read-state.js",
  "./js/utils/validation.js",
  "./manifest.json"
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(APP_SHELL.map(url => cache.add(url).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const network = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  });
  const timeout = new Promise(resolve => setTimeout(() => resolve(null), NETWORK_TIMEOUT_MS));
  try {
    const response = await Promise.race([network, timeout]);
    if (response) return response;
  } catch {}
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    return await network;
  } catch {
    if (request.mode === "navigate") {
      const shell = await cache.match("./index.html");
      if (shell) return shell;
    }
    return Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin) event.respondWith(networkFirst(request));
  else if (url.hostname === "www.gstatic.com" && url.pathname.startsWith("/firebasejs/")) event.respondWith(cacheFirst(request));
});
