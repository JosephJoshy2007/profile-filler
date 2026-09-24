# Profile Filler

Auto-fill Google Forms with your personal data using a Chrome extension.

## Structure

- `extension/` — Chrome Manifest V3 extension (content script + popup + background)
- `webapp/` — Vite + React dashboard to edit your profile and matching table
- `shared/` — Shared schema and default profile

## Development

```bash
# Webapp
cd webapp
npm install
npm run dev

# Extension — load unpacked from `extension/` folder in Chrome
# Go to chrome://extensions → Developer mode → Load unpacked → select `extension/`
```

## Deployment

- Webapp: Netlify (auto-deploys from `main` via GitHub Actions)
- Extension: packaged as a zip artifact in GitHub Actions; load unpacked locally

## Setup

1. Clone the repo
2. Install and run the webapp
3. Load the extension unpacked
4. Click the extension icon → Edit profile → fill your data
5. Open a Google Form — it auto-fills

## Sync

The webapp stores your profile in `localStorage`. To sync with the extension:
- Export JSON from webapp, import into extension storage manually (or implement a bridge).
- Future: add Supabase backend for cross-device sync.
