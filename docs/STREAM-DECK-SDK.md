# Stream Deck SDK boundaries and native profile validation

Checked against official Elgato documentation and published npm packages; native XL export added on 2026-10-01. This document separates implemented API behavior from checks that require real Elgato software/hardware.

## Verified SDK choices

`@elgato/streamdeck` 3.0.0 and `@elgato/cli` 1.10.0 are pinned and MIT licensed. SDK's declared runtime minimum is Node 20.5.1. The plugin uses Elgato's bundled Node 20 and now targets **Stream Deck 7.6+**, matching the genuine profile export, not ProTimer's Node development installation. `useLegacySettingsBehavior=true` remains enabled for actual settings readback. [Plugin environment](https://docs.elgato.com/streamdeck/sdk/introduction/plugin-environment/), [SDK 3 upgrade](https://docs.elgato.com/streamdeck/sdk/releases/upgrading/v3/).

The plugin sets graphics through `setImage` only on its own key contexts, caches unchanged SVGs, and uses settings for persistent stable instance identities. Context is only a current-session identity, not a durable ID. User title/icon overrides have priority; the UI explains how to reset them. [Keys](https://docs.elgato.com/streamdeck/sdk/guides/keys/), [WebSocket API](https://docs.elgato.com/streamdeck/sdk/references/websocket/plugin/).

Passive bootstrap uses `streamdeck://plugins/message/com.srdjankotarlic.protimer/bootstrap?streamdeck=hidden&port=…&nonce=…`, supported from 7.0. The plugin accepts only loopback port data and one-use nonce, never an arbitrary host URL. Pairing does not switch profiles. [Deep-linking](https://docs.elgato.com/streamdeck/sdk/guides/deep-linking/). Detailed local protocol: [BRIDGE.md](../streamdeck-plugin/BRIDGE.md).

The real plugin artifact is produced by `streamdeck pack`, which validates the manifest and supporting resources. No Maker Console submission, marketplace publication, signing or license changes are performed. [Distribution](https://docs.elgato.com/streamdeck/sdk/introduction/distribution/).

## Genuine native starter profile

The user exported the existing 32-key ProTimer XL profile through **Elgato Preferences → Profiles → Export**, using Stream Deck 7.6.0.23012 on macOS. The unchanged export is bundled at `profiles/protimer-xl-full.streamDeckProfile`. It contains only ProTimer actions, no connection secrets or foreign controls. Build/tests inspect bounded ZIP metadata and pin SHA-256 `e86a1cecc8535f87987e8925f7e95c24aeae331afac0ef8fad20f4e301fa9fe3`; they do not invent or rewrite native profile databases.

The manifest registers editable XL Full 32 with `DeviceType:2`, `Readonly:false`, `DontAutoSwitchWhenInstalled:true`, `AutoInstall:false`. Installation is requested only by explicit activation from Control and may require Elgato confirmation. Capability is reported through the connected plugin's allowlisted inventory, not inferred from a folder. **Standard 28 + 4 free** remains a logical JSON layout, not a second native profile. To make a mixed physical profile, duplicate Full 32 in Elgato and remove its last-column actions. [Official profile guide](https://docs.elgato.com/streamdeck/sdk/guides/profiles/).

The SDK may switch only to a plugin's bundled profiles; it cannot switch arbitrary user profiles or query all their contents. Omitting the profile in `switchToProfile(deviceId)` requests the previous profile. That promise confirms request transmission, not the identity of the resulting profile. Visible owned actions provide limited evidence only. Control and plugin must not treat absent actions as proof a position is empty. [Profile commands](https://docs.elgato.com/streamdeck/sdk/references/websocket/plugin/#switchtoprofile).

## Activation and return boundaries

Control sends only the exact registered bundled-profile path on a connected XL. An acknowledgement means the SDK request was sent, not that Elgato's confirmation was accepted or the active profile identity was proved. Timer commands and output routing are not involved.

Control's previous-profile return becomes available only after an acknowledged manual activation produces a new visible set of 32 own contexts. A session, USB, page or action-lifecycle change revokes this conservative return lease; it never reappears merely because the old contexts become visible. If identity cannot be established, choose the desired profile directly in Elgato. A deliberately configured BACK key uses the SDK previous-profile request and remains available offline.

Remaining acceptance: clean-machine first install/reimport on both target platforms and physical XL checks below. A passing CLI package validation or simulated SDK test is not proof of those scenarios.

## Physical / OS acceptance checklist

- [ ] macOS Apple Silicon: fresh plugin install, first pairing prompt, passive reconnect, no focus theft.
- [ ] Windows x64: equivalent installation, pairing, reconnect and packaged runtime.
- [ ] XL LCD values: ACTIVE/DRAFT match Control for T1 and T2; long hours fit, count-up/clock/overtime correct; custom title/icon restoration documented.
- [ ] ACTIVE continues while adjusting SET/presets/ENTER TIME → `01:23:45`; START SET is deliberate and applied once.
- [ ] Native one-touch mode: a short press executes RESET/BLACK/active replacement immediately and once. Keep a key down, repeat keyDown, disconnect USB, change page/device and restart plugin; no auto-repeat or queued command executes later. Older app modes retain hold protection.
- [ ] Native user change of profile, app focus, USB reconnect and app restart never automatically switch profiles.
- [ ] BACK while ProTimer is closed requests the previous profile without sending a timer/output command.
- [ ] Mixed profile's four true free keys accept OBS/foreign actions and remain unchanged through logical layout edits and numeric entry.
- [ ] Native move/duplicate preserves distinct instance identities and reports actual coordinates; logical binding remains visible/rebindable. Non-visible pages are not overwritten.
- [ ] BELL sounds only on intentional press at the configured audio output; disappearance of that output warns.
- [ ] Long live run, machine sleep/wake, manual system-clock change and flaky local app/plugin link; ACTIVE keeps the host's correct time; stale LCD data becomes OFFLINE, no fake ticking.

Automated adapter tests simulate Elgato messages, not physical USB or actual profile import. Simulated-clock model tests establish arithmetic/invariants; hours of real operation, OS suspend behavior, audio routing and LCD readability still require the above hardware run.

## Srpski — šta još mora fizički da se proveri

Plugin sadrži pravi XL Full 32 profil izvezen kroz Elgato 7.6. Profil se aktivira samo namernim klikom u kontroli, uz prvi Elgato zahtev za instalaciju. Ne postavlja se automatski pri pokretanju ili povezivanju USB-a. Tasteri ostaju izmenljivi u Elgato editoru.

ProTimer može menjati samo podešavanja svojih postojećih akcija. Ne može postavljati novu akciju preko OBS dugmeta, pomerati tuđa dugmad ili pouzdano utvrditi naziv proizvoljnog aktivnog profila. Logički raspored nije dokaz rasporeda fizičkih akcija. Prva instalacija na čistom računaru i fizička hardverska kontrolna lista iznad moraju se proveriti posebno na Macu i Windowsu.
