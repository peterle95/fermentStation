---
type: platform runtime
title: Tauri desktop runtime
description: Desktop packaging and Rust-side filesystem bridge/security boundary for the local-first application.
tags: [desktop, tauri, rust]
---

`src-tauri/src/main.rs` is the Tauri composition root. It registers desktop commands used by the TypeScript platform bridge, resolves application data paths, and applies path validation before filesystem access. `src-tauri/tauri.conf.json`, `Cargo.toml`, and `build.rs` define packaging and capabilities.

The TypeScript `createTauriBridge` maps to Rust commands `shared_get_location`, `shared_choose_location`, `shared_list_files`, `shared_read_file`, and `shared_write_file`. `shared_path` rejects absolute paths, traversal, invalid separators, and symlink escapes; reads/writes enforce the 64 MiB `MAX_SHARED_FILE_BYTES` limit and base64 contract. `recover_files` repairs or removes `.tmp-*`/`.bak-*` remnants before listing, while `atomic_write` writes a temporary file, syncs, replaces through a backup, and rolls back/cleans up on failure. Rust tests include `shared_paths_reject_traversal_and_absolute_paths`; there are no focused repository tests for atomic-write interruption/recovery, so those guarantees are source-level evidence and should receive native tests when changed.

The desktop runtime supplies native persistence/transfer while React/domain state remains the authority. Run `npm run tauri:dev` for the shell and `npm run tauri:build` for packaging; Rust/MSVC prerequisites are required. Changes to commands or permissions require synchronized TypeScript callers, Rust tests, and Tauri configuration.
