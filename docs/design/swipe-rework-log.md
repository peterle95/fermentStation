# Swipe rework log

Running record of the 1:1 Swipe rework. Read this before you start a ticket, then add your own entry. Gap numbers refer to `docs/design/swipe-component-spec.md` §4. The harness is described in `docs/design/visual-verification.md`.

## Status by gap

| Gap | State | Ticket |
| --- | --- | --- |
| Notices and alerts (spec §3, no gap number) | **closed**: `.notice`, `.storage-warning`, `[role="alert"]` and the Settings alert paragraph are the toast's black capsule (1 px white outline, white ink); `--radius-line` keeps a wrapping notice's ends at the one-line capsule radius | ticket 13 |
| 1 Card silhouette | **closed** for the surfaces gap 1 lists (see "Bowed surfaces" below) | foundation |
| 2 Ground and ink | **closed**: tokens are now `#000000` | foundation |
| 14 Selection on cards | **closed** for the batch card: 3 px lime ring that follows the bow | foundation |
| 16 Lilac shade | **closed** for avatar and icon circles (`--colour-emblem`) | foundation |
| 3 Phone bottom navigation | **closed**: white circles d 60, lime capsule, gap 6, no bar fill | navigation |
| 4 Tablet rail | **closed**: ringed chain, logo on top, lime current circle | navigation |
| 5 Utility circles | **closed**: one `utility-circle` primitive, white d 60 / dark `#1b1b1b` d 57, glyph 21; notifications as its capsule form | utility circles |
| 6 Typography (D1 resolved by the user: readable sizes inside 1:1 geometry) | **closed** for the type system; components still pick their roles in their own tickets | type system |
| 15 Big numbers | **closed**: figures are coral wherever they sit on black; the Kitchen summary's hero count is the `big-number` (coral display figure, white circle d 118, white caption) beside or below the lime card; counts on lime (Checks summary) stay ink | type system, Kitchen summary (ticket 9) |
| 7 Search field | **closed**: black capsule h 53, 1 px lime outline, lime caret, dark sort circle beside it | utility circles |
| 8 Dialogs | **closed**: one black sheet (`.station-dialog`, r 40 / bow 5.7, inset 21), phone bottom sheet with flat bottom, centred `label` title on the close circle's line, `dark-field` controls | dialogs |
| 9 Batch card anatomy | **closed**: H/W 0.94 from width tokens, full-width title pair, frosted chip, pill + black circle, 48–94 % photo slot (stand-ins clipped by the bow, user photos rectangular); the chip row stays one line (the next-check chip ellipsizes), so narrow cards keep the ratio; the title is clamped to the two lines of its band (ellipsis) | batch card (ticket 8), tickets 12, 13 |
| 11 Kitchen summary | **closed**: lime bowed card H/W 0.58 capped at 382, lilac emblem d 0.309 W 47 % above, yellow `summary-row` 0.916 × 0.252 W 49 % below with the `#fff6ce` count pill 79 × 49; the batch detail's next check uses the same `summary-row`; the Checks summary is the same component (counts on lime/yellow in ink) | Kitchen summary (ticket 9), ticket 13 |
| 10 Settings controls | **closed**: one `toggle-list` / `toggle-row` primitive (h 72, gap 8, inset 16, black selected row), lilac avatar d 63, switch 42 × 25 / knob 20; Suggestions is a real `role="switch"`, Units and Notifications are row choices | settings |
| 12 Primary action | **closed** for the batch detail ("Add observation"), Settings "Export ZIP archive" and the first-run card ("Start your first batch"), all `card-action`; every sheet submit is `card-action card-action-foot` (in flow, centred at the sheet's foot) | batch card (ticket 8), tickets 12, 13 |
| 13 Timeline | **closed**: one `small-card` (bowed at r = min(52, 0.16 W), bow = min(4.4, 0.0125 W) from its own width; lilac `#d9b4eb → #f6eafc` or blue `#b4dff9 → #e6f6ff` gradient; lime tag chip h 27; Light value; translucent time chip h 30; all ink black) for timeline entries, the latest readings, the calendar's upcoming/overdue items and the Checks upcoming strip; the white timeline panel is gone; pH and temperature entries show their number as the Light value | small cards (ticket 10), ticket 13 |
| Legacy rounded rectangles (gap 1 follow-up) | **closed**: the `--radius-card` allowlist is empty; the inline logger's card is `.activity-logger-card bowed`; Settings heading icons are the row avatar | tickets 12, 13 |
| Launch colours (gap 2 follow-up) | **closed**: Android launch/splash/window/status/navigation bars, the notification tint, `theme-color`, the web manifest and the Tauri window are `#000000`, the ground | ticket 14 |
| Glass surfaces (spec §1.9, no gap number) | **closed**: one `glass` primitive (white 60 %, blur 8, 2 px 40 % rim, 85 % fallback); on the card chips over photos, profile facts, small-card time chips, timeline actions, count pill and the sheet scrim (black 32 % + blur) | ticket 17 |
| Final 1:1 audit | **done**: 26 components / surfaces, 15 match, 6 minor, 5 differ; cheap fixes applied, the rest in "Needs a decision" | ticket 15 |
| Calendar month grid (spec §3, no gap number) | **closed**: day circles min(column, 60) ≥ 44, emblem event days, black selected day, `#3e3e40` today ring; Today / arrows / top-bar date chip on `utility-circle` / `utility-capsule`; no 320 overflow (the screen spans the pane below 380); strip days carry lime tag chips at 160 px; bowed focus rings follow the bow | calendar (ticket 11) |

Also fixed: the page-scroll defect from the harness baseline. `.sr-only` text inside the scroll panes was absolutely positioned against `.app-shell`, which made the whole document scroll in 49 of 60 captures. `.main-content`, `.design-dashboard` and `.design-detail` are now `position: relative`, so they contain it.

## Primitives and tokens (use these, do not reinvent them)

### Bowed outline: `bowed` and `bowed-clip`

The primitive is defined once, in `src/styles.css` directly after `.sr-only`. It implements spec §2.3 (`clip-path: shape()`).

- **Use it** by adding `bowed` to the element's `className` in `App.tsx`. Then set the colour on the surface rule with `--fill: var(--colour-…)`. `--fill` also accepts a gradient built from tokens, such as `linear-gradient(90deg, var(--colour-action-alt), var(--colour-background))`.
- **Tune** a surface with `--r` (corner radius, default `--bowed-radius` 52px; a bowed row uses half its height), `--bow` (default `--bowed-bow` 4.4px) and `--k` (default `--bowed-k` 0.64). The defaults are declared with `:where()`, so any surface rule overrides them regardless of order. `--r-end` / `--bow-end` (ticket 5) tune the bottom corners and bottom edge on their own; they default to `--r` / `--bow`, and `0px` for both gives a flat, square bottom (phone bottom sheet).
- **Selected ring:** set `--stroke: var(--colour-action); --stroke-w: var(--bowed-stroke);`. See `.design-batch-card.selected`.
- **Clipped media:** a *direct child* with class `bowed-media` fills the box (`inset: 0`) and is clipped by the outline, like the glass running into the drink card's bottom edge. It sits under all other content. Since ticket 8 the batch card and the batch empty card use it for stand-in photographs (`.design-batch-photo bowed-media`).
- **Focus ring** (ticket 11): a focused bowed control draws a white `--stroke-focus` band with its stroke layer, inside the outline, instead of the outline (which followed `border-radius`, not the bow). Do not add a `:focus-visible` outline to a bowed surface.
- **Overhang:** content is not clipped. A circle above the top edge or a button half below the bottom edge simply overflows the box. Only the fill, stroke and media layers are clipped.
- **Scroll containers** (the `<dialog>`s) use `bowed-clip` instead. It clips the element itself with `background: var(--fill)`, because a pseudo-element fill would scroll away. It cannot have overhang or a stroke.
- **Never** give a bowed surface `background`, `border*`, `border-radius`, `box-shadow`, or its own `::before`/`::after`. The primitive owns all of them. `.bowed` forces `background: none !important`, so the generic `button:hover` background cannot paint the rectangle.
- **Fallback:** without `shape()` support (Firefox and older WebKitGTK were not verified), every layer becomes a rounded rectangle at `--r`. The scratchpad demo was checked with shape support forced off: fill, ring, media and overhang all stayed intact.
- **Fidelity:** a 382×359 `bowed` box rendered in Chrome 157 against the ui-board drink card measures 0.25 board px rms and 1.2 board px max, including the ill-conditioned corner tips. The top-edge bow is 2.96 against the board's 3.0.

Bowed surfaces today (enforced by `src/styles.test.ts`): `design-batch-card`, `design-summary`, `checks-summary`, `design-detail-card`, `profile-card`, `profile-editor-section`, `profile-editor-head`, `calendar-panel`, `settings-card`, `batch-component-card`, `timeline-entry`, `summary-row`, `small-card`, and since ticket 12 `app-loading`, `empty-state`, `ios-install-guide`, `design-tip`, `design-input-summary`, `batch-guidance`, `next-action`, `wb-panel` (measurements), `batch-tools-danger`, `profile-overview-intro`, `start-batch-basics`, `start-profile-summary`, `profile-editor-card` (`bowed`) and `station-dialog` (`bowed-clip`). The retired `::before` black-notch bars and the asymmetric `2rem 2rem 2.5rem 2.5rem / …` radii are gone.

### Colour tokens

All colour literals live in `:root` as `--colour-*` tokens. The test fails on any hex, `rgb()`/`hsl()`/`oklch()`/…, or named colour anywhere else in `styles.css`, and on any colour literal in `App.tsx`.

| Token | Value | Use |
| --- | --- | --- |
| `--colour-surface-inverse` | `#000000` | ground, selected rows and cards |
| `--colour-text`, `--colour-text-muted`, `--colour-on-action`, `--colour-border` | `#000000` | ink on light fills |
| `--colour-emblem` | `#c5b4ec` | avatar, emblem and icon circles (ui-board lilac) |
| `--colour-action-alt` | `#dab8f1` | lilac card fills and gradient starts |
| `--colour-scrim` | `rgb(0 0 0 / 32%)` (ticket 17; `--colour-scrim-solid` 56 % without blur) | dialog backdrop, through the glass primitive |
| `--colour-glass`, `-solid`, `-edge` | white at 60 % / 85 % / 40 % | the glass primitive only (ticket 17); `--colour-frost` and `--colour-count` are retired |

The other tokens are unchanged: `#ffffff`, `#ffec89`, `#b6f074`, `#b6e1fa`. If a ticket needs a new colour (for example coral `#fc5659` for gap 15, or the switch blue `#2089fd` for gap 10), add it to the `:root` token layer and to the expected list in the palette test.

### Radii

Outside the primitive, `border-radius` may only be `var(--radius-control)` (capsules), `var(--radius-line)` (a capsule that may wrap, ticket 13), `var(--radius-small)`, `var(--radius-card)`, `50%` or `0`. Literal lengths and slash syntax fail the test. `--radius-card` is a **legacy, shrink-only allowlist** (`legacyCardRadius` in `styles.test.ts`) of rounded rectangles that predate the primitive. When your ticket bows or capsules one of them, delete it from the list. A new selector that uses `--radius-card` fails the test.

The old literal radii were mapped to tokens: `2rem` → `--radius-card` (same 32px); `1.5rem` → `--radius-card` (24 → 32px on `.design-batch-next` and `.detail-readings > div`, both due for restyling in gaps 9 and 13); kbd `4px` → `--radius-small`.

## Harness

- No capture step needed changes: the steps locate surfaces by component classes, which are unchanged, and `bowed` is only added.
- The report's `element` paths now read `section.settings-card.bowed > …` instead of `section.settings-card.settings-preferences > …`, because a path keeps only the first two classes. When you diff findings against the baseline, compare labels and sizes, not paths.

### Foundation results (full run, 60 captures, Chrome 157)

- 0 failed, 0 step-failed, 0 page errors.
- Vertical document overflow: 49 → **0**. The desktop page scrollbar is gone.
- Every other finding is identical to the baseline and was already known: surfaceOverflow 1 (`section.calendar-screen` at 320), clippedControls 5 (`.batch-head-notifications`), smallTargets 8 (Settings "On"/"Off"/"All" segments; inline credit links).
- Visual check: overview, batch-detail, calendar and settings at 1440, 768 and 390, compared against ui-board crops scaled ×1.406. The corners and bow of every bowed card match the drink and lime-profile cards. The selected batch card's lime ring follows the bow. The Kitchen summary at 726 px wide keeps r 52 / bow 4.4 and reads flatter, as the spec predicts for wide surfaces. On phones the dialogs are bowed top and bottom through `bowed-clip`.

## Ticket 2: type system (gap 6, D1 resolved) — done

User decision on D1: component geometry stays 1:1 with the boards; type is sized for readability inside each measured text box, uses all seven Unique weights, and text gets colour from the Swipe palette.

### Unique specimen findings (fontTools on `public/fonts/unique/*.woff2`)

- All weights: cap 0.70 em, x-height 0.57 em, hhea ascent 0.73 / descent 0.16 / gap 0.10. No `tnum` feature (`font-variant-numeric: tabular-nums` does nothing).
- Extremely condensed: mean lowercase advance 0.14 em (Thin) … 0.22 em (Bold); a normal sans is ≈ 0.5 em. Width is never the constraint in a measured box; **height is**.
- Vertical stem width (em): Thin 0.018, ExtraLight 0.032, Light 0.046, Regular 0.060, Medium 0.073, SemiBold 0.087, Bold 0.100. Readability floor used: stem ≥ 1.4 CSS px at 1×, so minimum size per weight is Thin ≥ 78 px, ExtraLight ≥ 44, Light ≥ 30, Regular ≥ 23, Medium ≥ 19, SemiBold ≥ 16, Bold any. Light weights are therefore display-only and small text must get heavier, not lighter.
- Rendered specimens: 18 px Medium and 24 px Regular read as too small in this face; 20 px Medium with 0.06 em tracking is the floor.

### Role tokens (`--type-<role>`, `-weight`, `-leading`, `-tracking` in `:root`, sizes in rem)

| Role | Size | Weight | Leading | Tracking | Job / measured box it fits |
| --- | --- | --- | --- | --- | --- |
| display | 6.25rem (100) | 300 Light (was 100 Thin; ticket 10) | 0.9 | 0 | hero counts (spec §1.6 "64+", figure 71 px) — colour `--ink-figure` |
| figure | 3rem (48) | 300 Light (was 200 ExtraLight; ticket 10) | 1 | 0.01em | values: day count, readings, metrics, dates ("04" role ≈ 42) — `--ink-figure` |
| headline | 3rem (48) | 700 Bold | 1.05 | 0.01em | page titles (h1) on the ground |
| title | 2.5rem (40) | 700 Bold | 1 | 0.015em | card title line 1 (drink card "Orange": pitch 39 px) |
| title-light | 2.5rem (40) | 300 Light | 1 | 0.02em | card title line 2 ("Drinks") |
| heading | 2rem (32) | 700 Bold | 1.1 | 0.02em | section / card headings; centred card title (§1.3 ≈ 31) |
| subheading | 1.75rem (28) | 700 Bold | 1.15 | 0.025em | small card headers, row titles |
| row | 1.75rem (28) | 400 Regular | 1.15 | 0.03em | list / row text: two lines = 64 px fit the 72 px row (§1.2) |
| body | 1.625rem (26) | 400 Regular | 1.35 | 0.035em | running text, inputs |
| label | 1.375rem (22) | 600 SemiBold | 1.2 | 0.05em | buttons, chips, tags, nav labels (42 px chip, 60 px pill) |
| meta | 1.25rem (20) | 500 Medium | 1.3 | 0.06em | captions, timestamps, hints (§1.3 meta line) — `--ink-meta` |

### Text colour (ink sets)

- `:root` declares pairs: `--ink-ground` white, `--ink-ground-meta` lilac `#dab8f1`, `--ink-ground-figure` coral `#fc5659` (new `--colour-figure`), `--ink-ground-accent` lime, `--ink-ground-attention` yellow, `--ink-ground-time` blue `#b6e1fa`; `--ink-fill` black for every role on pastel/white fills.
- Context properties `--ink`, `--ink-meta`, `--ink-figure`, `--ink-accent`, `--ink-attention`, `--ink-time`: `:root` and a dark-surface group set the ground set; a light-fill group sets all of them to `--ink-fill`. Every former `color: var(--colour-text|on-action)` becomes light-group membership, every `color: var(--colour-text-inverse)` dark-group membership. Role rules colour meta/figure/display via the context properties, so a meta line is lilac on black and ink on lime automatically.
- Semantic accents (on black only; ink on fills): lime = current / done / kicker (eyebrow), yellow = due / overdue (next-check chip, "!" marks), blue = time and dates, lilac = secondary text, coral = figures.
- Contrast thresholds (test computes WCAG ratio from the hex tokens): 7:1 for every text pair, 4.5:1 for the figure pair (only used at ≥ 3rem). Coral on black 6.6, lilac 12.1, blue 15.1, lime 15.7, yellow 17.6, ink on every pastel ≥ 11.

### Enforcement in `src/styles.test.ts` ("type system" describe block)

- Outside `:root`, `font-size` / `line-height` / `letter-spacing` appear only as a complete role application (all four longhands of one role); `font-weight` alone only as `var(--type-*-weight)`; `font` only as `inherit`.
- Every weight 100–700 is used by an applied role; each role satisfies the stem floor; role sizes are rem.
- `color:` outside `:root` and the ink groups is only `inherit`, `currentColor` or `var(--ink*)`.

- Also checked: role sizes are rem (reflow at 200 % root), the retired `--type-h1…h4/lead/small` tokens are gone, `var(--ink-figure)` is only used by the display/figure roles, every ink-group surface that paints a solid token fill reads at 7:1 with its set, and the hierarchy anchors (`h1` = headline, `h2`–`h4` = heading, `button` = label, inputs = body, `.design-batch-profile` = title-light, …). The old `.design-section-head h1` assertion (rule gone since `e6e8389`) is replaced by "`h1` uses the headline role".

### How to choose a role (later tickets)

- Name or title of a card → `title`, with its second line (profile, kind) in `title-light`. A centred card title or a section head → `heading`; a small card header or the bold first line of a row → `subheading`.
- Anything in a list row → `row`. Paragraphs and inputs → `body`. Anything you can press or that reads as a chip/tag/field label → `label`. Dates, counts in captions, hints → `meta`.
- A number that is the point of the component → `figure` (48 px); the one hero number of a screen → `display` (100 px). Both turn coral on black by themselves.
- Apply a role by adding the selector to that role's rule in the "Type roles" block after `.sr-only` in `src/styles.css` (or a complete four-longhand role rule inside a media query). Never write a size, weight, leading or tracking anywhere else; the test fails.
- Colour: put a new surface in the light-fill or dark-fill ink list (the "Text colour" block) instead of setting `color`. Semantic accents on black: `color: var(--ink-accent)` (lime: current, done, kicker), `var(--ink-attention)` (yellow: due, overdue), `var(--ink-time)` (blue: dates, timestamps). They fall back to ink on fills automatically.

### As built

- `src/styles.css`: role tokens and ink tokens in `:root`, one ink-set block per kind (light fill / dark ground, plus a late light block for disabled Settings controls that were ordered after the pressed rule), the role layer after `.sr-only`, phone overrides (`.navigation button` = label, `.calendar-head h2` = subheading) at the end of the `< 600px` block. Every per-rule `font-size`/`font-weight`/`line-height`/`letter-spacing` was removed; every `color: var(--colour-text|on-action|text-inverse)` became ink-set membership. Accents placed: blue date in the top bar and date chip, timeline/readings/upcoming times; lime eyebrows, start-batch legend, done check circle; yellow next-check chip on batch cards and the overdue "!" marks.
- Geometry touched only where the type change made a regression: `.design-quiet` and the other text actions got `min-width: 44px` ("More batch tools" had shrunk to 43 px). The never-visible white background on `.calendar-screen, .profiles-screen, .design-checks-view` (always overridden by `transparent`) was removed so the contrast check reads true.
- `vite.config.ts`: `test.testTimeout: 30_000`. The App integration tests drive the whole UI; the slow one took 5–8 s alone and longer in parallel, so the 5 s default failed a plain `npm test` on timing alone.
- Tests: `npm run typecheck` clean; plain `npm test` 263 passed / 263, 15 files, 190 s.
- Harness (full run, 60 captures): 0 failed, 0 step-failed, 0 page errors, document overflow 0 / vertical 0. surfaceOverflow 1 (calendar 320, known), clippedControls 5 (`.batch-head-notifications`, known), smallTargets back to the known Settings "On/Off/All" segments after the min-width fix (they are 38–43 px wide now, were 39–41).
- Visual check (overview 1440, overview/batch-detail/checks 390, settings/calendar 768): titles, Light second lines, coral Day/pH/°C figures on black, lilac meta, blue dates and lime kickers all read clearly; nothing clips.

### Left by ticket 2

- Text boxes that are wrong because the geometry is pre-rework (fix in the component tickets, not with smaller type): the Kitchen summary puts a 100 px Thin count in a 3-column lime grid (gap 11 moves it onto black next to a white circle, which also turns it coral); batch cards grow taller than H/W 0.94 because the 40 px title pair wraps in today's narrow copy column (gap 9 widens it); Settings segments are still bordered pills whose 22 px labels leave "On"/"Off" under 44 px wide (gap 10 replaces them with 72 px rows); dialog titles are `heading` on the blue band until gap 8 makes them a centred sheet header.
- Unique has no `tnum` feature, so the existing `font-variant-numeric: tabular-nums` declarations do nothing; figures are proportional.
- The pill label pair of the drink card (spec §1.1 "Swipe / Now") should use the `row` size with Light and Bold lines; there is no element for it yet (gap 9).

## Ticket 3: navigation (gaps 3, 4) — done

No markup change: destinations, `aria-label`s, `aria-current`, focus order and the harness selectors (`.navigation .nav-*`) are untouched. All work is in `src/styles.css`.

As planned and built:

- Tokens in `:root`: `--colour-rail` `#3e3e40` (spec §1.4 ring), `--nav-circle` 60, `--nav-gap` 6 (pitch 66), `--nav-capsule` 107, `--nav-icon` 21, `--nav-ring` 6, `--nav-rail` = circle + 2 rings (72), `--nav-waist` 46 (board 33/51 of the rail between circles). `--mobile-nav-height` becomes circle + 2 × `--space-2`.
- One vocabulary at every width: `.nav-mark` is a white circle d 60 with the icon at 21; the current destination is lime and its mark turns transparent (icon straight on lime, as in the Scan pill).
- Phone: centred flex row, gap 6, no bar fill; non-current buttons are bare circles (label hidden, `aria-label` unchanged); the current one is a lime capsule ≥ 107 × 60 with icon + `label`-role word.
- Tablet: rail visuals live in their own `@media (min-width: 600px) and (max-width: 1023px)` block so the phone never inherits them. Logo circle on top, then the four destinations; every circle gets a 6 px `--colour-rail` ring (box-shadow on the mark) and a 46 px band joins the centres, so the column reads as one scalloped rail. Column = rail + 2 × `--space-2`.
- Desktop: same circles in rows with their labels; current row = lime capsule; logo in a white circle; Home account = lilac circle d 60, no border.
- Focus: nav buttons get `outline-offset: var(--stroke-focus)` so the two-tone ring sits outside the white circle and the rail ring.

### How to use (later tickets)

- A circle button anywhere (gap 5 top-bar utilities): `width/height: var(--nav-circle)`, `border-radius: 50%`, `background: var(--colour-background)`, icon `var(--nav-icon)`, and put it in the light-fill ink list. Do **not** ring it: `--colour-rail` is rail-only and the test fails if it is used outside the 600–1023 rail block.
- The rail block is `@media (min-width: 600px) and (max-width: 1023px)`, between the `max-width: 1023px` block and the `min-width: 1024px` block. Rail-only visuals go there, never into the `max-width: 1023px` block, which also reaches phones.
- `.nav-mark` is the circle; `button[aria-current="page"]` is the lime fill and makes its mark transparent. The phone capsule pads `(circle − icon) / 2` each side, so its icon sits exactly where it would in a circle.

### Measured (harness, Chrome 157, pixel scan of the PNGs)

- Phone 390: circles 60, pitch 66 (gap 6), capsule 130 × 60 for "My batches" (spec ≈ 107 for "Scan"; `--nav-capsule` is the minimum), row 31–359, centred, no fill. Calendar current: capsule ≈ 120.
- Phone 320: row is 3 × 60 + 3 × 6 + capsule = 320 with no side padding. "My batches" wraps to two lines inside the 60 px capsule (≈ 122 wide); "Calendar" stays on one line. Readable; a later polish could shorten the phone label or drop the capsule padding at ≤ 379.
- Tablet 768: ring outer width 72, waist 46, white/lime circles 60 at pitch 66, logo circle on top joined by the band, column 88 (`--nav-rail` + 2 × `--space-2`; was 80). The Home account button stays at the bottom as a separate ringed lilac circle.
- Desktop 1440: logo in a white circle d 60, four rows of a white circle d 60 + `row`-role label on black, current row = lime capsule h 60 holding icon, label and the batch count; Home = lilac circle d 60 + label, border gone.

### Tests

`src/styles.test.ts` "navigation circles, capsule and rail": tokens and their arithmetic (rail = 72, waist < circle, 3 circles + capsule + 3 gaps ≤ 320), no px/rem/em literal in any navigation rule, white `.nav-mark` circle and lime current at every width, phone row = flex/centred/gap token, bare circles, capsule min-width token, non-current labels hidden, **no `.navigation` rule outside the rail block paints a background**, rail ring/band from tokens, `--colour-rail` only inside the rail block, focus `outline-offset`. `--colour-rail` joined the palette list. Existing tests are unchanged and green (`.navigation .nav-word` still `display: inline` on phones; only non-current words are hidden by a more specific rule).

### Results

- `npm run typecheck` clean; `npx vitest run src/styles.test.ts` 43 / 43; plain `npm test` 269 / 269, 15 files, 184 s.
- Harness full run, 60 captures: 0 failed, 0 step-failed, 0 page errors, document overflow 0 / vertical 0. surfaceOverflow 1 (calendar 320, known), clippedControls 5 (`.batch-head-notifications`, known), smallTargets 8 (Settings On/Off/All and the inline licence links, known). No finding names the navigation.

### Left by ticket 3

- Spec §3 maps the desktop sidebar to "one white bowed card with destination rows, current = black row, icon in a pastel avatar circle". This ticket used the circle/capsule vocabulary instead, as the ticket asked, so the three widths read as one system. If the bowed toggle card is still wanted, it is a desktop-only restyle of `.navigation` at ≥ 1024.
- The desktop batch count is plain `row` text in the lime capsule; spec suggests a count pill (§1.3 vocabulary).
- The rail has no Settings circle (spec §3 lists one): Settings lives in the top bar, and adding it to the rail would change the focus order. Decide together with gap 5.
- Desktop labels use `row` (28), the phone capsule `label` (22), the Home account `label`; harmonise if the desktop sidebar is restyled again.

## Ticket 4: utility circles and search field (gaps 5, 7) — done

Accessible names, `aria-pressed` / `aria-current`, focus order and behaviour are unchanged. The harness selectors still match (Settings is reached by `aria-label`).

### As built

- **Primitive** (one block in `src/styles.css`, just before `.design-topbar`): add `utility-circle` in `App.tsx` for a white circle d `--utility-circle` (= `--nav-circle`, 60) on the ground. Add `utility-circle-dark` as well inside dark panes, sheets and cards for the `--colour-sheet-control` `#1b1b1b` circle d `--utility-circle-dark` (57). The glyph is `--nav-icon` 21. Its stroke is `--utility-stroke` 2 / `--utility-stroke-dark` 1.6 CSS px, scaled into the 24-unit viewBox (`calc(var(--utility-glyph) * 24 / 21)`), so the `strokeWidth` attributes in the markup no longer matter. Hover, `aria-pressed="true"` and `aria-current="page"` turn lime with ink. Ink comes through the ink lists: `.utility-circle` is fill, `.utility-circle-dark` is ground, and the state selector is fill.
- **`utility-capsule`** modifier: the same circle stretched to a capsule with a visible word. The glyph sits where it would in the circle (padding `(d − icon) / 2`), followed by the word in the `label` role. It is used only by `.batch-head-notifications`. The first attempt made it icon-only, but `App.test.tsx` "shows notification state…" asserts the visible "muted"/"on" word, so the word stayed. This closes the clipped-text defect: clippedControls 5 → **0**.
- White circles: station logo (phone top bar), checks bell, Settings (lime while Settings is current), profile-editor phone back. Dark circles: detail-pane back and dates, batch camera, notifications capsule, both dialog close buttons, the upcoming-picker close, the calendar's Previous/Next month (inside the white calendar card) and the search field's sort/filter.
- **Search** (gap 7): a new `.design-search` wrapper keeps the field and the sort circle on one line. The field is `.design-search-box`: fill `--colour-surface-inverse`, `var(--stroke-width) solid var(--colour-action)`, h `--search-height` 53, white icon and text (ground ink), lilac placeholder (`--ink-meta`, 12:1), `caret-color: var(--ink-accent)` (lime). The DOM order is unchanged: input, then sort, then the view switch.
- **Retired:** `.icon-button` (class and rules), the 52 px shared rule for these buttons, `.station-dialog-close` / `.batch-head-camera` / `.batch-head-notifications` sizing and fills, and `.calendar-nav button` (only `.calendar-today` keeps its 44 px capsule rule). `.design-check-complete`, `.profile-editor-icon-button` and `.setting-trash-button` keep the old 52/44 rule (card and row actions).
- **Measured** (phone overview PNG, pixel scan): white Settings circle 60, dark sort circle 57, field outline 53. At 1440 the top-bar bell and Settings are white d 60 and the detail back and dates are dark d 57.

### Tests

`src/styles.test.ts` "utility circles and search field" (5 tests):

- Tokens: d 60 = `--nav-circle`, 57, strokes, field 53, `--colour-sheet-control`; all three sizes ≥ 44.
- Exactly one geometry rule, one dark variant, one state rule, one glyph rule and one capsule rule mention the primitive. No `.icon-button`, `.batch-head-*` or `.calendar-nav button` rule exists, and no per-button rule re-sizes or re-paints a circle.
- Every icon-only `<button>` in `App.tsx` carries `utility-circle`, except check completion and the profile editor's remove-check button. The notifications capsule keeps its state word.
- Ink-list membership and contrast for white, dark and lime circles.
- Search field geometry, outline, fill, caret, ground ink and the markup order (field, then sort circle).

`#1b1b1b` joined the palette list.

### Results

- `npm run typecheck` clean; `npx vitest run src/styles.test.ts` 48 / 48; plain `npm test` 274 / 274, 15 files, 174 s.
- Harness, full run (60 captures): 0 failed, 0 step-failed, 0 page errors, document overflow 0 / vertical 0. surfaceOverflow 1 (calendar 320, known). **clippedControls 0** (was 5). smallTargets 8 (Settings On/Off/All and the licence links, known).

### Left by ticket 4

- Settings circle in the tablet rail: **not added**. It would put a second Settings button into the rail before the top bar, which changes the focus order; the top-bar Settings circle stays the only one.
- Gap 8: the dialog close circles are already the dark d 57 circle. Gap 8 should align them to the title's centre line with right inset 21 and turn dialog fields into the gap 7 field. `--search-height`, the lime outline and the caret are the vocabulary for that; if they are shared, lift them into a field class instead of copying them.
- The calendar's "Today" button is a 44 px outlined capsule next to 57 px circles (calendar restyle). The top-bar date chip is still an outlined capsule.
- `.design-check-complete` (44, lime) and `.profile-editor-icon-button` (44, bordered) are icon-only row actions that remain outside the primitive (gaps 9 and 12 / profile editor). `.setting-trash-button` goes with gap 10.
- The dark circle on the black ground is 1.2:1 against the ground, as on the board; the white glyph (17:1) identifies the control.

## Ticket 5: dialogs and the observation logger as Swipe sheets (gap 8) — done

Behaviour is unchanged: no handler, ref, `showModal`/`close`, focus or label code was touched. Markup changes are class names only. The harness selectors (`dialog.station-dialog[open]`, `dialog.observation-logger.station-dialog[open]`) still match.

### As built

- **Tokens** (`:root`): `--sheet-radius` 40, `--sheet-bow` 5.7, `--sheet-inset` 21 (spec §1.7).
- **Sheet**: `.station-dialog` is the one sheet definition. It covers every `StationDialog` (start, profile, dates, inputs, info), the modal observation logger and the upcoming-batch picker. It has `bowed-clip` with `--r`/`--bow` from the sheet tokens, `--fill: var(--colour-surface-inverse)`, `padding: var(--sheet-inset)` and `color-scheme: dark`, so the scrollbar and native pickers are dark. It is in the ground ink list (it was in the fill list). Tablet and desktop keep the centred modal at `min(480px, 100% − 48)` with all four edges bowed. On phones (`max-width: 599px`) it becomes a bottom sheet: width 100%, `margin: auto 0 0`, flat bottom (`--r-end`/`--bow-end: 0px`), and `max-height: 100dvh − --space-12 − safe-top`, so the scrim stays visible above it. Its bottom padding adds `--safe-bottom`.
- **Primitive change (convention fix):** the shape had one radius and one bow for all four sides, so a sheet could not be bowed on top and flat at the bottom. The bottom corners and bottom edge now use `--rr-end` (from `--r-end`) and `--bow-end`. Both default to the top values, so no existing surface changed. The rounded-rectangle fallbacks and `.bowed::after` honour them too.
- **Header**: `.station-dialog-heading` is a grid `57 | 1fr | 57` with `align-items: center`. The title (first child) sits in the middle column, centred. The close circle sits in the last column, so its centre is on the title's centre line and its right edge is at the sheet inset. The blue band, its negative margins and its radius are gone, and `.station-dialog-heading` was removed from `legacyCardRadius`. The upcoming-batch picker header now uses the same class; its `.upcoming-batch-picker-heading` rules were deleted.
- **Title role**: `.station-dialog-heading h2` uses `label` (22 px SemiBold). Spec ≈ 22 px; `label` is the existing role closest to that size, and Regular at 22 would fall below the stem floor. The role table is unchanged.
- **Shared field** `dark-field` (one rule plus one `:is(textarea, [type="file"])` rule, placed before the search rules): `height: var(--search-height)`, `var(--stroke-width) solid var(--colour-action)`, capsule radius, black fill, `caret-color: var(--ink-accent)`, `color-scheme: dark`, ground ink list. Textarea and file fields grow with their content and keep `--radius-small`. The search box is now `className="dark-field design-search-box"` and keeps only layout; its inner input inherits the caret. The start-batch controls carry `dark-field`. The logger controls carry `className={sheetField}` (`loggerModal ? "dark-field" : undefined`), so the inline logger on the white batch-tools card keeps the white fields.
- **Ink inside the sheet**: `.profile-overview-intro`, `.start-batch-basics`, `.start-profile-summary` and `.upcoming-batch-choice` (pastel boxes) joined the fill list. Before, they inherited ink from the white dialog. Pressed logger chips (`.station-dialog .quick-log-types button[aria-pressed="true"]`) turn lime with ink, because black-on-black would hide the state. Buttons keep their component styles: lime `.station-primary`, outlined `.station-secondary` (white outline on black) and underlined quiet actions.

### Measured (pixel scan of the harness PNGs)

- Phone 390: the sheet spans the full width and ends flush with the bottom edge. Its top dips about 5 px at mid-width against the corners (bow 5.7). Close circle: d 57, x 312–368 (right inset **21**), y 124–180 (centre 152), on the same centre line as the title. The fields are 348 wide and **53** high with a 1 px lime line.
- Desktop 1440: sheet x 480–959 (480 wide), close circle 882–938 (inset **21**), d 57. Tablet 768: sheet 144–623 (480), content inset 21.

### Tests

`src/styles.test.ts` adds the block "sheet and field on black" (6 tests). It checks the sheet tokens; one sheet definition that takes its `--r`/`--bow`/`--fill`/padding from tokens; that no other `.station-dialog` rule reshapes or repaints the sheet; that every `<dialog>` in `App.tsx` is `station-dialog bowed-clip`; ground ink; the phone bottom sheet; the header grid and its centred title; the `label` role on the title; that every sheet header ends in the dark utility circle; one field definition, used by the search box, by every start-batch control and (through `sheetField`) by every logger control; that no other rule draws the 1 px lime outline; and the ink-list membership of the pastel boxes and the pressed chip. Existing tests that changed:

- The search-field test now checks the look on `.dark-field` and requires the search box to use it.
- The shape test checks the bottom side through `--rr-end` / `--bow-end` and the new defaults.
- `.station-dialog` left the `--card-padding` list. The new block checks `--sheet-inset` instead.

### Results

- `npm run typecheck` clean; `npx vitest run src/styles.test.ts` 54 / 54; plain `npm test` 280 / 280, 15 files, 168 s.
- Harness, full run (60 captures): 0 failed, 0 step-failed, 0 page errors, document overflow 0 / vertical 0. surfaceOverflow 1 (calendar 320, known), clippedControls 0, smallTargets 8 (Settings On/Off/All and the licence links, known). The sheet surfaces have no findings.

### Left by ticket 5

- The board's grabber bar above the phone sheet was not added. The sheet cannot be dragged, so a grabber would promise a gesture that does not exist.
- The pastel boxes inside the start-batch and profile sheets (blue "Your batch", yellow profile summary and intro) are still rounded rectangles on `--radius-card` (legacy list). They hold black fields now. A later pass could drop the box and keep the lime legend on black.
- The upcoming-batch picker and the profile/dates/info dialogs are not captured by the harness. They inherit the sheet through `.station-dialog` and were checked only in CSS.
- The inline logger in batch tools (white `.activity-logger` card, white fields, black pressed chips) is unchanged. `.activity-logger` must still never get `bowed`.

## Ticket 7: Settings toggle rows (gap 10) — done

Persisted settings, labels, handlers and focus order are unchanged. The only semantic change is the Suggestions control: the On/Off pair became one switch.

### As built

- **Tokens** (`:root`): `--colour-row` `#f6f8fa`, `--colour-switch-on` `#2089fd`, `--colour-switch-off` `#eceef0`; `--toggle-row` 72, `--toggle-gap` 8, `--toggle-inset` 16, `--toggle-avatar` 63, `--toggle-label-gap` 18, `--switch-width` 42, `--switch-height` 25, `--switch-knob` 20, `--switch-inset` 21 (spec §1.2 / gap 10).
- **Primitive** (one block in `src/styles.css`, where the `.setting-segment` rules were): `toggle-list` is a grid with gap 8 whose `margin-inline` is `--toggle-inset − --card-padding`, so the rows sit 16 from the card edge while the rest of the card keeps its 24 padding. `toggle-row` is a capsule `<button>`: min-height 72, fill `--row-fill` (= `--colour-row`), padding `0 21`, `row` type role, fill ink. `aria-pressed="true"` (a choice) or `aria-checked="true"` (a switch) sets `--row-fill` to black and moves the row to the ground ink list. A hover rule repaints `--row-fill`, because the generic yellow `button:hover` would put the selected row's white text on yellow. Optional children: `toggle-avatar` (lilac `--colour-emblem` circle d 63; a row that has one gets a start padding of `(72 − 63) / 2`), `toggle-label` (flex 1), `toggle-switch` (track 42 × 25, `margin-inline-start: auto`, knob 20 white as `::after`, which travels `width − height` when the parent is `aria-checked="true"`; the track turns blue).
- **Settings markup**: Units (°C / L, °F / qt) and Notifications (All / Checks / Ready / Off) are single choices. They stay `role="group"` with the same `aria-label`s and `aria-pressed` buttons, now one 72 px row each; the chosen row is black. They have no trailing switch, because a switch would announce an independent on/off. **Suggestions** is now one `<button role="switch" aria-checked={preferences.suggestions}>` row: lilac avatar with the `sparkles` glyph, the visible label "Suggestions" (its accessible name, as the group's was), and the switch. Clicking it toggles the preference. Its description moved above the row as a card paragraph, so the row keeps h 72. The Notifications card is now white (the toggle card is white); About stays lilac.
- **Retired**: `.setting-segment`, `.notification-segment`, the phone `.setting-segment button { flex: 1 }` and both `:is(…, .setting-segment)` pressed rules. `.setting-row` is kept for the Journal export row. `.setting-segment` and `.trash-item` left `legacyCardRadius`.
- **`.setting-trash-button`** was a dead selector: no element in `App.tsx` uses it. It was removed from the 52 px shared rule, which now holds only `.design-check-complete` and `.profile-editor-icon-button`. The element it was meant for, a deleted batch in the trash panel, joined the row vocabulary instead: `.trash-item` is a `--colour-row` capsule, min-height 72, name in the `row` role at inset 21, and Restore (a 52 px text button) sits in the switch slot, `(72 − 52) / 2` from the end.

### Measured (pixel scan of the 390 × 844 full capture)

Rows 72 high with gap 8 (pale and black). Row x 40–349: 16 in from the card edge (card 24–366). Switch track 42 × 25 (x 287–328, y 781–805), right end 21 from the row end. Avatar d 63 (x 45–107), 5 in from the row start, centred vertically. The selected rows are `#000000` with white text, the unselected ones `#f6f8fa` with ink. At 1440 the two cards sit side by side with the same geometry.

### Contrast

Ink on `#f6f8fa` 19.3:1, white on black 21:1, ink on the lilac avatar ≥ 7. Blue track on the black row 6.1:1, white knob on blue 3.5:1. The off track `#eceef0` is as pale as the board's (about 1.1:1 against the row), so the switch alone does not carry the state at 3:1. The row fill does (black against `#f6f8fa`, 19.3:1), together with `aria-checked` and the knob position. The test states this.

### Tests

- `src/styles.test.ts` adds "settings toggle rows and switch" (5 tests): the token values and their relations (row ≥ 44, avatar < row, knob < track); exactly one rule each for list, row, state, hover, avatar padding, avatar, label, track, knob, on-track and on-knob, with no literal length in any of them; the declarations that fix geometry and colours to tokens; `.toggle-row` in the `row` role; ink membership and contrast (above); the Settings markup (four `toggle-row` tags, each `aria-pressed` or `role="switch"`, exactly one switch, bound to `preferences.suggestions` and labelled "Suggestions"; Units and Notifications groups; no `setting-segment` / `notification-segment` / `setting-trash-button` anywhere; no `--fill` on the Notifications card); the trash row. The palette list gained the three colours.
- `src/App.settings.test.tsx` "exposes named groups…": the Suggestions step now finds `getByRole("switch", { name: "Suggestions" })`, checks `aria-checked` true → false → true and the persisted value after each click (it used to click "Off" once). It ends with `suggestions: false`, as before. `src/App.test.tsx` needed no change: its Units and Notifications assertions (`aria-pressed`, persisted modes) still hold.

### Results

- `npm run typecheck` clean; `npx vitest run src/styles.test.ts` 59 / 59; plain `npm test` 285 / 285, 15 files, 207 s.
- Harness, full run (60 captures): 0 failed, 0 step-failed, 0 page errors, document overflow 0 / vertical 0. surfaceOverflow 1 (calendar 320, known), clippedControls 0, **smallTargets 0** (was 8: "On"/"Off" at 1440, 1024 and 768, "All"/"Off" at 320). `uniqueSmallTargets` is empty. The inline licence links were not among the 8 in this harness version, so no small-target finding is left. No harness selector needed a change (Settings is reached by the top-bar `aria-label`).

### Left by ticket 7

- The Settings card headings still use the old 52 px bordered `.settings-emblem` capsule; the spec's avatar circle is d 63 lilac. Restyle it with the card headings (spec §1.3 vocabulary), not as a row.
- `.settings-trash-toggle` (the black "Open recently deleted batches" disclosure with its lime count) is still a 52 px black capsule. It could become a `toggle-row` with the count in the switch slot, but its black fill would then mean "selected", not "disclosure". Decide with the user.
- The trash rows are not captured by the harness (the panel starts closed); they were checked in CSS and tests only.
- Other `.setting-row` users (Journal export) and the Data storage / exchange cards are unchanged (spec: "Export ZIP" is gap 12's lime primary action).
- Not in scope, noticed: none new in batch cards, Kitchen summary, timeline, calendar or dialogs during this ticket.

## Ticket 8: batch card anatomy and the card's primary action (gaps 9, 12) — done

Labels, accessible names (`Open <batch>`, `Add observation`, `Complete <check> for <batch>`), selection (`aria-pressed`) and focus order are unchanged. Each batch card is still one `<button>`. Harness selectors (`.design-batch-card[aria-label=…]`, `.design-detail .design-record-observation`) still match, so the capture steps needed no change.

### As built

- **Geometry from the card's own width (convention).** The card is a full-width grid item. Percentage padding and margins resolve against the containing block's *width*, and absolute offsets resolve against the padding box. Every part of the anatomy is therefore a fraction of the card width, held in `:root` tokens: `--batch-card-ratio` 382 / 359, `--batch-card-inset-x` 9.3 %, `-inset-y` 9.4 %, `--batch-pill-width` 55.6 %, `--batch-pill-ratio` 212 / 77 (so its height is 20.2 %), `--batch-pill-inset-x` 4.3 %, `--batch-pill-inset-bottom` 3.3 %, `--batch-pill-text` 7 % (label start), `--batch-pill-circle` 16.5 % (space kept for the circle), `--batch-go-inset-y` 8 % / `-x` 3.3 % (circle inside the pill, of the pill's box), `--batch-photo-left` 48 %, `--batch-photo-width` 46 %, `--batch-chip-inset-x` 6.2 %, `--batch-chip-height` 42 px. The card has `aspect-ratio` plus `min-height: auto`. The global `button { min-height }` had disabled the content minimum, so long content overlapped the pill instead of growing the card. The card now grows instead of clipping.
- **Title fix.** The title pair (`title` Bold + `title-light` Light, both 40, role table unchanged) spans the full content width. The old 1fr / 0.9fr copy column was what made it wrap. The meta line (temperature, amount) follows on one full-width line. The photo slot starts below this band (`--batch-title-band` = top inset + two title lines + one meta line) instead of at the board's 8 % of the height: the board's photo sits beside a one-word title, and here the titles are full width.
- **Chips:** the status is the frosted chip (`--colour-frost` `rgb(255 255 255 / 60%)` + `backdrop-filter: blur(--batch-chip-blur)`, h 42, at inset 6.2 %). The next check stays the black capsule with yellow text. Its radius is now `--radius-control`, and it left `legacyCardRadius`.
- **Pill** (`.design-batch-pill`, absolute bottom-left): white with a 1 px `--colour-hairline` `#f1f1f1` line, two lines "Day N" (`subheading`, Bold) over "/ M days" (`row`, Regular), both 28 px. Light at 28 would break the stem floor (Light ≥ 30), so Regular stands in for the board's Light line. The Bold line is the day, because that is the information; the board puts its Bold line second. The black circle `.design-batch-go` (ground ink, mirrored `back` glyph at `--nav-icon`) is `aria-hidden`: the whole card is the target, so a second control inside it is impossible. Where the card is narrower than the board, the two 28 px lines need more than 20.2 % of the width. The pill then grows (`--batch-pill-label`), and the card reserves `--batch-pill-reserve` = `max(20.2 %, label)` below the copy.
- **Photos:** `BatchPhoto` on a card adds `bowed-media` only when there is no user photo, so stand-ins (the four profile photographs and the two new cutouts) are clipped by the outline. User photos stay rectangles inside the content box: `object-fit: contain`, the same uncropped fit as before, never clipped. The image sits in the 48–94 % slot, bottom-aligned (`object-position: center bottom`), so it runs into the bottom bow. The "Stand-in" credit and the finish/status label stack at the bottom right, beside the pill.
- **Cutouts:** `profileVisual` keeps the four existing stand-ins first. After them, drink profiles (`water kefir|kvass|soda|ginger beer|jun|tepache|switchel|shrub|lemonade|mead|cider`) get `grapefruit-spritz` on blue, and fruit profiles (`fruit|berr|plum|apple|pear|cherr|peach|apricot|mango|pineapple|lemon|citrus`) get `fruit-still-life` on lime, both with `pastelOnly`. Milk kefir and the Ginger bug custom profile do not match. They keep the jar fallback, which the seed relies on. A selected (black) card hides a `pastel-only` image and its credit, so the spritz is never shown on black. The batch empty state (`.design-empty-batches` > `.design-empty-card bowed`, lilac, max 382 wide, copy left of the slot, first line in `title`) shows the spritz. The Settings credits list and `public/new-design/README.md` name both cutouts. In the seeded journal the spritz appears on "Water kefir with figs" (and on the profile card for "Water kefir"). **No seeded or starter profile is fruit-based**, so `fruit-still-life` is wired but not visible in the harness.
- **Grid:** `.batch-overview` uses `minmax(min(100%, --batch-card-min 300px), 1fr)` (was 360). At 1440 the list column fits two 351-wide cards instead of one 726-wide card, which at H/W 0.94 would have been 682 tall.
- **Gap 12:** `card-action` (one rule, after the primary-action rules) is a lime capsule `--card-action-width` 60 % × `--card-action-height` 63, centred on the nearest positioned card, `bottom: −h/2`. It uses no transform, so the shared hover lift still works. "Add observation" in `.design-detail-card` carries it. The host keeps `padding-bottom: card padding + h/2` and `margin-bottom: h/2 + --card-action-reserve` (32), so the lower half is part of the pane's scroll content and is never clipped. The button stays where it was in the DOM (in the heading), so the focus order is unchanged. Visually it is now the card's last element, while focus reaches it before the readings and the check row. The first-run empty state got no primary capsule: the "Start a batch" action already exists in the top bar, and a second one would change the focus order and duplicate the accessible name.
- **`.design-check-complete`** (queue cards in the overview's action queue and in Checks) is a card action, so it is now `utility-circle utility-circle-dark` (d 57, white glyph, lime on hover). `.done .design-check-complete` keeps only `opacity: 1` and the lime glyph. The 52 px shared rule now holds only `.profile-editor-icon-button`.
- **Detail photo:** `.design-detail-photo` had shared its box rule with `.design-batch-photo`. It now carries `position: relative; display: grid; overflow: hidden` itself, and its label renders as before.

### Measured (harness DOM boxes, Chrome 157; spec at 382: card H/W 0.94, title 9.3 / 9.4 %, chip h 42 at 6.2 %, pill 55.6 × 20.2 %, circle 63, slot 48–94 %)

| Viewport | Card | H/W (7 seeded cards) | Pill | Circle | Title / chip / slot |
| --- | --- | --- | --- | --- | --- |
| 1440 | 351 × 330 | 0.94 ×6, ginger 1.10 | 195 × 71 | 58 | 9.3 / 9.4 %, chip 42 at 6.2 %, slot x 48 % w 46 % (user photo 42.7 %) |
| 1024 | 400 × 376 | 0.94 ×7 | 222 × 81 | 64 | same |
| 768 | 304 × 286 | 0.94 ×5, kimchi 1.10, ginger 1.37 | 169 × 66 | 54 | same |
| 390 | 342 × 321 | 0.94 ×6, ginger 1.12 | 190 × 69 | 56 | same |
| 320 | 272 × 281–445 | 1.03–1.22, ginger 1.51 | 151 × 66 | 54 | same |

The cards that grow are those whose status and next-check chips do not fit on one line (and the 55-character ginger name, which takes two title lines). At 320 the card is narrower than every chip pair. "Add observation": 60 % of the detail card (219.6 at 1440, 360 at 768, 205 at 390), h 63, centre offset 0, 32 inside and 32 below the card edge. The pane's scroll height contains it.

### Tests

`src/styles.test.ts` adds "batch card anatomy and the card's primary action" (6 tests):

- The token values and their arithmetic: H/W 0.94, pill width / ratio = 20.2 %, slot ends at 94 %, circle 63 at 382 inside the hairline, capsule ≥ 44.
- Exactly one rule each for card, pill, circle, photo, photo image, `card-action` and empty card. No length literal anywhere in the anatomy except 100 %, 50 % and −50 % (glyph `svg` rules and the shared hover lift are exempt). The geometry declarations of the card, copy insets, frosted chip, next capsule, pill, circle, slot image and capsule, and the host's reserve.
- The pill roles (`subheading` + `row`, equal size), the title roles, ink membership, and frosted-chip contrast over black (≥ 7).
- The markup order inside `CompactBatchCard` (one `<button>`; title, profile, meta, chips, pill, circle `aria-hidden`, photo).
- `bowed-media` only without a user photo; the cutouts are `pastelOnly` on accent/action and come after the four profile photographs; selected cards hide them; the empty card is lilac with the spritz; credits.
- `card-action` is used once, on "Add observation", still inside the heading.

Tightened existing tests: the utility-circle exception list no longer includes `.design-check-complete`, and both of its buttons must be dark circles. `.design-batch-next` left `legacyCardRadius`. The palette list gained `--colour-hairline` and `--colour-frost`, both checked by the new token test.

### Results

- `npm run typecheck` clean; `npx vitest run src/styles.test.ts` 65 / 65; plain `npm test` 291 / 291, 15 files, 197 s.
- Harness, full run (60 captures): 0 failed, 0 step-failed, 0 page errors, document overflow 0 / vertical 0. surfaceOverflow 1 (calendar 320, known), clippedControls 0, smallTargets 0.

### Left by ticket 8

- Narrow cards (768 two-column, 320) grow when the status and next-check chips wrap. The next fix would be a card container query that moves the next check into the pill's second line at narrow widths, or that drops the yellow capsule for a meta line. Either one changes the content, so it needs a decision.
- The pill's Bold line is the day ("Day 5") and the Regular line the total. The board's Light-over-Bold order would have put the total in Bold.
- The spec maps the black circle to "open / complete the next check". It stays decorative while the card is one button. Making it a real control means splitting the card into an `<article>` with two buttons, which changes the focus order.
- `fruit-still-life` is not visible in the seeded journal (no fruit profile). Add a fruit custom profile to `scripts/visual/seed.ts` if the harness should show it.
- Gap 12 elsewhere: Settings "Export ZIP" and dialog submits still use their own buttons (Settings and dialog tickets). The first-run empty state has no capsule (see above).
- Out of scope, noticed (one line each):
  - Kitchen summary (gap 11): still a full-width lime grid above the now two-column cards at 1440, with ink counts.
  - Batch detail next-check sub-row (gaps 11/13): its full-width lime "Complete check" button is a second lime action right above the new capsule.
  - Detail readings (gap 13): still black rounded rectangles on the white card.
  - Checks summary (gap 15): the counts on lime are still ink figures.

## Ticket 9: Kitchen summary and big numbers (gaps 11, 15) — done

The region is still `section[aria-label="Kitchen summary"]` with `hidden` outside Overview. No text changed: "Kitchen summary", "N ready to enjoy", "N checks due" (count now in the pill, same DOM reading order), "Total batches" and the three status figures. The summary has no focusable element, so the focus order is unchanged. "Complete check: … for this batch" keeps its name and handler.

### As built

- **Markup** (`App.tsx`): `section.design-summary-group` (flex, wraps, `container-type: inline-size`) > the lime `design-summary bowed` card (emblem `design-summary-emblem` with `StationLogo`, `design-summary-label` h2 + meta, yellow `summary-row design-summary-next bowed`) + `design-summary-figures` on black (`big-number design-gauge` and `design-summary-stats`).
- **Geometry from the card width (convention extended).** Ticket 8's percentages resolve against the containing block, which is not the card once the card is capped. Here the group is the container, and `--summary-w: min(100cqi, var(--summary-max))` is the card width in every rule, so each part is `calc(var(--summary-w) * ratio)`. Tokens: `--summary-ratio` 382 / 221 (H/W 0.58), `--summary-emblem` 0.309 (d 118 at 382), `-emblem-above` 0.47, `-glyph` 0.45, `--summary-row-width` 0.916, `-height` 0.252, `-below` 0.49, `-k` 0.54, `-avatar` 0.167, `-inset` 0.043, `-end` 0.037. The overhangs (emblem above, sub-row below) are the card's own `margin-block`, so the scroll pane never clips them and the next element keeps clear.
- **Wide surfaces: the card is capped, not stretched.** `--summary-max` 382 px (the board's width). With the wide-surface rule (keep r 52 / bow 4.4 and stretch), the 726 px card would have needed either a 225 px emblem (keeping 0.31 W) or a different composition, and H/W 0.58 would have made it 421 tall. Capped, every proportion is 1:1, and the black space beside it holds the big number, as on the board, where "64+" sits next to the profile card. The figures sit beside the card once the group is at least 382 + 32 + `--summary-figures-min` 200 wide (tablet, desktop). On phones they wrap below it.
- **Sub-row** `summary-row` (one rule: yellow fill, k 0.54, flex): lilac `summary-row-avatar` (check glyph, `aria-hidden`; the board's photo slot), label (`row` role), and `summary-row-count` = the `#fff6ce` pill (`--colour-count`, new token), `--count-pill-width` 79 × `--count-pill-height` 49, `order: 1` + `margin-left: auto`, so the DOM reads "3 checks due" and the pill shows at the end. The pill is a fixed CSS size, not a fraction of W, because the same pill holds a button on the batch detail and has to stay ≥ 44.
- **`.design-detail-next`** is now `summary-row … bowed` inside the detail card (not overhanging: the detail card's bottom edge belongs to the "Add observation" capsule). "Complete check" moved from the lime `primary-action` to the cream count pill (`button.summary-row-count`, white on hover), which removes the second lime action that ticket 8 noted. The row keeps the default `--r` 52, because its three text lines make it taller than a sub-row, and r = H/2 would cut the text corners.
- **Big number** `big-number` (gap 15): grid of the display figure (rows 1–2, bottom-aligned), the white `big-number-circle` d 118 (`--big-number-circle`, jar glyph 0.40 d) and the white caption (`meta` role, `color: var(--ink)`) under the circle, gap 10 (board 7 × 1.406). It is outside the lime card, so the display role turns it coral through the ground ink. The status figures (`figure` role) moved onto black with it and are coral too, with lilac "/N" and labels. The display role anchor moved from `.design-gauge strong` to `.big-number > strong`.
- **Coral elsewhere:** unchanged. `.checks-summary` counts stay ink on lime (spec §3 maps the Checks summary to a lime card; gap 15 asks for coral only on black). Readings and the detail "Day N" were already coral on black or ink on fills through their roles.
- **Retired:** the old 3-column summary grid, `.design-gauge small` and the phone overrides for `.design-summary` / `.design-gauge` / `.design-summary-label`.

### Measured (pixel scan of the harness PNGs; spec at 382: emblem 118, 47 % above; sub-row 350 × 96, 49 % below; pill 79 × 49)

| Viewport | Card | Emblem | Sub-row | Pill | Figures |
| --- | --- | --- | --- | --- | --- |
| 390 | 342 × 198 (H/W 0.58) | d 106, 50 px (47 %) above the top | 312 × 85 (0.912 / 0.249 W), ≈ 47 % below (bow AA) | 79 × 49 | below the card |
| 768 | 382 × 221 | d 118 | 348 × 95 | 79 × 49 | beside the card |
| 1440 | 382 × 221 | d 118 | 348 × 95 | 79 × 49 | beside the card |

### Tests

- New describe block "Kitchen summary and big numbers" (4 tests): the token values and their arithmetic (H/W 0.58; emblem 118, sub-row 350 × 96 at 382; pill ≥ 44; ink on `#fff6ce` and on yellow ≥ 7); one rule per part with no length literals except 100 % / 50 %; the card, emblem, sub-row, pill and circle geometry declarations; the group is the container and the card is not; coral only on black (the card closes before the figures in the markup, the figures are in no light-fill ink group, the lime card, white circle and Checks summary are); the content order inside the region and no focusable element; the batch detail's sub-row and its pill button.
- Changed: the old "stacks the phone summary" test now asserts that the summary heading is never `display: none` and that the label holds the h2 (the phone grid it guarded is gone). "{dueChecks.length} checks due" is asserted in its new pill/label form. The hierarchy anchor is `.big-number > strong` = display. The palette list gained `count: #fff6ce`. `summary-row` joined the required bowed surfaces.

At 320 the card is 272 wide: emblem d 84, sub-row 249 × 69, pill 79 × 49.

### Results

- `npm run typecheck` clean; `npx vitest run src/styles.test.ts` 69 / 69; plain `npm test` 295 / 295, 15 files.
- Harness, full run (60 captures): 0 failed, 0 step-failed, 0 page errors, document overflow 0 / vertical 0, clippedControls 0, smallTargets 0. surfaceOverflow 1 (calendar 320, known). No capture step needed changes.

### Left by ticket 9

- The display role is Thin (100). The board's "64+" is Light. A single-digit Thin figure reads thin next to the 118 circle. Moving `display` to Light 300 is a type-system decision (ticket 2 table), so it is left as is.
- The Checks summary (`.checks-summary`) is still a two-count lime card without the profile-card anatomy (no emblem, no sub-row). If it should take the "64+" treatment, its counts must move onto black like the Kitchen summary's.
- The sub-row's avatar is a lilac check circle where the board has a photo. The pill shows only the count, without the board's glyph.
- Out of scope, noticed: none new in timeline, calendar, batch cards or Settings.

## Ticket 10: small cards and Light figures (gap 13, display weight) — done

No text, accessible name, role or focus order changed. The timeline entries keep their kind in a `<strong>` (the App test queries `.timeline-entry strong`), the readings keep `dl[aria-label="Latest observed readings"]` with `dt`/`dd`/`time`, and the upcoming items and strip days stay the same buttons with the same names. The removed `timeline-dot` was `aria-hidden`.

### As built

- **One component, `small-card`** (`src/styles.css`, after the big-number block; used with `bowed`). The card is its own `container-type: inline-size`, so its fill and stroke layers (pseudo-elements query their originating element; checked in headless Chrome) read W as `100cqi`: `--r: min(var(--bowed-radius), 100cqi * var(--small-card-radius))`, `--bow: min(var(--bowed-bow), 100cqi * var(--small-card-bow))`. That is the §2.3 small-component rule below ≈ 325 px and the large-card 52 / 4.4 above it, with no per-instance tuning. k stays 0.64 (§2.3: the phone card's 0.86 is a blur artefact). Fill: `linear-gradient(90deg, var(--small-card-from), var(--small-card-to))`, lilac by default; `.small-card-blue` swaps the two stops; `.small-card-current` adds the lime ring (`--stroke`, gap 14 vocabulary). Parts: `small-card-tag` (lime capsule h 27, `label` role, optional 16 px glyph), `small-card-value` (`figure` role), `small-card-chip` (translucent `--colour-frost` capsule h 30, `meta` role). `.small-card` is in the light-fill ink set, so every word on it is black.
- **Instances.** Timeline entries (`timeline-entry small-card bowed`, blue for pH / temperature / measurement, lilac otherwise; kind = tag, date = chip, Edit/Delete as frosted capsules; `.timeline-content` is `display: contents`). Batch-detail readings (pH lilac, temperature blue; `dt` = tag with its icon, `dd` = value, `time` = chip), now **stacked** like the board's two event cards: side by side they were 139 px wide and "Temperature" broke inside its tag. Calendar upcoming items (finish blue, check lilac; "Finish"/"Check" moved from the bordered `calendar-status` chip to the tag) and overdue items (lilac, "!" mark unchanged). Checks upcoming strip days (lilac, today = lime ring instead of a lime tile). The three lists and the readings stack at `--small-card-spacing` 16 (board: 7.8 board px at the midpoint).
- **Retired:** the white `.design-timeline-panel` card (the timeline now sits on black like the board's event cards; the heading and text actions turn white through the ground ink), `.timeline-note/check/status` flat fills, `.timeline-dot`, `.overdue-item`'s yellow fill, the black `.detail-readings > div` boxes and their `dt`/`dd`/`time` rules, `.upcoming-strip button.today`, and the now unused `.calendar-status` selectors. `.timeline-trash` draws its outline in `currentColor` so it stays visible on black.
- **Display weight (item 2).** Spec §1.6 measures "64+" as **Light**, and §1.7 measures the "04" value as Light too. `--type-display-weight` and `--type-figure-weight` are now 300 (stems 4.6 / 2.2 px, above the 1.4 floor). Both are still single definitions in `:root`. Consequence: no role uses Thin (100) or ExtraLight (200) any more, so the ticket 2 note "uses all seven Unique weights" (D1) no longer holds. The boards use neither weight; **the user should confirm this** (revert = put the two tokens back to 100 / 200 and the weight test's list back to seven).

Tokens added: `--colour-event-lilac` `#d9b4eb`, `--colour-event-lilac-end` `#f6eafc`, `--colour-event-sky` `#b4dff9`, `--colour-event-sky-end` `#e6f6ff` (named "sky" because the palette test rejects colour words in values), `--small-card-radius` 0.16, `--small-card-bow` 0.0125, `--small-card-inset` 19px, `--small-card-inset-top` 27px, `--small-card-gap` 12px, `--small-card-spacing` 16px, `--small-card-tag-height` 27px, `--small-card-chip-height` 30px, `--small-card-glyph` 16px. Ink on every gradient stop ≥ 11:1.

### Measured (pixel scan of the harness PNGs; spec §1.7 at 337: r 54, bow 4.2, tag 110 × 27 at inset 19 / 27, time chip 90 × 30, gap 16)

| Viewport | Instance | Card W | r / bow (from the rule) | Tag | Chip inset |
| --- | --- | --- | --- | --- | --- |
| 390 | reading | 294 × 168 | 47 / 3.7 | h 27 (pH 56 wide, Temperature 108) | 19 left, 24 below the bowed midpoint (27 from the tangent) |
| 390 | timeline entry | 342 | 52 / 4.3 | h 27 | 19 |
| 1440 | reading (detail column) | ≈ 318 | 51 / 4.0 | h 27 | 19 |
| — | strip day | 112 | 18 / 1.4 | — | 19 |

### Tests

- New describe block "small cards" (5 tests): token values and the §2.3 arithmetic (160 px → r 25.6 / bow 2.0; 337 px → capped 52 / 4.2), contrast of every gradient stop; one definition with the exact geometry/fill declarations, single-purpose variant rules, no length literal in any part (only `100cqi`), one rule per part; no instance rule sets fill, outline, stroke, padding, background or border, the upcoming item only lays out its row, the three lists use the spacing token; the retired selectors and `timeline-dot`/`calendar-status` are gone; markup: every `small-card` literal includes `bowed`, the timeline/readings/upcoming/strip class lists, tag/value/chip in the readings, roles label/figure(Light)/meta and that the label and meta lines fit the 27 / 30 chips; ink: `.small-card` is light-fill, no instance is in either ink list, and `--ink-figure` is coral only in ground sets.
- Changed: the weight test is now "applies every role and sets every figure in Light" (display, figure, title-light = 300; weights in use 300–700). The palette list gained the four event colours. `small-card` joined the required bowed surfaces; `.detail-readings > div`, `.design-timeline-panel` and `.upcoming-item` left the legacy radius allowlist. The logger test's `.timeline-entry time` placement assertion now checks the time chip markup.

### Results

- `npm run typecheck` clean; `npx vitest run src/styles.test.ts` 74 / 74; plain `npm test` 300 / 300, 15 files.
- Harness, full run (60 captures): 0 failed, 0 step-failed, 0 page errors, document overflow 0 / vertical 0, clippedControls 0, smallTargets 0, surfaceOverflow 1 (calendar 320, known). No capture step needed changes.

### Left by ticket 10

- Timeline readings still read "pH 4.31" in the body role inside the description; the board's large Light value would need the reading split out of `timelineEntryText` (tests query that text).
- The `.zone` chip inside a pH entry is still the bordered 44 px status chip; the strip day's event chips keep their yellow/lime fills; the board's bookmark circle (d 57) is not used (entry actions are frosted text capsules, shown only with Tools open).
- The `.bowed` element's own `border-radius` (focus outline only) reads `100cqi` against the nearest ancestor container, so a strip day's focus ring is rounder than its fill.
- The harness has no capture of the Checks upcoming strip (it sits in a collapsed section).
- D1: confirm that Thin and ExtraLight may stay unused (see above).

## Ticket 11: calendar month grid, its controls and the upcoming strip — done

No text, accessible name, role, focus order or grid keyboard behaviour changed. Day cells keep `role="gridcell"`, `aria-current`, `aria-selected`, roving `tabIndex` and the event-day buttons with their names and descriptions; the strip days keep their buttons and text (the event chips changed class only).

### As built

- **320 overflow, by rule.** Seven 44 px circles need 308 px; inside the 24 px page edges a 320 screen leaves 272. The old fix pulled `.calendar-panel` 24 px out on each side, so the panel was wider than `section.calendar-screen` (the harness's last surfaceOverflow). Below 380 the **screen** now spans the pane edge to edge (`margin-inline: calc(-1 * var(--layout-edge))`): its box holds the grid, and its head and lists take the edge back as padding (the panel keeps `--space-1`, its head/legend/helper `--layout-edge - --space-1`). Columns: (W − 8) / 7 below 380, (W − 72) / 7 from 380; ≥ 44 at every width (tested at 320, 360, 361, 379, 380, 390).
- **Day circles** (spec §3 "Calendar month grid"). `.calendar-day` is the circle: `width: min(100%, var(--calendar-day))` (the bottom-row circle d 60, else the column), `aspect-ratio: 1`, centred in its column. Event days take `--colour-emblem`; the selected day is black (`.calendar-day.selected` joined the ground ink set, so its number and the event button inside it are white); today is ringed in `--colour-rail` (the stack ring) at `--calendar-ring` = `--bowed-stroke` 3 px. The ring is a border on the cell (every cell carries a transparent one), so neither the focus outline nor its box-shadow is taken. The event button is `position: absolute; inset: calc(-1 * var(--calendar-ring))`, so it covers the whole circle, ring included: its target is the full circle (the first attempt filled only the content box and the harness reported 14 targets of 38.6–39.4 px). Hover is lime, like every circle. The number moved from the `row` role (32 px line, did not fit a 44 px circle with its markers) to `label`; markers and legend dots share `--calendar-marker` 10 px and one pair of fill rules scoped to `.calendar-markers` / the legend.
- **Controls.** "Today" is `utility-circle utility-circle-dark utility-capsule` (dark capsule h 57 beside the two dark arrow circles, which were already the primitive); the desktop/tablet top-bar date chip is `utility-circle utility-capsule` (white capsule h 60, calendar glyph 21 + "18 Mar" in ink, beside the white bell and settings circles). `.calendar-nav .calendar-today` and the chip's own rule are gone; the chip keeps only its phone `display: none`. The spec's "white circle buttons" for month navigation would vanish on the white card, so the ticket 4 decision (dark circles inside the card) stands.
- **Upcoming strip.** Event chips are `small-card-tag` (lime capsule h 27, `label`), centred in the card; the `event-${kind}` classes, their global yellow/lime fill rules and the `.upcoming-strip [class^="event-"]` ink entry are gone. A strip day is a fixed `--strip-day` 160 px small card (r 25.6 / bow 2.0 by the §2.3 rule): `container-type: inline-size` ignores content, so the card cannot size to its labels, and at 112 px every two-word label broke into a round three-line blob. At 160 px "Check brine level" fits one line; "Feed ginger and sugar" takes two.
- **Focus ring follows the bow (primitive).** `.bowed:focus-visible` drops the outline colour (transparent, so forced colours still draw it) and the box-shadow; the stroke layer turns white and the fill shrinks by `max(--stroke-w, --stroke-focus)`, so the ring is a 3 px white band inside the outline, like the selected ring (it replaces a lime ring while focused). An outward ring was tried first: the grown `::before` added 3 px of scrollable overflow to the focused card and its section. Applies to every focusable bowed control (batch cards, upcoming/overdue items, strip days); checked on a keyboard-focused strip day and upcoming item at 390.
- **Found by the new capture.** With "More batch actions" open, the strip's 920 px content widened the actions grid column and the dashboard (surfaceOverflow at every viewport): `.design-more-actions > div` now has `grid-template-columns: minmax(0, 1fr)`. The "Open calendar" link was 26 px tall: `.section-label a` is an inline-flex box with `min-height: 44px`.
- **Harness.** New surface `upcoming-strip` (overview → tap "More batch actions" → scroll to `.upcoming`), all five viewports; no baseline (documented in `visual-verification.md`).

Tokens added: `--calendar-day: var(--nav-circle)`, `--calendar-ring: var(--bowed-stroke)`, `--calendar-marker: 10px`, `--strip-day: 160px`. No colour added.

### Measured (harness DOM boxes; spec: circles ≥ 44, §1.4/§1.5 d 60)

| Viewport | Column | Day circle | Event target | Today ring |
| --- | --- | --- | --- | --- |
| 320 | 44.6 | 44.6 | 44.6 (full circle) | 3 px `#3e3e40` |
| 390 | 45.4 | 45.4 | 45.4 | 3 px |
| 1440 | ≈ 78 | 60 (cap) | 60 | 3 px |

Controls: Today capsule h 57 (dark, like the arrows d 57); date chip h 60 (white, like the bell and settings circles). Strip day 160 wide, tag h 27.

### Tests

- New describe block "calendar and upcoming strip" (5 tests): tokens; the circle, emblem, rail ring, black selected day, full-circle button and lime hover declarations, and no 88 px / action-alt / capsule radius / black border left in any `.calendar-day` rule; label role, ink sets and contrast on emblem and black; markers and legend share size and fills, no global `.event-check/finish` rule; Today, arrows and date chip markup on the primitive and no rule re-styling them (only the phone `display: none`); strip tags are `small-card-tag`, the strip day width token, the actions grid column and the 44 px link; the bowed focus ring rules.
- Changed: the narrow-calendar test now asserts the screen bleed instead of the panel's `width: calc(100% + 48px)`; the column test covers 320 and 390 too. The rail test allows `--colour-rail` outside the rail only in `.calendar-day.today`.

### Results

- `npm run typecheck` clean; `npx vitest run src/styles.test.ts` 81 / 81; plain `npm test` 307 / 307, 15 files.
- Harness, full run (**65 captures**, 13 surfaces): 0 failed, 0 step-failed, 0 page errors, document overflow 0 / vertical 0, **surfaceOverflow 0** (was 1: calendar 320), clippedControls 0, smallTargets 0 (`uniqueSmallTargets` empty; Settings' three inline licence links are recorded as `inline` and not counted, as before). The new `upcoming-strip` captures are clean at all five viewports.
- Visual check: calendar at 320 (full), 390, 768 and 1440; strip at 390; a temporary copy of the harness that Tab-focused a strip day and an upcoming item at 390 (not committed) showed the white ring following the bow.

### Left by ticket 11

- The 160 px strip day is a judgement, not a board measurement (the boards have no strip); long check names still wrap inside the tag.
- A focused card that is also selected/current shows the white focus ring instead of its lime ring until focus leaves.
- `.calendar-overdue-mark` is still a 44 px literal black capsule; `.upcoming-date` keeps `min-width: 44px`.
- The calendar head wraps to two lines at 320 (month label above Today and the arrows); readable, but a later polish could put the month between the arrows.

## Ticket 12: legacy rounded rectangles, primary actions, heading icons, narrow cards — done

Scope: the `--radius-card` allowlist, the gap 12 leftovers, the Settings card-heading icons and the chip row of narrow batch cards. No new component, no new token.

### As built

- **Bowed (large surfaces).** `bowed` className plus `--fill`, with no `background`, `border` or `border-radius` left on them: `.app-loading`, `.empty-state` (Profiles; `.profile-list .empty-state` keeps white), `.ios-install-guide`, `.design-tip` (overview), `.design-input-summary`, `.batch-guidance`, `.next-action`, the measurements `.wb-panel` in `.batch-management`, `.profile-editor-card` (with `.profile-editor-note` as its accent variant), and the pastel boxes in the sheets: `.profile-overview-intro`, `.start-batch-basics` (a `<fieldset>`) and `.start-profile-summary`. `.batch-tools-danger` is a black bowed card with the primitive's stroke (`--stroke: currentColor; --stroke-w: var(--stroke-width)`), which replaces its 1 px border.
- **Small card.** The empty messages `.design-empty-checks` (overview, Checks) and `.calendar-empty` are `small-card bowed` (lilac gradient). Their old yellow bordered rule is gone.
- **Capsule (shared row / control radius).** `.queue-card` (the overview's "A little care today" rows; the Checks view's `.queue-card` inherits it), `.batch-view-switch` and `.profile-card-actions`.
- **Not a card.** `.calendar-screen, .profiles-screen, .design-checks-view` was a dead rule (every screen overrides it to transparent with no padding), and the `.design-detail` top radius was black on black. Both were deleted. `.design-detail-photo` is a photo frame on `--radius-small` (#53: user photos stay rectangular). `.storage-warning` drops its override and shares the notice/alert shape (`--radius-small`). `.design-detail-next` was a stale allowlist entry (ticket 9 made it a `summary-row`).
- **Primary actions.** `.bowed:has(.card-action)` is now the one host rule (padding-bottom and margin-bottom). It replaces the `.design-detail-card` declarations, so any bowed card can own the capsule. Settings "Data exchange" → "Export ZIP archive" is `primary-action card-action`. The first-run card (`.design-empty-card`, when `batches.length === 0` and a profile exists) gets "Start your first batch" (`primary-action card-action`, plus glyph), which opens the start sheet. It has its own name, so it never collides with the top bar's "Start a batch" in tests or for screen readers. `.form-actions:empty { display: none }` removes the gap the export button left behind.
- **Heading icons.** The seven `.settings-emblem` spans (52 px bordered capsules) are now the row avatar `.toggle-avatar` (lilac `--colour-emblem` circle d 63), and the rule is deleted. `.profile-editor-icon-button` (remove check) is `utility-circle utility-circle-dark` (d 57 on the white section), and both of its old rules are deleted.
- **Narrow batch cards.** `.design-batch-chips` no longer wraps. The status chip is `flex: none`. `.design-batch-next` is a block capsule (`min-width: 0`, ellipsis, `nowrap`, vertical padding `(chip height − 1lh) / 2`). The card's `sr-only` line still reads the full next step. At 768 and 320 the cards keep the ratio. Only a card whose title runs to three lines at 320 still grows, and that is the title, not the chips.

### Allowlist

`legacyCardRadius` = `[".activity-logger"]`. It cannot be bowed: it turns into `display: contents` while the modal logger is open, and the primitive's absolutely positioned fill layer would escape to the pane. Moving it needs either a wrapper element or a decision to drop its card look.

### Tests (`src/styles.test.ts`)

- `bowedCards` gained the 13 new bowed surfaces. A new test pins the small-card empty messages, the three capsules, the photo frame, the danger stroke and "activity-logger is never bowed".
- The card-action test checks the generic host rule, the three `card-action` uses (detail, export, first-run) with their exact markup, the seven `toggle-avatar` heading icons and the absence of `settings-emblem`.
- The utility-circle test lost its `profile-editor-icon-button` exception. The anatomy test asserts the one-line chip row.

### Results

- `npm run typecheck` is clean; `src/styles.test.ts` passes 82 tests; full `npm test`: 15 files, 308 tests passed.
- Full harness (65 captures): 0 failed, 0 step-failed, 0 page errors, 0 document, vertical or surface overflow, 0 clippedControls, 0 smallTargets.
- Looked at: settings, batch-tools, profile-editor, first-run, batch-creation and profiles at 390; overview at 768 and 320; settings at 1440.

### Left by ticket 12 (for ticket 13)

- **Dialog submits** stay inline. `station-dialog` is a `bowed-clip` scroll container, so a capsule half outside its bottom edge would be clipped. The options are a non-overhanging capsule variant at the sheet's foot (a new card-action form) or a sticky footer. This needs a decision.
- `.start-batch-basics` is a `<fieldset>`, so the primitive's fill starts below the rendered `<legend>`. "Your batch" now reads as a lime label above the blue card, not as a black capsule on it. It can stay; otherwise float the legend or swap the fieldset for a `role="group"` div.
- Small bowed surfaces (`.start-profile-summary`, `.profile-overview-intro`, `.next-action` at narrow widths) use the default r 52, so short ones read as near-capsules. `small-card`'s width-derived `--r` could become a modifier if that matters.
- `.activity-logger` (see Allowlist). Notices and alerts (`.notice`, `[role="alert"]`, `.storage-warning`) are still `--radius-small` boxes; the spec maps them to black capsules.
- Batch card titles that need three lines at 320 still grow the card.

## Ticket 13: dialog submits, notices, the inline logger card, timeline values, Checks summary, long titles — done

Second leftover sweep. No accessible name, role or focus order changed; one token pair and one radius token were added, no component.

### As built

- **Sheet submits (`card-action-foot`).** The `card-action` primitive gained a foot placement: `.card-action-foot { position: static; flex: none; margin-inline: auto }`. Same capsule (60 % × 63, lime), in flow, so the `bowed-clip` sheet never clips it. The edge host rule is now `.bowed:has(.card-action:not(.card-action-foot))`. `.station-dialog-actions` is a centred column (Cancel above, capsule last, so DOM order = visual order); the phone `column-reverse` and `button { flex: 1 }` are gone. Users: profile overview "Start a batch", start sheet "Open Profiles" and "Start a batch" (submit), and the modal logger's submit in both modes ("Add observation" / "Save activity"). The modal logger in advanced mode now uses the sheet's actions row too (`loggerModal` instead of `basicObservation` picks `station-dialog-actions`, `observation-actions`, `station-secondary` and the capsule); the inline logger keeps `quick-log-actions` and `primary-action`.
- **Notices and alerts.** `.notice, .storage-warning, [role="alert"], .settings-live[role="alert"] > p` share one rule: black fill, 1 px white outline (the toast's look), `padding: var(--space-3) var(--space-6)`, `border-radius: var(--radius-line)`, and they moved from the light-fill to the ground ink set. `--radius-line` (`calc(0.5lh + var(--space-3) + var(--stroke-width))`) is exactly half a one-line notice's height, so a one-line notice is a true capsule. A wrapping notice keeps that end radius instead of becoming a stadium whose ends cut its first and last lines (the storage warning, with heading, text and buttons, is ~200 px tall at 320). The separate Settings alert box rule is deleted. `.field-error` (yellow, left bar) is not a notice and is unchanged.
- **Inline logger card.** `.activity-logger` is only `order: 1`. A new inner `div.activity-logger-card` wraps the heading and the `<dialog>`; it has `className="activity-logger-card bowed"` while the logger is inline and drops `bowed` while it is modal, so no fill layer exists that could escape. `.activity-logger:has(.station-dialog), .activity-logger-card:has(.station-dialog) { display: contents }`. `.activity-logger` itself is never bowed (still tested). **The `--radius-card` allowlist is empty.**
- **Timeline readings as values.** `timelineReading(entry, units)` returns the number for pH ("4.31") and temperature ("21.5 °C", same format as the detail readings). A reading entry renders `<span className="sr-only">{timelineEntryText(…)}</span><span aria-hidden="true" className="small-card-value">…</span>`, so the kind stays in the lime tag, the number is the Light figure, and screen readers still hear "pH 4.31" / "Temperature 68°F" (the App tests that query those sentences pass unchanged). `timelineEntryText` and the text export are unchanged.
- **Checks summary.** The two-count lime card is now the Kitchen summary component, same classes and no new rule: `section.design-summary-group[aria-label="Checks summary"]` > lilac emblem (StationLogo), `h2` "Checks summary" with "N paused batches" (meta), and the yellow `summary-row` with the cream pill "N" + "checks due or overdue". Both counts are ink on lime / yellow / cream. No big number on black (the Checks view has no hero figure). `.checks-summary` and its three rules, ink entry and display-role entry are deleted. Text change: the labels were "Due or overdue" / "Paused batches" (no App test referenced them); the view gains an `h2` before "Scheduled checks".
- **Long titles.** `.design-batch-copy h3` is clamped to `--batch-title-lines` 2 (`-webkit-line-clamp` + `line-clamp`, `overflow: hidden`), which is the two lines `--batch-title-band` already reserves. `--batch-title-overhang` 0.2em of block padding, cancelled by an equal negative margin, keeps leading-1 glyphs unclipped without moving the lines. The card's name ("Open <name>") holds the full title. At 320 "Ginger bug with turmeric and lemon peel — second attempt" now ends "— seco…" and the card keeps its ratio.

### Tests (`src/styles.test.ts`, 85)

- New: notices/alerts capsule, ground ink and the `--radius-line` token; every sheet submit on `card-action-foot` and the foot column; the foot rule only changes placement; the Checks summary markup on the Kitchen anatomy and no Checks-scoped summary rule; the clamp declarations; the timeline reading split and its sr-only sentence.
- Changed: `legacyCardRadius` is `[]`; `activity-logger-card` joined `bowedCards`, `checks-summary` left it; radius values may also be `var(--radius-line)`; the card-action rule list and use count; the logger `:has` rule; the Kitchen-summary tests anchor on `aria-label="Kitchen summary"` (the Checks view now comes first in the file) and count three `summary-row-count`s.

### Results

- `npm run typecheck` clean; `npx vitest run src/styles.test.ts` 85 / 85; full `npm test` 15 files, 311 / 311.
- Full harness (65 captures): 0 failed, 0 step-failed, 0 page errors, 0 document / vertical / surface overflow, 0 clippedControls, 0 smallTargets (the three Settings licence links stay `inline`, not counted).
- Looked at: observation-logger, batch-creation (foot), batch-tools (inline logger card), batch-detail (timeline values) and checks at 390; overview at 320 (clamped title); checks at 1440.

### Left by ticket 13

- The foot capsule is in flow, not sticky: on a long sheet (start form) it is reached by scrolling, as the submit was before.
- Cancel in a sheet foot is the generic outlined capsule at its natural width; the boards show no secondary sheet action to match.
- The storage warning cannot be captured by the harness (it needs a failing store), so its capsule was checked only by the rule; at 320 it is a rounded block with capsule-radius ends, not a stadium.
- The timeline's `.zone` chip is still the bordered status chip; measurement entries (`kind: "measurement"`) keep their text, since they have no single number.
- Still open from ticket 12: `.start-batch-basics` legend, the short bowed boxes' default radius. Ticket 14 items unchanged (launch colours, `theme-color`, harness coverage for dialogs/trash/picker, desktop sidebar shape, type weights).

## Ticket 14: launch colours and harness coverage — done

Config, tests and harness only. `src/App.tsx` and `src/styles.css` are untouched.

### As built

- **Launch colours = the ground `#000000`** (`--colour-surface-inverse`, which `:root` paints as the page background), so nothing grey or white shows before the first paint:
  - `android/app/src/main/res/values/colors.xml`: `colorPrimary`, `colorPrimaryDark` (were `#1c1c1c`) and `stationBackground` (was `#ffffff`). `stationBackground` feeds the splash background (`windowSplashScreenBackground`), the pre-splash `station_launch_background` layer and the post-splash `windowBackground`.
  - `styles.xml` `AppTheme.NoActionBar` sets `android:statusBarColor` and `android:navigationBarColor` to `@color/stationBackground`. On Android 15 edge-to-edge these are ignored and the black window background shows through instead.
  - `capacitor.config.ts` LocalNotifications `iconColor` `#000000`. This is the source; the generated `android/app/src/main/assets/capacitor.config.json` is not in the repo and is written by `cap sync`.
  - `index.html` `theme-color` `#000000`; `src/platform/pwa.ts` (the manifest source that `vite.config.ts` uses) `theme_color` / `background_color` `#000000`.
  - `src-tauri/tauri.conf.json` window `backgroundColor` `#000000` (Tauri 2.11 window and webview background).
- **Harness**: six new surfaces, all five viewports, no baseline. `seed.ts` needed no change because it already holds the deleted batch "Jun tea (abandoned)".
  - `trash`: Settings → "Open recently deleted batches" → scrolled to the toggle and the trash row.
  - `batch-picker`: overview → "More batch actions" → the first upcoming-strip day with several batches → "Choose a batch" sheet. This is the picker earlier tickets meant. The start form's profile chooser is a native `<select>` (already in `batch-creation`); its open list cannot be captured.
  - `profile-overview`: Profiles → "View Kimchi guidance".
  - `batch-dates`: Kimchi detail → "View batch dates".
  - `profile-inputs`: Kimchi detail → "See all" under Profile inputs.
  - `station-info`: station logo (phone, tablet) or sidebar "Home" (desktop).
- The harness now covers 19 surfaces: overview, all-batches, batch-detail, observation-logger, batch-tools, upcoming-strip, checks, calendar, profiles, profile-editor, batch-creation, settings, first-run, trash, batch-picker, profile-overview, batch-dates, profile-inputs, station-info.

### Tests

- `styles.test.ts`: the launch-logo test no longer pins `#1c1c1c` / `#ffffff`. A new test reads the ground from the `:root` token and asserts that every value above (Android colours and bar items, the splash and launch-layer references, `theme-color`, the manifest and the Tauri windows) equals it, and that `colors.xml` holds no `#1c1c1c` / `#ffffff`.
- `pwa.test.ts`: theme and background `#000000`.

### Results

- `npm run typecheck` clean; full `npm test` 15 files, 312 / 312.
- Full harness (**95 captures**, 19 surfaces): 0 failed, 0 step-failed, 0 page errors, 0 document / vertical / surface overflow, 0 clippedControls, 0 smallTargets (`uniqueSmallTargets` empty). The new surfaces report no findings, so this ticket fixed nothing in CSS.
- Looked at all six new surfaces at 390 and 1440.

### What the new captures show that still differs from the Swipe components (not changed, decide later)

- **Trash toggle**: at 390 the expanded "Close recently deleted batches" toggle is a yellow capsule, but at 1440 it is black. The same state takes different fills per viewport. The trash row itself (grey `--colour-row` capsule with a white "Restore" capsule) matches the row vocabulary.
- **Batch picker**: the choices (`.upcoming-batch-choice`) are light-blue capsules with a subheading and a meta line. They are not `toggle-row`s or small cards, and a two-line batch name makes a tall stadium (390, "Ginger bug…").
- **Profile overview**: the yellow intro box is the short bowed box with the default r 52, as ticket 12 noted. Below it, the `dl` facts are lilac labels with lilac values on black, and "pH conditions" is a plain bulleted list. Neither is a Swipe component.
- **Batch dates**: the same lilac-on-lilac `dl`. Values could take the Light figure or white ink.
- **Station info**: the inline "Settings" text button keeps its 44 px minimum width, which leaves a visible gap before the full stop ("Settings ."). Dropping it would need a small-target exemption for inline actions; decide with the target rule.
- **Long sheets** (profile overview at 390 and 1440): the native scrollbar is light grey (`color-scheme: light`) and draws at the sheet's right edge, outside the bow. It is the same in the existing `batch-creation` capture.
- **Android launch**: `station_launch_logo.png` (the transparent logo, unchanged) now sits on black. The jar's dark lid has little contrast against black; the orange cat and jar read. The unused Capacitor placeholder `drawable*/splash.png` files (white ground, blue mark) are not referenced (tested) and were not edited. The adaptive app icon background `ic_launcher_background` stays `#fff`; it is an icon, not a launch surface.
- Not verified on a device or emulator (out of scope): status-bar icon contrast and whether the splash-to-WebView handover has a frame of another colour.

## Ticket 15: final 1:1 audit — done

Full harness at `60dc406` first: 95 captures, 0 failed, every finding count 0. Each spec §1 component (and the §3 surfaces that borrow it) was compared against `ui-board.png` / `drinks-board.png` at 390, 768 (one tablet) and 1440, plus 320 where a narrow layout was in question. The type face (Unique, condensed) is the user's D1 decision and is not counted as a difference.

### Audit

| Component | Board reference | App surface(s) | Verdict | What differs |
| --- | --- | --- | --- | --- |
| Drink card | ui §1.1 | batch card (overview, all-batches) | minor difference | Fill is the batch's pastel, not white (kept from before the rework; §3 does not ask for white). Stand-in jars sit in the 48–94 % slot as rectangles (#53). Ratio, title pair, frosted chip, pill + black circle match. |
| Drink card | ui §1.1 | profile card (profiles) | differs | Facts were outlined capsules → **fixed**, now the frosted chip. Actions are still a white capsule holding a black "Edit profile" capsule and an outlined "Delete" capsule; §3 asks for the Swipe pill with the black circle (= Edit) and Delete as a text action. Needs markup, not cheap. |
| Toggle list | ui §1.2 | Settings preference cards | match | Rows h 72, black selected row, blue switch, avatar d 63 on Suggestions. Units and Notifications rows carry no avatar (minor, content). |
| Toggle list | ui §1.2 | Checks list (checks, overview "A little care today") | minor difference | Separate white capsule rows on black, no enclosing white bowed card; avatar 44 (`--target-min`), board 63; overdue is a yellow row (ink rule: yellow = due/overdue), §3 says black selected row. |
| Toggle list | ui §1.2 | desktop sidebar | match (was differs) | Was white circles + labels on black with a lime current capsule → **fixed by ticket 18**: one white bowed toggle card, rows h 72, pastel avatars d 63 (lilac, peach, mint, sky), current = black row, batch count as a glass pill in the switch slot. "My batches" wraps to two lines beside the count (minor). |
| Toggle list | ui §1.2 | batch picker sheet | match (was differs) | Was light-blue capsules → **fixed by ticket 18**: toggle rows with jar avatars in a white bowed card on the black sheet. Its date eyebrow was lime → **fixed**, blue (`time`). |
| Toggle list | ui §1.2 | trash ("Open recently deleted batches", trash row) | match | The toggle is black in both states. The yellow at 390 is the generic `button:hover` fill: the harness's pointer stays on the toggle after its click; at 1440 the scroll moves the toggle away from it. Touch browsers keep that hover after a tap (decision below). Trash row = grey row + white Restore capsule. |
| Lime button | ui §1.2 | `card-action` (detail "Add observation", Export ZIP, first-run, sheet submits) | match | |
| Profile card | ui §1.3 | Kitchen summary, Checks summary | match | Summary-row avatar is a check icon, board a photo (decision below). Count pill holds the number only (board "8x" + glyph). |
| Profile card | ui §1.3 | batch detail head | minor difference | Title and meta left-aligned, no emblem; "Day 5 / 5" as the Light figure top right. The photo frame is a 1 px bordered `--radius-small` box, its "Active" badge a bordered yellow `.status`, not the frosted chip. |
| Profile card | ui §1.3 | profile editor head | match | Lime bowed head; name field focused (black ring). |
| Utility stack | ui §1.4 | tablet rail | match | Ringed chain, logo on top, lime current circle. |
| Utility circles | ui §1.4/§1.5/§1.7 | top bar, detail top, sheet close, sort, calendar arrows | match | |
| Bottom row | ui §1.5 | phone bottom navigation | match | |
| Bottom row | ui §1.5 | filter chips (overview, all-batches) | match (was differs) | Were h 44 white capsules, gap 8, selected black with a 2 px lime outline → **fixed**: h 60, gap 6, selected lime with ink. |
| 64+ stat | ui §1.6 | big number (overview, first-run) | match | Coral Light figure, white circle d 118, white caption; the condensed face makes the figure narrow (D1). |
| Phone sheet | drinks §1.7 | dialogs, observation logger | match | Long sheets: light native scrollbar drawn outside the bow (ticket 14 note). |
| Search field | drinks §1.7 | overview search row | match | Placeholder is lilac meta; board shows typed white text. |
| Event card | drinks §1.7 | timeline, latest readings, calendar upcoming list | match | No bookmark circle (entry actions are text buttons); the pH "safe" zone chip is a bordered `.zone`, minor. |
| Event card | drinks §1.7 | upcoming strip | minor difference | A four-word label ("Feed ginger and sugar") wraps the lime tag chip to two lines at `--strip-day` 160, a tall blob instead of the h 27 chip. |
| Calendar month grid | §3 (borrows §1.2/§1.4/§1.5) | calendar | minor difference | Matches at 390/768/1440. At 320 the head wraps: "March 2026" on one line, Today + arrows below (heading 100 + controls 194 + gap > 272). Decision below. `.calendar-overdue-mark` 44 literals → **fixed** (`--target-min`). |
| Sheet facts (`dl`) | §3 (ink rules) | profile overview, batch dates | match (was differs) | Values were lilac like their labels → **fixed**, white `--ink`. "pH conditions" stays a bulleted list (decision below). |
| Inline text action | §3 (ink rules) | station info, start-batch notice | match (was minor) | "Settings ." gap → **fixed**: no side padding; the 44 minimum width now only adds ≈ 1 px a side. |
| Profile overview intro | §1.1 vocabulary | profile overview | minor difference | Yellow bowed box at the default r 52 on a tall box (ticket 12 note). |
| Form fields on white | §3 profile editor form | profile editor, inline logger | differs | White fields with a 1 px black border; §3 asks for `#f6f8fa` fill, no border, black focus ring. Touches every editor and logger state (error, focus, disabled), not cheap. |
| Legacy small boxes | gap 1 follow-up | batch tools, detail, settings, editor | differs | `--radius-small` boxes remain: `.meas` tiles (1 px bordered, in "Key measurements"), `.design-detail-photo`, `.component-check-state`, `.timeline-trash`, `.settings-recovery`, `.legacy-formula`, `.profile-editor-formula-row`. Decision below. |

Totals (26 rows): **15 match** (3 of them after this ticket's fixes), **6 minor difference**, **5 differs**.

### Fixed

- `src/styles.css`: new token `--target-min: 44px` (WCAG minimum target); all 22 literal `44px` values (17 rules) outside `:root` now use it, including `.calendar-overdue-mark` (width, height) and `.upcoming-date`.
- `src/styles.css`: filter chips are the bottom-row capsule: `.filter-row` gap `--nav-gap`, buttons `min-height: var(--nav-circle)`, pressed = `--colour-action` with ink (removed from the ground-ink list; the outline is gone). `.quick-log-types` keeps its black pressed state.
- `src/styles.css`: `.profile-facts > span` is the batch card's frosted chip (`--batch-chip-height`, `--colour-frost`, `--batch-chip-blur`, no border).
- `src/styles.css`: `.station-dialog-body dd` takes `color: var(--ink)` (white on the sheet; labels stay lilac meta).
- `src/styles.css`: `.station-text-action { padding-inline: 0; }` (inline sentence action).
- `src/App.tsx` (one line, endings preserved) + `src/styles.css`: the picker's date eyebrow is `<time dateTime>`; `.eyebrow time` takes `--ink-time` (blue on black).
- `src/styles.test.ts`: new "final 1:1 audit (ticket 15)" block (6 tests: no `44px` outside `:root` and the overdue mark on the token; filter chips; profile facts; sheet facts; inline action; eyebrow date). The `.section-label a` assertion now expects `var(--target-min)`.

### Needs a decision

- **Unique Thin / ExtraLight**: unused since the display and figure roles went to Light. Options: drop the two `@font-face` files; keep them for a future display role.
- **Desktop sidebar** (settled by ticket 18: the toggle card): keep white circles + labels on black with the lime current capsule; or the spec §3 white bowed toggle card (rows, black current row, pastel avatars, batch count pill).
- **"Open recently deleted batches"**: keep the black capsule toggle; or a `toggle-row` with the count in the switch slot.
- **Summary-row avatar**: keep the check icon in the lilac circle; or a batch photo / cutout like the board's "Jacob".
- **Picker choices** (settled by ticket 18: toggle rows): keep light-blue capsules; `toggle-row`s (selected black); or small cards.
- **pH conditions** (profile overview): keep the bulleted list; small cards; or `summary-row`s.
- **`splash.png` placeholders and the `#fff` adaptive-icon background**: leave; delete the unreferenced `drawable*/splash.png`; make the icon background the black ground.
- **Calendar head at 320**: accept the two-line head; hide "Today" below 380 (the date chip in the top bar already jumps to today); or smaller dark circles below 380 (needs a token below 57).
- **Sticky hover on touch**: gate the generic yellow `button:hover` fills behind `@media (hover: hover)` (touches every hover rule and its tests); or keep.
- **Remaining `--radius-small` boxes** (list above): bowed small card; `--colour-row` capsule; or flat with no box.
- **Profile card actions** and **form fields on white**: the spec is clear on both; they are listed here only because each needs a markup or state pass that is larger than this ticket.

### Results

- `npm run typecheck` clean; full `npm test` 15 files, 318 / 318.
- Harness re-run for overview, all-batches, profiles, batch-dates, profile-overview, station-info, batch-picker, calendar and checks at 320, 390, 768 and 1440: 0 failed, every finding count 0. Looked at the filter chips (1440), profile facts (390), station-info sentence (390), picker eyebrow (390) and batch-dates facts (390).

## Ticket 16: profile card foot and form fields on white — done

The two "differs" rows from ticket 15 where the spec needs no decision. Everything in ticket 15's "Needs a decision" list is untouched.

### As built

- **Profile card actions** (spec §3 row "Drink card §1.1 / Profile card"). The card's primitive pill is the batch card's `.design-batch-pill` + `.design-batch-go` (`card-action` is the lime capsule, a different component), so Edit reuses those unchanged: `<button aria-label="Edit …" className="design-batch-pill">` holds `.design-batch-bottom` ("**Edit** / profile") and the black circle with the batch card's mirrored arrow. Delete is `design-quiet profile-card-delete`, the existing underlined text action, placed at the card's right inset (`--batch-card-inset-x`) and centred on the pill's height. The white `.profile-card-actions` capsule, its black first button and the ground-ink entry for it are gone. Accessible names, `ref` for focus return, the confirm text and DOM/focus order (main → Edit → Delete) are unchanged.
- New token `--batch-pill-foot` (inset + `--batch-pill-reserve` + `--space-3`): the batch card's bottom padding, now shared with `.profile-card` (both the base and the < 600 px padding). `.design-batch-pill` gains `text-align: start` so its label stays left inside a `<button>`.
- **Fields on white** (spec §3 "Profile editor form"). `input, select, textarea`: `--colour-row` fill, `--stroke-width` transparent border (the slot the states draw in, so text never moves), focus = the shared `:focus-visible` ring (black on white / pastel). States, at class weight via `:where()` and excluding `.dark-field`:
  - invalid (`[aria-invalid="true"]`): black border plus an inset black ring to `--stroke-focus`; on focus the outer focus ring takes the box-shadow and the black border stays. The message stays linked by `aria-describedby`, so the state is shape + text, not colour.
  - disabled and read-only (`[readonly]`, not `:read-only`, which would also match `select`): white ground, dashed black border; disabled also `cursor: not-allowed`. This was the Settings-only disabled look; `.settings input:disabled` (style and ink lists) is folded into the shared rule.
  - Fields on black (`.dark-field`, the search box) are unchanged: same border, fill and focus as before.

### Tests (`src/styles.test.ts`, 98)

- New block "profile card foot and fields on white (ticket 16)", 3 tests: pill markup, order and single pill definition, Delete placement, foot band at both paddings, ink membership; field fill/border/focus with contrast (ink on row ≥ 7, black ring and state borders on white and row ≥ 3); invalid / disabled / read-only rules, cascade order against `:focus-visible` and `.dark-field`, linked error message.
- Updated: batch card padding now `var(--batch-pill-foot)` (token value asserted); `.profile-card-actions` dropped from the capsule list (the rule no longer exists); the "one dark-field definition" test ignores rules that only mention `:not(.dark-field)`.

### Results

- `npm run typecheck` clean; full `npm test` 15 files, 321 / 321.
- Harness for profiles, profile-editor, batch-detail, observation-logger, batch-tools, settings, batch-creation and overview at 320, 390, 768 and 1440: 0 failed, every finding count 0. Looked at the profile card foot (320, 390, 1440), the editor (390: name field focused with the black ring, row-filled inputs, selects on the lilac formula row), the inline status logger (390), read-only "Next" dates (dashed, 390), Settings fields (390) and the sheet's dark fields (1440, unchanged).

### Left by ticket 16

- A borderless `#f6f8fa` field on white is about 1.07 : 1 against the card; the field is identified by its label, fill and placeholder rather than a 3 : 1 boundary (WCAG 1.4.11). The spec asks for it; flagged here in case the user wants a hairline.
- At 1440 the profile cards are about 555 px wide, so the pill scales with them (≈ 308 × 112, circle ≈ 92), as the batch card's pill does at that width.
- The inline logger has no invalid-field path in the harness; the invalid ring is covered by the CSS tests only.

## Ticket 17: glass surfaces — done

The user's ask: "focus on the glassmorphism. Some components have that."

### Measured (spec §1.9)

Five glass surfaces on the two boards: G1 the drink card chip (translucent white 0.5–0.7 over the photo, blurred, 2 px light rim; high confidence), G2 the event card's city chip and G3 its bookmark circle (translucent white over the gradient, alpha 0.2–0.4 on the photographed phone; blur not visible; medium), G4 the sheet scrim (page dimmed to `#adadad` = black 32 % and blurred, σ ≈ 7.4 CSS px; high), G5 the profile card's count pill (`#fff6ce` is exactly white 60 % over the yellow row; medium). Everything else on the boards is opaque, including the Swipe pill, the bottom row, the utility circles and rings, the lime tag chip and the toggle rows.

### As built

- `src/styles.css` `:root`: `--colour-glass` (white 60 %), `--colour-glass-solid` (85 %), `--colour-glass-edge` (40 %), `--glass-blur: 8px`, `--glass-edge: 2px`; `--colour-scrim` 56 % → 32 % (measured), `--colour-scrim-solid` 56 %. Retired `--colour-frost`, `--colour-count`, `--batch-chip-blur`.
- `src/styles.css`, directly after the bowed primitive: the `glass` primitive. `:where(.glass)` sets `--glass` and the rim (inset shadow at zero specificity, so focus rings replace it); one rule `.glass, .station-dialog::backdrop, .glass.bowed::after` applies `background: var(--glass) !important` and `(-webkit-)backdrop-filter: blur(var(--glass-blur))`; `.glass.bowed` moves fill and blur to the bowed `::after` layer (checked in Chrome: the blur follows the bow; capsules and circles clip it to their radius); `@supports not ((backdrop-filter: …) or (-webkit-backdrop-filter: …))` swaps in the -solid fills. States change the fill through `--glass` (`button.glass:hover` yellow as before; the count pill button's hover stays white). `.glass` joined the fill ink set.
- Component rules lost their own fills: `.design-batch-card .status`, `.batch-image-credit`, `.design-photo-label`, `.small-card-chip`, `.timeline-entry-actions button`, `.summary-row-count`, `.profile-facts > span`, and the old `.station-dialog::backdrop` rule.
- `src/App.tsx` (11 lines, endings preserved): `glass` on the batch card status chip, the "Stand-in" credit, the finish / ready label, the profile fact chips, the three small-card time chips, the timeline Edit / Delete buttons and the three count pills.

### Tests (`src/styles.test.ts`, 101)

- New block "glass primitive (ticket 17)", 6 tests: measured tokens (and `#fff7d0` = glass over yellow, retired tokens gone); one applying rule from tokens with both prefixes; bowed composition; fallback block and opacity order; `.glass` in the fill ink set, black ink ≥ 7 : 1 on glass and on the fallback over black, yellow, lilac and sky; `backdrop-filter` only in the primitive, the glass markup present, no glass surface paints its own background.
- Updated: palette list (no `count`), batch card and profile-fact chip assertions, small-card chip, count pill (`--glass` hover), the summary markup literals, the sheet-paint allowlist.

### Results

- `npm run typecheck` clean; full `npm test` 15 files, 327 / 327.
- Harness for overview, all-batches, batch-detail, observation-logger, profiles, checks, batch-creation and profile-overview at 390, 768 and 1440: 0 failed, every finding count 0. Looked at the "Stand-in" and "Ready today" chips over the kombucha jar (390: the jar edge is blurred behind them, rim visible), the time chips and the "Complete check" pill (768), the sheet scrim (390 and 1440: the page behind is dimmed and blurred, as on the drinks board), and a scratch page with a bowed, a capsule and a circle glass over stripes.

### Left by ticket 17

- The phone board's G2 / G3 read lighter (alpha 0.2–0.4) than the ui-board chip; one material at 60 % was chosen (ui-board is primary). Say if the small-card chips should be lighter.
- The scrim is now lighter (32 %); the sheet's black still separates from the page, but the blurred page shows more.
- The detail photo frame's "Active" badge stays a bordered yellow `.status`: it sits on the white frame, which belongs to the remaining `--radius-small` boxes.
- The `@supports` fallback was not rendered (no browser here lacks `backdrop-filter`); it is covered by the CSS tests only.

## Ticket 18: toggle list in the desktop sidebar and the batch picker — done

The two "differs" rows of the ticket 15 audit (Toggle list, spec §1.2), matched to `ui-board.png`.

### As built

- `src/styles.css` `:root`: `--colour-avatar-peach` `#ebcbb2`, `--colour-avatar-mint` `#c3ecb4`, `--colour-avatar-sky` `#b5dced` (spec §1.2 avatar fills after lilac) and `--sidebar-width: 272px` (was a literal 224 in `.app-shell`; 224 leaves no label column beside a 63 avatar and the count).
- Toggle primitive, still one definition: new `.toggle-card` (a white bowed card that is itself the list; add `bowed`), `.toggle-count` (the count pill at the switch's size in the switch slot; `glass` in the markup, as the other count pills) and three zero-specificity `:where(.toggle-row:nth-child(4n + k)) > .toggle-avatar` rules for the pastel order. `[aria-current="page"]` joins pressed and checked as the black selected row (fill rule and ground ink set). The avatar padding rule became `.toggle-row:where(:has(> .toggle-avatar))` so the rail's and phone row's own padding wins.
- Navigation: the desktop rules for circles and the lime capsule moved into `@media (max-width: 1023px)`, where the same elements clear the card (`--fill: transparent`, `padding: 0`) and the rows (`--row-fill: transparent`; current = `--colour-action` with ink). The tablet rail's band is now the card's `--fill`. The phone capsule keeps its bold label through one rule in the phone block. Retired: `.design-nav-count`, the lime desktop capsule, the navigation hover fill.
- Batch picker: `.upcoming-batch-choice` lost its light-blue fill, ink-set membership and meta role; only `.upcoming-batch-choice small { display: block; }` remains.
- `src/App.tsx` (18 lines, endings preserved): `<nav … className="navigation toggle-card bowed">`, buttons `toggle-row nav-*`, marks `nav-mark toggle-avatar`, count `toggle-count glass`; in `BatchPicker` a `div.toggle-card.bowed` around the choices, each a `toggle-row` with a jar `toggle-avatar` and a `toggle-label` (name, events in `<small>`). The landmark, `aria-label`s, `aria-current`, DOM order, handlers, the dialog and the blue `<time>` eyebrow are unchanged.
- `docs/design/swipe-component-spec.md` §3 breakpoints line: sidebar 224 → 272.

### Tests (`src/styles.test.ts`, 105)

- New block "toggle card: desktop sidebar and batch picker (ticket 18 …)", 4 tests: avatar and sidebar tokens (label column ≥ 44 px from the tokens); the card, the avatar order (black ink ≥ 7 : 1 on each pastel) and the count pill once, from tokens; the sidebar markup with landmark, names and `aria-current`, the black current row, the lime capsule and hidden count below 1024; the picker markup, with no `.upcoming-batch-choice` paint left.
- Updated: the navigation-circles test reads the circle rules from the below-1024 block; the "no bar fill" test checks `--fill` instead of `background`; the toggle primitive's single-definition list (card, count, avatar order, the three-state selector); the sheet pastel-box list (no picker choice).
- No behaviour test changed; `src/App.test.tsx` queries the navigation and the picker by role and name.

### Results

- `npm run typecheck` clean; `npm test` 15 files, 331 / 331 (one run had "resets canceled inline 'note' edits…" time out at 30 s under load; it passes alone in 1.8 s and in the rerun).
- Harness: overview, all-batches, batch-detail, checks, calendar, profiles, settings at 1440 and 1024; batch-picker at 390, 768 and 1440; overview at 768; overview and calendar at 390. 0 failed, every finding count 0. Looked at: the sidebar at 1440 and 1024 (white bowed card, four rows h 72, lilac / peach / mint / sky avatars, black "My batches" row with the count pill), the picker at 390 and 1440 (white bowed card on the black sheet, three rows, a long name wraps and its row grows, blue date eyebrow), the rail at 768 and the phone row at 390 (circles, lime current, rail band: as before).

### Left by ticket 18

- At 272 px the label column is about 49 px, so "My batches" sets on two lines beside the count; one line needs a sidebar of about 300 px, which costs the 1024 layout 28 px. Say if that trade is wanted.
- The count pill is glass (60 % white) on the black current row, so it reads grey with black ink, like the status chip on the selected batch card.
- The board's selected row carries a blue switch; navigation rows have no switch, only "My batches" has a count.
- Focus rings on the rows were not captured (the harness has no focus state); they use the shared two-tone `:focus-visible` ring with the existing navigation offset.

## Left for later tickets / known issues

- ~~`styles.test.ts` "opens condensed lettering…" failure~~ — settled by ticket 2 (now guards `h1` = headline).
- ~~Timeout~~ fixed by ticket 2 with `testTimeout` in `vite.config.ts`. Was: `src/App.test.tsx` "reflects edited cadence and pauses and resumes checks with batch status" times out at the 5 s default (it takes 5.3–8 s). It fails the same way at `7133bca` with the foundation changes stashed, so it is a pre-existing slow test, not a regression. Full suite after foundation: 254 passed, 2 failed (these two), 228 s with `--maxWorkers=1`.
- ~~Rounded-rectangle surfaces not bowed yet~~ settled by tickets 12 and 13; the allowlist is empty (the inline logger's card is `.activity-logger-card bowed`). `.activity-logger` must **not** get `bowed`: it switches to `display: contents` while the modal logger is open, and an absolutely positioned fill layer would then escape to the pane.
- ~~`timeline-entry` radius~~ settled by ticket 10 (small-card rule). Was: `timeline-entry` uses the default 52px radius, capped at 50 % of its height. Short entries therefore read as near-capsules. Gap 13 should give them their event-card size and the small-component rule (`--r` ≈ 0.16 W, `--bow` ≈ 0.0125 W below 300px).
- ~~Calendar event days still use `--colour-action-alt` on tall capsules~~ settled by ticket 11 (`--colour-emblem` circles).
- ~~The native launch colours are still `#1c1c1c`~~ and ~~`index.html` `theme-color` is `#ffffff`~~ settled by ticket 14 (all `#000000`).
