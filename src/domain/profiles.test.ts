import { describe, expect, it } from "vitest";
import {
  addProfile,
  calculateProfileValue,
  calculationExample,
  calculationInput,
  calculationInstruction,
  calculationPrompt,
  calculationSentence,
  createProfileState,
  deleteProfile,
  duplicateProfile,
  formatAmount,
  restoreStarterProfiles,
  starterProfileIds,
  updateProfile,
  validateProfile,
  type FermentationProfile,
} from "./profiles";

function starter(id: string): FermentationProfile {
  return createProfileState().profiles.find((profile) => profile.id === id)!;
}

describe("fermentation profiles", () => {
  it("provides the seven starter profiles", () => {
    const state = createProfileState();
    const original = state.profiles[0];
    const updated = updateProfile(state, { ...original, name: "Daily kombucha" });

    expect(state.profiles.map((profile) => profile.name)).toEqual([
      "Kombucha F1",
      "Kombucha F2",
      "Kimchi",
      "Sauerkraut",
      "Vegetables in brine",
      "Milk kefir",
      "Sourdough starter",
    ]);
    expect(starterProfileIds).toEqual(state.profiles.map(({ id }) => id));
    expect(updated.profiles[0].name).toBe("Daily kombucha");
  });

  it("creates and updates a profile without mutating prior state", () => {
    const state = createProfileState();
    const added = addProfile(state, {
      id: "kimchi",
      name: "Kimchi",
      guidance: ["Keep below brine.", "Taste weekly."],
      inputs: [],
      calculations: [],
      checks: [],
      phZones: [],
    });
    const updated = updateProfile(added, {
      ...added.profiles.at(-1)!,
      guidance: ["Keep below brine.", "Taste after 5 days."],
    });

    expect(state.profiles).toHaveLength(7);
    expect(added.profiles).toHaveLength(8);
    expect(updated.profiles.at(-1)?.guidance).toEqual(["Keep below brine.", "Taste after 5 days."]);
  });

  it("ships only valid fixed calculations with every starter profile", () => {
    for (const profile of createProfileState().profiles) {
      expect(validateProfile(profile), profile.name).toEqual([]);
      expect(profile.calculations.length, profile.name).toBeGreaterThan(0);
    }
  });

  it("works out an amount from a fixed ratio", () => {
    const [salt] = starter("starter-sauerkraut").calculations;
    const [sugar] = starter("starter-kombucha-f1").calculations;

    expect(calculateProfileValue(salt, 1)).toBe(20);
    expect(calculateProfileValue(salt, 1.25)).toBe(25);
    expect(calculateProfileValue(sugar, 2)).toBe(140);
    expect(calculateProfileValue(salt, 0)).toBe(0);
    expect(calculateProfileValue(salt, undefined)).toBeNull();
    expect(calculateProfileValue(salt, Number.NaN)).toBeNull();
  });

  it("formats amounts with at most two decimals", () => {
    expect(formatAmount(20)).toBe("20");
    expect(formatAmount(31.25)).toBe("31.25");
    expect(formatAmount(1 / 3)).toBe("0.33");
    expect(formatAmount(0.1 + 0.2)).toBe("0.3");
  });

  it("writes plain-language instructions with the measured input filled in", () => {
    const profile = starter("starter-sauerkraut");
    const [salt] = profile.calculations;
    const input = calculationInput(profile, salt)!;

    expect(input).toEqual({ name: "Cabbage weight", unit: "kg" });
    expect(calculationInstruction(salt, input, 1.5)).toBe("Mix it into your 1.5 kg of shredded cabbage.");
    expect(calculationSentence(salt, input, 1.5, 30))
      .toBe("30 g salt: mix it into your 1.5 kg of shredded cabbage (2% of the cabbage weight).");
    expect(calculationPrompt(salt, input)).toBe("Enter the cabbage weight to see how much salt to use.");
    expect(calculationExample(salt, input)).toBe("20 g for 1 kg");
  });

  it("rejects calculations that are not usable fixed ratios", () => {
    const base = starter("starter-sauerkraut");
    const [salt] = base.calculations;

    expect(validateProfile({ ...base, calculations: [{ ...salt, input: "Water volume" }] })).toEqual([
      "Salt is based on a missing input.",
      "Cabbage weight is not used by any calculation.",
    ]);
    expect(validateProfile({ ...base, calculations: [{ ...salt, amount: 0 }] }))
      .toEqual(["Salt must use a positive ratio."]);
    expect(validateProfile({ ...base, calculations: [{ ...salt, per: Number.NaN }] }))
      .toEqual(["Salt must use a positive ratio."]);
    expect(validateProfile({ ...base, calculations: [{ ...salt, instruction: " " }] }))
      .toEqual(["Salt needs an instruction."]);
    expect(validateProfile({ ...base, calculations: [salt, salt] }))
      .toEqual(["Calculation names must be present and unique."]);
    expect(validateProfile({ ...base, expectedDurationDays: 0 }))
      .toEqual(["Expected duration must be a positive whole number."]);
  });

  it("allows a custom profile without inputs or calculations", () => {
    expect(validateProfile({
      id: "custom",
      name: "Ginger bug",
      guidance: ["Feed daily."],
      inputs: [],
      calculations: [],
      checks: [],
      phZones: [],
    })).toEqual([]);
  });

  it("duplicates a profile with its calculations under a new id", () => {
    const original = starter("starter-kimchi");
    const copy = duplicateProfile(original, "copy-1", "Kimchi copy");

    expect(copy).toMatchObject({ id: "copy-1", name: "Kimchi copy", calculations: original.calculations });
    expect(copy.calculations).not.toBe(original.calculations);
    expect(copy.calculations[0]).not.toBe(original.calculations[0]);
  });

  it("restores missing starter profiles without replacing existing ones", () => {
    const state = createProfileState();
    const renamed = updateProfile(state, { ...starter("starter-kimchi"), name: "My kimchi" });
    const trimmed = deleteProfile(deleteProfile(renamed, "starter-sauerkraut"), "starter-sourdough");
    const { state: restored, restored: names } = restoreStarterProfiles(trimmed);

    expect(names).toEqual(["Sauerkraut", "Sourdough starter"]);
    expect(restored.profiles).toHaveLength(7);
    expect(restored.profiles.find(({ id }) => id === "starter-kimchi")?.name).toBe("My kimchi");
    expect(restored.profiles.find(({ id }) => id === "starter-sauerkraut")).toEqual(starter("starter-sauerkraut"));

    const again = restoreStarterProfiles(restored);
    expect(again.restored).toEqual([]);
    expect(again.state).toBe(restored);
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

  it("validates optional temperature ranges", () => {
    const base = createProfileState().profiles[0];

    expect(validateProfile({ ...base, temperatureMinC: 18, temperatureMaxC: 28 })).toEqual([]);
    expect(validateProfile({ ...base, temperatureMinC: 28 }).some((error) => error.startsWith("Temperature range"))).toBe(true);
    expect(validateProfile({ ...base, temperatureMinC: 28, temperatureMaxC: 18 }).some((error) => error.startsWith("Temperature range"))).toBe(true);
    expect(validateProfile({ ...base, temperatureMinC: -1, temperatureMaxC: 18 }).some((error) => error.startsWith("Temperature range"))).toBe(true);
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
    const readded = addProfile(deleted, starter("starter-sauerkraut"));

    expect(readded.profiles.filter(({ id }) => id === "starter-sauerkraut")).toHaveLength(1);
  });
});
