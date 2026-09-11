# ProTimer v2.2.1

**Control-only startup for live shows.** Opening ProTimer now opens only Control. No audience timer window is created or sent to a monitor automatically. You choose the display and click **Send to screen** when you are ready.

Still free and open source, with no account, subscription or watermark.

## Download

- **[Windows Setup — recommended](https://github.com/srdjankotarlic/protimer/releases/download/v2.2.1/ProTimer-Setup-2.2.1.exe)** — Windows 10/11 x64.
- **[macOS DMG](https://github.com/srdjankotarlic/protimer/releases/download/v2.2.1/ProTimer-2.2.1-arm64.dmg)** — Apple Silicon, M1 or newer.
- [Windows portable](https://github.com/srdjankotarlic/protimer/releases/download/v2.2.1/ProTimer-2.2.1-portable.exe) — no installation.
- [SHA-256 checksums](https://github.com/srdjankotarlic/protimer/releases/download/v2.2.1/ProTimer-2.2.1-SHA256SUMS.txt).

The automatic Source code archives are not installers. These builds are not Apple-notarized or Windows Authenticode-signed. Only proceed past a first-launch security warning after confirming the file came from this repository.

## What changed

- Removed automatic audience-window creation on launch, including when output preferences are restored.
- Preserved saved rundown, durations, exact window size, digit layouts, Grid, transparency and two-timer settings.
- Closing the output keeps it closed while you operate the timer in Control. Use **Send to screen** to reopen it. Fullscreen remains controlled from Control.
- Added regression tests for fresh and saved-settings startup, monitor/activation events, and explicit output open/close/reopen on macOS and Windows.

**Apply size** and **Show QR to audience** remain explicit output actions and can open the audience window. Phone, OBS and network viewing remain available while the desktop output is closed. This update does not automatically mute an already connected OBS/browser source.

## Update and use

Close the old ProTimer before replacing it. Open the new version, choose a monitor in Control, then click **Send to screen** when you are ready to show the timer. Saved settings and rundown remain in your existing profile; timers do not resume running after relaunch.

Scan a new private **Remote** QR after every app restart. Test the actual phone and venue network before a show. Online sharing remains an experimental third-party service; keep a local control path available.

**SR:** ProTimer sada otvara samo Kontrolu. Izlazni prozor se ne pojavljuje sam — ti biraš monitor i klikneš **Pošalji na ekran** kada želiš. Podešavanja i rundown ostaju sačuvani.
