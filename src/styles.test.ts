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

describe("Swipe-derived design contract", () => {
  it("uses one shared six-color palette, including lilac, with no competing legacy colors", () => {
    const palette = ["#ffffff", "#1c1c1c", "#ffec89", "#b6f074", "#dab8f1", "#b6e1fa"];
    expect(styles.match(/:root \{/g)).toHaveLength(1);
    expect([...new Set(styles.match(/#[\da-f]{6}\b/gi))].sort()).toEqual([...palette].sort());
    for (const [name, value] of Object.entries({ background: "#ffffff", surface: "#ffec89", text: "#1c1c1c", "text-muted": "#1c1c1c", action: "#b6f074", "action-alt": "#dab8f1", accent: "#b6e1fa" })) {
      expect(styles).toContain(`--colour-${name}: ${value};`);
    }
    expect(styles).not.toMatch(/oklch\(|linear-gradient\(|--bg:|--accent:/);
    for (const layer of ["editor", "component"]) {
      const definitions = [...styles.matchAll(new RegExp(`--${layer}-[\\w-]+: ([^;]+);`, "g"))];
      expect(definitions.length).toBeGreaterThan(5);
      expect(definitions.every(([, value]) => /^var\(--colour-[\w-]+\)$/.test(value))).toBe(true);
    }
    const visuals = app.slice(app.indexOf("function profileVisual"), app.indexOf("function BatchPhoto"));
    expect(visuals).not.toMatch(/#[\da-f]{3,8}/i);
    for (const color of ["surface", "action", "action-alt", "accent"]) expect(visuals).toContain(`var(--colour-${color})`);
  });

  it("uses genuine offline Unique throughout with readable relative sizing and no synthesis", () => {
    expect(styles).toContain('--font-family: "Unique", system-ui, sans-serif;');
    for (const declaration of [
      "--type-body: 1.75rem;", "--type-small: 1.5rem;", "font-synthesis: none;",
    ]) expect(styles).toContain(declaration);
    expect(styles.match(/@font-face/g)).toHaveLength(7);
    expect(styles).not.toMatch(/Circular Std|Outfit|Sofia|Georgia|text-transform: uppercase/);
    expect(read("../index.html")).not.toMatch(/rel="preload"[^>]+\.ttf/);
    expect(rule(".station-dialog")).toContain("var(--font-family)");
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
    expect(rule("input, select, textarea")).toContain("font-size: var(--type-body)");
    expect(rule("textarea")).toContain("border-radius: var(--radius-small)");
    for (const selector of [".profile-card-main", ".profile-editor-section", ".batch-component-card", ".settings-card, .trash", ".station-dialog"]) {
      expect(rule(selector)).toContain("var(--radius-card)");
      expect(rule(selector)).toContain("var(--card-padding)");
    }
  });

  it("renews card anatomy and presents real statuses instead of a decorative progress gauge", () => {
    expect(rule(".design-batch-card")).toContain("grid-template-columns:");
    expect(rule(".design-batch-card.selected")).toContain("background: var(--colour-surface-inverse)");
    expect(rule(".design-batch-photo img")).toContain("object-fit: contain");
    expect(app).toContain('className="design-batch-profile"');
    expect(app).toContain('className="design-batch-next"');
    expect(app).not.toContain('strokeDasharray={`${batches.length ? 76');
    expect(app).toContain("{dueChecks.length} checks due");
    expect(app.replaceAll("©", "")).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(rule(".primary-action, .station-primary, .profile-add, .component-button-primary, .profile-editor-button.primary")).toContain("color: var(--colour-on-action)");
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
    for (const selector of [".design-dashboard", ".design-detail", ".main-content"]) expect(rule(selector)).toContain("overflow: auto");
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
    for (const selector of [".profile-editor-section", ".settings-card, .trash"]) expect(rule(selector)).toContain("padding: var(--card-padding)");
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

});
