# Stream Deck preview 11 — graphics and distribution

2026-10-01. Free ProTimer, app `2.5.0-streamdeck.11`, plugin `0.1.0.10`.

## Implemented

Original SVG LCD artwork: colored gradients, distinct live-destination/load/clear/blackout icons, white labels and large authoritative ACTIVE/SET digits. Plus/minus directions use different accents. Offline rendering is muted. User icons, labels and colors remain configurable; the renderer caches unchanged SVGs. Command behavior remains one-touch.

The release workflow now publishes the official-CLI native plugin as a separately downloadable asset and includes its SHA-256 checksum. Both desktop installers already bundle that same package, verified by the after-pack hash check. No new USB/HID ownership or timer engine was introduced.

A genuine, unchanged user export from Elgato 7.6.0.23012 is now bundled as XL Full 32, with editable keys and manual activation only. Its SHA-256 is `e86a1cecc8535f87987e8925f7e95c24aeae331afac0ef8fad20f4e301fa9fe3`. Standard 28 remains a logical mixed template, not a second native profile. A conservative lifecycle guard prevents Control from returning a profile after its activation evidence changes. Windows fullscreen-exit movement no longer cancels an explicit resize; a regression test reproduces the event ordering found by CI.

README and setup guides in English/Serbian explain the actual installation path, daily workflow, native editing and limitations. Stable downloads stay on 2.4.1; new native controls remain a preview until clean-machine/profile/hardware acceptance is complete.

## Actual local checks

- `npm test`: 209/209 passed, including delayed native frame restoration after fullscreen exit.
- `npm run deck:test`: TypeScript and 33/33 plugin tests passed, including semantic artwork, custom overrides, long LCD times, genuine profile inspection and simulated SDK one-touch commands/manual activation. **Not a physical USB test.**
- `npm run smoke:deck`: passed on real Electron with HP and Philips displays, including separate/combined LIVE sending, independent clocks, numeric entry, presets/adjustments, BLACK ON/OFF and layout editing. The SDK client is simulated.
- `npm run smoke`: full suite passed, `SMOKE_OK`, including existing phone/LAN authentication, OBS, OSC, rundown, output quality, independent alerts and Control-only startup.
- `npm run deck:package` and `npm run deck:validate`: passed official Elgato CLI.
- `npm run check:packaging`, `npm run check:public-docs`, `git diff --check`: passed. Public checks deliberately refer to stable 2.4.1.
- `npx electron-builder --mac --arm64 --publish never`: produced app and DMG, with verified bundled plugin and cloudflared. Unsigned/not notarized.
- Built Mac app `Contents/MacOS/ProTimer --smoke --disable-gpu`: full packaged suite passed, `SMOKE_OK`.
- `npm run deck:preview`: generated the committed contact sheet using the exact LCD SVG renderer. It uses sample values and is labeled as a design preview.

## Actual installed Mac / Elgato checks

Installed the official plugin package through Finder/Elgato's Install confirmation, which reported successful installation. Installed manifest is `0.1.0.10`, minimum software `7.6`; installed `bin/plugin.js` SHA-256 matches build `e7f145def0b803bc51cd479af26bf764d459980cead2099267cd6460f90fe2e6`.

Replaced Desktop ProTimer.app with the verified build, preserving user data and recoverable backups. Installed `app.asar` SHA-256 matches build `5b9b026dd864e0474b0887d002eb934c3d55e590bcaf967f0a15c5e6126551e9`. Startup opened only Control. Pairing reported Connected and the real XL. Explicit Activate opened Elgato's first **Install Profile(s)** prompt; confirmation imported the profile as **ProTimer copy**, preserving the existing ProTimer profile. The Elgato editor displayed all 32 new colorful LCD graphics and live ACTIVE/SET readouts. Both timers stayed READY and no audience output opened. Control's conservative previous-profile return became available after the new contexts appeared.

Clicking Control's return button visibly restored the original **ProTimer** profile; a second explicit activation selected **ProTimer copy** without another install prompt. The previous-profile button was disabled after return. These are real Elgato software observations, not physical key presses.

Subsequent CI exposed a delayed Windows restored-frame operation and background renderer timing. Native fullscreen exit now waits for a quiet frame interval before permitting size application. Audience windows disable background throttling and render a received authoritative state immediately, making BLACK/LIVE changes independent of a delayed interval tick. The Deck smoke waits for the expected rendered blackout state instead of assuming a fixed 80 ms paint. Linux checks native frame dimensions without assuming X11 window-manager-owned coordinates remain fixed.

## Pending acceptance

A clean-machine first setup; physical XL presses/LCDs/audio and long USB/sleep rehearsal; Windows device/runtime acceptance. The local native profile import and editor rendering were observed in real Elgato software, not invented ZIPs. Automated CI and simulated SDK events must not be reported as physical button presses or these remaining hardware checks. No arbitrary user profiles or foreign buttons are overwritten.
