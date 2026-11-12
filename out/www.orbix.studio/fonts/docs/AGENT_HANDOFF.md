# AGENT HANDOFF — Unique display font implementation

## Goal
Integrate the *existing* Rajesh Rajput **Unique** family into a React/Next.js application as an expressive display face, with every encoded Latin letter, digit, punctuation and alternate that the original fonts contain. Do NOT approximate the font from its screenshot. Preserve the creator's intellectual property and EULA.

## Inputs
- `font-manifest.json` (7 weight definitions and source links)
- `charset/groups.json` (proposed glyph QA corpus)
- `web/src/tokens.css` (app CSS tokens)
- `web/src/typography.ts` (TS design tokens)
- `web/components/UniqueHeading.tsx` (component)
- `specimen/index.html` (design/QA preview)
- `docs/LICENSING.md` (critical rights restrictions)

## Procedure
1. Obtain the genuine, unmodified font files from the designer: https://rajputrajesh-448.gumroad.com/l/Unique. Confirm redistribution / web embedding rights for the app. Do not check in font binaries to a public repository unless license permits.
2. Install Python `fonttools`, run `python scripts/install_fonts.py <original-font-folder>`, then `python scripts/audit_fonts.py <original-font-folder> --json charset/actual-font-coverage.json`.
3. The installer places byte-identical copies in `web/public/fonts` and `specimen/fonts` and writes CSS `@font-face` declarations. Do not do lossy conversions or alter the font glyph/metrics tables.
4. Copy `web/public/fonts` into the app's `public/fonts`, register `unique.css` in the app's global style layer before using the family, import `tokens.css` and use `'Unique Display', Impact, sans-serif` on display-only roles. In a deployed app with a font-serving license, serve via the app's own permitted asset pipeline.
5. Test every weight, uppercase/lowercase, punctuation and extended accents using the specimen and audit. Compare actual glyph counts to published **367 characters / 422 glyphs** but don't treat that number as guaranteed for any particular revision.
6. For body text, forms, error messaging, code or small buttons, use a more readable UI text family such as Inter (system fallback acceptable). Avoid extreme negative tracking for diacritics. Test keyboard navigation, zoom and mobile.
7. OpenType stylistic alternates: check `font-features.json` or the audit output for actual feature tags; only enable those that exist (e.g. `salt`, `ss01`) and only when design requests them.
8. Check license once more before shipping a public build, and preserve attribution in internal design documentation.

## Acceptance criteria
- Genuine original fonts loaded: browser network shows 200 responses and computed font family is Unique Display.
- All seven advertised weights render separately or legitimate variable axis is confirmed from actual binary.
- Core ASCII: 26 uppercase, 26 lowercase, ten digits, all 32 ASCII keyboard punctuation marks supported; accented Latin fixtures visually inspected.
- Missing Unicode characters fall back instead of showing tofu/blank boxes.
- No modified font files, no fake redraw, no reference poster artwork in distributed app UI.
- `charset/actual-font-coverage.json` produced, covering every font installed.
- Readable fallback font is provided for body text and accessible interfaces.
