# Local preview 12 — LIVE time corrections

Version: ProTimer 2.5.0-streamdeck.12; plugin 0.1.0.11. No GitHub publication in this task.

The existing authoritative adjustment command is reused, with explicit LIVE target, unit and timer ID. No second timer engine or keyboard simulation was added. Control provides four immediate LIVE corrections. Elgato Property Inspector provides settings-only shortcuts for configuring individual LIVE minute keys. Starter/default layouts and the genuine exported profile are unchanged; customized layouts remain persistent.

## Verification on macOS Apple Silicon

- `npm test`: 212 tests passed. New regression covers two running timers, independent SET, minute addition, seconds subtraction and command-ID deduplication.
- `npm run deck:test`: TypeScript and 34 plugin tests passed. New Property Inspector test verifies configuration shortcuts never execute a timer command and preserve the timer target.
- `npm run smoke:deck`: passed; actual Control buttons and authenticated native bridge adjustments keep both countdowns running, change the correct deadline and leave SET/other timer unchanged.
- `npm run deck:package` and `npm run deck:validate`: official package/manifest validation passed.
- `npx electron-builder --mac --arm64 --publish never`: local app/DMG built with bundled plugin.
- `npm run check:packaging`: passed (stable channel configuration remains 2.4.1).
- `dist-installers/mac-arm64/ProTimer.app/Contents/MacOS/ProTimer --smoke`: passed, including LIVE corrections, phone/OSC/HTTP, rundown, dual outputs, alerts, native output quality, Control-only startup and editor regressions. Separate fullscreen hardware scenario was skipped because only one display was connected.

The native bridge client in smoke tests is simulated, not a physical USB press. Windows runtime and physical XL press acceptance are not claimed. After local installation, check +1m/−1m on the actual XL during countdown, verify ACTIVE changes once without pausing and SET stays fixed, then repeat after selecting Timer 2.

## Local installation

With explicit user restart approval, Desktop ProTimer.app was replaced with the verified preview 12 build. Installed app.asar matches the built artifact (SHA-256 `0393993fb2b8c486762be4c2227d5d0ffb6237118c1ba5ca2a84a361fe771fcd`). The bundled package was opened from Control and installed through Elgato's real confirmation; the installed manifest reports 0.1.0.11. Control reports Connected with the XL and startup opened no audience output.

At the user's explicit choice, existing linked minute keys (row 2, columns 3/4) were changed through Control's layout editor to explicit LIVE target, with one atomic Apply. Actual Elgato software shows both red LIVE LCD keys after the update/reconnect. Other keys and prepared SET were unchanged; the paused trial was reset to its saved four-hour duration on the approved restart. Existing presets and numeric entry still prepare SET. User settings and previous app/plugin are recoverable in `ProTimer-builds/backup-before-live-adjust-sSIdz3`. No internal Elgato profile files were edited.
