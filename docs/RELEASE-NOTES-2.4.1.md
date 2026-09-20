# ProTimer v2.4.1

**Two screens, independently positioned.** Give each timer its own Grid, window size and digit layout, with a clear choice of which screen you are editing.

Still free and open source. No account, subscription or watermark.

## Download

- **[Windows Setup — recommended](https://github.com/srdjankotarlic/protimer/releases/download/v2.4.1/ProTimer-Setup-2.4.1.exe)** — Windows 10/11 x64.
- **[macOS DMG](https://github.com/srdjankotarlic/protimer/releases/download/v2.4.1/ProTimer-2.4.1-arm64.dmg)** — Apple Silicon, M1 or newer.
- [Windows portable](https://github.com/srdjankotarlic/protimer/releases/download/v2.4.1/ProTimer-2.4.1-portable.exe) — no installation.
- [SHA-256 checksums](https://github.com/srdjankotarlic/protimer/releases/download/v2.4.1/ProTimer-2.4.1-SHA256SUMS.txt).

The automatic Source code archives are not installers. Builds are not Apple-notarized or Windows Authenticode-signed; verify their source before proceeding past a first-launch warning.

## What changed

- **Independent Grid placement:** each separate output has its own Grid on/off switch, 3×3 / 5×5 / 7×7 / 9×9 size and selected cell. Changing Timer 1 no longer moves Timer 2.
- **Independent exact sizing:** applying a resolution switches off Grid only for the selected output. The other screen keeps its placement.
- **Linked editing target:** choose **Adjust screen → Timer 1 / Timer 2** in the window/digits or Grid panel. Both selectors follow the same target, clearly labeled with its actual display when open.
- **Less clutter:** additional screen selectors appear only with two separate outputs. Combined mode retains its shared window/Grid and independent digit layouts. Single-timer mode hides the extra controls.
- **Saved placement:** both grids, resolutions and digit layouts survive switching modes and restarting. Old shared Grid settings are copied to Timer 2 once; subsequent edits are independent.
- **Keyboard-friendly Grid:** use Tab to reach the Grid, arrows to move focus, and Enter/Space to select a cell, without triggering timer shortcuts.

## Use two displays

1. Connect both displays to the same computer as **extended**, not mirrored, displays.
2. In **Two timers**, enable the second timer and choose **On two separate screens**.
3. Send Timer 1 using the top display selector; send Timer 2 from its own section.
4. Choose **Adjust screen** to set each output's Grid, exact resolution, digit scale and left/right/up/down position.

Turn off the selected output's Grid to move/resize its frameless window with the mouse. Fullscreen stays in Control, separately for each output. Selecting an editing target does not open a window or change a countdown.

## Existing live-show behavior is preserved

Control-only startup, combined left/right or top/bottom view, independent clocks, rundown, blackout, colors, messages, audience QR, OBS, Backstage, phone remote, Companion and OSC remain available. Network viewer links keep the combined view. Online sharing is an experimental third-party service; keep a local control path and rehearse on the actual venue network.

Close the old app before replacing it. Existing settings and rundown remain in your profile; running timers never resume automatically after relaunch. Always check the actual televisions, adapters and network before a show.

[Read the two-display guide](https://github.com/srdjankotarlic/protimer/blob/v2.4.1/docs/SEPARATE-OUTPUTS.md).

**SR:** Svaki tajmer sada ima svoj Grid, položaj, rezoluciju i veličinu cifara. U **Podesi ekran** izaberi Tajmer 1 ili Tajmer 2 — izmena jednog ne pomera drugi. Dodatni izbori pojavljuju se samo kada koristiš dva odvojena izlaza. Postojeći zajednički prikaz, podešavanja i rundown ostaju sačuvani.
