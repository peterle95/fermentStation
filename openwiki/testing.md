---
type: test guide
title: Tests and validation
description: Behavioral test inventory mapped to domain invariants, persistence boundaries, UI workflows, and native security limits.
tags: [testing, validation, quality]
---

Run `npm test` for Vitest, `npm run typecheck` for the TypeScript project build, and `npm run build` for typecheck plus Vite production output.

- `src/domain/batches.test.ts`: creation/defaults, status pause shifting, checks, calculations, pH precision/zones, timeline trash expiry, filtering, and calendar projections.
- `src/domain/profiles.test.ts`: normalization, units/formulas, invalid expressions, validation, and CRUD.
- `src/domain/shell.test.ts`: destination/default invariants.
- `src/platform/*-store.test.ts`: parser rejection/normalization and persistence contracts.
- `src/platform/archive.test.ts`: ZIP limits, hashes, photo references, schema failures, stable IDs, merges, and collision strategies.
- `src/platform/shared-data-store.test.ts`: migration choices, malformed/in-progress manifests, conflict files, external photos, queued writes, and atomic failure behavior.
- `src/App.test.tsx`: navigation and end-to-end user flows across batches, profiles, archive, reminders, and shared storage.
- `src-tauri/src/main.rs` tests: desktop path/security constraints.

Android Java/Capacitor integrations are not fully covered by the Vitest suites; validate with `npm run cap:sync` and the Android build when changing them. Three concrete boundary checks are: (1) App batch/profile actions call domain mutations and persistence, exercised by named flows in `src/App.test.tsx` plus `batches.test.ts`; (2) Settings archive upload passes bytes through `importArchive` and collision UI, covered by `archive.test.ts` and App archive flows; (3) shared-folder initialization/reload applies validated records to App state, covered by `shared-data-store.test.ts` and App shared-storage flows. Browser persistence degradation is directly covered by `shell-store.test.ts` and parser/store tests. Android plugin behavior and Tauri atomic-write recovery remain source-level or manual integration coverage (the Tauri path-security test is direct); do not infer native recovery guarantees from Vitest alone. A domain change should update its focused suite first; a schema/bridge change needs parser, integration, and failure-recovery tests.
