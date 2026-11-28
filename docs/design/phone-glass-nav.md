# Phone glass navigation bar

The phone bottom bar (< 600 px) is a React Bits `PillNav` row on a React Bits `GlassSurface` pane. Content scrolls
under the bar, and the pane bends what passes beneath its rim, as in the React Bits demo the user matched it to on
2026-11-17. This note covers how the glass is built, which parts are ours and which are upstream's, the constraints it
works inside, and the **Reduce glass** setting that replaces it with a dimmed pane. How the bar stays seated on the
bottom edge in the installed iPhone app is covered in `ios-home-screen-layout.md`.

Files:

- `src/components/GlassSurface.tsx`: upstream component, verbatim apart from its Tailwind classes being ported.
- `src/components/GlassSurface.css`: those Tailwind utilities, one for one, as plain CSS.
- `src/App.tsx`: the `phone-navigation` block, plus `useReduceGlass` and the Appearance card in `SettingsView`.
- `src/styles.css`: the phone PillNav block (`@media (max-width: 599px)`), the `.glass` primitive and the
  `--colour-glass-dim` tokens.

## 1. How the refraction works

`GlassSurface` does not imitate glass with a blur and a white fill; it actually displaces the pixels behind it.

1. **A displacement map.** On mount and on every resize, `generateDisplacementMap()` draws an SVG the size of the pane
   and turns it into a `data:` URL:
   - black ground;
   - a horizontal red gradient and a vertical blue gradient, both in the pane's rounded-rect shape (`rx` =
     `borderRadius`), blended with `mix-blend-mode: difference`;
   - over them, a neutral grey rect (`brightness` 50 %, `opacity` 0.93), inset by `borderWidth × ½` of the short
     side and softened by an 11 px Gaussian blur (`blur`).

   Neutral grey means "no shift", so the middle of the pane stays undistorted. Only the band at the rim carries the
   gradients, which is why the content bends at the edge and reads clearly in the middle.
2. **An SVG filter applied as a backdrop filter.** The pane's inline style is `backdrop-filter: url(#filter)
   saturate(1)`. The filter loads the map with `feImage` and runs three `feDisplacementMap`s over the backdrop, one
   per colour channel. Each reads x from the map's red channel and y from its green channel, at scale
   `distortionScale + offset`:

   | channel | offset | scale |
   | --- | --- | --- |
   | red | 0 | -180 |
   | green | 10 | -170 |
   | blue | 20 | -160 |

   An `feColorMatrix` keeps one channel from each result, and two `feBlend mode="screen"` recombine them. Because the
   three channels shift by different amounts, the rim gets a slight chromatic split, the "liquid glass" fringe.
3. **A rim highlight.** `SVG_SHADOW` adds two inset shadows (2 px and 10 px). Their colour comes from `light-dark()`:
   black under a light colour scheme, white under a dark one.

`App.tsx` passes the demo's material exactly (user, 2026-11-17): `distortionScale={-180}`, `displace={0.5}` (a light
frost over the light coming through), `backgroundOpacity={0.1}` and `borderRadius={16}`, with the default colour
offsets 0 / 10 / 20. The radius is a number of pixels
because the map's `rx` must equal the pane's real corner; a token would not reach the SVG.

### Browser support

`supportsSVGFilters()` returns false for Safari (WebKit without "Chrome" in the UA) and Firefox. Neither can use an SVG
filter as a `backdrop-filter`. They get upstream's **frosted** fallback instead: `blur(12px) saturate(1.4)
brightness(1.04)`, a faint white frost and the fallback rim. There is no refraction there. The WebGL renderer is
never used, because it only runs when a `backdrop` image is passed and we pass none. So refraction happens in
Chromium (Chrome, Edge, the Android WebView) and nowhere else.

## 2. What we changed around it

| Change | Where | Why |
| --- | --- | --- |
| The row floats over the content | `.content-shell { grid-area: 1 / 1 / -1; height: 100% }` (≤ 599 px) | The content runs underneath the bar, so the glass has something to bend. |
| Taps beside the pane reach the content | `.phone-navigation { pointer-events: none }`, `.phone-glass { pointer-events: auto }` | The gutters around the pane are not dead zones. |
| Scroll panes end clear of the bar | `--phone-nav-height` = 44 px tap row + 2 × 16 px glass (a 76 px pane, the demo's height) + 2 × 8 px row padding; `.main-content`, `.design-dashboard` and `.design-detail` add it to their bottom padding | The last card can scroll above the bar. |
| White rim like the demo | `.phone-glass { color-scheme: dark }` | `:root` is `color-scheme: light`, which turns `light-dark()` black, and the rim became a dark outline. |
| Demo fill, no tint layer of ours | `backgroundOpacity={0.1}`; the former white 10 % `::before` layer and its `--colour-glass-tint` token are gone | Under the dark scheme the component's fill is black 10 %, as in the demo. The white layer made the pane milky and hid the refraction. |
| Full-width rounded rect | `width="100%" height="auto"` | The demo's pane spans the row. |
| Pills spread evenly at their own size | `.pill-nav { width: 100% }`, bar and track `flex: 1 1 auto`, list and ink `justify-content: space-evenly` | PillNav measures each slot with `offsetLeft`/`offsetWidth`, and a `ResizeObserver` re-measures, so the sliding dot and the fill follow the spread. `.pill-nav-ink` needs the same `justify-content` as the list, or the ink drifts off the labels. |
| PillNav's own capsule off | `surface="none"` | The glass is the surface. |
| Fits 320 px | `@media (max-width: 379px)` narrows the pill padding to `--space-3` | Four labels fit without folding into the burger menu (`collapse="never"`). |

### Constraints honoured

`src/styles.test.ts` enforces the design contract. The glass work stays inside it:

- `backdrop-filter` appears in styles.css only in the `.glass` primitive. GlassSurface's filter is an inline style
  from the component, and the dimmed pane uses the primitive.
- No styles.css selector matches `/\.glass\b/` outside the primitive, hence the names `.phone-glass` and
  `.phone-glass-dim` (never `.glass-surface…` in styles.css).
- Colours come only from `--colour-*` tokens in `:root`: `--colour-glass-dim` and `--colour-glass-dim-solid`.
- Radii in styles.css are only `--radius-*`, `50%` or `0`. The 16 px corner is a component prop (and an inline style
  on the dimmed pane), and the tint layer inherits the clip instead of declaring a radius.
- No literal `44px` outside `:root`; the height is built from `var(--target-min)`.

## 3. Known differences from the demo

- **Dark arcs at the left and right ends.** The rim refracts what lies just outside it, and at the ends that is the
  black gutter. A smaller `distortionScale` (about -60) would shorten them.
- **Red and blue fringes on light content.** These come from the per-channel offsets (10 / 20). Setting
  `greenOffset={0} blueOffset={0}` removes them, at the cost of the liquid look.
- **No refraction in Safari or Firefox** (see Browser support).

## 4. Reduce glass

**Settings → Appearance → Reduce glass** (a `role="switch"` row, styled like Suggestions) replaces the GlassSurface
with a **dimmed wide pane**. The pane keeps the same full width, height, 16 px corners and pills, but has a dark
frosted fill (black 48 % over an 8 px blur), no refraction and no rim highlight.

- **Markup.** With the setting on, `App.tsx` renders `<div className="phone-glass phone-glass-dim glass"
  style={{ borderRadius: 16 }}><div>{phonePillNav}</div></div>` instead of the GlassSurface. The same `PillNav`
  element is used in both, so the labels, the dot and the fill animation are unchanged. The inner `<div>` takes
  `.phone-glass > :last-child`'s padding, the role GlassSurface's content wrapper plays.
- **Material.** It is the app's `.glass` primitive. `.phone-glass-dim` sets `--glass: var(--colour-glass-dim)` and
  `box-shadow: none` (no rim). Where `backdrop-filter` is unsupported, it falls back to `--colour-glass-dim-solid`
  (black 80 %).
- **Storage.** The setting is kept per device in `localStorage` under `fermentstation.reduce-glass` (`"true"` /
  `"false"`), with reads and writes in `try`/`catch`. It is deliberately not part of the household
  `ShellPreferences`, so it never syncs through a shared folder.
- **Default.** Off: the bar is the glass until the user turns the switch on, whatever the OS reports. A first version
  followed `prefers-reduced-transparency` / `prefers-reduced-motion` until the user chose. That put the black pane on
  devices and DevTools sessions that report reduced motion, so the user ruled it out on 2026-11-17: the dimmed pane
  appears only while Reduce glass is on.
- **Tests.** In `src/App.settings.test.tsx`, "keeps Reduce glass on this device, dims the phone bar only while it is
  on, and ignores the OS". In `src/styles.test.ts`, the settings-switch inventory now counts two switches.
- **Screenshots.** The `reduce-glass` surface (phone viewports only) switches the setting on and captures the
  Appearance card over the dimmed bar. Every other capture shows the glass.

A side fix came with the switch: a checked toggle row lost its white label on hover, because
`button:hover:not(:disabled)` (dark ink) outranked the selected row's ground ink. The selected-row selector now has a
`:hover:not(:disabled)` twin in the ground-ink list. This also fixes the Suggestions row under a desktop mouse, and
after a tap on touch screens.
