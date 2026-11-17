# FermentStation — App Logo Asset Pack

This asset pack is based on your supplied **orange Maine Coon + fermentation jar** logo. The original PNG is included unchanged in `source-original.png`. All generated files are directly usable, not just illustrations of a hypothetical asset pack.

## Start here

- `PREVIEW.png`: at-a-glance color/style overview.
- `drop-in-assets/`: files named to match your existing project (`app_logo.png`, `apple-touch-icon.png`, `favicon-64.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`). Replace files in your app's `public/` directory as appropriate.
- `drop-in-assets/app_logo.png`: your **original, unchanged** supplied logo, including its pale backdrop and white outer corners.
- `drop-in-assets/app_logo-full-bleed.png`: production-friendly **opaque, square**, cream-background version. For App Store/Play Store, use this variant, not the transparent PNG.
- `transparent/`: alpha-transparent, no original beige rounded-square background. Sizes 16–1024 px.
- `background-themes/`: orange illustration against 12 different background colors (opaque PNG).
- `recolored-accents/`: 7 alternative recolor palettes, with light/dark backgrounds and transparent master.
- `monochrome/`: black, white, orange raster icons and **true vector silhouette** SVGs.
- `shapes/`: circular and rounded-square images for profiles and other channels.
- `web/`: favicon.ico, PNG favicons (including a simplified small cat), touch icon, PWA icons and manifest, and an HTML integration snippet.
- `ios/AppIcon.appiconset/`: iOS app icons + Xcode Contents.json ready to drop into an asset catalog.
- `android/`: legacy density-specific launcher icons, adaptive icon foreground/background, optional Android 13 themed-icon monochrome layer and XML definitions.
- `desktop/`: Windows ICO and macOS ICNS files.
- `svg/`: full-color SVG *wrappers* containing embedded PNG data. **These are not native editable vector illustrations.** The monochrome SVGs *are* vectorized paths.

## Transparency & icon behavior

- The `transparent/` files have real alpha transparency and are intended for interfaces, documents, and non-store placements.
- iOS App Store and Google Play icons in this pack are **opaque**; stores generally require a full-bleed square rather than manually rounded transparent corners.
- `web/favicon.ico` uses a close-up of the cat because the complete scene becomes difficult to recognize at 16 px. Both cat and jar options are also included.
- `icon-maskable-*.png` and Android adaptive icon foregrounds use substantial safe-area padding. Do not use the full-bleed store image as an adaptive foreground.
- The extracted transparent illustration was reconstructed from the supplied raster (with manually preserved jar/whisker areas). Inspect edges against unusual backgrounds if pixel-level exactness matters. The original source remains untouched.

## Suggested setup (Next.js / PWA)

Copy `web/favicon.ico`, `web/favicon-32x32.png`, `web/apple-touch-icon.png`, `web/icon-192.png`, `web/icon-512.png`, `web/icon-maskable-192.png`, `web/icon-maskable-512.png`, and `web/manifest.webmanifest` into your `public/` folder. Copy tags from `web/INTEGRATION.html` into your HTML head or Next.js metadata config.

## Export specifications

- All raster icon dimensions are exact and square (sRGB RGBA/RGB PNG).
- iOS store icon: 1024 x 1024 PNG, opaque.
- Google Play icon: 512 x 512 PNG, opaque.
- PWA: 192 x 192 and 512 x 512, both normal and maskable.
- iOS touch icon: 180 x 180.
- Android legacy densities: mdpi 48, hdpi 72, xhdpi 96, xxhdpi 144, xxxhdpi 192.
- Source image supplied: 1254 x 1254 PNG.

This collection is a production asset set created from the user's supplied source, not a newly illustrated replacement.
