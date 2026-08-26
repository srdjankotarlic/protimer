# Security Policy

## Reporting a vulnerability

Please **don't** open a public issue for security problems.

Use GitHub's **[Report a vulnerability](../../security/advisories/new)** (Security tab → Advisories) to report privately. I'll respond as soon as I can — this is a solo project, so please allow a little time.

## How ProTimer handles security

ProTimer is a local desktop app with a small built-in web server (default port `7878`) used for the OBS browser source, the phone remote and the backstage view.

- **Viewing is open, control is token-protected.** The `/`, `/remote`, `/backstage`, `/events` and `/poll` endpoints can be opened without authentication. Viewer state includes the timer, on-screen and speaker messages, and the full rundown, including cue names and notes; a recipient can also change a shared URL path to `/backstage`. Do not put sensitive information in cues or messages when sharing publicly. Sending commands (`/cmd`) requires a random per-launch bearer token that is included only in the **Remote** and API links (`/remote?t=…`). Anyone you give one of those exact token-bearing links to can control the timer, so share it deliberately.
- **Local network by default.** The server binds to your LAN. It's reachable by devices on the same Wi-Fi only — unless you explicitly use the optional **Share online** link.
- **OSC input (UDP `7879`) has no authentication.** This matches industry practice (QLab, Ontime): OSC is LAN-trusted. Anyone on the same network can send OSC commands; use it on networks you control. The HTTP `/cmd` API always requires the token, including over the tunnel.
- **Share online is a tunnel (beta).** It exposes the view and rundown state to the public internet through a Cloudflare Quick Tunnel; a secondary tunnel provider is used only as a fallback. The viewer link never includes the command token. Tunnel traffic passes through the selected provider, availability has no SLA, and the URL remains live until you click **Stop sharing** or quit ProTimer. Use it deliberately; LAN + QR is the reliable, private default for a show.
- **Runtime dependencies** are kept minimal and are audited (`npm audit --omit=dev` is clean). `npm audit` may still list advisories in **build-time** dev dependencies (e.g. `electron-builder` → `tar`); those are not part of the shipped app.

## Supported versions

The latest release on the [Releases page](../../releases/latest) is the supported version.
