---
type: workflow comparison
title: Persistence and data interchange workflows
description: End-to-end comparison of local persistence, shared-folder synchronization, and portable archive exchange.
tags: [workflow, persistence, archive, synchronization]
---

FermentStation has three distinct data paths. Browser/native persistence stores parsed `ShellState`, `ProfileState`, and `BatchState` locally. Shared storage uses manifest plus separate records and external photos, with canonical-folder selection and conflict preservation. Portable archives use ZIP records, content hashes, and collision review. They must not be treated as interchangeable schemas.

```mermaid
sequenceDiagram
  participant UI as App.tsx
  participant Local as browser/native stores
  participant Shared as SharedDataStore
  participant Archive as archive.ts
  UI->>Local: bootstrap state
  UI->>Shared: initialize / reload
  Shared-->>UI: authoritative snapshot or migration/conflict
  UI->>Archive: createArchive or importArchive
  Archive-->>UI: bytes or validated pending merge
  UI->>Local: save when no shared authority
  UI->>Shared: queued record writes when shared authority
```

Photos are data URLs in domain memory, external files in shared datasets, and content-addressed `photos/<hash>` members in archives. Shared writes use an in-progress manifest and preserve conflict files; archive imports reject tampering and defer same-ID collisions. `App.tsx` provides the user entrypoints for settings/shared migration and archive dialogs. Evidence is `src/App.tsx`, `platform/shared-data-store.ts`, `platform/archive.ts`, their tests, and the native bridges. Any schema or photo change must update both protocols separately.
