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
      rail: "#3e3e40", "sheet-control": "#1b1b1b", row: "#f6f8fa", "switch-on": "#2089fd", "switch-off": "#eceef0",
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
    // The dialog sheet takes the measured sheet inset instead (see "sheet and field on black").
    for (const selector of [".batch-component-card", ".settings-card", ".profile-card", ".profile-editor-section"]) {
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
    ".batch-management > .wb-panel", ".batch-tools-danger", ".next-action", ".activity-logger", ".profile-overview-intro",
    ".start-batch-basics", ".start-profile-summary", ".profile-card-actions", ".profile-editor-card", ".upcoming-item",
  ];

  it("carries the measured outline in tokens and defines the shape exactly once", () => {
    for (const declaration of ["--bowed-radius: 52px;", "--bowed-bow: 4.4px;", "--bowed-k: 0.64;", "--bowed-stroke: 3px;"]) expect(styles).toContain(declaration);
    expect(styles.match(/--bowed-shape: shape\(/g)).toHaveLength(1);
    const shaped = rules().filter((entry) => entry.declarations.some(([property]) => property === "--bowed-shape"));
    expect(shaped.map((entry) => entry.selector)).toEqual([".bowed, .bowed::before, .bowed::after, .bowed > .bowed-media, .bowed-clip"]);
    // Concave top and bottom edges, straight sides, superellipse-like corners.
    const shape = shaped[0].declarations.find(([property]) => property === "--bowed-shape")![1];
    expect(shape).toContain("curve to calc(100% - var(--rr)) 0 with 50% calc(var(--bow) * 4 / 3)");
    expect(shape).toContain("line to 100% calc(100% - var(--rr-end))");
    // The bottom corners and edge can be tuned on their own (flat-bottomed phone sheet); by default they follow the top.
    expect(shape).toContain("curve to var(--rr-end) 100% with 50% calc(100% - var(--bow-end) * 4 / 3)");
    for (const declaration of ["--r-end: var(--r)", "--bow-end: var(--bow)"]) expect(rule(":where(.bowed, .bowed-clip)")).toContain(declaration);
    expect(shaped[0].declarations).toContainEqual(["--rr-end", "min(var(--r-end), 50%)"]);
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

describe("navigation circles, capsule and rail (swipe-rework-log.md, ticket 3; spec §1.4, §1.5)", () => {
  const mobile = styles.slice(styles.indexOf("@media (max-width: 599px) {"));
  const singlePane = styles.slice(styles.indexOf("@media (max-width: 1023px) {"));
  const railStart = styles.indexOf("@media (min-width: 600px) and (max-width: 1023px) {");
  const railEnd = railStart + styles.slice(railStart).search(/\n\}\r?\n/);
  const rail = styles.slice(railStart, railEnd);
  const px = (token: string) => Number(rootTokens().get(token)!.match(/^(\d+(?:\.\d+)?)px$/)![1]);

  it("carries the measured geometry and the ring colour in :root tokens", () => {
    for (const declaration of [
      "--nav-circle: 60px;", "--nav-gap: 6px;", "--nav-capsule: 107px;", "--nav-icon: 21px;", "--nav-ring: 6px;", "--nav-waist: 46px;",
      "--nav-rail: calc(var(--nav-circle) + 2 * var(--nav-ring));", "--colour-rail: #3e3e40;",
      "--mobile-nav-height: calc(var(--nav-circle) + 2 * var(--space-2));",
    ]) expect(rule(":root")).toContain(declaration);
    // Rail 72 (spec §1.4), the waist narrower than the rail, and a touch target in every circle.
    expect(px("--nav-circle") + 2 * px("--nav-ring")).toBe(72);
    expect(px("--nav-waist")).toBeLessThan(px("--nav-circle"));
    expect(px("--nav-circle")).toBeGreaterThanOrEqual(44);
  });

  it("takes every navigation length from tokens, never a literal", () => {
    const navigation = /\.navigation|\.nav-mark|\.nav-word|\.sidebar \.brand-mark|\.design-account|\.design-avatar/;
    for (const entry of rules()) {
      if (!entry.selectors.some((selector) => navigation.test(selector))) continue;
      for (const [property, value] of entry.declarations) expect(value, `${entry.selector} { ${property}: ${value} }`).not.toMatch(/\d(?:px|r?em)\b/);
    }
  });

  it("draws every destination as a white circle and the current one in lime at every width", () => {
    const mark = rule(".nav-mark");
    for (const declaration of ["width: var(--nav-circle)", "height: var(--nav-circle)", "border-radius: 50%", "background: var(--colour-background)"]) expect(mark).toContain(declaration);
    expect(rule('.navigation button[aria-current="page"]')).toContain("background: var(--colour-action)");
    expect(rule('.navigation button[aria-current="page"] .nav-mark')).toContain("background: none");
    expect(rule(".navigation")).toContain("gap: var(--nav-gap)");
    expect(rule(".navigation button")).toContain("min-height: var(--nav-circle)");
    for (const selector of [".sidebar .brand-mark", ".design-avatar"]) expect(rule(selector)).toContain("width: var(--nav-circle)");
    expect(rule(".navigation svg, .design-avatar svg")).toContain("width: var(--nav-icon)");
  });

  it("sets the phone row as bare circles beside one lime capsule, with no bar fill", () => {
    const navigation = rule(".navigation", mobile);
    for (const declaration of ["display: flex", "justify-content: center", "gap: var(--nav-gap)"]) expect(navigation).toContain(declaration);
    // Only the tablet rail paints behind the circles; no .navigation rule outside it has a fill.
    const fills = [...styles.matchAll(/(?:^|\n)\s*\.navigation \{([^}]+)\}/g)].filter(([, body]) => /background/.test(body));
    expect(fills.length).toBeGreaterThan(0);
    for (const fill of fills) expect(fill.index! > railStart && fill.index! < railEnd, fill[0]).toBe(true);
    const button = rule(".navigation button", mobile);
    for (const declaration of ["width: var(--nav-circle)", "min-height: var(--nav-circle)", "padding: 0"]) expect(button).toContain(declaration);
    const current = rule('.navigation button[aria-current="page"]', mobile);
    for (const declaration of ["width: auto", "min-width: var(--nav-capsule)"]) expect(current).toContain(declaration);
    expect(rule('.navigation button[aria-current="page"] .nav-mark', mobile)).toContain("width: var(--nav-icon)");
    expect(rule('.navigation button:not([aria-current="page"]) .nav-word', mobile)).toContain("display: none");
    // Three circles, the capsule and three gaps fit the narrowest supported phone (320) without side padding.
    expect(3 * px("--nav-circle") + px("--nav-capsule") + 3 * px("--nav-gap")).toBeLessThanOrEqual(320);
  });

  it("builds the tablet rail from ringed circles joined at the waist, and rings nothing else", () => {
    expect(railStart).toBeGreaterThan(-1);
    expect(rule(".app-shell", singlePane)).toContain("grid-template-columns: calc(var(--nav-rail) + 2 * var(--space-2))");
    expect(rule(".nav-mark, .sidebar .brand-mark, .design-avatar", rail)).toContain("box-shadow: 0 0 0 var(--nav-ring) var(--colour-rail)");
    for (const selector of [".navigation", ".brand"]) {
      const band = rule(selector, rail);
      expect(band).toContain("linear-gradient(var(--colour-rail), var(--colour-rail))");
      expect(band).toContain("var(--nav-waist)");
    }
    expect(rule(".navigation button", rail)).toContain("width: var(--nav-circle)");
    const outside = (styles.slice(0, railStart) + styles.slice(railEnd)).replace(/\/\*[\s\S]*?\*\//g, "").replace(/:root \{[^}]+\}/, "");
    expect(outside).not.toContain("--colour-rail");
  });

  it("keeps the two-tone focus ring outside the circles and the rail ring", () => {
    expect(rule(".navigation button:focus-visible, .design-account:focus-visible")).toContain("outline-offset: var(--stroke-focus)");
  });
});

/** Every icon-only button in App.tsx (only an svg or an icon component inside), as its opening tag. */
function iconOnlyButtons() {
  const tags: string[] = [];
  for (const match of app.matchAll(/<button\b/g)) {
    const chunk = app.slice(match.index, app.indexOf("</button>", match.index));
    // Blank out JSX expressions so the ">" of an arrow function cannot end the opening tag early.
    let depth = 0;
    let flat = "";
    for (const char of chunk) { if (char === "{") depth++; flat += depth ? " " : char; if (char === "}") depth--; }
    const open = flat.indexOf(">");
    const content = chunk.slice(open + 1).replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/<(?:DesignIcon|NavIcon|StationLogo)\b[^>]*\/>/g, "");
    if (!content.trim()) tags.push(chunk.slice(0, open + 1));
  }
  return tags;
}

function inkMembership() {
  const membership = new Map<string, string>();
  for (const group of inkGroups()) for (const selector of group.selectors) membership.set(selector, group.kind);
  return membership;
}

describe("utility circles and search field (swipe-rework-log.md, ticket 4; spec §1.4, §1.7, gaps 5 and 7)", () => {
  const px = (token: string): number => {
    const value = rootTokens().get(token)!;
    const alias = value.match(/^var\((--[\w-]+)\)$/);
    return alias ? px(alias[1]) : Number(value.match(/^(\d+(?:\.\d+)?)px$/)![1]);
  };
  const state = '.utility-circle:is(:hover:not(:disabled), [aria-pressed="true"], [aria-current="page"])';

  it("carries the measured circle, glyph and field geometry in :root tokens", () => {
    for (const declaration of [
      "--utility-circle: var(--nav-circle);", "--utility-circle-dark: 57px;", "--utility-stroke: 2;", "--utility-stroke-dark: 1.6;",
      "--search-height: 53px;", "--colour-sheet-control: #1b1b1b;", "--stroke-width: 1px;", "--nav-icon: 21px;",
    ]) expect(rule(":root")).toContain(declaration);
    expect(px("--utility-circle")).toBe(60);
    for (const token of ["--utility-circle", "--utility-circle-dark", "--search-height"]) expect(px(token)).toBeGreaterThanOrEqual(44);
  });

  it("defines the circle once: one geometry rule, one dark variant, one state rule, one glyph rule", () => {
    const circle = rule(".utility-circle");
    for (const declaration of [
      "width: var(--utility-d)", "height: var(--utility-d)", "min-height: var(--utility-d)", "padding: 0", "border: 0",
      "border-radius: 50%", "background: var(--utility-fill)", "justify-content: center", "align-items: center",
    ]) expect(circle).toContain(declaration);
    for (const declaration of ["--utility-d: var(--utility-circle)", "--utility-fill: var(--colour-background)", "--utility-glyph: var(--utility-stroke)"]) {
      expect(rule(":where(.utility-circle)")).toContain(declaration);
    }
    for (const declaration of ["--utility-d: var(--utility-circle-dark)", "--utility-fill: var(--colour-sheet-control)", "--utility-glyph: var(--utility-stroke-dark)"]) {
      expect(rule(".utility-circle-dark")).toContain(declaration);
    }
    expect(rule(state)).toContain("background: var(--colour-action)");
    const glyph = rule(".utility-circle svg");
    for (const declaration of ["width: var(--nav-icon)", "height: var(--nav-icon)", "stroke-width: calc(var(--utility-glyph) * 24 / 21)"]) expect(glyph).toContain(declaration);
    // Apart from these rules, utility-circle appears only in the ink lists; nothing else re-sizes or re-paints it.
    const definitions = rules().filter((entry) => /utility-(?:circle|capsule)/.test(entry.selector) && !entry.declarations.some(([property]) => property === "--ink"));
    expect(definitions.map((entry) => entry.selector).sort()).toEqual([".utility-circle", ".utility-circle svg", state, ".utility-circle-dark", ":where(.utility-circle)", ".utility-capsule"].sort());
    // The capsule stretches the same circle: height, fill, glyph and states come from .utility-circle.
    const capsule = rule(".utility-capsule");
    for (const declaration of ["min-width: var(--utility-d)", "padding-inline: calc((var(--utility-d) - var(--nav-icon)) / 2)", "border-radius: var(--radius-control)"]) expect(capsule).toContain(declaration);
    expect(capsule).not.toMatch(/height|background/);
    expect(styles.indexOf(".utility-capsule {")).toBeGreaterThan(styles.indexOf(".utility-circle {"));
    expect(styles).not.toMatch(/\.icon-button\b|\.batch-head-(?:camera|notifications)\b|\.calendar-nav button\b/);
    const geometry = /^(?:width|height|min-height|padding|border(?:-[\w-]+)?|background(?:-color)?)$/;
    for (const entry of rules()) {
      if (!entry.selectors.some((selector) => /\.(?:station-dialog-close|design-back|station-identity)\b/.test(selector))) continue;
      for (const [property] of entry.declarations) expect(property, `${entry.selector} re-styles a utility circle`).not.toMatch(geometry);
    }
  });

  it("makes every icon-only button in the app a utility circle, except the card and row actions of later tickets", () => {
    const tags = iconOnlyButtons();
    expect(tags.length).toBeGreaterThanOrEqual(16);
    // Check completion and the profile editor's remove-check button are card/row actions (gaps 9, 12).
    const later = /className="(?:design-check-complete|profile-editor-icon-button)"/;
    for (const tag of tags) if (!later.test(tag)) expect(tag).toMatch(/className="utility-circle(?: utility-circle-dark)?(?: [\w-]+)*"/);
    expect(app).not.toMatch(/["\s]icon-button\b/);
    // The notifications toggle keeps its visible state word, so it is the capsule form of the same primitive.
    const notifications = app.slice(app.indexOf('className="utility-circle utility-circle-dark utility-capsule batch-head-notifications"'));
    expect(notifications.slice(0, notifications.indexOf("</button>"))).toContain('<span>Notifications {batch.notificationsMuted ? "muted" : "on"}</span>');
  });

  it("paints white circles with ink, dark circles with white glyphs, and pressed or current circles lime with ink", () => {
    const membership = inkMembership();
    expect(membership.get(".utility-circle")).toBe("fill");
    expect(membership.get(".utility-circle-dark")).toBe("ground");
    expect(membership.get(state)).toBe("fill");
    expect(contrast(hex("--ink-fill"), hex("--colour-background"))).toBeGreaterThanOrEqual(7);
    expect(contrast(hex("--ink-ground"), hex("--colour-sheet-control"))).toBeGreaterThanOrEqual(7);
    expect(contrast(hex("--ink-fill"), hex("--colour-action"))).toBeGreaterThanOrEqual(7);
  });

  it("draws the search field as a black capsule with a lime outline and the sort circle beside it", () => {
    // The look lives in the shared field class (ticket 5); the search box wears it and only lays out its icon and input.
    const field = rule(".dark-field");
    for (const declaration of [
      "height: var(--search-height)", "border: var(--stroke-width) solid var(--colour-action)", "border-radius: var(--radius-control)", "background: var(--colour-surface-inverse)",
      "caret-color: var(--ink-accent)",
    ]) expect(field).toContain(declaration);
    expect(rule(".design-search-box")).not.toMatch(/height|border|background|caret/);
    const input = rule(".design-search-box input");
    for (const declaration of ["min-height: 0", "border: 0", "background: transparent"]) expect(input).toContain(declaration);
    // caret-color inherits from the field, so the wrapped input must not reset it.
    expect(input).not.toContain("caret-color");
    expect(rule(".design-search")).toContain("display: flex");
    expect(rule(".design-search")).not.toContain("flex-wrap: wrap");
    const membership = inkMembership();
    for (const selector of [".dark-field", ".design-search-box input"]) expect(membership.get(selector), selector).toBe("ground");
    expect(rule("input::placeholder, textarea::placeholder")).toContain("color: var(--ink-meta)");
    expect(contrast(hex("--ink-ground-meta"), hex("--colour-surface-inverse"))).toBeGreaterThanOrEqual(7);
    // Field first, then the sort circle, both inside .design-search; the input keeps its name and type.
    const search = app.slice(app.indexOf('<div className="design-search">'), app.indexOf('className="batch-view-switch"'));
    expect(search).toMatch(/<div className="dark-field design-search-box">.*<input aria-label="Search batches"[\s\S]*?type="search" value=\{query\} \/><\/div><button aria-label="Sort batches by finish date" aria-pressed=\{sorted\} className="utility-circle utility-circle-dark"/);
  });
});

describe("sheet and field on black (swipe-rework-log.md, ticket 5; spec §1.7, gap 8)", () => {
  const mobile = styles.slice(styles.indexOf("@media (max-width: 599px) {"), styles.indexOf("@media (max-width: 379px)"));
  const sheetRules = () => rules().filter((entry) => entry.selectors.some((selector) => /\.station-dialog(?![\w-])/.test(selector)) && !entry.declarations.some(([property]) => property === "--ink"));

  it("carries the measured sheet outline and inset in :root tokens", () => {
    for (const declaration of ["--sheet-radius: 40px;", "--sheet-bow: 5.7px;", "--sheet-inset: 21px;"]) expect(rule(":root")).toContain(declaration);
  });

  it("defines the sheet once: black, bowed from the sheet tokens, at the sheet inset", () => {
    const sheet = rule(".station-dialog");
    for (const declaration of ["--r: var(--sheet-radius)", "--bow: var(--sheet-bow)", "--fill: var(--colour-surface-inverse)", "padding: var(--sheet-inset)"]) expect(sheet).toContain(declaration);
    // No other rule re-shapes or re-paints the sheet; the phone rule only flattens its bottom.
    for (const entry of sheetRules()) {
      if (entry.selector === ".station-dialog") continue;
      for (const [property, value] of entry.declarations) {
        expect(property, `${entry.selector} re-shapes the sheet`).not.toMatch(/^--(?:r|bow|k|fill)$/);
        if (/^--(?:r|bow)-end$/.test(property)) expect(value).toBe("0px");
        if (/^(?:background|border|border-radius)$/.test(property)) expect([".station-dialog::backdrop", '.station-dialog .quick-log-types button[aria-pressed="true"]'], `${entry.selector} paints the sheet`).toContain(entry.selector);
      }
    }
    // Every dialog in the app is that sheet; the observation logger becomes it while it is modal.
    const dialogs = [...app.matchAll(/<dialog\b[^>]*className=(\{`[^`]*`\}|"[^"]*")/g)].map(([, className]) => className);
    expect(dialogs.length).toBeGreaterThanOrEqual(3);
    for (const className of dialogs) expect(className).toContain("station-dialog bowed-clip");
    expect(inkMembership().get(".station-dialog")).toBe("ground");
    expect(contrast(hex("--ink-ground"), hex("--colour-surface-inverse"))).toBeGreaterThanOrEqual(7);
  });

  it("anchors the phone sheet to the bottom edge with a bowed top and a flat bottom", () => {
    const phone = rule(".station-dialog", mobile);
    for (const declaration of ["--r-end: 0px", "--bow-end: 0px", "width: 100%", "margin: auto 0 0", "padding-bottom: calc(var(--sheet-inset) + var(--safe-bottom))"]) expect(phone).toContain(declaration);
    expect(phone).not.toMatch(/(?:^|;)\s*--(?:r|bow):/);
  });

  it("centres the title on the close circle's line and puts the dark circle at the sheet inset", () => {
    const heading = rule(".station-dialog-heading");
    for (const declaration of ["display: grid", "grid-template-columns: var(--utility-circle-dark) minmax(0, 1fr) var(--utility-circle-dark)", "align-items: center"]) expect(heading).toContain(declaration);
    expect(heading).not.toMatch(/background|border-radius|margin:|padding/);
    const title = rule(".station-dialog-heading > :first-child");
    for (const declaration of ["grid-column: 2", "text-align: center"]) expect(title).toContain(declaration);
    // Title ≈ 22 px (spec §1.7): the label role.
    const role = rules().find((entry) => entry.selectors.includes(".station-dialog-heading h2"))!;
    expect(role.declarations).toContainEqual(["font-size", "var(--type-label)"]);
    // Every sheet header ends in the dark utility circle.
    const headers = [...app.matchAll(/className="station-dialog-heading"/g)].map((match) => app.slice(match.index, app.indexOf("</button>", match.index)));
    expect(headers.length).toBeGreaterThanOrEqual(3);
    for (const header of headers) expect(header).toMatch(/<button aria-label="Close(?: dialog)?" className="utility-circle utility-circle-dark(?: [\w-]+)*"/);
  });

  it("uses one field definition for the search box and every control in a sheet", () => {
    const definitions = rules().filter((entry) => /dark-field/.test(entry.selector) && !entry.declarations.some(([property]) => property === "--ink"));
    expect(definitions.map((entry) => entry.selector).sort()).toEqual([".dark-field", '.dark-field:is(textarea, [type="file"])'].sort());
    expect(rule('.dark-field:is(textarea, [type="file"])')).not.toMatch(/border:|background|caret/);
    expect(inkMembership().get(".dark-field")).toBe("ground");
    // Start-batch controls live only in the sheet; the logger's controls wear the field while the logger is modal.
    const start = app.slice(app.indexOf("function StartBatchForm"), app.indexOf("</form>", app.indexOf("function StartBatchForm")));
    const startControls = [...start.matchAll(/<(?:input|select|textarea)\b[^>]*/g)].map(([tag]) => tag);
    expect(startControls.length).toBeGreaterThanOrEqual(4);
    for (const tag of startControls) expect(tag).toContain('className="dark-field"');
    expect(app).toContain('const sheetField = loggerModal ? "dark-field" : undefined;');
    const logger = app.slice(app.indexOf('id="batch-activity-form"'), app.indexOf("</form>", app.indexOf('id="batch-activity-form"')));
    const loggerControls = [...logger.matchAll(/<(?:input|select|textarea)\b[^>]*/g)].map(([tag]) => tag).filter((tag) => !tag.includes('name="kind"'));
    expect(loggerControls.length).toBeGreaterThanOrEqual(7);
    for (const tag of loggerControls) expect(tag).toContain("className={sheetField}");
    // Nothing else draws a field: no other rule paints the 1 px lime outline.
    for (const entry of rules()) {
      if (entry.selector === ".dark-field") continue;
      for (const [property, value] of entry.declarations) if (/^border/.test(property)) expect(value, entry.selector).not.toContain("var(--stroke-width) solid var(--colour-action)");
    }
  });

  it("keeps pastel boxes and pressed chips inside the sheet readable with ink", () => {
    const membership = inkMembership();
    for (const selector of [".profile-overview-intro", ".start-batch-basics", ".start-profile-summary", ".upcoming-batch-choice", '.station-dialog .quick-log-types button[aria-pressed="true"]']) {
      expect(membership.get(selector), selector).toBe("fill");
    }
    expect(rule('.station-dialog .quick-log-types button[aria-pressed="true"]')).toContain("background: var(--colour-action)");
  });
});

describe("settings toggle rows and switch (swipe-rework-log.md, ticket 7; spec §1.2, gap 10)", () => {
  const px = (token: string): number => {
    const value = rootTokens().get(token)!;
    const alias = value.match(/^var\((--[\w-]+)\)$/);
    return alias ? px(alias[1]) : Number(value.match(/^(\d+(?:\.\d+)?)px$/)![1]);
  };
  const state = '.toggle-row:is([aria-pressed="true"], [aria-checked="true"])';
  const isRoleRule = (entry: Rule) => entry.declarations.some(([property]) => property === "font-size");
  const toggleRules = () => rules().filter((entry) => /\.toggle-(?:list|row|avatar|label|switch)\b/.test(entry.selector)
    && !entry.declarations.some(([property]) => property === "--ink") && !isRoleRule(entry));

  it("carries the measured row and switch geometry and the three new colours in :root tokens", () => {
    expect(Object.fromEntries(["--toggle-row", "--toggle-gap", "--toggle-inset", "--toggle-avatar", "--toggle-label-gap", "--switch-width", "--switch-height", "--switch-knob", "--switch-inset"]
      .map((token) => [token, px(token)]))).toEqual({
      "--toggle-row": 72, "--toggle-gap": 8, "--toggle-inset": 16, "--toggle-avatar": 63, "--toggle-label-gap": 18,
      "--switch-width": 42, "--switch-height": 25, "--switch-knob": 20, "--switch-inset": 21,
    });
    for (const declaration of ["--colour-row: #f6f8fa;", "--colour-switch-on: #2089fd;", "--colour-switch-off: #eceef0;"]) expect(rule(":root")).toContain(declaration);
    // Every row is a full-height touch target, and the avatar and knob fit inside what holds them.
    expect(px("--toggle-row")).toBeGreaterThanOrEqual(44);
    expect(px("--toggle-avatar")).toBeLessThan(px("--toggle-row"));
    expect(px("--switch-knob")).toBeLessThan(px("--switch-height"));
  });

  it("defines the list, row, avatar and switch exactly once, from tokens only", () => {
    expect(toggleRules().map((entry) => entry.selector).sort()).toEqual([
      ".toggle-list", ".toggle-row", state, ".toggle-row:hover:not(:disabled)", ".toggle-row:has(> .toggle-avatar)", ".toggle-avatar", ".toggle-label",
      ".toggle-switch", ".toggle-switch::after", '[aria-checked="true"] > .toggle-switch', '[aria-checked="true"] > .toggle-switch::after',
    ].sort());
    for (const entry of toggleRules()) {
      for (const [property, value] of entry.declarations) expect(value, `${entry.selector} { ${property} } must use a token`).not.toMatch(/(?<![\w-])\d*\.?\d+(?:px|rem|em)\b/);
    }
    const list = rule(".toggle-list");
    for (const declaration of ["display: grid", "gap: var(--toggle-gap)", "margin-inline: calc(var(--toggle-inset) - var(--card-padding))"]) expect(list).toContain(declaration);
    const row = rule(".toggle-row");
    for (const declaration of [
      "--row-fill: var(--colour-row)", "min-height: var(--toggle-row)", "padding: 0 var(--switch-inset)", "gap: var(--toggle-label-gap)",
      "border: 0", "border-radius: var(--radius-control)", "background: var(--row-fill)", "align-items: center",
    ]) expect(row).toContain(declaration);
    expect(rule(state)).toContain("--row-fill: var(--colour-surface-inverse)");
    // The generic yellow button hover must not repaint a row (white text on a black row would vanish).
    expect(rule(".toggle-row:hover:not(:disabled)")).toContain("background: var(--row-fill)");
    expect(rule(".toggle-row:has(> .toggle-avatar)")).toContain("padding-inline-start: calc((var(--toggle-row) - var(--toggle-avatar)) / 2)");
    const avatar = rule(".toggle-avatar");
    for (const declaration of ["width: var(--toggle-avatar)", "height: var(--toggle-avatar)", "border-radius: 50%", "background: var(--colour-emblem)"]) expect(avatar).toContain(declaration);
    const track = rule(".toggle-switch");
    for (const declaration of ["width: var(--switch-width)", "height: var(--switch-height)", "border-radius: var(--radius-control)", "background: var(--colour-switch-off)", "margin-inline-start: auto"]) expect(track).toContain(declaration);
    const knob = rule(".toggle-switch::after");
    for (const declaration of ["width: var(--switch-knob)", "height: var(--switch-knob)", "border-radius: 50%", "background: var(--colour-background)", "top: calc((var(--switch-height) - var(--switch-knob)) / 2)"]) expect(knob).toContain(declaration);
    expect(rule('[aria-checked="true"] > .toggle-switch')).toContain("background: var(--colour-switch-on)");
    expect(rule('[aria-checked="true"] > .toggle-switch::after')).toContain("transform: translateX(calc(var(--switch-width) - var(--switch-height)))");
    // Rows use the row role; their colours come from the ink sets.
    const roleRule = rules().find((entry) => isRoleRule(entry) && entry.declarations.some(([, value]) => value === "var(--type-row)") && entry.selectors.includes(".toggle-row"));
    expect(roleRule, ".toggle-row must apply the row role").toBeDefined();
  });

  it("reads every row state and the switch at WCAG contrast, with the selected state carried by the black row", () => {
    const membership = inkMembership();
    expect(membership.get(".toggle-row")).toBe("fill");
    expect(membership.get(".toggle-avatar")).toBe("fill");
    expect(membership.get(state)).toBe("ground");
    expect(contrast(hex("--ink-fill"), hex("--colour-row"))).toBeGreaterThanOrEqual(7);
    expect(contrast(hex("--ink-ground"), hex("--colour-surface-inverse"))).toBeGreaterThanOrEqual(7);
    expect(contrast(hex("--ink-fill"), hex("--colour-emblem"))).toBeGreaterThanOrEqual(7);
    // Non-text contrast (3:1): the on track against the black row and the knob on the on track. The off track is
    // as pale as the board's (about 1.1:1 on the row), so the state is carried by the row fill and aria-checked.
    expect(contrast(hex("--colour-switch-on"), hex("--colour-surface-inverse"))).toBeGreaterThanOrEqual(3);
    expect(contrast(hex("--colour-background"), hex("--colour-switch-on"))).toBeGreaterThanOrEqual(3);
    expect(contrast(hex("--colour-row"), hex("--colour-surface-inverse"))).toBeGreaterThanOrEqual(3);
  });

  it("builds Settings choices from rows and the on/off preference from one real switch", () => {
    const settings = app.slice(app.indexOf("function SettingsView"), app.indexOf('className="settings-card bowed settings-storage"'));
    const rows = [...settings.matchAll(/<button\b[\s\S]*?type="button">/g)].map(([tag]) => tag).filter((tag) => tag.includes('className="toggle-row"'));
    expect(rows).toHaveLength(4); // °C / L, °F / qt, the Suggestions switch and the mapped notification row
    for (const tag of rows) expect(tag).toMatch(/aria-pressed=|role="switch"/);
    const switches = rows.filter((tag) => tag.includes('role="switch"'));
    expect(switches).toHaveLength(1);
    expect(switches[0]).toContain("aria-checked={preferences.suggestions}");
    expect(settings).toContain('<span className="toggle-label">Suggestions</span><span className="toggle-switch" />');
    for (const name of ["Units", "Notifications"]) expect(settings).toContain(`<div className="toggle-list" aria-label="${name}" role="group">`);
    expect(app).not.toMatch(/setting-segment|notification-segment|setting-trash-button/);
    expect(styles).not.toMatch(/setting-segment|notification-segment|setting-trash-button/);
    // Rows sit on the white toggle card.
    expect(rules().some((entry) => entry.selectors.includes(".settings-notifications") && entry.declarations.some(([property]) => property === "--fill"))).toBe(false);
  });

  it("draws a recently deleted batch as a row with Restore in the switch slot", () => {
    const own = rules().filter((entry) => entry.selector === ".trash-item" && !entry.declarations.some(([property]) => property === "--ink"));
    expect(own).toHaveLength(1);
    const item = own[0].declarations.map(([property, value]) => `${property}: ${value}`).join("; ");
    for (const declaration of ["min-height: var(--toggle-row)", "border-radius: var(--radius-control)", "background: var(--colour-row)"]) expect(item).toContain(declaration);
    expect(item).toContain("calc((var(--toggle-row) - var(--button-height)) / 2) var(--space-2) var(--switch-inset)");
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
