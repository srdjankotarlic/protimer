# Stream Deck local preview 7 — USB reconnect recovery

2026-09-30. App `2.5.0-streamdeck.7`; plugin `0.1.0.6`. Local only; no GitHub publication.

## Reproduced defect

The actual Control window reported no visible owned actions on the selected XL, although the manually selected ProTimer profile still showed cached graphics. Elgato logs showed a USB disconnect/reconnect. The plugin deleted its owned action contexts on `deviceDidDisconnect`, assuming that reconnect would always repeat `willAppear`. The official SDK keeps action contexts until `willDisappear`; a device reconnect is not necessarily a profile/action lifecycle transition.

A compiled-plugin regression test reproduced this exact event ordering (disconnect/connect without repeated `willAppear`). Before the repair it failed with `USB reconnect lost visible owned actions`. After the repair it passes, including actual command dispatch to the simulated authoritative host after reconnect. This is not proof of physical USB keypresses.

## Changes

- Preserve SDK-observed action identities until `willDisappear`. Exclude disconnected devices from inventory/rendering and reject their key presses. Cancel outstanding holds/numeric entry on disconnect, invalidate image cache on reconnect, and never replay commands or switch profiles.
- Pin a rapid following adjustment to the timer selected by the preceding key, even while selection acknowledgement is pending. Display still uses confirmed authoritative state.
- Stable IDs for inactive owned logical slots prevent repeated SDK settings writes on every frame.
- Default BLACK ON and RESTORE are separate explicit commands; repeated taps cannot accidentally toggle the output. Legacy BLACK toggle remains available, custom layouts are preserved, and the full layout includes START ACTIVE.
- CLOCK readouts use authoritative display text and a CLOCK status. Existing ACTIVE/SET isolation, single-touch native policy, duplicate suppression and version checks remain.

## Verification

Completed: `npm test` (192/192), `npm run deck:test` (TypeScript and 30/30), `npm run smoke:deck` (including idempotent BLACK ON/RESTORE against the real Electron renderer), `npm run smoke` (complete existing regressions), official `deck:validate` and `deck:package`, `check:packaging`, `git diff --check`, and `electron-builder --mac --arm64 --publish never`.

Installed plugin `0.1.0.6` through the actual Elgato package/confirmation. Its installed JS SHA-256 matches the compiled source. Actual Control changed from no visible actions to **Povezano**; Elgato LCD ACTIVE now tracks the real running countdown. The active app was not restarted because Timer 1 started during verification. App `2.5.0-streamdeck.7` is built, but replacement waits for operator restart approval. Backup plugin/settings: `/Users/srdjankotarlic/Documents/New project/ProTimer-builds/backup-before-deck-usb-E4y2i8`.

Required physical check after installation: press a SET preset, `+1m`, START SET, PAUSE and RESUME. Then unplug/reconnect the XL and repeat the SET adjustment without changing profiles. Verify both target timers. Do not test resets, replacement starts, or BLACK during a live show. Windows runtime and physical switcher/TV signal are not verified on this Mac.
