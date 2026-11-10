import { describe, expect, it } from "vitest";
import { pwaManifest, shouldRegisterServiceWorker } from "./pwa";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

describe("PWA install metadata", () => {
  it("packages original Unique faces and their EULA for offline use without external font requests", () => {
    const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
    const config = readFileSync(new URL("../../vite.config.ts", import.meta.url), "utf8");
    const audit = JSON.parse(readFileSync(new URL("../../docs/design/unique-font-audit.json", import.meta.url), "utf8"));
    expect(audit.faces.map((face: { weight: number }) => face.weight).sort((a: number, b: number) => a - b)).toEqual([100, 200, 300, 400, 500, 600, 700]);
    for (const face of audit.faces) {
      const bytes = readFileSync(new URL(`../../public/fonts/unique/${face.file}`, import.meta.url));
      expect(bytes.toString("ascii", 0, 4)).toBe("wOF2");
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(face.sha256);
      expect(styles).toContain(`/fonts/unique/${face.file}`);
    }
    expect(styles).toContain('--font-family: "Unique", system-ui, sans-serif;');
    expect(config).toContain('"fonts/unique/*"');
    expect(config).not.toMatch(/fonts\.googleapis|fonts\.gstatic/);
    expect(readFileSync(new URL("../../public/fonts/unique/License.pdf", import.meta.url)).subarray(0, 4).toString()).toBe("%PDF");
  });

  it("uses relative scope for Pages subpath installs", () => {
    expect(pwaManifest.name).toBe("FermentStation");
    expect(pwaManifest.short_name).toBe("Ferment");
    expect(pwaManifest.id).toBe("./");
    expect(pwaManifest.start_url).toBe("./");
    expect(pwaManifest.scope).toBe("./");
    expect(pwaManifest.display).toBe("standalone");
  });

  it("matches the app theme and launch background", () => {
    expect(pwaManifest.theme_color).toBe("#f3f3e9");
    expect(pwaManifest.background_color).toBe("#f3f3e9");
  });

  it("provides installable and maskable icons", () => {
    const icons = pwaManifest.icons ?? [];
    expect(icons.some((icon) => icon.sizes === "192x192" && icon.purpose === "any")).toBe(true);
    expect(icons.some((icon) => icon.sizes === "512x512" && icon.purpose === "any")).toBe(true);
    expect(icons.some((icon) => icon.sizes === "512x512" && icon.purpose === "maskable")).toBe(true);
  });
});

describe("service worker registration", () => {
  it("skips registration on native builds", () => {
    expect(shouldRegisterServiceWorker({ native: true })).toBe(false);
  });

  it("registers on web builds", () => {
    expect(shouldRegisterServiceWorker({ native: false })).toBe(true);
  });
});
