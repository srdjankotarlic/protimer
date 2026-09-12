# Changelog

Notable ProTimer changes are listed here. The complete notes and installers are available on the [Releases page](https://github.com/srdjankotarlic/protimer/releases).

## 2.3.0 — 2026-09-12

- Refined the existing Control appearance without moving its sections: clearer text, consistent native-font controls, higher-contrast action colors and visible keyboard focus.
- Added safer rundown selection, explicit load/run, live-safe editing, duplication, reordering and delete/undo, with Start/Pause/Resume and schedule controls.
- Kept rundown rows fixed-height and scrollable, with separate selected and currently running states.
- Organized connection links by role, with private control distinguished from audience/OBS and crew views.
- Added labeled closeable QR panels, reliable copy feedback and protection against obsolete network/QR responses.
- Preserved control-only startup, exact output sizing, digit placement, dual timers and existing settings.

[Full 2.3.0 notes](docs/RELEASE-NOTES-2.3.0.md)

## 2.2.1 — 2026-09-11

- Start with Control only: launching ProTimer no longer opens or sends an audience window to a monitor.
- Saved output size, Grid, transparency and dual-timer preferences remain available without automatically opening the output.
- Added packaged macOS/Windows regression checks for control-only startup and explicit output open, close and reopen.

[Full 2.2.1 notes](docs/RELEASE-NOTES-2.2.1.md)

## 2.2.0 — 2026-09-07

- Added exact output width/height, HD/Full HD presets and fullscreen-safe resizing.
- Added independent digit scaling and X/Y positioning without moving the operator preview.
- Added two independent countdowns with left/right or top/bottom splits.
- Added network adapter selection, local-address diagnostics and authenticated phone reconnection/error states.
- Prevented early Quick Tunnel DNS lookups from caching a not-yet-published hostname.
- Isolated automated tests from the operator’s saved settings and rundown.

[Full 2.2.0 notes](docs/RELEASE-NOTES-2.2.0.md)

## 2.1.0 — 2026-08-27

- Kept the Control preview large and centred while grid placement affects only the audience output.
- Added a clearer shared `HH:MM:SS` duration picker for the timer and rundown cues.
- Added a prominent **START RUNDOWN** action and a fixed-height, scrollable rundown list.
- Made the audience window frameless, movable and resizable, with fullscreen controlled from Control.
- Added safe view-only Timer and Backstage QR codes to the audience output.
- Improved phone stability with host-clock synchronisation and rate-limited rendering.

[Full 2.1.0 notes](docs/RELEASE-NOTES-2.1.0.md)

## 2.0.1 — 2026-08-26

- Improved phone clock accuracy and public-link reliability.
- Added a verified Cloudflare Quick Tunnel with a labelled fallback.
- Expanded smoke coverage for time sync, public transport and large rundowns.

[Full 2.0.1 notes](docs/RELEASE-NOTES-2.0.1.md)

## 2.0.0 — 2026-07-02

- First public macOS and Windows release of the free ProTimer stage timer.

[Full 2.0.0 notes](docs/RELEASE-NOTES-2.0.0.md)
