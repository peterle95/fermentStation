---
type: interchange protocol
title: Portable archive import and export
description: ZIP archive format, integrity checks, photo handling, size limits, and collision resolution.
tags: [archive, import, export, integrity]
---

`createArchive` in `src/platform/archive.ts` clones profile/batch records, validates profiles and stable IDs, replaces photo data URLs with SHA-256 references, and writes a ZIP containing `manifest.json`, `records.json`, and `photos/<hash>`. The manifest is schema version 1 and hashes records plus enumerates photos.

`importArchive` enforces 200 MB compressed and 250 MB expanded limits, validates ZIP structure, manifest hashes, photo hashes, JSON schema, profile validity, stable IDs, and photo references before hydrating data URLs. Photo members are content-addressed binary files under `photos/<hash>`; MIME type is retained in the timeline record and the extension/encoding is allowlisted by the archive implementation rather than trusted from arbitrary member paths. The records parser is the domain-validation boundary: malformed profiles, batches, duplicate IDs, invalid calculations, and invalid timeline/photo records are rejected before any merge. Existing IDs produce `ArchiveCollision`; the import remains pending until `resolveArchiveCollisions("local"|"archive")` chooses the winner. Native picking/sharing is only transport (`native-transfer.ts`); domain state remains authoritative in `App.tsx`.

Focused evidence and failure cases are in `src/platform/archive.test.ts`: malformed ZIPs, hash/manifest mismatch, limits, invalid records/photos, stable-ID failures, merges, and collision strategies. Changes to the archive schema must update these tests, UI import/export handlers, and native transfer callers.
