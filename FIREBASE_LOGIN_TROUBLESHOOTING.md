# Firebase Admin Login Troubleshooting

If UniCue still shows `Firebase and the admin UID must be configured before admin access is enabled` after the current build is deployed:

1. Hard refresh the site (`Ctrl+Shift+R`).
2. If it persists, unregister the UniCue service worker in Chrome DevTools → Application → Service Workers and reload.
3. Confirm Firebase Authentication has Email/Password enabled.
4. Confirm `admin@unicue.com` exists in Authentication → Users and its UID exactly matches the configured admin UID.
5. Do not share the Firebase account password.
