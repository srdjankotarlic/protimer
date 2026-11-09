# ProTimer 2.5.1 — release verification

Release tag: `v2.5.1`, source `81ae6688dec2badd04a7f70783448214f05a2fcd`.

## Automated checks

- [Required source CI](https://github.com/srdjankotarlic/protimer/actions/runs/42638277588): Linux, native macOS and native Windows all passed, including 220 app tests, plugin build/tests/official validation and complete Electron smoke.
- [Release installer workflow](https://github.com/srdjankotarlic/protimer/actions/runs/42639109063): native Mac and Windows installers built; the actual packaged applications completed full smoke before publication. The publish job required the complete four-binary/plugin set and generated checksums before marking the release public/latest.
- `npm run check:public-docs`: passed for 2.5.1; current public download links no longer point at 2.5.0.
- `npm run check:packaging`: distribution manifests updated to the published 2.5.1 portable binary/checksum only after that release existed.
- Production-dependency audit reported one high follow-redirects finding before publication; 1.16.2 was applied and the lockfile audit returned zero production findings. This is not a full repository/Electron security audit. Unrelated dependency PRs were not merged.

The preceding source CI on `61e791e` passed all app checks. An additional Chocolatey run on the later dependency commit still downloaded the old **2.5.0** portable binary and its GUI smoke exited 1 without forwarding a detailed child log. That old-binary failure is not claimed as a 2.5.1 pass; the package manifests were subsequently advanced to 2.5.1 for a fresh install/launch/upgrade/uninstall run. No assertion or branch-protection requirement was disabled.

## Physical/application scope

See [the overlay record](OUTPUT-OVERLAY.md). The local preview was tested over an actual PowerPoint fullscreen show, including measured real native order/overlap and off/on switching. A controlled native projection-level fixture and the user's subsequent confirmation are recorded separately. A later live inspection found that only Control was open; after explicit **Send to screen**, the real timer appeared above the actual StageDeck projection. The user confirmed the desired result. This verifies the local Mac workflow, not every OS or presentation application.

Native Windows CI does not certify a physical Windows Stream Deck XL, a downstream switcher/TV or an exclusive GPU surface. No long-duration physical rehearsal or universal-overlay claim is made. The current Control-only startup and explicit output-send behavior are intentional.
