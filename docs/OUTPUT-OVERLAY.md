# Tajmer na vrhu / Timer on top

Introduced in ProTimer 2.5.1. The local preview verification record below distinguishes actual hardware/application checks from automated tests.

## Srpski

Pored **Pošalji na ekran** nalazi se samo checkbox **Tajmer na vrhu**:

- Štiklirano: izlaz tajmera ostaje preko prezentacije na izabranom ekranu.
- Odštiklirano: izlaz je običan prozor; prezentacija može da ga prekrije.

Nema dodatnih režima ni menija. **Kontrola na vrhu** je odvojena, postojeća opcija za Control. Ako koristiš dva odvojena izlaza, **Tajmer 2 na vrhu** je pored njegovog dugmeta za slanje. Zajednički prikaz koristi glavni checkbox. Položaj, veličina, Grid i fullscreen ostaju postojeća podešavanja. Za mali tajmer sa strane koristi Grid ili manji prozor, ne fullscreen tajmera.

Štikliranje ne otvara izlaz, ne menja vreme, veličinu ili položaj i ne startuje/pauzira brojač. Podešavanje se pamti, startup ostaje Control-only. Odštiklirano ostaje odštiklirano i uz promenu Grida/providnosti. Stara automatska podešavanja se jednom pretvaraju u odgovarajući checkbox; nema skrivenog automatskog uključivanja posle toga.

## English

Use the single **Timer on top** checkbox beside the output controls. Checked keeps the audience window above the presentation; unchecked restores ordinary window stacking. **Control on top** remains independent. Separate Timer 2 has its own checkbox next to **Send Timer 2**. No multi-mode dropdown remains. Changes preserve clocks, output geometry and Control-only startup; preferences persist. Grid/transparency cannot override an explicitly unchecked checkbox.

## Native behavior and verification

The previous preview's `floating` window level could sit below StageDeck's actual installed projection code, which uses `screen-saver`. Explicit top now uses `screen-saver + 1` on macOS, Apple's documented recommended ceiling, plus fullscreen-workspace visibility and a focus-free raise. Placement/fullscreen transitions reapply the level; ordinary clock ticks do not repeatedly raise/transform the application. Windows uses native topmost without macOS-only relative levels.

Official APIs: [window levels and moveTop](https://www.electronjs.org/docs/latest/api/base-window#setalwaysontopflag-level-relativelevel). Only audience windows use the stronger level. No presentation content, StageDeck code, settings, internal profile databases or keyboard emulation is changed.

Verified locally on 9 November 2026:

- `npm test`: **220 passed**, zero failed.
- `npm run smoke:overlay -- --disable-gpu`: real output windows, both timers, unchanged live deadlines/geometry, separate Control flag, Grid/transparency overrides, persistence/reload and SR/EN layout.
- Read-only CoreGraphics z-order test via `scripts/macos-window-order.swift`: timer at native level **1001** above a focused test window at **1000**, matching the inspected StageDeck projection level. Off/on really reverses/restores their native order. This controlled window is not misrepresented as StageDeck itself.
- **Actual Microsoft PowerPoint fullscreen slide show**: separate temporary test deck, initially no user presentations or shows open. PowerPoint reported fullscreen `true`. Native order placed the timer in front, with its entire 480 × 270 area overlapping the slide. Uncheck put it behind; recheck restored it over the focused PowerPoint. The dedicated test show was stopped and only its document closed afterward.
- Final Mac packaged **2.5.1-overlay.2** full smoke: **SMOKE_OK**, including Stream Deck, phone remote, rundown, separate outputs, quality checks and the real native z-order fixture. Initial source run reported `OUTPUT_CHANGED` during a quality capture; unchanged assertions subsequently passed in the complete packaged run. No quality guard or assertion was disabled.
- Installed Desktop app SHA-256: `fc4c51b39b20ef16465f15cec4ab98600d359b0278404b02259dfca948d3c580` (`app.asar`), exactly matching the tested package. Previous preview and user data backed up before replacement; existing user data confirmed unchanged.
- The **installed Desktop app** then repeated the actual fullscreen PowerPoint off/on test: **SMOKE_OK**, timer layer 1001, PowerPoint layer 0, full 129600 logical square pixels of overlap. The test slideshow/document were closed afterward; StageDeck was not modified or stopped. The normal ProTimer app was opened for the user.

The optional native probe is for development tests only; users do not need Swift, terminal, or a separate server. Run with `PROTIMER_WINDOW_ORDER_HELPER=/path/to/compiled/probe`; the optional PowerPoint test additionally takes the already-authorized test process PID in `PROTIMER_TEST_POWERPOINT_PID`. It does not launch or close user presentations automatically. The probe outputs only window IDs/order/layers/bounds for explicit test process IDs, never titles, content or tokens.

Windows hardware, an actual StageDeck projection session, HDMI/switcher/TV appearance and secure/exclusive GPU surfaces remain separate acceptance checks. No ordinary app can promise an overlay over OS secure/login screens or an exclusive display plane. This feature overlays windows on one computer, not separate video inputs.

The earlier native fullscreen-resize harness issue was reproduced on unmodified baseline code and corrected by establishing an on-screen restored frame before requesting fullscreen; no fullscreen/resize assertion was weakened. Local packaging uses the installed Electron distribution and `--publish never`.
