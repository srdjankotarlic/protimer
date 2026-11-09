# ProTimer v2.5.1

**Timer over your presentation — one checkbox.** Free and open source, with all existing native Stream Deck, two-timer, rundown and phone-control features retained.

## Download

- **Windows x64:** [Setup — recommended](https://github.com/srdjankotarlic/protimer/releases/download/v2.5.1/ProTimer-Setup-2.5.1.exe).
- **Mac Apple Silicon:** [DMG](https://github.com/srdjankotarlic/protimer/releases/download/v2.5.1/ProTimer-2.5.1-arm64.dmg).
- Optional [Windows portable](https://github.com/srdjankotarlic/protimer/releases/download/v2.5.1/ProTimer-2.5.1-portable.exe), [native Stream Deck plugin](https://github.com/srdjankotarlic/protimer/releases/download/v2.5.1/com.srdjankotarlic.protimer.streamDeckPlugin), and [SHA-256 checksums](https://github.com/srdjankotarlic/protimer/releases/download/v2.5.1/ProTimer-2.5.1-SHA256SUMS.txt).

The plugin and genuine editable XL profile are already included in both installers. Install Elgato Stream Deck 7.6+ first if using the controller. No Node, terminal, separate server or Companion required. Builds are unsigned: verify the source before approving OS installation prompts. GitHub's Source code archives are not installers.

## What changed

- **Timer on top:** a single checkbox beside the output controls keeps the audience timer above a presentation. **Control on top** remains independent. Uncheck to let other windows cover the timer.
- **Separate Timer 2 checkbox:** independently choose whether each of two output windows stays on top. Combined/split presentation uses the primary checkbox.
- **macOS projection fix:** use a documented higher window level and fullscreen-workspace visibility for overlays; refresh priority after placement/fullscreen transitions rather than repeatedly raising windows on clock ticks.
- **Simple and predictable:** no multi-mode dropdown. Checking/unchecking never opens an output, starts/pauses a timer, changes its position/size/Grid, or changes browser/OBS composition. Saved preferences and Control-only startup remain intact. Explicitly off stays off through Grid/transparency edits.
- **Existing functionality preserved:** T1 LIVE −/+10, −/+5 and −/+1 minute, ACTIVE/SET, one-touch native Stream Deck commands, per-timer zero bell/flashing/overtime, two displays, rundown, phone remote, QR, OBS and HTTP/OSC/Companion.

## Use it

1. Choose the audience display in Control and check **Timer on top**.
2. Click **Send to screen**. The checkbox alone deliberately does not open an audience output.
3. For a small side overlay, use Grid or apply a smaller window size and drag the window. Do not fullscreen the timer if the slide must remain visible behind it.
4. Uncheck to restore normal stacking. For separate outputs, use **Timer 2 on top** next to its send controls.

This overlays windows on the same computer, not separate video inputs to a switcher. Choose the audience display, not PowerPoint's Presenter View display. OS secure screens and exclusive GPU surfaces cannot be covered reliably by an ordinary application.

## Verification

220 local automated tests passed, plus packaged Mac regression checks. The installed Mac preview was tested over an actual PowerPoint fullscreen slide show: native order and full timer-area overlap were measured, and off/on changed foreground order correctly. A separate controlled native window reproduced StageDeck's projection level; it is not misrepresented as a physical StageDeck session. The user also confirmed the result while actual StageDeck/PowerPoint outputs were open. See the [verification guide](https://github.com/srdjankotarlic/protimer/blob/main/docs/OUTPUT-OVERLAY.md).

Release automation builds and smoke-tests the actual Mac and Windows packages before publishing. Windows CI is not a physical Windows/Stream Deck XL acceptance test. Confirm the final presentation app, display selection, audio and HDMI/switcher/TV chain before a show. No claim of universal/exclusive-surface or long-duration hardware certification is made.

## Srpski

**Novo: „Tajmer na vrhu“ — samo jedan checkbox.** Izaberi ekran, štikliraj opciju i klikni **Pošalji na ekran**. Tajmer ostaje preko prezentacije; odštikliranjem vraćaš običan redosled. Za dva odvojena izlaza Tajmer 2 ima svoju opciju. „Kontrola na vrhu“ ostaje odvojena.

Za mali tajmer sa strane koristi Grid ili manju veličinu prozora. Proveri da šalješ na ekran za publiku, ne na PowerPoint Presenter View. Sam checkbox ne otvara izlaz niti menja odbrojavanje. Sve postojeće funkcije, Stream Deck dugmad i podešavanja ostaju.

[Uputstvo SR/EN](https://github.com/srdjankotarlic/protimer/blob/main/docs/OUTPUT-OVERLAY.md) · [Stream Deck setup](https://github.com/srdjankotarlic/protimer/blob/main/docs/STREAM-DECK.sr.md)
