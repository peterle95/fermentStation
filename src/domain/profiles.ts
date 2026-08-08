export interface FermentationProfile {
  id: string;
  name: string;
  guidance: string;
  instructions: string;
  inputs: ProfileInput[];
  calculations: ProfileCalculation[];
  expectedDurationDays?: number;
}

export interface ProfileInput {
  name: string;
  unit: MetricUnit;
  defaultValue?: number;
}

export interface ProfileCalculation {
  name: string;
  unit: MetricUnit;
  formula: string;
}

export type MetricUnit = "g" | "kg" | "ml" | "l";

export interface TrashedProfile extends FermentationProfile {
  deletedAt: number;
}

export interface ProfileState {
  profiles: FermentationProfile[];
  trash: TrashedProfile[];
}

const recoveryPeriodMs = 7 * 24 * 60 * 60 * 1000;

const emptyProfileFields = { inputs: [], calculations: [] };

const starterProfiles: FermentationProfile[] = [
  {
    id: "starter-kombucha-f1",
    name: "Kombucha F1",
    guidance: "Keep at room temperature and cover with a breathable cloth.",
    instructions: "Taste after 7 days, then bottle when pleasantly tart.",
    ...emptyProfileFields,
  },
  {
    id: "starter-kombucha-f2",
    name: "Kombucha F2",
    guidance: "Use pressure-safe bottles and leave room for carbonation.",
    instructions: "Bottle strained kombucha with flavoring, then burp daily.",
    ...emptyProfileFields,
  },
  {
    id: "starter-sauerkraut",
    name: "Sauerkraut",
    guidance: "Use 2% salt by cabbage weight and keep cabbage below brine.",
    instructions: "Pack tightly, weight the cabbage, and taste after 7 days.",
    ...emptyProfileFields,
  },
  {
    id: "starter-anaerobic",
    name: "Anaerobic fermentation",
    guidance: "Keep ingredients submerged and the airlock filled.",
    instructions: "Check the seal and airlock daily during active fermentation.",
    ...emptyProfileFields,
  },
  {
    id: "starter-sourdough",
    name: "Sourdough",
    guidance: "Keep the starter loosely covered at room temperature.",
    instructions: "Feed equal weights flour and water; use when doubled and bubbly.",
    ...emptyProfileFields,
  },
];

export function createProfileState(): ProfileState {
  return { profiles: starterProfiles.map(cloneProfile), trash: [] };
}

export function cloneProfile(profile: FermentationProfile): FermentationProfile {
  return {
    ...profile,
    inputs: profile.inputs.map((input) => ({ ...input })),
    calculations: profile.calculations.map((calculation) => ({ ...calculation })),
  };
}

interface Quantity {
  value: number;
  family: "mass" | "volume" | "scalar";
}

const units: Record<MetricUnit, { family: Quantity["family"]; scale: number }> = {
  g: { family: "mass", scale: 1 },
  kg: { family: "mass", scale: 1000 },
  ml: { family: "volume", scale: 1 },
  l: { family: "volume", scale: 1000 },
};

export function calculateProfileValue(
  profile: FermentationProfile,
  calculation: ProfileCalculation,
  values: Record<string, number | undefined>,
): number | null {
  const variables = new Map(profile.inputs.map((input) => {
    const value = values[input.name] ?? input.defaultValue;
    const unit = units[input.unit];
    return [input.name, value === undefined ? null : {
      value: value * unit.scale, family: unit.family,
    }] as const;
  }));
  const result = evaluateFormula(calculation.formula, variables);
  if (!result) return null;
  const output = units[calculation.unit];
  if (result.family !== output.family) throw new Error("Calculation unit is incompatible with its formula");
  return result.value / output.scale;
}

export function validateProfile(profile: FermentationProfile): string[] {
  const errors: string[] = [];
  const names = new Set<string>();
  for (const input of profile.inputs) {
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(input.name) || names.has(input.name)) {
      errors.push(`Input name ${input.name || "(blank)"} must be unique and use letters, numbers, or underscores.`);
    }
    names.add(input.name);
    if (!units[input.unit]) errors.push(`${input.name} must use g, kg, ml, or l.`);
    if (input.defaultValue !== undefined && (!Number.isFinite(input.defaultValue) || input.defaultValue < 0)) errors.push(`${input.name} cannot be negative.`);
  }
  if (profile.expectedDurationDays !== undefined &&
      (!Number.isInteger(profile.expectedDurationDays) || profile.expectedDurationDays < 1)) {
    errors.push("Expected duration must be a positive whole number.");
  }
  const calculationNames = new Set<string>();
  for (const calculation of profile.calculations) {
    if (!calculation.name || calculationNames.has(calculation.name)) {
      errors.push("Calculation names must be present and unique.");
    }
    calculationNames.add(calculation.name);
    if (!units[calculation.unit]) {
      errors.push(`${calculation.name} must use g, kg, ml, or l.`);
      continue;
    }
    try {
      calculateProfileValue(
        profile,
        calculation,
        Object.fromEntries(profile.inputs.map((input) => [input.name, 1])),
      );
    } catch (error) {
      errors.push(`${calculation.name}: ${(error as Error).message}`);
    }
  }
  return errors;
}

function assertValidProfile(profile: FermentationProfile): void {
  const errors = validateProfile(profile);
  if (errors.length > 0) throw new Error(errors.join(" "));
}

function evaluateFormula(formula: string, variables: Map<string, Quantity | null>): Quantity | null {
  const tokens = formula.match(/\d+(?:\.\d+)?%?|[A-Za-z][A-Za-z0-9_]*|[()+\-*/]/g) ?? [];
  if (tokens.join("") !== formula.replace(/\s/g, "")) throw new Error("Formula contains unsupported syntax");
  let index = 0;
  const expression = (): Quantity | null => {
    let value = term();
    while (tokens[index] === "+" || tokens[index] === "-") {
      const operator = tokens[index++];
      const right = term();
      if (!value || !right) value = null;
      else {
        if (value.family !== right.family) throw new Error("Formula combines incompatible units");
        value = { ...value, value: operator === "+" ? value.value + right.value : value.value - right.value };
      }
    }
    return value;
  };
  const term = (): Quantity | null => {
    let value = factor();
    while (tokens[index] === "*" || tokens[index] === "/") {
      const operator = tokens[index++];
      const right = factor();
      if (!value || !right) value = null;
      else if (operator === "*") {
        if (value.family !== "scalar" && right.family !== "scalar") throw new Error("Formula cannot multiply two metric quantities");
        value = {
          value: value.value * right.value,
          family: value.family === "scalar" ? right.family : value.family,
        };
      } else {
        if (right.value === 0) throw new Error("Formula cannot divide by zero");
        if (right.family === "scalar") value = { ...value, value: value.value / right.value };
        else if (value.family === right.family) value = { value: value.value / right.value, family: "scalar" };
        else throw new Error("Formula divides incompatible units");
      }
    }
    return value;
  };
  const factor = (): Quantity | null => {
    const token = tokens[index++];
    if (token === "(") {
      const value = expression();
      if (tokens[index++] !== ")") throw new Error("Formula has unmatched parentheses");
      return value;
    }
    if (/^\d/.test(token ?? "")) {
      const percentage = token.endsWith("%");
      const value = Number(token.replace("%", ""));
      if (percentage && (value < 0 || value > 100)) throw new Error("Percentage must be between 0% and 100%");
      return { value: percentage ? value / 100 : value, family: "scalar" };
    }
    if (!variables.has(token)) throw new Error(`Unknown input ${token ?? "(missing)"}`);
    return variables.get(token) ?? null;
  };
  const result = expression();
  if (index !== tokens.length) throw new Error("Formula is invalid");
  if (result && result.value < 0) throw new Error("Calculation cannot be negative");
  return result;
}

export function addProfile(
  state: ProfileState,
  profile: FermentationProfile,
): ProfileState {
  assertValidProfile(profile);
  return { ...state, profiles: [...state.profiles, profile] };
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
  profiles[index] = profile;
  return { ...state, profiles };
}

export function deleteProfile(
  state: ProfileState,
  id: string,
  deletedAt: number,
): ProfileState {
  const current = discardExpiredProfiles(state, deletedAt);
  const profile = current.profiles.find((candidate) => candidate.id === id);

  if (!profile) {
    return current;
  }

  return {
    profiles: current.profiles.filter((candidate) => candidate.id !== id),
    trash: [...current.trash, { ...profile, deletedAt }],
  };
}

export function restoreProfile(
  state: ProfileState,
  id: string,
  now: number,
): ProfileState {
  const profile = state.trash.find((candidate) => candidate.id === id);

  if (!profile || now - profile.deletedAt >= recoveryPeriodMs) {
    return discardExpiredProfiles(state, now);
  }

  const { deletedAt: _deletedAt, ...restored } = profile;
  return {
    profiles: state.profiles.some((candidate) => candidate.id === id)
      ? state.profiles
      : [...state.profiles, restored],
    trash: state.trash.filter((candidate) => candidate.id !== id),
  };
}

export function discardExpiredProfiles(state: ProfileState, now: number): ProfileState {
  const trash = state.trash.filter(
    (profile) => now - profile.deletedAt < recoveryPeriodMs,
  );

  return trash.length === state.trash.length ? state : { ...state, trash };
}
