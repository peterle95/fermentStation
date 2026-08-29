---
type: guide
title: FermentStation wiki quickstart
description: Entry point for understanding and safely changing the local-first FermentStation React, Android, and Tauri application.
tags: [quickstart, navigation, repository]
---

# FermentStation wiki quickstart

FermentStation is a local-first household fermentation journal. `src/main.tsx` mounts the React `App`; `src/App.tsx` composes navigation, profiles, batches, persistence, native capabilities, archives, and reminders. There is no server API: state is transformed in pure domain modules and persisted through browser, Capacitor, shared-folder, or Tauri adapters.

## Map of the system

- [System architecture](architecture/overview.md) — composition root, boundaries, data flow, and platform selection.
- [UI architecture](architecture/ui.md) — views, React state, event handlers, navigation, drafts, and lifecycle listeners.
- [Profile domain](domains/profiles.md) — editable profile schema, validation, formulas, units, and normalization.
- [Batch domain](domains/batches.md) — profile snapshots, status/check lifecycle, journal timeline, pH, calendar, and trash.
- [Shell domain](domains/shell.md) — destinations and preferences.
- [Storage](platform/storage.md) — browser/native parsers and shared persistence boundaries.
- [Archive](platform/archive.md) — versioned ZIP export/import and collision handling.
- [Device integrations](platform/device-integrations.md) — camera, notifications, archive transfer, and native lifecycle.
- [Android and Capacitor](platform/android-capacitor.md) — SAF plugin, native Filesystem, manifest, and Android capabilities.
- [Tauri desktop](platform/desktop-tauri.md) — Rust commands and safe shared-folder filesystem behavior.
- [Platform lifecycle](workflows/platform-lifecycle.md) — startup, source precedence, native readiness, and saves.
- [Shared synchronization](workflows/shared-sync.md) — migration, queued writes, conflicts, and recovery.
- [Calendar workflow](workflows/calendar.md) — Today prioritization, due checks, and calendar projections.
- [Archive transfer](workflows/archive-transfer.md) — user-facing import/export flow.
- [Data interchange](workflows/data-interchange.md) — shared-folder and archive schemas.
- [Build operations](operations/build.md) — commands, prerequisites, generated outputs, and CI wiki update.
- [Testing](testing.md) — focused suites and validation strategy.

## Task routing

| Intent | Canonical page | Primary source surface | Focused check | Minimal validation |
|---|---|---|---|---|
| Change profile fields or formulas | [Profile domain](domains/profiles.md) | `src/domain/profiles.ts`, profile editor in `src/App.tsx` | `src/domain/profiles.test.ts` | `npm test -- profiles` |
| Change batch status, checks, timeline, pH, or trash | [Batch domain](domains/batches.md) | `src/domain/batches.ts`, batch handlers in `src/App.tsx` | `src/domain/batches.test.ts` | `npm test -- batches` |
| Change navigation/preferences/layout | [UI architecture](architecture/ui.md), [Shell domain](domains/shell.md) | `src/App.tsx`, `src/domain/shell.ts`, `src/styles.css` | `src/App.test.tsx`, `src/styles.test.ts` | `npm test` |
| Change JSON persistence or migrations | [Storage](platform/storage.md) | `src/platform/*-store.ts` | store tests | `npm test` |
| Change shared-folder sync or conflicts | [Shared synchronization](workflows/shared-sync.md) | `shared-data-store.ts`, bridge, platform implementation | `shared-data-store.test.ts` | `npm test` |
| Change archive format or collision behavior | [Archive](platform/archive.md), [Archive transfer](workflows/archive-transfer.md) | `src/platform/archive.ts`, Settings UI | `archive.test.ts`, App archive tests | `npm test` |
| Change camera, notifications, or native transfer | [Device integrations](platform/device-integrations.md), [Android](platform/android-capacitor.md) | `src/platform/camera.ts`, `reminders.ts`, `native-transfer.ts` | App integration tests | `npm test`, then Android build/device check |
| Change Android shared storage | [Android](platform/android-capacitor.md) | `SharedDirectoryPlugin.java`, bridge, manifest | `SharedDirectoryPluginTest` | `npm run cap:sync; npm run android:build` |
| Change desktop shared storage/security | [Tauri desktop](platform/desktop-tauri.md) | `src-tauri/src/main.rs` | Rust unit tests | `cargo test --manifest-path src-tauri/Cargo.toml` |
| Change packaging/tooling | [Build operations](operations/build.md) | `package.json`, Vite/Gradle/Tauri configs, scripts | build/typecheck | `npm run typecheck` or `npm run build` |

## Core invariants

A new batch owns a cloned profile snapshot; profile edits affect future batches, not existing records. Batch inputs and formula outputs reject invalid negative values and incompatible units. Recurring checks are authoritative in batch state; notifications are only a native projection. Shared datasets are accepted as complete versioned snapshots, preserve sync-conflict files, and reject interrupted or malformed generations. Archives verify structure, hashes, stable IDs, and domain validity before reaching the UI.

## Validation baseline

Run `npm run typecheck` for TypeScript contracts, `npm test` for domain/platform/UI behavior, and `npm run build` for the production web bundle. Use `npm run cap:sync` and `npm run android:build` for Android packaging, and `npm run tauri:build` for desktop packaging when those surfaces change. Rust-specific safety changes require the Cargo test command above.

## Scope boundaries and backlog

The repository has no remote backend, live database synchronization, or server-side API. File-based shared storage intentionally preserves conflicts instead of merging them. Historical gap notes in `docs/android-desktop-implementation-gaps.md` may describe capabilities that current source now implements; prefer current source and focused tests. No evidence-blocked backlog remains for the initialized wiki.
