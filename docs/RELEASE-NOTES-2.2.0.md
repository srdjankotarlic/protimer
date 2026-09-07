# ProTimer v2.2.0

Precise output sizing, independently positioned digits, two timers on one screen and clearer phone control. Still free and open source, with no account, subscription or watermark.

## Download

- **[Windows Setup — recommended](https://github.com/srdjankotarlic/protimer/releases/download/v2.2.0/ProTimer-Setup-2.2.0.exe)** — Windows 10/11 x64.
- **[macOS DMG](https://github.com/srdjankotarlic/protimer/releases/download/v2.2.0/ProTimer-2.2.0-arm64.dmg)** — Apple Silicon, M1 or newer.
- [Windows portable](https://github.com/srdjankotarlic/protimer/releases/download/v2.2.0/ProTimer-2.2.0-portable.exe) — no installation.
- [SHA-256 checksums](https://github.com/srdjankotarlic/protimer/releases/download/v2.2.0/ProTimer-2.2.0-SHA256SUMS.txt).

The automatic Source code archives are not installers. These builds are not Apple-notarized or Windows Authenticode-signed. Only proceed past a first-launch security warning after confirming the file came from this repository.

## What changed

1. **Exact output size:** enter width and height in Control, or select HD / Full HD. Applying a size exits fullscreen and disables automatic Grid/Compact sizing. Sizes use logical content pixels; Retina and Windows display scaling can differ from physical pixels.
2. **Digit size and position:** scale digits from 10–200% and position them left/right and up/down with sliders or precise numeric values. The operator preview stays centered.
3. **Two independent countdowns:** show timers left/right or top/bottom, with separate durations, Start/Pause/Reset and shared controls. Adjust each timer’s scale and position separately.
4. **More informative phone control:** select the correct network adapter, check the local server address, reconnect automatically and see authorization or command errors. Scan a new Remote QR after restarting the app. A local self-check does not guarantee access through a venue’s firewall or client isolation.
5. **Online readiness fix:** wait for a newly created Quick Tunnel’s DNS record before the first lookup, avoiding a premature cached “domain not found” response. Private online control remains separate from audience QR codes.

Existing rundown, colors, warning thresholds, messages, transparency, Grid, Backstage, HTTP/OSC and Companion controls remain available. Saved durations/layouts persist; running timers never resume automatically after relaunch.

## Before a show

Close the old ProTimer before installing. On macOS, allow ProTimer under **System Settings → Privacy & Security → Local Network**. Use the same private Wi-Fi and scan **Remote** (not the audience QR) to control the timer. Test Start, Pause and reconnect on the actual phone and network.

**Share Online remains an experimental third-party service**, not a guaranteed show-control connection. It needs internet, can be blocked by network policy and may be temporarily unavailable. Keep a local control path available; never share the private control QR with the audience.

Read the [output and phone control guide](https://github.com/srdjankotarlic/protimer/blob/main/docs/OUTPUT-AND-PHONE-CONTROL.md).
