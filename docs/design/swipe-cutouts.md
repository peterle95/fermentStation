# Swipe cutouts

Background-removed cutouts for the card photo role in spec gap 9 (§1.1 batch overview card, §4 item 9): a bundled transparent subject that overflows the card and is clipped by the bowed outline. They are derived from the user-supplied, AI-generated images in `out/www.orbix.studio/images/` (see `out/www.orbix.studio/review-notes.md`). The originals are unchanged. Since ticket 8 (`docs/design/swipe-rework-log.md`) `profileVisual` in `src/App.tsx` uses them where a profile has no stand-in of its own: the spritz for drink profiles (blue card) and the batch empty state (lilac card), the fruit for fruit profiles (lime card). A selected batch card is black, so it hides these two cutouts.

Derived from user-supplied, AI-generated imagery; not affiliated with Swipe Drinks.

## Files

| File | Source | Size | Bytes | Intended use |
| --- | --- | --- | --- | --- |
| `public/new-design/grapefruit-spritz.webp` | `hero.png` (1672×941), right-hand glass only | 501×700 | 92,000 | Drink-type card (kombucha, water kefir), the reference's "orange spritz" role. Best on lime, lilac or blue. |
| `public/new-design/fruit-still-life.webp` | `fruit.png` (1122×1402), whole fruit pile | 645×700 | 76,512 | Fruit or drink ferment card. Best on lime or lilac. Blue works, but it is close to the ground it was cut from. Not checked on yellow. |

Both files are lossy WebP (quality 86, method 6) with lossless alpha and the same format as the existing stand-ins: RGBA WebP, 700 px tall. The source pixels are downscaled but never upscaled. The corners are fully transparent, and the transparent margin is 3 % of the source's longer side.

## Placement on the card

The reference cutout covers 48–94 % of the card width from 8 % of the height down. It runs into the bottom bow and is clipped there (`.bowed-media`); it does not cross the top or right edge. At a 382 px card, the slot is ≈176 px wide and ≈330 px tall (aspect ≈0.53). Neither cutout has that aspect:

- **Spritz (aspect 0.72).** Sized to slot width (176 px), it is 246 px tall and ends above the bow. To run into the bow like the reference, size it by height (≥330 px, ≈236 px wide) or move its top down so the base is clipped. At 2× density, it stays sharp up to ≈250 CSS px wide.
- **Fruit (aspect 0.92).** It is wide. Let it overflow the bow at the bottom; do not shrink it to the slot width. At 2× density, it stays sharp up to ≈320 CSS px wide.

Per decision #53, user batch photos stay rectangular. These files are only for the bundled-stand-in path. The user still decides which profiles they stand in for (spec D2).

## How they were made

`python scripts/assets/make-cutouts.py [--sheets DIR]` from the repository root. The script needs only Pillow and numpy (checked with Python 3.12.10, Pillow 12.3.0, libwebp 1.6.0) and produces byte-identical output on rerun. It uses colour keying against the studio ground, not an ML model. rembg, OpenCV and ImageMagick are not installed, and nothing was added to `package.json`.

1. Each pixel gets a shadow-insensitive distance to the border ground colour. The part of the difference parallel to the ground colour, i.e. a darker or lighter ground, is ignored.
2. A hard mask is cleaned, reduced to the connected component(s) under seed points, hole-filled, and smoothed.
3. A per-row ground plate is interpolated from pixels outside the subject. Soft alpha is a smoothstep of the distance to that plate. Colours are decontaminated (solving `C = a·F + (1−a)·plate` for `F`), which removes ground tint and halo.
4. Per-image rules:
   - **Spritz:** solid core 21 px in from the edge. A hand-fitted clip, with straight walls and an elliptical base at x 0.600–0.866 and y ≤ 0.877 of the source, removes the orange caustic shadow. Yellow within ±6° of the ground hue is removed in the edge band, and within ±14° in the rim box (x < 0.78, y < 0.20). Clear glass keeps a minimum opacity with a neutral tint: 18 % on the walls and 38 % in the rim box.
   - **Fruit:** any pixel within ±28° of the blue ground hue is ground at any brightness, inside the subject too, so blue shadows between the fruit are removed. Dark, non-warm pixels near the edge are treated as contact shadow.
5. Trim, downscale to 700 px height in premultiplied space, and save.

Verification: each cutout was composited on black, lime `#b6f074`, lilac `#dab8f1` and blue `#b6e1fa`. Edge crops on black, lilac and lime were viewed at 1:1 output pixels. The rule set above came out of six review rounds, which fixed the caustic shadow, yellow rim refraction, enclosed shadow pockets, contact-shadow lines, 4 px mask stair-steps, and a hole in an ice cube.

## Known flaws

**grapefruit-spritz.webp**
- The clear glass is approximated: the walls and rim use a flat neutral minimum opacity rather than true refraction. On black, the back rim above the ice reads as a soft grey band, and the right ice cube has a small dark gap. Both are barely visible on the pastels.
- The base outline follows the hand-fitted ellipse, not a matte. The glass has no contact shadow; the cast shadow was removed on purpose.
- The rim outline is slightly irregular where it meets the back wall (a small notch near the top centre).
- The lime halves left of the glass in the source are excluded.
- The scene is AI-generated: the bubbles and condensation are synthetic, and the label "spritz" describes the look, not a recipe.

**fruit-still-life.webp**
- The ice cubes and water drops on the ground are removed. Drops on the fruit skin remain.
- A small grey-blue speck (≈20 px at output size) remains below the cut pear where it meets the kiwi.
- The undersides of the kiwis stay slightly dark where they met their shadow.

## Not cut

| Source | Reason |
| --- | --- |
| `glass` | Three clear water glasses: almost all of each glass is the lilac ground seen through water. Keying leaves faint outlines, and the subject is a row of three. |
| `grid` | Overhead repeating pattern of glasses and lime halves; there is no single subject and each item is small. |
| `horizon` | One water glass is only ≈300×420 px in the source, below a 2× card. It is clear water over a two-tone ground with the horizon line behind it. |
| `object` | The chrome sphere mirrors the lime ground and the acrylic cylinder is transparent; neither survives keying, and neither is a drink. |
| `sky` | Landscape scene; there is no subject. |
| `street` | People in a crowd on a busy background. This needs a segmentation model; colour keying cannot separate it. |
| `tokens` | Lime discs and a glass cube on a reflective black floor: abstract props with floor reflections and no card role. |
