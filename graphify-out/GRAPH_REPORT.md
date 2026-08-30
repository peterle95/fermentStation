# Graph Report - fermentstation  (2026-08-30)

## Corpus Check
- Large corpus: 187 files À ~625,132 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 894 nodes · 1665 edges · 71 communities (53 shown, 18 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 140 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Core Domain Models
- Profile Management
- App Shell & Shared Data
- Architecture Concepts
- Capacitor Plugins
- Documentation & Agents
- Android Native Plugin
- Batch UI Components
- Design System Skills
- Rust Core Types
- Package Dependencies
- Batch Card Entry
- Batch Domain Logic
- Settings UI
- TypeScript Config
- Observation Logging
- Archive Workflow
- Photo Storage
- Shared Sync
- Calendar Workflow
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 61
- Community 62
- Community 63
- Community 64
- Community 65
- Community 66
- Community 67

## God Nodes (most connected - your core abstractions)
1. `BatchCard()` - 33 edges
2. `App()` - 30 edges
3. `SharedDirectoryPlugin` - 25 edges
4. `SharedDataStore` - 25 edges
5. `Profiles()` - 22 edges
6. `SettingsView()` - 20 edges
7. `FermentStation Domain Context` - 20 edges
8. `title_i18n` - 19 edges
9. `description_i18n` - 19 edges
10. `BatchState` - 18 edges

## Surprising Connections (you probably didn't know these)
- `FermentStation README` --conceptually_related_to--> `FermentStation Domain Context`  [INFERRED]
  README.md → CONTEXT.md
- `Camera Integration` --runs on--> `Capacitor`  [EXTRACTED]
  openwiki/platform/device-integrations.md → docs/android-desktop-implementation-gaps.md
- `Web Prototype Example (Tomato)` --semantically_similar_to--> `Web Prototype HTML Template`  [INFERRED] [semantically similar]
  .od-skills/web-prototype-5eeb6149b9/example.html → .od-skills/web-prototype-5eeb6149b9/assets/template.html
- `AFK Agent Log` --references--> `Issue Tracker`  [INFERRED]
  AFK_AGENT_LOG.md → docs/agents/issue-tracker.md
- `pH Levels in Fermentation` --conceptually_related_to--> `Observation Logger`  [INFERRED]
  docs/pH_levels.md → CONTEXT.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Web Prototype Composition System** — od_skills_web_prototype_skill, web_prototype_assets_template, web_prototype_references_layouts, web_prototype_references_checklist, web_prototype_example [EXTRACTED 1.00]
- **pH Fermentation Science Model** — ph_three_phase_model, ph_safety_threshold, ph_kombucha_threshold, ph_acidosis_risk, ph_inoculation_phase, ph_acidification_phase, ph_consumption_phase [EXTRACTED 1.00]
- **Issue Tracking and Wayfinding System** — docs_agents_issue_tracker, triage_label_vocabulary, wayfinder_map, wayfinder_child_ticket, root_afk_agent_log [EXTRACTED 1.00]
- **Shared Directory Bridge Contract** — architecture_shared_directory_bridge, platform_shared_directory_plugin, platform_tauri_commands, platform_browser_bridge [EXTRACTED 1.00]
- **Batch Domain Core** — openwiki_domains_batches, domains_batch_timeline, domains_calendar_events, domains_batch_lifecycle [EXTRACTED 1.00]
- **App Composition Root** — architecture_app_tsx, openwiki_domains_shell, openwiki_domains_profiles, openwiki_domains_batches [EXTRACTED 1.00]
- **Data synchronization and interchange flow** —  [INFERRED 1.00]
- **Platform capability adapters** —  [INFERRED 0.95]
- **UI prototype design patterns** —  [INFERRED 0.85]

## Communities (71 total, 18 thin omitted)

### Community 0 - "Core Domain Models"
Cohesion: 0.07
Nodes (29): BatchState, ProfileState, ArchiveImport, ArchiveRecords, BatchStore, NativeState, ProfileStore, asError() (+21 more)

### Community 1 - "Profile Management"
Cohesion: 0.06
Nodes (54): handleProfile(), addProfile(), assertValidProfile(), calculateProfileValue(), deleteProfile(), emptyProfileFields, evaluateFormula(), normalizeProfile() (+46 more)

### Community 2 - "App Shell & Shared Data"
Cohesion: 0.07
Nodes (40): App(), applySharedResult(), applySharedSnapshot(), chooseSharedLocation(), navigate(), persistShared(), reloadShared(), reloadSharedLocation() (+32 more)

### Community 3 - "Architecture Concepts"
Cohesion: 0.06
Nodes (53): Action queue, Android scoped storage, Archive exchange format, Atomic writes, Batch workspace, BatchState, Camera process death restoration, Capacitor (+45 more)

### Community 4 - "Capacitor Plugins"
Cohesion: 0.05
Nodes (38): @capacitor/app, @capacitor/camera, @capacitor/core, @capacitor/filesystem, @capacitor/local-notifications, @capacitor/share, @capawesome/capacitor-file-picker, fflate (+30 more)

### Community 5 - "Documentation & Agents"
Cohesion: 0.10
Nodes (33): Unified Observation Logging Rationale, Unified Observation Logging ADR, Domain Docs, Issue Tracker, Triage Labels, pH Levels in Fermentation, Batch, Batch Check (+25 more)

### Community 6 - "Android Native Plugin"
Cohesion: 0.18
Nodes (10): RecoveryEntry, SharedDirectoryPlugin, android.content.SharedPreferences, android.net.Uri, androidx.activity.result.ActivityResult, com.getcapacitor.annotation.ActivityCallback, com.getcapacitor.annotation.CapacitorPlugin, com.getcapacitor.Plugin (+2 more)

### Community 7 - "Batch UI Components"
Cohesion: 0.09
Nodes (25): BatchListFilter, BatchPicker(), BatchPickerProps, descriptions, displayTemperature(), formatCheckInterval(), formatNumber(), FormulaRow (+17 more)

### Community 8 - "Design System Skills"
Cohesion: 0.07
Nodes (30): assets, designSystem, skills, primary, od, capabilities, context, inputs (+22 more)

### Community 9 - "Rust Core Types"
Cohesion: 0.27
Nodes (21): AppHandle, Display, Option, Path, PathBuf, Result, atomic_write(), config_path() (+13 more)

### Community 10 - "Package Dependencies"
Cohesion: 0.08
Nodes (25): @capacitor/android, @capacitor/cli, jsdom, devDependencies, @capacitor/android, @capacitor/cli, jsdom, @tauri-apps/cli (+17 more)

### Community 11 - "Batch Card Entry"
Cohesion: 0.16
Nodes (21): BatchCard(), saveCheckName(), saveInputs(), saveNewCheck(), addBatchCheck(), addCalendarDays(), adjustBatchCheck(), assertCheckInterval() (+13 more)

### Community 12 - "Batch Domain Logic"
Cohesion: 0.14
Nodes (23): saveEntry(), fileToDataUrl(), addPhReading(), BatchCheck, BatchFilter, BatchStatus, batchStatuses, calendarDaysBetween() (+15 more)

### Community 13 - "Settings UI"
Cohesion: 0.14
Nodes (16): SettingsView(), addFormulaTerm(), downloadArchive(), formulaTermError(), importBytes(), pickArchive(), saveFormulaTerms(), uploadArchive() (+8 more)

### Community 14 - "TypeScript Config"
Cohesion: 0.09
Nodes (22): DOM, DOM.Iterable, ES2022, src, compilerOptions, allowJs, allowSyntheticDefaultImports, esModuleInterop (+14 more)

### Community 15 - "Observation Logging"
Cohesion: 0.14
Nodes (12): availableResultTerms(), availableSourceTerms(), createClientId(), formulaRows(), formulaTermLabel(), phRangeFor(), Profiles(), addCheck() (+4 more)

### Community 16 - "Archive Workflow"
Cohesion: 0.11
Nodes (19): description_i18n, ar, de, en, es, fr, id, it (+11 more)

### Community 17 - "Photo Storage"
Cohesion: 0.11
Nodes (19): title_i18n, ar, de, en, es, fr, id, it (+11 more)

### Community 18 - "Shared Sync"
Cohesion: 0.11
Nodes (17): icons/icon.ico, app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl (+9 more)

### Community 19 - "Calendar Workflow"
Cohesion: 0.12
Nodes (16): capacitor.config.ts, ES2023, vite.config.ts, compilerOptions, allowImportingTsExtensions, lib, module, moduleDetection (+8 more)

### Community 20 - "Community 20"
Cohesion: 0.21
Nodes (15): BatchView(), closeBatch(), save(), CalendarView(), CompactBatchCard(), formatToday(), localDate(), downloadJournal() (+7 more)

### Community 21 - "Community 21"
Cohesion: 0.17
Nodes (9): Android Icon Branding Mismatch, Teal-Green Gradient, FermentStation Logo, Kimchi Fermentation, Miso Fermentation, Vegetable Fermentation, App Navigation Structure, Fermentation Status System (+1 more)

### Community 22 - "Community 22"
Cohesion: 0.18
Nodes (14): App.tsx, Domain Layer, FermentationProfile, validateProfile, CalendarView, Profiles View, Today View, Profile Domain (+6 more)

### Community 23 - "Community 23"
Cohesion: 0.19
Nodes (7): BatchCardProps, BatchViewProps, ProfilesProps, Batch, TrashedBatch, FermentationProfile, Destination

### Community 24 - "Community 24"
Cohesion: 0.24
Nodes (6): ExampleInstrumentedTest, ExampleUnitTest, SharedDirectoryPluginTest, androidx.test.ext.junit.runners.AndroidJUnit4, org.junit.runner.RunWith, org.junit.Test

### Community 25 - "Community 25"
Cohesion: 0.23
Nodes (12): BridgeActivity, Android Dev Build Chain, Android Implementation Sequence, Android Native Implementation Gaps, Android/Desktop Implementation Gaps, Android Development Workflow, Build Operations, Deployment Configuration (+4 more)

### Community 26 - "Community 26"
Cohesion: 0.17
Nodes (11): compat, agentSkills, description, homepage, license, name, publishedAt, $schema (+3 more)

### Community 27 - "Community 27"
Cohesion: 0.17
Nodes (12): tags, design, desktop, example, first-party, homepage, landing, marketing-page (+4 more)

### Community 28 - "Community 28"
Cohesion: 0.29
Nodes (10): addTimelineEntry(), createBatch(), createBatchState(), profile(), cloneProfile(), createProfileState(), resolveArchiveCollisions(), emptyBatches (+2 more)

### Community 29 - "Community 29"
Cohesion: 0.29
Nodes (10): Single Accent Budget, Color Tokens, CSS Custom Properties (Tokens), Layout Primitives, Web Prototype Skill, Web Prototype, Web Prototype HTML Template, Web Prototype Example (Tomato) (+2 more)

### Community 30 - "Community 30"
Cohesion: 0.29
Nodes (7): SharedDirectoryBridge, Rust Unit Tests, Atomic Write, Browser Bridge, Storage Access Framework, SharedDirectoryPlugin, Tauri Commands

### Community 31 - "Community 31"
Cohesion: 0.29
Nodes (7): Batch Lifecycle, Batch Timeline, calendarEvents, Profile Snapshot, BatchView, Batch Domain, Batch Domain Tests

### Community 32 - "Community 32"
Cohesion: 0.33
Nodes (7): Acidification Phase, Acidosis Risk Threshold (2.5), Consumption Phase, Inoculation Phase, Kombucha Safety Threshold (4.2), pH Safety Threshold (4.6), Three-Phase Fermentation Model

### Community 33 - "Community 33"
Cohesion: 0.47
Nodes (4): MainActivity, android.os.Bundle, com.getcapacitor.BridgeActivity, Override

### Community 34 - "Community 34"
Cohesion: 0.60
Nodes (6): Platform Layer, Storage Architecture, Shared Data Store Tests, Browser Stores, Native Store, SharedDataStore

### Community 35 - "Community 35"
Cohesion: 0.33
Nodes (6): Splash Screen (Landscape), Splash Screen (Portrait), Splash Screen (Default), Launcher Icon, Launcher Icon Foreground, Launcher Icon (Round)

### Community 38 - "Community 38"
Cohesion: 0.40
Nodes (5): SettingsView, Archive System, Archive Tests, Archive Transfer Workflow, Native Transfer

### Community 39 - "Community 39"
Cohesion: 0.40
Nodes (4): currentVersionId, entries, fileName, schemaVersion

### Community 40 - "Community 40"
Cohesion: 0.40
Nodes (4): currentVersionId, entries, fileName, schemaVersion

### Community 41 - "Community 41"
Cohesion: 0.83
Nodes (3): gradlew script, die(), warn()

### Community 42 - "Community 42"
Cohesion: 0.83
Nodes (4): Shared Data Format, Manifest, Photos, Records

### Community 43 - "Community 43"
Cohesion: 1.00
Nodes (3): Storage Access Framework, SharedDirectoryPlugin, Capacitor Android Runtime

### Community 44 - "Community 44"
Cohesion: 0.67
Nodes (3): author, name, url

## Knowledge Gaps
- **250 isolated node(s):** `$schema`, `specVersion`, `name`, `title`, `zh-CN` (+245 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **18 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `SharedDataStore` connect `Core Domain Models` to `Batch UI Components`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Why does `Profiles()` connect `Observation Logging` to `Profile Management`, `App Shell & Shared Data`, `Community 23`, `Batch UI Components`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Why does `App()` connect `App Shell & Shared Data` to `Profile Management`, `Batch UI Components`, `Batch Domain Logic`, `Community 20`, `Community 28`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **What connects `$schema`, `specVersion`, `name` to the rest of the system?**
  _250 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Core Domain Models` be split into smaller, more focused modules?**
  _Cohesion score 0.06521739130434782 - nodes in this community are weakly interconnected._
- **Should `Profile Management` be split into smaller, more focused modules?**
  _Cohesion score 0.062003968253968256 - nodes in this community are weakly interconnected._
- **Should `App Shell & Shared Data` be split into smaller, more focused modules?**
  _Cohesion score 0.07058001397624039 - nodes in this community are weakly interconnected._