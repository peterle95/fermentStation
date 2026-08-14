# Shared data format

FermentStation can use one user-selected directory as its canonical store on Android and Tauri desktop. The selected Android document-tree URI and desktop path are device-local settings and are never written into this directory.

```text
manifest.json
records/
  shell.json
  profiles.json
  batches.json
photos/
  <encoded-batch-id>/
    <encoded-timeline-entry-id>.<extension>
```

`manifest.json` currently contains `{ "schemaVersion": 1 }`. Record files are indented JSON. Photo timeline entries use a relative `photoRef` on disk and are hydrated back to data URLs at the storage boundary before the existing batch parser runs.

Each changed file is written to a flushed sibling temporary file before replacement. Unchanged files are not rewritten. Tauri uses filesystem renames. Android uses Storage Access Framework document renames, temporarily retaining the previous file as a sibling backup. Interrupted temporary/backup files under FermentStation-owned paths are recovered before loading. SAF providers do not offer a portable atomic-replace primitive, so Android replacement is crash-resistant rather than guaranteed atomic; a provider that cannot rename documents is rejected instead of falling back to an unsafe truncating write.

Multi-record initialization and migration mark `manifest.json` with `writeInProgress` before changing records and clear it only after all records are installed. A partially written generation is therefore rejected rather than loaded as a mixed snapshot. Individual shared files are limited to 64 MB to keep malformed or hostile synchronized files from exhausting application memory.

Files containing `.sync-conflict-` are reported but never loaded as canonical records or deleted. Malformed, missing, or unsupported canonical records are rejected as a complete snapshot so valid in-memory data is retained.
