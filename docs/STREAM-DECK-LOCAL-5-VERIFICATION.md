# Stream Deck local preview 5 — verification

2026-09-30. ProTimer `2.5.0-streamdeck.5`, native plugin `0.1.0.3`.
This is a local preview, not a published GitHub release.

## Delivered changes

- Single-purpose starter transport: START SET, PAUSE and RESUME. Separate T1/T2 selection. All six adjustment keys explicitly prepare SET; existing catalogue commands remain available.
- OPEN A/B are idempotent open-only operations in the starter. The editors also offer close-only and legacy toggles. Closing remains protected.
- Original vector function icons, live LCD values/status, visible hold instructions, fitted long labels and an owned spatial numeric keypad.
- Elgato Property Inspector supports individual editing: “Edit here / Uredi ovde” detaches only that physical key from its Control slot. Command, timer, step/preset, icon, label, appearance and press policy are validated. Save never runs a command.
- Applied command replies include sequenced authoritative frames. Confirmed timer selection/SET updates reach the plugin immediately; older polling responses cannot roll back selection.
- Delayed output acknowledgements no longer hit the shorter polling timeout. Held-key release waits for application acknowledgement, preventing premature guard cancellation.
- Untouched legacy starter layout migrates; custom layouts, four genuinely free positions and other plugins are preserved.

## Executed commands and results

| Command | Result |
| --- | --- |
| `npm test` | 188/188 passed |
| `npm run deck:test` | TypeScript passed; 28/28 plugin tests passed |
| `npm run smoke:deck` | Passed; editor Apply/Cancel, undo/drag, numeric 01:23:45, two timers and real Electron output adapter |
| `npm run smoke` | Passed; startup, SSE/polling, phone HTTP, OSC, rundown, independent outputs, alerts and rendering regressions |
| `npm run deck:validate` | Official Elgato validation passed |
| `npm run deck:package` | Official package created successfully |
| `npm run check:packaging` | Passed |
| `npm run dist:mac -- --publish never` | macOS arm64 app/DMG built; latest package rebuilt with `npm run deck:package` and `electron-builder --mac --arm64 --publish never` |
| `git diff --check` | Passed |

Adapter tests simulate Elgato SDK events; they are **not physical USB button tests**. They exercise compiled plugin code, server/model acknowledgements, one-tap pause/resume/SET start, fast T1/T2 selection, independent Elgato key edits, short/held guards, numeric entry and offline rejection/no replay.

## Local installation and observed runtime

Desktop ProTimer.app was replaced with preview 5 after the user's restart approval. The existing plugin was updated through Elgato's actual `.streamDeckPlugin` installation prompt. Settings were preserved. A recoverable backup of the old app, plugin and Stream Deck settings is at:

`/Users/srdjankotarlic/Documents/New project/ProTimer-builds/backup-before-deck-simple-M5VqnS`

Observed in actual Elgato software with the connected XL: ProTimer profile retained, new colored LCD graphics and separate controls visible, four free keys unchanged. ProTimer Control confirmed “Povezano” with Stream Deck XL. Opening “Uredi ovde” displayed the real command/timer editor without running a timer. Control-only startup left both timers stopped and audience outputs closed.

## Remaining physical checks / Preostala fizička proba

On the actual XL, without ProTimer focused:

1. TIMER 1 → 10 MIN → +1m. SET must show 11:00, ACTIVE unchanged. START SET once from READY; PAUSE once; RESUME once.
2. TIMER 2 → 5 MIN → +1s. Only T2 SET changes. Start T2 separately after enabling it in Control.
3. ENTER TIME → CLEAR ENTRY → 012345 → APPLY. SET must be 1:23:45; ACTIVE stays unchanged until START SET.
4. RESET/BLACK and replacement of running/paused ACTIVE: a short tap must not execute; the LCD says HOLD 1.5s. A full hold executes once.
5. OPEN A twice: output stays open. OPEN B requires Timer 2 and separate outputs enabled. No output action resets either timer.
6. BELL: one strike, no repeated overlap. USB removal/plugin restart must leave the application timer running and never replay commands.
7. Elgato: “Uredi ovde”, change an adjustment to +5 minutes, Save key; verify that physical key changes only SET. Later Control layout changes must not overwrite that independent key.

Windows runtime and physical XL key presses were not verified by the agent. No GitHub push, PR, release, price or license change was made.
