---
type: operations guide
title: Build and packaging operations
description: Authoritative manifests, development commands, generated artifacts, and web, Android, and Tauri output differences.
tags: [operations, build, deployment]
---

`package.json` is the command entrypoint: `npm run dev`, `npm test`, `npm run typecheck`, `npm run build`, `npm run cap:sync`, `npm run android:build`, `npm run tauri:dev`, and `npm run tauri:build`. `vite.config.ts`, `tsconfig*.json`, and `index.html` are authoritative web/build configuration; `index.html` references the public `/app_logo.png` favicon. `dist/`, Android Gradle outputs, and Tauri target output are generated.

Capacitor sync copies the Vite web bundle and plugin metadata into Android; Android requires Android Studio JDK/SDK and uses `android/` Gradle configuration, `AndroidManifest.xml`, Java plugins, and generated assets. Tauri uses `src-tauri/tauri.conf.json`, Rust `src-tauri/src/main.rs`, and the PowerShell wrapper scripts; Rust/MSVC tooling is required. Web runs in the browser, Android supplies Capacitor plugins/SAF, and desktop supplies Tauri commands/filesystem behavior.

Do not hand-edit generated `dist`, `android/app/build`, Gradle caches, or `src-tauri/target`. Change source/config manifests, rerun the narrow command, then use the broader build when packaging behavior is affected. The scheduled/manual `.github/workflows/openwiki-update.yml` job checks out full history, runs `openwiki code --update --print`, and opens a PR containing `openwiki` plus selected instruction/workflow files; it is documentation automation, not an application build. Evidence: package scripts, Vite/Capacitor/Tauri configs, `scripts/*.ps1`, Android Gradle/manifest files, `src-tauri/Cargo.toml`, and the workflow.
