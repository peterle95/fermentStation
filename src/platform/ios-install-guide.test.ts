import { describe, expect, it } from "vitest";
import { shouldShowIosInstallGuide } from "./ios-install-guide";

describe("iOS install guide eligibility", () => {
  const iphone = {
    native: false, vendor: "Apple Computer, Inc.", userAgent: "iPhone",
    maxTouchPoints: 5, standalone: false, displayModeStandalone: false, dismissed: false,
  };

  it("shows for an iPhone tab and a desktop-UA iPad", () => {
    expect(shouldShowIosInstallGuide(iphone)).toBe(true);
    expect(shouldShowIosInstallGuide({ ...iphone, userAgent: "Macintosh", maxTouchPoints: 5 })).toBe(true);
  });

  it("hides for native, standalone, dismissed, Android and desktop browsers", () => {
    for (const override of [
      { native: true }, { standalone: true }, { displayModeStandalone: true },
      { dismissed: true }, { vendor: "Google Inc.", userAgent: "Android" },
      { userAgent: "Macintosh", maxTouchPoints: 0 }, { vendor: "Google Inc." },
    ]) expect(shouldShowIosInstallGuide({ ...iphone, ...override })).toBe(false);
  });
});
