# Deploying UniCue to GitHub Pages

1. Push this project to a GitHub repository (branch `main`). `node_modules/` is git-ignored.
2. GitHub repo -> **Settings -> Pages -> Source: GitHub Actions**.
3. Push to `main`. The workflow in `.github/workflows/pages.yml` runs `npm test`, and only if all tests pass it publishes `index.html`, `manifest.json`, `sw.js`, `css/`, `js/`, `data/` and `assets/`.
4. Open `https://<user>.github.io/<repo>/` and run the browser/device checks in `QA_CHECKLIST.md`.

## If admin login fails on the live site
- Firebase Console -> Authentication -> Settings -> **Authorized domains**: add `<user>.github.io`.
- Google Cloud Console -> APIs & Services -> Credentials -> the web API key: if it has HTTP-referrer restrictions, add `https://<user>.github.io/*`.

## Updating later
Normal pushes are picked up on the next page load (network-first service worker). If you add/remove files in `js/`, `css/` or `assets/`, update `APP_SHELL` in `sw.js` and bump `CACHE_NAME`; the tests will fail if the list points at a missing file.
