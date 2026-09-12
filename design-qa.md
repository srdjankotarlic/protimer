# ProTimer 2.3.0 — restrained Control polish

## Scope and visual truth

Preserve the existing application, two-column layout, panel order, controls and workflow. Improve finish and legibility only; the user explicitly rejected a new navigation/layout concept.

- Source visual truth: [before Control](docs/qa/2.3.0/control-before.png), captured from the app before the CSS polish.
- Rendered implementation: [after Control](docs/qa/2.3.0/control-after.png).
- Compact implementation: [820px English Control](docs/qa/2.3.0/control-compact.png).
- Main comparison: both 1120 × 968 pixels, 1120 × 968 CSS viewport, 1× density; no scaling or normalization.
- State: Serbian, idle 10-minute countdown, output closed, same five sample cues, schedule/editor collapsed. Before and after were opened together in the same comparison input.
- Additional coverage: 820 × 968 and 1120 × 968 in Serbian and English; network/settings scrolled view; duration picker and running rundown inspected in native Electron.
- The original-size 1120px captures were readable, including the narrow rundown, so no separate enlarged region was needed. QR/token screenshots are not published.

## Findings and comparison history

No actionable P0/P1/P2 visual differences remain. Intentional changes: graphite surfaces, quieter green actions, stronger small-label contrast, native dark inputs/checkboxes, matching button fonts and keyboard focus.

The main grid remains 767px + 300px at 1120px and 467px + 300px at 820px. Cue rows remain 92px high and scroll independently. Text metrics shift some boundaries by 1–3px, acceptable for this polish. Section order, preview size, controls and content are unchanged.

Initial and final comparisons retained the original composition. Hover specificity was tightened during implementation so selected tabs remain blue, pause remains amber and cue selection does not acquire a second button fill. Native running/hover and duration-focus states were then inspected again.

## Required surfaces

- **Typography:** existing system text and SF Mono/Menlo timer families preserved. Buttons now inherit the system family. Labels have less tracking and improved contrast; cue titles still wrap to two lines.
- **Spacing/layout:** original grid, padding, preview height, panel order and breakpoints retained. No new sidebar. Horizontal overflow was zero at both widths and languages.
- **Colors/tokens:** neutral graphite and no neon glow. Tests verify at least 4.5:1 for normal text/action labels and 3:1 for focus rings on their surfaces.
- **Assets:** no images, logos or icons replaced or approximated. Native controls now use dark color-scheme styling.
- **Copy/content:** the CSS pass changes no application labels, DOM or scripts. Separate rundown/network improvements are documented in the operator guide.
- **States/accessibility:** keyboard focus across buttons, fields and disclosures; reduced decorative transitions for reduced-motion preference. Deliberately enabled timer/message warning flashes remain available. Disabled controls stay disabled without hover fill.

## Verification

- `npm test`: 14 passed, including palette/focus regression checks.
- `npm run check:public-docs`: passed for 2.3.0.
- `npm run check:packaging`: passed against previously published binaries during preparation; manifests update only after new assets exist.
- `npm run smoke -- --disable-gpu`: passed, including startup, output, rundown, network, keyboard and responsive checks.
- `PROTIMER_TEST_ONLINE=1 npm run smoke -- --disable-gpu`: passed with actual Cloudflare HTTPS commands and tunnel shutdown. This is not proof of connectivity on every physical phone/venue network.
- Native interaction: entered 12 minutes with keyboard confirmation; Start rundown switched to the first cue and Pause state without opening the audience window.
- No renderer errors reported in the isolated preview. Development-only capture entry point removed.

## Release verification and limitations

Packaged Mac/Windows builds and installation checks are recorded by the public Release workflow. No native Windows manual visual QA is claimed here. Physical-phone and venue-firewall checks remain an operator responsibility.

## Implementation checklist

- [x] Preserve layout and controls.
- [x] Compare real before/after captures at matching size and state.
- [x] Verify native interaction, narrow layouts and SR/EN.
- [x] Run local behavior, palette and sharing regressions.
- [x] Document platform/network limitations.

final result: passed
