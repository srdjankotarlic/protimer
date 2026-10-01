# Stream Deck preview 11 — graphics and distribution

2026-10-01. Free ProTimer, app `2.5.0-streamdeck.11`, plugin `0.1.0.10`.

## Implemented

Original SVG LCD artwork: colored gradients, distinct live-destination/load/clear/blackout icons, white labels and large authoritative ACTIVE/SET digits. Plus/minus directions use different accents. Offline rendering is muted. User icons, labels and colors remain configurable; the renderer caches unchanged SVGs. Command behavior remains one-touch.

The release workflow now publishes the official-CLI native plugin as a separately downloadable asset and includes its SHA-256 checksum. Both desktop installers already bundle that same package, verified by the after-pack hash check. No new USB/HID ownership or timer engine was introduced.

README and setup guides in English/Serbian explain the actual installation path, daily workflow, native editing and limitations. Stable downloads stay on 2.4.1; new native controls remain a preview until clean-machine/profile/hardware acceptance is complete.

## Actual local checks

- `npm test`: 204/204 passed.
- `npm run deck:test`: TypeScript and 32/32 plugin tests passed, including semantic artwork, custom overrides, long LCD times and simulated SDK one-touch commands. **Not a physical USB test.**
- `npm run smoke:deck`: passed on real Electron with HP and Philips displays, including separate/combined LIVE sending, independent clocks, numeric entry, presets/adjustments, BLACK ON/OFF and layout editing. The SDK client is simulated.
- `npm run smoke`: full suite passed, `SMOKE_OK`, including existing phone/LAN authentication, OBS, OSC, rundown, output quality, independent alerts and Control-only startup.
- `npm run deck:package` and `npm run deck:validate`: passed official Elgato CLI.
- `npm run check:packaging`, `npm run check:public-docs`, `git diff --check`: passed. Public checks deliberately refer to stable 2.4.1.
- `npx electron-builder --mac --arm64 --publish never`: produced app and DMG, with verified bundled plugin and cloudflared. Unsigned/not notarized.
- `npm run deck:preview`: generated the committed contact sheet using the exact LCD SVG renderer. It uses sample values and is labeled as a design preview.

## Pending acceptance

Real `.streamDeckProfile` export/reimport through Elgato; a clean-machine first setup; physical XL presses/LCDs/audio and long USB/sleep rehearsal; Windows device/runtime acceptance. Automated CI and simulated SDK events must not be reported as these checks. No arbitrary user profiles or foreign buttons are overwritten. Without a verified native profile, manual action placement remains required.
