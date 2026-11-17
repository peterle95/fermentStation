# Issue #58 verification

## Scope

Redesigned batch detail, timeline and observation logging against #58 and parent #55. The original Swipe UI/drinks artwork remains the visual authority. Black grounds, bowed white islands, pastel imagery, dark reading capsules, circular utilities and a lime observation action reuse the shared interface system. Geometry and responsive behavior are app adaptations, not recovered source CSS. Final visual fidelity remains the user's judgment.

No new photographs, fonts, dependencies, domain rules or storage formats were introduced. Existing stand-ins retain their visible labels and Wikimedia licence credits; detail now exposes those credits directly. User photographs retain their bytes and natural framing. Native launch/icon changes, other asset changes and unrelated working-tree work are not included.

## Behavior

- Default detail exposes batch identity, actual start date/day, dated pH and temperature observations, next/due checks and paused/no-check explanations. Missing readings are not replaced with guidance values.
- One permanent logger supports the existing basic, advanced, edit, date, status, reading, note, caption and photo flows. Advanced options promote the same form; an existing basic note/temperature draft carries forward. Optional advanced context is saved as a separate dated note in the same update, without changing stored entry shapes.
- Closing the modal retains its draft. Explicit discard, replacement by another timeline edit, selecting another batch, batch deletion, starting a new batch and abandoning a changed recurring-check editor require confirmation when they would lose work. Browser unload also warns about unsaved work.
- Shared snapshots check whether the selected batch or an actively edited timeline/check/input/calculation item would disappear. Declining retains drafts and exposes a storage warning. Unrelated observations survive retained-batch updates.
- Explicit discard cancels pending photo persistence and camera results. Intentional submitted-photo saves still survive batch switching and newer drafts without overwriting concurrent checks or moving focus.
- Loading/failed imagery retains a jar fallback and reserved space. Detail and timeline photographs can be retried; failed user photos are never silently replaced by stand-ins. File-read and camera failures are announced inside the logger without resetting its draft.
- Existing list filters/search/sort, Calendar month and Checks back paths, batch management and timeline edit/delete/restore remain available. Narrowing a focused desktop editor keeps that same pane visible without moving its DOM or focus.

## Checks

- TDD skipped as requested; focused app regressions were added after implementation.
- Typecheck passed repeatedly. Production build with `/fermentStation/` base passed from an isolated export of the staged snapshot, excluding unrelated local changes.
- `npm test -- --reporter=dot --maxWorkers=1 --testTimeout=15000`: **228 tests passed across 15 files**, from the isolated staged snapshot. This run includes all existing workflow, domain, persistence, archive, platform and PWA regressions, plus the new draft-safety tests.
- Headless installed Chrome against that staged production build: 1440, 1024, 1023, 768, 600, 599, 390 and 320 CSS pixels, each at 100% and 200% text sizing. All 16 detail checks had no document/detail horizontal overflow or horizontally clipped controls.
- Browser checks retained the exact logger/file nodes, file selection and focused textarea across modal resizing; Escape restored the observation trigger. An inline desktop draft remained focused and visible when narrowed without an explicit batch-open action. Declining and accepting native discard confirmation kept/switched the selected batch as expected. No page errors. An observation toast found overlapping phone navigation was constrained to the grid's explicit content row.
- Inspected detail screenshots at 1440, 1024, 390 and 320 with enlarged text, the timeline at 390, the basic logger at 1440, and the advanced photo logger at 390. Local browser evidence and complete command/failure logs are under the session's `Temp/opencode/issue58-*` paths; these are not packaged app assets.

## Review

Two independent review axes checked the staged delta against the starting commit `051bc7d`.

- Standards: no documented violations. Removed a duplicated Calendar transition guard identified as a heuristic smell; recheck found no remaining findings.
- Spec: fixed snapshot replacement losing drafts, including removed checks/entries within a retained batch, and explicit discard permitting a pending photo write. Added focused regressions; independent recheck found no remaining concrete blockers.

## Limits

No physical Android/iOS device, packaged Tauri runtime, real native-camera permission/capture, OS shared-folder bridge, screen-reader session, on-screen keyboard, native zoom gesture or foldable safe-area hardware was exercised. Camera/shared-reload error paths use mocks. CSS text sizing and headless widths do not cover every accessibility/platform setting. The initial app-test command exceeded its 120-second timeout; a longer run passed. One new error-path assertion initially included an unrelated storage alert and was narrowed to its logger before passing. The default full run had three five-second test timeouts (225 passed, no assertion failures); isolated retries also hit that limit. Those three completed with a 15-second allowance. No repository timeout configuration was changed. Functional/browser checks do not establish artwork fidelity, and no mandatory marketing-page gate applies to this app slice.
