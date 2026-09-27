# ProTimer v2.5.0-streamdeck.4

Preview release for output-resolution diagnostics and safer display/window handling. **2.4.1 remains the latest stable release.** The optional native Stream Deck integration still requires manual action placement; verified starter profiles and physical XL acceptance remain pending.

## Download

- [macOS Apple Silicon — DMG](https://github.com/srdjankotarlic/protimer/releases/download/v2.5.0-streamdeck.4/ProTimer-2.5.0-streamdeck.4-arm64.dmg)
- [Windows x64 — Setup (recommended)](https://github.com/srdjankotarlic/protimer/releases/download/v2.5.0-streamdeck.4/ProTimer-Setup-2.5.0-streamdeck.4.exe)
- [Windows x64 — portable](https://github.com/srdjankotarlic/protimer/releases/download/v2.5.0-streamdeck.4/ProTimer-2.5.0-streamdeck.4-portable.exe)
- [SHA-256 checksums](https://github.com/srdjankotarlic/protimer/releases/download/v2.5.0-streamdeck.4/ProTimer-2.5.0-streamdeck.4-SHA256SUMS.txt)

Download an installer, not GitHub's automatic source-code archive. The current downloads are not Apple-notarized or Windows Authenticode-signed. See [first-launch guidance](https://github.com/srdjankotarlic/protimer/blob/v2.5.0-streamdeck.4/README.md#download-and-install).

## Output clarity

- Output window dimensions are explicitly logical screen units. Physical raster estimates and monitor scaling are shown separately; a Full HD window preset does not configure an HDMI signal.
- **Check output** inspects the selected desktop output without opening a closed window, starting a timer, changing its duration, playing a sound or altering the audience layout. A bounded capture checks raster dimensions where available; unavailable or oversized captures are not presented as verified.
- The check flags timer digits or text extending beyond their visible pane. It does not automatically shrink or reposition the operator's composition.
- Display changes refresh monitor information and reflow affected windowed Grid outputs. Manual window placement, fullscreen state, the other output and running timer deadlines remain independent.
- macOS background Spaces movements no longer become a new operator-selected routing target. Manual dragging still follows the chosen output.
- A resize cancelled by closing or replacing an output settles safely instead of waiting forever or resizing the replacement window.

No artificial sharpness filter, forced DPI setting, new rendering engine or HDMI mode switching is introduced. The timer is still native rendered text. ProTimer cannot inspect processing inside a switcher, cable extender or TV, or certify the final picture from a window capture.

See [Output quality and switcher setup](https://github.com/srdjankotarlic/protimer/blob/v2.5.0-streamdeck.4/docs/OUTPUT-QUALITY.md) for the pre-show check, Roland V-160HD notes and test limitations.

Local commands, results and installation details are recorded in [Output-quality verification](https://github.com/srdjankotarlic/protimer/blob/v2.5.0-streamdeck.4/docs/OUTPUT-QUALITY-VERIFICATION.md). Release installers are published only after the existing [public release workflow](https://github.com/srdjankotarlic/protimer/actions/workflows/release.yml) completes its packaged checks on macOS and Windows. Those automated checks are not physical Stream Deck, venue Wi-Fi or Roland/TV certification.

## Srpski

Probno izdanje — stabilna verzija ostaje 2.4.1. Linkovi iznad nude Mac instalaciju, preporučeni Windows Setup i prenosivu Windows verziju.

- Jasno su odvojene logička veličina prozora, procenjeni raster i skaliranje monitora.
- **Proveri izlaz** proverava izabrani postojeći izlaz bez pokretanja tajmera, otvaranja zatvorenog prozora ili menjanja slike publici. Veliki ili nedostupni snimci nisu označeni kao potvrđeni.
- Upozorenje pokazuje kada cifre ili tekst izlaze iz vidljivog prostora, bez samovoljnog menjanja njihovog položaja.
- Podaci o ekranima osvežavaju se posle promene rezolucije ili skaliranja. Grid se prilagođava svom ekranu, bez resetovanja tajmera ili premeštanja drugog izlaza.
- Automatska pomeranja prozora pri promeni macOS fullscreen prostora ne menjaju izbor izlaznog monitora.
- Zatvaranje ili zamena prozora tokom podešavanja veličine bezbedno prekida staru komandu, bez menjanja novog prozora.

Provera ne može da potvrdi obradu slike u switcheru ili TV-u. Postojeća Stream Deck ograničenja probne verzije ostaju ista; nema tvrdnje da je fizički uređaj sertifikovan.
