import { describe, expect, it } from "vitest";
import { pwaManifest, shouldRegisterServiceWorker } from "./pwa";
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
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
    expect(pwaManifest.theme_color).toBe("#ffffff");
    expect(pwaManifest.background_color).toBe("#ffffff");
  });

  it("provides installable and maskable icons", () => {
    const icons = pwaManifest.icons ?? [];
    expect(icons.some((icon) => icon.sizes === "192x192" && icon.purpose === "any")).toBe(true);
    expect(icons.some((icon) => icon.sizes === "512x512" && icon.purpose === "any")).toBe(true);
    expect(icons.some((icon) => icon.sizes === "512x512" && icon.purpose === "maskable")).toBe(true);
  });

  it.each(["/", "/fermentStation/"])("ships real decodable and precached PNGs at base %s", (base) => {
    const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
    const config = readFileSync(new URL("../../vite.config.ts", import.meta.url), "utf8");
    const headIcons = [...html.matchAll(/<link rel="(?:icon|apple-touch-icon)"[^>]*href="([^"]+)"/g)].map(([, href]) => href.replace("%BASE_URL%", base));
    expect(headIcons).toHaveLength(2);
    const references = [...headIcons, ...pwaManifest.icons.map(({ src }) => src)];
    for (const reference of references) {
      const url = new URL(reference, `https://ferment.example${base}`);
      expect(url.pathname.startsWith(base)).toBe(true);
      const relative = url.pathname.slice(base.length);
      const bytes = readFileSync(new URL(`../../public/${relative}`, import.meta.url));
      expect(bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      expect(bytes.toString("ascii", 12, 16)).toBe("IHDR");
      const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
      expect(width).toBe(height);
      expect(width).toBe(relative === "favicon-64.png" ? 64 : relative === "apple-touch-icon.png" ? 180 : relative === "icon-192.png" ? 192 : 512);
      expect(bytes[24]).toBe(8);
      expect([2, 6]).toContain(bytes[25]);
      const chunks: Buffer[] = [];
      for (let offset = 8; offset < bytes.length;) {
        const length = bytes.readUInt32BE(offset);
        if (bytes.toString("ascii", offset + 4, offset + 8) === "IDAT") chunks.push(bytes.subarray(offset + 8, offset + 8 + length));
        offset += length + 12;
      }
      const stride = 1 + width * (bytes[25] === 6 ? 4 : 3);
      const decoded = inflateSync(Buffer.concat(chunks));
      expect(decoded.length).toBe(height * stride);
      for (let row = 0; row < height; row++) expect(decoded[row * stride]).toBeLessThanOrEqual(4);
      expect(bytes).toEqual(readFileSync(new URL(`../../public/new-design/new_app_logo/FermentStation_Logo_Asset_Pack/drop-in-assets/${relative}`, import.meta.url)));
      expect(config).toContain(`"${relative}"`);
    }
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
