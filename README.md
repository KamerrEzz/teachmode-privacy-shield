# TeachMode — Privacy Shield

Chrome/Edge extension that automatically censors sensitive data while screen sharing or teaching on developer dashboards.

Designed for educators and developers who need to share their screen without exposing API keys, account IDs, IP addresses, or tokens.

---

## Features

| Feature | Description |
|---|---|
| **Privacy Shield** | Automatically redacts IPs, tokens, account IDs, and emails via regex + MutationObserver |
| **Click-to-Hide** | Click any element to hide it on the fly |
| **Blur mode** | Blur elements instead of hiding them (`filter: blur(12px)`) |
| **Always ON (pinned)** | Auto-activate on every visit to a domain |
| **Ctrl+Z undo** | Restore the last hidden element |
| **Custom patterns** | Add your own regex patterns directly from the popup |

## Platform coverage

Patterns are split into two tiers:

**Global** — active on every page (high-specificity prefixes only):

AWS · GitHub · npm · GCP · Stripe · DigitalOcean · Render · Sentry · Fly.io · MongoDB · Supabase · Railway · Heroku

**Domain-scoped** — activated only on the matching dashboard (patterns too generic for global use):

| Dashboard | What's censored |
|---|---|
| `console.aws.amazon.com` | 12-digit account IDs, `*.amazonaws.com` endpoints |
| `portal.azure.com` | UUIDs, connection strings, storage keys |
| `console.cloud.google.com` | 12-digit project numbers |
| `vercel.com` | `prj_` / `team_` / `ecfg_` IDs |
| `app.netlify.com` | Site UUIDs, build hook URLs |
| `cloud.digitalocean.com` | Resource UUIDs, Spaces access keys |
| `dashboard.heroku.com` | API key UUIDs |
| `app.supabase.com` | JWT anon/service keys, project UUIDs |
| `cloud.mongodb.com` | 24-char ObjectIDs, API key UUIDs |
| `app.datadoghq.com` | 32/40-char hex keys, `pub*` client tokens |
| `sentry.io` | 64-char legacy auth tokens |
| `github.com` | `.npmrc` auth token lines |

---

## Installation

> The extension is not on the Chrome Web Store. Load it manually as an unpacked extension.

1. Clone or download this repository
2. Open `edge://extensions` (or `chrome://extensions`)
3. Enable **Developer mode**
4. Click **Load unpacked** and select the project folder

No build step required — it's plain JavaScript.

---

## Usage

Click the **TeachMode** icon in the toolbar to open the popup.

### Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+H` | Toggle Privacy Shield on/off |
| `Ctrl+Shift+K` | Toggle Click-to-Hide mode |
| `Ctrl+Z` | Undo last hidden element (while Click-to-Hide is active) |

### Always ON (pinned)

Enable "Always ON here" in the popup to auto-activate TeachMode on every page load for that domain. The `pinned` flag persists in storage; `enabled` is resolved at request time to avoid write loops on reload.

### Custom patterns

Open the **Custom Patterns** section in the popup, enter a regex and an optional label, and click **+ Add**. Patterns are stored globally in `chrome.storage.local` and applied live via `storage.onChanged` — no reload needed.

---

## Architecture

```
manifest.json              MV3 manifest — permissions, commands, content scripts
background/
  service-worker.js        State management per domain { enabled, clickHide, blurMode, pinned }
content/
  censor.js                DOM censoring — TreeWalker + MutationObserver + click handler
popup/
  popup.html / popup.js    Extension UI — toggles, pattern editor
rules/
  domains.json             Pattern reference catalog (formats + specificity ratings)
test/
  verify.mjs               Playwright E2E suite (Edge)
  test-page.html           Mock page with synthetic sensitive data
```

Pattern priority order (first match wins the label):

```
domain-specific → GLOBAL_PATTERNS → BUILTIN_PATTERNS → user custom
```

---

## Development

**Run the E2E tests** (requires Microsoft Edge installed):

```bash
npm install
node test/verify.mjs
```

The test suite launches Edge with the extension loaded, drives all four feature scenarios, and reports pass/fail for each check. Screenshots are saved to `test/screenshots/`.

---

## License

MIT
