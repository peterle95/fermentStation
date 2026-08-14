---
type: navigation guide
title: FermentStation code wiki
description: Entry point for understanding the local-first fermentation tracker, its domain model, persistence protocols, platform runtimes, and safe change paths.
tags: [quickstart, navigation, repository]
---

FermentStation is a React/Vite local-first app packaged for browser, Android Capacitor, and desktop Tauri. Start with [architecture](architecture/overview.md), then use the domain pages for business rules and platform pages for persistence and native boundaries.

## Map

- [Architecture and UI](architecture/overview.md) — `App.tsx`, destinations, effects, state ownership, and workflows.
- [Batches](domains/batches.md) — lifecycle, checks, pH, timeline, trash, and calendar.
- [Profiles](domains/profiles.md) — schemas, formulas, validation, and CRUD.
- [Shell](domains/shell.md) — navigation and preferences.
- [Storage](platform/storage.md) — browser/native/shared precedence, schemas, migration, and conflicts.
- [Archive](platform/archive.md) — portable ZIP exchange and collision handling.
- [Device integrations](platform/device-integrations.md) — camera, reminders, and native transfer.
- [Data interchange](workflows/data-interchange.md) — compare persistence, sync, and archive workflows.
- [Android](android-capacitor.md) and [Tauri](desktop-tauri.md) — native runtime boundaries.
- [Operations](operations/build.md) and [testing](testing.md) — commands, packaging, and validation.

## Task routing

| Change area or user intent | Relevant wiki page | Exact source entry points | Important symbols or types | Focused tests | Minimal validation |
|---|---|---|---|---|---|
| Change batch rules | [Batches](domains/batches.md) | `src/domain/batches.ts` | batch commands and `BatchState` | `src/domain/batches.test.ts` | `npm test -- --run src/domain/batches.test.ts` |
| Change documentation automation | [Operations](operations/build.md) | `.github/workflows/openwiki-update.yml` | `openwiki code --update --print`, PR `add-paths` | workflow review | YAML/source review |
| Change profile formulas/editor | [Profiles](domains/profiles.md) | `src/domain/profiles.ts`, `src/App.tsx` | profile commands and `ProfileState` | `src/domain/profiles.test.ts`, relevant `src/App.test.tsx` | `npm test -- --run src/domain/profiles.test.ts` |
| Change persistence/schema | [Storage](platform/storage.md) | `src/platform/*-store.ts`, `src/platform/shared-data-store.ts` | parsers, `SharedDataStore`, `SharedSnapshot` | store suites, `src/platform/shared-data-store.test.ts` | `npm test -- --run src/platform/shared-data-store.test.ts` |
| Change import/export | [Archive](platform/archive.md) | `src/platform/archive.ts`, `src/App.tsx` | `createArchive`, `importArchive` | `src/platform/archive.test.ts` | `npm test -- --run src/platform/archive.test.ts` |
| Change camera/reminders/native transfer | [Device integrations](platform/device-integrations.md) | `src/platform/camera.ts`, `reminders.ts`, `native-transfer.ts` | adapter functions and App effects | relevant `src/App.test.tsx` | `npm test -- --run src/App.test.tsx` |
| Change Android shared folder | [Android](android-capacitor.md) | `SharedDirectoryPlugin.java`, `shared-directory-bridge.ts` | SAF plugin and `SharedDirectoryBridge` | `SharedDirectoryPluginTest.java` | `npm run cap:sync` |
| Change desktop filesystem | [Tauri](desktop-tauri.md) | `src-tauri/src/main.rs`, `shared-directory-bridge.ts` | Tauri shared_* commands | Rust tests | `npm run tauri:build` |
| Change packaging/tooling | [Operations](operations/build.md) | `package.json`, `index.html`, workflow YAML | build scripts and OpenWiki job | workflow/source review | `npm run typecheck` |

## Commands

```powershell
npm run dev
npm test
npm run typecheck
npm run build
npm run cap:sync
npm run android:build
npm run tauri:dev
npm run tauri:build
```

Use `npm run build` for the narrow production web check; use platform builds only when native packaging, manifests, plugins, or Rust behavior changes. Generated `dist`, Android build outputs, and Tauri target outputs are not source of truth. No evidence-blocked backlog items remain for this initialization.
