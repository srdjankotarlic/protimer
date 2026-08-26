# ProTimer 2.0.1

This release focuses on reliable phone viewing and public sharing.

- Public viewers now synchronise to the ProTimer computer's clock, so a phone with an inaccurate clock no longer shows the wrong remaining time.
- Share Online now prefers a bundled, verified Cloudflare Quick Tunnel and uses reliable HTTPS long-polling instead of tunnel-hostile SSE. A labelled fallback remains available when Cloudflare cannot establish a healthy route.
- Public viewer changes were measured at 76 ms from a local timer command to the remote held-poll response in the release user-flow test.
- Output, remote and Backstage rendering is rate-limited and avoids rebuilding unchanged DOM, removing the large cue-list workload that caused lag on slower phones.
- Fixed cancelled auto-advance timers, deleting the active cue, CSV delimiter detection, remembered output monitor selection and timer-changing arrow keys while a form control is focused.
- Expanded smoke coverage for time sync, public transport, long-poll delivery, phone clock skew, 100-cue Backstage rendering and the fixed timer/rundown behaviours.

Share Online remains beta and has no uptime guarantee. A public viewer can see timer and rundown data, including cue names and notes; do not include sensitive notes. For show-critical viewing, use the LAN + QR link when possible.
