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

| Intent | Owning page and symbols | Focused validation |
|---|---|---|
| Change batch rules | [Batches](domains/batches.md), `src/domain/batches.ts` | `src/domain/batches.test.ts`, `npm test` |
| Change profile formulas/editor | [Profiles](domains/profiles.md), `profiles.ts`, `App.tsx` | `profiles.test.ts`, relevant `App.test.tsx` |
| Change persistence/schema | [Storage](platform/storage.md), store parsers, `SharedDataStore` | store and `shared-data-store.test.ts` |
| Change import/export | [Archive](platform/archive.md), `createArchive`/`importArchive` | `archive.test.ts` |
| Change camera/reminders/native transfer | [Device integrations](platform/device-integrations.md) | App tests plus platform build |
| Change Android shared folder | [Android](android-capacitor.md), Java plugin and TS bridge | `npm run cap:sync`, `npm run android:build` |
| Change desktop filesystem | [Tauri](desktop-tauri.md), Rust commands | Rust tests, `npm run tauri:build` |
| Change packaging/tooling | [Operations](operations/build.md) | `npm run typecheck`, `npm run build` |

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
