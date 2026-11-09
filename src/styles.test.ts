import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

describe("mobile safe-area layout", () => {
  it("insets shared mobile content below the system status bar", () => {
    expect(styles).toMatch(
      /@media \(max-width: 839px\) \{[\s\S]*?\.main-content \{\s*padding: calc\(var\(--safe-top\) \+ 0\.25rem\) calc\(1rem \+ var\(--safe-right\)\) 2rem calc\(1rem \+ var\(--safe-left\)\);/,
    );
  });

  it("keeps the mobile profile editor below the system status bar", () => {
    expect(styles).toMatch(
      /@media \(max-width: 960px\) \{[\s\S]*?\.profile-editor-shell \.main-content \{ padding: var\(--safe-top\) 1rem 6rem; \}/,
    );
    expect(styles).toMatch(
      /@media \(max-width: 620px\) \{[\s\S]*?\.profile-editor-shell \.main-content \{ padding: var\(--safe-top\) 0\.75rem 7rem; \}/,
    );
  });

  it("keeps a batch status on the right after its ID is omitted", () => {
    expect(styles).toMatch(
      /\.summary-heading \.status,\s*\.batches-screen \.bc-top \.status \{\s*margin-left: auto;\s*\}/,
    );
  });
});

describe("reference-led responsive shell", () => {
  it("limits the Unique-inspired display face to static prominent headings after responsive overrides", () => {
    expect(styles).toMatch(/@font-face \{\s*font-family: "Sofia Sans Extra Condensed";\s*src: url\("\/new-design\/SofiaSansExtraCondensed\.ttf"\) format\("truetype"\);\s*font-weight: 1 1000;\s*font-style: normal;\s*font-display: swap;/);
    const display = styles.slice(styles.indexOf("/* Unique-inspired display headings;"));
    expect(styles.indexOf(display)).toBeGreaterThan(styles.lastIndexOf("@media"));
    expect(display).toContain(".new-design.app-shell :is(.design-topbar-copy > div, .design-view-heading h1, .screen-head h1, .design-section-head h1, .design-section-head h2) {");
    expect(display).toContain('font-family: "Sofia Sans Extra Condensed", Outfit, Arial, sans-serif;');
    expect(display).toContain("font-weight: 500;");
    expect(display).toContain("letter-spacing: normal;");
    expect(display).toContain("line-height: 1.1;");
    expect(display).toContain(".new-design.app-shell .design-section-head :is(h1, h2) { font-size: 28px; }");
    expect(display).not.toMatch(/text-transform|transform:|station-dialog|profile-editor-title-input|design-batch-copy/);
  });

  it("retains Outfit for functional text, user-authored titles, dialog typography and heading counts", () => {
    expect(styles).toContain("font: 400 15px/1.4 Outfit, Arial, sans-serif;");
    expect(styles).toContain(".new-design.app-shell * { font-family: Outfit, Arial, sans-serif; }");
    expect(styles).toContain(".new-design.app-shell .content-shell * { font-family: inherit; }");
    expect(styles).toMatch(/\.new-design \.station-dialog \{[^}]*font: 400 15px\/1\.4 Outfit, Arial, sans-serif;/);
    expect(styles).toContain(".new-design.app-shell .design-section-head h1 span { font-family: Outfit, Arial, sans-serif; }");
  });

  it("keeps phone toasts above navigation without moving desktop toasts", () => {
    const mobile = styles.slice(styles.indexOf("@media (max-width: 900px) {"));
    expect(styles).toMatch(/\.design-toast \{[^}]*bottom: 26px;/);
    expect(mobile).toMatch(/\.design-toast \{[^}]*bottom: calc\(105px \+ var\(--safe-bottom\)\);/);
  });

  it("keeps a promoted logger out of inline layout without a hidden modal ancestor", () => {
    expect(styles).toContain(".new-design .activity-logger:has(.station-dialog) { display: contents; }");
    expect(styles).toMatch(/\.new-design \.batch-workspace \.timeline-entry time \{[^}]*grid-column: 3;[^}]*grid-row: 1;/);
  });

  it("uses readable unselected Settings labels on the mint segment background", () => {
    expect(styles).toMatch(/\.new-design \.setting-segment button \{[^}]*color: #58654f;/);
  });

  it("keeps compact native dialogs in the top layer with internal viewport-bounded overflow", () => {
    expect(styles).toMatch(/\.new-design \.station-dialog \{[^}]*width: min\(420px, calc\(100% - 32px\)\);[^}]*max-height: calc\(100svh - 40px\);[^}]*overflow: auto;/);
    expect(styles).toContain(".station-dialog::backdrop { background: #122e244d; backdrop-filter: blur(4px); }");
    expect(styles).toContain(".station-dialog:not([open]) { display: none; }");
    expect(styles).not.toContain(".design-dialog-overlay");
    expect(styles).toContain(".new-design button.design-snapshot");
    const app = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
    expect(app).not.toContain("scrollIntoView");
    expect(app).not.toContain('dialog.setAttribute("open"');
    expect(app).toContain("if (!dialog.open) dialog.showModal();");
  });

  it("keeps the observation logger static inline and reuses the reference modal form tokens", () => {
    expect(styles).toMatch(/\.new-design \.inline-logger \{[^}]*position: static;[^}]*width: auto;[^}]*margin: 0;[^}]*padding: 0;/);
    expect(styles).toContain(".observation-fields, .observation-actions { display: contents; }");
    const app = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
    expect(app.match(/id="batch-activity-form"/g)).toHaveLength(1);
    expect(app).not.toContain('key={editing?.id ?? "new"}');
    expect(app).toContain('else dialog.open = true;');
  });

  it("replaces the phone Settings shortcut with one station-information button", () => {
    const mobile = styles.slice(styles.indexOf("@media (max-width: 900px) {"));
    expect(styles).toContain(".new-design .navigation .design-mobile-info { display: none; }");
    expect(mobile).toContain(".new-design .navigation :is(.nav-batches, .nav-settings) { display: none; }");
    expect(mobile).toContain(".new-design .navigation .design-mobile-info { display: grid; order: 4; }");
    expect(mobile).toContain(".new-design .brand, .new-design .design-sidebar-bottom { display: none; }");
  });

  it("only locks the main scroller while its workspace is visible", () => {
    expect(styles).toContain(".new-design .main-content:has(> .today-screen:not([hidden])) { padding: 0; overflow: hidden; }");
    expect(styles).not.toContain(".main-content:has(.design-workspace)");
    expect(styles).toContain(".new-design [hidden] { display: none !important; }");
  });

  it("lets component and editor button colors override the inherited default", () => {
    expect(styles).toContain(":where(.new-design) button { color: inherit; }");
    expect(styles).not.toContain(".new-design button { cursor: pointer; color: inherit; }");
  });

  it("keeps the profile editor sidebar in its desktop grid column above 900px", () => {
    const desktop = styles.slice(styles.indexOf("@media (min-width: 901px) {"), styles.indexOf("@media (min-width: 901px) and (max-width: 1250px) {"));
    expect(desktop).toContain(".new-design.profile-editor-shell .sidebar { display: flex; }");
    expect(desktop).toContain(".new-design.profile-editor-shell .navigation { display: grid; }");
    expect(styles).toMatch(/@media \(max-width: 900px\) \{[\s\S]*?\.new-design\.profile-editor-shell \.navigation \{ display: none; \}/);
  });

  it("hides the whole phone list rather than leaving its controls focusable behind detail", () => {
    expect(styles).toContain(".design-selected .design-topbar, .design-selected .design-dashboard { display: none; }");
    expect(styles).toContain(".new-design.has-open-batch .navigation { display: none; }");
    expect(styles).toMatch(/grid-template-columns: minmax\(0, 1fr\) 337px/);
  });

  it("bundles the reference font, photographs and licenses for offline installs", () => {
    expect(styles).toContain('src: url("/new-design/Outfit.ttf")');
    const displayFont = readFileSync(new URL("../public/new-design/SofiaSansExtraCondensed.ttf", import.meta.url));
    expect(displayFont.readUInt32BE(0)).toBe(0x00010000);
    const displayLicense = readFileSync(new URL("../public/new-design/SofiaSansExtraCondensed-OFL.txt", import.meta.url), "utf8");
    expect(displayLicense).toContain("Copyright 2019 The Sofia Sans Project Authors");
    expect(displayLicense).toContain("SIL OPEN FONT LICENSE Version 1.1");
    expect(displayLicense).toContain("DISCLAIMER");
    const config = readFileSync(new URL("../vite.config.ts", import.meta.url), "utf8");
    expect(config).toContain('"new-design/*"');
    const license = readFileSync(new URL("../public/new-design/OFL.txt", import.meta.url), "utf8");
    expect(license).toContain("SIL OPEN FONT LICENSE Version 1.1");
    expect(license).toContain("DISCLAIMER");
    const credits = readFileSync(new URL("../public/new-design/README.md", import.meta.url), "utf8");
    expect(credits).toContain("Unique-inspired Sofia Sans Extra Condensed");
    expect(credits).toContain("SofiaSansExtraCondensed-OFL.txt");
    for (const asset of ["kimchi", "kombucha", "sourdough", "kraut"]) {
      expect(readFileSync(new URL(`../public/new-design/${asset}.webp`, import.meta.url)).length).toBeGreaterThan(0);
      expect(credits).toContain(`${asset}.webp`);
    }
  });
});
