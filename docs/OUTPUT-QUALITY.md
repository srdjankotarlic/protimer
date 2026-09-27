# Output quality / Oštrina izlaza

## English

ProTimer draws timer digits as native text, sized for each output viewport. It does not stretch a fixed low-resolution timer bitmap. Changing digit scale is different from changing the output window size; neither changes the video format negotiated by macOS/Windows and the HDMI device.

### Before a show

1. Select the intended output and display in Control. Send it only when ready. For two separate outputs, repeat the check for Timer 1 and Timer 2.
2. Use the existing fullscreen control for an entire audience display. Grid intentionally creates a smaller window; for example, one 3×3 cell on a 1920×1080 logical desktop is 640×360. Do not confuse that window with a low-quality fullscreen image.
3. Open **Output window & digits** and choose **Check output**. Window dimensions are logical units (DIP). A scaled/Retina display can render more than one physical pixel for each logical unit. The automatic pixel dimensions are estimates; the explicit check reports captured raster dimensions when a safe capture is available.
4. A check is a snapshot, not a continuous certificate of quality. Recheck after resizing, changing layout, moving to a different monitor or changing display settings. If digits are clipped, adjust the selected timer's scale/offset or use its existing centre/reset-layout control. Nothing is automatically resized by the diagnostic.
5. Match the computer's output format to the production system before the show. Check the switcher's actual input format, processing format and output format, then the TV's input information and zoom/overscan settings. Do not change a live production's system format as a troubleshooting experiment.

An output capture confirms the application's raster, **not** the HDMI signal, a TV panel's native resolution, image processing, a cable/extender's behavior or the viewer's final picture. No screenshot is uploaded by the diagnostic. It does not reset timers, ring the bell or open a closed output.

### Roland V-160HD

For a Full HD rehearsal, verify **MENU → SYSTEM → SYSTEM FORMAT → 1080p** and use a frame rate supported by the complete production chain. Do not assume the laptop's usual desktop refresh rate is the show format. On HDMI inputs **5–8**, **VIDEO INPUT → the selected SCALER input → EDID → 1080p** can advertise the intended input format; also verify what the computer actually sends. Confirm changes with the VALUE knob. These are setup checks, not proof of what caused a past problem.

- [Roland: system and input formats](https://support.roland.com/hc/en-us/articles/4403281876379-V-160HD-Can-I-use-different-video-formats-for-input)
- [Roland: EDID settings](https://support.roland.com/hc/en-us/articles/4403317686171-V-160HD-Is-EDID-supported)
- [Apple: TV/projector overscan and underscan](https://support.apple.com/en-us/102202)
- [Electron: logical display bounds and scale factor](https://www.electronjs.org/docs/latest/api/structures/display)

Compare the same timer on the same TV directly and through the switcher, with matching formats and picture settings. Save a lossless application capture and a photograph of the TV if the issue persists. This separates application rendering from downstream processing without guessing.

### Verification boundaries

Unit tests can exercise fractional and Retina scale factors, malformed/closed/stale diagnostics and independent Grid changes. Native macOS smoke checks exercise actual Electron viewports/captures and preservation of active timers. Mocked DPI and renderer captures do not prove a physical 4K/Retina monitor, Windows GPU rendering or a Roland/TV signal chain. Rehearse on that actual equipment.

The regression entry points are `npm test`, `npm run smoke:quality` and the complete `npm run smoke`. Smoke uses temporary user data and can move/show test windows; run it off-air, never as part of a show. The quality smoke uses the real output renderer, checks both logical and encoded capture dimensions, and verifies that closed outputs stay closed and running deadlines remain unchanged. It does not use an HDMI capture device.

## Srpski

ProTimer iscrtava cifre kao tekst u veličini izlaznog prozora — ne razvlači malu sliku tajmera. **Veličina cifara**, **veličina prozora** i **HDMI format** nisu ista podešavanja.

### Provera pre nastupa

1. Izaberi pravi tajmer i ekran. Pošalji izlaz kada si spreman; za dva odvojena ekrana proveri oba tajmera posebno.
2. Za ceo ekran koristi postojeću fullscreen komandu. Grid namerno pravi manji prozor: 3×3 na logičkom desktopu 1920×1080 daje ćeliju 640×360.
3. U **Izlazni prozor i cifre** klikni **Proveri izlaz**. Dimenzije prozora su logičke jedinice; Retina/Windows skaliranje može imati više fizičkih piksela po jedinici. Automatski prikaz rastera je procena, a ručna provera meri dimenzije snimljenog izlaza kada je to bezbedno dostupno.
4. Rezultat važi za trenutak provere. Ponovi proveru posle promene veličine, rasporeda, monitora ili njegovih podešavanja. Ako su cifre odsečene, smanji njihovu skalu ili koriguj položaj. Provera ih ne pomera sama.
5. Uskladi format računara, switchera i TV-a pre nastupa. Na TV-u proveri Zoom/Overscan. Ne menjaj sistemski format switchera usred živog programa radi probe.

Za **Roland V-160HD**, na probi proveri **MENU → SYSTEM → SYSTEM FORMAT → 1080p** i odgovarajući frame rate produkcije. Za HDMI ulaze **5–8** proveri **VIDEO INPUT → izabrani SCALER → EDID → 1080p**, potvrdi VALUE dugmetom i proveri stvarni signal sa računara. Zvanična uputstva su povezana iznad.

**Proveri izlaz ne potvrđuje kvalitet konačne slike na TV-u.** Ne resetuje tajmere, ne pušta zvonce, ne otvara zatvoreni prozor i ne šalje snimak na internet. Najbolja hardverska proba je isti tajmer na istom TV-u direktno, pa kroz Roland, uz iste formate. Ako razlika ostane, sačuvaj fotografiju TV-a i snimak izlaza aplikacije.
