# ProTimer v2.5.3

Fix Timer 2 visibility and choose how BLACKOUT handles your background. Thanks to Manuel (@manulaz97) for reporting both cases in #58 and #59.

## Download

- [Windows x64 Setup](https://github.com/srdjankotarlic/protimer/releases/download/v2.5.3/ProTimer-Setup-2.5.3.exe)
- [macOS Apple Silicon DMG](https://github.com/srdjankotarlic/protimer/releases/download/v2.5.3/ProTimer-2.5.3-arm64.dmg)
- [Windows portable](https://github.com/srdjankotarlic/protimer/releases/download/v2.5.3/ProTimer-2.5.3-portable.exe)
- [Native Stream Deck plugin](https://github.com/srdjankotarlic/protimer/releases/download/v2.5.3/com.srdjankotarlic.protimer.streamDeckPlugin)
- [SHA-256 checksums](https://github.com/srdjankotarlic/protimer/releases/download/v2.5.3/ProTimer-2.5.3-SHA256SUMS.txt)

Both desktop installers include the native Stream Deck plugin and editable XL profile. Stream Deck 7.6+ is required for the optional integration. Builds are unsigned.

## Timer 2 visibility

Turning off Timer 2 previously left the audience selection on T1-only. Re-enabling Timer 2 restored its control panel but the audience window and OBS still received the T1-only view.

Enabling Timer 2 now reveals both timers. A new app session starts with the enabled timers visible, discarding the previous session's hidden T1/T2 audience selection. Stream Deck LIVE T1, LIVE T2 and LIVE T1+T2 continue to select the live view within the current session. No output opens automatically on startup.

## BLACKOUT behavior

In **Colors → BLACKOUT**, choose **Black screen** or **Hide content · keep background**. The default is Black screen. The second choice hides both timers, the title, messages, NOW/NEXT, progress and QR while retaining the configured background color or transparency. A transparent OBS source therefore exposes the scene underneath instead of a black rectangle. Both timer engines continue running, and the preference is saved.

Use the BLACKOUT button again, BLACK OFF or a LIVE send command to restore the audience picture. The behavior applies to the native output, separate output windows and the browser/OBS audience source.

## Verification

The new regression first reproduced the reported off/on visibility failure. It exercises both split directions, free layout, all three Timer 2 modes, separate outputs, native and browser rendering, old saved settings, live selection, persistence, black-screen restoration, retained color and captured transparent pixels. Existing app and plugin tests and packaged Mac/Windows smoke suites run before release publication.

The tests exercise software and captured output pixels. Venue HDMI chains and physical Stream Deck USB/LCD behavior require verification on that equipment.

## Srpski

**Ispravljen Tajmer 2.** Uključivanje drugog tajmera prikazuje oba u izlaznom prozoru i OBS-u. Pri novom pokretanju uklanja se prethodni izbor samo T1/T2. LIVE komande i dalje biraju prikaz tokom rada.

**Izbor za BLACKOUT.** U sekciji **Boje → BLACKOUT** izaberi **Crn ekran** ili **Sakrij sadržaj · zadrži pozadinu**. Druga opcija skriva sadržaj za publiku uz očuvanu boju ili providnost. Odbrojavanje oba tajmera nastavlja.

[Uputstvo SR/EN](https://github.com/srdjankotarlic/protimer/blob/main/docs/FREE-AUDIENCE-LAYOUT.md).
