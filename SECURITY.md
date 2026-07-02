# Security Policy

## Reporting a vulnerability

Please **don't** open a public issue for security problems.

Use GitHub's **[Report a vulnerability](../../security/advisories/new)** (Security tab → Advisories) to report privately. I'll respond as soon as I can — this is a solo project, so please allow a little time.

## How ProTimer handles security

ProTimer is a local desktop app with a small built-in web server (default port `7878`) used for the OBS browser source, the phone remote and the backstage view.

- **Viewing is open, control is token-protected.** The screen/backstage URLs are view-only. Sending commands (`/cmd`) requires a per-session token that is included only in the **Remote** link (`/remote?t=…`). Anyone you give that exact link to can control the timer, so share it deliberately.
- **Local network by default.** The server binds to your LAN. It's reachable by devices on the same Wi-Fi only — unless you explicitly use the optional **Share online** link.
- **OSC input (UDP `7879`) has no authentication.** This matches industry practice (QLab, Ontime): OSC is LAN-trusted. Anyone on the same network can send OSC commands; use it on networks you control. The HTTP `/cmd` API always requires the token, including over the tunnel.
- **Share online is a tunnel (beta).** It exposes the view to the public internet via a tunnel service. Use it deliberately and stop it when done; the LAN + QR path is the reliable, private default.
- **Runtime dependencies** are kept minimal and are audited (`npm audit --omit=dev` is clean). `npm audit` may still list advisories in **build-time** dev dependencies (e.g. `electron-builder` → `tar`); those are not part of the shipped app.

## Supported versions

The latest release on the [Releases page](../../releases/latest) is the supported version.
