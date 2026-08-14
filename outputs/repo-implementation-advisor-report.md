# FermentStation — Repository Audit & Pragmatic Engineering Recommendations

- Date: 2026-08-14
- Repository: `C:\Users\molze\GitHub\fermentstation` (branch `main`, commit `75cd618`)
- Request: "What could be improved / what is not good in this repo? What would a pragmatic engineer do?"
- Method: evidence-based audit (repository facts first, Obsidian vault guidance second, recommendations third). No source code was modified.

## Executive recommendation

The architecture is genuinely good for its stage: clean domain/platform separation, defensive storage engineering, real tests (90 passing), and a research-backed sync design. The problems are **not architectural** — they are **(1) one real data-loss hazard, (2) a live dataset accidentally tracked in git, (3) no CI, and (4) stale documentation that now contradicts the code**. A pragmatic engineer would fix those four in that order, then split the 1,755-line `App.tsx` only when a change forces it. Do not redesign the storage or sync model; it is the right v1 shape.

## Scope & assumptions

- Audit of the whole repo, focusing on code quality, data integrity, and engineering process.
- Assumed: single maintainer ("Peter"), household-scale data (tens of batches, small photo count), local-first is a hard product requirement, and manual/Syncthing file sync is the intended transport (per `research/free-sync.md:5-17` and the commits `0447463` "syncthing", `469845a` "phone reconciliation").
- Not assessed: visual design fidelity vs. the Open Design artifact, real-device Android behavior (no device available; `docs/android-desktop-implementation-gaps.md:202-211` confirms the same).

## Repository map

| Area | Files | Notes |
| --- | --- | --- |
| UI (monolith) | `src/App.tsx` (1,755 lines), `src/styles.css` (2,836 lines) | All screens/components in one file; no UI framework |
| Domain | `src/domain/{shell,profiles,batches}.ts` | No React/storage imports; formula parser without `eval` |
| Platform | `src/platform/*` | localStorage stores, native Capacitor store, SAF/Tauri shared-folder bridge, archive, reminders, camera |
| Rust bridge | `src-tauri/src/main.rs` | 5 custom commands; atomic writes, traversal protection, tmp/bak recovery |
| Data | `shared/` | Syncthing folder; `manifest.json` + `records/*.json` + `photos/` (see `docs/shared-data-format.md`) |
| Docs | `docs/`, `research/`, `prototypes/` | ADR, gap analysis, shared-data format, sync research |
| Tests | 9 files, 90 tests | Vitest + Testing Library; one Rust unit test; no CI |

## Vault guidance (Obsidian `C:\Users\molze\GitHub\Obsidian\AI`)

- `wiki/projects/fermentstation.md` — project note, updated 2026-08-12. Claims "no automatic synchronization" and localStorage-only storage; both are **outdated** (shared-folder sync and native stores exist since 2026-08-10/12). Open questions in the note (when to replace localStorage, migration strategy, native notifications) are partially answered by the current code.
- `wiki/sources/tech/fermentstation-technical-overview-2026-08-08.md` — same staleness; explicitly marked `validity: volatile`.
- Vault has no guidance that conflicts with the repo's storage/sync direction; it echoes the repo's own research.

## Evidence matrix — what is good

| # | Finding | Evidence |
| --- | --- | --- |
| G1 | Domain layer is clean and framework-free; business rules (status transitions, check scheduling, formula evaluation) live in `src/domain/` | `src/domain/batches.ts`, `profiles.ts`; no React imports |
| G2 | Hostile-data handling is seriously good: every parse path validates, normalizes, and rejects invalid records with fallback | `src/platform/batch-store.ts:22-113` (`isBatch`/`isTimelineEntry` guards), `parseBatchState` at 176-188 |
| G3 | Crash-resistant writes: temp file + fsync + rename, sibling backup, recovery of `.tmp-`/`.bak-` on next load, 64 MB file cap, `writeInProgress` manifest | `src-tauri/src/main.rs` (`atomic_write`, `recover_files`), `docs/shared-data-format.md:16-20` |
| G4 | Path-traversal protection in the Rust bridge, tested | `src-tauri/src/main.rs:126-156`, unit test `shared_paths_reject_traversal_and_absolute_paths` |
| G5 | Sync design follows its own research: never sync live DB files, file-based exchange, conflict copies surfaced but never loaded | `research/free-sync.md:5-17`, `src/platform/shared-data-store.ts:194-217` (`conflictPattern`, snapshot-reject) |
| G6 | Formula engine avoids `eval` (recursive-descent), unit-aware | `src/domain/profiles.ts` |
| G7 | Tests pass: 90/90 across 9 files; App-level workflow tests included | `npm test`, 2026-08-14 run |
| G8 | No backend, no accounts, data leaves the device only via user-chosen folder/ZIP | `src/App.tsx` Settings copy ("No data leaves this device") |

## Evidence matrix — what is not good

| # | Severity | Finding | Evidence |
| --- | --- | --- | --- |
| W1 | **High — data loss** | One unreadable/corrupt photo file voids the *entire* batch state on load. `parseNativeBatchState` returns `null` if any photo fails to read, and `App.tsx` then silently keeps the default empty state. Same all-or-nothing pattern in shared hydration. | `src/platform/native-store.ts:87-105` (catch → `return null`), `src/App.tsx:155-160`; `src/platform/shared-data-store.ts:244-262` |
| W2 | **High — repo hygiene** | The live Syncthing dataset `shared/` is tracked in git, including `.stfolder/` marker, `.stversions/` version-history files, and `migration-backup/` trees. Meanwhile the *current* canonical layout `shared/records/records/*.json` is **untracked**, and stale `shared/records/{shell,profiles,batches}.json` are tracked. A `shell.sync-conflict-*` file is sitting in the working tree. Any `git add -A` commits real household data, conflict copies, or versioning junk. | `git ls-files shared/` (stversions, migration-backup, .stfolder); `git status` (sync-conflict, nested `records/` untracked); `docs/shared-data-format.md:5-15` vs. actual layout |
| W3 | **Medium** | `index.html` references `/app_logo.png` (favicon) but `public/` is untracked — a fresh clone builds with a missing asset. | `index.html:7`, `git ls-files public/` (empty) |
| W4 | **Medium — docs lie** | `docs/android-desktop-implementation-gaps.md` (2026-08-09) says Capacitor Camera/Filesystem/Local Notifications plugins are absent and reminders unimplemented; all of it exists today. Vault project note is stale the same way. Agent-driven development treats these docs as ground truth (AGENTS.md), so this actively misleads. | `package.json:19-27` (plugins present), `src/platform/{camera,reminders,native-store}.ts`, vs. `docs/android-desktop-implementation-gaps.md:27-44` |
| W5 | **Medium** | No CI, no lint config, no enforced typecheck. `npm run build`/`test` work locally but nothing gates regressions; the only Rust test never runs in any automated flow. | no `.github/`; `package.json:6-17` (no `lint` script); `src-tauri/src/main.rs` test exists |
| W6 | **Medium — fragility** | UI is a 1,755-line `App.tsx` + 2,836-line `styles.css`. `BatchView` is rendered twice with duplicated props (Today/Batches) — the kind of duplication that already shows drift (misaligned indentation, `mode` handling). Persistence calls repeat the same 3-step pattern in 5 places. | `src/App.tsx:310-356` (two near-identical `BatchView` blocks), `src/App.tsx:195-238` (save pattern duplicated in `saveProfiles`, `navigate`, `updatePreferences`, `saveBatches`, formula-terms handler) |
| W7 | **Medium — offline inconsistency** | Packaged desktop app loads Google Fonts over the network while the Tauri CSP only allows `'self'` for styles/scripts. The `<link>` to `fonts.googleapis.com` is blocked by CSP in the packaged app (silent font fallback) yet works in `vite dev` — and the app phones a CDN it claims it doesn't need. | `index.html:8-10` vs. `src-tauri/tauri.conf.json` CSP |
| W8 | **Low** | Version drift: `0.1.0` (package.json, tauri.conf) vs. "v1.0-concept" (Settings). `android/.idea/` and prototype `.file-versions/` tracked. `AFK_AGENT_LOG.md` is a stale 9-line log of closed issues. | `package.json:4`, `src-tauri/tauri.conf.json:3`, `src/App.tsx:649`, `git ls-files` |
| W9 | **Low** | No schema migration framework: `schemaVersion !== 1` rejects the whole snapshot; every future schema change is a hard cutover. Fine while data is disposable; needs a stated policy. | `src/platform/shared-data-store.ts:204-206`; vault open question agrees |
| W10 | **Low** | Sync conflicts are detected and surfaced but resolution is external (manual file surgery). Acceptable v1; should be documented as a known limit, not silently left. | `src/App.tsx:592-597` (notice only) |

## Candidate approaches

Because the findings are independent, they are presented as per-finding options rather than competing architectures. The one real fork is **where the data-loss fix lives**:

### A. Fix photo hydration fail-soft (recommended)
Per-entry fallback in the two hydration paths: if a photo file is missing/corrupt, drop just that entry's photo data (keep the entry, or skip it) instead of nulling the whole state; log the dropped path so the user can be told.

- Files: `src/platform/native-store.ts:87-105`, `src/platform/shared-data-store.ts:244-262`, tests in both `*.test.ts`.
- Fit: smallest change at the actual trust boundary; root-cause fix (the shared folder path has the same bug waiting to bite).
- Risk: low; behavior only changes on corruption, where the current behavior is already wrong.
- Reversibility: trivially reversible.

### B. All-or-nothing with explicit error (alternative)
Keep strictness, but surface the failure as a visible "storage problem" state on native instead of silently showing an empty dataset. More code (new status plumbing into `App.tsx`), still leaves the user unable to open their data — strictly worse outcome for the same effort. Rejected.

### C. Data-store unification (deferred, not now)
Extract a single `persistX(shell|profiles|batches)` facade so the 5 duplicated save sites become one call. Worth doing during the `App.tsx` split (W6), not before.

## Recommendation — what a pragmatic engineer would do, in order

1. **Fix W1 (today, ~30 min).** Make photo hydration fail-soft per entry in `native-store.ts` and `shared-data-store.ts`, add one test each for "missing photo file keeps the rest of the state". This is the only finding that can destroy a user's dataset.
2. **Stop tracking the live dataset (today, ~10 min).** Add `shared/` (minus a committed fixture or README) to `.gitignore`; `git rm -r --cached shared/`; keep one small sample `shared/README.md` explaining the layout so a clone still documents the format. Optionally keep `shared/records/*.json` only as test fixtures. Never let Syncthing junk or real records enter history again.
3. **Add minimal CI (~1 hour).** One GitHub Actions workflow: `npm ci`, `npm run typecheck`, `npm test`, `npm run build`. Add `cargo test` in `src-tauri` as a second job. No lint tooling until the repo has a style guide — the existing scripts are the contract.
4. **Fix the docs that lie (~30 min).** Update `docs/android-desktop-implementation-gaps.md` to "resolved" status (or replace with a short current-state section), and refresh the vault project note. Add one sentence to the gap doc: notifications, camera, native store, and shared-folder sync are implemented since 2026-08-12.
5. **Align fonts with the offline claim (~30 min).** Either vendor the three fonts (Karla, IBM Plex Mono, Source Serif 4) under `public/` and reference them locally — matching the CSP — or explicitly allowlist `fonts.googleapis.com`/`fonts.gstatic.com` in the Tauri CSP and drop the "no data leaves this device" phrasing. Vendoring is the better fit for the product's stated privacy stance.
6. **Split `App.tsx` mechanically, when next touched (~1-2 hours).** Extract `BatchView/BatchCard/CalendarView/SettingsView/Profiles` into `src/ui/` with zero behavior change; the 19 `App.test.tsx` workflow tests are the safety net. Consolidate the two `BatchView` render sites and the 5 duplicated save patterns while moving code (C). Do not introduce routing, state libraries, or a CSS framework.
7. **Housekeeping (30 min, whenever).** Commit or revert the modified Android icon/Cargo artifacts deliberately; drop `android/.idea/` from git; delete `AFK_AGENT_LOG.md` or fold it into issue-tracker docs; track `public/` so the favicon builds; unify the version string.

## Test strategy

- After step 1: extend `native-store.test.ts` and `shared-data-store.test.ts` — "state with one broken photo reference loads with the remaining records intact, entry survives without photo".
- After step 6: rely on the 90 existing tests (19 App-level workflow tests cover the rendered behavior end-to-end); `npm test` and `npm run typecheck` must stay green.
- CI gates: `typecheck` + `test` + `build` (+ `cargo test`) on push/PR. Device testing remains manual per `docs/android-desktop-implementation-gaps.md:177-187` (cold launch, force-stop, SAF picker, notification permission) — out of scope for this pass.

## Risks & open questions

- The migration UX ("Use shared folder data / Use this device's data") is exercised only in unit tests; no device-level verification of the SAF rename path exists (`docs/shared-data-format.md:18` acknowledges SAF's non-atomic renames). Keep `writeInProgress` and recover logic — do not simplify it.
- Conflict resolution stays manual; if the household ever edits the same batch on two devices, someone must delete a `.sync-conflict-*` file. Acceptable for v1; a conflict-picker UI is the upgrade path, not now.
- Schema changes (W9): decide now that any schema change bumps `schemaVersion` and ships a one-way export→import migration, or accepts data reset for pre-1.0. Recommendation: accept reset until the app has real users; the export/import ZIP already exists as the escape hatch.
- The vault should be updated in lockstep with the repo going forward (`validity: volatile` notes only make sense if refreshed), otherwise the next agent session will re-derive state from stale claims.

## Evidence trail (facts → inference → recommendation)

- Facts: all findings above carry file:line citations from the repo and `git` output; test run on 2026-08-14 (90/90 pass).
- Inferences: W1 is reachable in practice because `parseNativeBatchState` treats any photo read failure as fatal and `App.tsx:155-160` silently ignores a `null` batchState; W2 is reachable because `git add -A` after any Syncthing sync would stage the untracked live files.
- Recommendations: ordered by expected value per hour of effort (W1 → W2 → W3 → W4 → W7 → W6 → W8); nothing requires a redesign.