# Stream Deck SDK boundaries and native profile validation

Checked against official Elgato documentation and published npm packages on 2026-09-25. This document separates implemented API behavior from checks that require real Elgato software/hardware.

## Verified SDK choices

`@elgato/streamdeck` 3.0.0 and `@elgato/cli` 1.10.0 are pinned and MIT licensed. SDK's declared runtime minimum is Node 20.5.1; Stream Deck 7.0 includes Node 20.19.0. The plugin uses its bundled Node 20 and targets Stream Deck 7.0+, not ProTimer's Node development installation. SDK 3 defaults to settings behavior requiring 7.1; `useLegacySettingsBehavior=true` is enabled for compatibility and actual settings readback. [Plugin environment](https://docs.elgato.com/streamdeck/sdk/introduction/plugin-environment/), [SDK 3 upgrade](https://docs.elgato.com/streamdeck/sdk/releases/upgrading/v3/).

The plugin sets graphics through `setImage` only on its own key contexts, caches unchanged SVGs, and uses settings for persistent stable instance identities. Context is only a current-session identity, not a durable ID. User title/icon overrides have priority; the UI explains how to reset them. [Keys](https://docs.elgato.com/streamdeck/sdk/guides/keys/), [WebSocket API](https://docs.elgato.com/streamdeck/sdk/references/websocket/plugin/).

Passive bootstrap uses `streamdeck://plugins/message/com.srdjankotarlic.protimer/bootstrap?streamdeck=hidden&port=…&nonce=…`, supported from 7.0. The plugin accepts only loopback port data and one-use nonce, never an arbitrary host URL. Pairing does not switch profiles. [Deep-linking](https://docs.elgato.com/streamdeck/sdk/guides/deep-linking/). Detailed local protocol: [BRIDGE.md](../streamdeck-plugin/BRIDGE.md).

The real plugin artifact is produced by `streamdeck pack`, which validates the manifest and supporting resources. No Maker Console submission, marketplace publication, signing or license changes are performed. [Distribution](https://docs.elgato.com/streamdeck/sdk/introduction/distribution/).

## Important remaining limitation: native starter profiles

**No Elgato application or physical XL was available for this implementation's profile-authoring verification.** The official workflow is to arrange actions in Elgato and export a `.streamDeckProfile`. No officially supported headless profile creation/validation tool was established. Accordingly this build does not contain invented profile ZIPs and does not claim plug-and-play native profile installation.

The default **Standard 28 + 4 free** and **Full 32** are validated ProTimer logical JSON layouts. They are not falsely labeled native Elgato profiles. The working universal action may already be placed/configured/bound manually in Elgato. [Official profile guide](https://docs.elgato.com/streamdeck/sdk/guides/profiles/).

The SDK may switch only to a plugin's bundled profiles; it cannot switch arbitrary user profiles or query all their contents. Omitting the profile in `switchToProfile(deviceId)` requests the previous profile. That promise confirms request transmission, not the identity of the resulting profile. Visible owned actions provide limited evidence only. Control and plugin must not treat absent actions as proof a position is empty. [Profile commands](https://docs.elgato.com/streamdeck/sdk/references/websocket/plugin/#switchtoprofile).

## Required completion steps in real Elgato software

1. Install this locally built plugin on a test machine with Stream Deck 7.0+ and an XL. Do not replace or automatically select a live-show profile.
2. Create two new XL profiles in Elgato: Standard 28 + 4 free and Full 32. Place the real ProTimer Key action at the corresponding logical positions. Standard's last column must contain **no action at all**, not ProTimer inactive placeholders. Leave those profiles user-editable.
3. Set explicit bindings from ProTimer Control for each placed own action. Verify separate ACTIVE/SET LCD keys and all six adjustment labels. Export both profiles using Elgato's native Export menu.
4. Add only those verified export files to `streamdeck-plugin/com.srdjankotarlic.protimer.sdPlugin/profiles/`. Register manifest Profiles with XL `DeviceType:2`, `Readonly:false`, `DontAutoSwitchWhenInstalled:true`, `AutoInstall:false`; names omit file extensions. Register matching exact profile paths in the plugin's bundledProfiles allowlist. Do not infer any prior-profile identity.
5. Rebuild, run official `validate` and `pack`; install on a fresh test profile/machine. Confirm Elgato prompts, manual activation from Control, no timer/output side effect, explicit BACK, native editing and persistence. A passing CLI package validation alone is insufficient evidence of native-profile import or USB behavior.
6. Only after those tests change the runtime capability from `canActivate:false`. Never set the flag based only on a profile folder existing.

## Physical / OS acceptance checklist

- [ ] macOS Apple Silicon: fresh plugin install, first pairing prompt, passive reconnect, no focus theft.
- [ ] Windows x64: equivalent installation, pairing, reconnect and packaged runtime.
- [ ] XL LCD values: ACTIVE/DRAFT match Control for T1 and T2; long hours fit, count-up/clock/overtime correct; custom title/icon restoration documented.
- [ ] ACTIVE continues while adjusting SET/presets/ENTER TIME → `01:23:45`; START SET is deliberate and applied once.
- [ ] Hold RESET/BLACK/active replacement; release early, disconnect USB, change page/device and restart plugin during hold. No queued command executes later.
- [ ] Native user change of profile, app focus, USB reconnect and app restart never automatically switch profiles.
- [ ] BACK while ProTimer is closed requests the previous profile without sending a timer/output command.
- [ ] Mixed profile's four true free keys accept OBS/foreign actions and remain unchanged through logical layout edits and numeric entry.
- [ ] Native move/duplicate preserves distinct instance identities and reports actual coordinates; logical binding remains visible/rebindable. Non-visible pages are not overwritten.
- [ ] BELL sounds only on intentional press at the configured audio output; disappearance of that output warns.
- [ ] Long live run, machine sleep/wake, manual system-clock change and flaky local app/plugin link; ACTIVE keeps the host's correct time; stale LCD data becomes OFFLINE, no fake ticking.

Automated adapter tests simulate Elgato messages, not physical USB or actual profile import. Simulated-clock model tests establish arithmetic/invariants; hours of real operation, OS suspend behavior, audio routing and LCD readability still require the above hardware run.

## Srpski — šta još mora fizički da se proveri

Plugin i paket su stvarni i automatski testirani, ali pripremljeni Elgato profili još nisu izvezeni/provereni u Elgato aplikaciji. Zato je automatska aktivacija tih profila iskreno nedostupna. Do tada **ProTimer Key** postavite ručno, zatim komande uređujte u ProTimeru.

ProTimer može menjati samo podešavanja svojih postojećih akcija. Ne može postavljati novu akciju preko OBS dugmeta, pomerati tuđa dugmad ili pouzdano utvrditi naziv proizvoljnog aktivnog profila. Logički raspored nije dokaz rasporeda fizičkih akcija. Za potpuno gotov plug-and-play paket potrebno je izvršiti korake izvoza i hardversku kontrolnu listu iznad, na Macu i Windowsu.
