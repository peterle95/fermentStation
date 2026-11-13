# Visual verification

One command shows what the app looks like on every primary surface at every target viewport, with realistic data, and writes a machine-readable layout report next to the images. Use it before and after any UI change, and compare against the reference artwork in `out/www.orbix.studio/screenshots/source/` (`ui-board.png`, `drinks-board.png`).

## Commands

```sh
npm run screenshots                                   # everything -> screenshots/current/
npm run screenshots -- -s batch-detail                # one surface, all viewports
npm run screenshots -- -s batch-detail -v phone       # one surface, one viewport
npm run screenshots -- -s checks,calendar -v 390x844,320x640
npm run screenshots -- --list                         # surface and viewport names
npm run screenshots -- --help                         # all options
```

`npm run screenshots:baseline` writes the baseline tree instead (see [Baseline](#baseline)); it refuses to overwrite an existing baseline without `--force`.

The script starts its own Vite dev server (port 5199, or the next free one), launches the Chrome or Edge already installed on the machine in headless mode over the DevTools protocol, and shuts both down when it finishes. Nothing is downloaded; there is no Playwright or Puppeteer. Set `CHROME_PATH` or pass `--browser PATH` if neither browser is in its default location.

Timings on this machine (Chrome 157, 4 parallel pages):

| Run | Time |
| --- | --- |
| Full run, 12 surfaces x 5 viewports, with full-height captures | 90-110 s |
| One surface x one viewport, script starts its own server | about 20 s |
| One surface x one viewport against a running dev server (`--url`), `--no-full` | about 6 s |

For a tight loop while editing one component, keep `npm run dev` running and point the script at it:

```sh
npm run screenshots -- --url http://localhost:5173 -s observation-logger -v phone --no-full
```

The exit code is 1 when a capture failed or a navigation step broke; layout findings alone do not fail the run.

## What is captured

Viewports (name, alias for `-v`):

| Name | Alias | Layout |
| --- | --- | --- |
| `1440x900` | `desktop` | desktop (>= 1024 CSS px) |
| `1024x768` | `tablet-landscape` | desktop, exactly at the 1024 breakpoint |
| `768x1024` | `tablet-portrait` | tablet (600-1023) |
| `390x844` | `phone` | phone (< 600) |
| `320x640` | `phone-small` | phone, narrowest supported |

Everything except `1440x900` is emulated as a touch device and navigated with touch taps; `1440x900` uses the mouse.

Surfaces (`-s`):

| Name | What it shows | How it is reached |
| --- | --- | --- |
| `overview` | Batch overview (My batches) | app start |
| `all-batches` | All batches list | tap the "All batches" switch |
| `batch-detail` | Batch detail for "Napa cabbage kimchi" | tap its card |
| `observation-logger` | Batch detail with the Add observation logger open | tap "Add observation" |
| `batch-tools` | Batch tools, scrolled into view | tap "More batch tools" |
| `checks` | Checks view | navigation |
| `calendar` | Calendar | navigation |
| `profiles` | Fermentation profiles | navigation |
| `profile-editor` | Profile editor for Kimchi | tap "Edit Kimchi" |
| `batch-creation` | Start a batch dialog | tap "Start a batch" |
| `settings` | Settings | tap the settings button |
| `first-run` | Empty first-run state, no saved data | app start with an empty store |

Each capture starts from a fresh browser context: seed, load the app, then reach the surface with real taps and clicks. Surfaces and their steps are declared at the top of `scripts/visual/screenshots.mjs`; add one there when a new surface appears. A step selector that stops matching after a redesign does not abort the run: the capture is marked `step-failed`, the screenshot shows where the flow stopped, and the error names the selector.

The run is deterministic: the app clock is frozen at `2026-03-18T10:00` Europe/Berlin (`--date`, `--timezone`), locale `en-GB`, light colour scheme, reduced motion, device pixel ratio 1 (`--scale 2` for retina captures). Repeated runs on the same code produce byte-identical PNGs for about 95% of captures; the rest differ only by anti-aliasing noise.

## Seed data

`scripts/visual/seed.ts` runs inside the page, served by Vite, before the app loads. It builds records only with the real domain functions (`createBatch`, `addPhReading`, `completeBatchCheck`, `deleteBatch`, `updateProfile`, ...) and writes them with the app's real IndexedDB layer (`saveWebState` from `src/platform/web-store.ts`). The app then loads them as it would load a user's journal. There is no test-only code in `src/`.

The seeded journal contains:

- Napa cabbage kimchi: active, an overdue and a due-today check, pH and temperature history, notes, a user photo.
- Garden sauerkraut: active, nothing due, long completed-check history.
- Black tea kombucha: ready today (finish date reached), stand-in photo.
- Rye sourdough starter: moved to the fridge, checks paused.
- Milk kefir: no stand-in photo and no user photo (fallback), no finish date.
- Ginger bug with turmeric and lemon peel, second attempt: long name, custom profile, user photo, due today.
- Water kefir with figs: started today, no activity.
- Jun tea (abandoned): recently deleted, shows in Settings.
- Profiles: the starter profiles enriched with inputs, calculations, checks, pH zones and temperatures, plus two custom profiles.

"User photos" are JPEGs the seed composes on a canvas from the stand-in artwork, so they look like phone captures rather than stand-ins. `seed.ts` is type-checked by `npm run typecheck` through `tsconfig.visual.json`, so a domain API change breaks the build instead of silently breaking the seed.

## Output

```
screenshots/
  baseline/                 pre-rework design (see Baseline)
  current/                  default output of npm run screenshots
    index.html              grid of surface x viewport, baseline beside current, with findings
    report.json             machine-readable report
    <surface>/<viewport>.png        what the viewport shows
    <surface>/<viewport>.full.png   the viewport grown until no pane scrolls (skip with --no-full)
```

Open `screenshots/current/index.html` in a browser for the side-by-side view. A filtered run (`-s`/`-v`) replaces only the selected images and report entries; an unfiltered run clears the directory first. `--out DIR` writes somewhere else.

At the end of each run the console compares this run's findings with the baseline for the same captures and lists every surface x viewport whose counts changed.

## Report

`report.json` has run metadata (clock, browser, server, commit), `summary.totals`, `summary.uniqueSmallTargets` (deduplicated across captures) and one entry per capture under `captures[]`:

| Field | Meaning |
| --- | --- |
| `status` | `ok`, `step-failed` (a tap or wait failed; screenshot still taken) or `failed` |
| `checks.documentOverflow` | `overflowing`: document wider than the viewport. `verticalOverflowing`: the document scrolls vertically although the app shell is viewport-sized; `verticalSources` names the absolutely positioned elements that escape their scroller |
| `checks.surfaceOverflow` | shell, panes, dialogs, sections, forms whose content is wider than their box |
| `checks.clippedControls` | controls cut off by a non-scrolling ancestor or the viewport, and buttons/links whose own text overflows them |
| `checks.smallTargets` | interactive elements smaller than 44 x 44 CSS px; inline text links and disabled controls are flagged but not counted. Inputs wrapped in a `<label>` are measured by the label |
| `checks.pageErrors` | uncaught exceptions, `console.error`, browser log errors, failed requests and auto-dismissed dialogs after the app starts loading |
| `checks.skippedBehindModal` | controls behind an open modal dialog, which are not checked |

Quick query from PowerShell:

```powershell
$r = Get-Content screenshots/current/report.json -Raw | ConvertFrom-Json
$r.summary.totals
$r.captures | ? { $_.checks.clippedControls } | % { $_.surface, $_.viewport, ($_.checks.clippedControls | ConvertTo-Json) }
```

## Baseline

`screenshots/baseline/` holds the pre-rework design: commit `e6e8389` on branch `new_font` with no uncommitted app changes, captured on 2026-11-13 with the seed and script described here. `report.json` records the commit (`source`, and `commit` per capture), and `index.html` shows it in the header. Do not recapture it during the rework; the script refuses unless you pass `--force`, and a filtered `--baseline --force` run replaces only the selected captures. The baseline always lives in the main checkout, so runs from linked worktrees compare against the same baseline.

Findings on the baseline (60 captures, 0 failed):

- Horizontal document overflow: none.
- Vertical document overflow: 49 captures. `.sr-only` headings and labels inside `.design-dashboard` and `.design-detail` (and `.calendar-event-date` inside `main`) are `position: absolute`, but their scroll containers are not positioned, so they escape the scroller and make the whole document scroll. On the desktop overview the document is 4546 px tall and a page scrollbar is visible at the right edge.
- Surface overflow: `section.calendar-screen` at 320x640 (content 296 px in a 272 px box).
- Clipped controls: the batch-tools Notifications button (`.batch-head-notifications`) has text wider than its 50 px box at every viewport.
- Small targets: Settings segmented buttons, "On"/"Off" (39-41 px wide) at 768 px and wider, and the notification "All"/"Off" segment at 320 px.
- Page errors: none.

## Git

Tracked: `scripts/visual/screenshots.mjs`, `scripts/visual/seed.ts`, `tsconfig.visual.json` (referenced from `tsconfig.json`, so it is part of `tsc -b` without widening the app's own `tsconfig.app.json`), the npm scripts and this document. Ignored: everything under `/screenshots/` (about 30 MB per full run). `vite.config.ts` also excludes `screenshots/` from the dev server's file watcher, so a capture run does not full-reload an open `npm run dev` tab. The baseline is therefore machine-local; recreate it from commit `e6e8389` if it is lost.
