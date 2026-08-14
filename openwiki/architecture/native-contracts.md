---
type: interface
title: Native shared-directory contracts
description: The TypeScript bridge, Android Capacitor plugin, and Tauri commands implement one file-oriented shared-directory contract with matching payloads, limits, and safety semantics.
tags: [native, contracts, interoperability]
---

# Native shared-directory contracts

The public contract starts at `src/platform/shared-directory-bridge.ts`. `SharedDirectoryBridge` exposes `available`, `getLocation`, `chooseLocation`, `listFiles`, `readFile(path)`, and `writeFile(path, data)`. `createPlatformSharedDirectoryBridge` selects the implementation using `Capacitor.getPlatform()` and `isTauri()`; browser receives an unavailable no-op bridge.

Android registers `@CapacitorPlugin(name = "SharedDirectory")` in `android/app/src/main/java/com/peterle/fermentstation/SharedDirectoryPlugin.java`. Its methods return `{location}`, `{files}`, or `{data}` objects as required by the TypeScript adapter. `chooseLocation` uses `ACTION_OPEN_DOCUMENT_TREE`, persists read/write URI permission, and stores the URI in Android `SharedPreferences`. Desktop registers the equivalent `shared_get_location`, `shared_choose_location`, `shared_list_files`, `shared_read_file`, and `shared_write_file` commands in `src-tauri/src/main.rs`; the Tauri adapter passes `{ path, data }` for writes and `{ path }` for reads.

## Compatibility rules

- File contents cross the bridge as base64 strings; JSON encoding/decoding and photo externalization remain in `SharedDataStore`.
- Paths are relative, slash-separated, non-empty, and may not contain traversal, backslashes, or absolute components. Both Android `validRelativePath` and Rust `shared_path` enforce this boundary.
- `getLocation`/`chooseLocation` resolve to a nullable location: Android returns an object without `location` when no permission/cancel occurs, and Tauri returns `null` on no configured/cancelled selection. `listFiles` always returns a string array; `readFile` returns an object without `data`/a Tauri `null` for a missing file; `writeFile` resolves with no payload. File contents cross the bridge as base64 strings; JSON encoding/decoding and photo externalization remain in `SharedDataStore`.
- Reads and writes enforce a 64 MB file limit; recursive listing/recovery rejects nesting beyond 64 levels. Unchanged bytes are not rewritten.
- Writes use temporary sibling files and replacement/backup recovery. Android rejects providers that cannot rename safely; Tauri uses filesystem rename and rollback. Android SAF replacement and recovery are not fully automated by the JS suite and require instrumentation/manual provider validation.
- Missing permissions or unavailable runtimes produce capability errors/statuses rather than silently writing to an unintended location.

```mermaid
flowchart LR
  TS[SharedDirectoryBridge] -->|Capacitor registerPlugin| Android[SharedDirectoryPlugin.java]
  TS -->|Tauri invoke| Rust[src-tauri/src/main.rs commands]
  Android --> SAF[Android Storage Access Framework]
  Rust --> FS[Configured desktop folder]
  TS --> Browser[Unavailable browser bridge]
```

The implementation chain is TypeScript adapter → registered native method/command → platform filesystem → base64 response. Any method rename, payload change, error change, or limit change must be made in all layers and in the shared-data store assumptions. Android path behavior is covered by `android/app/src/test/java/com/peterle/fermentstation/SharedDirectoryPluginTest.java`; Rust path, file-size, atomic-write, and recovery behavior is covered by tests embedded in `src-tauri/src/main.rs`.
