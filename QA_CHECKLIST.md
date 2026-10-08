# UniCue V1 QA Checklist

## Automated (run `npm test`: 51 tests)
- [x] Attendance, deadline, information and placement domain logic.
- [x] Admin Information create/edit/publish/unpublish/expire/delete through the real editor + manager code (against an in-memory Firebase fake that mirrors the rules).
- [x] Admin Placement create/publish/close/reopen/delete, student visibility of Closed.
- [x] Student cannot create/update/delete; drafts are not readable (rules model).
- [x] Home renders local sections when Firebase fails.
- [x] All relative imports resolve; every service-worker precache file exists; manifest icons exist.
- [x] `firestore.rules` contains the real admin UID and every write is gated by `isAdmin()`.
- [x] No passwords/private keys in source.

## Manual - REQUIRED against the live Firebase project (not verifiable offline)
Deploy `firestore.rules` first (see FIREBASE_SETUP.md).
- [ ] Admin login works; a different account is rejected.
- [ ] Create Information as Draft -> signed-out browser (or private window) cannot see it in the list or by direct link.
- [ ] Set Published -> appears in the student list and detail; Critical sorts above Normal.
- [ ] Action link, important dates, attachments, contact and source all render on the detail page.
- [ ] Unpublish / Expire / Delete from the manager refresh the list immediately.
- [ ] Information with a past expiry is absent from the list; its direct link says "This information has expired."
- [ ] Placement: create, publish, close, reopen, delete; Closed still visible to students and filterable.
- [ ] "Apply through official LPU process" opens the official URL in a new tab.
- [ ] In the Firebase console Rules Playground (or a signed-out console call), a student write is denied.
- [ ] Firestore may ask for a composite index only if a console error link appears; click it once if so (the student queries filter on `status` only, so none is expected).

## Manual - browser / device
- [ ] Home, Attendance, Deadlines, Placement, More: no console errors (Chrome desktop + mobile viewport).
- [ ] Attendance add/edit/delete persists after reload.
- [ ] Deadline add/edit/complete persists; date-only shows no time.
- [ ] Offline: reload with network off -> app shell loads, attendance/deadlines work, Home shows "unavailable" for remote sections.
- [ ] Install prompt appears (icons are now in the manifest); app opens standalone.
- [ ] After deploying a change, a normal refresh shows the new version (network-first service worker).

## Product boundaries
- [x] Attendance and deadlines stay student-local.
- [x] Information and placement content is admin-managed.
- [x] No UMS credentials requested; no scraping or access-control bypass.
- [x] Placement application actions leave UniCue for the official destination.

## Redesign checks (v9)
- Theme: System / Light / Dark in Profile; browser bar colour follows the theme; no flash on reload.
- Attendance: add a course with per-weekday class counts (e.g. Tue 1, Thu 2, Fri 2), then Update numbers (Conducted/Present/DL steppers). Check INT315 example: remaining 36, total 71, can miss 7.
- Holidays: with a holiday on a class day, the remaining count drops by that day's classes (Settings lists upcoming holidays).
- Leave planner: tap 7 days, check Now / No leave / After leave and per-course "to spare" or "over the limit". Open Update numbers on a long course name at 360px wide: nothing clipped, Back closes it. Placement list: package + type row, then location + register-by row.
- Messages: unread dot, bell count drops after opening a message, Critical banner on Home.
- Placement: "₹4.5 LPA" formatting, register-by countdown, "Add register-by to my deadlines" adds a deadline.
- Backup: Settings > Export, clear site data, Import restores courses, deadlines and theme.
- Offline: reload with airplane mode; holidays and screens still load.

## Updating holidays
Edit `data/holidays.json` (date as YYYY-MM-DD) and redeploy; phones pick it up on the next online visit.


## v14 foundation checks
- [ ] Open the app twice in a row: DevTools > Network shows only 1 Firestore request the second time (the version doc).
- [ ] Admin publishes a message, then a student phone reopens: the new message appears (version bump worked).
- [ ] Airplane mode: Messages and Placement still open from saved data and the "You're offline" bar shows.
- [ ] Bottom nav is Home, Messages, Attendance, Deadlines, Placement; the unread count sits on Messages.
- [ ] Profile is the person icon in the header; Admin is NOT visible there. Tap the version line on About 5 times to reach #/admin.
- [ ] Moving between tabs does not flicker the header or nav; scroll resets to top on a new page but stays put after ticking a deadline.
- [ ] Slow network: a skeleton appears instead of "Loading...".
- [ ] 363px wide: no sideways scroll on any tab, light and dark.

## v15 Phase 2 checks
- [ ] Messages: Critical items sit under "Needs attention"; repeated company updates collapse into "N earlier updates about X" (tap to expand).
- [ ] Messages: "Unread" chip filters; "Mark all read" clears the dots and the nav badge.
- [ ] Message detail: text pasted from UMS has no stray spaces, tabs or long blank gaps.
- [ ] Home: greeting card lists today's classes (none on holidays/Sundays) and up to 4 things needing attention, overdue first.
- [ ] Deadlines: grouped Overdue / Today / Tomorrow / This week / Later; tapping the circle completes it and shows Undo; Completed is collapsed.
- [ ] Deadlines: the calendar button downloads an .ics that opens in your calendar app with a 1-day-before reminder.
