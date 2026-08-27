# ProTimer 2.1.0

This release makes the operator view clearer and the audience output safer to use live.

## Download one file

| Computer | Recommended file | Direct download |
|---|---|---|
| Apple Silicon Mac (M1 or newer) | `ProTimer-2.1.0-arm64.dmg` | [Download macOS DMG](https://github.com/srdjankotarlic/protimer/releases/download/v2.1.0/ProTimer-2.1.0-arm64.dmg) |
| Windows 10/11 x64 | `ProTimer-Setup-2.1.0.exe` | [Download Windows Setup](https://github.com/srdjankotarlic/protimer/releases/download/v2.1.0/ProTimer-Setup-2.1.0.exe) |
| Windows 10/11 x64, no installation | `ProTimer-2.1.0-portable.exe` | [Download portable Windows EXE](https://github.com/srdjankotarlic/protimer/releases/download/v2.1.0/ProTimer-2.1.0-portable.exe) |

Most Windows users should choose **Setup**. GitHub's automatic **Source code** ZIP and TAR.GZ files are for developers and do not install ProTimer.

The builds are not code-signed yet. On Windows, SmartScreen may show **Unknown publisher**; continue only if the file came from this release. On macOS, if Gatekeeper blocks the app, use **System Settings → Privacy & Security → Open Anyway** after confirming the DMG came from this repository.

## Start in 60 seconds

1. Open ProTimer. **Control** is for the operator; the frameless **Screen** window is for the audience.
2. Open **Duration**, set `HH:MM:SS` or choose a minute preset, then press **START**.
3. Drag and resize Screen with the mouse, or select a monitor and use **Send to screen** / fullscreen from Control.
4. For audience phones, use the view-only Timer or Backstage **QR** and choose **Show QR to audience**.

## What changed

- The timer preview in Control stays large and centred even when grid placement moves the real stage output.
- Main and rundown durations now use one clear `HH:MM:SS` picker with step controls and minute presets.
- A prominent **START RUNDOWN** button always launches the first cue; the redundant small Start and visible CSV/import buttons are gone.
- Long rundowns keep every cue at a readable fixed height and scroll inside the rundown card instead of compressing rows.
- The output window is always frameless while remaining movable and resizable directly with the mouse. Fullscreen is controlled only from Control.
- View-only Timer and Backstage QR codes can be shown directly on the audience output. Control-token URLs are rejected.
- Existing Colors/Text, Grid, Thresholds, Message, Compact, network, remote, backstage and automation controls remain available.
- Phone viewers continue to use host-clock synchronisation and rate-limited rendering; the release smoke test covers local SSE, public long-poll, clock skew and 100-cue Backstage performance.

For show-critical remote viewing, LAN + QR remains the recommended path. Share Online is still a beta third-party tunnel.

Full documentation: [ProTimer product page](https://srdjankotarlic.github.io/protimer/) · [README and user guide](https://github.com/srdjankotarlic/protimer#readme)
