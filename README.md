# UniCue

**Know what matters.**

UniCue is a student-built information and academic utility platform for LPU students. It complements official LPU systems instead of replacing them.

## V1 core

1. Attendance & academic eligibility support
2. Important information discovery
3. Academic deadline tracking
4. Placement opportunity discovery

## Architecture

- HTML/CSS/vanilla JavaScript
- Hash routing for GitHub Pages
- LocalStorage for attendance and deadlines in V1
- Firebase Authentication for the admin account
- Firestore for published information and placement opportunities
- Firebase Storage only for permitted attachments
- PWA service worker for static/offline shell

The code is separated into presentation, domain logic, repositories, Firebase adapters, and utilities so the frontend does not become a single monolithic file.

## Data boundaries

Student-owned attendance and deadlines are local in V1. Admin-published information and placement opportunities are intended to be Firestore-backed. Students do not publish content.

UniCue does **not** collect UMS credentials, scrape private UMS data, bypass access controls, process placement applications, or replace RMS/UMS/LPU Touch.

## Firebase setup

1. Create a Firebase project.
2. Enable Authentication with the chosen admin sign-in method.
3. Create Firestore.
4. Add the web configuration values to `js/firebase/config.js`.
5. Change `enabled` to `true`.
6. Add Firestore security rules before publishing.
7. Create the admin account in Firebase Authentication.

Do not commit service-account keys or other privileged credentials to the repository.

## Development

This is a static web app. Open it through a local static server rather than `file://` when testing modules and the service worker.

Example:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/`.

## Current implementation state

The project contains the full V1 file architecture and working local Attendance + Deadlines foundations. Information, Placement, and Admin screens have their repository/Firebase boundaries and UI foundations; their production Firestore CRUD and security rules are the next integration work.

## Tests

```bash
npm install     # installs jsdom (test-only)
npm test        # 51 automated tests
```

- `tests/attendance|deadlines|information|placements.test.js` — domain logic.
- `tests/platform.test.js` — imports resolve, service-worker assets exist, manifest/icons, rules contain the real admin UID, no secrets in source.
- `tests/e2e-admin-student.test.js` — runs the real app modules in jsdom against an **in-memory Firebase fake that mirrors `firestore.rules`**: admin create/edit/publish/unpublish/expire/close/delete, student visibility, student write rejection.

The fake is a model of the rules, not the real Firebase. Always run the manual checks in `QA_CHECKLIST.md` against the live project after deploying the rules.

## Deploying updates

The service worker serves app files network-first, so a normal deploy is picked up on the next load. If you add or remove files, update the `APP_SHELL` list in `sw.js` and bump `CACHE_NAME`.
