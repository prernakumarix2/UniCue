# UniCue: Project Handoff

Paste this file (and attach the latest ZIP, `UniCue-v13-ui.zip`) at the start of a new chat. It replaces the old "master prompt", which is retired. This document is the spec.

## 1. What UniCue is
A mobile-first PWA for **Lovely Professional University (LPU)** students, built by a student (the owner). It helps with four things: **Attendance, Deadlines, Messages, Placements**.
- Students do **not** log in. Their attendance and deadlines live **only in the browser's localStorage** on their phone.
- The owner is the **only admin** and publishes Messages and Placements through Firebase.
- It complements LPU's UMS and LPU Touch. It never collects UMS credentials, scrapes, or processes placement applications.
- Sister apps by the same owner (style reference only): **ExTracker** (expenses) and **EdTracker** (CBSE study tracker). Both use rounded cards, ring progress and a dark theme.

## 2. Tech stack
- Vanilla JavaScript ES modules, **no build step, no framework**. Hash router (`#/route`).
- Firebase Web SDK 11.0.2 loaded from `gstatic.com` at runtime: **Auth** (admin sign-in) and **Firestore** (messages, placements). Storage code exists but isn't used (links only).
- PWA: `manifest.json` and `sw.js`. The service worker precaches the app shell. **Bump `CACHE_NAME` in `sw.js` whenever files are added or the APP_SHELL list changes** (currently `unicue-static-v13`). Every new file must also be added to `APP_SHELL`; a platform test fails if a listed file is missing.
- Deploy: GitHub Pages via `.github/workflows/pages.yml` (see `DEPLOY.md`).
- Tests: `node --test` with `jsdom` (`npm install && npm test`). Firebase is faked in `tests/fakes/`.

## 3. Folder map (`UniCue/`)
```
index.html            theme-color meta, early theme script, loads css/*.css (theme.css LAST)
manifest.json, sw.js
firestore.rules       read rules for students, write only for admin UID
data/holidays.json    shared university holiday list (see 6)
data/university-guide.json   placeholder, Guide page is hidden
assets/icons/         favicon.svg, favicon-32.png, apple-touch-icon.png, icon-192/512, maskable
assets/logo/          logo-dark.svg, logo-light.svg
css/                  base, layout, components, pages (older, minified one-liners) + theme.css (the design system, wins)
js/app.js             render loop, route switch, bell badge, bindings
js/router.js          route table
js/theme.js           System/Light/Dark, sets data-theme + theme-color meta
js/components/        header, bottom-nav, icons (inline SVG), card, badge, modal, etc.
js/domain/            attendance.js (validation), planner.js (all attendance maths), deadlines.js,
                      information.js, placements.js, holidays.js, backup.js
js/pages/             home, attendance, course-form, course-detail, leave-planner, deadlines,
                      deadline-form, information (Messages), information-detail, placement,
                      placement-detail, more (Profile), settings, admin*, 
js/repositories/      attendance, deadline (localStorage); information, placement (Firestore)
js/utils/             dates (incl. relativeDue), formatting (incl. formatPackage), read-state, escape...
tests/                *.test.js plus fakes/
```

## 4. Routes
`#/` Home · `#/attendance` · `#/attendance/course/new` · `#/attendance/course/:id` (+`/edit`) · `#/attendance/planner` (leave planner) · `#/deadlines` (+`/new`, `/:id/edit`) · `#/information` (**Messages**, opened by the bell) · `#/information/:id` · `#/placement` (+`/:id`) · `#/profile` (also `#/more`) · `#/settings` · `#/about` · `#/admin`, `#/admin/dashboard`, `#/admin/information[/new|/:id/edit]`, `#/admin/placements[/new|/:id/edit]`.

Navigation: bottom nav has **Home, Attendance, Deadlines, Placement, Profile**. The header has the logo and a **bell** (opens Messages, shows an unread count). Internally Messages are still called "information" (routes, Firestore collection, function names). Only visible text says "Messages".

## 5. Data
**Local (per phone), localStorage keys:** `unicue_attendance`, `unicue_deadlines`, `unicue_preferences`, `unicue_data_version`, `unicue_theme` (system|light|dark), `unicue_semester_target`, `unicue_read_messages` (ids of read messages).

**Course object:** `{id, name, code, conducted, attended (=Present), dl, target, countedThrough (YYYY-MM-DD), lastDate (YYYY-MM-DD), schedule:{weekday:classes}, bonus:boolean, holidays:[YYYY-MM-DD]}`. `schedule` keys are 0=Sun..6=Sat, e.g. SQL = `{2:1, 4:2, 5:2}`. Older saved courses used `weekdays[]` plus `perDay`; `normalizeSchedule()` still reads those.

**Deadline object:** `{id, title, courseName, type, dueDate, dueTime, notes, completed}`. Types: Assignment, Quiz, Lab, PBIQ, Project, Presentation, Exam, Other.

**Firestore collections:** `information` (statuses draft / published / expired) and `placements` (draft / published / closed). Students can read only published, plus expired or closed. Only the admin UID can write. Message fields include title, category, importance (Critical / Important / Normal), content, verified, status, importantDates, attachments, contacts. Placement fields include company, role, driveType, driveCode, salary, workLocations, applicationDeadline, eligibility*, jobDescription, selectionProcess, TPC contact, applicationUrl and more (see `domain/placements.js`).

## 6. Attendance logic (v13, verified against the owner's spreadsheet)
All maths lives in `js/domain/planner.js`. **`courseReport(course)` is the single source of truth**; every screen (cards, detail, Home, leave planner) reads it. `semesterReport()` sums courses. `outlook(report)` makes the pill copy. Tests: `tests/planner.test.js` (includes the owner's INT315 example).
- **No Present/Absent tap buttons any more.** Students copy totals from UMS via **Update numbers** (bottom sheet with steppers: Conducted, Present, DL; Absent is derived = conducted - present - DL) or the full course form. Present + DL may not exceed Conducted.
- **`countedThrough`** (course field, YYYY-MM-DD): last date whose classes are already inside the numbers. Default "yesterday", so today's classes are still *remaining* (matches "10 weeks including today"). Pick "Today" in the sheet if today's classes are already in the numbers. Old courses without it assume `updatedAt` minus 1 day. Cards show "Counted up to 4 Oct", or a warning when 2+ days old.
- **Remaining** = classes on scheduled weekdays from the day after `countedThrough` through `lastDate`, minus holidays (global `data/holidays.json` plus per-course extras). A holiday removes that day's classes for that course.
- **Total** = conducted + remaining. **Needed** = ceil(target% x total). **Allowed absences** = total - needed. **Can still miss** = allowed - absent (when there is no bonus; with bonus it grows by the bonus classes). **Must attend** = max(0, needed - credited).
- Credited = present + DL + bonus. **Bonus** = one week of that course's classes counted as DL; it does not change the total.
- Worked example (INT315, 5 Oct 2026): 35 done, 19 present, 13 DL, 3 absent, 10 weeks left, 4 classes/week, 2 holiday Mondays (2 classes each): remaining 36, total 71, 85% needs 61, allowed absences 10, can still miss 7, must attend 29 of 36.
- If the target is unreachable the app says so and shows the best possible percentage.
- Course form remembers the last "semester end" date (`unicue_semester_end`) to prefill new courses.
- **Leave planner** (`#/attendance/planner`, v13.1): quick picks (Today / 3 days / 7 days) or two dates. `leaveImpact()` / `semesterLeave()` in `planner.js` give classes missed, end-of-semester % after the leave, and `margin` = (remaining - mustAttend) - skip (negative means over the limit). Top card shows Now / No leave / After leave; at-risk courses are listed first. Holidays, dates already counted (before `countedThrough`+1) and dates after the last day cost nothing.
- **Update sheet gotcha:** the global rule `input:not([type=checkbox])...{width:100%}` has high specificity; any custom-width input needs `.sheet .stepper input[type=number]`-level specificity. The sheet closes on `hashchange` and locks body scroll.
- DL approved vs pending is not modelled (the owner's sheet has a DL Approved column); possible future field.

## 7. Other features
- **Messages:** critical first, search and category filter, unread dot plus bell count (read state is per device), Critical banner on Home.
- **Placements:** initials avatar, `formatPackage()` (450000 becomes "₹4.5 LPA"), register-by countdown, detail page, "Add register-by to my deadlines" button, official apply link.
- **Deadlines:** countdown chips (Due tomorrow, Overdue by N days), notes shown, one-tap complete.
- **Settings:** export or import a JSON backup (attendance, deadlines, semester target, theme), upcoming holidays list.
- **Admin:** Firebase email/password login (only the configured admin UID is accepted). CRUD with publish, unpublish, expire, close, delete.
- **Security rule of thumb:** never put credentials or passwords in a published Message, because students aren't logged in and anything published is readable by anyone with the link.

## 8. Design system (`css/theme.css`)
- Tokens on `:root[data-theme="light"|"dark"]`: `--bg --surface --surface-2 --field --text --muted --border --primary --accent --danger --success --warning --info` plus `*-bg` tints, `--shadow`, `--hero` gradient. **Always use tokens, never hard-coded colours.**
- Indigo primary (`#5046e5` light, `#7c74ff` dark) and amber accent (`#f5a623`, the "cue"). Dark base `#0f1020`.
- 22px card radius, 14px control radius, 48px minimum control height, floating rounded bottom nav with a tinted active pill. Icons are inline SVG in `components/icons.js`.
- One shared input style covers every field. Older CSS files hard-code some light colours, so theme.css overrides them (load order matters).
- Class names that markup relies on: `page-header`, `page-header-row`, `card`, `card-row`, `card-actions`, `chip`, `badge-*`, `ring`, `course-card`, `semester-card`, `avatar`, `form-actions`, `hidden`.

## 9. Logo
A woven **U and C** (the C passes over and under the U's stems, alternating). Amber C, white U on a dark `#14152B` tile, indigo U on a light tile. The generator script (not in the ZIP) used `sharp`; the SVGs in `assets/logo` and the PNGs in `assets/icons` are the source of truth.

## 10. Working notes
- Network and jsdom are unavailable in Claude's sandbox, so `tests/e2e-admin-student.test.js` could not be run there; the owner runs `npm install && npm test`. Last run in the sandbox: 42 of 42 runnable tests passed (planner, backup/holidays, platform, deadlines, attendance, placements).
- **Visual check method that worked:** serve the app with a tiny Node static server, point the four `gstatic.com/firebasejs/11.0.2/` imports at the files in `tests/fakes/` (seeded with sample messages and placements), seed localStorage with sample courses and deadlines, and screenshot with Playwright's Chromium (`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`) at 412x915.
- The UI has only been verified in desktop Chromium plus the owner's OnePlus 13R screenshots from the earlier build. Re-check on the phone after each change using `QA_CHECKLIST.md` ("Redesign checks").
- Style: the owner wants Claude to make design decisions itself ("no one is a better designer than you"), but to present a plan first for big changes. README, DEPLOY and FIREBASE docs in the ZIP predate the redesign and may be partly stale.

## 11. Known gaps and ideas (not built)
1. Filter chips for Messages and Placement in place of the dropdowns.
2. Holiday upload through the admin screen (Firestore collection, rules and an admin form).
3. UMS-style placement fields beyond the current model (streams, venue, TPC columns); the per-student Registered, Eligible and Hall ticket columns can't be read and are out of scope.
4. University Guide: hidden until real, verified content exists. Never invent LPU facts.
5. Push notifications (currently in-app bell only), a "You're offline" indicator, persistent offline cache of messages and placements, Storage uploads for attachments.
6. Message previews show raw pasted text (for example "AnnouncementReporting..."), so tidy the content when publishing, or strip repeated headings in code.
7. Date inputs follow the phone's locale.


## 15. STATUS UPDATE: Phase 1 DONE (v14)
- **1A done.** `js/repositories/content-sync.js` is the read-saving layer: one `meta/content.version` read per open (memoised 60s), lists refetched only when the version changes, cached in localStorage (`unicue_cache_information`, `unicue_cache_placements`), shared in-flight requests, stale-on-error, offline support, 10-minute TTL fallback when the meta doc/rules are missing. `getById` reads the synced list first (0 reads); admin editors pass `{ fresh: true }`. Admin create/update/remove call `bumpContentVersion`. `firestore.rules` has a `meta` block (**owner must re-publish the rules**). Tests: `tests/content-sync.test.js` plus a QUOTA test in the e2e file (fakes now count reads and support `meta` + `setDoc`).
- **1B done.** Six CSS files merged into ONE `css/app.css` with the cascade preserved (verified pixel-identical against screenshots), dead selectors removed, tokens at the top, shell styles in section 4. Old css files deleted; `index.html` and `sw.js` updated.
- **1C done.** Persistent shell in `js/app.js` (header, nav, offline bar mounted once; only `#page-root` changes, rendered in a detached view and swapped only if still the latest navigation). Bottom nav is Home, Messages, Attendance, Deadlines, Placement with the unread count on Messages. Profile is the header person icon. Admin card removed from Profile; reach it by tapping the version line on About 5 times (or by URL). Skeleton loaders (`components/skeleton.js`, shown after 140ms), offline bar, page-enter motion, `navigator.storage.persist()`.
- Housekeeping: removed dead modules (`js/pages.js`, `firebase/storage.js`, unused components). `CACHE_NAME` is `unicue-static-v14`. 76 of 76 tests pass.
- Fixed: Profile theme selector wrapping to two rows; focus ring on the page container.
- **Next: Phase 2** (Messages inbox with grouping of repeated company messages and cleaned raw text, Home "today" dashboard, Deadlines redesign with grouping, checkbox and .ics export).
- Visual harness (recreated): `shot.py` in the old sandbox used Playwright with the fakes seeded via a custom `state.js`; see section 11.

## 16. STATUS UPDATE: Phase 2 DONE (v15)
- **Messages inbox:** `domain/inbox.js` (`cleanMessageText`, `previewText`, `topicOf`, `groupRepeats`). Critical pinned under "Needs attention"; placement-style repeats (e.g. several "Google drive ..." messages) collapse into one lead card with an expandable "N earlier updates". Grouping is a heuristic on the title (only Placement-category or drive/recruit/hiring/shortlist titles, never Critical). Chips: All, Unread, categories. "Mark all read" (`markAllRead` in `utils/read-state.js`, fires `unicue:read` so the nav badge updates). Normal messages show no importance badge (less noise). Detail page uses `cleanMessageText`.
- **Home:** `domain/today.js` (`todaysClasses`, `attentionItems`). Greeting card with today's classes (holiday/last-date aware) and ranked attention rows (overdue, below-target courses, due today/tomorrow, drive closing soon). The old per-course Attendance list and tile strip were removed from Home; the semester card remains.
- **Deadlines:** grouped Overdue/Today/Tomorrow/This week/Later (`getDeadlineGroup`), one grouped card per section with circular complete checkbox, Undo toast (`components/toast.js`), collapsed Completed, `.ics` export per item and for all open items (`domain/ics.js`, `utils/download.js`; floating local times, all-day when no time, 1-day-before alarm).
- `CACHE_NAME` is `unicue-static-v15`. 86 of 86 tests pass (new: `tests/inbox-ics-today.test.js`; the e2e Home assertion now checks "below target").
- **Not done / next: Phase 3 (admin tools):** multiple admins via `admins/{uid}`, semester config doc replacing `holidays.json`, smart paste cleaner and similar-message warning in the admin editor, link message to placement. A dedicated `company` field on messages would make grouping exact instead of heuristic.

## 17. STATUS UPDATE: Plan agreed + Phase 3A done (v16)
**Owner decisions (final):** only ONE admin (the owner), so no `admins/{uid}`. OUT of scope: DL pending/approved, per-subject limits and bonus slabs, admin-published deadlines by course code, admin-published datesheet (students add their own exams as deadlines of type Exam, with a countdown), Firebase Analytics. Owner phone: OnePlus 13R (~412 CSS px wide); also check 360 px.
**Agreed pilot scope (50-100 students), in order:** (1) publishing tool: smart paste, summary + date fields, company field, duplicate warning; (2) Messages + Placement redesign on structured data (placement: sticky register-by bar, selection-process step timeline, private "Am I eligible?" check, save drive, company page); (3) Attendance "Plan a trip" mode + Home "Can I skip today?"; (4) Deadlines quick-add, exam countdown, share-by-link (URL-encoded, no DB); (5) pilot kit: feedback Google Form link, install prompt. Later: weekly timetable, SGPA/CGPA calculator (needs verified LPU grade scale), push.
**Unverified (never hard-code):** LPU per-subject rule, bonus slabs, condonation, DL rules. Notice: LPU suspended classes for 10 days from 28 Sep 2026 (owner should confirm effect on holidays/attendance from the official notice).
**v16 built (step 1, part A):** `domain/smart-paste.js` (`smartPaste`, `findSimilar`, `findDates`; suggestions only, with explanatory notes); messages gain `summary` (<=200) and `company` (<=80) fields; explicit `company` makes `topicOf` grouping exact; `nextDateOf()` drives a "by when" chip on message cards; detail page shows a "What you need to do" callout and an "Add" button per important date (creates a deadline); admin editor has a Smart paste box and a live similar-message warning. `CACHE_NAME` is `unicue-static-v16`. New tests `tests/smart-paste.test.js` (83 of 84 pass in sandbox; the jsdom e2e file cannot run there). UI not yet visually verified on the phone.
**Next:** step 1 part B (admin message list polish, placement editor structure e.g. `selectionProcess` as steps) then step 2.

## 18. Phase 3B done (v16, step 2: Placement)
New `domain/placement-insights.js` (`parseSteps`, `parseEligibilityRules`, `checkEligibility`, `closingWithin`, `closesIn`) and `utils/placement-prefs.js` (on-device CGPA/backlogs profile + saved drives, stored inside `preferences`). Placement detail now has: "closes in X" banner, private "Am I eligible?" card (CGPA + backlogs only, parsed from the eligibility TEXT, so it is a hint, never final), selection process as a numbered step timeline, bookmark (save) button in the sticky bar. Placement list has a "Closing in 48 hours" strip and a "Saved" filter chip. `app.js`: `bindPlacementPrivate`. 87 of 88 tests pass in the sandbox; the jsdom e2e file cannot run there, so run `npm install && npm test`. Nothing here has been checked on a real phone yet.
**Next:** step 3 Attendance "Plan a trip" + Home "Can I skip today?", then step 4 Deadlines (quick add, exam countdown, share-by-link), then step 5 pilot kit. Messages: still to do a "company page" (all updates for one company) and an emergency banner.

## 19. Step 3 done (v16): Attendance trip mode + Home "Can I skip?"
New `domain/trip.js` (thin layer over `planner.js`, no new attendance maths): `skipCheck(courses, day)`, `longestSafeTrip(courses, target, from)`, `courseVerdict`, `tripShareText`. Leave planner is now "Plan a trip": headline verdict (Safe / Safe but no room / Not safe), "How long can you stay?" card (latest safe return date from the chosen start), "After you're back: attend X of Y left" per course, Share result (text via share sheet, falls back to WhatsApp link; no image). Home has a "Can I skip today?" card (tomorrow if no classes today) with a per-course verdict; a day already counted in the student's numbers shows "Already counted", never "safe". Attendance semester card button now reads "Plan a trip or leave". Rules are NOT per-subject beyond each course's own target (owner decision: per-subject rules/bonus slabs are out). Tests: `tests/trip.test.js`; 93 of 94 pass in sandbox (jsdom e2e cannot run there). Not yet checked on a phone.
**Next:** step 4 Deadlines: quick-add, exam countdown (student-added Exam type), share-by-link (URL-encoded). Then step 5 pilot kit (feedback form link, install prompt).

## 20. Step 4 done (v16): Deadlines
New `domain/deadline-tools.js`: `quickDates`, `upcomingExams`, `examCountdown`, `encodeShare`/`decodeShare` (untrusted-link safe: size cap, charset check, version check, date + type re-validation, length limits), `shareUrl`, `shareMessage`, `isDuplicateDeadline`. Deadline form rebuilt: type chips (radio), date shortcut chips (Today, Tomorrow, named days), course chips from the attendance list, Exam hint, and in edit mode Share + Delete (Delete has Undo toast). Deadlines list: Exams strip (student-added type Exam, countdown), share icon per row. Home: "Next exam" card (within 30 days). Share by link = route `#/shared/:payload` (`pages/deadline-shared.js`): shows the deadline, "Add to my deadlines" (disabled if the same title+date exists). `utils/share.js` = share sheet, WhatsApp fallback. New icon `share`. No database, no Firebase usage. Tests: `tests/deadline-tools.test.js`; 99 of 100 pass in sandbox (jsdom e2e cannot run there). Not yet checked on a phone.
**Next:** step 5 pilot kit: feedback Google Form link (owner supplies URL), install prompt (Android `beforeinstallprompt`, iOS "Add to Home Screen" hint), and remaining polish: Messages company page + emergency banner.

## 21. Step 5 done (v17): pilot kit + leftovers
- `js/app-config.js`: `FEEDBACK_URL` (empty = "Send feedback" card hidden on Profile; owner pastes a https Google Form link to show it).
- Install: `utils/install.js` `installMode()` ("prompt" Android/Chrome one-tap, "ios" Share > Add to Home Screen, "ios-safari" for in-app browsers), shown on Home from the 2nd visit, hidden 14 days after dismissal, never when installed. Profile has an Install card (always available). `beforeinstallprompt` captured in `app.js`. (Storage persistence request already existed in app.js.)
- Emergency banner: messages gain `banner: true` (admin checkbox in the message editor). `pickBanner()` shows the newest active, unexpired, undismissed one at the top of every student screen; dismissal is per phone (`utils/banner-state.js`).
- Company page `#/company/:name` (`pages/company.js`): that company's drives + every update, newest first. Linked from group cards ("See everything about X"), message detail chip, and placement detail. Uses `topicOf` so explicit `company` and title guesses both work.
- `CACHE_NAME` is now `unicue-static-v17`. Tests: `tests/pilot-kit.test.js`; 104 of 105 pass in sandbox (jsdom e2e cannot run there). Not yet checked on a phone.
**Pilot checklist for owner:** (1) `npm install && npm test` (all green); (2) re-publish `firestore.rules` if not yet done; (3) paste the Google Form URL into `js/app-config.js`; (4) check each screen on the OnePlus 13R and at 360 px; (5) send to ~10 friends first, then widen to 50-100.
**Not built (owner decisions or later):** DL pending/approved, per-subject limits/bonus slabs, admin-published deadlines or datesheet, Firebase Analytics, push notifications, SGPA/CGPA calculator, weekly timetable.

## 22. Stage 6a done (v18): Timetable import (decided and built from the owner's real UMS export)
**Source format (verified from the owner's `Schedule.xlsx`):** UMS timetable export, one sheet, title row, "VID ::<student id>" row (NEVER stored; test fixtures are anonymised), a Monday..Sunday header row, then cells like `12:50 - 13:40:\n33-509 - L - INT315K2P23PD` = time, room, L/P/T, course code + section. Export menu offers Word, Excel, PowerPoint, PDF, Accessible PDF, TIFF, MHTML, CSV: we read Excel (tested on the real file) and CSV/pasted text (same grid logic, CSV layout from UMS NOT yet verified: if a CSV export fails, ask the owner for a sample).
**Files:** `utils/xlsx-lite.js` (zip + XML reader, no library, size-capped; real file uses `t="str"` cells with `<v xml:space="preserve">`), `utils/csv.js`, `domain/timetable.js` (`parseTimetableGrid`, `buildPlan`, `applyPlan`, `importDefaults`, `todaySlots`, `weeklyTimetable`, `slotsMatchSchedule`, `codeOf`), `pages/timetable.js` (import page `#/attendance/import`, weekly view `#/attendance/timetable`). Tests: `tests/timetable.test.js` + `tests/fixtures/*.xlsx`. 113 of 114 pass in sandbox (jsdom e2e cannot run there).
**Behaviour:** each timetable slot = one class (editable). New courses are created with name = course code, 0/0 classes, target/last date copied from existing courses. Existing courses (matched by course code in `code` or `name`) get only `schedule`, `slots`, `section`; their numbers are untouched. Courses now optionally carry `slots: [{day,start,end,room,type}]` and `section`. Editing the class days by hand in the course form clears `slots` if they no longer match. Sunday classes are skipped (planner supports Mon-Sat). Home "today" card shows a timed timeline (Now / Next) when slots exist. Attendance page has Import timetable + Timetable chips. `CACHE_NAME` is `unicue-static-v18`.
**Owner-side change adopted:** `js/domain/placements.js` now includes `MAX_SELECTION_STEPS`, `parseSelectionSteps`, `formatSelectionSteps`, `findSimilarPlacements` (added outside this chat; additive, tests unaffected). Note `domain/placement-insights.js` has its own `parseSteps` (strips "Round 1:" prefixes); the two could be unified later.
**Next in Stage 6:** first-run welcome (guided: import timetable -> add numbers), share-my-course-setup link, Home nudge for stale attendance, optional UMS attendance paste (needs a sample of the attendance table). Unverified on a phone.

## 23. Stage 6b done (v18): welcome checklist, share course setup, stale nudge
- `domain/setup.js` `setupProgress(courses)`: 3 steps derived from real data (courses added, every course has numbers, every course has a last date). Home shows it as a "Welcome" card when there are no courses, and as a "Finish setting up" card (with Hide, stored in `unicue_setup_hidden`) until complete. The old plain "Add course" card is gone; the attention list (overdue deadlines etc.) still shows for students with no courses.
- `domain/course-share.js` + `pages/setup-shared.js` (`#/setup/:payload`): share my course setup by link = codes, names, class days, times, rooms, section, last date. NEVER attended/conducted/DL/target. Incoming links are untrusted: version, charset, size (9000), course/slot caps, field regexes, everything escaped. Buttons: "Share my setup" chip on Attendance, "Share" on Timetable (handled by a global click handler in `app.js`, `[data-share-setup]`). Importing reuses `applyPlan` (existing courses matched by code/name keep their numbers; new ones get name + last date from the link).
- Stale nudge: `attentionItems` adds "Update your attendance numbers" when a course with numbers is 4+ days stale (rank 2.5, names the course when only one).
- `timetable.js` gained `matchCourse`, `describeSchedule`; `applyPlan` now uses `it.name`/`it.lastDate` when present. Version label in About is v18.
- Tests: `tests/setup-share.test.js`; 119 of 120 pass in sandbox (jsdom e2e cannot run there). Not yet checked on a phone.
**Open items for owner:** phone-test timetable import + share link with a friend; send a UMS CSV sample (to verify CSV) and optionally an attendance-table sample (to build paste-import); official notice on the 10-day suspension (holiday effect); Google Form URL; run `npm install && npm test`.
**Next:** Stage 7 (admin: holidays/semester settings editable from admin, smart paste for placements, preview as student, duplicate-as-template, "Official · from UMS" label, admin list polish).

## 24. Stage 7 done (v19): admin tools
Owner decision: the 10-day class suspension is IGNORED (classes resumed online, same number of classes), so no holiday entries for it.
- **Semester & holidays (admin, `#/admin/semester`, `pages/admin-semester.js`)**: last class day + holiday list (one per line: `2026-11-07 Diwali`, `07/11/2026 Diwali`, or ranges `2026-11-07 to 2026-11-10 Diwali`). Stored as `meta/content.semester` (same doc students already read for the version, so ZERO extra reads; existing rule `meta` admin-write already allows it, NO rules change). `firestore.js`: `onContentMeta(fn)` hook inside `readContentVersion`, `saveSemesterDoc`. `domain/semester.js`: `sanitizeSemester` (untrusted), `applySemester`, `parseHolidayLines`, `formatHolidayLines`, `validateSemester`, `loadStoredSemester` (offline cache `unicue_semester_cfg`). Holidays: once the admin saves, the Firestore list REPLACES the `data/holidays.json` list for everyone (the file stays as the fallback; the admin page pre-fills the current list so the first save keeps it). `lastDate` is inherited by courses with no own last date AT READ TIME only (`attendance-repository.js` `withSemester`; never stored, so later admin changes reach everyone). App re-renders once when settings change (`app.js`).
- **Smart paste for placements** (`domain/placement-paste.js`, `smartPastePlacement`): labelled lines (Company, Role, CTC, Location, Eligible Batch/Programs, Eligibility, Selection Process, Last date, Drive date, Documents, Apply, Contact...) -> form fields incl. datetime-local deadline (11:59 PM assumed when no time, with a note), plus same-company warning via the owner's `findSimilarPlacements`.
- **Preview as student** in both editors (Preview button, `inert` frame, nothing saved): `informationDetailHtml(item)`, `placementDetailHtml(item)`, exported `infoCard`. The detail pages were split into fetch + pure render.
- **Duplicate as template**: routes `/admin/information/:id/duplicate`, `/admin/placements/:id/duplicate` (copy icon in the manager). A copy is a draft; banner/expiry (messages) and deadline/drive date (placements) are cleared.
- **Official label**: verified messages show "✓ Official · <source name>" on the card and detail. Message auto-fill defaults Source name to "UMS" when empty.
- Tests: `tests/semester.test.js`, `tests/placement-paste.test.js`; 132 of 133 pass in sandbox (jsdom e2e cannot run there). Render functions smoke-tested in Node. Not checked on a phone. `CACHE_NAME` is `unicue-static-v19`; About shows v19.
**Not done from the Stage 7 list:** deeper admin list polish (search box etc.), only Duplicate was added.
**Next:** Stage 8 (trust and reliability): update-ready notice, monthly backup reminder, privacy note, offline/error review, theme-color, e2e in CI.

## 25. Stage 8 done (v20): trust and reliability
- **Already fine, no change needed (corrects my earlier plan):** CI (`.github/workflows/pages.yml`) already runs `npm test` (incl. the jsdom e2e) and blocks deploy on failure; `theme.js` already rewrites the `theme-color` meta for dark/light.
- **Offline / slow campus Wi-Fi (`repositories/content-sync.js`):** with a saved copy on the phone, the version check now gives up after 4 s (`SOFT_TIMEOUT_MS`, configurable via `softTimeoutMs`) and serves the saved list instead of waiting up to 12 s; if `navigator.onLine === false` it serves the saved copy instantly. With NO saved copy it still waits for the real answer. Offline + nothing saved throws (no blank list).
- **Error screens:** `errorState` shows a "Try again" button for temporary failures (title matches unavailable / unable to load / something went wrong); handled by a global `[data-retry]` click handler that re-renders.
- **Update notice:** `controllerchange` (only when a controller already existed) shows "UniCue was updated, Refresh" in `#update-banner`; the app also calls `registration.update()` when the student returns to it (max every 30 min).
- **Backups:** now include `preferences` (CGPA/backlogs profile + saved drives); restore applies them; old backups without them still load (`sanitizePreferences`). Course `slots` are sanitised on restore AND at read time in `attendance-repository.js` (`sanitizeSlots` in `domain/timetable.js`), so a corrupt/tampered backup can't break Home. Settings shows "Last backup: <date>".
- **Backup reminder:** `domain/backup-reminder.js` `backupDue`: only with data; first reminder 14 days after first use, then every 30 days after the last backup; "Later" snoozes 7 days. Card on Home (`[data-snooze-backup]`). State in `utils/backup-state.js` (`unicue_first_seen`, `unicue_last_backup`, `unicue_backup_snooze`).
- **Privacy page** `#/privacy` (`pages/privacy.js`), linked from Profile and About: no UMS login, what stays on the phone, files read locally, what is public, what share links contain, hosting logs (GitHub Pages + Firebase see IPs), "not an official LPU app". Keep it truthful when storage/sending changes.
- Tests: `tests/reliability.test.js` (+ `backup-holidays.test.js` expectation updated for `preferences`); 141 of 142 pass in sandbox (jsdom e2e cannot run there; run `npm test` locally). `CACHE_NAME` `unicue-static-v20`; About shows v20. Not checked on a phone.
**Next:** Stage 9 (student features shaped by pilot feedback): Deadlines "This week" strip, share a message to WhatsApp, branch in the eligibility check, then CGPA calculator (needs verified grade scale) and FAQ (needs trusted sources). Then final design pass.

## 26. Student sign-in done (v21): login / sign up / forgot (DEMO, local only)
Owner decision: students now see a login screen. It is for show only: **no Firebase, no sync, no real security**.
- `js/auth/student-auth.js`: accounts in `localStorage.unicue_students` (name, email, salted SHA-256 of the password, never plain text); session in `unicue_session` (localStorage when "Remember me" is ticked, else sessionStorage). Exports `signUp`, `logIn`, `resetPassword`, `logOut`, `getSession`, `isLoggedIn`, `passwordStrength`, `rememberNext/takeNext` (return to a shared link after login). Accounts exist only on the phone where they were created.
- `js/pages/auth.js`: routes `#/login`, `#/signup`, `#/forgot` render OUTSIDE the app shell (`mountAuth`). The hero stays mounted when switching screens so the logo animation plays once. Features: animated woven-logo draw-in, desktop split layout with product preview cards, phone banner + overlapping card, theme toggle, show/hide password, password strength meter, live confirm check, per-field errors, shake on error, busy spinner, welcome check screen, "Log in as admin" link to `#/admin`.
- `app.js`: gate in `render()`: signed-out visitors are sent to `#/login` (admin routes are never gated); background re-renders are skipped while the auth screen is open so typing is never wiped. Profile has an account card with **Log out** (`[data-logout]`); Home greets by first name.
- Design: `css/app.css` section 9, brand tokens `--brand-*` and `--font-display` (Bricolage Grotesque from Google Fonts, falls back to Inter/system offline; also used on `.page-title` and `.brand`). Privacy page updated (demo account + Google Fonts).
- `CACHE_NAME` is `unicue-static-v21`; About shows v21. Tests: `tests/student-auth.test.js` (7). All runnable tests pass; the jsdom e2e file is unaffected (it imports pages directly) but could not be run in the sandbox.
- Ideas: self-host the font in `assets/fonts` to drop the Google Fonts request; a "Continue as guest" button if the gate feels heavy for the pilot.
