export interface FermentationProfile {
  id: string;
  name: string;
  guidance: string[];
  inputs: ProfileInput[];
  calculations: ProfileCalculation[];
  checks: ProfileCheck[];
  phZones: PhZone[];
  temperatureMinC?: number;
  temperatureMaxC?: number;
  expectedDurationDays?: number;
}

export interface ProfileCheck {
  id?: string;
  name: string;
  intervalDays: number;
}

export interface PhZone {
  label: "danger" | "safe" | "optimal";
  min: number;
  max: number;
}

export interface ProfileInput {
  /** Display name, such as "Cabbage weight"; also the key for a batch's input values. */
  name: string;
  unit: MetricUnit;
}

/**
 * A fixed ratio: `amount` of `unit` for every `per` of the input's unit.
 * Supplied with starter profiles; users never author these.
 */
export interface ProfileCalculation {
  name: string;
  unit: MetricUnit;
  /** Name of the profile input this ratio is based on. */
  input: string;
  amount: number;
  per: number;
  /** Plain-language instruction; `{input}` is replaced by the entered amount, such as "1 kg". */
  instruction: string;
  /** Short explanation of the ratio, such as "2% of the cabbage weight". */
  reason: string;
}

export type MetricUnit = "g" | "kg" | "ml" | "l";

export const metricUnits: MetricUnit[] = ["g", "kg", "ml", "l"];
const units = new Set<string>(metricUnits);

export interface ProfileState {
  profiles: FermentationProfile[];
}

const emptyProfileFields = { inputs: [], calculations: [], checks: [], phZones: [] };

const starterProfiles: FermentationProfile[] = [
  {
    id: "starter-kombucha-f1",
    name: "Kombucha F1",
    guidance: [
      "Keep at room temperature and cover with a breathable cloth.",
      "Taste after 7 days, then bottle when pleasantly tart.",
    ],
    ...emptyProfileFields,
    inputs: [{ name: "Water volume", unit: "l" }],
    calculations: [
      {
        name: "Sugar", unit: "g", input: "Water volume", amount: 70, per: 1,
        instruction: "Dissolve it in your {input} of hot water.",
        reason: "70 g for each litre of water",
      },
      {
        name: "Tea", unit: "g", input: "Water volume", amount: 5, per: 1,
        instruction: "Steep it in your {input} of hot water, then take it out.",
        reason: "5 g for each litre of water",
      },
      {
        name: "Starter liquid", unit: "ml", input: "Water volume", amount: 100, per: 1,
        instruction: "Add it once your {input} of sweet tea has cooled.",
        reason: "100 ml for each litre of water",
      },
    ],
  },
  {
    id: "starter-kombucha-f2",
    name: "Kombucha F2",
    guidance: [
      "Bottle finished kombucha with fruit juice and close the bottles tightly.",
      "Open one bottle after 2 days to check the fizz, then refrigerate.",
    ],
    ...emptyProfileFields,
    inputs: [{ name: "Kombucha volume", unit: "l" }],
    calculations: [
      {
        name: "Fruit juice", unit: "ml", input: "Kombucha volume", amount: 100, per: 1,
        instruction: "Share it between the bottles for your {input} of kombucha.",
        reason: "10% of the kombucha volume",
      },
    ],
  },
  {
    id: "starter-kimchi",
    name: "Kimchi",
    guidance: [
      "Pack firmly so juice rises and leave headspace for gas.",
      "Ferment warm briefly, then move to the fridge when the pH reaches 4.2.",
    ],
    ...emptyProfileFields,
    inputs: [{ name: "Vegetable weight", unit: "kg" }],
    calculations: [
      {
        name: "Salt", unit: "g", input: "Vegetable weight", amount: 20, per: 1,
        instruction: "Mix it into your {input} of chopped vegetables.",
        reason: "2% of the vegetable weight",
      },
    ],
  },
  {
    id: "starter-sauerkraut",
    name: "Sauerkraut",
    guidance: [
      "Use 2% salt by cabbage weight and keep cabbage below brine.",
      "Pack tightly, weight the cabbage, and taste after 7 days.",
    ],
    ...emptyProfileFields,
    inputs: [{ name: "Cabbage weight", unit: "kg" }],
    calculations: [
      {
        name: "Salt", unit: "g", input: "Cabbage weight", amount: 20, per: 1,
        instruction: "Mix it into your {input} of shredded cabbage.",
        reason: "2% of the cabbage weight",
      },
    ],
  },
  {
    id: "starter-vegetable-brine",
    name: "Vegetables in brine",
    guidance: [
      "Pack the vegetables into a jar and pour the brine over them.",
      "Keep everything below the brine and taste after 5 days.",
    ],
    ...emptyProfileFields,
    inputs: [{ name: "Water volume", unit: "l" }],
    calculations: [
      {
        name: "Salt", unit: "g", input: "Water volume", amount: 30, per: 1,
        instruction: "Dissolve it in your {input} of water to make the brine.",
        reason: "3% of the water volume",
      },
    ],
  },
  {
    id: "starter-milk-kefir",
    name: "Milk kefir",
    guidance: [
      "Culture milk for 24 hours, then strain and restart the next jar.",
      "Keep the grains and refrigerate the strained kefir.",
    ],
    ...emptyProfileFields,
    inputs: [{ name: "Milk volume", unit: "l" }],
    calculations: [
      {
        name: "Kefir grains", unit: "g", input: "Milk volume", amount: 50, per: 1,
        instruction: "Add them to your {input} of milk.",
        reason: "50 g for each litre of milk",
      },
    ],
  },
  {
    id: "starter-sourdough",
    name: "Sourdough starter",
    guidance: [
      "Keep the starter loosely covered at room temperature.",
      "Feed equal weights flour and water; use when doubled and bubbly.",
    ],
    ...emptyProfileFields,
    inputs: [{ name: "Starter weight", unit: "g" }],
    calculations: [
      {
        name: "Flour", unit: "g", input: "Starter weight", amount: 1, per: 1,
        instruction: "Stir it into the {input} of starter you keep.",
        reason: "The same weight as the starter",
      },
      {
        name: "Water", unit: "g", input: "Starter weight", amount: 1, per: 1,
        instruction: "Stir it into the {input} of starter together with the flour.",
        reason: "The same weight as the starter",
      },
    ],
  },
];

export const starterProfileIds: readonly string[] = starterProfiles.map(({ id }) => id);

/**
 * Starter calculations are locked, so code is their source of truth: a stored starter profile keeps its editable
 * fields but always takes the current measurement and amounts. Other profiles are returned unchanged.
 */
export function withStarterAmounts(profile: FermentationProfile): FermentationProfile {
  const starter = starterProfiles.find(({ id }) => id === profile.id);
  if (!starter) return profile;
  const { inputs, calculations } = cloneProfile(starter);
  return { ...profile, inputs, calculations };
}

export function createProfileState(): ProfileState {
  return { profiles: starterProfiles.map(cloneProfile) };
}

export type ProfileRecord = Omit<FermentationProfile, "guidance"> & {
  guidance: string[] | string;
  instructions?: string;
};

export function normalizeProfile(profile: ProfileRecord): FermentationProfile {
  const { guidance: rawGuidance, instructions, ...details } = profile;
  const guidance = Array.isArray(rawGuidance)
    ? rawGuidance.filter((step) => step.trim())
    : [rawGuidance, instructions ?? ""].filter((step) => step.trim());
  return { ...details, guidance };
}

export function cloneProfile(profile: FermentationProfile): FermentationProfile {
  return {
    ...profile,
    guidance: [...profile.guidance],
    inputs: profile.inputs.map((input) => ({ ...input })),
    calculations: profile.calculations.map((calculation) => ({ ...calculation })),
    checks: normalizeProfileChecks(profile.checks, `profile-check-${profile.id}`),
    phZones: profile.phZones.map((zone) => ({ ...zone })),
  };
}

export function normalizeProfileChecks(checks: ProfileCheck[], prefix = "profile-check"): ProfileCheck[] {
  const ids = new Set<string>();
  return checks.map((check, index) => {
    const fallback = `${prefix}-${index}`;
    let id = check.id?.trim() || fallback;
    let suffix = 1;
    while (ids.has(id)) id = `${fallback}-${suffix++}`;
    ids.add(id);
    return { ...check, id, name: check.name.trim() };
  });
}

/** Formats an amount for reading: at most two decimals, no trailing zeros. */
export function formatAmount(value: number): string {
  return String(Number(value.toFixed(2)));
}

/** The amount a calculation suggests for an input value, or null while the input is empty. */
export function calculateProfileValue(
  calculation: ProfileCalculation,
  inputValue: number | undefined,
): number | null {
  if (inputValue === undefined || !Number.isFinite(inputValue)) return null;
  return inputValue * calculation.amount / calculation.per;
}

/** The input a calculation is based on. */
export function calculationInput(
  profile: FermentationProfile,
  calculation: ProfileCalculation,
): ProfileInput | undefined {
  return profile.inputs.find(({ name }) => name === calculation.input);
}

/** The instruction with the entered input filled in, such as "Mix it into your 1 kg of shredded cabbage." */
export function calculationInstruction(
  calculation: ProfileCalculation,
  input: ProfileInput,
  inputValue: number,
): string {
  return calculation.instruction.replaceAll("{input}", `${formatAmount(inputValue)} ${input.unit}`);
}

/**
 * The whole result as one sentence, for screen readers, such as
 * "20 g salt: mix it into your 1 kg of shredded cabbage (2% of the cabbage weight)."
 */
export function calculationSentence(
  calculation: ProfileCalculation,
  input: ProfileInput,
  inputValue: number,
  value: number,
): string {
  const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
  const instruction = lowerFirst(calculationInstruction(calculation, input, inputValue).trim().replace(/\.$/, ""));
  const reason = calculation.reason.trim() ? ` (${lowerFirst(calculation.reason.trim().replace(/\.$/, ""))})` : "";
  return `${formatAmount(value)} ${calculation.unit} ${calculation.name.toLowerCase()}: ${instruction}${reason}.`;
}

/** The prompt shown until the input is entered. */
export function calculationPrompt(calculation: ProfileCalculation, input: ProfileInput): string {
  return `Enter the ${input.name.toLowerCase()} to see how much ${calculation.name.toLowerCase()} to use.`;
}

/** A worked example of the ratio, such as "20 g for 1 kg". */
export function calculationExample(calculation: ProfileCalculation, input: ProfileInput): string {
  return `${formatAmount(calculation.amount)} ${calculation.unit} for ${formatAmount(calculation.per)} ${input.unit}`;
}

export function validateProfile(profile: FermentationProfile): string[] {
  const errors: string[] = [];
  const names = new Set<string>();
  for (const input of profile.inputs) {
    if (!input.name.trim() || names.has(input.name)) {
      errors.push("Input names must be present and unique.");
    }
    names.add(input.name);
    if (!units.has(input.unit)) errors.push(`${input.name} must use g, kg, ml, or l.`);
  }
  if (profile.expectedDurationDays !== undefined &&
      (!Number.isInteger(profile.expectedDurationDays) || profile.expectedDurationDays < 1)) {
    errors.push("Expected duration must be a positive whole number.");
  }
  const { temperatureMinC: temperatureMin, temperatureMaxC: temperatureMax } = profile;
  if ((temperatureMin === undefined) !== (temperatureMax === undefined) ||
      (temperatureMin !== undefined &&
       (!Number.isFinite(temperatureMin) || !Number.isFinite(temperatureMax) ||
        temperatureMin < 0 || temperatureMin > 100 || temperatureMax! < 0 || temperatureMax! > 100 ||
        temperatureMin > temperatureMax!))) {
    errors.push("Temperature range must include both values between 0 and 100°C, with the minimum no greater than the maximum.");
  }
  const calculationNames = new Set<string>();
  const usedInputs = new Set<string>();
  for (const calculation of profile.calculations) {
    if (!calculation.name.trim() || calculationNames.has(calculation.name)) {
      errors.push("Calculation names must be present and unique.");
    }
    calculationNames.add(calculation.name);
    usedInputs.add(calculation.input);
    if (!units.has(calculation.unit)) errors.push(`${calculation.name} must use g, kg, ml, or l.`);
    if (!names.has(calculation.input)) errors.push(`${calculation.name} is based on a missing input.`);
    if (!(Number.isFinite(calculation.amount) && calculation.amount > 0 &&
          Number.isFinite(calculation.per) && calculation.per > 0)) {
      errors.push(`${calculation.name} must use a positive ratio.`);
    }
    if (!calculation.instruction.trim()) errors.push(`${calculation.name} needs an instruction.`);
  }
  for (const input of profile.inputs) {
    if (!usedInputs.has(input.name)) errors.push(`${input.name} is not used by any calculation.`);
  }
  const checkNames = new Set<string>();
  for (const check of profile.checks) {
    const normalizedName = check.name.trim().toLowerCase();
    if (!normalizedName || checkNames.has(normalizedName)) {
      errors.push("Check names must be present and unique.");
    }
    checkNames.add(normalizedName);
    if (!Number.isInteger(check.intervalDays) || check.intervalDays < 1) {
      errors.push(`${check.name || "Check"} interval must be a positive whole number.`);
    }
  }
  const sortedZones = [...profile.phZones].sort((left, right) => left.min - right.min);
  for (let index = 0; index < sortedZones.length; index += 1) {
    const zone = sortedZones[index];
    if (!["danger", "safe", "optimal"].includes(zone.label)) {
      errors.push("pH zone labels must be danger, safe, or optimal.");
    }
    if (zone.min < 0 || zone.max > 14 || zone.min > zone.max) {
      errors.push(`${zone.label} pH zone must be between 0 and 14.`);
    }
    if (index > 0 && sortedZones[index - 1].max >= zone.min) {
      errors.push("pH zones cannot overlap.");
    }
  }
  return errors;
}

function assertValidProfile(profile: FermentationProfile): void {
  const errors = validateProfile(profile);
  if (errors.length > 0) throw new Error(errors.join(" "));
}

export function addProfile(
  state: ProfileState,
  profile: FermentationProfile,
): ProfileState {
  assertValidProfile(profile);
  return {
    ...state,
    profiles: [...state.profiles, { ...profile, checks: normalizeProfileChecks(profile.checks, `profile-check-${profile.id}`) }],
  };
}

export function updateProfile(
  state: ProfileState,
  profile: FermentationProfile,
): ProfileState {
  assertValidProfile(profile);
  const index = state.profiles.findIndex(({ id }) => id === profile.id);

  if (index === -1) {
    return state;
  }

  const profiles = [...state.profiles];
  profiles[index] = { ...profile, checks: normalizeProfileChecks(profile.checks, `profile-check-${profile.id}`) };
  return { ...state, profiles };
}

export function deleteProfile(
  state: ProfileState,
  id: string,
): ProfileState {
  return { ...state, profiles: state.profiles.filter((candidate) => candidate.id !== id) };
}

/** Re-adds deleted starter profiles with their original values; never replaces a profile that still exists. */
export function restoreStarterProfiles(state: ProfileState): { state: ProfileState; restored: string[] } {
  const existing = new Set(state.profiles.map(({ id }) => id));
  const missing = starterProfiles.filter(({ id }) => !existing.has(id)).map(cloneProfile);
  return {
    state: missing.length ? { ...state, profiles: [...state.profiles, ...missing] } : state,
    restored: missing.map(({ name }) => name),
  };
}

/** A copy of a profile under a new id; a copied starter profile keeps its calculations. */
export function duplicateProfile(profile: FermentationProfile, id: string, name: string): FermentationProfile {
  return { ...cloneProfile(profile), id, name };
}
