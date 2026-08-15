---
type: test guide
title: Tests and validation
description: Behavioral test inventory mapped to domain invariants, persistence boundaries, UI workflows, native security limits, and the gaps requiring device or desktop validation.
tags: [testing, validation, quality]
---

# Tests and validation

Run `npm test` for Vitest, `npm run typecheck` for the TypeScript project build, and `npm run build` for typecheck plus Vite production output. Vitest runs domain, platform, and React/jsdom tests with native boundaries mocked or unavailable; it does not prove Android Storage Access Framework, notification, camera process-death, or packaged Tauri behavior.

## Suite ownership and evidence

| Surface | Canonical tests | What is and is not proved |
|---|---|---|
| Batch and profile domains | `src/domain/batches.test.ts`, `src/domain/profiles.test.ts`, `src/domain/shell.test.ts` | Pure lifecycle, formula, validation, and shell invariants; no filesystem/native provider behavior |
| Browser/native parsers | `src/platform/*-store.test.ts` | JSON rejection/normalization and local persistence contracts; not Capacitor process recovery |
| Shared dataset | `src/platform/shared-data-store.test.ts` | schema markers, migration, conflicts, queued writes, photo hydration; bridge provider behavior remains native |
| Archive and transfer UI | `src/platform/archive.test.ts`, `src/App.test.tsx` | ZIP integrity/merge plus Settings workflows; native picker/share is not fully modeled by jsdom |
| Android bridge | `android/app/src/test/java/com/peterle/fermentstation/SharedDirectoryPluginTest.java` | Relative-path rejection; SAF permissions, provider rename/backup, and file limits need device/instrumentation checks |
| Tauri bridge | tests embedded in `src-tauri/src/main.rs` | Rust path/security behavior; run Cargo tests for atomic recovery and limits, then validate packaged commands |
| Camera and reminders | `src/App.test.tsx` plus adapter source | UI fallback and orchestration; process-death restoration, notification provider behavior, and permission prompts require device validation |

The focused suites establish these ownership boundaries:

- `src/domain/batches.test.ts` owns batch creation, profile snapshots, status pause/resume, checks, calculations, pH precision/zones, timeline and batch trash expiry, filtering, prioritization, and calendar projections.
- `src/domain/profiles.test.ts` owns normalization, unit conversion/formula parsing, invalid expressions, validation, and CRUD.
- `src/domain/shell.test.ts` owns destination/default preference invariants.
- `src/platform/*-store.test.ts` owns parser rejection/normalization and browser persistence contracts.
- `src/platform/archive.test.ts` owns ZIP limits, hashes, photo references, schema failures, stable IDs, merges, and collision strategies.
- `src/platform/shared-data-store.test.ts` owns migration choices, malformed/in-progress manifests, conflict files, photo externalization/hydration, queued writes, unchanged writes, and failure status behavior.
- `src/App.test.tsx` is the jsdom end-to-end surface for navigation, profile editing, batch creation/filtering, timeline/pH/check flows, settings, archive import/export, reminders, shared-storage results, and browser/native fallback UI.
- `android/app/src/test/java/com/peterle/fermentstation/SharedDirectoryPluginTest.java` protects Android relative-path rejection; it does not replace device SAF tests.
- Tests embedded in `src-tauri/src/main.rs` protect Rust traversal/absolute-path rejection and the implementation also contains atomic-write, recovery, nesting, and 64 MB safeguards requiring `cargo test --manifest-path src-tauri/Cargo.toml`.

## Change routing and gaps

A representative end-to-end route is distributed across `src/App.test.tsx` flows: edit/save a profile, create a batch from it, record checks/measurements/photos, persist the resulting batch, then exercise Settings archive export/import and collision resolution. The UI suite proves composition; `batches.test.ts`, `shared-data-store.test.ts`, and `archive.test.ts` prove immutable transitions and serialized round trips rather than native filesystem behavior.

Change routing is explicit: a new persisted field requires the owning domain type and focused domain test, `src/platform/*-store.ts` parser tests, `shared-data-store.test.ts`, `archive.test.ts`, and the relevant App flow; a new formula term requires `profiles.ts`, profile editor/UI tests, and formula tests; a new status requires `batches.ts`, lifecycle/calendar tests, App status-flow tests, and archive/shared parsers; a new archive member requires `archive.ts`, archive integrity/tamper tests, and Settings import/export coverage; a new native method requires `shared-directory-bridge.ts`, Android plugin registration/implementation, Tauri `invoke_handler`, native contract tests, and platform-lifecycle coverage. Schema/bridge changes need parser, integration, and failure-recovery assertions across TypeScript and native contracts. Archive changes require both archive unit tests and the App collision/import flow. Shared-storage changes require migration/conflict/queued-write tests and, when native implementation changes, Android/Tauri validation.

Manual or platform validation remains necessary for Android permissions and URI persistence, SAF provider rename behavior, camera restoration after process death, local notifications, generated Capacitor assets, and signed Tauri packaging. Do not infer those guarantees from Vitest. The narrow validation ladder is `npm run typecheck` → `npm test` → `npm run build` → platform sync/build; Rust changes additionally use Cargo tests.
