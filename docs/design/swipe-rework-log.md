# Swipe rework log

Running record of the 1:1 Swipe rework. Read this before you start a ticket, then add your own entry. Gap numbers refer to `docs/design/swipe-component-spec.md` §4. The harness is described in `docs/design/visual-verification.md`.

## Status by gap

| Gap | State | Ticket |
| --- | --- | --- |
| 1 Card silhouette | **closed** for the surfaces gap 1 lists (see "Bowed surfaces" below) | foundation |
| 2 Ground and ink | **closed**: tokens are now `#000000` | foundation |
| 14 Selection on cards | **closed** for the batch card: 3 px lime ring that follows the bow | foundation |
| 16 Lilac shade | **closed** for avatar and icon circles (`--colour-emblem`) | foundation |
| 3 Phone bottom navigation | **closed**: white circles d 60, lime capsule, gap 6, no bar fill | navigation |
| 4 Tablet rail | **closed**: ringed chain, logo on top, lime current circle | navigation |
| 5 Utility circles | **closed**: one `utility-circle` primitive, white d 60 / dark `#1b1b1b` d 57, glyph 21; notifications as its capsule form | utility circles |
| 6 Typography (D1 resolved by the user: readable sizes inside 1:1 geometry) | **closed** for the type system; components still pick their roles in their own tickets | type system |
| 15 Big numbers (colour part) | **partly closed**: figures are coral Light/ExtraLight/Thin wherever they sit on black; the counts on the lime summary stay ink until gap 11 moves them onto black | type system |
| 7 Search field | **closed**: black capsule h 53, 1 px lime outline, lime caret, dark sort circle beside it | utility circles |
| 8 Dialogs | open (already bowed via `bowed-clip`; close buttons are already dark utility circles) | dialogs |
| 9, 11, 15 Batch card anatomy, Kitchen summary, big numbers | open | batch card and Kitchen summary |
| 10, 12, 13 Settings rows, primary action, timeline | open (timeline entries are already bowed) | settings / action / timeline |

Also fixed: the page-scroll defect from the harness baseline. `.sr-only` text inside the scroll panes was absolutely positioned against `.app-shell`, which made the whole document scroll in 49 of 60 captures. `.main-content`, `.design-dashboard` and `.design-detail` are now `position: relative`, so they contain it.

## Primitives and tokens (use these, do not reinvent them)

### Bowed outline: `bowed` and `bowed-clip`

The primitive is defined once, in `src/styles.css` directly after `.sr-only`. It implements spec §2.3 (`clip-path: shape()`).

- **Use it** by adding `bowed` to the element's `className` in `App.tsx`. Then set the colour on the surface rule with `--fill: var(--colour-…)`. `--fill` also accepts a gradient built from tokens, such as `linear-gradient(90deg, var(--colour-action-alt), var(--colour-background))`.
- **Tune** a surface with `--r` (corner radius, default `--bowed-radius` 52px; a bowed row uses half its height), `--bow` (default `--bowed-bow` 4.4px) and `--k` (default `--bowed-k` 0.64). The defaults are declared with `:where()`, so any surface rule overrides them regardless of order.
- **Selected ring:** set `--stroke: var(--colour-action); --stroke-w: var(--bowed-stroke);`. See `.design-batch-card.selected`.
- **Clipped media:** a *direct child* with class `bowed-media` fills the box (`inset: 0`) and is clipped by the outline, like the glass running into the drink card's bottom edge. It sits under all other content. Nothing in the app uses it yet; gap 9 will.
- **Overhang:** content is not clipped. A circle above the top edge or a button half below the bottom edge simply overflows the box. Only the fill, stroke and media layers are clipped.
- **Scroll containers** (the `<dialog>`s) use `bowed-clip` instead. It clips the element itself with `background: var(--fill)`, because a pseudo-element fill would scroll away. It cannot have overhang or a stroke.
- **Never** give a bowed surface `background`, `border*`, `border-radius`, `box-shadow`, or its own `::before`/`::after`. The primitive owns all of them. `.bowed` forces `background: none !important`, so the generic `button:hover` background cannot paint the rectangle.
- **Fallback:** without `shape()` support (Firefox and older WebKitGTK were not verified), every layer becomes a rounded rectangle at `--r`. The scratchpad demo was checked with shape support forced off: fill, ring, media and overhang all stayed intact.
- **Fidelity:** a 382×359 `bowed` box rendered in Chrome 157 against the ui-board drink card measures 0.25 board px rms and 1.2 board px max, including the ill-conditioned corner tips. The top-edge bow is 2.96 against the board's 3.0.

Bowed surfaces today (enforced by `src/styles.test.ts`): `design-batch-card`, `design-summary`, `checks-summary`, `design-detail-card`, `profile-card`, `profile-editor-section`, `profile-editor-head`, `calendar-panel`, `settings-card`, `batch-component-card`, `timeline-entry` (`bowed`) and `station-dialog` (`bowed-clip`). The retired `::before` black-notch bars and the asymmetric `2rem 2rem 2.5rem 2.5rem / …` radii are gone.

### Colour tokens

All colour literals live in `:root` as `--colour-*` tokens. The test fails on any hex, `rgb()`/`hsl()`/`oklch()`/…, or named colour anywhere else in `styles.css`, and on any colour literal in `App.tsx`.

| Token | Value | Use |
| --- | --- | --- |
| `--colour-surface-inverse` | `#000000` | ground, selected rows and cards |
| `--colour-text`, `--colour-text-muted`, `--colour-on-action`, `--colour-border` | `#000000` | ink on light fills |
| `--colour-emblem` | `#c5b4ec` | avatar, emblem and icon circles (ui-board lilac) |
| `--colour-action-alt` | `#dab8f1` | lilac card fills and gradient starts |
| `--colour-scrim` | `rgb(0 0 0 / 56%)` | dialog backdrop |

The other tokens are unchanged: `#ffffff`, `#ffec89`, `#b6f074`, `#b6e1fa`. If a ticket needs a new colour (for example coral `#fc5659` for gap 15, or the switch blue `#2089fd` for gap 10), add it to the `:root` token layer and to the expected list in the palette test.

### Radii

Outside the primitive, `border-radius` may only be `var(--radius-control)` (capsules), `var(--radius-small)`, `var(--radius-card)`, `50%` or `0`. Literal lengths and slash syntax fail the test. `--radius-card` is a **legacy, shrink-only allowlist** (`legacyCardRadius` in `styles.test.ts`) of rounded rectangles that predate the primitive. When your ticket bows or capsules one of them, delete it from the list. A new selector that uses `--radius-card` fails the test.

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
| display | 6.25rem (100) | 100 Thin | 0.9 | 0 | hero counts (spec §1.6 "64+", figure 71 px) — colour `--ink-figure` |
| figure | 3rem (48) | 200 ExtraLight | 1 | 0.01em | values: day count, readings, metrics, dates ("04" role ≈ 42) — `--ink-figure` |
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

## Left for later tickets / known issues

- ~~`styles.test.ts` "opens condensed lettering…" failure~~ — settled by ticket 2 (now guards `h1` = headline).
- ~~Timeout~~ fixed by ticket 2 with `testTimeout` in `vite.config.ts`. Was: `src/App.test.tsx` "reflects edited cadence and pauses and resumes checks with batch status" times out at the 5 s default (it takes 5.3–8 s). It fails the same way at `7133bca` with the foundation changes stashed, so it is a pre-existing slow test, not a regression. Full suite after foundation: 254 passed, 2 failed (these two), 228 s with `--maxWorkers=1`.
- These rounded-rectangle surfaces are not bowed yet, though they are large cards on the ground: `.design-timeline-panel`, `.batch-guidance`, `.design-input-summary`, `.batch-management > .wb-panel`, `.next-action`, `.design-detail-next` (yellow sub-row → a bowed row with `--r` = H/2, gap 11), `.design-tip`, `.empty-state`, `.profile-editor-card` and `.batch-tools-danger`. Bow them in the ticket that owns them. `.activity-logger` must **not** get `bowed`: it switches to `display: contents` while the modal logger is open, and an absolutely positioned fill layer would then escape to the pane.
- `timeline-entry` uses the default 52px radius, capped at 50 % of its height. Short entries therefore read as near-capsules. Gap 13 should give them their event-card size and the small-component rule (`--r` ≈ 0.16 W, `--bow` ≈ 0.0125 W below 300px).
- Calendar event days still use `--colour-action-alt` on tall capsules. The spec wants `--colour-emblem` circles there (calendar restyle).
- The native launch colours are still `#1c1c1c`: `android/app/src/main/res/values/colors.xml` `colorPrimary`/`colorPrimaryDark`, and `capacitor.config.ts` `iconColor`. `styles.test.ts` asserts them. Switch them to `#000000` together with that test if the launch screen should match the new ground.
- `index.html` `theme-color` is `#ffffff`.
