# ProTimer 2.1.0 design QA

**Source visual truth**

- Selected control direction: `/Users/srdjankotarlic/.codex/generated_images/01a03a2f-71c6-7ab3-a64d-e44171020460/exec-3b8fab1f-8dcb-4027-ba63-329fd939921d.png`
- Legacy sections to retain: `/Users/srdjankotarlic/Desktop/Screenshot 2026-08-27 at 03.27.08.png`
- Frameless-output request: `/Users/srdjankotarlic/Desktop/Screenshot 2026-08-27 at 03.20.54.png`
- Rundown compression defect: `/Users/srdjankotarlic/Desktop/Screenshot 2026-08-27 at 04.13.13.png`

**Implementation evidence**

- Controller default/long-rundown state: `/tmp/protimer-controller-final.jpg`
- Controller duration-picker state: `/tmp/protimer-controller-final-picker.jpg`
- Controller minimum viewport: `/tmp/protimer_ctl_min.png`
- Frameless output: `/tmp/protimer-output-final.jpg`
- Audience QR output: `/tmp/protimer-output-qr.jpg`
- Full same-state picker comparison: `/tmp/protimer-design-picker-comparison.png`
- Focused rundown comparison: `/tmp/protimer-design-rundown-comparison.png`
- Focused output-frame comparison: `/tmp/protimer-design-output-comparison.png`

**Viewport and normalization**

- Electron controller window: `1120 × 740` CSS/window points; Computer Use capture: `1120 × 740` pixels (normalized 1× capture).
- Selected control source: `1560 × 1008` pixels; normalized to 740 px high for the combined comparison without changing aspect ratio.
- Output implementation: `777 × 437` CSS/window points before a successful mouse resize; Computer Use capture: `777 × 437` pixels.
- Comparisons use equal displayed heights. Density-only differences, macOS desktop background and source mock content differences were excluded from findings.

**State and full-view comparison**

- Full view compared the controller with the duration picker open, a populated rundown, the primary timer transport and retained legacy controls visible.
- The implementation preserves the source hierarchy: large centred preview, dominant transport, compact mode/duration row, full-width rundown start, scrollable rundown and network panel.
- The implementation intentionally retains the production Colors/Text, Grid, Thresholds and Message sections requested after the selected mock was created.

**Focused comparison evidence**

- Rundown: the defect source shows eleven compressed, overlapping rows. The post-fix focused comparison shows normal-height rows with readable names, durations and controls inside a bounded scroll region.
- Output: the defect source shows a native macOS title bar. The post-fix comparison shows only the black stage canvas with rounded frameless corners.
- Duration picker: the same-state comparison confirms clear hour/minute/second hierarchy, step controls, presets, confirmation and keyboard help.

**Required fidelity surfaces**

- Fonts and typography: existing SF Pro/SF Mono system stack retained; tabular timer digits, weights, hierarchy, truncation and line heights are consistent and readable. No cue text/time overlap remains.
- Spacing and layout rhythm: cards, gaps, padding, radii and compact control density follow the existing ProTimer system. `KRAJ U` and its time input wrap as one unit; at minimum width the top bar uses two rows and transport uses a clear primary row plus an adjustment row.
- Colors and visual tokens: existing dark panels, green primary actions, blue selection, amber pause and red warning states are preserved with adequate contrast.
- Image quality and asset fidelity: the control UI does not depend on raster decoration. The generated audience QR is a real SVG from the existing QR library and remains sharp at output size; no placeholder image assets were introduced.
- Copy and content: SR/EN dictionaries have matching keys; labels distinguish planned start, START RUNDOWN, GO next, viewer QR and QR removal. Import/export labels and the redundant small Start are absent.

**Primary interactions tested**

- Main and cue duration pickers, `Enter` confirmation and `Esc` cancellation.
- `START RUNDOWN` loads and starts cue 1; `GO` and `N` continue through the list.
- A 14-item rundown renders 14 equal-height rows and scrolls (`clientHeight 241`, `scrollHeight 725`, `scrollTop 485`).
- The declared `820 × 480` minimum controller window has no clipped top-bar controls or horizontal content overflow; the end-time label and field remain grouped.
- Grid placement moves only the real output; the controller preview stays full-size and centred.
- Frameless output was moved by dragging its surface and resized from `777 × 437` to `662 × 372` by dragging its corner.
- Double-click on output stays windowed; fullscreen enters/exits from the controller control.
- Viewer/backstage QR appears on output and hides correctly; a remote URL containing the control token is rejected.
- Network SSE, public long-poll, phone clock skew correction and 100-cue Backstage rendering were exercised by `npm run smoke`.

**Console/errors checked**

- No renderer JavaScript errors or failed assertions were observed.
- The final `npm run smoke` completed with `SMOKE_OK` and no renderer or assertion errors.

**Findings and comparison history**

- [P1 resolved] Rundown rows shrank and overlapped when the list grew. Fixed with non-shrinking rows, a readable minimum row height, bounded overflow and automatic reveal of newly added/imported rows. Post-fix evidence: `/tmp/protimer-design-rundown-comparison.png` and `RUNDOWN_SCROLL_OK=true`.
- [P1 resolved] Native output chrome exposed the timer as an application window. Fixed with an always-frameless BrowserWindow while preserving native mouse move/resize behavior. Post-fix evidence: `/tmp/protimer-design-output-comparison.png` and `OUTPUT_CONTROLS_OK=true`.
- [P2 resolved] Grid placement also moved and reduced the controller preview. The preview is now independent, centred and large. Post-fix evidence: `CONTROLLER_PREVIEW_OK=true`.
- [P2 resolved] `KRAJ U` could leave its input alone on the following line at 1120 px. Grouped label, separator and input into one wrapping unit. Post-fix evidence: `/tmp/protimer-controller-final.jpg`.
- [P2 resolved] At the declared 820 px minimum width, the original one-line transport clipped Blackout. The responsive transport now keeps Start, Reset and Blackout on one row with all six adjustment controls below. Post-fix evidence: `/tmp/protimer_ctl_min.png` and `CONTROL_RESPONSIVE_OK=true`.
- [P2 resolved] Duration entry and rundown start hierarchy were ambiguous. Replaced with a shared segmented picker and prominent START RUNDOWN action. Post-fix evidence: `/tmp/protimer-design-picker-comparison.png`.
- No actionable P0/P1/P2 findings remain. Differences from the selected mock are expected retained product controls or live data/state.

**Open questions**

- None.

**Implementation checklist**

- [x] Centre and enlarge controller preview independently of grid output.
- [x] Add shared main/cue duration picker.
- [x] Make rundown start prominent and preserve GO behavior.
- [x] Keep legacy operator panels and working Compact option.
- [x] Make long rundown rows fixed-height and scrollable.
- [x] Make desktop output frameless, mouse-movable and mouse-resizable.
- [x] Keep fullscreen control in Control only.
- [x] Add safe viewer/backstage audience QR output.
- [x] Run visual, interaction, responsive and smoke verification.

**Follow-up polish**

- No required follow-up. A future release may refresh the public documentation screenshots after installers are available.

final result: passed
