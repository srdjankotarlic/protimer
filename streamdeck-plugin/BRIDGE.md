# Native plugin bridge v1

Plugin UUID: `com.srdjankotarlic.protimer`; action UUID: `com.srdjankotarlic.protimer.key`.

Electron listens on an ephemeral `127.0.0.1` port, not its public LAN server.
Bootstrap: `streamdeck://plugins/message/com.srdjankotarlic.protimer/bootstrap?streamdeck=hidden&port=PORT&nonce=ONE_USE_NONCE`.
Plugin validates the path, decimal port 1024–65535, and base64url nonce (24–256 characters). URL hostname is never accepted as input.

All bodies/results are JSON; request size must be bounded. Browser Origin requests must be rejected. Except `/pair`, every request carries `Authorization: Bearer SESSION_TOKEN`. Token/nonce are never in inventory, action settings, exports, logs or diagnostic messages. No redirects. No queued/retried commands.

| Endpoint | Body / result |
|---|---|
| POST `/pair` | `{nonce,pluginVersion:"0.1.0",protocolVersion:1}` → `{token,sessionId,protocolVersion:1}`. Consume nonce once. |
| GET `/state` | `{sessionId,sequence,state,layout,layoutRevision,instructions:[]}`. `state` is DeckModel.snapshot(), plus authoritative clock text if desired. Poll every 250 ms; plugin never counts down independently. |
| POST `/command` | `{commandId,type,timerId:"t1"|"t2",payload?,expectedActiveVersion?,expectedDraftVersion?,sequence,pressId?,deviceId}` → `{ok:true,...}` only after applied, otherwise `{ok:false,error}`. Host strips transport deviceId before command validation. |
| POST `/press` | `{command: <same complete pinned command>,deviceId}` → `{ok,pressId,holdMs}`. Host monotonic safety guard; plugin sends the same command with pressId after 1.55 s. |
| POST `/release` | `{pressId,deviceId}` → `{ok}`. Cancels on keyUp, disappear or disconnect. |
| POST `/inventory` | `{protocolVersion:1,pluginVersion,softwareVersion,devices:[{id,name,type,size:{rows,columns}}],actions:[{context,instanceId,deviceId,row,column,layoutId?,slotId?,key?}],canActivate,profiles:[],layoutRevision,profileEvidence:"visible-own-actions-only",profileUnavailableReason?}` → `{ok}`. Only connected devices and currently visible owned actions; absent actions are unknown, not free. |
| POST `/result` | `{id,ok,error?,status?,layoutRevision?}` → `{ok}` acknowledges an operator instruction once. |

Instructions: `{id,type:"activate",deviceId,profile}`, `{id,type:"back",deviceId}`, `{id,type:"applyLayout",layoutRevision}`, `{id,type:"bind",deviceId,context,instanceId,layoutId,slotId}`. Only explicit user requests produce these. The native SDK profile-switch promise means request sent, **not** proof of profile activation. Plugin reports that distinction. No profile-switch instructions on startup, focus, USB or reconnect. Binding verifies the actual visible owned instance, calls setSettings and performs an SDK round-trip getSettings before returning deviceConfirmed. Apply requires exact layoutRevision and only reports deviceConfirmed when at least one linked visible action was read back successfully. This is confirmation of native action settings, not a physical LCD/USB test.

This initial package has **no validated Elgato-exported starter profiles**. `canActivate:false`, `profiles:[]`; activation is rejected truthfully. The real universal action and offline BACK work on user-placed keys. A release cannot claim turnkey starter-profile installation until the export checklist has been completed in real Elgato software.

Each owned action persists `{instanceId,layoutId?,slotId?,slotIndex?,key?}`. Binding resolves the key ID to a logical slotIndex in the applied layout; this fixed logical position allows later Control reorder/swap to change commands without claiming native key movement. Native moves retain their binding and are reported at actual SDK coordinates; the user can explicitly rebind. An empty logical position becomes inactive, never a foreign action. Standalone actions use their own settings. Numeric entry temporarily renders only already-owned visible contexts on one device; at least 20 are required. It never places or deletes native actions.

The plugin treats a missing/stale/rejected bridge response as OFFLINE, clears local holds/numeric overlays and awaits a new bootstrap. Host periodically reissues passive bootstrap while enabled and the plugin heartbeat is absent. Session/port changes require no copied token. A new session must reset edit target to SET and discard old guards/commands.
