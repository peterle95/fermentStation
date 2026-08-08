import { describe, expect, it } from "vitest";
import {
  addProfile,
  createProfileState,
  deleteProfile,
  discardExpiredProfiles,
  restoreProfile,
  updateProfile,
} from "./profiles";

const day = 24 * 60 * 60 * 1000;

describe("fermentation profiles", () => {
  it("provides the five editable starter profiles", () => {
    const state = createProfileState();
    const original = state.profiles[0];
    const updated = updateProfile(state, { ...original, name: "Daily kombucha" });

    expect(state.profiles.map((profile) => profile.name)).toEqual([
      "Kombucha F1",
      "Kombucha F2",
      "Sauerkraut",
      "Anaerobic fermentation",
      "Sourdough",
    ]);
    expect(updated.profiles[0].name).toBe("Daily kombucha");
  });

  it("creates and updates a profile without mutating prior state", () => {
    const state = createProfileState();
    const added = addProfile(state, {
      id: "kimchi",
      name: "Kimchi",
      guidance: "Keep below brine.",
      instructions: "Taste weekly.",
    });
    const updated = updateProfile(added, {
      ...added.profiles.at(-1)!,
      instructions: "Taste after 5 days.",
    });

    expect(state.profiles).toHaveLength(5);
    expect(added.profiles).toHaveLength(6);
    expect(updated.profiles.at(-1)?.instructions).toBe("Taste after 5 days.");
  });

  it("restores a deleted profile during the seven-day recovery period", () => {
    const state = createProfileState();
    const deleted = deleteProfile(state, "starter-sauerkraut", 100 * day);
    const restored = restoreProfile(deleted, "starter-sauerkraut", 106 * day);

    expect(deleted.profiles.some(({ id }) => id === "starter-sauerkraut")).toBe(false);
    expect(restored.profiles.some(({ id }) => id === "starter-sauerkraut")).toBe(true);
    expect(restored.trash).toHaveLength(0);
  });

  it("permanently discards profiles after seven days", () => {
    const deleted = deleteProfile(createProfileState(), "starter-sauerkraut", 100 * day);
    const expired = discardExpiredProfiles(deleted, 107 * day);
    const restored = restoreProfile(deleted, "starter-sauerkraut", 107 * day);

    expect(restored.profiles.some(({ id }) => id === "starter-sauerkraut")).toBe(false);
    expect(restored.trash).toHaveLength(0);
    expect(expired.trash).toHaveLength(0);
  });

  it("cleans expired trash when another profile is deleted", () => {
    const deleted = deleteProfile(createProfileState(), "starter-sauerkraut", 100 * day);
    const laterDeleted = deleteProfile(deleted, "starter-sourdough", 107 * day);

    expect(laterDeleted.trash.map(({ id }) => id)).toEqual(["starter-sourdough"]);
  });

  it("does not duplicate a profile that already exists when restoring", () => {
    const state = createProfileState();
    const deleted = deleteProfile(state, "starter-sauerkraut", 100 * day);
    const readded = addProfile(deleted, state.profiles[2]);
    const restored = restoreProfile(readded, "starter-sauerkraut", 106 * day);

    expect(restored.profiles.filter(({ id }) => id === "starter-sauerkraut")).toHaveLength(1);
    expect(restored.trash).toHaveLength(0);
  });
});
