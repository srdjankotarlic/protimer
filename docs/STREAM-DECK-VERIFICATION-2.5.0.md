# ProTimer 2.5.0 verification — 2026-10-05

Main release: [v2.5.0](https://github.com/srdjankotarlic/protimer/releases/tag/v2.5.0). Release source: `f99535c8efc8cd1d4672d403d9acfe02aab89a4a`.

## Executed checks

| Check | Result |
| --- | --- |
| `npm test` | 214 passed locally and in release CI on native Mac/Windows runners. |
| `npm run deck:build` | Compiled the real SDK plugin and integrity-checked the unchanged genuine XL export. |
| `npm run deck:test` | TypeScript passed; all 34 tests passed, including the compiled plugin with a simulated Elgato peer. |
| `npm run deck:package` / `npm run deck:validate` | Official Elgato CLI packaged and validated plugin 0.1.0.12. |
| `npm run smoke -- --disable-gpu` | Local Electron full smoke completed with `SMOKE_OK`. |
| Packaged local Mac `ProTimer --smoke --disable-gpu` | `SMOKE_OK`; native bridge, LIVE commands, editor, zero alerts, output quality and previous workflows passed. |
| Public native Mac/Windows release builds | Both packaged apps reached `SMOKE_OK`; plugin, alerts and output-quality checks passed before publishing. |
| `npm run check:public-docs` | `PUBLIC_DOCS_OK v2.5.0`. |
| `npm run check:packaging` | `PACKAGING_OK v2.5.0`, using downloaded published checksums. |
| Downloaded release assets + `shasum -a 256 -c ProTimer-2.5.0-SHA256SUMS.txt` | DMG, Setup EXE, portable EXE and plugin all matched. |
| Default layout vs installed user's layout | Exact normalized match, including T1 LIVE −/+10, −/+5 and −/+1 minute. No user tokens, audio paths or rundown were copied. |
| `npm audit --omit=dev` | Zero reported runtime dependency vulnerabilities after the compatible Axios lockfile update. This is not a full security audit. |

Public evidence: [PR checks](https://github.com/srdjankotarlic/protimer/pull/38/checks) · [Native release workflow](https://github.com/srdjankotarlic/protimer/actions/runs/37297751570).

The new tests exercise all six T1 LIVE corrections while T2 is selected, verify a single applied operation per command ID and preserve both drafts/T2. Exact starter migrations are tested; customized SET keys remain unchanged.

## Limits

The local Mac had only one connected display. Separate-display fullscreen acceptance was explicitly skipped locally, not counted as a physical two-TV pass. Automated SDK events are not physical USB button tests. Windows CI does execute the actual packaged Windows app, but not a physical XL/Elgato clean-machine setup or a Windows Firewall dialog.

Physical LCD readability, user profile import/return, multi-device/page operation, audio-device routing, extended live operation, suspend/resume and the final HDMI → switcher → TV picture still require the [hardware checklist](STREAM-DECK-SDK.md#physical--os-acceptance-checklist). No eight-hour physical rehearsal or downstream Roland/TV certification is claimed.

## Srpski

Prošlo je 214 testova aplikacije, 34 testa plugina, zvanično Elgato pakovanje/validacija i pokretanje gotovih Mac/Windows aplikacija u release CI-ju. Svi preuzeti instaleri i plugin odgovaraju objavljenim checksum-ima. Početni raspored odgovara korisnikovom T1 LIVE redu −/+10, −/+5 i −/+1 minut.

Simulirani SDK test nije fizički USB test. Na lokalnom Macu nije bilo dva povezana TV-a, pa je ta fullscreen proba preskočena. Elgato instalaciju na čistom računaru, fizičke tastere, audio izlaz i sliku kroz switcher proveriti pre nastupa.
