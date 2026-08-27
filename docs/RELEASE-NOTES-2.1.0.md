# ProTimer 2.1.0

This release makes the operator view clearer and the audience output safer to use live.

- The timer preview in Control stays large and centred even when grid placement moves the real stage output.
- Main and rundown durations now use one clear `HH:MM:SS` picker with step controls and minute presets.
- A prominent **START RUNDOWN** button always launches the first cue; the redundant small Start and visible CSV/import buttons are gone.
- Long rundowns keep every cue at a readable fixed height and scroll inside the rundown card instead of compressing rows.
- The output window is always frameless while remaining movable and resizable directly with the mouse. Fullscreen is controlled only from Control.
- View-only Timer and Backstage QR codes can be shown directly on the audience output. Control-token URLs are rejected.
- Existing Colors/Text, Grid, Thresholds, Message, Compact, network, remote, backstage and automation controls remain available.
- Phone viewers continue to use host-clock synchronisation and rate-limited rendering; the release smoke test covers local SSE, public long-poll, clock skew and 100-cue Backstage performance.

For show-critical remote viewing, LAN + QR remains the recommended path. Share Online is still a beta third-party tunnel.
