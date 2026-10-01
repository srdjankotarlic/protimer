# Local preview 8 — READY loading and audience keys

2026-09-30. App `2.5.0-streamdeck.8`, plugin `0.1.0.7`. No GitHub changes.

Implemented version-pinned atomic LOAD READY (SET to ACTIVE without starting), and presentation-only LIVE T1/BOTH/T2. Existing transport/routing is preserved; running ACTIVE refuses LOAD READY. The optional full layout adds the four keys without changing mixed/custom layouts.

Before the user's instruction to stop further timer testing: `npm test` passed 196/196; `npm run deck:test` passed TypeScript and 31/31; `npm run smoke:deck` passed. Official plugin validation/package, packaging check, and macOS arm64 electron-builder with `--publish never` completed. Full `npm run smoke` did not pass: after test-isolation repairs it failed at the LOAD READY running-refusal assertion in smoke-deck.js (expected ACTIVE_RUNNING, actual undefined). This unresolved suite result is not represented as a pass. No additional timer tests were run after the user's instruction.

Installed app locally after both timers were idle. Installed app.asar SHA-256 matches the built artifact: `a777b3a9f940651cd4e72419e9e2551d00ebe296934d6d6feaa1c2d4f2c117ff`. Installed plugin manifest reports 0.1.0.7. Recoverable app/plugin/settings backup: `ProTimer-builds/backup-before-deck-live-uRa1k1`.

Added four actions using the actual Elgato editor (no internal profile writes): column 8 rows 1–4 are LOAD READY, LIVE T1, LIVE T1 + T2, LIVE T2. These are standalone actions editable through Elgato Property Inspector; original 28 keys were not changed. Saved settings confirmations and rendered labels were observed. No live command or physical USB keypress was executed for these four controls; Windows and hardware behavior are not claimed tested.

The prepared logical JSON export exists at `ProTimer-builds/protimer-live-32-layout.json` but was not applied: the native file picker disabled Open. The physical keys were configured directly in Elgato instead. Existing Control layout remains intact.
