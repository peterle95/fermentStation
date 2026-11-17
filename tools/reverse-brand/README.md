# reverse-brand

Build standalone, offline **Unofficial analysis** guides, token exports, social slides and a seek-rendered 60fps video from a public website. This package is independent of Fermentstation; it does not change the app or its dependencies.

## Requirements

- Node.js 22+, an installed Google Chrome, and `npm ci` in this folder.
- Set `CHROME_PATH` if Chrome is not in a standard installation location.
- ffmpeg with libx264 for video and ffprobe for encoded-file verification; optionally set `FFMPEG_PATH` / `FFPROBE_PATH`.
- No image API credentials are needed. Supported modes are `none` and `manual`. API mode is deliberately rejected; no paid provider calls are made.

From the repository root:

```powershell
npm --prefix tools/reverse-brand ci
node tools/reverse-brand/cli.js https://brand.example --images none --stills --video --verify
```

Output defaults to `out/<host>/`. Existing output files with the same names are rebuilt; manual image originals are preserved. Do not point `--out` at unrelated work.

## Swipe Drinks run

```powershell
node tools/reverse-brand/cli.js https://www.orbix.studio/case-studies/swipe-drinks-app --out out/www.orbix.studio --images manual --profile tools/reverse-brand/profiles/swipe.json --stills --video --verify --print-prompts
```

The source is an **Orbix case study containing rasterised Swipe artwork**, not a live Swipe website. `profiles/swipe.json` records visual transcriptions, screenshot sample positions, an inconsistent printed hex value, and explicitly inferred geometry. Orbix DOM measurements remain separate in `analysis.json`. A profile is an evidence record, not a claim that raster imagery exposes CSS.

Reuse capture without making source-site requests:

```powershell
node tools/reverse-brand/cli.js https://www.orbix.studio/case-studies/swipe-drinks-app --out out/www.orbix.studio --images manual --profile tools/reverse-brand/profiles/swipe.json --snapshot out/www.orbix.studio/snapshot.json --stills --video --verify
```

## Manual images

`prompts.json` contains nine text-only prompts, with aspect ratios and target resolutions. Generate new subjects in your tool of choice; never provide source brand photos as inputs. Drop results into:

```text
out/<host>/images/hero.png
out/<host>/images/horizon.png
out/<host>/images/object.png
out/<host>/images/street.png
out/<host>/images/sky.png
out/<host>/images/glass.png
out/<host>/images/grid.png
out/<host>/images/tokens.png
out/<host>/images/fruit.png
```

Run the command again with `--import --images manual` and the existing `--snapshot`. It preserves originals, rotates and resizes them, creates WebP files and `images/manifest.json`, labels every image occurrence **AI-generated image**, and embeds each WebP once per HTML document. Review images after import; regeneration is a manual decision. The light edition never embeds images. The hero edition is capped at 4,000,000 bytes; imports reserve space for the document and reject oversized image sets.

With no supplied images, **both editions intentionally use CSS gradients**. No photographs or paid images are invented or silently substituted. Generation costs outside this CLI are unknown, not zero.

## Bot checks

Headless capture stops on challenge indicators. It does not solve CAPTCHAs, spoof a browser, rotate proxies, or reuse personal browser storage.

1. Rerun with `--headed`, complete the check yourself, and let capture continue.
2. Open the source page normally and paste the generated `devtools-extractor.js` into DevTools. It runs the **same extractor** inside same-origin 1440px and 390px iframes and downloads `snapshot.json`. Import it with `--snapshot`.

If the site blocks same-origin framing or DevTools evaluation with CSP, the snippet cannot override that policy. Use headed mode instead. The fallback captures the current page only; it does not claim a multi-page crawl.

## Measurement boundaries

- Capture visits the home page, pins a supplied deep link, and scores up to four additional desktop pages total, one per top-level path. It also captures mobile home and mobile target. Legal, account, help and locale paths are excluded.
- Repeated header/footer element signatures with identical counts on every desktop page are counted once.
- DOM text colours are weighted by characters; backgrounds by estimated area, which can overlap. Alpha colours remain in the snapshot; role inference currently selects opaque values.
- Heading clusters have 12% size tolerance. Where exact mobile text matches exist, endpoint sizes are paired; missing matches remain explicit fallbacks. `line-height: normal` is unknown and gets a reconstructed leading.
- Palette role assignment, component candidate detection and spacing-base inference are heuristics. They are not official brand rules.
- A raster artwork profile must not promote host CSS to app CSS. Pixel shares describe the sampled board only. Unknowns remain unknown.
- External stylesheet CSSOM rules may be inaccessible; their URLs are logged. No original font files, logos or brand photographs are bundled in either guide. Source screenshots are kept separately as measurement/review evidence, never used as guide media.
- This is a local operator CLI, not an internet-facing arbitrary-URL service. Do not expose it as a server without DNS/redirect/subresource network isolation.

## Exports and verification

`--stills`: 11 paused-animation scene stills. `--video`: 2,700 separately sought browser screenshots, piped to ffmpeg at 1920×1080, 60fps, 45 seconds. H.264 CRF 14, yuv420p, TV range, BT.709 and faststart. No duplicated-frame shortcut. Video rendering can take several minutes.

`--verify`: opens both editions offline, asserts zero HTTP(S) attempts and script errors, budgets, sections/disclosures, five short quotes, three rules, JSON equivalence, distinct type tabs, computed button/card token equivalence, keyboard focus on light/dark grounds, image attribution, no horizontal overflow at 1440/1024/768/390, slide dimensions/counts/disclosures and paused scene animations. When the MP4 exists, ffprobe also checks all 2,700 decoded frames, exact duration, frame rate, dimensions and colour metadata. It screenshots every chapter at all four widths. It does not replace visual review or assert unknown original brand measurements.

```powershell
node tools/reverse-brand/verify.js out/www.orbix.studio
node tools/reverse-brand/review-sheets.js out/www.orbix.studio
npm --prefix tools/reverse-brand test
```

`run-log.md`, `run.json`, `verification.json` and `video/render.json` retain timings, measured counts, bytes, cost boundaries, assumptions and render settings. LLM usage is recorded as unknown when the harness does not expose it.
