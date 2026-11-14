# Swipe component spec (measured)

Status: authoritative build reference for the UI rework on branch `new_font`. It supersedes the geometry notes in `public/new-design/README.md` and the "app adaptation" values in `src/styles.css` wherever the two disagree.

Implementers should build from this document. Do not re-measure the boards unless a value here is marked **[R]** and you need more precision.

## 0. How to read this document

- **[M] Measured.** The value was sampled from the board PNG with Python and Pillow: flood fill, run-length scans, sub-pixel edge crossings at alpha 0.5, or least-squares shape fits. Boxes are inclusive board pixels `(x0,y0)-(x1,y1)`. Colours are the median of a 3×3 patch or of a run.
- **[R] Reconstruction.** The value was derived from measured numbers through an assumption, which is stated. Examples: conversion to CSS px, font size from cap height, hidden geometry.
- **Board px** are pixels of the source PNG. **CSS px** are app pixels at device scale 1.
- **Ratios** are given as a fraction of the component's own width `W` unless stated otherwise (`/H` = of its own height). Build with these ratios so components scale.

### 0.1 Scale from board pixels to CSS px [R]

| Board | Factor | Derivation |
| --- | --- | --- |
| `ui-board.png` (1024×602) | **1 board px = 1.406 CSS px** | `type-board.png` labels its body sample "18 PX". Its cap height measures 9 board px [M], and Circular's cap height is 0.70 em, so 9 / (18 × 0.70) = 0.711. That matches a 1440 px page exported at 1024 (0.711). `ui-board.png` has the same 1024 export width. |
| `drinks-board.png`, phone screen | **1 board px = 2.11 CSS px** | The dimmed page behind the sheet spans x 667–851 (185 board px) [M]. The phone is a 390 CSS px device. |

Cross-check [M→R]: the card corner radius converts to **52 CSS px** on the ui-board (37 × 1.406) and to **54 CSS px** on the phone (25.5 × 2.11). The search-field height on the phone converts to 52.7 CSS px; the app's `--input-height` is 52 px. The utility circle converts to 60 CSS px on the ui-board, and the phone's filter circle to 57 CSS px. Both boards therefore describe the same physical scale within about 5 %, and the CSS px columns below can be used directly at 390 px phone width.

### 0.2 Measurement scripts

The scripts are in the session scratchpad and are not part of the repo. They are named here so that a value can be traced.

- `edge.py` / `contour.py`: sub-pixel outline crossings (alpha against a known foreground and background).
- `fit.py` / `fitall.py` / `fit2.py`: the outline model fit in §2.
- `blob.py`: flood-fill boxes and fills.
- `scan.py`: run-length colour scans.
- `ink.py` / `lines.py`: ink boxes of text and icons.
- `compare2.py` and `shape_render.py`: browser render plus outline residual.

---

## 1. Component inventory

Global facts [M]:

- **Ground.** The ui-board ground is `#000000` (sampled at x 300–699, y 140; 400 px run). The phone sheet is `#000000`–`#030100`. Pure black is also used for the selected toggle row (`#000000`) and the Swipe button (`#010101`). `#1c1c1c` appears only as the black colour swatch on `type-board.png`. It is never a ground or ink on the two component boards.
- **Text ink** on white, lime and yellow is `#000000`: the darkest pixels of "Orange", "Drinks", "Now", "Cindy…" and the lime title are `#000000`–`#030000`. Light weights only antialias lighter ("Swipe" darkest is `#2e2e2e`).
- **Pastels, as printed and as sampled.**

  | Role | Sampled on the component boards | Printed swatch (`type-board.png`) |
  | --- | --- | --- |
  | lime | `#b7f075` (card, button, Scan pill, tag chip) | `#b6f074` |
  | yellow | `#ffec85`–`#feed88` (sub-row) | `#ffec89` |
  | lilac | `#c5b4ec` (profile circle), `#bdace4` (toggle avatar) | `#dab8f1` |
  | blue | `#b5dced` (toggle avatar) | `#b6e1fa` |

  Lime and yellow match their swatches. **The two lilacs on `ui-board.png` are bluer and about 10 % darker than the printed `#dab8f1`.** The phone's lilac event card starts at `#d9b4eb`–`#dcbbf1` on its left edge, which does match the swatch.
- **Outline family.** Every large card has straight vertical sides, top and bottom edges that bow *inward*, and corners slightly squarer than a circle. §2 gives the exact model. Pills, rows and circles are plain capsules and circles, with no bow.

### 1.1 Drink card ("Orange Drinks") — `ui-board.png`

Crop: `(42,161)-(314,417)`. Outer box [M]: x 42.24–313.88, y 161.56–416.73, from sub-pixel edges at the corner tangents. **W 271.64 × H 255.17 board px = 382 × 359 CSS px [R]; H/W 0.939.**

| Part | Measured [M] | Ratio of W | CSS px [R] |
| --- | --- | --- | --- |
| Card fill | `#ffffff` | | |
| Outline | §2 model: r 37.0, k 0.63, bow 3.15 top and bottom, sides straight. Fit rms 0.13 px. | r 0.136, bow 0.0116 | r 52, bow 4.4 |
| Title line 1 "Orange" | Bold. Ink x 67–159 (w 93), "O" 187–208, cap ≈ 20. Left edge 25.3 from the card's left side, top 25.5 below its top. | cap 0.074, inset x 0.093, inset y 0.094 | cap 28 → Circular ≈ 40 px |
| Title line 2 "Drinks" | Light/Book, same size as line 1. Ink x 68–139. Baseline pitch L1→L2 = 28 board px. | pitch 0.103 | line-height ≈ 1.0 |
| Chip "Swipedrinks Festival ↗" | Frosted pill over the photo: x ≈ 59–197, y ≈ 249–279 (fill `#fdfdfd`–`#fefefe` on white; over the glass it lightens the orange to `#faf6f3`–`#fcc4a6`, so translucent white plus backdrop blur). Text cap 7, darkest `#151515`; text x 76–183. Arrow ↗ at its right end. | w 0.51, h 0.11, inset x 0.062 | h 42, text ≈ 14 px |
| "Swipe Now" pill | x 54–≈205, y 352.5–407.5 (h 55). White fill. Hairline outline peaks at 14/255 below white (≈ `#f1f1f1`, 1 board px), visible on the top, bottom and left. Bottom inset 9 above the card's bottom edge, left inset 11.8. | w 0.556, h 0.203, inset x 0.043, inset bottom 0.033 | 212 × 77 |
| Label "Swipe / Now" | Two lines, left-aligned at x 73 (19 from the pill's left end). "Swipe" Light, cap 10. "Now" Bold, cap 10. Baselines 377 / 392 (pitch 15). | cap 0.037 | ≈ 20 px font, line-height 1.06 |
| Black circular button | `#010101`, box (156,358)-(200,402): **d 45**, centre (178.0, 380.1). Inset 5 from the pill's top, bottom and right end, so the button sits *inside* the pill. White "$-in-circle" glyph 15×16, stroke ≈ 1.5. | d 0.166 | 63 |
| Cutout photo | A transparent-background glass (orange spritz) occupies x ≈ 173–297 (0.48–0.94 W) and starts at y ≈ 183 (0.08 H). **It runs to the card's bottom edge and is clipped by the bowed bottom outline.** The stem foot at x 258–270 ends at y 416–417; below that is ground `#000000`. It does *not* cross the top or right edge. The chip overlaps the photo's left side, and the photo overlaps the pill area. | | |

Layering, bottom to top [M]: card fill → photo (clipped by the card outline) → frosted chip → pill → black button.

### 1.2 Toggle list card — `ui-board.png`

Crop: `(338,161)-(610,467)`. Outer box [M]: x 338.12–609.56, y 161.56–446.47. **W 271.44 × H 284.91 = 382 × 401 CSS px [R].** Same outline model as §1.1: r 37.5, k 0.65, bow 3.15, rms 0.13 px.

| Part | Measured [M] | Ratio of W | CSS px [R] |
| --- | --- | --- | --- |
| Row (all four) | Capsule. x 349.44–598.31 (w 248.9), h 51.1, radius = h/2. Straight top and bottom; the edges were traced and are flat to ±0.01 px. Row 1 top at 181.66, which is 20.1 below the card top. Pitch 56.9; gap ≈ 5.8. Last row bottom ≈ 404. | w 0.917, h 0.188, inset x 0.042, top inset 0.074, pitch 0.210 | 350 × 72, gap 8 |
| Selected row | Fill `#000000`; text `#ffffff` (lightest `#fefdfd`). | | |
| Unselected rows | Fill `#f6f8fa`, with soft shading from `#f3f5f7` to `#fcfeff` inside the row (a very light inner gradient or shadow). Text `#000000`. | | |
| Avatar circle | d 45 (box 353–397), centred vertically in the row, 3.5 in from the row's left end. Fills `#bdace4` lilac, `#ebcbb2` peach, `#c3ecb4` green, `#b5dced` blue. Each holds a black logo mark. | d 0.166 | 63 |
| Row label | Regular, cap 10, x-height 7. Starts at x 410–411, 13 after the avatar. Vertically centred. | cap 0.037 | ≈ 20 px font |
| Switch, ON (selected row) | Track `#2089fd` (iOS-style blue, **not lime**), x ≈ 553–583 (w 30), y 198.5–216 (h 17.5). Knob `#ffffff` d ≈ 14, on the right. The track's right end is 15 in from the row's right end. | track 0.110 × 0.064 | 42 × 25, knob 20 |
| Switch, OFF | Track `#eceef0` (x 570–582 visible), knob `#fcfeff` d ≈ 14 on the left (x 556–569), same track size. | | |
| Lime button | Capsule `#b7f075`, x 393–555 (w 163), y 421–466.1 (h 45). **Centred horizontally on the card** (centre 473.8; card centre 473.84). **Its vertical centre (443.5) sits on the bowed bottom edge's midpoint (443.4)**, so half the button hangs below the card. No label in the artwork. | w 0.600, h 0.166 | 229 × 63 |

States visible [M]: one selected row (black fill, white text, blue ON switch) and three unselected rows (pale fill, black text, OFF switch).

### 1.3 Profile card (lime, bowed) — `ui-board.png`

Crop: `(633,160)-(906,389)`. Lime body [M]: x 633.72–905.47 (**W 271.75**), top 197.24 at the corner tangents. The bottom is hidden by the yellow row. Matching the visible bottom-corner trace to the drink card's corner gives a bottom at ≈ 354.6, so **H ≈ 157.4 [R] (H/W 0.58)**. Outline per §2: r 37.0, k 0.64, bow 3.3, rms 0.17 px (top and sides fitted).

| Part | Measured [M] | Ratio of W | CSS px [R] |
| --- | --- | --- | --- |
| Lime body | `#b7f075` (`#b4f276`–`#b6e976` across the surface) | | 382 × 221 |
| Lilac avatar circle | `#c5b4ec` (edge samples `#bdb2e7`–`#c2b5ec`). Box (728,160)-(811,243): **d 84**, centre (769.7, 201.7). Horizontally centred on the card (card centre 769.6). Its centre is 4.5 below the corner tangent line and 2.3 below the bowed top's midpoint (199.4), so **the circle straddles the top edge: 47 % of it above the edge, 53 % inside.** Black logo glyph ≈ 0.45 d. | d 0.309 | 118 |
| Title "Bevegemse Vijvers" | Bold, centred. Ink x 683–857 (w 175 = 0.64 W), cap 15.5, baseline 276.5 (79 below the corner tangent line). | cap 0.057 | ≈ 31 px font |
| Meta "Created **4/07/2022**" | Regular + Bold date, centred. Ink x 728–812, cap 7, baseline 300. Ink darkest `#0f0d06`. | cap 0.026 | ≈ 14 px font |
| Yellow sub-row | Fill `#ffec85`–`#feed88` (printed `#ffec89`). Box x 645.3–894.1 (**W 248.8**), y 319.9–388.3 (**H 68.4**). Inset 11.6 / 11.4 from the lime sides. Its own bowed outline: top and bottom bow inward by 3.3 / 3.4, ends are capsule-like. Fit: r 34.0 (= H/2), k 0.54, bow 3.3, c 0.45, rms 0.13 px. **It overlaps the lime card's bottom edge: 34.7 px (51 %) inside, 33.7 px (49 %) below.** | w 0.916, h 0.252 | 350 × 96 |
| Photo avatar | Circular photo d ≈ 45.5, box (657,331)-(702,377), 11.7 from the sub-row's left end, vertically centred (354). | d 0.167 | 64 |
| Name "Jacob" | Regular/Medium, cap 10.5, starts at x 711 (9 after the photo). | | ≈ 21 px |
| Count pill "8x 🥤" | Fill `#fff6ce` (centre `#fff8d0`), box (829,337)-(884,371): w 56, h 35, capsule. Right inset 10 from the sub-row's end. "8x" Regular, cap 10. Filled glass glyph 12×14 `#050104`. | w 0.206, h 0.129 | 79 × 49 |

Layering, bottom to top [M]: lime body → yellow sub-row → photo, name and count pill. The lilac circle sits above the lime body and over the ground.

### 1.4 Vertical stack of circular utility buttons — `ui-board.png`

Crop: `(930,160)-(981,445)`. A continuous dark "chain": every circle sits in a ring `#3e3e40` (samples `#363636`–`#454547`). Adjacent rings overlap, so the column reads as one rail with scalloped sides [M].

| Part | Measured [M] | CSS px [R] |
| --- | --- | --- |
| Ring / rail | Outer width 51 (x 930–980), y 160–444. Ring thickness (51 − 42)/2 ≈ 4.5. Between circles the rail narrows to ≈ 33 wide (x 939–971 at y 300). | 72 wide, ring 6 |
| Button circle | White `#ffffff`/`#fefeff`. d 41–42 (flood fill) / 42.7 (edge-based on the bottom row). Centres x 955.2, y 231.6 / 278.4 / 325.2 / 372.2 / 419.2: **pitch 46.9**. | d 60, pitch 66 |
| Top item | Photo avatar, same ring, ≈ 44 d, y ≈ 165–209. | |
| Icons | Outline glyphs ≈ 14–15 × 14–15 (bell, flag, user-plus, alert-circle, log-out). Ink darkest `#353537` (thin stroke ≈ 1.1–1.2 board px). The flag is full colour. | glyph 21, stroke ≈ 1.6 |

### 1.5 Bottom row of circular icon buttons with "Scan" pill — `ui-board.png`

Crop: `(46,471)-(310,515)`.

| Part | Measured [M] | CSS px [R] |
| --- | --- | --- |
| Circle button | White `#ffffff`. Edge-traced d 42.6 × 42.8 (x 46.52–89.16, y 471.68–514.48). Centres x 68.1 / 114.8 / — / 241.2 / 288.1, y 493.0. **Gap between neighbours ≈ 4.3.** No ring on this row; the circles sit directly on black. | d 60, gap 6 |
| Scan pill | Lime `#b7f075`, capsule, x ≈ 140–216 (w ≈ 76), h = circle d. Contents: a dashed "scan frame" glyph 15×15 at x 154–169, then the label "Scan" (Regular, cap 9, ink x 178–200, `#1b1e0e`). Padding left ≈ 13, icon-to-label gap ≈ 9, padding right ≈ 15. | 107 × 60, label ≈ 18 px |
| Icons | Glyph boxes 13–16 (glass 14×16, receipt 13×15, $ 16×16, card 16×11). Stroke ≈ 1.5 board px (median run 2). Ink `#191919`. Icon ≈ 0.37 of circle d. | glyph 21, stroke ≈ 2 |

### 1.6 "64+" stat — `ui-board.png`

Crop: `(660,449)-(875,562)`.

| Part | Measured [M] | CSS px [R] |
| --- | --- | --- |
| Number "64+" | Coral `#fc5659` (median of 1619 saturated px). Light weight. Figure height 50–51 ("6" 499–549). "+" is 30×30 at y 514–543, optically centred on the figures. Ink x 665–782. | figure 71 → Circular ≈ 100 px |
| Companion circle | White `#ffffff`, d 84 (x 789–872, y 450–533), 7 to the right of "+", top 49 above the figures' top. 4-diamond glyph 34×34 (0.40 d), ink black, solid. | d 118 |
| Caption "Components" | White `#fdfdfd`, cap ≈ 10, centred under the circle (x 793–867), baseline 557 (24 below the circle). | ≈ 14 px |

### 1.7 Phone screen "Search events" — `drinks-board.png`

Crop: `(660,90)-(860,450)`. All CSS values use the 2.11 factor [R].

| Part | Measured [M] | CSS px [R] |
| --- | --- | --- |
| Context | The page behind is dimmed to `#adadad`. A black grabber bar sits above the sheet. | |
| Sheet | `#000000`. Spans the full screen width (x 665–851). **Top edge bows inward**: corner tangents at y ≈ 112.0, midpoint 114.7, so bow 2.7. Corner radius ≈ 20 board px [R, visually comparable to the cards]. | bow 5.7 |
| Header "Search events" | White, Regular/Medium, centred (ink x 727–791). Cap ≈ 7.5. | ≈ 22 px font |
| Filter button | Circle `#1b1b1b`–`#1f1f1f`, d 27, box (815,121)-(841,147). Right inset 10 from the sheet edge; centre y 134.2, aligned to the header's centre line. White 3-line filter glyph ≈ 0.35 d. | d 57, inset 21 |
| Search field | Capsule, x ≈ 676–842, y ≈ 159.5–184.5 (h 25). **Fill `#000000`, 1 CSS px lime border.** The stroke samples are `#334322`–`#4c6832`, which is `#b6f074` at about 40 % pixel coverage, as a 1 CSS px line rendered at 0.47 board px gives. White search glyph, white text "Rock", lime caret. | 350 × 53, border 1 |
| Event card (lilac) | x 678.98–838.56 (**W 159.6**), y 192.43 (corner tangent) to ≈ 310.5. **H ≈ 118.1, H/W 0.74.** Bowed outline: top 192.43 → 194.50 at the midpoint (bow 2.1); bottom bows too. Fit: r 25.5, k 0.86, bow 2.0, rms 0.14 px. **Horizontal gradient** from `#d9b4eb`/`#dcbbf1` (left) to `#f3e6fd`/`#f7ebfc` (right). | 337 × 249, r ≈ 54, bow 4.2 |
| Event card (blue) | Same geometry, from y ≈ 314 to ≈ 431. Gradient `#b4dff9` (left) → `#e6f6ff` (right). Gap between the cards: 7.8 at the midpoints, about 3.5 at the corners. | gap 16 at the midpoint |
| Lime tag chip | `#b6f179`, box (688,205)-(739,217): w 52, h 13, capsule. Inset 9 from the card's left, 12.6 from its top. Text "Rock Zottegem" ink `#566b41`-ish (antialiased dark), cap ≈ 4. | 110 × 27; text ≈ 11 px |
| "Tokens" + "04" | "Tokens": small, x-height ≈ 4, `#585567`. "04": Light, figure height 14 (y 248–261), ink `#222728`. Left-aligned with the chip (x 689). | "04" ≈ 42 px font |
| City chip "New York city" | Translucent white over the gradient (card `#e3c2f8` → chip `#e6d1f4`–`#f3e6fd`). x ≈ 687–730, y ≈ 276–290, capsule. Text cap ≈ 4. | 90 × 30 |
| Bookmark button | Translucent white circle, d ≈ 27, top-right, inset ≈ 6 from the top and right. Black outline bookmark glyph. | d 57 |
| Cutout photo | A child with a glass. It occupies the right ≈ 50 % (x ≈ 760–835, head top y ≈ 212) and is **clipped by the card's bowed bottom edge**. | |

Board fidelity note [M]: the phone board is a photographed device mockup. Edge sharpness is lower (0.47 board px per CSS px), so phone-board radii carry about ±2 board px uncertainty. The ui-board values are the primary reference wherever both boards show the same thing.

### 1.8 Secondary boards (not measured in detail)

`type-board.png` swatches are plain rounded rectangles: 199×113 board px, `#ffec88`, `#b7f075`, `#d9b8f1`, `#b6e2fa`, and the black `#1c1c1c` (labelled "#FFEC89", a labelling error). Each has a white circular icon button in its top-right corner. This board fixes the palette hexes and the 18 px body size. It is not a component reference. `home-*.png`, `target-*.png` and `page-*.png` are page context. They were not measured for this spec.

### 1.9 Glass surfaces — `ui-board.png`, `drinks-board.png`

Glass here means a translucent fill over a photo, gradient or coloured ground, with what lies behind it visible and blurred. Every surface on the two boards was checked; the ones below are glass. Alpha is estimated per channel as `(inside − behind) / (fill − behind)`, from pixel runs that cross the surface's edge [M]. Where the ground behind is flat, glass and a flat tint look the same; the confidence column says which case applies.

| # | Component | Shape and size | Fill and alpha [M] | Edge | Text on it | Confidence |
| --- | --- | --- | --- | --- | --- | --- |
| G1 | Drink card chip "Swipedrinks Festival ↗" (§1.1) | Capsule, 138 × 30 board px (h 42 CSS) | White. On the white card it is `#fdfdfd` (no visible edge). Over the photo, the orange slice behind it (`#ffb800` / `#fea917` just outside) turns to `#fdcbb6` / `#feb889` inside: alpha 0.5–0.7 (blue channel), and the slice's sharp edges are smeared flat for 6 px, so the backdrop is blurred (σ ≥ 4 board px ≈ 6 CSS px). | A light rim, about 1.5 board px (≈ 2 CSS px), where it lies over the photo: `#fddfd1` against the `#fdcbb6` fill, which is white at about 40 % over the fill. No shadow. | Black (`#151515` darkest) | High: translucent, blurred, rimmed |
| G2 | Event card city chip "New York city" (§1.7), both cards | Capsule, 43 × 14 board px (90 × 30 CSS) | White over the gradient: lilac `#debdf3` → `#e3caf8`, blue `#b8e2fb` → `#cce9fa`, alpha ≈ 0.2–0.3. The card gradient runs on through it. Blur cannot be seen (the ground is a smooth gradient). | Soft, no rim resolved (photographed screen) | Black | Medium: translucent; blur inferred from G1 |
| G3 | Event card bookmark button (§1.7), both cards | Circle, d ≈ 27 board px (57 CSS) | White: lilac `#f0ddfb` → `#f7ebfc`, blue `#ceebfc` → `#e4f3fe`, alpha ≈ 0.4. Blur cannot be seen. | Soft, no rim resolved | Black outline glyph | Medium: translucent; blur inferred from G1 |
| G4 | Sheet scrim (§1.7) | The page behind the sheet, full screen | Black over the page: white `#ffffff` → `#adadad`, so black at 32 %. The page's text ("… profile") and back circle are blurred: a cap of ≈ 6 board px spreads to a 10 px FWHM, σ ≈ 3.5 board px ≈ 7.4 CSS px, while the phone's own island stays sharp. | None | None | High: dimmed and blurred |
| G5 | Profile card count pill "8x" (§1.3) | Capsule, 56 × 35 board px (79 × 49 CSS) | `#fff6ce` / `#fff8d0` on the yellow row `#ffec85`. White at 60 % over `#ffec89` gives `#fff7d0`, the measured centre, so it is the G1 fill over yellow. The ground behind is flat, so blur cannot be seen. | None resolved | Black | Medium: the same fill as G1 by value |

Not glass (opaque or flat on a flat ground): the "Swipe Now" pill (white, nothing behind it), the toggle rows `#f6f8fa` on the white card, the lime tag chip `#b6f179` (no lilac tint through it), the sheet's filter circle `#1b1b1b` on black, the utility rings `#3e3e40`, the bottom-row circles and Scan pill on black, the avatar and emblem circles, the 64+ circle, the black sheet itself.

**Reconstruction [R].** One material: white at **60 %** (`--colour-glass`, the middle of G1's range and exactly G5), backdrop blur **8 CSS px** (`--glass-blur`, from G4's σ 7.4; G1's ≥ 6 agrees), rim **2 CSS px** of white at **40 %** (`--glass-edge`, `--colour-glass-edge`). No saturation boost was measured: the colour under G1 is paler and less saturated than plain white-over-orange would give, so none is applied. G2 and G3 read lighter (alpha 0.2–0.4) on a photographed screen; the ui-board value is the primary reference (§1.7 fidelity note), so they take the same 60 %. The scrim is the same material with a dark fill: black at **32 %** (`--colour-scrim`) and the same blur, no rim.

**Text on glass.** Glass is always a light fill (white at 60 % or more), so its text follows the fill rule: all text is black ink, whatever lies behind. The darkest ground any glass surface lies over is the selected batch card's black: 60 % white over black is `#999999`, black ink on it is 7.4 : 1.

**Without backdrop-filter** the fill becomes white at 85 % (`--colour-glass-solid`; black ink on it over black reads 14.9 : 1) and the scrim black at 56 % (`--colour-scrim-solid`), so text contrast and sheet separation hold without the blur.

**App mapping.** G1 → the batch card's status chip, the "Stand-in" credit and the finish / ready label over the photo, the profile card's fact chips. G2 → the small card's time chip (readings, timeline). G3 → the timeline entry's Edit / Delete actions (the event card's actions). G4 → the sheet's `::backdrop`. G5 → the summary row's count pill (Kitchen summary, Checks summary, the detail's "Complete check"). The bottom navigation, utility circles and card pills stay opaque, as on the boards.

---

## 2. The outline shape

### 2.1 What the outline is [M]

The edges of every card on both boards (drink, toggle, lime profile, yellow sub-row, event cards, phone sheet) were traced at sub-pixel precision: the 0.5-alpha crossing against the known ground, sampled every 1 px along each side. All of them share one anatomy:

1. **Vertical sides are straight lines.** Left and right traces are constant to ±0.01 px between the corners. Drink card: x = 42.24 for y 204–372; x = 313.88 for y 210–366.
2. **Top and bottom edges bow inward (concave)**, symmetrically. Drink card top: 161.57 at the corner tangents (x ≈ 79 and 277), 164.57 at the midpoint (x ≈ 175–181). Bottom: 416.57 → 413.55. The sag is one smooth arc whose lowest point is at the centre. It is not a notch.
3. **Corners are slightly squarer than circular.** Fitting a cubic Bézier corner with handle length `k·r` gives k ≈ 0.64. A circle is k = 0.5523. k 0.64 equals a superellipse with exponent n ≈ 2.3, i.e. CSS `corner-shape: superellipse(1.2)`. That follows from the Bézier midpoint, (0.5 + 0.375k) = 2^(−1/n).

Model used for every fit (`fit.py`), in the component's own box `W × H`:

```
corner   : cubic (0,r) → (r,0), handles (0, r(1−k)) and (r(1−k), 0)   [×4, mirrored]
top edge : cubic (r,0) → (W−r,0), both handles at (W/2, 4·bow/3)        → max sag = bow at x = W/2
bottom   : mirror of top
sides    : straight lines
```

Fitted parameters (least squares over all well-conditioned edge samples; rms/max = distance from the samples to the model, board px):

| Component | W × H (board px) | r | k | bow | c* | rms / max | r/W | bow/W |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Drink card | 271.64 × 255.17 | 37.0 | 0.63 | 3.15 | 0.475 | 0.135 / 0.35 | 0.136 | 0.0116 |
| Toggle card | 271.44 × 284.91 | 37.5 | 0.65 | 3.15 | 0.50 | 0.135 / 0.38 | 0.138 | 0.0116 |
| Lime profile card (top + sides) | 271.75 × ≈157 | 37.0 | 0.64 | 3.30 | 0.65 | 0.168 / 0.52 | 0.136 | 0.0121 |
| Yellow sub-row | 248.80 × 68.40 | 34.0 (= H/2) | 0.54 | 3.30 | 0.45 | 0.132 / 0.50 | 0.137 | 0.0133 |
| Phone event card (lilac) | 159.58 × ≈118 | 25.5 | 0.86 | 2.00 | 0.15 | 0.137 / 0.47 | 0.160 | 0.0125 |

\*c is the position of the edge-cubic handles, as a fraction of the straight run measured from each end (0.5 = both handles at the midpoint). Its effect is below 0.1 px, so the recommended snippet fixes c = 0.5.

Interpretation [R]:

- **Same physical shape on both boards.** In CSS px, the radius is 52 (ui-board) and 54 (phone), and the bow is 4.4 and 4.2. Measured r/W is 0.136 on the ui-board and 0.160 on the phone. A constant radius and bow in CSS px therefore fits the evidence better than a constant ratio.
- The four ui-board instances all share W ≈ 272 board px. Their H ranges from 157 to 285 while r stays at 37, so **r does not scale with H**.
- **Rows use r = H/2** (yellow sub-row) and keep the bow (3.3 board px = 4.6 CSS px).
- The phone card's higher k (0.86) comes from a blurred, photographed screen at 0.47 board px per CSS px. It is the least reliable instance, so the ui-board k 0.64 is the specification.

### 2.2 Candidate techniques, prototyped and measured

Every candidate was rendered in **headless Chrome 157** at 4× device scale, box-downsampled to board resolution and overlaid on the board crop (`shape_render.py`, `run_shapes.py`). The residual is the per-sample difference between reference and render edge positions along x (sides) or y (top/bottom), over the same well-conditioned samples as the fits. Occluded spans were excluded: the stem on the drink card, the lime button on the toggle card, the lilac circle and the bottom of the lime card, and the photo on the event card.

All variants show the same rigid offset (dx ≈ +0.5, dy ≈ +0.45). That is the half-pixel between pixel-index and pixel-edge coordinates used to place the test boxes. It is removed by a single global shift per axis ("registered"). Values are board px; ×1.406 gives CSS px.

| Candidate | Drink rms / max | Toggle rms / max | Lime rms / max | Yellow row rms / max | Event (phone) rms / max |
| --- | --- | --- | --- | --- | --- |
| **`clip-path: shape()`, recommended rule** (r 52 px, bow 4.4 px, k 0.64; rows r = H/2) | **0.176 / 0.93** | **0.163 / 0.83** | **0.229 / 1.09** | **0.214 / 0.85** | 0.826 / 3.65 |
| `clip-path: shape()`, per-component fit | 0.156 / 0.61 | 0.169 / 0.81 | 0.228 / 1.12 | 0.230 / 1.02 | 0.207 / 0.97 |
| `border-radius` only (best: 34–37) | 1.46 / 3.24 | 0.97 / 4.20 | 0.83 / 2.70 | 1.03 / 2.30 (capsule) | 1.60 / 6.43 (25) |
| `border-radius` + `corner-shape: superellipse(1.2)` / `(1.6)` / `squircle`, r 38–46 (9 variants) | best 1.46 / 3.23 (superellipse(1.2), r 38) | – | – | – | – |
| SVG path as `mask` with a fixed viewBox (drawn for the drink aspect, stretched to the lime card) | – | – | 1.29 / 5.58 | – | – |
| **Current implementation** (`border-radius: 2rem 2rem 2.5rem 2.5rem / 2.5rem 2.5rem 2rem 2rem` + black `::before` notch 68 % × 7 px), rendered at CSS size and scaled by 1/1.406 | 1.37 / 5.84 | 1.18 / 5.55 | 1.53 / 5.48 | – | – |

As a share of W, the recommended rule's worst residual on the primary board is **0.40 % of W (1.09 board px ≈ 1.5 CSS px)** and its rms is ≤ 0.08 % of W (≤ 0.32 CSS px). That is below the antialiasing band of the source PNG.

The event card is an outlier only because the phone mockup's k differs (§2.1). Fitting that card individually brings it back to 0.21 / 0.97.

Why the alternatives fail [M + R]:

- **`border-radius`, with or without `corner-shape`**, cannot produce a concave edge. The error floor is the bow itself, about 3.2 board px (4.4 CSS px) at the edge midpoints, for every radius and superellipse parameter tried. `corner-shape` also ships only in Chromium (139+), not WebKit.
- **SVG `mask`/`clip-path` with a fixed viewBox** is exact only at the aspect ratio it was drawn for. Stretched, the corners become elliptical: 5.6 px max on the lime card. `clip-path: path()` takes only absolute coordinates and cannot follow a responsive box.
- **`border-image` / `mask-border` 9-slice** stretches the edge slice, so the bow depth would follow the slice instead of being one smooth arc. `mask-border` is unprefixed only in Chromium; WebKit has `-webkit-mask-box-image`, and Firefox has neither.
- **Layered elements** (the current `::before` notch painted in ground colour) only work over a flat, known background. They break over photos, gradients and the dimmed sheet backdrop, and give no bottom bow. They also produce the largest maximum errors above (5.5–5.8 px).

### 2.3 Recommendation: one technique

**Use CSS `clip-path: shape()` on dedicated background and media layers, never on the component itself.** The component keeps an unclipped box, so overlapping parts (the lilac circle above the top edge, the lime button half below the bottom edge, focus rings, badges) are not cut off. Only the fill and the photo are clipped.

Reusable snippet. It was rendered in Chrome 157 (`demo/bowed2.html` in the scratchpad) at 382×359, 382×401, 382×221, 337×249, 900×300, 350×96 and 160×120, including a clipped photo layer, an overlapping circle, a half-outside button and a stroked selected state:

```css
/* Bowed outline (Swipe). Measured: r 52px, bow 4.4px, k 0.64 at 1 CSS px = 0.711 board px. */
.bowed {
  --r: 52px;          /* corner radius; rows: half their height */
  --k: 0.64;          /* corner handle factor: 0.5523 = circle, 0.64 = superellipse n≈2.3 */
  --bow: 4.4px;       /* inward sag of top and bottom edges at their midpoint */
  --fill: #ffffff;    /* colour or gradient */
  --stroke: transparent;
  --stroke-w: 0px;
  position: relative;
  isolation: isolate;
  background: none;            /* the fill lives on ::after */
  border-radius: var(--r);     /* only shapes the focus outline */
}
/* Declared on every layer so each one substitutes its own --rr (see usage rules). */
.bowed, .bowed::before, .bowed::after, .bowed > .bowed-media {
  --rr: min(var(--r), 50%);
  --bowed-shape: shape(from 0 var(--rr),
    curve to var(--rr) 0 with 0 calc(var(--rr) * (1 - var(--k))) / calc(var(--rr) * (1 - var(--k))) 0,
    curve to calc(100% - var(--rr)) 0 with 50% calc(var(--bow) * 4 / 3) / 50% calc(var(--bow) * 4 / 3),
    curve to 100% var(--rr) with calc(100% - var(--rr) * (1 - var(--k))) 0 / 100% calc(var(--rr) * (1 - var(--k))),
    line to 100% calc(100% - var(--rr)),
    curve to calc(100% - var(--rr)) 100% with 100% calc(100% - var(--rr) * (1 - var(--k))) / calc(100% - var(--rr) * (1 - var(--k))) 100%,
    curve to var(--rr) 100% with 50% calc(100% - var(--bow) * 4 / 3) / 50% calc(100% - var(--bow) * 4 / 3),
    curve to 0 calc(100% - var(--rr)) with calc(var(--rr) * (1 - var(--k))) 100% / 0 calc(100% - var(--rr) * (1 - var(--k))),
    close);
}
.bowed::before,
.bowed::after { content: ""; position: absolute; z-index: -1; pointer-events: none; clip-path: var(--bowed-shape); }
.bowed::before { inset: 0; background: var(--stroke); }      /* stroke ring (selected state) */
.bowed::after  { inset: var(--stroke-w); background: var(--fill);
                 --rr: max(0px, min(var(--r), 50%) - var(--stroke-w)); } /* fill; inner radius keeps the ring even */
.bowed > .bowed-media { position: absolute; inset: 0; z-index: 0; clip-path: var(--bowed-shape); } /* photo clipped by the outline */
.bowed > :not(.bowed-media) { position: relative; z-index: 1; }

@supports not (clip-path: shape(from 0 0, line to 1px 1px)) {
  .bowed::before, .bowed::after, .bowed > .bowed-media { clip-path: none; border-radius: var(--r); }
}
```

Usage rules:

- **Declare `--bowed-shape` on the element and on each clipped layer** (as above). Unregistered custom properties substitute `var()` where they are declared, so a `--bowed-shape` declared only on `:root` would freeze `:root`'s `--r`. Percentages inside the shape resolve against whichever box applies the clip, so the media layer must be `inset: 0`.
- **Rows and pills with a bow** (yellow sub-row): set `--r` to half the fixed height (`--r: 48px` for a 96 px row). Plain capsules (toggle rows, buttons, chips) are not bowed: use `border-radius: 999px`.
- **Selected or outlined state:** set `--stroke` and `--stroke-w` (for example `#b6f074`, 3 px). The fill layer is inset and uses the reduced radius `r − stroke-w`, so the ring has an even thickness. Measured in Chrome at 6 px: 6.0 px on the sides and 6.36 px at the 45° corner point.
- **Gradients and shadows:** put the gradient in `--fill` (the phone event cards need one). A shadow, if ever needed, is `filter: drop-shadow()` on `::after`. `box-shadow` would show the rectangle.
- **Small components** (W < 300 CSS px) scale down: `--r ≈ 0.16·W`, `--bow ≈ 0.0125·W`. These are the phone-card ratios; for example, a 160 px tile uses `--r: 24px; --bow: 2px`. **Wide surfaces** (W > 600) keep 52 / 4.4. The 900×300 render keeps the identity through the corners, and the edge reads flatter, as it does at reference scale.
- **Support:** `shape()` is supported by Chromium 135+ (Android WebView, Windows WebView2, Chrome/Edge) and Safari 18.4+ (WKWebView on macOS 15.4+ and iOS 18.4+). The fallback is the rounded rectangle at `--r`, which is the 0.8–1.5 px rms row in the table. **Firefox and older WebKitGTK (Tauri on Linux) were not verified in this session.** Check them at implementation time; they degrade to the fallback.

This supersedes the note in issue #50 that "the raster does not prove a reusable irregular-shape technique". The shape is now measured and reproduced to ≤ 0.23 px rms.

---

## 3. Mapping: reference component → app surface

Breakpoints are the current ones and stay as they are (`src/styles.css` L760–870; decision #52): phone < 600 (bottom nav, one pane), tablet 600–1023 (80 px rail, one pane), desktop ≥ 1024 (272 px sidebar, `--sidebar-width`, widened from 224 by ticket 18 for the toggle card; list plus a detail column of `clamp(320px, 28vw, 400px)`).

Line references are to `src/App.tsx` (A) and `src/styles.css` (S) at commit `e6e8389`. Prior decisions that constrain the mapping: #50 (fidelity contract), #52 (shell), #53 (imagery: user photos keep rectangular framing; only bundled transparent cutouts are integrated "cutout-style"), #51 (Unique everywhere).

| Reference (§) | App surface | Code | Phone < 600 | Tablet 600–1023 | Desktop ≥ 1024 |
| --- | --- | --- | --- | --- | --- |
| Drink card §1.1 | Batch overview card | A `CompactBatchCard` L1562–1580 (`button.design-batch-card`), `BatchPhoto` L176; S L287–312 (`.batch-overview`, `.design-batch-card`, `::before` notch L289, `.design-batch-photo` L303–305) | 1 column, card ≈ 342 wide: `--r 52`, `--bow 4.4`, H/W ≈ 0.94 | 2 columns (S L799), ≈ 300 wide: same tokens | auto-fit `minmax(360px,1fr)` (S L287) |
| | Anatomy | batch name = "Orange" (Bold), profile name = "Drinks" (Light); status = frosted chip; "Day N / M" + next check = Swipe pill; the black circle = open / complete the next check; stand-in cutout = glass (clipped by the bottom edge); user photo = rectangle inside the content box (#53) | | | |
| Drink card §1.1 | Profile card | A `Profiles` L2657–2663, `ProfilePhoto` L282–285; S L583–601 | 1 column | 1 column (S L767) | auto-fit 380 |
| | Anatomy | profile name Bold / duration Light; facts → frosted chips; "Edit profile / Delete" (`.profile-card-actions` L599–601) → Swipe pill with black circle = Edit; Delete becomes a text action | | | |
| Toggle card §1.2 | Settings preference cards | A `SettingsView` L1014–1040 (`.settings-card`, `.setting-row`, `.setting-segment` L1018/1025/1035); S L718–742 | single choices (units, notification mode) = rows where the chosen one is the black selected row; on/off (suggestions) = row + switch | same, in the `.settings` grid | same |
| Toggle card §1.2 | Checks list | A `ChecksView` L1392–1415 (`.queue-card`, `.checks-paused-row` L1413); S L319–343 | rows inside one white bowed card: icon in an avatar circle, label, a circle button in the switch slot to complete; overdue = black selected row | same | same |
| Toggle card §1.2 | Desktop sidebar navigation | A L666–690 (`.sidebar`, `.navigation`, `.design-account`); S L203–224 | – | – (rail, see below) | one white bowed card with four destination rows; current = black row; icon in a pastel avatar circle; the batch count in the switch slot as a count pill (§1.3 vocabulary) |
| Toggle card §1.2 | Batch picker, start-batch profile choice | A `BatchPicker` L1173–1195, `StartBatchForm` L291–331 | rows; selected = black | same | same |
| Toggle card lime button §1.2 | A card's single primary action | "Add observation" A L2009 (`.design-record-observation` S L375); settings "Export ZIP"; dialog submit | capsule 60 % of card W, h 63, centred on the card's bottom edge (half outside); reserve 32 px below | same | same |
| Profile card §1.3 | Kitchen summary | A L1468–1475 (`.design-summary`, `.design-gauge`, `.design-stat-row`); S L263–277 | lime bowed card; StationLogo in the lilac circle straddling the top (47 % above); "Kitchen summary" Bold centred; "N ready to enjoy" meta; yellow sub-row = "3 checks due" with a count pill | same | same, inside the list column |
| Profile card §1.3 | Batch detail head | A L2008–2010 (`.design-detail-card`), L2013 (`.design-detail-next`); S L368–395 | bowed card; name centred Bold; "Kimchi batch · Started 14 Mar" meta; yellow sub-row = next check + "Day 5/5" count pill | same (single pane) | detail column (≈ 320–400 wide: use the small-component rule from §2.3 when W < 300) |
| Profile card §1.3 | Checks summary, profile editor head | A L1400 (`.checks-summary`), L2576 (`.profile-editor-head`); S L331–334, L623 | lime bowed card | same | same |
| Utility stack §1.4 | Tablet rail | A L666–690; S L760–770 (`.app-shell` 80 px column, icon-only `.navigation button`) | – | 72 px rail, ring `#3e3e40`, circles 60, pitch 66: logo circle on top, then 4 destinations, then Settings; current destination = lime circle (§1.5) | – |
| Utility stack §1.4 | Top-bar utilities | A L693–701 (`.design-topbar`, `.icon-button` bell/settings); S L170–179, L231–240 | white circles 60, no border | same | same (no ring; the ring is a rail-only treatment) |
| Bottom row §1.5 | Phone bottom navigation | A L671–684; S L814–816, L880–881 | centred row on black: three white circles d 60 (icon only, `aria-label`) + current destination as a lime pill (icon + label, ≈ 107 wide); gap 6; total ≈ 305 | – | – |
| Bottom row §1.5 | Filter chips, batch tool shortcuts | A L1477 (`.filter-row`), L2021 (`.batch-tools-shortcuts`); S L283–286, L442–443 | white capsules h 60; selected = lime | same | same |
| 64+ stat §1.6 | Big counts | A L1469 (`.design-gauge strong`), L1400 (`.checks-summary strong`); S L265, L333 | coral Light figure (71 CSS px figure height at full size; scale to the card) + white circle with an icon + white caption | same | same |
| Phone sheet §1.7 | Dialogs and the observation logger | A `StationDialog` L245–262, logger heading L2179; S L522–549, L870–871 | black bottom sheet with a bowed top edge (bow 5.7): centred white title ≈ 22 px; close = `#1b1b1b` circle d 57, right inset 21; fields black with a 1 px lime border, h 53 | centred dialog ≤ 480 wide, all four edges bowed | same as tablet |
| Phone sheet §1.7 | Search row | A L1467 (`.design-search-box`, sort button); S L256–262 | black capsule h 53 with a 1 px `#b6f074` border, white icon and text; sort = `#1b1b1b` circle d 57 | same | same |
| Phone sheet header §1.7 | Phone top bar / detail top bar | A L693–701, L1556 (`.design-detail-top`); S L818–823, L362–364 | centred white title; dark circles (`#1b1b1b`) for back and calendar instead of outlined circles | same | detail column top |
| Event card §1.7 | Timeline entries | A L2212 (`.timeline`); S L415–431 | bowed pastel-gradient cards; lime tag chip = entry kind; large Light value = reading ("pH 4.31", "20.2 °C") in the "04" role; time in the city chip; the bookmark-circle slot = entry actions; photo entries keep rectangular user framing (#53) | same | detail column |
| Event card §1.7 | Readings, upcoming items, upcoming strip | A L2012 (`.detail-readings`), L1330–1345 (`.upcoming-item`), L1521 (`.upcoming-strip`); S L382–387, L700–708, L349–355 | small event cards (small-component rule) | same | same |

App surfaces with no counterpart in the artwork, and the vocabulary each one borrows:

| Surface | Code | Borrows |
| --- | --- | --- |
| Calendar month grid | A `CalendarView` L1217–1320; S L667–688 | Toggle card (white bowed island). Days are circles (§1.4/§1.5 geometry, ≥ 44 px): event days get the lilac avatar fill `#c5b4ec`, the selected day is black (selected row), today gets a `#3e3e40` ring (stack ring). Month navigation uses white circle buttons. |
| Profile editor form | A L2573–2640; S L603–662 | Sections are white bowed cards (toggle card). Inputs on white are capsules filled with the unselected-row fill `#f6f8fa`, no border, with a black focus ring [R]. The kicker "01 / The method" plays the tag-chip role. |
| Batch tools / component cards | A L2092–2136; S L478–510 | White bowed cards. Step numbers sit in avatar circles. Calculation values use the yellow sub-row with a count pill. |
| Toasts, notices, storage warning | S L182–187, L249 | Black capsule, white text (selected-row colours). |
| First-run empty state | A L1484–1489 (`.empty-state`) | Drink card with the jar fallback (#53), lime primary button half outside the card. |

---

## 4. Gap audit (ranked)

Evidence: §2.2 render residuals, `screenshots/current/*` (harness run 2026-11-13T08:54Z, Chrome 157, 5 viewports × 12 surfaces), and the current CSS. Each item is one implementation ticket. "Target" values are CSS px at device scale 1.

1. **Card silhouette is the wrong technique.** All large cards use `border-radius: 2rem 2rem 2.5rem 2.5rem / 2.5rem 2.5rem 2rem 2rem` (or `--radius-card 32px`) plus a black `::before` bar 68 % × 6–7 px faking a top dip (S L289, L369, L585). There is no bottom bow, the notch is visible as a separate black lens over any non-black ground, and the measured error against the reference is 1.18–1.53 px rms and 5.5–5.8 px max (board px), versus 0.16–0.23 / ≤ 1.09 for the target. **Target:** the §2.3 `.bowed` snippet (r 52, bow 4.4, k 0.64) on `.design-batch-card`, `.design-summary`, `.checks-summary`, `.design-detail-card`, `.profile-card`, `.profile-editor-section`, `.profile-editor-head`, `.calendar-panel`, `.settings-card`/`.trash`, `.batch-component-card` (S L491 currently has the radii inverted: 10 % top, 32 px bottom), `.station-dialog`, `.timeline-entry`. Delete the three notch rules. `src/styles.test.ts` L64–82 asserts the old radius strings and must change with this ticket.
2. **Ground and ink colour.** The ground is `#1c1c1c` (`--colour-surface-inverse`, S L47, used at L96, L200, L203, L242) and text is `#1c1c1c` (`--colour-text`, L48). **Target:** ground `#000000`, text ink `#000000` on light fills (§1, global facts). `#1c1c1c` stays only if it is wanted as a non-reference neutral. The palette test (`styles.test.ts` L16–31) must be reconciled, as #50 already anticipated.
3. **Phone bottom navigation.** Currently a black bar with four equal labelled columns; the active item is a 64 px white circle with its label inside (S L814–816). **Target (§1.5):** a centred row of white circles d 60 (icon 21, stroke ≈ 2, no label, accessible name kept), with the current destination as a lime capsule h 60 ≈ 107 wide holding icon + label (label ≈ 18 px, see D1), gap 6, no bar fill. The safe-area padding stays.
4. **Tablet rail.** Currently borderless icon buttons in an 80 px column (S L761–765) with the logo loose above them. **Target (§1.4):** a 72 px dark rail made of `#3e3e40` rings (thickness 6) around white circles d 60 at pitch 66. The logo circle is the top item; the current destination is a lime circle.
5. **Circular utility buttons.** `.icon-button` is 52 px with a 1 px `currentColor` border (S L108–113, L170–179). The topbar shows outlined dark circles on the detail top bar. **Target:** white `#ffffff` circles d 60 without a border (board), or `#1b1b1b` circles d 57 inside dark sheets and headers (§1.7). Icon glyph 21 px (0.36 d), outline stroke ≈ 2 px (bottom row) / ≈ 1.6 px (stack).
6. **Typography scale and weights — blocked by D1.** Body is `2rem` = 32 px, metadata 28 px, h3 44–52 px (S L13–44). Only weights 400/500/700 are used; there is no Light. **Measured targets at reference cap height:** list and row text cap 14 → 20 px; card title cap 28 → 40 px (Bold line + Light line, line-height 1.0); centred card title cap 22 → 31 px Bold; meta cap 10 → 14 px; sheet header ≈ 22 px; big value ("04") ≈ 42 px Light; hero stat ≈ 100 px Light. Light (300) is required for the secondary title line, "Swipe" and big numbers. Text is left-aligned in cards and centred in the lime profile card and the sheet header.
7. **Search field.** Currently a white capsule with dark text (S L259–262). **Target (§1.7):** fill `#000000`, `1px solid #b6f074`, h 53, white icon and text, lime caret (`caret-color: #b6f074`); the sort/filter button is a `#1b1b1b` circle d 57.
8. **Dialogs and observation logger.** Currently a white card with a blue (`--colour-accent`) heading band and full-width lime/white buttons (S L522–549, L538). **Target (§1.7):** on phone, a black bottom sheet anchored to the bottom, full width, bowed top edge (`--bow: 5.7px`, `--r: 40px` [R]), centred white title ≈ 22 px, `#1b1b1b` close circle d 57 at the right with inset 21, aligned to the title's centre line. Fields as in gap 7. Primary action = lime capsule.
9. **Batch overview card anatomy.** Currently a pastel fill per profile, a 1fr/0.9fr grid, the photo `object-fit: contain` with padding 12/0/64 inside its own box (S L288, L303–305), the status chip first, and "Day N" as a 44–52 px number. **Target (§1.1):** H/W ≈ 0.94. Title block inset 9.3 % W (left) and 9.4 % W (top). Status as a frosted chip (translucent white + `backdrop-filter: blur`, h ≈ 11 % W) overlapping the image. A bottom-left pill 55.6 % W × 20 % W (77 px at 382) with a white fill and a 1 px `#f1f1f1` hairline; its two-line label (Light / Bold) shows day progress, and a black circle d 63 sits inset 5 px inside its right end. Image: a bundled cutout occupies 48–94 % W from 8 % H down and is clipped by the bottom bow (`.bowed-media`); user photos stay rectangular within the same column (#53).
10. **Settings controls.** Currently bordered segmented pills (`.setting-segment`, S L740–742). **Target (§1.2):** a toggle-list card with rows `#f6f8fa`, h 72, gap 8, inset 16, radius = h/2. Selected row `#000000` with white text. Avatar circle d 63 holding the option icon. Switch track 42×25 (`#2089fd` on / `#eceef0` off), knob 20 `#ffffff`, right inset 21.
11. **Kitchen summary composition.** Currently a lime rounded rectangle with a 3-column number grid (S L263–277). **Target (§1.3):** a lime bowed card (H/W ≈ 0.58) with a lilac circle d 118 (0.31 W) holding the logo, centred, 47 % above the top edge. Bold centred title (cap 0.057 W), meta line, and a yellow bowed sub-row 91.6 % W × 25 % W, 49 % below the card bottom, holding the check count as a `#fff6ce` pill 79×49. Reserve 48 px below for the overhang.
12. **Primary action placement.** "Add observation" is a full-width lime button inside the detail card (A L2009, S L375). **Target (§1.2):** a 60 % W capsule, h 63, centred on the card's bottom edge midpoint (half outside), z above the card fill.
13. **Timeline, readings and upcoming items.** Currently flat pastel rounded rectangles in four flat colours (S L416–419, L382–387, L700–708). **Target (§1.7):** bowed cards (small-component rule below 300 px) with a left→right gradient from the pastel to ≈ 85 % white (lilac `#d9b4eb → #f6eafc`, blue `#b4dff9 → #e6f6ff`), a lime tag chip h 27 for the kind, the value in Light at ≈ 2× the label size, and translucent white chips and circle (d 57) for time and actions. The palette test (L23) forbids `linear-gradient` and must change.
14. **Selection on cards.** The selected batch card is black with a 2 px lime border (S L290). The reference only shows selection on rows (black fill, white text, §1.2). **Target:** keep black + white text, and draw the ring with `--stroke: #b6f074; --stroke-w: 3px`, since a CSS border does not follow the bow.
15. **Big numbers.** The total-batches and checks counts are ink on lime (S L265, L333). **Target (§1.6):** coral `#fc5659`, Light, with an adjacent white circle (d ≈ 1.2× the figure height, glyph 0.40 d) and a white caption under it, where the number sits on black.
16. **Lilac shade.** `--colour-action-alt` is `#dab8f1` (printed swatch). The ui-board's avatar and emblem circles are `#c5b4ec`/`#bdace4`. **Target:** `#c5b4ec` for avatar and emblem circles; `#dab8f1` stays for card fills and gradient starts.

---

## 5. Open decisions (user only)

**D1. How large should Unique be, relative to the Circular reference?** The user chose Unique for everything (#51). Unique is far narrower than Circular: at equal cap height (both 0.70 em, verified with fontTools on `public/fonts/unique/*.woff2`), "Bas van der gught" in Unique Regular is 2.70 em wide. The reference string is ≈ 7.8 em wide at its own size (112 board px at cap 10). Equal-height Unique text therefore fills only ≈ 35 % of the reference line length.

| Option | Row text (reference: Circular ≈ 20 px) | Effect |
| --- | --- | --- |
| A. Match cap height (#51's starting scale) | 20 px | Card, row and circle proportions match 1:1. Text is visibly narrower and lighter, with more empty space in pills and rows. |
| B. Match line length | ≈ 58 px | Text fills the reference measure, but caps are 2.9× taller than the artwork and rows must grow. |
| C. Keep the current enlargement | 32 px | Neither the height nor the length of the reference. |

The current implementation is option C. Every type size in §1 is given at option A. Gap 6 cannot be closed until the user picks one.

**D2. Where should the user's imagery in `out/www.orbix.studio/images/` be used?** The images are `fruit`, `glass`, `grid`, `hero`, `horizon`, `object`, `sky`, `street` and `tokens`, PNG + WebP at 1122×1402 or 1672×941. All are opaque (no alpha channel, 0 % transparent pixels) drink and party scenes on pastel grounds.

Decision #53 limits stand-ins to images that plausibly match a fermentation profile, keeps user batch photos rectangular, and did not authorise generated visuals by default. The reference cards need transparent cutouts. These images therefore cannot be dropped into the drink-card or event-card cutout role without background removal, and they do not depict fermentation.

The user must say which surfaces they belong on (for example the first-run/empty state, the Kitchen summary, Settings/About, or profile cards for drink-type ferments such as kombucha and water kefir). They must also say whether background-removed cutouts may be made from them, given that #53 requires assets to stay unmodified.
