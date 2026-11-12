# Unique Typeface — App typography implementation kit

**Design reference:** Unique Typeface / Free Variable / Condensed / 7 Styles, by Rajesh Rajput (2023).  
**Source:** https://www.behance.net/gallery/160832905/Unique-Typeface-Free-Variable-Condensed-7-Styles  
**Official font download:** https://rajputrajesh-448.gumroad.com/l/Unique

## What you receive
- `docs/Design_Report.pdf` — visual design report using credited extracts from the supplied reference document.
- `specimen/index.html` — responsive browser preview for all seven weights, letters, punctuation, accents, numerals, editorial marks, and custom text.
- `charset/groups.json`, `charset/characters.csv`, `charset/characters.txt` — machine-readable character targets and codepoints.
- `scripts/install_fonts.py` — copies downloaded ORIGINAL font binaries into the specimen and `web/public/fonts` without changing the font bytes, and generates `@font-face` CSS.
- `scripts/audit_fonts.py` — uses fontTools to report each font's actual encoded character set, missing targets, variable axes and OpenType features.
- `web/src/tokens.css`, `web/src/typography.ts`, `web/components/UniqueHeading.tsx` — React/Next.js integration references.
- `docs/AGENT_HANDOFF.md` — copyable implementation instructions.
- `assets/references/` — extracts of your supplied PDF used as an internal visual reference (not licensed for independent app redistribution).

**Important:** The archive intentionally does NOT include the proprietary font binaries. Your uploaded Behance PDF contains images, not installable fonts. The creator's license allows use for personal/commercial work but states the font files must not be modified without the designer's written permission. Download the original fonts yourself from the official link and preserve the included license. Confirm web/app embedding and redistribution for the target product.

## Quick start (once you obtain the original ZIP)

1. Download the original font package from the creator and extract it to a local folder (keep the original license).
2. Run `python scripts/install_fonts.py /absolute/path/to/extracted-fonts` from the kit root. Python + `fonttools` are needed (`pip install fonttools`).
3. Open `specimen/index.html` in a browser, or serve with `python -m http.server 8000` and open `http://localhost:8000/specimen/`.
4. Review `scripts/audit_fonts.py /absolute/path/to/extracted-fonts` (prints coverage and writes a JSON summary).
5. For a Next.js project, copy `web/public/fonts` into your project's `public/fonts`, import `web/src/tokens.css` into your global stylesheet (or copy its contents), and adapt the `web/components` React component.

## Why this avoids creating a new font

The requested typeface already exists in a complete seven-weight family. A screenshot reconstruction would have wrong kerning, hinting, accents, punctuation, alternate glyphs and licensing ambiguity. This kit uses the ORIGINAL binaries once the user downloads them; it does not redraw or fake the font.

## Weight map

| Weight | CSS | Usage |
|---|---:|---|
| Thin | 100 | huge atmospheric headlines |
| ExtraLight | 200 | editorial headings |
| Light | 300 | posters, split titles |
| Regular | 400 | standard headlines |
| Medium | 500 | prominent subheadings |
| SemiBold | 600 | buttons/branding accents where legible |
| Bold | 700 | posters, campaign graphics, impact headlines |

## Character coverage

The published third-party map reports **367 characters** and **422 glyphs** (additional glyphs include alternates). `charset/*` is a broad source-derived **target/checklist**, not an authoritative binary `cmap`. Once originals are installed, the audit tool generates the actual exact support. Special characters outside the exact font coverage should be handled by a reliable system fallback. Do not claim Cyrillic, Greek or CJK support (except any individually encoded symbols verified in the audit).

## Visual system

The font has tall condensed proportions, monoline-ish rounded forms and very short counters; its personality is well suited to editorial display and posters. Pair it with Inter, Arial or another legible UI font for body copy, forms, long prose and accessibility-critical interfaces. Suggested sizes/tokens are starting points; test line wrapping, diacritics and small screens.
