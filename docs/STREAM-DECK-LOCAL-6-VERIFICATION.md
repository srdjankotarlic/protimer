# Stream Deck local preview 6 — one-touch controls

2026-09-30. App `2.5.0-streamdeck.6`; plugin `0.1.0.5`. Local preview only; no GitHub push or release.

## Implemented

- Native executable Deck controls perform one action on keyDown, without holding or a second press. Includes RESET, BLACK, output close, explicit LIVE changes and START SET replacing running/paused ACTIVE. ACTIVE/SET LCD keys remain read-only displays.
- This policy is supplied by the authoritative app and trusted authenticated native adapter context, not an imported layout or arbitrary command field. Local/global keyboard and Control confirmation policies remain unchanged. Older app builds keep the plugin's hold behavior.
- START SET still checks exact ACTIVE/SET versions, executes atomically and deduplicates command IDs. Offline/stale writes remain blocked. Holding/repeated keyDown never repeats the operation.
- Larger original vector action icons, brighter default-blue contrast, separate numeric readout styling and larger time digits. Monospace cell measurements fit long/overtime values without clipping colons or ones.
- Control and Elgato editors explain immediate actions. Elgato per-key edits save short-press configuration and never execute commands. Existing custom layouts and four genuinely free slots are preserved.
- Untouched previous starter layouts migrate short-press defaults. Custom layout settings are not overwritten; the authoritative native one-touch policy also applies to legacy hold metadata.

## Executed verification

| Command | Result |
| --- | --- |
| `npm test` | 191/191 passed |
| `npm run deck:test` | TypeScript passed; 30/30 passed |
| `npm run smoke:deck` | Passed: ACTIVE/SET isolation, one-touch atomic replacement, numeric 01:23:45, both timers, disconnect/no replay, 27 editor assertions, real output adapter |
| `npm run smoke` | Passed: original startup, LAN/phone/SSE/polling/OSC, rundown, separate outputs, alerts and output-quality regressions |
| `npm run deck:validate` | Official Elgato CLI validation passed |
| `npm run deck:package` | Official package built |
| `npm run check:packaging` | Passed |
| `npm run dist:mac -- --publish never` | Passed; final package rebuilt using `electron-builder --mac --arm64 --publish never` |
| `git diff --check` | Passed |

SDK adapter tests run the compiled plugin against simulated Elgato events. They verify short-tap running replacement, pause/resume/reset/blackout/bell, no repeated bell on repeated keyDown, presets/adjustments, T1/T2 selection, numeric entry and independent per-key Elgato configuration. They are **not physical USB key-press tests**.

## Local installation / actual UI

Installed the verified arm64 app at `/Users/srdjankotarlic/Desktop/ProTimer.app`. Installed plugin through its real `.streamDeckPlugin` package and Elgato confirmation. Original app, plugin and layout backup:

`/Users/srdjankotarlic/Documents/New project/ProTimer-builds/backup-before-deck-touch-dGbXKH`

Real Elgato software shows XL, the existing manually selected ProTimer profile, 28 distinct native LCD action/readout graphics and four empty positions. Control reports connected XL and the explicit one-touch notice. Startup leaves both timers stopped and audience outputs closed. Installed plugin source and app-bundled plugin package hashes match their build artifacts. User data was preserved.

## Remaining physical checks

1. On the actual XL: select T1, prepare a preset, adjust SET, START SET, PAUSE, RESUME. Repeat for T2.
2. During a test run, deliberately tap START SET, RESET and BLACK: they now act immediately. Keep a key down and confirm no repeat. Do not test destructive actions during a show.
3. Check long live LCD values, USB unplug/reconnect, native page moves and user icon/title overrides. Foreign actions/free positions must stay untouched.
4. Confirm bell/output routing and both physical display pictures. An open-window status does not prove the television signal.
5. Windows x64 installation/runtime and extended physical operation were not tested on this Mac.

No newly verified bundled starter profiles or automatic profile-activation capability is claimed.
