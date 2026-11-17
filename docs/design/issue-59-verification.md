# Issue #59 verification

## Scope

Redesigned profile browsing, guidance, the complete existing profile editor and start-batch flow against #59, parent #55 and the #50–54 handoff. The original UI/drinks boards remain the visual authority. Bowed geometry, responsive composition and form groups are app adaptations, not recovered original CSS. The user judges final artwork fidelity.

- Profiles occupy the full workspace on a black ground, with pastel bowed cards, integrated licensed stand-ins, visible stand-in labels, neutral jars and recoverable image failures. Add, view, edit and delete are directly reachable. Cards contain only saved profile facts; unset conditions are named explicitly.
- Guidance displays ordered steps, duration, temperature, every saved pH zone, inputs/defaults, calculations (including legacy formulas) and recurring checks. Starting a batch captures the selected method, including historical snapshots.
- The editor retains existing formula controls, source-unit behavior, guidance, checks, temperature, duration, pH validation and inputs/defaults. Light form islands stack at narrow widths. Removed the nonfunctional Preview action and stale at-a-glance panel; the context panel explains preserved inputs and batch snapshots instead.
- Untouched pH zones survive unrelated edits. Editing the optimal range retains other saved zones; an incomplete range is rejected beside both fields. Existing domain validation still rejects overlapping zones.
- Name has a visible, matching associated label. Save/cancel returns focus to the profile action, or Add profile for a new profile. Deletion requires confirmation and explains that existing batches remain unchanged.
- Profile and start drafts warn before destructive navigation, cancellation and browser unload. Resizing does not remount either form. Switching profiles in Start retains each profile's entered quantities. Successful saving clears the warning.
- Shared reload accepts newer collections without navigating away from a dirty draft. Start retains the method and inputs chosen when opened, even if that profile is subsequently removed from shared data. Saving uses the newest collections rather than overwriting newly received records with an older collection.
- No domain model, storage format, font, native launch asset, install icon or unrelated user change is included.

## Checks

- Red/green app regressions cover draft cancellation/navigation/unload, labelled recoverable stand-ins, pH preservation and incomplete-range validation, and newer shared records arriving during either draft.
- Further app regressions cover source-profile edit/deletion without changing the batch's method, checks or observations; retained profile-specific start inputs; explicit discard; focus restoration; and actual batch creation without a spurious discard prompt.
- Existing profile/batch domain tests: **31 passed**. Existing app tests remain regression coverage for snapshots, calculations/overrides, no-profile guidance, validation, observations and file/camera continuity.
- Final isolated full suite: **238 tests passed across 15 files**, using `npm test -- --reporter=dot --testTimeout=15000 --maxWorkers=1`.
- Typechecking passed throughout, including the isolated production build. `npm run build -- --base=/fermentStation/` passed against an isolated copy of the staged files, excluding unrelated working-tree changes.
- Installed headless Chrome against that isolated production build: profiles, populated editor, guidance and populated Start dialog checked at 1440, 1024, 1023, 768, 600, 599, 390 and 320 CSS px, each at 100% and 200% text sizing (**64 surface/size combinations**). No document/surface horizontal overflow or horizontally clipped controls. Phone and desktop screenshots inspected.
- Browser workflow checks passed for editor focus on resizing, focus after saving, start-from-profile, declined Escape preserving the draft, and successful batch creation. No page JavaScript errors observed.

## Review

**Standards:** no documented-standard violations. Extracted the duplicated guidance list. Minor heuristic suggestions about an existing test helper, repeated geometry and explicit guard clearing were not used to justify broader refactoring; guard flags must not clear before all required discard decisions succeed.

**Spec:** review identified deferred-shared-record overwrite risk, incomplete pH preservation and a label/accessibility-name mismatch. All three were corrected; the reviewer rechecked the latest staged code and confirmed resolution with no additional actionable findings.

## Timing and limits

The first app-file run exceeded a 120-second command timeout. Another run completed with one existing cadence workflow exceeding Vitest's five-second per-test limit. That exact narrow test also exceeded five seconds on the unchanged `aa00622` baseline. The final isolated full-suite invocation uses `--testTimeout=15000 --maxWorkers=1`; no permanent timeout configuration or assertions were weakened. Complete outputs are retained in the session's approved temporary directory.

No physical Android/iOS device, packaged Tauri runtime, screen-reader session, speech-input session, on-screen keyboard, native zoom gesture, unusual safe-area hardware or real multi-device shared-folder transport was exercised. Shared reload scenarios use the existing mocked platform seam. CSS text sizing is not every platform accessibility setting. No new offline/font machinery was added; existing PWA tests provide packaging regression coverage. Functional checks and screenshots do not prove artwork fidelity.
