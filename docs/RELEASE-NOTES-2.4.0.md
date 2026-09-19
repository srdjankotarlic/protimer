# ProTimer v2.4.0

**Two timers. Two screens. One familiar Control.** Send Timer 1 to one connected television and Timer 2 to another, without losing your existing setup.

Still free and open source. No account, subscription or watermark.

## Download

- **[Windows Setup — recommended](https://github.com/srdjankotarlic/protimer/releases/download/v2.4.0/ProTimer-Setup-2.4.0.exe)** — Windows 10/11 x64.
- **[macOS DMG](https://github.com/srdjankotarlic/protimer/releases/download/v2.4.0/ProTimer-2.4.0-arm64.dmg)** — Apple Silicon, M1 or newer.
- [Windows portable](https://github.com/srdjankotarlic/protimer/releases/download/v2.4.0/ProTimer-2.4.0-portable.exe) — no installation.
- [SHA-256 checksums](https://github.com/srdjankotarlic/protimer/releases/download/v2.4.0/ProTimer-2.4.0-SHA256SUMS.txt).

The automatic Source code archives are not installers. Builds are not Apple-notarized or Windows Authenticode-signed; verify their source before proceeding past a first-launch warning.

## New: separate timer outputs

1. Enable the second timer in **Two timers**.
2. Choose **Display → On two separate screens**.
3. Send Timer 1 with the top display selector and **Send to screen**.
4. Select a different display in the Timer 2 section and click **Send Timer 2**.

Each output has its own fullscreen and close controls. Under **Output window and digits**, choose which window to resize; digit scale and positioning still work independently. Closing or reopening a window does not stop or restart its timer.

Both displays must be connected to the same computer and configured as **extended displays**, not mirrored screens. Test the actual TVs/adapters before the show.

## Reliability fix

Rundown auto-advance now runs independently of screen repainting, so it continues when Control is covered or hidden. Pausing still cancels a pending automatic transition.

Changing fullscreen on one output also preserves the other output's chosen position and size during macOS Spaces transitions.

## Everything you already use stays

- Combined left/right or top/bottom two-timer view.
- Independent timer transport, shared Start/Pause/Reset both, and rundown on Timer 1.
- Control-only startup: neither output opens until you explicitly send it.
- Frameless mouse movement/resizing, exact resolution, digit scale/position and Grid.
- Colors, warnings, speaker messages and blackout on both outputs.
- Text, NOW/NEXT and audience QR on the first output.
- Phone control, OBS/browser links, Backstage, Companion and OSC. Network viewers retain the combined view.

Close the old ProTimer before replacing it. Saved settings and rundown stay in your existing profile; timers do not resume running after relaunch.

[Read the two-display guide](https://github.com/srdjankotarlic/protimer/blob/v2.4.0/docs/SEPARATE-OUTPUTS.md).

**SR:** Tajmer 1 na HP, Tajmer 2 na Philips — iz iste kontrole. Uključi drugi tajmer, izaberi **Na dva odvojena ekrana**, pa pošalji svaki na željeni televizor. Zajednički prikaz i sve prethodne funkcije ostaju. Oba televizora moraju biti povezana s istim računarom kao prošireni ekrani.
