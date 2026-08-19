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
