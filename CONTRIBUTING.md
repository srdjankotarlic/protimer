# Contributing to ProTimer

Thanks for your interest — bug reports, feature ideas, translations and docs are all welcome.

## Reporting bugs / requesting features

Open an [issue](https://github.com/srdjankotarlic/protimer/issues/new/choose). There are templates for **bug reports** and **feature requests** — filling them in (OS, version, steps) helps a lot.

For **security issues**, please don't open a public issue — see [SECURITY.md](SECURITY.md).

## Working on the code

You need [Node.js](https://nodejs.org) 24 LTS or newer.

```bash
git clone https://github.com/srdjankotarlic/protimer.git
cd protimer
npm install
npm start            # run the app
npm test             # timer/layout rules and script syntax checks
npm run check:public-docs # verify the landing page, release links and version references
npm run smoke        # automated UI, host-clock sync, SSE/long-poll, remote and output tests
npm run dist:mac     # build the macOS .dmg
npm run dist:win     # build the Windows installer + portable
```

The whole app is small on purpose:

- `main.js` — Electron main process: windows, the local HTTP server (LAN SSE + HTTPS long-poll), the `/cmd` token and Cloudflare/localtunnel sharing.
- `controller.html` — the operator control window (single source of truth for state).
- `output.html` — the on-screen timer (also served to OBS / browsers).
- `backstage.html` — the crew schedule view.
- `remote.html` — the phone remote.
- `timer-tools.js` — shared duration, layout and independent countdown rules.

`npm run smoke` uses an isolated temporary profile, never your saved rundown. It also tests exact output sizes, dual layouts and authenticated phone reconnection. With a prepared Cloudflare binary, set `PROTIMER_TEST_ONLINE=1` to additionally exercise real HTTPS phone commands through a temporary tunnel; the test closes that tunnel when finished.

Release builds fetch the pinned official Cloudflare binary with `scripts/fetch-cloudflared.js`; `scripts/verify-packaged-tunnel.js` then verifies the packaged checksum, version and platform signature before an installer can be published.

Distribution manifests and their checksums describe the last published binaries, independently of an upcoming app version. After publishing a release, update Scoop, Chocolatey and `docs/checksums` together from the actual release asset hashes, then rerun the packaging/lifecycle checks. Never invent checksums for a build that does not exist yet. The Release workflow can be dispatched with `test_online=true` to validate packaged HTTPS control without publishing.

## Pull requests

1. Fork, create a branch, make your change.
2. Run `npm run check:public-docs` and `npm run smoke`; make sure they print `PUBLIC_DOCS_OK` and `SMOKE_OK`.
3. Keep the diff focused and the UI consistent with what's there.
4. Open the PR with a short description of what and why.

**Please keep it simple.** ProTimer's whole value is that it stays small, fast and obvious — a change that adds a lot of surface area is unlikely to be merged.

## Translations

UI strings live in an `I18N` dictionary in `controller.html` (and small dictionaries in `remote.html` / `backstage.html`). Adding a language means adding a block with the same keys.
