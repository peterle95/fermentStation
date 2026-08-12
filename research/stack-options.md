# React/TypeScript Application Stack

Research for [issue #2](https://github.com/peterle95/fermentstation/issues/2), researched 2026-08-07. Sources are official framework/platform documentation or standards.

## Recommendation

Use **React + TypeScript + Vite**, with:

- Android packaged by **Capacitor**.
- Desktop packaged by **Tauri 2**.
- One web-first UI and shared domain/storage/export code; platform capabilities stay behind small adapters.
- A private SQLite database and private photo files per installation.
- Explicit ZIP export/import as the supported portability path; optional Syncthing may transport an exchange folder, never the live database.

This is the best v1 balance for a DOM-based React app: Capacitor has official Android camera and scheduled local-notification plugins, while Tauri supplies a small installable desktop shell, filesystem, SQL, file-dialog, and notification plugins. Tauri's desktop camera can use the standard web media API, but requires OS/webview testing. [1][2][3][4][5][6][7][8][21]

The recommendation has one deliberate limitation: Tauri's documented notification plugin sends notifications but does not provide a cross-platform schedule API. Scheduled reminders are therefore guaranteed on Android first; desktop scheduling needs a small OS-specific/Tauri-native adapter and must pass a capability spike before being promised. [3]

## Comparison

| Stack | Code sharing | Native APIs | Packaging and local fit | Maintenance and limits | Verdict |
| --- | --- | --- | --- | --- | --- |
| **Capacitor Android + Tauri desktop** | High for React DOM, TypeScript domain logic, records, ZIPs, and sync. Native adapters differ. | Capacitor: official camera, scheduled local notifications, and filesystem. Tauri: filesystem, SQL/SQLite, dialogs, and immediate notifications; camera via `getUserMedia()`. | Capacitor builds Android through the native toolchain; Tauri builds Android plus desktop installers/bundles. Both run offline and have no required hosted runtime. [21][29] | Two native shells and two plugin families. Capacitor's SQLite option is community-maintained; Tauri scheduling and desktop camera need validation. | **Recommended** |
| **Capacitor Android + Electron desktop** | High for the same web UI and TypeScript layers. | Same strong Capacitor Android path. Electron gives Chromium camera, desktop notifications, Node/main-process filesystem, and IPC. | Electron Forge is the documented packaging path; Electron ships Chromium and Node in each app. | Easier desktop filesystem/background integration, but larger binaries and more Chromium/Node security, update, and packaging surface. Electron has no Android target. [9][10][11][12] | Viable fallback if desktop native integration outweighs size |
| **Tauri Android + desktop** | Highest single-wrapper web code sharing. | Official filesystem, SQL, dialogs, and notifications support Android and desktop. The official plugin catalog does not provide a camera plugin; camera would be web API or custom native code. No portable scheduled-notification API. [3][5][6][7][30] | One CLI and installer model for Android and desktop; system webviews reduce bundled size. [21] | Rust/native-plugin work is added exactly where v1 has camera and scheduled-reminder risk. | Reject for v1; reconsider after a native capability spike |
| **React Native + Expo Android + Expo Web/PWA** | High for domain code; UI can share through React Native Web, but native UI primitives and DOM desktop UI are not identical. [13][14] | Expo Camera supports Android and Web; Expo Notifications schedules local notifications on Android but targets Android/iOS, not desktop web. Expo SQLite persists native databases; Web SQLite is alpha and needs WASM/shared-memory headers. Expo FileSystem handles native files. [15][16][17][18] | Android builds can run locally; Expo Web exports a website, not a first-party native desktop installer. EAS Build is hosted but optional, and local builds exist. [19][20] | Excellent Android API coverage, but a browser/PWA desktop has weaker filesystem/notification guarantees and native storage differences. | Good only if desktop means browser/PWA |
| **React Native + Windows/macOS desktop** | Native UI/domain sharing is possible, but desktop platforms are partner/community maintained out of tree. [22] | Android APIs are strong through Expo; camera, notifications, storage, and packaging must be verified separately on each desktop implementation. | Multiple native projects and distribution pipelines. | More platform owners, native dependencies, and test matrices than this v1 needs. | Reject unless native desktop UI is a requirement |
| **Electron alone** | Excellent web/TypeScript sharing on desktop. | Strong desktop Chromium/Node APIs, but no supported Android binary target; Electron officially provides macOS, Windows, and Linux binaries. [9][10] | Good desktop packaging, impossible as the complete Android stack. | No Android path. | Reject |
| **Capacitor alone** | Excellent web/TypeScript sharing and a browser/PWA fallback. | Strong Android plugins. | Capacitor documents Android/iOS and Web/PWA, not a native desktop shell; desktop would be a browser/PWA. [1] | Does not satisfy an installed native desktop target without another shell. | Reject if native desktop is required |

## Requirement Fit

### Camera and notifications

- Capacitor Camera takes a photo or selects gallery media on Android. The plugin launches a separate Android Activity, so the app must handle `appRestoredResult` if the OS terminates the app while the camera is open. [2]
- Capacitor Local Notifications schedules locally without a server. Android 13 requires notification permission; Android 12+ exact alarms need additional handling, and Doze affects delivery. Reminders should tolerate inexact delivery and reconcile on app launch. [3]
- Tauri's notification plugin supports Windows, Linux, macOS, Android, and iOS, but its documented operations are permission checks, sending, cancellation, and related notification actions, not portable future scheduling. [4]
- Tauri's renderer can use W3C `getUserMedia()` for desktop camera access. The specification defines the API, not uniform capture behavior across Tauri's system webviews, so camera permissions, device selection, image capture, and fallback file import need OS testing. [7]
- Electron exposes Chromium/web notifications and a main-process `Notification` API. Windows needs installed-app identity/shortcut setup; macOS notification events require code signing. Electron exposes camera permission status/request APIs on Windows and macOS. [10][11]

### Offline storage, photos, and portability

Use an application-owned storage port with separate record and media operations:

```text
private installation data: SQLite database + photo files
portable ZIP:
  manifest.json
  records/<stable-id>.json
  photos/<content-hash>.<extension>
```

SQLite is appropriate for each installation. Tauri has an official SQL plugin with SQLite support on Android and desktop. Capacitor's storage guide identifies SQLite as the common large-data option but points to community plugins, so Android should use a vetted community plugin or a small native plugin behind the same port. Browser Local Storage is transient and IndexedDB has eviction caveats in Capacitor's own guidance. [5][6]

Keep photos as durable ordinary files referenced by records, not as the transport database's BLOB payload. Capacitor Filesystem supports binary file reads/writes and notes that Android `Documents` access is limited to app-created files on Android 11+. User-selected import/export should use a system picker. Tauri's dialog plugin provides open/save dialogs and its filesystem plugin scopes access deliberately. [6][8][23]

Do not sync a live SQLite file, WAL, or journal. SQLite says a filesystem copy during an active transaction can mix old and new content, and associated journal/WAL files must remain paired; use the SQLite Online Backup API or `VACUUM INTO` for a database snapshot. Exchange record files and photos instead. [24][25]

ZIP export/import is the v1 guarantee: validate archive shape, schema version, stable IDs, photo hashes, and collisions before writing to local SQLite. Optional Syncthing can transport the same immutable exchange folder at no recurring application-infrastructure cost, but it is file synchronization rather than record merging and its Android client/operational behavior must be validated separately. [26][27]

## Implementation Shape

1. Build a Vite React DOM app. Keep domain types, validation, repositories, ZIP format, and conflict rules free of Capacitor/Tauri imports. [28]
2. Define small ports for `RecordStore`, `PhotoStore`, `ArchiveTransfer`, `Camera`, and `LocalReminder`.
3. Implement Android with Capacitor Camera, Local Notifications, Filesystem, a vetted SQLite adapter, and the Android system file picker.
4. Implement desktop with Tauri SQL, filesystem, dialog, and notification plugins; use web camera capture with file-import fallback. Add desktop scheduling only through a tested native adapter.
5. Run a capability spike before feature work: capture and durably copy a photo, schedule and deliver an Android reminder after restart/Doze, export/import a photo ZIP, and exercise desktop camera/file/notification behavior on supported OSes.

## Assumptions

- Desktop means an installable Windows/macOS/Linux app, not only a browser tab.
- Local notifications must work without a server; Android scheduled reminders are the v1 hard guarantee. Desktop notification delivery while the app is closed is a release acceptance criterion, not something Tauri's notification plugin supplies automatically.
- "Zero recurring infrastructure cost" excludes optional store registration, signing/notarization, hardware, hosting chosen by the user, and an optional Syncthing installation. Expo EAS cloud builds are not required; local builds are documented. [19][20]
- The data model follows the repository context: batches, fermentation profiles, and timeline entries, with photos attached to timeline entries.

## Rejected Alternatives

- Electron alone: no Android target in the official platform support list. [9]
- Capacitor alone: no native desktop shell; it leaves desktop as Web/PWA. [1]
- Tauri alone: camera and scheduled-notification seams are too risky for the first Android release despite its strong filesystem/SQLite and packaging story. [3][4][5][7]
- Expo/RN as the sole stack: strongest Android API coverage, but native desktop is not first-party Expo parity and Expo Web has alpha SQLite plus browser filesystem/notification limits. [14][17][18][22]
- Syncing per-installation `.db` files through Syncthing or another file synchronizer: unsafe for SQLite transaction/journal/WAL semantics and not a conflict-resolution model. [24][26]

## Sources

1. Capacitor introduction and platform shape: https://capacitorjs.com/docs/
2. Capacitor Camera: https://capacitorjs.com/docs/apis/camera
3. Capacitor Local Notifications: https://capacitorjs.com/docs/apis/local-notifications
4. Tauri Notifications: https://v2.tauri.app/plugin/notification/
5. Tauri SQL: https://v2.tauri.app/plugin/sql/
6. Capacitor storage and Filesystem: https://capacitorjs.com/docs/guides/storage and https://capacitorjs.com/docs/apis/filesystem
7. W3C Media Capture and Streams: https://www.w3.org/TR/mediacapture-streams/
8. Tauri File System and Dialog: https://v2.tauri.app/plugin/file-system/ and https://v2.tauri.app/plugin/dialog/
9. Electron platform support: https://github.com/electron/electron#platform-support
10. Electron process model and notifications: https://www.electronjs.org/docs/latest/tutorial/process-model and https://www.electronjs.org/docs/latest/tutorial/notifications
11. Electron camera permissions: https://www.electronjs.org/docs/latest/api/system-preferences
12. Electron packaging: https://www.electronjs.org/docs/latest/tutorial/application-distribution and https://www.electronforge.io/
13. React Native getting started: https://reactnative.dev/docs/environment-setup
14. Expo Web: https://docs.expo.dev/workflow/web/
15. Expo Camera: https://docs.expo.dev/versions/latest/sdk/camera/
16. Expo Notifications: https://docs.expo.dev/versions/latest/sdk/notifications/
17. Expo SQLite: https://docs.expo.dev/versions/latest/sdk/sqlite/
18. Expo FileSystem: https://docs.expo.dev/versions/latest/sdk/filesystem/
19. Expo EAS Build: https://docs.expo.dev/build/introduction/
20. Expo local builds: https://docs.expo.dev/build-reference/local-builds/
21. Tauri distribution and architecture: https://v2.tauri.app/distribute/ and https://v2.tauri.app/start/
22. React Native out-of-tree platforms: https://reactnative.dev/docs/out-of-tree-platforms
23. Android storage and document picker guidance: https://developer.android.com/training/data-storage/shared/documents-files
24. SQLite corruption and safe copying: https://www.sqlite.org/howtocorrupt.html
25. SQLite Online Backup API: https://www.sqlite.org/backup.html
26. Syncthing synchronization/conflicts: https://docs.syncthing.net/users/syncing.html
27. Syncthing downloads and Android support caveat: https://syncthing.net/downloads/
28. Vite: https://vite.dev/guide/
29. Capacitor Android: https://capacitorjs.com/docs/android
30. Tauri plugin catalog: https://v2.tauri.app/plugin/
