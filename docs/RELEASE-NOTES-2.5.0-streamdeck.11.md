# ProTimer v2.5.0-streamdeck.11

Native Stream Deck preview: clearer LCD graphics, one-touch controls and a separately downloadable plugin with a genuine editable XL Full 32 profile. **2.4.1 remains the latest stable release.** Both ProTimer installers include the same plugin package.

## Download

- [macOS Apple Silicon — DMG](https://github.com/srdjankotarlic/protimer/releases/download/v2.5.0-streamdeck.11/ProTimer-2.5.0-streamdeck.11-arm64.dmg)
- [Windows x64 — Setup](https://github.com/srdjankotarlic/protimer/releases/download/v2.5.0-streamdeck.11/ProTimer-Setup-2.5.0-streamdeck.11.exe)
- [Windows x64 — portable](https://github.com/srdjankotarlic/protimer/releases/download/v2.5.0-streamdeck.11/ProTimer-2.5.0-streamdeck.11-portable.exe)
- [Elgato Stream Deck plugin — Windows/macOS](https://github.com/srdjankotarlic/protimer/releases/download/v2.5.0-streamdeck.11/com.srdjankotarlic.protimer.streamDeckPlugin)
- [SHA-256 checksums](https://github.com/srdjankotarlic/protimer/releases/download/v2.5.0-streamdeck.11/ProTimer-2.5.0-streamdeck.11-SHA256SUMS.txt)

The plugin is already inside the desktop installer. Open **Control → Stream Deck → Install / update plugin**, confirm in Elgato, then **Set up integration**. Choose your XL and **ProTimer XL · Full 32**, then **Activate profile**; confirm Elgato's first profile-install prompt. No Node installation, terminal, IP entry or separate server. Keep Elgato Stream Deck 7.6+ running. ProTimer supports Windows 10+ x64 and macOS 13+ Apple Silicon. Downloads are not notarized/Authenticode-signed; only use files from this repository.

## What's new

- Colored LCD surfaces, large white function icons and labels, and readable ACTIVE/SET digits. Unique screen icons distinguish T1, T2 and split T1+T2. Different icons distinguish loading, starting, resetting and clearing prepared time.
- Every native command is one tap. PAUSE and PLAY ACTIVE are separate; START SET loads and starts the prepared value atomically. LOAD READY loads without starting and refuses to interrupt a running timer.
- Six hour/minute/second corrections and presets edit SET without changing ACTIVE. Each timer has its own ACTIVE/SET. Numeric entry supports `01:23:45` without a keyboard.
- LIVE T1, LIVE T1+T2 and LIVE T2 actually open the configured output(s), using the display, split and fullscreen/window/Grid choice in Control. BLACK ON hides the picture; BLACK OFF restores it. Neither resets clocks.
- On macOS, LIVE fullscreen keeps two display windows independent of Spaces. Windows uses native fullscreen. Applied acknowledgements wait for ready outputs; no command replay after reconnect.
- Edit any ProTimer action directly in Elgato's Property Inspector or use the Control layout editor. Custom commands, names, colors, icons, targets, steps and presets remain editable.
- Release automation now includes the real official-CLI `.streamDeckPlugin` as a separate asset, checksum included, as well as inside both desktop installers.
- A genuine Elgato-exported XL Full 32 profile is included, editable and activated only by an explicit request. Control's previous-profile return is conservatively revoked after page/profile, connection or USB changes; choose the profile in Elgato when it cannot be verified.
- Fixed Windows fullscreen-restoration move notifications cancelling a requested output resize.

Integration is optional and never automatically selects a profile. It does not take USB ownership, emulate keystrokes or replace Companion. Foreign plugin buttons are not editable from ProTimer. Manual Elgato image/title overrides can hide the live graphics; clear those overrides to restore them.

See [English setup guide](STREAM-DECK.md), [Srpski](STREAM-DECK.sr.md), and [SDK limits](STREAM-DECK-SDK.md). Physical XL acceptance, clean-machine installation and a long hardware rehearsal must be checked separately; simulated SDK events are not USB tests. CI checks and packaging do not certify downstream TVs or switchers.

## Srpski

Novo probno izdanje donosi preglednija, obojena LCD dugmad i jasne ikone. Jedno dugme izvršava jednu komandu jednim dodirom. ACTIVE i SET su odvojeni za oba tajmera; priprema vremena ne dira aktivno odbrojavanje.

Plugin dolazi uz instalaciju ProTimera, a može i zasebno da se preuzme linkom iznad. U kontroli izaberi **Stream Deck → Instaliraj / ažuriraj plugin**, potvrdi u Elgato aplikaciji i klikni **Podesi integraciju**. Izaberi XL i **ProTimer XL · Full 32**, pa **Aktiviraj profil** i potvrdi prvi zahtev za instalaciju profila. Potreban je Stream Deck 7.6+. Nema terminala, Node instalacije, upisivanja IP adrese niti ručnog postavljanja 32 tastera. Profil je pravi Elgato izvoz, a tasteri ostaju izmenljivi.

LIVE T1 / oba / T2 šalju sliku prema podešavanjima u kontroli. BLACK ON sakriva, BLACK OFF vraća sliku. LOAD READY učitava bez starta; START SET učitava i pušta vreme. Sve naše tastere možeš menjati i kroz Elgato editor. Fizička XL provera i proba na čistom računaru ostaju odvojene od automatizovanih testova. Stabilno izdanje ostaje 2.4.1.
