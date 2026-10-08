# UniCue Firebase Setup — V1

UniCue V1 uses Firebase only for administrator authentication and dynamic Information/Placement content. Attendance and deadlines remain local to the student's device.

## 1. Create the Firebase project

Create a Firebase project for UniCue and register a Web App.

Copy the Web App configuration values into:

`js/firebase/config.js`

Set:

- `enabled: true`
- `apiKey`
- `authDomain`
- `projectId`
- `storageBucket`
- `messagingSenderId`
- `appId`
- `adminUid`: the Firebase Authentication UID of the single UniCue administrator

The Firebase web config is client-side configuration. **Do not put a service-account private key or password in the file.**

## 2. Enable Authentication

In Firebase Authentication:

1. Enable Email/Password sign-in.
2. Create the one administrator user.
3. Copy that user's UID into `adminUid` in `js/firebase/config.js`.

Do not implement a public student account requirement for V1.

## 3. Create Firestore

Create the Firestore database.

UniCue uses these collections:

- `information`
- `placements`

Record `status` values:

- `information`: `draft` (admin only), `published` (students), `expired` (hidden from the list; direct link shows "expired").
- `placements`: `draft` (admin only), `published` (students), `closed` (students still see it, marked Closed).

The configured admin can read and write every record.

## 4. Deploy Firestore rules

`firestore.rules` already contains the admin UID (`xrZS4IcV9FNglMXn5ret53skmwD2`).

**These rules only protect you once they are deployed.** Either:

- Firebase Console → Firestore Database → Rules → paste the contents of `firestore.rules` → Publish, or
- `firebase deploy --only firestore:rules`

After publishing, run the manual checks in `QA_CHECKLIST.md` (student cannot write, draft is not readable).

## 4b. Content version doc (saves read quota) — NEW in v14

Students no longer re-download all messages and placements on every screen. The app reads ONE tiny document, `meta/content`, and only refetches the lists when its `version` number changed.

- `firestore.rules` now has a `meta` block: everyone can read, only the admin can write. **Re-publish the rules** after updating (section 4).
- You do not create `meta/content` by hand. It is created automatically the first time you save, publish, unpublish or delete a message/placement in the admin screens.
- Until the rules are re-published (or before your first save), the app falls back to a 10-minute local cache, so quota is protected either way.
- Result: roughly 1 read per app open instead of ~450 reads per student per day. Spark's free limit is about 50,000 reads/day.
- Messages and placements are also stored on the phone, so they still open offline.

## 5. Storage

Firebase Storage is reserved for permitted PDFs/images in the content workflow. V1 does not require Storage for basic Information or Placement records.

If Storage is enabled later, add rules that permit only the administrator to write content and allow public read only for explicitly published/permitted files.

## 6. Test before publishing

Test these flows in Chrome:

1. Admin login with the correct account.
2. Admin login with another account — must be rejected.
3. Create a draft Information item.
4. Confirm students cannot read the draft.
5. Publish it.
6. Confirm students can read it.
7. Edit and delete it as admin.
8. Repeat the same process for Placement.
9. Sign out and confirm admin routes require authentication again.

## Security boundary

UniCue does not collect UMS passwords, proxy authenticated UMS sessions, scrape private UMS data, or process placement applications. Official LPU systems remain the source/action destination where applicable.

## UniCue admin UID

Configured admin Firebase UID: `xrZS4IcV9FNglMXn5ret53skmwD2`.

Do not store the Firebase account password in project files.
