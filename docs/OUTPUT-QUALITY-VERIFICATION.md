# Output-quality verification — 2.5.0-streamdeck.4

Local verification on 2026-09-27, before the subsequently authorized GitHub publication. This report records the local build and installation; release-workflow results are available in [GitHub Actions](https://github.com/srdjankotarlic/protimer/actions/workflows/release.yml). No runtime changes after the final local packaged smoke test.

## Commands and results

| Command / check | Result |
| --- | --- |
| `npm test` | 186 passed, 0 failed |
| `npm run deck:test` | TypeScript check and 11 plugin tests passed |
| `npm run deck:package` | Official Elgato CLI package created |
| `npm run deck:validate` | Validation successful |
| `npm run check:packaging` | Passed; public stable metadata remains 2.4.1 |
| `npm run check:public-docs` | Passed; public stable download links unchanged |
| `git diff --check` | Passed |
| `npm run smoke` | `SMOKE_OK`, including all 21 output-quality checks |
| `CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --mac --arm64 --publish never` | App and DMG built; bundled plugin and cloudflared checks passed |
| `dist-installers/mac-arm64/ProTimer.app/Contents/MacOS/ProTimer --smoke` | `SMOKE_OK` from the final packaged application |
| `CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --win --x64 --publish never` | Windows x64 NSIS and portable packages built on macOS; **not Windows execution** |
| Packaged source comparison | Six changed runtime/smoke files matched source in both Mac and Windows ASARs |

Paths containing spaces must be quoted when invoking the packaged binary.

## What the tests establish

- The real macOS output renderer and encoded capture both measured 1280×720 and 1920×1080 at DPR 1 / zoom 100%. Font sizing changed with viewport size; no fixed low-resolution timer image was substituted.
- The full suite routed separate outputs to the connected HP E24u G5 and PHL 243V7 displays and exercised independent Grid, fullscreen, custom size, scaling and combined rows/columns.
- Apply from a closed output produced a visible, correctly sized window on its selected display, for both timers. Read-only quality checks did not open closed outputs or change running deadlines.
- Unit/VM tests covered fractional 1.25× and 2× DPI, bounded captures, stale responses, closing/replacing an output during a request, background macOS Spaces relocation, and manual-drag routing. These are controlled cases, not tests on physical Retina/Windows displays.
- UI checks covered SR/EN at 820 and 1120 logical pixels, selection changes during a check, clipping warnings and a cropped diagnostic screenshot inspected visually.
- Existing native regressions passed for Control-only startup, restored settings, rundown, phone-view reconnect/authentication, HTTP/OSC, SSE/polling, OBS/browser pages, audience QR, two timers, zero-alert settings, and the Stream Deck command/editor adapter.
- Clock regression tests use an injected clock for wall-clock jumps and 48-hour simulated suspend. They are not a 48-hour real-time soak.

The native smoke runs above did not pass `--disable-gpu`. They use temporary user data and mute automated bell playback. Production settings were backed up separately and not used as test fixtures.

## Installation and artifact identity

The final Mac application replaced the existing Desktop installation, with the older application and user data kept in a recoverable backup. The new installation was opened normally; Control showed the saved rundown, stopped timers and closed output. Clicking **Proveri izlaz** while closed kept it closed.

- Mac `app.asar` SHA-256: `c470dbbb0fecd7f7113dc293deeb8722a26c4a00f8b03f174291705a01e0fd81`
- Mac DMG SHA-256: `4ed29306f7811d456a7fd4ebef3de7e1a6b3a01dc55358c7268d74eca9ffedaa`

## Not established by this run

The final picture through a Roland V-160HD and venue TV still needs an on-equipment rehearsal. A native window capture cannot certify HDMI format, TV processing or panel sharpness. No Windows runtime, physical Stream Deck XL/USB/LCD, actual venue Wi-Fi, audio-output-device or extended live-show acceptance is claimed. Stream Deck starter-profile limitations remain unchanged.

## Srpski

Prošlo je 186 testova aplikacije i 11 testova plugina, kao i kompletna provera gotovog Mac paketa. Potvrđene su dimenzije iscrtavanja HD/Full HD i bezbedno ponašanje oba izlaza. U ovoj lokalnoj proveri Windows instaleri su napravljeni na Macu, ali nisu pokrenuti na Windowsu. Nova lokalna verzija je instalirana uz rezervnu kopiju. Ovaj izveštaj prethodi naknadno odobrenoj objavi na GitHubu; rezultate automatizovane release provere vidi na linku iznad. Roland/TV, fizički Stream Deck, mreža na terenu i duga proba ostaju hardverska provera.
