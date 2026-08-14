# Android Development Workflow

## Why changes were not appearing

FermentStation is a Capacitor application. The user interface is written in
React and lives primarily in `src/`. Android Studio does not execute that
source code directly.

The Android application packages a compiled copy of the React application from:

```text
android/app/src/main/assets/public/
```

The normal flow is:

```text
React source (`src/`)
  -> Vite build (`dist/`)
  -> Capacitor copy (`android/app/src/main/assets/public/`)
  -> Gradle Android build (APK)
  -> installation on device/emulator
```

The source code was changed successfully, but the Android asset copy was stale.
`dist/` contained the newer React bundle while Android Studio was still
packaging the older bundle in `android/app/src/main/assets/public/`. Therefore
rebuilding or reinstalling that Android project continued to show the old
Today tab.

This made it look as if React changes were being ignored. They were not being
ignored; the Android package simply had not received the new React build.

## What React and Android package

React is the application UI layer:

- Components, navigation, screens, and behavior are in `src/`.
- Vite compiles those files into browser assets in `dist/`.
- The resulting JavaScript and CSS run inside a Capacitor WebView.

Android is the native container and distribution layer:

- The project is `android/`.
- Gradle compiles the native Android wrapper and Capacitor plugins.
- The APK includes the copied WebView assets.
- Android Studio installs the APK; it does not automatically rebuild React
  source unless the web build and copy steps are part of the Gradle workflow.

Changing `src/App.tsx` alone changes only the source. It does not change an
already-installed APK.

## How it was fixed

The Android project now has Gradle tasks in `android/app/build.gradle` that:

1. Run `npm run build` from the repository root.
2. Copy `dist/` into `android/app/src/main/assets/public/`.
3. Run automatically before Android's `preBuild` task.

As a result, Android Studio's normal **Run** action now builds the current
React code before packaging and installing the app.

The Today removal also remains platform-specific: browser and desktop retain
Today, while Android hides it and redirects an Android session saved on Today
to Batches.

## Recommended future workflow

### Android Studio

1. Open `fermentstation/android`, not the repository root.
2. Use **File > Sync Project with Gradle Files** after Gradle configuration
   changes.
3. Select the correct emulator or connected device.
4. Click **Run app**. This builds and installs the current APK.
5. If the old UI remains, uninstall the app from the device once, then run it
   again. This removes any confusion about which APK is installed.

### Terminal

From the repository root:

```powershell
npm run build
npm exec cap copy android
```

Then build or run from Android Studio. The explicit copy command is useful for
diagnosis, but the Gradle hook now performs the same work during Android builds.

To build without opening Android Studio:

```powershell
.\android\gradlew.bat -p android :app:assembleDebug
```

The debug APK is normally written under:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## How to verify which version is being used

If a change is not visible:

1. Confirm the source change exists in `src/`.
2. Run `npm run build` and check that `dist/` was regenerated.
3. Run `npm exec cap copy android` and confirm the timestamp/content under
   `android/app/src/main/assets/public/` changed.
4. Rebuild with Android Studio's **Run app** action.
5. Confirm Android Studio is using this project:
   `C:\Users\molze\GitHub\fermentstation\android`.
6. Confirm the installed application ID is `com.peterle.fermentstation`.

The Android app can only display the code that was included in the APK most
recently installed on the device. Reinstalling an old APK, launching a
previous emulator installation, or building without copying the web assets
will show an older version even when the source files are correct.
