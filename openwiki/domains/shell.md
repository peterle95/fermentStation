---
type: domain model
title: Shell state and navigation
description: Navigation destinations and local display preferences persisted independently from fermentation records.
tags: [domain, navigation, preferences]
---

`src/domain/shell.ts` owns `destinations`, `Destination`, `ShellPreferences`, and `ShellState`. `createShellState` supplies defaults; `selectDestination` accepts only declared destinations and is used by `App.tsx` navigation. Preferences include unit system and reminder settings.

`src/platform/shell-store.ts` serializes and parses shell state for browser/native/shared records. The parser is the boundary that prevents malformed persisted preferences from entering React state. Focused evidence is `src/domain/shell.test.ts` for selection/default behavior and `src/platform/shell-store.test.ts` for persistence normalization. Changes to destinations or preferences require the navigation labels/views in `App.tsx`, parser/schema updates, and both suites.
