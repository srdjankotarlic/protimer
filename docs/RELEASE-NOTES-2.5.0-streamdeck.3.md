# ProTimer v2.5.0-streamdeck.3

**Prerelease.** This preview adds independent zero alerts and optional native Stream Deck controls. **2.4.1 remains the latest stable release.**

[Prerelease page and available installers](https://github.com/srdjankotarlic/protimer/releases/tag/v2.5.0-streamdeck.3) · [Stable release](https://github.com/srdjankotarlic/protimer/releases/tag/v2.4.1) · [Srpski](#srpski)

## What changed

- **Separate zero behavior for each timer:** in **Control → Warnings → At zero**, independently choose whether Timer 1 and Timer 2 count into negative time, blink, or ring at zero. Turning off negative time holds the display at red `0:00` without resetting the clock or rundown. Settings carry across Control, combined/separate outputs and phone views.
- **One deliberate alert:** each enabled countdown rings once when it reaches zero. Enabling sound after expiry does not play a late alert; simultaneous expiries share one bell. **Test bell** checks the sound without changing either timer or enabling automatic alerts.
- **A more natural bell:** the built-in sound has a short metallic strike and a 2.2-second decay. It is original synthesis, with no third-party recording or download. Existing custom sound files and selected audio routes remain available.
- **Optional native Stream Deck controls:** an Elgato SDK plugin, separate ACTIVE/SET values for both timers, numeric time entry and an 8×4 layout editor. Changing SET prepares a duration; START SET applies it deliberately. The timer works without Stream Deck hardware or an enabled integration.

## Stream Deck preview limits

Install/update the bundled plugin from **Control → Stream Deck**, then manually place **ProTimer Key** actions in Elgato's editor and bind them in ProTimer. **Verified native starter profiles are not included, and Activate ProTimer profile is unavailable.** The Standard 28 + 4 free and Full 32 layouts are logical layouts for the ProTimer editor.

Physical XL/USB/LCD behavior, native profile import/return, real audio-output routing, clean-install onboarding, sleep/wake and a long live rehearsal still require acceptance testing. No physical hardware certification is claimed. See the [setup and hardware checklist](https://github.com/srdjankotarlic/protimer/blob/v2.5.0-streamdeck.3/docs/STREAM-DECK.md).

## Verification

Local preparation passed **149 app tests**, **11 plugin tests** with TypeScript checks, official plugin validation/packaging, and the packaged macOS ARM64 regression smoke including **32 alert/overtime checks**. Bell waveform checks are silent; a muted Web Audio check confirms synthesis/start, not physical speakers.

Installers are published only after automated packaged smoke checks pass on macOS and Windows. Consult the [public workflow runs](https://github.com/srdjankotarlic/protimer/actions) for the results. Physical Stream Deck and audio-hardware acceptance remain pending. The earlier local Windows result was a cross-build, not a Windows runtime test. Local results and limitations are recorded in [Zero alerts](https://github.com/srdjankotarlic/protimer/blob/v2.5.0-streamdeck.3/docs/ZERO-ALERTS.md) and [Stream Deck verification](https://github.com/srdjankotarlic/protimer/blob/v2.5.0-streamdeck.3/docs/STREAM-DECK-VERIFICATION.md).

Close the previous app before replacing it and keep a backup of settings and rundown. Running timers do not resume automatically after relaunch. Rehearse the selected audio output and connected screens before a show.

## Srpski

**Ovo je probna verzija; 2.4.1 ostaje najnovija stabilna verzija.**

- U **Kontrola → Pragovi → Na nuli** svaki tajmer ima zaseban izbor: **Minus posle nule**, **Treptanje na / posle nule** i **Zvonce na nuli**. Bez minusa prikaz ostaje crven na `0:00`, bez resetovanja vremena ili rundowna. Podešavanja važe za kontrolu, zajednički ili odvojene izlaze i telefon.
- Zvonce se čuje jednom po isteku uključenog odbrojavanja. Naknadno uključivanje ne pušta zakašnjelo zvono; istovremeni istek daje jedno zajedničko zvonce. **Probaj zvonce** ne menja tajmere niti uključuje automatsko upozorenje.
- Ugrađeno zvonce ima metalni udar i prirodniji odjek od **2,2 sekunde**. Zvuk je originalno sintetizovan, bez tuđeg snimka ili preuzimanja. Ručno izabrani zvuk i audio izlaz ostaju dostupni.
- Opcionu nativnu Stream Deck kontrolu čine Elgato plugin, odvojeni **ACTIVE/SET** za oba tajmera, unos vremena i editor rasporeda 8×4. Promena SET-a priprema vreme; **START SET** ga primenjuje. Stream Deck nije potreban za normalan rad tajmera.

**ProTimer Key akcije za sada postavi ručno u Elgato editoru**, pa ih poveži u ProTimeru. Nema proverenih nativnih početnih profila; njihovo aktiviranje nije dostupno. Fizički XL, USB/LCD, uvoz i povratak profila, pravi audio izlazi, prvo instaliranje, sleep/wake i duga proba još zahtevaju proveru na stvarnoj opremi.

Lokalno je prošlo **149 testova aplikacije**, **11 testova plugina**, TypeScript i zvanične provere paketa, kao i puna provera upakovane macOS aplikacije sa **32 provere upozorenja i minusa**. Instalacioni fajlovi objavljuju se tek kada automatizovana provera upakovane aplikacije prođe na macOS-u i Windowsu; rezultate možeš da vidiš u [Actions](https://github.com/srdjankotarlic/protimer/actions). Raniji lokalni Windows paket bio je samo cross-build. Fizički Stream Deck i stvarni audio izlazi još zahtevaju proveru; automatizovani testovi ih ne potvrđuju.

[Uputstvo na srpskom](https://github.com/srdjankotarlic/protimer/blob/v2.5.0-streamdeck.3/docs/STREAM-DECK.sr.md) · [Detalji upozorenja na nuli](https://github.com/srdjankotarlic/protimer/blob/v2.5.0-streamdeck.3/docs/ZERO-ALERTS.md)
