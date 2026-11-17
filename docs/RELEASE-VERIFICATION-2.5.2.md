# ProTimer 2.5.2 verification

Verified on 17 November 2026. Functional changes are tracked in [PR #56](https://github.com/srdjankotarlic/protimer/pull/56), addressing #54 and #55.

## Local checks

- `npm test` passed all 224 tests with no failures or skipped tests.
- `npm run deck:test` passed TypeScript checking and all 34 plugin tests.
- `npm run check:public-docs` passed for 2.5.2.
- `npm run check:packaging` passed. Distribution manifests are advanced to the new checksums after publication.
- `PROTIMER_TEST_ONLINE=1 ProTimer.app/Contents/MacOS/ProTimer --smoke --disable-gpu` passed against the installed Mac preview containing the release's functional changes. Tests use isolated settings and finish with `SMOKE_OK`.

## Functional coverage

- Control-only startup, restoring settings and independent duration pickers.
- Both timers' countdown, stopwatch, clock, start/pause/reset, adjustments, exact end time and presets. A running countdown above a second clock passes both new issue scenarios together.
- Free placement of foreground elements, independent background/transparency, captured timer pixels across the former split boundary, browser/OBS rendering and restoring standard layout.
- Output creation, closure, configured resolution, Grid, independent placement, fullscreen and on-top controls. The local native test routed outputs to the built-in Retina display and connected PHL 243V7 and checked window placement.
- Zero/overtime, independent flash and bell settings, audio routing logic, blackout and restoration.
- Rundown start/next, scrollable rows, selection, deletion, scheduled start and auto-advance cancellation. Backstage rendering with 100 cues avoids rebuilding the schedule on clock ticks.
- LAN diagnostics, authenticated HTTP commands, OSC, SSE/poll fallback, reconnect and command errors. A real Cloudflare HTTPS tunnel applied four start/pause commands to both timers with measured round trips of 72, 145, 67 and 68 ms, then stopped successfully.
- Stream Deck command adapter, both ACTIVE/SET targets, presets, live corrections, output commands, disconnect/no replay and layout editor Apply/Cancel/Undo/movement/hotkeys.
- Serbian/English controls at 820 and 1120 pixel widths, settings persistence and restart without automatically opening audience windows.

## Packaged applications

The release workflow builds and runs the complete smoke suite against Windows x64 and macOS arm64 packaged applications before publishing the full set of installers, native plugin and checksums. Its tagged run is linked from the GitHub release. Source CI also exercises Linux under Xvfb.

The preceding preview package passed on both platforms in [run 44073765310](https://github.com/srdjankotarlic/protimer/actions/runs/44073765310). Its initial macOS native fullscreen restoration check failed on the hosted runner and passed on an unchanged rerun. The complete local Mac check passed. Assertions were retained.

## Limits

Windows results are automated hosted-runner tests. Stream Deck coverage exercises the SDK adapter and commands, not physical USB keys or LCD appearance. The local output test measures native windows and rendered pixels, not the downstream HDMI/switcher/TV signal. Browser remote tests use desktop Chromium at phone dimensions, not a physical phone on venue Wi-Fi. Bell tests check playback/routing behavior, not perceived speaker volume.

Long intervals, backward/forward system-clock changes and suspend/resume are covered with simulated time, including durations exceeding 24 hours and 48 hours of sleep. These do not represent a continuous 48-hour hardware soak. The checks document observed results rather than a guarantee for every operating system, peripheral or venue setup.
