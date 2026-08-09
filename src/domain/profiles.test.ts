import { describe, expect, it } from "vitest";
import {
  addProfile,
  calculateProfileValue,
  createProfileState,
  deleteProfile,
  parseSimpleFormula,
  updateProfile,
  validateProfile,
} from "./profiles";

describe("fermentation profiles", () => {
  it("provides the five editable starter profiles", () => {
    const state = createProfileState();
    const original = state.profiles[0];
    const updated = updateProfile(state, { ...original, name: "Daily kombucha" });

    expect(state.profiles.map((profile) => profile.name)).toEqual([
      "Kombucha F1",
      "Kimchi",
      "Sauerkraut",
      "Milk kefir",
      "Sourdough starter",
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
      inputs: [],
      calculations: [],
      checks: [],
      phZones: [],
    });
    const updated = updateProfile(added, {
      ...added.profiles.at(-1)!,
      instructions: "Taste after 5 days.",
    });

    expect(state.profiles).toHaveLength(5);
    expect(added.profiles).toHaveLength(6);
    expect(updated.profiles.at(-1)?.instructions).toBe("Taste after 5 days.");
  });

  it("calculates compatible metric formulas, percentages, and parentheses", () => {
    const profile = {
      ...createProfileState().profiles[0],
      inputs: [{ name: "cabbage", unit: "kg" as const, defaultValue: 2 }],
      calculations: [{ name: "salt", unit: "g" as const, formula: "cabbage * (2% + 0.5%)" }],
    };

    expect(calculateProfileValue(profile, profile.calculations[0], {})).toBe(50);
    expect(calculateProfileValue(profile, profile.calculations[0], { cabbage: 1.25 })).toBe(31.25);
  });

  it("calculates structured recipe ratios across metric families", () => {
    const profile = {
      ...createProfileState().profiles[0],
      inputs: [
        { name: "totalWeight", unit: "kg" as const, defaultValue: 1 },
        { name: "water", unit: "l" as const, defaultValue: 1 },
      ],
      calculations: [
        { name: "salt", unit: "g" as const, formula: "totalWeight * 2%" },
        { name: "tea", unit: "g" as const, formula: "water / 200" },
        { name: "sugar", unit: "g" as const, formula: "water / 20" },
        { name: "starterLiquid", unit: "ml" as const, formula: "water * 0.01" },
      ],
    };

    expect(profile.calculations.map((calculation) => calculateProfileValue(profile, calculation, {})))
      .toEqual([20, 5, 50, 10]);
  });

  it.each([".5", "5.", "1e3"])("parses browser-valid operand %s", (operand) => {
    expect(parseSimpleFormula(`water * ${operand}`)?.operand).toBe(operand);
  });

  it("leaves missing calculations incomplete and rejects invalid values and units", () => {
    const profile = {
      ...createProfileState().profiles[0],
      inputs: [
        { name: "weight", unit: "kg" as const },
        { name: "water", unit: "l" as const },
      ],
      calculations: [{ name: "total", unit: "kg" as const, formula: "weight + water" }],
      expectedDurationDays: 0,
    };

    expect(calculateProfileValue(
      { ...profile, calculations: [{ name: "salt", unit: "kg", formula: "weight * 2%" }] },
      { name: "salt", unit: "kg", formula: "weight * 2%" },
      {},
    )).toBeNull();
    expect(() => calculateProfileValue(profile, { name: "salt", unit: "g", formula: "weight / 0" }, { weight: 1 }))
      .toThrow("Formula cannot divide by zero");
    expect(() => calculateProfileValue(profile, { name: "salt", unit: "g", formula: "weight - 1001" }, { weight: 1 }))
      .toThrow("Calculation cannot be negative");
    expect(validateProfile(profile)).toEqual([
      "Expected duration must be a positive whole number.",
      "total: Formula combines incompatible units",
    ]);
    expect(validateProfile({
      ...profile,
      expectedDurationDays: 7,
      inputs: [{ name: "weight", unit: "kg", defaultValue: -1 }],
      calculations: [{ name: "salt", unit: "kg", formula: "weight * 120%" }],
    })).toEqual([
      "weight cannot be negative.",
      "salt: Percentage must be between 0% and 100%",
    ]);
  });

  it("rejects overlapping pH zones", () => {
    const profile = {
      ...createProfileState().profiles[0],
      phZones: [
        { label: "safe" as const, min: 3, max: 4 },
        { label: "optimal" as const, min: 3.5, max: 3.8 },
      ],
    };

    expect(validateProfile(profile)).toContain("pH zones cannot overlap.");
  });

  it("allows empty checks and normalizes check names for uniqueness", () => {
    const base = createProfileState().profiles[0];
    expect(validateProfile({ ...base, checks: [] })).toEqual([]);
    expect(validateProfile({
      ...base,
      checks: [
        { name: " Taste ", intervalDays: 2 },
        { name: "taste", intervalDays: 3 },
      ],
    })).toContain("Check names must be present and unique.");
  });

  it("deletes a profile permanently", () => {
    const state = createProfileState();
    const deleted = deleteProfile(state, "starter-sauerkraut");

    expect(deleted.profiles.some(({ id }) => id === "starter-sauerkraut")).toBe(false);
    expect(deleted.profiles).toHaveLength(state.profiles.length - 1);
  });

  it("does not duplicate a profile that already exists when re-adding", () => {
    const state = createProfileState();
    const deleted = deleteProfile(state, "starter-sauerkraut");
    const readded = addProfile(deleted, state.profiles[2]);

    expect(readded.profiles.filter(({ id }) => id === "starter-sauerkraut")).toHaveLength(1);
  });
});
