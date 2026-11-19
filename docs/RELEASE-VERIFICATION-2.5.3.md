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

## Packaged and platform results

Both macOS arm64 and Windows x64 packages passed [run 44546404539](https://github.com/srdjankotarlic/protimer/actions/runs/44546404539). Windows Setup passed first install, reinstall, installed-file hash comparison, the full app smoke and uninstall. The downloaded Mac DMG mounted and its app archive source matched the tested checkout. The local installed app is 2.5.3, with the previous app and user data backed up.

All three source checks passed in [run 44547025901](https://github.com/srdjankotarlic/protimer/actions/runs/44547025901). Its first Mac attempt failed the existing native sibling-fullscreen restoration check, and the unchanged failed job passed on rerun. The full Mac packaged check and local suite passed. No assertion was relaxed. A queued macOS 15 source job was replaced with the current macOS runner used by release packaging.

Published assets come from commit `73cfda9`. The release tag targets merged commit `1ebc25e`, whose runtime files, packaging inputs and smoke scripts are identical. The intervening change is the source-CI runner selection. The five release assets were uploaded together and SHA-256 values checked.

## Post-release source fixture

The separate-output source smoke now waits for the native enter/leave-full-screen event before reversing a transition. The renderer publishes its requested fullscreen mode immediately, so checking that flag alone could reverse the OS animation too early. Native state, resizability, renderer state and restored sibling/window geometry are still asserted. This fixture-only change does not alter the published application runtime or binaries.
