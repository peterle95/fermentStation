---
type: operations guide
title: Build and packaging operations
description: Authoritative manifests, development commands, generated artifacts, and web, Android, and Tauri output differences.
tags: [operations, build, deployment]
---

`package.json` is the command entrypoint: `npm run dev`, `npm test`, `npm run typecheck`, `npm run build`, `npm run cap:sync`, `npm run android:build`, `npm run tauri:dev`, and `npm run tauri:build`. `vite.config.ts`, `tsconfig*.json`, and `index.html` are authoritative web/build configuration; `dist/`, Android Gradle outputs, and Tauri target output are generated.

Capacitor sync copies the Vite web bundle and plugin metadata into Android; Android requires Android Studio JDK/SDK and uses `android/` Gradle configuration, `AndroidManifest.xml`, Java plugins, and generated assets. Tauri uses `src-tauri/tauri.conf.json`, Rust `src-tauri/src/main.rs`, and the PowerShell wrapper scripts; Rust/MSVC tooling is required. Web runs in the browser, Android supplies Capacitor plugins/SAF, and desktop supplies Tauri commands/filesystem behavior.

Do not hand-edit generated `dist`, `android/app/build`, Gradle caches, or `src-tauri/target`. Change source/config manifests, rerun the narrow command, then use the broader build when packaging behavior is affected. Evidence: package scripts, Vite/Capacitor/Tauri configs, `scripts/*.ps1`, Android Gradle/manifest files, and `src-tauri/Cargo.toml`.

## Automated wiki update

`.github/workflows/openwiki-update.yml` runs `openwiki code --update --print` on a scheduled or manually dispatched job. It checks out full history so the updater can compare `HEAD` with the commit recorded in `openwiki/.last-update.json`, then opens a pull request containing generated wiki paths. The workflow passes the OpenWiki provider credentials and connector key needed for the run; it no longer enables LangSmith tracing for the workflow process itself. Changes to this automation should preserve full-history checkout, the `openwiki` update path, and the pull-request collection paths; validate by reviewing the workflow YAML rather than running a production deployment.
