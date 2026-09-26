# ProTimer native Stream Deck plugin — local preview

This is a real native Node/TypeScript Elgato plugin, not a HID driver or keyboard macro. Elgato owns the USB hardware; ProTimer owns all timer state. The application remains optional and standalone without Elgato.

## Current verified scope

- SDK 3.0.0 and official CLI 1.10.0, pinned in this subproject.
- Stream Deck **7.0+**, bundled Node **20**, macOS **13+**, Windows **10+**. The existing ProTimer application targets Apple Silicon and Windows x64.
- SDK 3's default cached settings behavior requires 7.1. This plugin deliberately enables its documented legacy settings behavior, keeping 7.0 compatibility and allowing real settings readback.
- One universal **ProTimer Key**, local Property Inspector, dynamically generated LCD SVG, explicit ACTIVE/SET commands and 20-key numeric overlay restricted to existing owned keys.
- Real `.streamDeckPlugin` generated and validated by Elgato CLI. No developer runtime is required on the operator's computer.
- **No validated native starter profiles yet.** This environment did not have the Elgato application or a verified attached XL. Native profile creation/import/export, USB, displays and software installation remain real-runtime checks. No fake `.streamDeckProfile` has been produced. `canActivate:false` reports this honestly.

## Build, test, validate and package

From the repository root:

```sh
npm --prefix streamdeck-plugin ci
npm --prefix streamdeck-plugin run typecheck
npm --prefix streamdeck-plugin test
npm --prefix streamdeck-plugin run validate
npm --prefix streamdeck-plugin run package
```

Output: `streamdeck-plugin/dist/com.srdjankotarlic.protimer.streamDeckPlugin`.
The package includes its compiled SDK/runtime code, icons, Property Inspector and dependency license notices. Build does not install it or switch any hardware profile. Root Electron packaging includes this installer as an extra resource; open it through Control to start the Elgato-confirmed installation flow.

## Use while native starter profiles await validation

1. Install Elgato Stream Deck 7.0+ from Elgato, then open the plugin installer via ProTimer's setup. Accept Elgato's installation prompt.
2. Enable integration in ProTimer. The host sends a passive, short-lived local pairing link. You never type an IP, port or token.
3. In Elgato, select your intended profile manually and drag **ProTimer Key** onto positions you choose. Leave the four desired free positions genuinely empty. ProTimer cannot drag actions on your behalf or overwrite foreign actions.
4. Configure a standalone key in its Property Inspector, or select the owned key in the ProTimer layout editor and explicitly bind it to a logical slot. This uses only the action's supported `setSettings` API and verifies readback.
5. An inactive owned slot is still a native ProTimer action; deleting its logical command does not make it a native free key. To reclaim it for OBS/another plugin, delete or replace it in Elgato.

Control rearranges **logical commands in linked slots**, not native Elgato action positions. A native move keeps its stable instance and logical binding. Duplicate owned keys get separate visible instance IDs and may intentionally mirror a slot; rebind to choose another. The SDK cannot inspect unknown user profiles or pages, and missing inventory positions are unknown, not proof of freedom.

`BACK` explicitly requests the SDK's previous profile and works without ProTimer running. No automatic switch happens on startup, focus, reconnect, device changes or pairing. For the complete bundled-profile workflow, follow the remaining export checklist in [SDK notes](../docs/STREAM-DECK-SDK.md).

## LCD display and safety

The plugin polls an authenticated loopback snapshot every 250 ms; it does **not** calculate countdowns. It sends only changed images. Stale or lost authoritative state becomes OFFLINE and timer commands are blocked; reconnect discards pending key holds and never replays commands. The host must reissue bootstrap after session/port changes. START SET pins both versions and target timer at keyDown and requires the host's monotonic safety guard when replacing ACTIVE.

ENTER TIME needs 20 owned keys visible on the same device. It reserves one for ACTIVE and one for entry, then h/m/s fields, digits, backspace, CLEAR ENTRY, APPLY, CANCEL and a separate CLEAR SET key. Remaining owned keys become inactive temporarily; foreign/free keys are untouched. CLEAR ENTRY changes the editing buffer, not the saved SET until APPLY. CLEAR SET clears the saved draft immediately, without resetting ACTIVE or replacing the separate entry buffer.

On physical Deck keys, protected commands always require a 1.5-second hold. An imported `confirm` press policy also maps to hold, never an unprotected short press; keyboard/global confirmation is implemented by the host where reliable keyUp is not available. The Property Inspector offers only supported short/hold choices.

User custom icons and titles in Elgato override plugin graphics. Clear the custom title and reset the icon to default in Elgato to restore live values. No plugin can guarantee overriding those user choices.

## Tests and limits

`npm test` launches the **compiled real SDK plugin process** against a simulated Elgato WebSocket peer and real loopback HTTP/DeckModel adapter. It verifies registration, SVG output, no startup profile switch, 28 owned/four untouched positions, SET-only presets, short/held RESET, BELL once, deck-only `01:23:45`, settings bind/readback and offline BACK. Additional pure tests cover frozen targets, formats, guards and stale/no-replay behavior. This is **not** a physical USB, actual Elgato installation, or Windows runtime test.

## Srpski

Ovo je pravi lokalni Elgato plugin. Podešava se u **Control → Stream Deck**, bez terminala, IP adrese i ručnog kopiranja tokena. Instalaciju potvrđujete u Elgato aplikaciji. Za sada dugmad **ProTimer Key** postavite ručno u Elgato editoru, pa ih povežite sa logičkim slotovima u ProTimer editoru. Pripremljeni nativni profili čekaju izvoz i proveru u stvarnoj Elgato aplikaciji; automatska aktivacija se ne prikazuje kao završena funkcija.

**ACTIVE** je stvarni postojeći tajmer, **SET** je odvojena priprema. Samo **START SET** prenosi pripremu u aktivni tajmer. **BACK** vraća prethodni profil bez gašenja tajmera/izlaza, čak i kada ProTimer nije povezan. Prava slobodna dugmad i tuđe akcije ne menjamo. Pre nastupa obavezno sprovedite hardversku kontrolnu listu.
