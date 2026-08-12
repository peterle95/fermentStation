# Android and Desktop Implementation Gaps

Status: code-based comparison, 2026-08-09

## Scope

This document compares the current desktop target (Tauri) with the Android target
(Capacitor). Both targets build the same React/Vite application from `src/`.
The comparison is based on the repository implementation, not a manual test on a
physical Android device.

## Executive Summary

The Android app is currently a responsive version of the shared web UI, not a
separate native feature implementation. The product workflows are mostly shared:
profiles, batches, calendar, observation logging, photos, status changes,
calculations, recurring checks, trash recovery, and ZIP import/export all exist in
the React layer.

The important phone gaps are:

1. Settings is hidden from the phone navigation, so units, reminders, suggestions,
   formula terms, trash recovery, and archive transfer are inaccessible in the
   normal Android UI.
2. The phone's overflow/menu buttons are rendered but have no action.
3. Check reminders are only a stored preference. No Android notification scheduling
   or notification permission flow exists.
4. Android-native camera, filesystem, sharing, and durable database adapters are not
   implemented. Photo capture and file transfer rely on browser/WebView behavior.
5. There is no automatic desktop/phone synchronization. Manual ZIP transfer is the
   intended portability path, but Android-specific export/import behavior needs a
   system picker or share flow and real-device verification.

## Target Architecture

| Area | Desktop | Android | Evidence |
| --- | --- | --- | --- |
| UI | React/Vite DOM app in Tauri WebView | Same React/Vite DOM app in Capacitor WebView | `src/main.tsx`, `src-tauri/tauri.conf.json`, `capacitor.config.ts` |
| Native entry point | Tauri window, no custom Rust commands | `BridgeActivity` with no custom native code | `src-tauri/src/main.rs`, `android/.../MainActivity.java` |
| Record storage | Browser `localStorage` | Browser `localStorage` in the WebView | `src/platform/*-store.ts` |
| Photos | `FileReader` to `data:` URL | Same `FileReader` path; HTML file input with `capture="environment"` | `src/App.tsx:892-953`, `src/App.tsx:1690-1697` |
| Archive transfer | Browser download link and file input | Same browser download link and file input | `src/App.tsx:374-429` |
| Native plugins | None used by the app | Capacitor core/android only; no Camera, Filesystem, Share, or Local Notifications plugin | `package.json`, `android/app/build.gradle` |
| Notifications | None | None | No notification import, permission, manifest receiver, or scheduler exists |

The repository research already recommends this long-term shape: shared domain
code with platform adapters for records, photos, archive transfer, camera, and
local reminders (`research/stack-options.md:61-67`). The current implementation
has not reached those adapters.

## Feature Comparison

### Shared and available on the phone

These features are implemented in shared React/domain code and should be present
on Android when the screen is reachable and the WebView supports the browser API.

| Feature | Current implementation | Phone status |
| --- | --- | --- |
| Today queue | Prioritizes overdue/due checks and ready batches | Shared |
| Batch creation | Select profile, start date, optional name, profile inputs | Shared |
| Batch list and status filters | All, active, ready, to-fridge, active with attention | Shared |
| Batch status changes | Active, ready, and to-fridge with timeline history | Shared |
| Finish date | Sets finish date and derives ready/active state | Shared |
| Profile management | Create, view, edit, delete profiles | Shared |
| Profile guidance | Ordered guidance steps and profile snapshot | Shared |
| Profile checks | Create recurring checks and copy them into new batches | Shared |
| Batch-local checks | Add, rename, adjust, remove, and complete checks | Shared |
| Calendar | Month navigation, finish dates, checks, upcoming and overdue lists | Shared |
| Notes and measurements | Dated add, edit, delete, and restore | Shared |
| pH readings | Dated readings with zones and range warnings | Shared |
| Temperature readings | User-facing metric/imperial input stored as Celsius | Shared, but settings are phone-inaccessible |
| Status and check timeline entries | Unified observation logger | Shared |
| Photos | Attach, display, edit caption, delete, restore | Shared code; camera/file behavior unverified on device |
| Calculations | Suggested values and per-batch overrides | Shared |
| Seven-day recovery | Batch and timeline trash with restore | Shared code; batch trash UI is phone-inaccessible |
| Local persistence | Profile, batch, and shell state saved locally | Shared mechanism, weak Android durability guarantee |

Relevant implementation: `src/App.tsx:181-309`, `src/App.tsx:542-637`,
`src/App.tsx:654-847`, `src/App.tsx:877-1210`, `src/App.tsx:1327-1635`,
`src/domain/batches.ts`, and `src/domain/profiles.ts`.

### Different or missing on the phone

| Priority | Capability | Desktop current behavior | Android current behavior | Required implementation |
| --- | --- | --- | --- | --- |
| P0 | Settings access | Settings is a visible sidebar destination | Settings is removed from the bottom navigation at mobile widths; the overflow button does nothing | Add a working phone menu or make Settings a reachable navigation destination. Preserve destination state and back behavior. |
| P0 | Data recovery and transfer access | Export ZIP, import ZIP, collision resolution, journal export, and batch trash restore are reachable in Settings | These controls cannot be reached through the phone UI | Expose the existing SettingsView on Android first; then replace browser-only transfer with Android-safe picker/share operations. |
| P0 | Check reminders | Preference can be toggled, but no notification is scheduled | Same missing behavior, plus no Android permission/request flow | Implement local Android notifications. Schedule/cancel from active batch checks, request Android 13+ permission, reconcile on app launch, and respect pause/status changes. |
| P1 | Durable record storage | Data is in Tauri WebView `localStorage` | Data is in Capacitor WebView `localStorage`, subject to WebView storage behavior and app lifecycle | Introduce a shared storage port and Android SQLite-backed record store. Keep domain validation independent of Capacitor. |
| P1 | Durable photo storage | Photos are embedded as base64 data URLs in localStorage | Same base64 data URLs, increasing storage pressure and relying on WebView storage | Add Android Filesystem-backed photos and store stable photo references in records. Keep ZIP hash validation. |
| P1 | Archive export/import | Browser-generated ZIP download and `<input type=file>` import | Same browser path; Android download destination and file access are not defined | Add Android Filesystem plus system document picker/share flow. Verify imports from Downloads, Files, and another app. |
| P1 | Camera capture | Desktop uses the file input path; no native camera adapter | `capture="environment"` requests browser/WebView capture, but no Capacitor Camera plugin or restoration handling exists | Add an Android camera adapter, handle `appRestoredResult`, and retain gallery/file fallback. |
| P2 | Sharing | No native share action exists; archive uses an anchor download | No native share action exists | Add optional Android Share for exported ZIP/journal after export works through a system URI. |
| P2 | Phone navigation polish | Desktop has persistent sidebar and visible Settings | Bottom navigation hides Settings; profile editor's mobile menu is also inert | Implement menu actions, Android back handling, focus restoration, and a reachable Settings/trash route. |
| P2 | Responsive acceptance | Desktop has a 1100x760 Tauri window and wide layout | CSS has mobile breakpoints, including single-column batch components and fixed bottom actions | Test real phone widths, keyboard resize, rotation, back navigation, file picker return, and large photos. |
| P2 | Background behavior | No desktop reminder guarantee exists | No background work exists | Do not promise phone reminders or sync until notification and lifecycle tests pass. |

## Existing Phone UX Defects

These are concrete differences in the current shared UI rather than future native
features:

- At `src/styles.css:1463-1467`, the last navigation button, Settings/More, is
  hidden below 899px.
- At `src/App.tsx:177`, the mobile `More options` button has no `onClick` handler.
- At `src/App.tsx:1500`, the profile editor mobile menu button also has no action.
- Settings contains the only visible controls for units, check reminders,
  suggestions, formula terms, journal export, ZIP exchange, and recently deleted
  batches (`src/App.tsx:431-529`).
- The Android manifest only declares `INTERNET`; there is no notification permission
  or native media/storage integration (`android/app/src/main/AndroidManifest.xml`).

## Recommended Implementation Sequence

### 1. Restore phone access to existing features

Files: `src/App.tsx`, `src/styles.css`, `src/App.test.tsx`

- Add a phone-visible menu or a Settings destination in the bottom navigation.
- Wire the existing overflow button to that menu.
- Make the profile editor menu return to Profiles or expose the same menu.
- Add tests that render at a mobile viewport and open Settings, restore a batch,
  and reach archive controls.

Exit criteria: every desktop Settings capability has an Android navigation path;
no control is visible without an action.

### 2. Add Android-native reminders

Files: `package.json`, `capacitor.config.ts`, `android/app/src/main/AndroidManifest.xml`,
new platform adapter, shared reminder scheduling seam, and tests.

- Add Capacitor Local Notifications.
- Request notification permission on the first reminder enable action.
- Schedule the next due date for active batch checks.
- Cancel or reschedule when a check is completed, renamed, removed, adjusted, or
  the batch changes status.
- Reconcile all schedules on app launch because Android may delay or drop work
  under Doze or after app restore.
- Keep reminders as a convenience; Today and Calendar remain the source of truth.

Exit criteria: an Android 13+ device receives an inexact local reminder after app
restart; a paused/ready batch does not notify; completion schedules the next date.

### 3. Replace WebView storage with durable Android storage

Files: `src/platform/`, new shared storage interfaces, Android native/plugin setup,
and migration tests.

- Define record and photo operations without importing Capacitor or Tauri into the
  domain layer.
- Store profiles, batches, timeline entries, and trash in SQLite or an equivalent
  durable Android store.
- Store photos as files and retain MIME type, stable reference, and hash metadata.
- Migrate existing `localStorage` data once, only after validating it with the
  existing parsers.

Exit criteria: force-stop/relaunch and low-storage tests retain valid records and
photos; migration does not duplicate records.

### 4. Implement Android file exchange and camera adapters

Files: `src/platform/archive.ts`, new Android adapters, Capacitor plugin setup,
and device tests.

- Export ZIP to a user-selected location or share URI, not an opaque WebView
  download.
- Import ZIP through the Android system document picker.
- Keep current archive schema, stable-ID collision handling, and photo hash checks.
- Use Capacitor Camera for capture/gallery selection and handle activity restoration.
- Keep file input as a fallback for unsupported devices or failed permissions.

Exit criteria: export to Downloads, share to another app, import from Files, and
capture a photo on a supported Android device.

### 5. Add phone-specific release verification

Test at minimum on Android 13+ and one smaller phone viewport:

- Cold launch, process death, force-stop, relaunch, and device rotation.
- Bottom navigation, Settings access, Android back button, keyboard, and scroll.
- ZIP export/import with and without photos, including identifier collisions.
- Camera permission denial, gallery fallback, and activity restoration.
- Notification permission denial, reboot/relaunch, overdue checks, and paused
  batches.
- Large photo and storage-pressure behavior.

## Non-goals

- Do not synchronize the live local database or its WAL/journal between devices.
- Do not add a cloud account or hosted backend solely to make the phone match the
  desktop.
- Do not duplicate the domain logic in a native Android UI. Keep the shared React
  workflows and add native adapters only where WebView behavior is insufficient.
- Do not treat the `checkReminders` toggle as complete until it produces and
  reconciles real Android notifications.

The repository's portability decision is manual ZIP export/import first, with an
optional exchange-folder transport later (`research/free-offline-sync-photo-storage.md:5-17`).

## Verification Baseline

At the time of this comparison:

- `npm test -- --run`: passed, 81 tests.
- `npm run build`: passed.
- No Android instrumentation tests cover product workflows; the generated Android
  tests are the default Capacitor sample tests.
- No physical-device Android verification was performed for camera, downloads,
  storage persistence, notifications, or activity restoration.
