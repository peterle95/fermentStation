# Unofficial analysis: Swipe Drinks

Not affiliated with or endorsed by Swipe Drinks. Trademarks belong to their owners.

Started: 2026-11-09T21:55:55.312Z
Finished: 2026-11-09T22:09:02.013Z

## Phase timings

| Phase | Milliseconds |
|---|---:|
| capture | 179 |
| analyse | 90 |
| tokens | 7 |
| images | 4397 |
| guide | 70 |
| slides | 4983 |
| video | 731935 |
| verification | 42181 |

Capture reused from snapshot; capture phase is file-read time, not original browser time.
Original capture duration: 64353ms.

## Capture

- https://www.orbix.studio/: 3197 elements
- https://www.orbix.studio/case-studies/swipe-drinks-app: 1706 elements
- https://www.orbix.studio/pricing: 1819 elements
- https://www.orbix.studio/about: 1990 elements
- https://www.orbix.studio/contact: 1562 elements

Desktop: 1440×900. Mobile: 390×844 (home and target). 1312 identical repeated chrome elements deduplicated. 8962 retained.

Page picks: scored navigation and product/pricing/company links, one per top-level path, with the supplied case study pinned. Candidates and failures are in snapshot.json.

## Files

| File | Bytes |
|---|---:|
| brand-guide.html | 100810 |
| brand-guide-hero.html | 693955 |
| tokens.css | 3337 |
| tokens.json | 39371 |
| snapshot.json | 13925580 |
| analysis.json | 53357 |

## Images and cost

Mode: manual. 9 imported images. Provider requests: 0. Known image-generation spend: $0. Manual generations, if any, have unknown external costs.

- hero: imported; manual cost unknown
- horizon: imported; manual cost unknown
- object: imported; manual cost unknown
- street: imported; manual cost unknown
- sky: imported; manual cost unknown
- glass: imported; manual cost unknown
- grid: imported; manual cost unknown
- tokens: imported; manual cost unknown
- fruit: imported; manual cost unknown

LLM token usage and cost: not exposed by harness; unknown, not reported as zero.

## Video

rendered. Frames: 2700. 45 seconds, real 60fps, 1920×1080; individual screenshots sought via document.getAnimations(), piped to ffmpeg. libx264, CRF 14, yuv420p, TV range, BT.709, faststart.

## Verification

PASS: 34 checks.

## Assumptions and boundaries

- Computed DOM styles describe the host page, not typography or layout rasterised inside artwork.
- Background areas overlap; painted-area weights are estimates, not exclusive pixel coverage.
- Normal line-height is unknown; no font files or source images are exported.
- Colour roles are assigned, not original named variables.
- Offline fonts use locally installed families only; unavailable fonts fall back to Arial.
- Missing role sizes, grid columns, gutters and form components are explicitly reconstructed.
- Swipe is represented as raster artwork in an Orbix case study, not a live Swipe website. Orbix homepage plus four key pages and mobile passes are contextual evidence only.
- Circular Std and Book/Medium/Bold are declared visually. Numeric weights 400/500/700 are conventional mappings, not extracted font metadata. Font usage share and local availability are not assumed.
- Four pastel hex values are transcribed from the style board. Ten-by-ten screenshot pixel samples differ slightly due to compression. Black #1c1c1c is sampled because its printed value is inconsistent. White is observed in the artwork; role assignments are inferred.
- The only declared type size is 18 PX. All other role sizes, line heights, tracking, responsive clamps, grid, spacing, radii, button geometry and inputs are guide reconstructions, not measured Swipe CSS.
- No Swipe header or logo bounding box can be measured as a DOM element. Dashed logo frame is a 144 by 40 px reconstructed slot; it is not a copied mark.
- No original Swipe gradients, easing or responsive breakpoints are available. Gradient, easing and breakpoints are reconstructed and labelled as such.
- Voice statistics cover only the five transcribed artwork excerpts and three observed CTA labels, not all app copy. Orbix prose is excluded from Swipe voice claims.
- Manual image mode makes no image-provider calls. The light edition uses gradients; the hero edition uses imported images where supplied and gradients for missing slots. AI status is declared by manual import, not detected from pixels. External image-generation costs are unknown to this CLI.
- Palette bar proportions count nearest pixels within RGB distance 15 in screenshots/source/type-board.png; unmatched photographic pixels are excluded. This is not app-wide usage.

## Visual review

Generated screenshots are under screenshots/, slides/, and video/stills/. Automated verification does not establish aesthetic quality. Record visual review findings here after inspection.
