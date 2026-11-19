# ProTimer 2.5.3 verification

The regression in #58 was reproduced from the real Control checkbox. Turning Timer 2 off selected T1-only; turning it back on left the audience filtered to T1. The previous smoke fixtures explicitly assigned `liveTimerView='both'`, so they missed that user transition.

## Local results

- `npm test` passed 226 tests.
- `npm run deck:test` passed TypeScript checking and 34 plugin tests.
- `npm run check:public-docs` passed for 2.5.3.
- `npm run check:packaging` passed against the published distribution metadata. It is advanced to 2.5.3 after the new binaries exist.
- `electron . --smoke --audience-visibility-only --disable-gpu` reproduced the original failure before the fix and passed after it.
- `electron . --smoke --disable-gpu` passed the complete application suite with the new regression included.

## New regression coverage

The test enables Timer 2 through the checkbox after first disabling it, rather than injecting an already-correct audience state. Native and browser output are checked in columns and rows, with free layout both off and on, and with countdown, stopwatch and clock. Separate Timer 2 routing, the current session's LIVE T1/T2/Both commands, old saved T1-only preferences and reopening with Control-only startup are exercised.

For #59, the test verifies that foreground blackout hides timers, title, message, NOW/NEXT, progress and QR while retaining the selected solid color. With transparency enabled, captured pixels from both native and browser windows must have zero alpha. Separate outputs honor the mode, restoring the picture works from the Timer 2 button, traditional black-screen mode still works, the clock deadline remains unchanged, and the preference survives restart.

## Release gates and limits

The public Release workflow runs tests, builds macOS arm64 and Windows x64 packages, then runs the full smoke suite from the packaged apps. Windows Setup is installed and reinstalled, executable/archive hashes are compared against the build, and uninstall is verified. The public release links to the successful workflow.

These checks cover rendered pixels, software transports and native windows. Physical Stream Deck USB/LCD operation and a venue HDMI/switcher/projector chain require testing with that equipment. No physical Windows presentation test or continuous multi-day soak is inferred from CI results.
