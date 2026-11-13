# Reference design assets

Extracted unchanged from `prototypes/new_design/phone/index.html`. All photographs are stand-ins, cropped and with backgrounds removed; user batch photos take precedence in the application. No photograph was copied from the supplied design screenshot.

| File | Author / source | License |
| --- | --- | --- |
| kimchi.webp | Shisma, [Kimchi in jar](https://commons.wikimedia.org/wiki/File:Kimchi_in_jar.jpg) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| kombucha.webp | Romarin, [Kombucha jar](https://commons.wikimedia.org/wiki/File:Kombucha_jar.jpg) | Public domain |
| sourdough.webp | PilotChicago, [Sourdough starter](https://commons.wikimedia.org/wiki/File:Sourdough_starter.jpg) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| kraut.webp | Bdubay, [Sauerkraut Jar](https://commons.wikimedia.org/wiki/File:Sauerkraut_Jar.jpg) | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |

The adapted share-alike photographic assets retain their respective CC BY-SA licenses. Interface credits are available in the dashboard and Settings.

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
