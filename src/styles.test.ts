import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const app = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

function rule(selector: string, source = styles) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`(?:^|\\n)\\s*${escaped} \\{([^}]+)\\}`));
  expect(match, `Missing rule: ${selector}`).not.toBeNull();
  return match![1];
}

type Rule = { selector: string; selectors: string[]; declarations: [property: string, value: string][] };

/** Every innermost `selector { declarations }` block, including those nested in @media/@supports. */
function rules(source = styles): Rule[] {
  return [...source.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, prelude, body]) => {
    const selector = prelude.trim().replace(/\s+/g, " ");
    return {
      selector,
      selectors: selector.split(/,(?![^(]*\))/).map((part) => part.trim()),
      declarations: body.split(";").map((part) => part.trim()).filter(Boolean).map((part) => {
        const colon = part.indexOf(":");
        return [part.slice(0, colon).trim(), part.slice(colon + 1).trim()] as [string, string];
      }),
    };
  });
}

/** The bowed-outline primitive owns its own radius, clip and pseudo-element layers. */
const isPrimitive = (rule: Rule) => rule.selectors.every((selector) => /\.bowed(?:-clip)?\b|^:where\(\.bowed/.test(selector));

/** Classes that share a className literal with `bowed` / `bowed-clip` in App.tsx, mapped to the variant. */
function bowedSurfaces() {
  const surfaces = new Map<string, "bowed" | "bowed-clip">();
  for (const [, literal] of app.matchAll(/["`]([^"`]*\bbowed(?:-clip)?\b[^"`]*)["`]/g)) {
    const words = literal.split(/\s+/).filter((word) => /^[a-z][a-z\d-]*$/.test(word));
    const variant = words.includes("bowed-clip") ? "bowed-clip" : "bowed";
    for (const word of words) if (word !== "bowed" && word !== "bowed-clip") surfaces.set(word, variant);
  }
  return surfaces;
}

const colourLiteral = /#[\da-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i;
const namedColour = /\b(?:white|black|red|green|blue|yellow|orange|purple|pink|gr[ae]y|silver|navy|teal|lime|olive|maroon|aqua|fuchsia)\b/i;

describe("Swipe-derived design contract", () => {
  it("takes every colour from the :root token layer, with the boards' black ground and ink", () => {
    expect(styles.match(/:root \{/g)).toHaveLength(1);
    for (const [name, value] of Object.entries({
      background: "#ffffff", surface: "#ffec89", "surface-inverse": "#000000", text: "#000000", "text-muted": "#000000", "text-inverse": "#ffffff",
      action: "#b6f074", "on-action": "#000000", "action-alt": "#dab8f1", emblem: "#c5b4ec", accent: "#b6e1fa", border: "#000000",
    })) expect(styles).toContain(`--colour-${name}: ${value};`);
    // The retired near-black must not come back as ground, ink or border.
    expect(styles).not.toMatch(/#1c1c1c/i);
    for (const { selector, declarations } of rules()) {
      for (const [property, value] of declarations) {
        if (selector === ":root") {
          if (colourLiteral.test(value)) expect(property, `colour literal outside a --colour-* token: ${property}`).toMatch(/^--colour-[\w-]+$/);
          continue;
        }
        expect(value, `${selector} { ${property} } must use a --colour-* token`).not.toMatch(colourLiteral);
        expect(value, `${selector} { ${property} } must use a --colour-* token`).not.toMatch(namedColour);
      }
    }
    expect(styles).not.toMatch(/--bg:|--accent:/);
    for (const layer of ["editor", "component"]) {
      const definitions = [...styles.matchAll(new RegExp(`--${layer}-[\\w-]+: ([^;]+);`, "g"))];
      expect(definitions.length).toBeGreaterThan(5);
      expect(definitions.every(([, value]) => /^var\(--colour-[\w-]+\)$/.test(value))).toBe(true);
    }
    expect(app).not.toMatch(colourLiteral);
    const visuals = app.slice(app.indexOf("function profileVisual"), app.indexOf("function BatchPhoto"));
    for (const color of ["surface", "action", "action-alt", "accent"]) expect(visuals).toContain(`var(--colour-${color})`);
  });

  it("paints avatar and emblem circles in the board's second lilac", () => {
    for (const selector of [".design-avatar", ".queue-icon, .design-check-symbol, .next-action-icon"]) {
      expect(rule(selector)).toContain("background: var(--colour-emblem)");
    }
  });

  it("uses genuine offline Unique throughout with relative sizing and no synthesis", () => {
    expect(styles).toContain('--font-family: "Unique", system-ui, sans-serif;');
    expect(rule(":root")).toContain("font-size: 100%");
    expect(styles).toContain("font-synthesis: none;");
    expect(styles.match(/@font-face/g)).toHaveLength(7);
    expect(styles).not.toMatch(/Circular Std|Outfit|Sofia|Georgia|text-transform: uppercase/);
    expect(read("../index.html")).not.toMatch(/rel="preload"[^>]+\.ttf/);
    expect(rule(".station-dialog")).toContain("var(--font-family)");
  });

  it("keeps the condensed face undistorted and lets controls inherit their role", () => {
    expect(rule("button, input, select, textarea")).toContain("font: inherit; letter-spacing: inherit");
    expect(styles).not.toMatch(/scale[XY]\(|font-stretch:|size-adjust:/);
  });

  it("groups summary numbers with their labels and stacks the phone summary without hiding its heading", () => {
    expect(rule(".design-stat-row > div:first-child")).toContain("flex-direction: column-reverse");
    expect(rule(".design-stat-number")).not.toContain("margin-left: auto");
    const mobile = styles.slice(styles.indexOf("@media (max-width: 599px) {"));
    expect(rule(".design-summary", mobile)).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(rule(".design-gauge", mobile)).toContain("grid-template-columns: auto minmax(0, 1fr)");
    expect(rule(".design-summary-label", mobile)).not.toContain("display: none");
  });

  it("shares the 32/12/999 geometry, 24px spacing and 52px control baseline", () => {
    for (const declaration of [
      "--radius-card: 32px;", "--radius-small: 12px;", "--radius-control: 999px;",
      "--card-padding: 24px;", "--layout-edge: 24px;", "--layout-gutter: 24px;",
      "--layout-container: 1680px;", "--button-height: 52px;", "--input-height: 52px;",
    ]) expect(styles).toContain(declaration);
    expect(rule("button")).toContain("min-height: var(--button-height)");
    expect(rule("button")).toContain("border-radius: var(--radius-control)");
    expect(rule("input, select, textarea")).toContain("min-height: var(--input-height)");
    expect(rule("textarea")).toContain("border-radius: var(--radius-small)");
    for (const selector of [".batch-component-card", ".settings-card", ".station-dialog", ".profile-card", ".profile-editor-section"]) {
      expect(rule(selector)).toContain("var(--card-padding)");
    }
  });

  it("renews card anatomy and presents real statuses instead of a decorative progress gauge", () => {
    expect(rule(".design-batch-card")).toContain("grid-template-columns:");
    const selected = rule(".design-batch-card.selected");
    for (const declaration of ["--fill: var(--colour-surface-inverse)", "--stroke: var(--colour-action)", "--stroke-w: var(--bowed-stroke)"]) expect(selected).toContain(declaration);
    expect(rule(".design-batch-photo img")).toContain("object-fit: contain");
    expect(app).toContain('className="design-batch-profile"');
    expect(app).toContain('className="design-batch-next"');
    expect(app).not.toContain('strokeDasharray={`${batches.length ? 76');
    expect(app).toContain("{dueChecks.length} checks due");
    expect(app.replaceAll("©", "")).not.toMatch(/\p{Extended_Pictographic}/u);
    const lightInk = inkGroups().find(({ kind }) => kind === "fill")!.selectors;
    for (const selector of [".primary-action", ".station-primary", ".profile-add", ".component-button-primary", ".profile-editor-button.primary"]) expect(lightInk).toContain(selector);
  });
});

/* Type system (docs/design/swipe-rework-log.md, ticket 2). */
const roleNames = ["display", "figure", "headline", "title", "title-light", "heading", "subheading", "row", "body", "label", "meta"] as const;
/** Vertical stem width of each Unique weight in em, measured with fontTools from public/fonts/unique/*.woff2. */
const stemEm: Record<number, number> = { 100: 0.018, 200: 0.032, 300: 0.046, 400: 0.06, 500: 0.073, 600: 0.087, 700: 0.1 };
/** A stem thinner than this (CSS px at 1x) breaks up on screen; light weights are therefore display-only. */
const minimumStemPx = 1.4;
const typographic = ["font-size", "font-weight", "line-height", "letter-spacing"] as const;

function rootTokens() {
  const tokens = new Map<string, string>();
  for (const entry of rules()) if (entry.selector === ":root") for (const [property, value] of entry.declarations) tokens.set(property, value);
  return tokens;
}

function roleTokens() {
  const tokens = rootTokens();
  return roleNames.map((name) => {
    const size = tokens.get(`--type-${name}`) ?? "";
    return { name, size, px: Number.parseFloat(size) * 16, weight: Number(tokens.get(`--type-${name}-weight`)), leading: tokens.get(`--type-${name}-leading`), tracking: tokens.get(`--type-${name}-tracking`) };
  });
}

/** Resolve a :root colour token through var() aliases to its hex value. */
function hex(token: string): string {
  const value = rootTokens().get(token);
  expect(value, `missing token ${token}`).toBeDefined();
  const alias = value!.match(/^var\((--[\w-]+)\)$/);
  return alias ? hex(alias[1]) : value!;
}

function contrast(foreground: string, background: string) {
  const luminance = (value: string) => {
    const [r, g, b] = [1, 3, 5].map((index) => Number.parseInt(value.slice(index, index + 2), 16) / 255)
      .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

const inkSet = ["--ink", "--ink-meta", "--ink-figure", "--ink-accent", "--ink-attention", "--ink-time"];
/** Rules that switch a surface's ink set: "fill" (ink on light fills) or "ground" (the black ground's colours). */
function inkGroups() {
  return rules().filter((entry) => entry.selector !== ":root" && entry.declarations.some(([property]) => property === "--ink")).map((entry) => {
    const values = new Map(entry.declarations);
    const kind = values.get("--ink") === "var(--ink-fill)" ? "fill" : "ground";
    return { ...entry, kind, values };
  });
}

describe("type system: roles, weights and text colour (swipe-rework-log.md, ticket 2)", () => {
  it("defines every role once in :root as rem size, weight, leading and tracking", () => {
    const roles = roleTokens();
    for (const role of roles) {
      expect(role.size, `--type-${role.name} must be rem so text reflows at 200 % root size`).toMatch(/^\d+(?:\.\d+)?rem$/);
      expect(Object.keys(stemEm).map(Number), `--type-${role.name}-weight`).toContain(role.weight);
      expect(role.leading, `--type-${role.name}-leading`).toMatch(/^\d+(?:\.\d+)?$/);
      expect(role.tracking, `--type-${role.name}-tracking`).toMatch(/^(?:0|-?\d*\.?\d+em)$/);
    }
    // No retired scale tokens linger next to the roles.
    const declared = [...rootTokens().keys()].filter((name) => name.startsWith("--type-")).map((name) => name.replace(/^--type-/, "").replace(/-(?:weight|leading|tracking)$/, ""));
    expect([...new Set(declared)].sort()).toEqual([...roleNames].sort());
  });

  it("keeps every role's stems at least 1.4 CSS px, so light weights stay at display sizes", () => {
    for (const role of roleTokens()) expect(role.px * stemEm[role.weight], `${role.name}: ${role.px}px at weight ${role.weight}`).toBeGreaterThanOrEqual(minimumStemPx);
    // Hierarchy: the meta floor is 20 px, and no role is larger than the 100 px hero figure.
    const sizes = roleTokens().map((role) => role.px);
    expect(Math.min(...sizes)).toBe(20);
    expect(Math.max(...sizes)).toBe(100);
  });

  it("sets type only by applying a complete role, never a raw size, weight, leading or tracking", () => {
    for (const entry of rules()) {
      if (entry.selector === ":root" || entry.selector.startsWith("@font-face")) continue;
      const values = new Map(entry.declarations);
      const font = values.get("font");
      if (font !== undefined) expect(font, `${entry.selector} { font } may only inherit`).toBe("inherit");
      const size = values.get("font-size");
      if (size === undefined) {
        // Outside a role application: emphasis may borrow a role's weight; controls inherit tracking.
        for (const property of ["line-height"] as const) expect(values.has(property), `${entry.selector} { ${property} } outside a role`).toBe(false);
        if (values.has("letter-spacing")) expect(values.get("letter-spacing"), entry.selector).toBe("inherit");
        if (values.has("font-weight")) expect(values.get("font-weight"), entry.selector).toMatch(/^var\(--type-[\w-]+-weight\)$/);
        continue;
      }
      const role = size.match(/^var\(--type-([\w-]+)\)$/)?.[1];
      expect(roleNames, `${entry.selector} { font-size: ${size} } must be a role`).toContain(role);
      expect(values.get("font-weight"), entry.selector).toBe(`var(--type-${role}-weight)`);
      expect(values.get("line-height"), entry.selector).toBe(`var(--type-${role}-leading)`);
      expect(values.get("letter-spacing"), entry.selector).toBe(`var(--type-${role}-tracking)`);
    }
  });

  it("applies every role and so puts all seven Unique weights, Thin to Bold, to work", () => {
    const applied = new Set<string>();
    for (const entry of rules()) {
      const size = new Map(entry.declarations).get("font-size")?.match(/^var\(--type-([\w-]+)\)$/)?.[1];
      if (size && entry.selector !== ":root") applied.add(size);
    }
    expect([...applied].sort()).toEqual([...roleNames].sort());
    expect([...new Set(roleTokens().map((role) => role.weight))].sort()).toEqual([100, 200, 300, 400, 500, 600, 700]);
  });

  it("guards the hierarchy anchors that later component tickets build on", () => {
    // Page titles (formerly the missing `.design-section-head h1`) take the headline role; sections the heading role.
    const roleOf = (selector: string) => rules().find((entry) => entry.selectors.includes(selector) && new Map(entry.declarations).has("font-size"))
      ?.declarations.find(([property]) => property === "font-size")?.[1].match(/^var\(--type-([\w-]+)\)$/)?.[1];
    for (const [selector, role] of [
      ["h1", "headline"], ["h2", "heading"], ["h3", "heading"], ["button", "label"], ["body", "body"], ["input", "body"], [".design-gauge strong", "display"],
      [".checks-summary strong", "display"], [".design-batch-copy h3", "title"], [".design-batch-profile", "title-light"], ["small", "meta"], [".eyebrow", "meta"],
    ]) expect(roleOf(selector), selector).toBe(role);
    // Two-line card titles pair Bold with Light at one size, as on the drink card (spec §1.1).
    const tokens = rootTokens();
    expect(tokens.get("--type-title")).toBe(tokens.get("--type-title-light"));
  });

  it("declares text-on-ground colour pairs that hold 7:1 (4.5:1 for figures at 3rem and above)", () => {
    const ground = hex("--colour-surface-inverse");
    const pairs: [token: string, minimum: number][] = [
      ["--ink-ground", 7], ["--ink-ground-meta", 7], ["--ink-ground-accent", 7], ["--ink-ground-attention", 7], ["--ink-ground-time", 7], ["--ink-ground-figure", 4.5],
    ];
    for (const [token, minimum] of pairs) expect(contrast(hex(token), ground), `${token} on the ground`).toBeGreaterThanOrEqual(minimum);
    for (const fill of ["--colour-background", "--colour-surface", "--colour-action", "--colour-action-alt", "--colour-emblem", "--colour-accent"]) {
      expect(contrast(hex("--ink-fill"), hex(fill)), `--ink-fill on ${fill}`).toBeGreaterThanOrEqual(7);
    }
    expect(hex("--colour-figure")).toBe("#fc5659");
    // Coral is reserved for the figure roles, which are at least 3rem.
    for (const entry of rules()) {
      if (!entry.declarations.some(([, value]) => value === "var(--ink-figure)")) continue;
      expect(new Map(entry.declarations).get("font-size"), entry.selector).toMatch(/^var\(--type-(?:display|figure)\)$/);
    }
  });

  it("colours text only through the ink sets, and every ink set is complete and readable on its surfaces", () => {
    for (const entry of rules()) {
      if (entry.selector === ":root") continue;
      for (const [property, value] of entry.declarations) {
        if (property === "color") expect(value, `${entry.selector} { color }`).toMatch(/^(?:inherit|currentColor|var\(--ink(?:-[a-z]+)?\))$/);
      }
    }
    const groups = inkGroups();
    expect(groups.filter(({ kind }) => kind === "fill").length).toBeGreaterThan(0);
    expect(groups.filter(({ kind }) => kind === "ground").length).toBeGreaterThan(0);
    const membership = new Map<string, string>();
    for (const group of groups) {
      expect(group.values.get("color"), group.selector).toBe("var(--ink)");
      for (const name of inkSet) {
        expect(group.values.get(name), `${group.selector} { ${name} }`).toBe(group.kind === "fill" ? "var(--ink-fill)" : `var(${name.replace("--ink", "--ink-ground")})`);
      }
      for (const selector of group.selectors) membership.set(selector, group.kind);
    }
    expect(membership.get(".app-shell")).toBe("ground");
    expect(membership.get(".design-batch-card.selected")).toBe("ground");
    expect(membership.get(".design-batch-card")).toBe("fill");
    // A surface that paints a solid token fill must read with the ink set it joined.
    for (const entry of rules()) {
      const values = new Map(entry.declarations);
      const paint = (values.get("--fill") ?? values.get("background") ?? "").match(/^var\((--colour-[\w-]+)\)$/)?.[1];
      if (!paint || paint === "--colour-scrim") continue;
      for (const selector of entry.selectors) {
        const kind = membership.get(selector);
        if (!kind) continue;
        const inks = kind === "fill" ? ["--ink-fill"] : ["--ink-ground", "--ink-ground-meta", "--ink-ground-accent", "--ink-ground-attention", "--ink-ground-time"];
        for (const ink of inks) expect(contrast(hex(ink), hex(paint)), `${selector}: ${ink} on ${paint}`).toBeGreaterThanOrEqual(7);
      }
    }
  });
});

describe("bowed outline primitive (docs/design/swipe-component-spec.md §2)", () => {
  // Gap 1 of the spec: every large card takes its silhouette from the primitive.
  const bowedCards = [
    "design-batch-card", "design-summary", "checks-summary", "design-detail-card", "profile-card", "profile-editor-section",
    "profile-editor-head", "calendar-panel", "settings-card", "batch-component-card", "timeline-entry",
  ];
  const clippedScrollers = ["station-dialog"];
  // Rounded rectangles that predate the primitive. Shrink only: when a ticket bows one of these
  // surfaces (or makes it a capsule), delete it here. A new large card must use `bowed` instead.
  const legacyCardRadius = [
    ".storage-warning", ".app-loading", ".empty-state, .design-empty-checks, .calendar-empty", ".calendar-screen, .profiles-screen, .design-checks-view",
    ".design-detail", ".ios-install-guide", ".batch-view-switch", ".design-batch-next", ".queue-card", ".design-checks-view .queue-card", ".design-tip",
    ".design-detail-photo", ".detail-readings > div", ".design-detail-next", ".design-input-summary", ".batch-guidance", ".design-timeline-panel",
    ".batch-management > .wb-panel", ".batch-tools-danger", ".next-action", ".activity-logger", ".station-dialog-heading", ".profile-overview-intro",
    ".start-batch-basics", ".start-profile-summary", ".profile-card-actions", ".profile-editor-card", ".upcoming-item", ".setting-segment", ".trash-item",
  ];

  it("carries the measured outline in tokens and defines the shape exactly once", () => {
    for (const declaration of ["--bowed-radius: 52px;", "--bowed-bow: 4.4px;", "--bowed-k: 0.64;", "--bowed-stroke: 3px;"]) expect(styles).toContain(declaration);
    expect(styles.match(/--bowed-shape: shape\(/g)).toHaveLength(1);
    const shaped = rules().filter((entry) => entry.declarations.some(([property]) => property === "--bowed-shape"));
    expect(shaped.map((entry) => entry.selector)).toEqual([".bowed, .bowed::before, .bowed::after, .bowed > .bowed-media, .bowed-clip"]);
    // Concave top and bottom edges, straight sides, superellipse-like corners.
    const shape = shaped[0].declarations.find(([property]) => property === "--bowed-shape")![1];
    expect(shape).toContain("curve to calc(100% - var(--rr)) 0 with 50% calc(var(--bow) * 4 / 3)");
    expect(shape).toContain("line to 100% calc(100% - var(--rr))");
    expect(shape).toContain("calc(var(--rr) * (1 - var(--k)))");
  });

  it("clips only dedicated fill, stroke and media layers so overhanging parts and focus rings stay visible", () => {
    const box = rule(".bowed");
    for (const declaration of ["position: relative", "isolation: isolate", "border: 0", "background: none !important"]) expect(box).toContain(declaration);
    expect(box).not.toContain("clip-path");
    expect(rule(".bowed::before")).toContain("background: var(--stroke)");
    const fill = rule(".bowed::after");
    for (const declaration of ["inset: var(--stroke-w)", "background: var(--fill)", "--rr: max(0px, min(var(--r), 50%) - var(--stroke-w))"]) expect(fill).toContain(declaration);
    expect(rule(".bowed > .bowed-media")).toContain("clip-path: var(--bowed-shape)");
    expect(rule(".bowed-clip")).toContain("background: var(--fill)");
    // Layers sit below every in-flow child without forcing a position onto the children.
    expect(styles).not.toMatch(/\.bowed > :not/);
    // Without shape() support the layers fall back to a clean rounded rectangle.
    const fallback = styles.slice(styles.indexOf("@supports not (clip-path: shape("));
    expect(rule(".bowed::before, .bowed > .bowed-media", fallback)).toContain("border-radius: var(--r)");
    expect(rule(".bowed::after", fallback)).toContain("border-radius: max(0px, var(--r) - var(--stroke-w))");
    // Nothing outside the primitive clips or masks a surface into shape.
    for (const entry of rules()) {
      if (isPrimitive(entry)) continue;
      for (const [property, value] of entry.declarations) {
        if (property === "clip-path") expect(value, `${entry.selector} clips itself`).toBe("inset(50%)");
        expect(property, `${entry.selector} shapes itself`).not.toMatch(/^(?:-webkit-)?mask|^corner-shape$/);
      }
    }
  });

  it("applies the primitive to every large card listed in the gap audit", () => {
    const surfaces = bowedSurfaces();
    for (const name of bowedCards) expect(surfaces.get(name), `${name} needs className "bowed"`).toBe("bowed");
    for (const name of clippedScrollers) expect(surfaces.get(name), `${name} needs className "bowed-clip"`).toBe("bowed-clip");
  });

  it("never gives a bowed surface its own background, border, radius or pseudo-element layers", () => {
    const surfaces = bowedSurfaces();
    for (const entry of rules()) {
      if (isPrimitive(entry)) continue;
      for (const selector of entry.selectors) {
        const subject = selector.split(/\s*[\s>+~]\s*(?![^(]*\))/).pop()!;
        const classes = [...subject.replace(/:not\([^)]*\)/g, "").matchAll(/\.([\w-]+)/g)].map(([, name]) => name);
        if (!classes.some((name) => surfaces.has(name))) continue;
        expect(subject, `${selector}: the primitive owns ::before/::after`).not.toMatch(/::?(?:before|after)\b/);
        if (subject.includes("::")) continue;
        for (const [property] of entry.declarations) {
          expect(property, `${selector} { ${property} } — set --fill/--stroke/--r instead`).not.toMatch(/^(?:background(?:-[\w-]+)?|border(?:-[\w-]+)?|box-shadow)$/);
        }
      }
    }
  });

  it("keeps the retired notch imitation and one-off radii out of the stylesheet", () => {
    expect(styles).not.toMatch(/border-radius: 0 0 50% 50%/);
    expect(styles).not.toMatch(/border-radius:[^;]*\//);
    const allowed = /^(?:var\(--radius-(?:control|small|card)\)|50%|0)$/;
    const cardRadius: string[] = [];
    for (const entry of rules()) {
      if (isPrimitive(entry)) continue;
      for (const [property, value] of entry.declarations) {
        if (!/^border(?:-[\w-]+)?-radius$/.test(property)) continue;
        for (const part of value.split(/\s+/)) expect(part, `${entry.selector} { ${property}: ${value} }`).toMatch(allowed);
        if (value.includes("--radius-card")) cardRadius.push(entry.selector);
      }
    }
    expect(cardRadius.filter((selector) => !legacyCardRadius.includes(selector)), "new rounded-rectangle card: use className \"bowed\"").toEqual([]);
  });
});

describe("responsive workflow safeguards", () => {
  const mobile = styles.slice(styles.indexOf("@media (max-width: 599px) {"));
  const singlePane = styles.slice(styles.indexOf("@media (max-width: 1023px) {"));

  it("only locks the main scroller while the permanent workspace is visible", () => {
    expect(rule(".new-design .main-content:has(> .today-screen:not([hidden]))")).toContain("overflow: hidden");
    expect(styles).not.toContain(".main-content:has(.design-workspace)");
    expect(rule("[hidden], .new-design [hidden]")).toContain("display: none !important");
    expect(rule(".design-workspace")).toContain("grid-template-rows: minmax(0, 1fr)");
    for (const selector of [".design-dashboard", ".design-detail", ".main-content"]) {
      expect(rule(selector)).toContain("overflow: auto");
      // Scroll panes contain their absolutely positioned visually-hidden text, so it cannot stretch the document.
      expect(rule(selector)).toContain("position: relative");
    }
    expect(rule(".sr-only, .calendar-event-date")).toContain("position: absolute");
  });

  it("aligns phone, rail and sidebar boundaries with detail focus behavior", () => {
    for (const breakpoint of ["@media (max-width: 599px)", "@media (min-width: 1024px)", "@media (max-width: 1023px)"]) expect(styles).toContain(breakpoint);
    expect(app).toContain('window.matchMedia?.("(min-width: 1024px)")');
    expect(rule(".profile-editor-shell .sidebar", styles.slice(styles.indexOf("@media (min-width: 1024px)")))).toContain("display: flex");
    expect(rule(".profile-editor-shell .navigation", mobile)).toContain("display: none");
    expect(rule(".profile-editor-actions, .profile-editor-actions > div", mobile)).toContain("flex-direction: column");
  });

  it("uses labeled bottom navigation with safe areas and toasts above it", () => {
    expect(rule(".navigation", mobile)).toContain("var(--safe-bottom)");
    expect(rule(".main-content", singlePane)).toContain("var(--safe-top)");
    expect(rule(".design-dashboard", singlePane)).toContain("var(--safe-left)");
    expect(rule(".content-shell", mobile)).toContain("grid-area: 1 / 1");
    expect(rule(".navigation .nav-word", mobile)).toContain("display: inline");
    expect(rule(".design-toast", singlePane)).toContain("grid-area: 1 / 1");
    expect(rule(".design-toast", singlePane)).toContain("bottom: var(--space-4)");
  });

  it("lets enlarged mobile labels set the navigation row height and matching content clearance", () => {
    expect(rule(".app-shell", mobile)).toContain("display: grid");
    expect(rule(".app-shell", mobile)).toContain("grid-template-rows: minmax(0, 1fr) auto");
    expect(rule(".sidebar", mobile)).toContain("display: contents");
    const navigation = rule(".navigation", mobile);
    for (const declaration of ["position: relative", "grid-area: 2 / 1", "height: auto", "min-height: calc(var(--mobile-nav-height) + var(--safe-bottom))"]) expect(navigation).toContain(declaration);
    expect(navigation).not.toMatch(/(?:^|;)\s*height:\s*calc/);
    const content = rule(".content-shell", mobile);
    expect(content).toContain("grid-area: 1 / 1");
    expect(content).toContain("height: 100%");
    expect(content).not.toContain("--mobile-nav-height");
    expect(rule(".navigation button", mobile)).toContain("min-width: 0");
    const label = rule(".navigation .nav-word", mobile);
    for (const declaration of ["overflow-wrap: anywhere", "word-break: normal", "white-space: normal"]) expect(label).toContain(declaration);
    expect(rule(".design-topbar-actions", mobile)).toContain("grid-column: 1 / -1");
  });

  it("removes the entire phone background from layout and focus when detail is selected", () => {
    expect(rule(".design-selected .design-dashboard", singlePane)).toContain("display: none");
    expect(rule(".design-selected .design-detail", singlePane)).toContain("display: block");
    expect(rule(".design-selected .design-detail", singlePane)).toContain("var(--safe-bottom)");
    expect(rule(".workbench, .wb-rail, .wb-main")).toContain("display: contents");
  });

  it("keeps narrow calendar targets inside a full-width grid rather than clipping their hit areas", () => {
    expect(rule(".calendar-day.has-events")).toContain("border: 0");
    expect(rule(".calendar-day-button")).toContain("min-height: 88px");
    const narrow = styles.slice(styles.indexOf("@media (max-width: 379px)"));
    expect(rule(".calendar-panel", narrow)).toContain("width: calc(100% + 48px)");
    expect(rule(".calendar-weekdays, .calendar-grid", narrow)).toContain("gap: 0");
  });

  it.each([360, 361, 379, 380])("retains at least 44px calendar columns at %ipx", (width) => {
    const breakpoint = styles.match(/@media \(max-width: (\d+)px\) \{\s*\.calendar-panel \{ width: calc\(100% \+ 48px\)/);
    expect(breakpoint).not.toBeNull();
    const edge = Number(styles.match(/--layout-edge: (\d+)px;/)![1]);
    const gap = Number(styles.match(/--space-1: (\d+)px;/)![1]);
    const column = width <= Number(breakpoint![1]) ? (width - 8) / 7 : (width - edge * 2 - gap * 6) / 7;
    expect(column).toBeGreaterThanOrEqual(44);
  });

  it("keeps the mobile profile editor safe-area inset and hides navigation while retaining desktop navigation", () => {
    expect(rule(".profile-editor-shell .design-dashboard", singlePane)).toContain("padding-top: calc(var(--safe-top) + var(--space-4))");
    expect(rule(".profile-editor-shell .design-dashboard", singlePane)).toContain("var(--safe-bottom)");
    expect(rule(".profile-editor-shell .navigation", mobile)).toContain("display: none");
    expect(rule(".profile-editor-shell .content-shell", singlePane)).toContain("height: 100%");
    const desktop = styles.slice(styles.indexOf("@media (min-width: 1024px)"), styles.lastIndexOf("@media (max-width: 1023px)"));
    expect(rule(".profile-editor-shell .navigation", desktop)).toContain("display: grid");
  });

  it("retains source 24px profile and settings card padding on phones", () => {
    for (const selector of [".profile-editor-section", ".settings-card"]) expect(rule(selector)).toContain("padding: var(--card-padding)");
    expect(mobile).not.toMatch(/\.(?:profile-editor-section|settings-card) \{ padding: var\(--space-4\)/);
  });

  it("wraps enlarged desktop sidebar text without shrinking controls or clipping their vertical content", () => {
    expect(rule(".sidebar")).toContain("overflow: auto");
    expect(rule(".sidebar > *")).toContain("flex-shrink: 0");
    expect(rule(".brand strong")).toContain("overflow-wrap: anywhere");
    expect(rule(".navigation button")).toContain("height: auto");
    expect(rule(".navigation button")).toContain("white-space: normal");
    expect(rule(".nav-word")).toContain("min-width: 0");
    expect(rule(".design-account > span:nth-child(2)")).toContain("overflow-wrap: anywhere");
  });

  it("preserves native top-layer dialogs with viewport-bounded internal overflow", () => {
    const dialog = rule(".station-dialog");
    expect(dialog).toContain("width: min(480px, calc(100% - 48px))");
    expect(dialog).toContain("max-height: calc(100svh - 48px - var(--safe-top) - var(--safe-bottom))");
    expect(dialog).toContain("overflow: auto");
    expect(rule(".station-dialog:not([open])")).toContain("display: none");
    expect(styles).not.toContain(".design-dialog-overlay");
    expect(app).not.toContain("scrollIntoView");
    expect(app).not.toContain('dialog.setAttribute("open"');
    expect(app).toContain("if (!dialog.open) dialog.showModal();");
  });

  it("promotes the permanent logger without hiding its ancestor or replacing its form", () => {
    expect(rule(".activity-logger:has(.station-dialog)")).toContain("display: contents");
    const inline = rule(".inline-logger");
    for (const declaration of ["position: static", "width: auto", "margin: 0", "padding: 0", "overflow: visible"]) expect(inline).toContain(declaration);
    expect(rule(".observation-fields, .observation-actions")).toContain("display: contents");
    expect(rule(".timeline-entry time")).toContain("grid-column: 2; grid-row: 2");
    expect(app.match(/id="batch-activity-form"/g)).toHaveLength(1);
    expect(app).not.toContain('key={editing?.id ?? "new"}');
    expect(app).toContain("else dialog.open = true;");
  });

  it("retains two-tone keyboard focus and motion-free readable content", () => {
    expect(rule(":focus-visible")).toContain("outline: var(--stroke-focus) solid var(--colour-text-inverse)");
    expect(rule(":focus-visible")).toContain("box-shadow: 0 0 0 calc(var(--stroke-focus) * 2) var(--colour-text)");
    expect(styles).not.toMatch(/outline: (?:none|0)|opacity: 0;|scrollIntoView/);
    expect(rule(".design-skip-link:focus")).toContain("var(--safe-top)");
    const reduced = styles.slice(styles.indexOf("@media (prefers-reduced-motion: reduce)"));
    for (const declaration of ["animation: none !important", "transition: none !important", "scroll-behavior: auto !important", "transform: none !important"]) expect(reduced).toContain(declaration);
  });
});

describe("installed appearance and provenance", () => {
  it("keeps artwork and credits available offline", () => {
    const config = read("../vite.config.ts");
    expect(config).toContain('"new-design/*"');
    expect(config).toContain('"**/*.{js,css,html,ico,png,svg,woff2}"');
    const credits = read("../public/new-design/README.md");
    expect(credits).toContain("unofficial reconstruction");
    expect(credits).toContain("Unique by Rajesh Rajput");
    for (const asset of ["kimchi", "kombucha", "sourdough", "kraut"]) {
      expect(readFileSync(new URL(`../public/new-design/${asset}.webp`, import.meta.url)).length).toBeGreaterThan(0);
      expect(credits).toContain(`${asset}.webp`);
    }
    for (const license of ["OFL.txt", "SofiaSansExtraCondensed-OFL.txt"]) expect(read(`../public/new-design/${license}`)).toContain("SIL OPEN FONT LICENSE Version 1.1");
    expect(app).toContain("Unique end-user license");
    expect(app).toContain("Not used by the current interface.");
  });

  it("reuses the unchanged real logo for the Android launch rather than the Capacitor placeholder", () => {
    expect(read("../capacitor.config.ts")).toContain('iconColor: "#1c1c1c"');
    const colors = read("../android/app/src/main/res/values/colors.xml");
    for (const value of ["#1c1c1c", "#b6f074", "#ffffff"]) expect(colors).toContain(value);
    const launch = read("../android/app/src/main/res/values/styles.xml");
    expect(launch).not.toContain("@drawable/splash");
    expect(launch).toContain("@drawable/station_launch_background");
    expect(launch).toContain("@drawable/station_launch_icon");
    expect(launch).toContain('name="postSplashScreenTheme">@style/AppTheme.NoActionBar');
    const original = readFileSync(new URL("../public/new-design/new_app_logo/FermentStation_Logo_Asset_Pack/transparent/logo-transparent-432.png", import.meta.url));
    expect(readFileSync(new URL("../android/app/src/main/res/drawable-nodpi/station_launch_logo.png", import.meta.url))).toEqual(original);
  });
});
