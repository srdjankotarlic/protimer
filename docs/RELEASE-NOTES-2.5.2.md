# ProTimer v2.5.2

Arrange the audience screen freely and control both timers from matching sections. Thanks to @manulaz97 for the reports and mock-ups in #54 and #55.

## Download

- [Windows x64 Setup](https://github.com/srdjankotarlic/protimer/releases/download/v2.5.2/ProTimer-Setup-2.5.2.exe)
- [macOS Apple Silicon DMG](https://github.com/srdjankotarlic/protimer/releases/download/v2.5.2/ProTimer-2.5.2-arm64.dmg)
- [Windows portable](https://github.com/srdjankotarlic/protimer/releases/download/v2.5.2/ProTimer-2.5.2-portable.exe)
- [Native Stream Deck plugin](https://github.com/srdjankotarlic/protimer/releases/download/v2.5.2/com.srdjankotarlic.protimer.streamDeckPlugin)
- [SHA-256 checksums](https://github.com/srdjankotarlic/protimer/releases/download/v2.5.2/ProTimer-2.5.2-SHA256SUMS.txt)

The optional Stream Deck plugin and editable XL profile are included in both desktop installers. Open Control → Stream Deck to install the plugin, confirm in Elgato, pair and activate the profile. Stream Deck 7.6+ is required. The app is free and open source. Builds are unsigned.

## Audience layout

Enable **Output window & layout → Free layout**. Select Timer 1, Timer 2, Title, Message, NOW/NEXT or Progress bar, then adjust X, Y and Size with sliders or numeric fields. Elements can cross the whole output without clipping at the old split divider. Background color and transparency are independent.

Free layout applies to the desktop audience window and browser/OBS output. Positions are saved separately from the standard split layouts. Two independently routed physical displays use their existing per-window controls.

## Timer 2 and controls

Both timers have their own Countdown, Stopwatch and Clock selection, Start/Pause, Reset, ±5m/1m/10s corrections, duration presets and End at. At-zero settings sit in each timer's section. Shared yellow/red warning thresholds sit beside the warning colors. BLACKOUT controls the audience picture for both outputs.

For the layout requested in #55, enable Timer 2, select Clock, then use Free layout to put the running countdown above the clock. Position and size edits apply while the countdown continues.

## Verification

Both Windows x64 and macOS arm64 packages passed the full functional suite in [release run 44121207874](https://github.com/srdjankotarlic/protimer/actions/runs/44121207874), together with 224 application tests and 34 plugin tests. Windows Setup also passed installation, in-place reinstallation and uninstall checks. Checks cover both timer engines, free layout and clipping, stored settings, rundown, output routing, overlays, phone/HTTP/OSC control and the Stream Deck command path.

CI verifies software behavior. Physical Windows displays, Stream Deck USB/LCD hardware, audio speakers and venue video chains require testing on that equipment. Long intervals and clock jumps are tested with a simulated clock. See the [release verification record](https://github.com/srdjankotarlic/protimer/blob/main/docs/RELEASE-VERIFICATION-2.5.2.md) for results and limits.

## Srpski

U **Izlazni prozor i raspored → Slobodan raspored** izaberi element i podesi X, Y i veličinu. Tajmeri i poruke mogu da prelaze sredinu prikaza bez odsecanja. Raspored se pamti i koristi u izlaznom prozoru i browser/OBS prikazu.

Tajmer 2 sada ima svoju sekciju sa odbrojavanjem, štopericom, satom, Start/Pauzom, Resetom, korekcijama, presetima i opcijom „Kraj u”. Svaki tajmer ima svoje opcije za minus, treptanje i zvonce na nuli. Pragovi upozorenja su uz boje.

Hvala korisniku @manulaz97 na prijavama i predlozima. [Uputstvo SR/EN](https://github.com/srdjankotarlic/protimer/blob/main/docs/FREE-AUDIENCE-LAYOUT.md).
