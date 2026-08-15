---
type: guide
title: FermentStation wiki quickstart
description: Navigation guide for the local-first fermentation tracker, its domain rules, persistence boundaries, native integrations, workflows, tests, and build operations.
tags: [quickstart, navigation]
---

# FermentStation wiki quickstart

FermentStation is a local-first household fermentation tracker for Android and desktop. Start with [system architecture](architecture/overview.md), then route changes by intent:

| Intent | Canonical page | Owning symbols | Focused validation |
|---|---|---|---|
| Add or change a fermentation rule | [Batches](domains/batches.md) or [Profiles](domains/profiles.md) | `createBatch`, `changeBatchStatus`, `validateProfile`, `calculateProfileValue` | `npm test -- src/domain/batches.test.ts src/domain/profiles.test.ts` |
| Change a screen, navigation, or user workflow | [React UI](architecture/ui.md) | `App`, `BatchView`, `BatchCard`, `Profiles`, `SettingsView` | `npm test -- src/App.test.tsx` |
| Change browser/native/shared persistence | [Storage](platform/storage.md) and [platform lifecycle](workflows/platform-lifecycle.md) | `SharedDataStore`, `createPlatformSharedDirectoryBridge` | `npm test -- src/platform/*store.test.ts src/platform/shared-data-store.test.ts` |
| Change archive import/export | [Archive](platform/archive.md) and [Archive transfer workflow](workflows/archive-transfer.md) | `createArchive`, `importArchive`, `resolveArchiveCollisions`, `shareNativeFile`, `pickNativeArchive` | `npm test -- src/platform/archive.test.ts src/App.test.tsx` |
| Add/change camera, reminders, file picker, or sharing | [Device integrations](platform/device-integrations.md) | `captureNativePhoto`, `reconcileReminders`, native transfer functions | `npm test -- src/App.test.tsx`; device validation for native behavior |
| Change Android/Tauri bridge methods | [Native contracts](architecture/native-contracts.md) | `SharedDirectoryBridge`, `SharedDirectoryPlugin`, Tauri commands | TypeScript tests plus Android/Rust tests |
| Change packaging or release configuration | [Deployment](operations/deployment.md) and [Build operations](operations/build.md) | Capacitor/Gradle files, `tauri.conf.json`, `main.rs` | `npm run build`, sync, platform build |
| Understand test ownership | [Tests](testing.md) | domain/platform/App/native suites | `npm test`, `npm run typecheck` |

## Main concepts

- [Profiles](domains/profiles.md) define inputs, calculations, guidance, pH zones, temperatures, durations, and recurring checks.
- [Batches](domains/batches.md) snapshot profiles and track statuses, timeline entries, readings, photos, checks, calendar events, and seven-day recovery trash.
- [Shell state](domains/shell.md) owns destination, units, reminder/suggestion preferences, and formula terms.
- [Storage](platform/storage.md) explains browser stores, native state, shared-folder snapshots, schema parsing, migration, conflicts, and photo externalization.
- [Archive exchange](platform/archive.md) documents ZIP integrity, imports, exports, photo hashes, and collision resolution.
- [Device integrations](platform/device-integrations.md) covers camera, reminders, native transfer, and platform capability fallbacks.
- [Data interchange](workflows/data-interchange.md), [archive transfer](workflows/archive-transfer.md), and [platform lifecycle](workflows/platform-lifecycle.md) describe cross-system flows.

## Commands

```text
npm run dev
npm test
npm run typecheck
npm run build
npm run cap:sync
npm run android:build
npm run tauri:dev
npm run tauri:build
```

Build prerequisites and generated outputs are in [deployment](operations/deployment.md). Source documentation in `docs/` remains supporting material, especially `docs/shared-data-format.md` for the shared dataset and `docs/android-development-workflow.md` for Android setup. There is no remote service, server API, or migration framework beyond the documented persisted schema parsers and archive/shared-data version checks.
