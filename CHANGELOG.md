# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] - 2026-06-25

### Added

- **Phone number detection** — international format (`+1 555 123 4567`, `+34 612 345 678`, etc.)
  censored globally on all pages. Requires the `+` country prefix to avoid false positives on port
  numbers, timestamps, and numeric IDs. Local formats (without `+`) can be added per-session via
  Custom Patterns in the popup.

## [1.0.0] - 2026-06-25

### Added

- **Privacy Shield** — automatically censors IPv4/IPv6 addresses, API tokens, account IDs,
  nameservers, and email addresses on any page while screen sharing or teaching
- **Blur mode** — blur clicked elements with `filter: blur(12px)` instead of hiding them;
  toggle converts existing hidden elements in real time
- **Always ON (pinned)** — auto-activate TeachMode on every visit to a given domain
  without storing `enabled: true` in storage (avoids write loops on reload)
- **Click-to-Hide** — click any element to hide it instantly; **Ctrl+Z** undoes the
  last hidden element (stack-based, capture-phase listener)
- **Custom regex patterns** — add your own patterns (regex + label) directly from the popup;
  stored globally in `chrome.storage.local`, applied live via `storage.onChanged`
- **Global patterns for 13 cloud platforms** — AWS (access keys, ARNs, S3/ECR URIs),
  GitHub (all `gh*_` token prefixes, `github_pat_`), npm (`npm_*`), GCP (AIza keys,
  service accounts, OAuth clients, GCS URIs), Stripe (sk/pk/rk/whsec, all object ID prefixes),
  DigitalOcean (`dop_v1_`), Render (`rnd_*`), Sentry (new `sntrys_*` tokens + DSNs),
  Fly.io (`fo1_*`, `.fly.dev` domains), MongoDB (`mongodb+srv://` URIs), Supabase
  (`.supabase.co` URLs, postgres connection strings), Railway (`.up.railway.app`), Heroku
  (postgres on `compute-1.amazonaws.com`)
- **Domain-scoped patterns for 12 dashboards** — AWS Console (12-digit account IDs),
  Azure Portal (UUIDs, connection strings, storage keys), GCP Console (project numbers),
  Vercel (`prj_`/`team_`/`ecfg_` IDs), Netlify (site UUIDs, build hook URLs),
  DigitalOcean (resource UUIDs, Spaces keys), Heroku dashboard (API key UUIDs),
  Supabase dashboard (JWT anon/service keys), MongoDB Atlas (24-char ObjectIDs),
  Datadog (32/40-char hex keys, `pub*` client tokens), Sentry (64-char legacy auth tokens),
  GitHub (`.npmrc` auth token lines)
- **Keyboard shortcuts** — `Ctrl+Shift+H` toggles Privacy Shield; `Ctrl+Shift+K`
  toggles Click-to-Hide mode
- **Priority pattern order** — domain-specific → global specific → builtin broad →
  user custom; first match wins the label shown on hover

[Unreleased]: https://github.com/KamerrEzz/teachmode-privacy-shield/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/KamerrEzz/teachmode-privacy-shield/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/KamerrEzz/teachmode-privacy-shield/releases/tag/v1.0.0
