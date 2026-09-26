# Native Stream Deck control

[Srpski](STREAM-DECK.sr.md) · [SDK and packaging notes](STREAM-DECK-SDK.md)

ProTimer remains the timer application. Elgato Stream Deck software owns the USB controller; the native ProTimer plugin sends commands to the existing timer engine. It does not press keyboard shortcuts or run another countdown. Companion remains optional and its existing HTTP/OSC integration is unchanged.

## Availability in this development build

The native plugin can be built, validated and packaged. The in-app editor works with a data-only 8 × 4 layout and with ProTimer Key actions that the user places in Elgato software. **The two starter layouts are not yet verified, exported Elgato profiles.** This checkout does not pretend that an unverified ZIP is a usable `.streamDeckProfile`.

Consequently, the **Activate ProTimer profile** button remains unavailable until real exported profiles have been bundled and verified. For this build, create/select your ProTimer profile manually in Elgato, drag in ProTimer Key actions, and bind them in Control as described below. This is a working manual setup path, not a claim of completed one-click profile provisioning.

Elgato Stream Deck software/protocol registration was not found in the development environment, and a physical Stream Deck XL was not verified. A validated plugin package and simulated SDK tests are **not** proof of a physical USB test. Finish the hardware checklist below before an event or a public plug-and-play release.

## Requirements and first setup

- Windows 10 or later, x64; or macOS 13 or later, Apple Silicon, within the desktop app's supported OS range.
- Elgato Stream Deck **7.0 or later**. The plugin uses the official SDK 3 and the Node 20 runtime provided by Stream Deck. End users do not install Node.
- Stream Deck XL for the complete 8 × 4 layout. Keep Elgato software running; no separate server or Companion installation is required.

1. Open **ProTimer Control → Stream Deck**. This section is optional; the normal timer works with integration disabled or without Stream Deck installed.
2. Choose **Install / update plugin**. ProTimer opens its packaged `.streamDeckPlugin` file. Complete the installation confirmation shown by Elgato. This is not a silent installation.
3. Choose **Set up integration** and enable the connection. Pairing uses the local `streamdeck://` mechanism, with a passive link where supported. No IP address, terminal or repeatedly copied token is needed.
4. Wait for a real plugin handshake. Select the desired device if several are connected. An installed folder alone is not considered a connection.
5. For this development build, make a profile in Elgato and place **ProTimer Key** actions on the desired buttons. Leave the last column completely empty if you want the four free buttons in the mixed layout.
6. In **Edit layout**, select a logical slot, then choose its existing visible **ProTimer Key on device** and **Connect this slot**. Apply a new or changed layout before binding its slots. This links an action that you already placed; it does not insert or overwrite an Elgato/OBS action.

No profile changes on app startup, focus changes, USB reconnect or plugin restart. Turning on the connection is not the same as entering a profile. When verified starter profiles become available, **Activate ProTimer profile** is an explicit, per-device action; it must not start a timer, open an audience window or change the audience picture.

## ACTIVE and SET are different

Each timer has both states. **Timer 2 is a second timer, not the SET value of Timer 1.**

| Control | What it does |
| --- | --- |
| ACTIVE TIME | Shows the selected timer's authoritative value, T1/T2 and READY, RUNNING, PAUSED or OVERTIME. |
| SET TIME | Shows the separately prepared duration and READY/EDITING. |
| −/+ hours, minutes, seconds | Changes SET by default. Each step and unit is configurable. |
| EDIT SET / LIVE | Explicitly changes the adjustment target. Entering LIVE is protected. Returning to SET is immediate. |
| Presets | Always prepare SET, even while LIVE is selected. |
| START SET | Atomically loads the displayed SET version and starts it. Replacing a running/paused timer requires holding 1.5 seconds or explicit confirmation. |
| START / PAUSE | Starts, pauses or resumes the existing ACTIVE value. It never silently loads SET. |
| RESET | Restores ACTIVE to its last started duration. SET is kept. Protected by a 1.5-second hold/confirmation. |
| CLEAR SET | Clears only the prepared duration. |

For example, ACTIVE may continue from `08:43 RUNNING` while a `15:00 SET` is changed to `16:00`. Nothing replaces ACTIVE until **START SET**. When ACTIVE has no valid loaded duration, use SET and START SET; the command returns an explanation instead of guessing.

Switching the selected timer, restarting or losing the controller connection returns the edit target to SET. Every command captures a concrete T1/T2 target before execution, so changing the selection does not redirect a command already pressed.

### Enter 01:23:45 without a keyboard

Press **ENTER TIME**, select hours and enter `0`, `1`; select minutes and enter `2`, `3`; select seconds and enter `4`, `5`. Alternatively, enter all six digits in the initial all-fields mode. Use Backspace to correct an entry, Clear for a new entry, Apply to store SET, or Cancel to discard the input. ACTIVE remains visible and continues running. Press **START SET** separately when ready.

The plugin's temporary number page uses only its own visible action instances. It must not replace foreign buttons. If too few usable ProTimer actions are visible, complete the numeric input in ProTimer Control instead of expecting the plugin to take other buttons.

Durations are bounded from `00:00:00` to `99:59:59`; hours do not wrap at 24. Adjustment units are explicitly hours, minutes or seconds. The legacy API's units are unchanged.

## Layouts and the in-app editor

The initial **logical** layout is:

| | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | START/PAUSE | START SET | ACTIVE | SET | EDIT SET/LIVE | RESET | BELL | FREE |
| 2 | −1h | +1h | −1m | +1m | −1s | +1s | ENTER TIME | FREE |
| 3 | 5 MIN | 10 MIN | 15 MIN | 30 MIN | 60 MIN | COUNT UP | CLOCK | FREE |
| 4 | BLACK | OUT A | OUT B | TIMER 1/2 | MESSAGE | SETTINGS | BACK | FREE |

**Full 32** uses the four additional slots for PREV, NEXT, LOAD SELECTED and FULLSCREEN. COUNTDOWN is available in the command catalogue. COUNT UP and CLOCK prepare SET mode; they do not change ACTIVE before START SET. PREV/NEXT select a rundown item and LOAD SELECTED prepares it without starting it. Existing GO behavior remains separate and compatible.

In **Control → Stream Deck → Edit layout**:

1. Click a slot to edit it, never to execute it. Choose a command, target timer, label, built-in icon, color, text size and state display.
2. Configure adjustment step/unit, preset duration, shortcut and allowed press rule where relevant. Protected commands cannot be made unsafe by selecting a short press.
3. Drag to move/swap logical commands; or use the **Move** selector for keyboard-accessible reordering. Arrow keys select slots. Duplicate creates a separate logical slot identity and does not copy its shortcut.
4. **Apply** commits the validated layout atomically. **Cancel** discards editor changes. Neither operation resets a timer. Device application is reported separately from saving the layout in ProTimer.
5. Save named layouts, use Undo/Redo, or restore a default into the current editor draft. Restoring a default does not delete named layouts.
6. Import/export a validated, versioned JSON layout. Exports contain no connection tokens, audio file paths, executable scripts or arbitrary shell commands.

The board represents logical commands, not a full inventory of Elgato profiles. Reordering those commands changes what the corresponding linked ProTimer instances do; moving the actual native actions between Elgato pages/profiles remains an Elgato-editor operation. If an action is moved or duplicated there, its SDK context, position and identity are reported again; reconnect/rebind the intended visible action if needed. Different devices and pages must not be treated as interchangeable.

### Empty is not free

- **Inactive ProTimer slot:** a ProTimer Key action still exists. Use **Empty ProTimer slot** to disable its command, then fill it again later in ProTimer.
- **Truly free button / another plugin:** ProTimer does not own it. Use Elgato's editor to add ProTimer Key or to replace an existing action yourself. ProTimer does not enumerate or edit foreign actions.

The four FREE slots in the mixed template have no ProTimer placeholder. To free an owned native key for another plugin, delete that action in Elgato. Do not infer that an unreported position is physically empty: it can belong to another plugin or an inactive page.

**Simulation** is labeled separately and uses fixed sample values. It never runs a real command or rings the bell. Live readout previews elsewhere use ProTimer's actual state. Manually assigned Elgato titles/images can override plugin displays; reset the manual override in Elgato to restore the live rendering.

## Bell, outputs and shortcuts

Open **Stream Deck → Audio and shortcuts**. Choose the built-in synthesized bell or a local sound, set volume and an available output, then use **Play test bell** deliberately. The synthesized default avoids redistributing an unlicensed recording. Only one bell plays at a time; repeat presses do not stack sounds. Choosing a sound does not automatically play it or enable a zero-time alarm.

An explicitly selected output that disappears must produce an error; it must not silently route the bell elsewhere. Select an available output and run the manual test again. The system-default option is an explicit choice, not a guarantee that the OS's default hardware will never change. Available output selection depends on OS/Chromium support and permissions.

OUT A and OUT B control the existing ProTimer output windows and their configured displays. These names do not identify physical HDMI sockets. An open-window status is not proof that a remote television is showing a picture. Output open/close/fullscreen and BACK do not reset or stop a timer.

Configure executable commands' shortcuts in the layout editor. Duplicates are rejected. Local shortcuts do not execute while editing text; protected local shortcuts use a second deliberate press and ignore key-repeat. Global shortcuts are off unless explicitly enabled; Space is not registered globally. OS registration conflicts are reported. **All global commands require an explicit native confirmation dialog**, because global APIs cannot reliably distinguish holding/repeated callbacks from a new physical press. Stream Deck keys use SDK press/release events instead of emulating keystrokes. Physical protected keys always require holding; the keyboard-confirmation policy does not remove that hardware protection.

## Profile return and connection recovery

For a profile entered through a supported ProTimer profile-switch request, **BACK** requests the official return to the preceding profile. The plugin must not take control back after the user has independently switched away. The SDK does not provide a general catalogue or definitive identity of all user profiles; the UI reports visible own actions and unknown states honestly. A plugin-local BACK can work with ProTimer disconnected, but cannot stop the timer or close its outputs.

If the controller disconnects, ACTIVE continues in ProTimer. Stale/offline LCDs are labeled accordingly, timer-changing commands are blocked, held presses are canceled and commands are not replayed later. Reconnection pulls a fresh state and resets edit target to SET; it does not activate a profile.

Check the connection status in order: software found → plugin handshake → chosen connected device → visible ProTimer actions/profile. Reinstall/update the plugin if its version is incompatible. Run setup again if pairing cannot recover. Never expose or copy diagnostic pairing secrets into a support screenshot.

## Build, validation and manual acceptance

Developer commands, from the repository root:

```sh
npm test
npm run smoke
npm run check:packaging
cd streamdeck-plugin
npm ci
npm run typecheck
npm test
npm run validate
npm run package
```

The plugin package is `streamdeck-plugin/dist/com.srdjankotarlic.protimer.streamDeckPlugin`. Building the plugin is a developer step; the shipped desktop app must include the package so installation from Control does not require these commands. Do not publish a release merely because a package validates.

Before calling the integration plug-and-play, perform and record these checks on a **physical XL**, both supported desktop platforms and a clean user account:

- [ ] Install through Control; finish Elgato's actual confirmation. Pair without terminal/IP/token entry; test restart and changing bridge sessions.
- [ ] Export both starter profiles from Elgato, validate/reimport them there, bundle with automatic switching disabled, and test explicit activation/previous-profile return.
- [ ] Leave four genuine FREE keys in the mixed profile. Add a foreign action there and confirm layout edits/numeric entry never touch it.
- [ ] Run ACTIVE while changing SET/presets/modes; enter 01:23:45 entirely on the device. Test both timers and each concrete/selected target.
- [ ] Verify exact displayed versions, duplicate/reordered command handling, short-press rejection and one command per held press. Release/unplug/change page during a hold.
- [ ] Compare LCD state/color/time with Control and audience output, including long times, pause, zero and overtime. Remove custom Elgato overrides and verify recovery.
- [ ] Unplug USB, restart the plugin, stop/restart the bridge, suspend/resume, and move system time forward/back. No replay, profile takeover or interruption of ACTIVE is acceptable.
- [ ] Test named layouts, import rejection, Apply/Cancel, drag/drop, Undo/Redo, native Elgato move/duplicate, multiple pages and two connected devices.
- [ ] Select a real audio output, ring once, press repeatedly, remove that output and confirm an explicit error without fallback. Check every hotkey conflict/permission path.
- [ ] Recheck rundown/GO, OBS/browser, LAN phone control, Companion, both outputs and Control-only startup with integration enabled and disabled.
- [ ] Run an 8-hour rehearsal with state sampling, pauses and reconnects; inspect drift and memory. Also test a real machine sleep/wake. Record elapsed wall time and conditions.

Simulated clocks can verify arithmetic, bounds, confirmation expiry and behavior across artificial long intervals. They cannot establish USB stability, actual LCD latency, audio hardware routing, OS sleep behavior or native profile activation. Those results must be recorded separately, not inferred from a passing unit test.

Official constraints: [profiles](https://docs.elgato.com/streamdeck/sdk/guides/profiles/), [key rendering and override priority](https://docs.elgato.com/streamdeck/sdk/guides/keys/), [passive deep linking](https://docs.elgato.com/streamdeck/sdk/guides/deep-linking/), [SDK commands and previous-profile return](https://docs.elgato.com/streamdeck/sdk/references/websocket/plugin/), [distribution](https://docs.elgato.com/streamdeck/sdk/introduction/distribution/).
