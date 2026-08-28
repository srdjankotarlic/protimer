# ProTimer 2.1 verification

This document records the reproducible checks used for the ProTimer 2.1 release. It intentionally contains no machine-specific paths, private event data or access tokens.

## Automated verification

From a clean checkout with a current Node.js LTS release:

```bash
npm ci
npm run smoke
```

The smoke suite covers timer state, countdown and stopwatch modes, rundown transitions, long cue lists, HTTP control, local SSE, public long-poll delivery, phone-clock skew correction, output controls and audience-safe QR handling.

## Operator experience

- The Control preview remains large and centred while grid placement affects only the audience output.
- Main and cue durations use the same `HH:MM:SS` picker with keyboard confirmation, step controls and minute presets.
- `START RUNDOWN` launches cue one and `GO` advances through the list.
- Long rundowns keep every cue at a readable fixed height inside a scrolling list.
- Existing Colors/Text, Grid, Thresholds, Message, Compact, network, remote and Backstage controls remain available.
- The declared `820 × 480` minimum Control window keeps its primary controls visible without horizontal overflow.

## Audience output

- The output is frameless and stays movable and resizable directly with the mouse.
- Fullscreen is entered and exited from Control, so the audience output has no visible window controls.
- View-only Timer and Backstage QR codes can be placed on the audience output.
- URLs containing a control token are rejected before a QR code is shown.

## Platform packaging

- The Apple Silicon DMG and Windows x64 Setup packages are checked with the packaged smoke flow before release.
- A portable Windows x64 build and a SHA-256 checksum list are published with the release.
- Public download instructions identify installers clearly and explain that GitHub source archives are not applications.

## Release result

ProTimer 2.1.0 passed the automated smoke suite and the operator, output, responsive-layout and packaging acceptance checks above. See the [2.1.0 release notes](docs/RELEASE-NOTES-2.1.0.md) and [latest release](https://github.com/srdjankotarlic/protimer/releases/latest) for user-facing details.
