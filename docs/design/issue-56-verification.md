# Issue #56 verification

## Scope and authority

Implemented the shared shell and My batches overview/list against #55 and decisions #50–54. Original UI/drinks boards, not generated brand guides, supplied the composition vocabulary. Breakpoints, bowed geometry, layouts and interaction states are FermentStation adaptations. Later slices still own detailed destination redesigns. Functional checks do not prove artwork fidelity; the user judges the completed redesign.

The user approved app-design baseline changes already present in App, shared styles and tests for inclusion. Unrelated native launch, install icons, reference-image deletions, tooling and graph-cache changes remain uncommitted.

## Typography

- Preserved original Web-TT WOFF2 files for all seven 100–700 weights and the original EULA. SHA-256 compared each packaged file with the supplied original. Rights confirmation is the user's statement in #51, not an independent broader licence grant.
- `unique-font-audit.json` records actual names, weights, axes, cmap and OpenType tags. Each face contains 367 encoded codepoints and 422 glyphs, covering every character in the supplied ten-group checklist (`unique-charset.json`). Other scripts require system fallback; no claim of Greek, Cyrillic or CJK coverage.
- Reproduce binary inspection with `python scripts/audit-unique-fonts.py` (fonttools + brotli). The kit installer was run unchanged. Its auditor failed because its target strings are compared with integer cmap keys; the repository auditor instead compares Unicode codepoints. No font or kit source was modified.
- Headless Chrome's `CSS.getPlatformFontsForNode` confirmed custom Unique faces, with no system fallback, for all 70 weight/group combinations, not merely computed CSS family names. Original kit specimen reviewed alongside the equivalent complete per-weight app-font specimen.
- Browser inspection showed the starting 18px/16px scale was too small for Unique's narrow original advances. Body/forms now use 1.75rem, controls/metadata 1.5rem, headings 2–3rem. No horizontal stretching, synthesis, metric adjustment or companion interface font. At 200% text sizing the shell wraps and remains scrollable.

## Functional and browser evidence

- App-level tests cover four truthful navigation destinations, direct Settings, separate Start a batch, no-profile guidance, Overview/All batches context, search/sort/filters/selection, failed user-photo handling and origin-aware Calendar/Checks back paths.
- Existing logger/form/file/camera continuity, profile snapshots, checks, storage and editing tests remain regression coverage. Calendar stays mounted to retain its month when a batch is opened.
- Headless installed Chrome, fresh isolated context: all four destinations plus Settings checked at 1440, 1024, 1023, 768, 600, 599, 390 and 320 CSS px (40 views); no document or workspace horizontal overflow; Settings and Start a batch visible throughout. Start dialog also checked at each width without horizontal overflow. Inspected overview screenshots at 1440, 1024, 768, 390 and 320 and 390px with 200% text size.
- `/fermentStation/` production build: offline service-worker reload succeeds, all seven WOFF2 faces and the EULA are precached, and Unique remains loaded offline. PWA tests verify face hashes, packaged licence and no external font requests.
- Keyboard browser check: Tab reaches the visible skip link, Enter focuses main content, the native start dialog focuses its close control, Tab reaches Batch name, and Escape restores focus to Start a batch.
- User photos retain their data and natural rectangular framing; stand-ins are identified visibly and accessibly. Loading/failure keeps a jar fallback and layout space; failed user photos never silently become stand-ins.

## Command results

- `npm test -- --reporter=dot`: **199 tests passed across 14 files**, run from an isolated copy of the staged snapshot so unrelated working-tree changes cannot mask failures.
- `npm run typecheck`: passed; regularly rerun during implementation.
- `npm run build -- --base=/fermentStation/`: passed; browser offline, glyph and width checks used this deployment shape.
- `npm run build -- --base=./` and `npx cap sync android`: passed. Updated shared web assets and fonts copied into the Android project; no emulator/device execution claimed.
- Final shared-style/PWA checks: **27 tests passed**, covering the small contrast/relative-type adjustments made after the full-suite run. Final browser checks also passed against the staged-snapshot production build, independently of unrelated user files.

## Independent review

- Standards: no documented violations; one heuristic concern in the approved pre-existing profile-validation baseline (message-text-based field routing). A structured validator redesign is outside this shell slice and was not added.
- Spec: one keyboard-focus defect after selecting a batch through a multi-batch day picker. Fixed with focusable origin-heading fallbacks, with a red/green app regression for Calendar and overview. Reviewer rechecked the fix and confirmed resolution.
- An initial focused test invocation hit a 20-second shell timeout while other browser/type checks ran concurrently. Its isolated rerun passed. Complete failure/timeout output was retained in the session's temporary logs.

## Limits

No physical Android/iOS device or packaged Tauri runtime, screen-reader session, on-screen keyboard, browser-native zoom gesture, or unusual foldable safe-area hardware was exercised. CSS text sizing at 200% and width adaptation are not equivalent to every platform's accessibility settings. Unique remains an unusually condensed typeface by explicit user choice; all-script readability is not claimed. No automated fidelity gate or intermediate user visual approval is required.
