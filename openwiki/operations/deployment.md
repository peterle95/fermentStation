---
type: operations
title: Deployment and release configuration
description: Android Capacitor and desktop Tauri packaging depend on generated web assets, native registration, platform permissions, capabilities, and toolchain prerequisites.
tags: [operations, android, desktop, release]
---

# Deployment and release configuration

The web app is configured by `vite.config.ts`, `tsconfig*.json`, `index.html`, and `capacitor.config.ts`. `npm run build` runs `tsc -b` then `vite build`; Capacitor consumes the resulting web assets after `npm run cap:sync`. `android/app/src/main/assets/capacitor.config.json` and `capacitor.plugins.json` are generated/synchronized outputs and should not be hand-edited as the source of truth.

## Android

`android/app` is the Capacitor shell. Gradle files (`android/build.gradle`, `android/app/build.gradle`, `variables.gradle`, and settings) define the Android application and plugin dependencies. `AndroidManifest.xml` and Java registration provide the runtime permissions and `SharedDirectoryPlugin`; `SharedDirectoryPlugin.java` uses Storage Access Framework persisted URI permissions rather than unrestricted filesystem paths. The generated asset bundle must match the TypeScript build. `npm run android:build` invokes `scripts/android-build.ps1`, while `npm run cap:sync` refreshes native plugins/assets.

Required local prerequisites are Android Studio JDK, Android SDK paths, Gradle-compatible tooling, and a configured device/emulator. Validate with `npm run typecheck`, `npm test`, `npm run build`, `npm run cap:sync`, then the Android build script; exercise folder selection, permission loss, camera restoration, and reminders on a device because jsdom cannot model them.

## Tauri desktop

`src-tauri/tauri.conf.json`, `Cargo.toml`, `build.rs`, generated `src-tauri/gen`, and `src-tauri/src/main.rs` define the desktop shell. Tauri packages the Vite output and exposes only the registered shared-directory commands. The desktop configuration stores the selected folder path in the app config directory, not in shared data. Capabilities and generated configuration constrain the runtime surface. `npm run tauri:dev` launches development; `npm run tauri:build` packages the desktop artifact and requires Rust, Tauri CLI, and Windows/MSVC prerequisites.

## Troubleshooting and boundaries

A stale mobile bundle usually indicates missing `cap:sync`; a missing native method indicates plugin registration or generated plugin metadata drift; shared-folder failures should be diagnosed through the status shown by `SharedDataStore`, not by bypassing its path/atomic-write checks. Build outputs under `dist`, `android/app/build`, and `src-tauri/target` are artifacts, not source inputs. See [native contracts](../architecture/native-contracts.md) for parity requirements and [build operations](build.md) for the command matrix.
