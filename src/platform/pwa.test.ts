import { describe, expect, it } from "vitest";
import { pwaManifest, shouldRegisterServiceWorker } from "./pwa";

describe("PWA install metadata", () => {
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
