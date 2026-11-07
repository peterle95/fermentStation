# FermentStation reference-led prototypes

- [Phone](http://127.0.0.1:5177/phone/)
- [Desktop](http://127.0.0.1:5177/desktop/)
- [Phone batch detail](http://127.0.0.1:5177/phone/?view=detail)

Both `index.html` files are independent, offline-capable prototypes. CSS, JavaScript, icons, the Outfit variable font, and four real photographic cut-outs are embedded. They can also be opened directly from disk.

To serve them from the repository root:

```powershell
python -m http.server 5177 --bind 127.0.0.1 --directory prototypes/new_design
```

## Design handoff

Kind: software; household fermentation tracking. Primary action: **Start a batch**.

The supplied screenshot, rather than a randomly dealt landing-page template, controls the design: warm ivory, mint navigation, lime summary, forest-green pill actions, pastel photographic panels, compact rounded Outfit typography, a progress arc, and tightly spaced horizontal batch cards. The desktop extends the dashboard and detail screens into one three-column application. The phone opens batch details in a dedicated screen and retains the reference's raised central action.

Voice: short, practical household-fermentation language; batch, fermentation profile, profile input, profile guidance, check completion, and timeline entry follow `CONTEXT.md`.

Plan: phone dashboard → selectable batch detail; desktop navigation → dashboard → selected batch detail. Hover and press feedback use the skill's embedded motion layer. An entrance settles the overview once; reduced motion shows the resting interface. No marketing hero, full-screen promotional sections, shader, or scroll-driven moment was added: those would conflict with the requested application screenshot.

The four initial batches, quantities, readings, profile guidance, and dates are example data, not real user records or validated fermentation instructions. The evaluation date is fixed at 7 November 2026. New batches, observations, and completed checks exist only in memory and reset on reload. Temperature observations do not overwrite current batch inputs. No server, account service, contact form, canonical domain, or external asset request is used.

## Checks

```powershell
node prototypes/new_design/check.mjs
```

**PASS, both files:** embedded assets; classic/module script syntax; all status filters; case-insensitive search; empty results; resetting search; finish-date sorting; batch selection; check completion and next schedule; escaped observation text; historical temperature readings; batch creation; and automatic ready status for past finish dates. These are dependency-free logic tests with a small DOM stub, not end-to-end browser tests.

The skill's headless screenshot tool successfully rendered the phone dashboard at 390×844, the phone detail at 390×844, and the desktop at 1440×900. The final desktop uses its own scrollable content panes, without page-level overflow at that size. Real contrast and keyboard-focus issues identified in the first check were corrected.

The background desktop consistency audit completed at widths **1440, 1024, 820, 768, 390, and 320**, with intermediate sweeps at 1280, 1152, and 896. It passed the off-viewport, collision, assets, font loading, hidden visual, reduced-motion, keyboard-focus, accessible-name, and image-alt checks. It **did not pass overall**: 152 FAIL and 61 WARN findings were reported, principally the same marketing-layout requirements described below. Full output is retained at `C:/Users/molze/AppData/Local/Temp/opencode/ferment-photos/desktop-consistency.json`, and the checker's detailed crops are in `desktop/.taste-skill/consistency/`.

Two small accessibility issues were corrected after that audit: sidebar account-caption contrast and desktop filter touch targets (now at least 44px). The audit also flags a line at the edge of the independently scrollable detail pane at 1024px; the pane can be scrolled to read it. The progress-arc bounding-box overlap is intentional. The checker attempted to fetch an external motion-module path mentioned in the embedded skill's documentation comment; the actual module and stylesheet are inline and require no request. The broad audit has not been rerun after the final two CSS corrections, and the phone prototype has not received the full multi-width audit.

### Skill gate limitations

**GATE: FAIL 28 (round 2 of 3), phone.** This is not reported as a passing skill gate. Its remaining findings largely demand a marketing-site layout rather than the reference's compact application. Full output is retained at `C:/Users/molze/AppData/Local/Temp/opencode/ferment-photos/phone-gate-2.txt`. The final touch-target improvements were made after that run; no subsequent gate result is claimed here. The desktop gate and performance audit have not been completed.

Open findings from that run, including repeated targets:

| Check | Target / reason it remains |
| --- | --- |
| `hero-fill` | Compact summary followed by the batch list; not a screen-filling marketing hero. |
| `nav` | Phone navigation is at the bottom, not a full-width desktop marketing header. |
| `spill` | Raised central add button, matching the reference. |
| `overlap-text` ×2 | The progress arc encloses its number; the checker also counts clipped scrolling content behind the bottom navigation. The scroll viewport now reserves navigation height. |
| `cta` ×2 | Search and the informational temperature tip are not marketing call-to-action sections. |
| `copy-headline` | “Your batches” names an application view, not a product category being sold. |
| `heading-scale` ×2 | Compact application headings and a larger progress count match the reference. |
| `moment-none` | No scroll-driven promotional moment is appropriate for this dashboard. |
| `hero-screen` | The application has its own scrollable content, not a one-screen hero section. |
| `section-height` | Application rows are not aligned to full-screen marketing tiles. |
| `one-section` | Main content is a dashboard and a selected-batch aside. |
| `one-heading` | Several application regions share one visible dashboard. |
| `container-edges` ×6 | Centered device frame, application shell, skip link, status icons and gauge text are not a marketing `.wrap` grid. |
| `split-pair` | The arc and status rows are intentionally vertically centered. |
| `flush` ×4 | Search, section heading, filters and first batch card use the reference's compact spacing. |
| `no-visual` | Misidentifies a nested batch-list region despite the embedded rendered photographs. |
| `container` | No marketing `.wrap` container is used. |

Two explicit false-positive waivers were recorded in `prototypes/.taste-skill/waivers.json`:

- `gaming-suspect`: the skill's own embedded `motion.js` contains its documented headless-rest-state detection; application code does not detect automation.
- `motion-layer`: the complete motion stylesheet and module are inline to satisfy the standalone-file requirement, rather than linked externally.

The standalone layout checker stopped after its first size with `Cannot read properties of undefined (reading 'map')`, following its `no .wrap` finding. Only that first layout-check result is available; it did not finish the remaining sizes. Static copy lint reported no failures or warnings but saw only three words in these embedded-script files, so its text coverage is insufficient and not claimed as a full copy review. The dynamically rendered text was reviewed directly.

## Photograph and font credits

All four photographs are **stand-ins** for eventual batch photographs. They were cropped and their backgrounds removed, not generated. Replace them with the user's own kimchi, kombucha, sourdough starter, and sauerkraut photographs when integrating the interface. No photograph from the supplied reference was copied.

| Embedded photograph | Author | Source / license |
| --- | --- | --- |
| Kimchi in jar | Shisma | [Source](https://commons.wikimedia.org/wiki/File:Kimchi_in_jar.jpg), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| Kombucha jar | Romarin | [Source](https://commons.wikimedia.org/wiki/File:Kombucha_jar.jpg), public domain |
| Sourdough starter | PilotChicago | [Source](https://commons.wikimedia.org/wiki/File:Sourdough_starter.jpg), [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| Sauerkraut Jar | Bdubay | [Source](https://commons.wikimedia.org/wiki/File:Sauerkraut_Jar.jpg), [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |

Adapted CC BY-SA photographic assets retain their respective share-alike licenses. Each HTML includes an expandable photographic credit line and the complete Outfit SIL Open Font License in a source comment. The application icons are inline interface glyphs, not imitations of third-party product logos.
