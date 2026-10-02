# Local preview 10 — real LIVE sending

2026-10-01. Free ProTimer only. App `2.5.0-streamdeck.10`, native plugin `0.1.0.9`. No GitHub push, PR or release.

## Changes

- LIVE T1/BOTH/T2 now preflight the connected displays and open the actual output, rather than only changing audience selection. Together uses the configured split on the primary selected screen; Separate uses the independently selected destinations and closes only the excluded output. Neither clock is changed. LIVE restores the audience picture after blackout.
- Control has a LIVE presentation choice: automatic fullscreen unless Grid is enabled, explicit fullscreen, or configured window/Grid. Screen, split, size and positioning remain in Control.
- Applied ACK checks readiness, actual display, visibility and fullscreen/window mode. Missing displays are errors; no unintended fallback. Repeated fullscreen sending avoids leaving/re-entering the same fullscreen.
- macOS LIVE uses Electron's documented simple fullscreen, keeping two display windows independent of Spaces. Normal legacy Control fullscreen remains native; exiting/resizing and output diagnostics recognize both modes. Windows keeps native fullscreen. See [Electron BrowserWindow](https://www.electronjs.org/docs/latest/api/browser-window#winsetsimplefullscreenflag-macos).
- BLACK ON and BLACK OFF have explicit, distinct labels/status. Both are idempotent; timers keep running. LIVE keys show ON AIR only when the relevant output is actually open and the picture is not black.
- The untouched factory starter upgrades RESUME to PLAY ACTIVE, which starts a READY loaded ACTIVE value or resumes it without silently loading SET. Custom RESUME keys remain unchanged. LOAD READY remains version-pinned and refuses to replace a running timer.
- Native command ACK timeout allows OS display transitions; commands still expire before execution, have IDs and are not replayed on reconnect.

## Verification

- `npm test`: 204/204 passed.
- `npm run deck:test`: TypeScript and 31/31 plugin tests passed. SDK action events use a simulated Elgato endpoint, not physical USB presses.
- `npm run smoke:deck`: passed real Electron renderer/loopback commands, all six adjustments and five presets for both targets, LOAD READY/PLAY ACTIVE, numeric 01:23:45, BLACK ON/OFF on both output DOMs, separate fullscreen sending/closing, combined fullscreen T1/BOTH/T2, clock preservation, no replay and editor checks.
- `npm run smoke`: complete regression suite passed (`SMOKE_OK`), including Control-only startup, phone authentication/reconnect, HTTP/OSC, OBS/SSE/polling, rundown, independent output routing/Grid, zero alerts and output-quality measurements. HP E24u G5 and PHL 243V7 were available to Electron. This verifies software windows, not the signal at a remote TV/switcher.
- `npm run deck:validate`, `npm run deck:package`, `npm run check:packaging`, `git diff --check`: passed. Packaging checker prints its legacy `v2.4.1` label; it is not the built app version.
- `npx electron-builder --mac --arm64 --publish never`: completed local app/DMG, without a signing identity or publication.

An extra two-display fullscreen smoke initially exposed native macOS transition failures. Those failures were not ignored; the simple-fullscreen fix above and its two additional unit tests preceded the final passing suite.

## Local installation

User authorized interrupting the test and restarting. `/Users/srdjankotarlic/Desktop/ProTimer.app` was replaced; installed app.asar SHA-256 matches the final build:

`0245202cb4f1c9fb24f4a2052e8d3536b2f7415fa42163b68441e648afd2ee30`

Original app, plugin and user data are recoverable in `ProTimer-builds/backup-before-deck-send-m4Q36Y`. Existing Elgato profiles/settings were preserved. The actual official plugin package was opened in Finder and installation confirmed in Elgato; final installed manifest is 0.1.0.9. ProTimer Control reports Connected with Stream Deck XL; the existing profile renders PLAY ACTIVE, BLACK ON/OFF and four LIVE/LOAD keys. Startup opens Control only. Timer 2 remains off as saved by the user; enable it before testing T2/BOTH.

## Physical checks still needed

1. On the actual XL: LIVE T1 → BLACK ON → BLACK OFF. Confirm selected screen, fullscreen/window/Grid, and one action per press.
2. Enable Timer 2. Together: LIVE BOTH must use Control split; LIVE T2 must fill the combined output with only T2. Separate: each selected display must show its own timer; single LIVE closes only the other output.
3. T1 and T2 separately: every preset, all six corrections, LOAD READY, PLAY ACTIVE, PAUSE, START SET, RESET, CLEAR SET, COUNT UP/CLOCK and ENTER TIME.
4. Listen to one BELL through the intended physical audio output; verify LCD state and unplug/reconnect on real USB.

Windows runtime, physical USB keypresses, downstream switcher/TV image and an extended real-hardware rehearsal are not claimed verified in this turn.
