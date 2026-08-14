---
type: platform runtime
title: Capacitor Android runtime
description: Android packaging and the SharedDirectory SAF plugin that implements shared-folder persistence.
tags: [android, capacitor, shared-storage]
---

`android/app/src/main/java/com/peterle/fermentstation/MainActivity.java` registers `SharedDirectoryPlugin.java`, matching the JS `createPlatformSharedDirectoryBridge` contract (`getLocation`, `chooseLocation`, list/read/write/delete). The plugin persists Storage Access Framework URI permissions, validates relative paths, recursively lists files, and rejects unsafe traversal or unsupported locations.

`SharedDirectoryPlugin.java` uses temporary and backup replacement to make writes recoverable, enforces the 64 MB file limit, and handles missing providers/URI failures without claiming success. `AndroidManifest.xml`, Gradle files, and generated Capacitor assets are packaging configuration; Java source and the TypeScript bridge are authoritative. This plugin is the Android implementation behind the shared-store lifecycle in [storage](platform/storage.md), not a second domain store.

Android integration tests are not represented by the Vitest suites; use `npm run cap:sync` and `npm run android:build` after plugin or manifest changes. Review path-security, permission persistence, atomic replacement, and size-limit behavior manually or with Android instrumentation when available.
