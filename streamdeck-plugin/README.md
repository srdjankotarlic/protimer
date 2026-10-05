# ProTimer native Stream Deck plugin

Included with **ProTimer 2.5.0** for Windows x64 and macOS Apple Silicon. This is a real TypeScript/Node plugin using the official Elgato SDK, not a HID driver or keyboard macro. Elgato owns USB; ProTimer owns all timer state. The app also works without Stream Deck.

## Install and use

1. Install ProTimer and Elgato Stream Deck **7.6+**. End users do not install Node.
2. Open **Control → Stream Deck → Install / update plugin** and confirm Elgato's installation prompt.
3. **Set up integration**, select the connected XL and manually **Activate ProTimer profile**. Accept the first profile-install prompt if shown.
4. Prepare SET using presets or ENTER TIME, then START SET. PAUSE and PLAY ACTIVE operate on ACTIVE. The second row is **T1 LIVE −/+10m, −/+5m and −/+1m**; it corrects the running speaker without changing SET or T2.
5. Customize linked keys in Control or choose **Edit here → Save key** in Elgato to detach and configure just that key. Saving never runs a command.

The genuine **XL Full 32** profile was exported from Elgato 7.6 and is bundled unchanged, with automatic installation/switching disabled and a pinned integrity check. Linked keys receive current commands and LCD graphics from ProTimer after pairing. Existing customized profiles are not silently reimported. Standard 28 + 4 free is a logical Control template: to create truly free physical keys, duplicate Full 32 in Elgato and delete its last-column actions yourself. ProTimer cannot replace foreign/OBS actions. Other Deck models use manually placed ProTimer Key actions.

Startup, focus changes, USB reconnect and pairing do not switch profiles. BACK is an optional custom key using the SDK previous-profile request; it works offline and never closes an output. The SDK cannot identify or edit arbitrary user profiles. [Full setup guide](../docs/STREAM-DECK.md) · [Srpski](../docs/STREAM-DECK.sr.md) · [SDK boundaries](../docs/STREAM-DECK-SDK.md).

## Build and package

SDK 3.0.0 and official CLI 1.10.0 are pinned. Elgato provides Node 20. Platform declarations are macOS 13+ and Windows 10+, subject to the desktop app's supported OS range. Legacy settings behavior remains enabled for real settings readback, not to claim an older supported Elgato version.

From the root:

```sh
npm run deck:build
npm run deck:test
npm run deck:package
npm run deck:validate
npm run smoke:deck
```

Output: `streamdeck-plugin/dist/com.srdjankotarlic.protimer.streamDeckPlugin`. The package includes compiled runtime code, icons, Property Inspector, genuine profile and license notices. Electron installers bundle it as an extra resource. Building does not install or activate it.

## LCD and command safety

Authenticated loopback snapshots are polled every 250 ms; only changed LCD images are sent. There is no independent plugin countdown. OFFLINE/STALE blocks timer writes. Reconnect never replays queued operations. START SET captures concrete timer and expected ACTIVE/SET versions and is applied atomically.

**Native commands are one tap**, including RESET, BLACK and replacement of running time; use them deliberately. Readout keys are display-only. Control/keyboard guards remain separate. One physical press executes at most once, with no auto-repeat. Explicit LIVE keys stay LIVE; presets always prepare SET. Every timer command pins T1/T2 before execution.

ENTER TIME needs 20 owned visible actions. It shows ACTIVE while entering HH:MM:SS and uses only our actions, not free or foreign keys. Apply stores SET; START SET is a separate operation. User icon/title overrides in Elgato can override live graphics; clear/reset the override there to restore the plugin display.

## Tests and limits

34 plugin tests include the compiled SDK process against a simulated Elgato peer and real local command model: all six T1 LIVE corrections, independent T2/SET, numeric entry, one-touch transport, binding/readback, free slots, stale state, no replay and offline BACK. Root smoke checks exercise the actual Electron bridge and existing workflows. Public release CI builds and smoke-launches native Mac/Windows packages before publishing.

Simulation is **not** a physical USB test or proof of clean-machine Elgato import. Complete the hardware checklist in the setup guide before a show, including multi-display output, audio routing, sleep/wake and long operation.

## Srpski

Plugin dolazi uz **ProTimer 2.5.0**. Instaliraj Elgato 7.6+, zatim u Controlu otvori instalaciju plugina, potvrdi je, poveži XL i ručno aktiviraj pravi profil sa 32 dugmeta. Ne treba terminal, Node niti Companion.

Drugi red menja **T1 LIVE −/+10, −/+5 i −/+1 minut**, bez pauziranja i bez promene SET-a/T2. Preseti i unos vremena pripremaju SET; START SET učitava i pušta, PAUSE i PLAY ACTIVE rade nad ACTIVE. Svaka izvršna native komanda radi na jedan dodir. Tastere menjaš u Controlu ili zasebno u Elgato editoru. Tuđe akcije i prava slobodna mesta se ne prepisuju. [Uputstvo i fizička provera](../docs/STREAM-DECK.sr.md).
