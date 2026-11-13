# Swipe rework log

Running record of the 1:1 Swipe rework. Read this before you start a ticket, then add your own entry. Gap numbers refer to `docs/design/swipe-component-spec.md` §4. The harness is described in `docs/design/visual-verification.md`.

## Status by gap

| Gap | State | Ticket |
| --- | --- | --- |
| 1 Card silhouette | **closed** for the surfaces gap 1 lists (see "Bowed surfaces" below) | foundation |
| 2 Ground and ink | **closed**: tokens are now `#000000` | foundation |
| 14 Selection on cards | **closed** for the batch card: 3 px lime ring that follows the bow | foundation |
| 16 Lilac shade | **closed** for avatar and icon circles (`--colour-emblem`) | foundation |
| 3, 4, 5 Navigation and utility circles | open | navigation |
| 6 Typography (blocked by D1) | open | type system |
| 7, 8 Search field, dialogs | open (dialogs are already bowed via `bowed-clip`) | search and dialogs |
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

## Left for later tickets / known issues

- `src/styles.test.ts` "opens condensed lettering…" already failed at `e6e8389`. It looks for `.design-section-head h1`, a rule that no longer exists. That is typography (gap 6), so it was left as is.
- `src/App.test.tsx` "reflects edited cadence and pauses and resumes checks with batch status" times out at the 5 s default (it takes 5.3–8 s). It fails the same way at `7133bca` with the foundation changes stashed, so it is a pre-existing slow test, not a regression. Full suite after foundation: 254 passed, 2 failed (these two), 228 s with `--maxWorkers=1`.
- These rounded-rectangle surfaces are not bowed yet, though they are large cards on the ground: `.design-timeline-panel`, `.batch-guidance`, `.design-input-summary`, `.batch-management > .wb-panel`, `.next-action`, `.design-detail-next` (yellow sub-row → a bowed row with `--r` = H/2, gap 11), `.design-tip`, `.empty-state`, `.profile-editor-card` and `.batch-tools-danger`. Bow them in the ticket that owns them. `.activity-logger` must **not** get `bowed`: it switches to `display: contents` while the modal logger is open, and an absolutely positioned fill layer would then escape to the pane.
- `timeline-entry` uses the default 52px radius, capped at 50 % of its height. Short entries therefore read as near-capsules. Gap 13 should give them their event-card size and the small-component rule (`--r` ≈ 0.16 W, `--bow` ≈ 0.0125 W below 300px).
- Calendar event days still use `--colour-action-alt` on tall capsules. The spec wants `--colour-emblem` circles there (calendar restyle).
- The native launch colours are still `#1c1c1c`: `android/app/src/main/res/values/colors.xml` `colorPrimary`/`colorPrimaryDark`, and `capacitor.config.ts` `iconColor`. `styles.test.ts` asserts them. Switch them to `#000000` together with that test if the launch screen should match the new ground.
- `index.html` `theme-color` is `#ffffff`.
