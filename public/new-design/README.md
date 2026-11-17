# Reference design assets

Extracted unchanged from `prototypes/new_design/phone/index.html`. All photographs are stand-ins, cropped and with backgrounds removed; user batch photos take precedence in the application. No photograph was copied from the supplied design screenshot.

| File | Author / source | License |
| --- | --- | --- |
| kimchi.webp | AI-generated image, user-supplied: `out/www.orbix.studio/images/kimchi-bowl.png` | User-supplied; no third-party license |
| kraut.webp | AI-generated image, user-supplied: `out/www.orbix.studio/images/sauerkraut-bowl.png` | User-supplied; no third-party license |
| sourdough.webp | AI-generated image, user-supplied: `out/www.orbix.studio/images/sourdough-loaf.png` | User-supplied; no third-party license |
| milk-kefir.webp | AI-generated image, user-supplied: `out/www.orbix.studio/images/milk-kefir-bottle.png` | User-supplied; no third-party license |
| kombucha.webp | Romarin, [Kombucha jar](https://commons.wikimedia.org/wiki/File:Kombucha_jar.jpg) | Public domain. Kept for existing installs; `profileVisual` no longer uses it. |

These four batch stand-ins replaced the earlier Wikimedia Commons photographs on 2026-11-17 (Shisma's *Kimchi in jar*, CC BY 4.0; PilotChicago's *Sourdough starter*, CC BY-SA 4.0; Bdubay's *Sauerkraut Jar*, CC BY-SA 3.0). Those versions are no longer distributed; their authors and licences are recorded here for history. `scripts/assets/make-batch-standins.py` trimmed and downscaled them to 700 px tall RGBA WebP: kimchi, sourdough and milk kefir arrived with their alpha channel already cut, and the sauerkraut was keyed against its white studio ground. Interface credits are available in the dashboard and Settings.

| File | Author / source | License |
| --- | --- | --- |
| grapefruit-spritz.webp | AI-generated image, user-supplied: `out/www.orbix.studio/images/hero.png` (glass only) | User-supplied; no third-party license |
| fruit-still-life.webp | AI-generated image, user-supplied: `out/www.orbix.studio/images/fruit.png` | User-supplied; no third-party license |

These two Swipe-rework cutouts are derived from user-supplied, AI-generated imagery and are not affiliated with Swipe Drinks. They were background-removed, trimmed and downscaled by `scripts/assets/make-cutouts.py`; the originals are unchanged. Method, sizes, intended card use and known flaws are in `docs/design/swipe-cutouts.md`. The app uses them as batch-card stand-ins only where a profile has no photograph of its own: `grapefruit-spritz` for kombucha, the other drink profiles (water kefir, kvass, soda, jun, …) and the batch empty state, `fruit-still-life` for fruit profiles; both always on a pastel card. `kombucha.webp` stays bundled and credited for existing installs, but `profileVisual` no longer uses it.

`Outfit.ttf`: Copyright 2021 The Outfit Project Authors (https://github.com/Outfitio/Outfit-Fonts). SIL Open Font License 1.1; full text in `OFL.txt`.

## Current interface: Swipe-derived journal

The original `ui-board.png` and `drinks-board.png` are the composition authority, not generated brand guides. This is an **unofficial reconstruction of Swipe Drinks artwork in an Orbix case study**, not Orbix Studio's identity or recovered app CSS. Black grounds, white/pastel islands, bowed card bodies, capsule rows, circular utilities, dark selection and integrated cutouts establish the shared vocabulary. The four printed pastels are yellow `#ffec89`, lime `#b6f074`, lilac `#dab8f1`, and blue `#b6e1fa`; white and sampled ink `#1c1c1c` provide contrast. The dark board's repeated yellow hex is a labeling error.

The interface uses **Unique by Rajesh Rajput** throughout, overriding the reference's Circular Std and the kit's suggested companion font. Seven original `Web-TT` WOFF2 faces (100–700) and the original EULA are packaged in `public/fonts/unique/`, byte-identical to the user-supplied originals. The user confirmed the necessary rights in issue #51; this is not a claim of a broader redistribution grant. No conversion, subsetting, synthesis, installed-font override or external font request is used. System sans is explicitly the font-load/unsupported-character fallback. Outfit and Sofia Sans remain historical assets with their licenses, not active interface fonts.

Geometry, spacing and responsive behavior are app adaptations, not measured original CSS. Below 600 CSS pixels the four destinations use labelled bottom navigation; 600–1023 uses a compact rail, and 1024+ uses a labelled sidebar and split batch workspace. CSS and focus thresholds agree. Settings and the separate lime Start a batch action remain directly reachable. The single detail/logger tree never moves at a breakpoint. Unique's extremely narrow original advances needed larger sizes after browser inspection: body/forms use 2rem, metadata/controls at least 1.75rem, headings 2.4–3.5rem; open tracking (+0.02em to +0.045em) keeps the condensed letterforms from reading as stretched, and labels wrap rather than shrink. Reduced motion removes transitions and transforms.

`docs/design/unique-font-audit.json` records fontTools cmap/name/weight/OpenType inspection and SHA-256 hashes for all seven faces. Each has 367 encoded codepoints and 422 glyphs and covers the complete supplied `unique-charset.json` checklist. Greek, Cyrillic, CJK and other unencoded characters require fallback. Run `python scripts/audit-unique-fonts.py` with fonttools and brotli to repeat the audit. Browser/platform checks and remaining limitations are recorded in `docs/design/issue-56-verification.md`.

The user-supplied orange cat-and-jar logo is unchanged artwork. Native launch and install-icon redesign are not part of issue #56. Keep source palette aliases in `--editor-*` and `--component-*` rather than reviving independent themes. User photos retain their original bytes and natural rectangular framing; stand-ins are visibly identified, and loading/broken images retain their space with a neutral jar fallback. A failed user photograph is never silently replaced by a stand-in.

The five install/head icons in `public/` are byte-identical copies from the logo pack's `drop-in-assets/`. Their originals remain untouched. HTML icon URLs use Vite's `%BASE_URL%`; manifest icon paths stay relative to the manifest. Keep these actual PNG files and their precache entries together for both root and `/fermentStation/` installs.

## Historical font assets

The previous design used Unique-inspired Sofia Sans Extra Condensed for selected headings and Outfit for functional text. That historical substitution is superseded by the supplied genuine Unique originals and the user's rights confirmation.

`SofiaSansExtraCondensed.ttf` is the unmodified upright variable font (weight 1–1000), Copyright 2019 The Sofia Sans Project Authors (https://github.com/lettersoup/Sofia-Sans), distributed under SIL Open Font License 1.1. Full notice and license: `SofiaSansExtraCondensed-OFL.txt`. Embedding and redistribution are permitted with this notice and license.

Source: [Google Fonts binary](https://raw.githubusercontent.com/google/fonts/8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5/ofl/sofiasansextracondensed/SofiaSansExtraCondensed%5Bwght%5D.ttf) and [license](https://raw.githubusercontent.com/google/fonts/8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5/ofl/sofiasansextracondensed/OFL.txt), pinned to commit `8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5`. Both historical fonts and licenses remain bundled locally for offline credits.
