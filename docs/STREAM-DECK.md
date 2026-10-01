# Native Stream Deck control

[Srpski](STREAM-DECK.sr.md) · [SDK and packaging notes](STREAM-DECK-SDK.md)

ProTimer remains the timer application. Elgato Stream Deck software owns the USB controller; the native ProTimer plugin sends commands to the existing timer engine. It does not press keyboard shortcuts or run another countdown. Companion remains optional and its existing HTTP/OSC integration is unchanged.

![LCD design preview — colored function keys and separate ACTIVE/SET readouts, not a USB test](stream-deck-buttons.png)

**Quick start:** the native plugin and a genuine exported **XL Full 32** profile are included in the preview desktop installer. Open **Control → Stream Deck → Install / update plugin**, confirm in Elgato, then **Set up integration → Activate ProTimer profile**. Confirm the profile's first installation if Elgato asks. A separate `.streamDeckPlugin` download is also provided. You do not need Node, a terminal, an IP address or manual placement of 32 actions. Installing/pairing is not the same as activating a profile.

Color groups help identify a function at a glance: green playback, amber pause, blue/purple presets and preparation, mint/rose plus/minus, violet bell, red hide-picture and green restore-picture. Large white icons/labels and explicit status remain readable without relying on color alone. Screen icons show 1, 2 or a split 1|2. User-selected icons and colors are retained.

## Availability in this development build

The native plugin includes **one real XL Full 32 profile exported from Elgato Stream Deck 7.6**, unmodified and integrity-checked during build. It is registered in the manifest, user-editable, with automatic installation/switching disabled. Activation happens only after an explicit Control click. No invented profile ZIP or live Elgato database editing is used.

The **Standard 28 + 4 free** template remains a logical Control layout, not a second exported native profile. To create a mixed Elgato profile, duplicate Full 32 in Elgato and delete its last-column actions yourself; those four positions then genuinely belong to you. The Control editor cannot remove a native action to make a foreign/free button. Other Stream Deck models use manually placed ProTimer Key actions, not the XL starter.

Elgato software and the user's XL profile are available on the local Mac. Installation, handshake and LCD rendering can be observed there; automated SDK tests simulate key events and are **not** proof of physical USB button operation. Finish the hardware checklist below before an event or a public plug-and-play release.

## Requirements and first setup

- Windows 10 or later, x64; or macOS 13 or later, Apple Silicon, within the desktop app's supported OS range.
- Elgato Stream Deck **7.6 or later** (the exported starter's version). The plugin uses official SDK 3 and Elgato's Node 20 runtime. End users do not install Node.
- Stream Deck XL for the complete 8 × 4 layout. Keep Elgato software running; no separate server or Companion installation is required.

1. Open **ProTimer Control → Stream Deck**. This section is optional; the normal timer works with integration disabled or without Stream Deck installed.
2. Choose **Install / update plugin**. ProTimer opens its packaged `.streamDeckPlugin` file. Complete the installation confirmation shown by Elgato. This is not a silent installation.
3. Choose **Set up integration** and enable the connection. Pairing uses the local `streamdeck://` mechanism, with a passive link where supported. No IP address, terminal or repeatedly copied token is needed.
4. Wait for a real plugin handshake. Select the desired device if several are connected. An installed folder alone is not considered a connection.
5. With XL selected, choose **ProTimer XL · Full 32 → Activate ProTimer profile**. Accept Elgato's first-import confirmation. The complete board appears without dragging 32 actions. Activation never starts a timer or opens an output.
6. Use **Edit layout** for linked keys, or select any ProTimer Key in Elgato and **Edit here / Save key** to make it independent. To link an additional manually placed action: choose its visible **ProTimer Key on device → Connect this slot**. This binds only an action you already placed; it never replaces an Elgato/OBS action.

No profile changes on app startup, focus changes, USB reconnect or plugin restart. Connecting is not entering a profile. Every activation is an explicit per-device request and does not affect the audience.

## ACTIVE and SET are different

Each timer has both states. **Timer 2 is a second timer, not the SET value of Timer 1.**

| Control | What it does |
| --- | --- |
| ACTIVE TIME | Shows the selected timer's authoritative value, T1/T2 and READY, RUNNING, PAUSED or OVERTIME. |
| SET TIME | Shows the separately prepared duration and READY/EDITING. |
| −/+ hours, minutes, seconds | Changes SET by default. Each step and unit is configurable. |
| EDIT SET / LIVE | Explicitly changes the adjustment target. Entering LIVE is protected. Returning to SET is immediate. |
| Presets | Always prepare SET, even while LIVE is selected. |
| START SET | One native Deck tap atomically loads the displayed SET version and starts it, immediately replacing running/paused ACTIVE. Keyboard/Control confirmation remains. |
| START / PAUSE | Starts, pauses or resumes the existing ACTIVE value. It never silently loads SET. |
| PAUSE / PLAY ACTIVE | PAUSE pauses ACTIVE; PLAY ACTIVE starts its already loaded value or resumes it. Neither loads SET. Explicit RESUME remains in the catalogue. |
| RESET | One native Deck tap stops and restores ACTIVE to its last started duration. SET is kept. |
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
| 1 | START SET | PAUSE | PLAY ACTIVE | ACTIVE | SET | RESET | BELL | FREE |
| 2 | −1h | +1h | −1m | +1m | −1s | +1s | ENTER TIME | FREE |
| 3 | 5 MIN | 10 MIN | 15 MIN | 30 MIN | 60 MIN | COUNT UP | CLOCK | FREE |
| 4 | TIMER 1 | TIMER 2 | OPEN A | OPEN B | BLACK ON | BLACK OFF | CLEAR SET | FREE |

**Full 32** adds LOAD READY, LIVE T1, LIVE T1 + T2 and LIVE T2. COUNTDOWN, LOAD SELECTED, SETTINGS, FULLSCREEN, PREV/NEXT and the legacy START/PAUSE and EDIT SET/LIVE remain in the command catalogue. Starter adjustments explicitly target SET regardless of the current edit mode. COUNT UP and CLOCK prepare SET mode; they do not change ACTIVE before START SET. Existing GO behavior remains compatible. An untouched old starter is upgraded; customized and named layouts are preserved.

Daily workflow: select TIMER 1 or TIMER 2, choose a preset or adjust SET, check SET TIME, then START SET. Pause and resume with their separate keys. **All native Deck commands use one tap**, including RESET, BLACK, output closing and replacement of running/paused time. There is no second press or hold. These actions are immediate: choose deliberately. ACTIVE TIME and SET TIME are read-only LCD displays, not executable commands. Imported legacy hold settings do not impose holding in this app's native one-touch mode. Older app builds retain their guarded behavior.

### Customize in Elgato

Select a ProTimer Key in Elgato. Linked starter keys show **Edit here in Elgato / Uredi ovde**. Click it, choose the command, timer, step/preset, function icon, label or appearance, then **Save key**. Only that physical key becomes independent; Control layout updates no longer overwrite it. Moving or duplicating actions uses the normal Elgato editor. Re-link deliberately from Control if you want it managed there again. Saving never executes a timer command. Custom Elgato image/title overrides still have priority over live plugin graphics.

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

Starter OPEN A and OPEN B only open the existing configured output; repeated taps never close it. The editor offers explicit Open only, Close only or legacy Open/close. Native closing is one tap. OUT B shows SET UP until Timer 2 and separate outputs are enabled. These names do not identify physical HDMI sockets. An open-window status is not proof that a remote television is showing a picture. Output open/close/fullscreen do not reset or stop a timer.

Configure executable commands' shortcuts in the layout editor. Duplicates are rejected. Local shortcuts do not execute while editing text; protected local shortcuts use a second deliberate press and ignore key-repeat. Global shortcuts are off unless explicitly enabled; Space is not registered globally. OS registration conflicts are reported. **All global commands require an explicit native confirmation dialog**, because global APIs cannot reliably distinguish holding/repeated callbacks from a new physical press. Native Stream Deck keys use real SDK events and one-touch commands. This trusted authenticated adapter policy does not remove keyboard/Control guards or existing LAN authentication.

## Profile return and connection recovery

**Return / deactivate** uses Elgato's supported previous-profile request only after a manual activation yields a new complete set of visible own actions, and only while that exact action lifecycle stays unchanged. Any subsequent profile/page/USB change or stale connection disables return rather than taking over a profile you chose. The SDK does not reveal definitive arbitrary-profile identities; if return cannot be confirmed, choose the destination in Elgato. A custom ProTimer **BACK** key remains usable without ProTimer connected; only use it on a profile entered through the plugin switch. None of these operations closes an output or stops a clock.

If the controller disconnects, ACTIVE continues in ProTimer. Stale/offline LCDs are labeled accordingly, timer-changing commands are blocked, held presses are canceled and commands are not replayed later. Reconnection pulls a fresh state and resets edit target to SET; it does not activate a profile.

Check the connection status in order: software found → plugin handshake → chosen connected device → visible ProTimer actions/profile. Reinstall/update the plugin if its version is incompatible. Run setup again if pairing cannot recover. Never expose or copy diagnostic pairing secrets into a support screenshot.

## Build, validation and manual acceptance

### READY loading and audience selection

`LOAD READY` copies the selected timer's prepared SET into ACTIVE without starting it. SET is kept. Pause ACTIVE first if it is running; the command refuses to interrupt it. Use PLAY ACTIVE afterward, or START SET for immediate loading and playback.

`LIVE T1`, `LIVE T1 + T2`, and `LIVE T2` open the actual output on the screen chosen in Control. Neither clock is stopped or restarted. Choose Together for a split view on one screen, or Separate for two destinations. The LIVE mode selector in Output window & digits chooses fullscreen or configured window/Grid. Automatic mode uses fullscreen unless Grid is enabled. Repeated presses keep a fullscreen window in place. LIVE restores the picture after blackout. Enable Timer 2 before choosing T2 or BOTH. A disconnected screen is an error, never a silent fallback to another screen.

`BLACK ON` hides the picture; `BLACK OFF` restores it. These are separate one-touch commands, not a toggle. Neither stops a timer. The legacy BLACK toggle remains in the catalogue. `PLAY ACTIVE` starts an already loaded value or resumes it without loading SET; explicit RESUME remains available for custom keys.

The full 32-key layout includes these four controls in column 8. Existing mixed/custom layouts keep their free keys. Add ProTimer Key actions in Elgato, uncheck Follow a Control layout slot, choose the function, and Save key. This edits settings only, never executes the command. Local preview 8 places these four standalone keys in the user's empty last column, leaving the other 28 keys unchanged.

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
- [ ] Reimport the bundled genuine Full 32 export on a clean account; test explicit activation and previous-profile return on both OSes. A second mixed native export is not claimed shipped.
- [ ] Leave four genuine FREE keys in the mixed profile. Add a foreign action there and confirm layout edits/numeric entry never touch it.
- [ ] Run ACTIVE while changing SET/presets/modes; enter 01:23:45 entirely on the device. Test both timers and each concrete/selected target.
- [ ] Verify exact displayed versions, duplicate/reordered commands, immediate short-tap RESET/BLACK/active replacement, and exactly one action per press even if the key stays down. Unplug/reconnect must not replay commands.
- [ ] Compare LCD state/color/time with Control and audience output, including long times, pause, zero and overtime. Remove custom Elgato overrides and verify recovery.
- [ ] Unplug USB, restart the plugin, stop/restart the bridge, suspend/resume, and move system time forward/back. No replay, profile takeover or interruption of ACTIVE is acceptable.
- [ ] Test named layouts, import rejection, Apply/Cancel, drag/drop, Undo/Redo, native Elgato move/duplicate, multiple pages and two connected devices.
- [ ] Select a real audio output, ring once, press repeatedly, remove that output and confirm an explicit error without fallback. Check every hotkey conflict/permission path.
- [ ] Recheck rundown/GO, OBS/browser, LAN phone control, Companion, both outputs and Control-only startup with integration enabled and disabled.
- [ ] Run an 8-hour rehearsal with state sampling, pauses and reconnects; inspect drift and memory. Also test a real machine sleep/wake. Record elapsed wall time and conditions.

Simulated clocks can verify arithmetic, bounds, confirmation expiry and behavior across artificial long intervals. They cannot establish USB stability, actual LCD latency, audio hardware routing, OS sleep behavior or native profile activation. Those results must be recorded separately, not inferred from a passing unit test.

Official constraints: [profiles](https://docs.elgato.com/streamdeck/sdk/guides/profiles/), [key rendering and override priority](https://docs.elgato.com/streamdeck/sdk/guides/keys/), [passive deep linking](https://docs.elgato.com/streamdeck/sdk/guides/deep-linking/), [SDK commands and previous-profile return](https://docs.elgato.com/streamdeck/sdk/references/websocket/plugin/), [distribution](https://docs.elgato.com/streamdeck/sdk/introduction/distribution/).
