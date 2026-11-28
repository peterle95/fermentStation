# iOS home-screen app layout

How the installed iPhone app (a home-screen PWA) is made to fill the screen, why it once did not, and the rules that
keep it working. Confirmed on a device on 2026-11-27 (iOS 26.1+), in commit `c2da9a5`.

Files:

- `index.html`: the `viewport` meta (`viewport-fit=cover`) and `apple-mobile-web-app-status-bar-style`.
- `src/styles.css`: the `html, body` scroll lock and its standalone `min-height` rule (top of the file), `.app-shell`,
  the phone block (`@media (max-width: 599px)`), and the date-input rules after `input[type="file"]`.

## 1. Symptoms

In the installed app, never in Safari tabs or Chrome DevTools:

- The phone nav pill sat about 45–60 pt above the bottom of the screen, with a black band under it.
- The **Start date** field in *Start a batch* ran past the right edge of its blue card.

DevTools cannot reproduce either one. It runs Chromium with an emulated screen, while the installed app runs WebKit in
a standalone web view, whose viewport and form controls behave differently.

## 2. Causes

### Short viewport (the nav pill)

On iOS 26, a home-screen app that uses `viewport-fit=cover` together with the `black-translucent` status bar gets a
layout viewport that is **shorter than the screen by the status-bar height**. This happens while the document is no
taller than that viewport (WebKit bug 301108, reported by several projects, see Sources). Our page is locked to exactly
the viewport height, so it always hit the bug.

Everything sized to the viewport inherits the short height: `100vh`, `100dvh`, and `position: fixed; inset: 0` alike.
WebKit also clips fixed content at the short edge, so making the shell taller from JavaScript does not help either.

### Date field overflow

With its native appearance, an iOS date input ignores `width` and `min-width` and centres its value. It then grows to
fit the value instead of filling the card.

## 3. What did not work

1. **Measuring the shortfall in JavaScript** (`screen.height` minus the viewport height) and applying it as
   `--app-height`. The shell grew, but the whole document became scrollable. `overflow: hidden` on `<html>` alone does
   not stop document scrolling in iOS standalone mode, so the top bar and the nav scrolled away.
2. **Pinning the shell with `position: fixed; inset: 0`** and locking `html, body`. This stopped page scrolling, but
   the fixed box inherited the short viewport, so the original gap came back.
3. **An on-screen viewport readout** (`viewport-debug.ts`). It showed nothing in the installed app and was removed.

## 4. The fix

1. **Opaque status bar.** In `index.html`, `apple-mobile-web-app-status-bar-style` is `black` instead of
   `black-translucent`. The web view then starts below the status bar, the bug's trigger is gone, and the result does
   not depend on the iOS version or the iPhone model. `theme-color` is `#000000`, so the bar looks as it did before.
   As a side effect, `env(safe-area-inset-top)`, and so `--safe-top`, is `0` in the installed app.
2. **Reinstall.** iOS reads the status-bar style only when the app is added to the home screen (WebKit 316008). After
   changing it, delete the app from the home screen and add it again. Without that, the old style stays in effect.
3. **Fallback for old installs.** An app still installed with the translucent bar is covered by a standalone-only rule:

   ```css
   @media (display-mode: standalone) {
     html { min-height: min(100lvh, calc(100% + env(safe-area-inset-top, 0px))); }
   }
   ```

   This makes the document at least screen-tall, which makes iOS give the page the full screen. Where the viewport is
   already correct, `100% + inset` is larger than `100lvh`, and `min()` keeps the page at `100lvh`. With the opaque bar
   the inset is `0`, so the rule changes nothing.
4. **Only the content scrolls.**
   - `html, body { height: 100%; overflow: hidden; overscroll-behavior: none; }` stops the page itself from scrolling
     and rubber-banding.
   - `.app-shell` is `position: fixed; inset: 0` and is not sized with `100vh` or `100dvh`.
   - On phones, the shell's rows are `minmax(0, 1fr) auto`. The top bar (`.design-topbar`) stays pinned.
     `.main-content` and `.design-dashboard` are the only scroll panes, and they scroll under the glass nav.
   - The nav adds `--safe-bottom` to its own padding, so the pill sits clear of the home indicator.
   - The phone `.station-dialog` takes its height from the shell, with `max-height: calc(100% - …)` rather than viewport
     units.
5. **Date inputs.** `appearance: none` and a left-aligned value make iOS respect the field's width:

   ```css
   input:is([type="date"], [type="time"], [type="datetime-local"]) { display: block; -webkit-appearance: none; appearance: none; text-align: start; }
   input::-webkit-date-and-time-value { margin: 0; text-align: start; }
   ```

## 5. Rules for later changes

- Do not switch the status bar back to `black-translucent`. If content behind the status bar is ever wanted, test it on
  an iOS 26 device first and keep the standalone `min-height` rule.
- Do not size the shell or full-screen layers with `100vh`, `100dvh` or `100svh`. Fill the fixed shell (`100%`,
  `inset: 0`, grid rows) instead. Two leftovers still use viewport units: the desktop dialog `max-height` (`100svh`)
  and `.fixed-wrapper` in `StaggeredMenu.css` (`100vh`).
- Keep scrolling inside the panes. Anything new that is taller than the screen belongs in `.main-content`, a dashboard
  pane or a dialog, never on `body`.
- Keep using the `--safe-*` tokens rather than hard-coded insets. In the installed app, `--safe-top` is now `0`, while
  in Safari and on Android it keeps its real value.
- Changes to anything in `<head>` that iOS reads at install time (status-bar style, icons, `apple-mobile-web-app-*`)
  need a reinstall before they can be judged on a device.

## 6. Verifying

- `npm run screenshots` (see `visual-verification.md`). Compared with the baseline, the page no longer overflows
  (`documentVerticalOverflow 1 -> 0`). `clippedControls 0 -> 1` is the skip link, which is parked off-screen on purpose
  and now counts as clipped because `body` clips. The `surfaceOverflow` on `batch-creation` comes from the batch cards
  behind the dialog and was already there.
- On a device: reinstall the app, then check four things:
  - The nav pill sits just above the home indicator, with no black band under it.
  - The top row stays put while the content scrolls.
  - Content scrolls under the glass nav.
  - The Start date field fits inside its card.

## Sources

- WebKit bugs: [301994](https://bugs.webkit.org/show_bug.cgi?id=301994),
  [292603](https://bugs.webkit.org/show_bug.cgi?id=292603), [316008](https://bugs.webkit.org/show_bug.cgi?id=316008)
- [Apple Developer Forums thread 799216](https://developer.apple.com/forums/thread/799216)
- The standalone `min-height` workaround: [frappe-ui #1284](https://github.com/frappe/frappe-ui/pull/1284)
- The opaque status bar: [FamilyHub #3](https://github.com/AliakseiKondrat/FamilyHub/pull/3),
  [Stock-market #19](https://github.com/CLAY-PSY/Stock-market/pull/19), [qui #2520](https://github.com/autobrr/qui/issues/2520)
- Other reports of the same gap: [ultrapilot #12](https://github.com/campeterson/ultrapilot/pull/12),
  [dizey #155](https://github.com/ErenDenizK/dizey/pull/155), [jargon-gym #181](https://github.com/behnamazimi/jargon-gym/pull/181),
  [orbis-homelab #7](https://github.com/al31si/orbis-homelab/pull/7), [coffee-log #25](https://github.com/sebastianval22/coffee-log/pull/25),
  [Daily-Habbit-Tracker #24](https://github.com/Brawnet/Daily-Habbit-Tracker/pull/24),
  [proyecto-ai #129](https://github.com/mariete1223/proyecto-ai/issues/129), [wai #29](https://github.com/misalnyadev/wai/pull/29),
  [Framework7 forum](https://forum.framework7.io/t/kitchen-sink-pwa-ios-26-1-bottom-tabs-issue/24786)
