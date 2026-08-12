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
  },
  {
    id: "starter-kimchi",
    name: "Kimchi",
    guidance: [
      "Pack firmly so juice rises and leave headspace for gas.",
      "Ferment warm briefly, then move to the fridge when the pH reaches 4.2.",
    ],
    ...emptyProfileFields,
  },
  {
    id: "starter-sauerkraut",
    name: "Sauerkraut",
    guidance: [
      "Use 2% salt by cabbage weight and keep cabbage below brine.",
      "Pack tightly, weight the cabbage, and taste after 7 days.",
    ],
    ...emptyProfileFields,
  },
  {
    id: "starter-milk-kefir",
    name: "Milk kefir",
    guidance: [
      "Culture milk for 24 hours, then strain and restart the next jar.",
      "Keep the grains and refrigerate the strained kefir.",
    ],
    ...emptyProfileFields,
  },
  {
    id: "starter-sourdough",
    name: "Sourdough starter",
    guidance: [
      "Keep the starter loosely covered at room temperature.",
      "Feed equal weights flour and water; use when doubled and bubbly.",
    ],
    ...emptyProfileFields,
  },
];

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

export function parseSimpleFormula(formula: string): {
  source: string;
  operator: "+" | "-" | "*" | "/";
  operand: string;
  percentage: boolean;
} | null {
  const match = formula.match(/^([A-Za-z][A-Za-z0-9_]*)\s*([+\-*/])\s*((?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+\-]?\d+)?)(%)?$/);
  return match ? {
    source: match[1],
    operator: match[2] as "+" | "-" | "*" | "/",
    operand: match[3],
    percentage: Boolean(match[4]),
  } : null;
}

export function calculateProfileValue(
  profile: FermentationProfile,
  calculation: ProfileCalculation,
  values: Record<string, number | undefined>,
): number | null {
  const simple = parseSimpleFormula(calculation.formula);
  if (simple) {
    const input = profile.inputs.find(({ name }) => name === simple.source);
    if (!input) throw new Error(`Unknown input ${simple.source}`);
    const value = values[input.name] ?? input.defaultValue;
    if (value === undefined) return null;
    let operand = Number(simple.operand);
    if (simple.percentage) {
      if (operand > 100) throw new Error("Percentage must be between 0% and 100%");
      operand /= 100;
    }
    if (simple.operator === "/" && operand === 0) throw new Error("Formula cannot divide by zero");
    const source = value * units[input.unit].scale;
    const result = simple.operator === "+" ? source + operand
      : simple.operator === "-" ? source - operand
      : simple.operator === "*" ? source * operand
      : source / operand;
    if (result < 0) throw new Error("Calculation cannot be negative");
    return result / units[calculation.unit].scale;
  }
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
  const { temperatureMinC: temperatureMin, temperatureMaxC: temperatureMax } = profile;
  if ((temperatureMin === undefined) !== (temperatureMax === undefined) ||
      (temperatureMin !== undefined &&
       (!Number.isFinite(temperatureMin) || !Number.isFinite(temperatureMax) ||
        temperatureMin < 0 || temperatureMin > 100 || temperatureMax! < 0 || temperatureMax! > 100 ||
        temperatureMin > temperatureMax!))) {
    errors.push("Temperature range must include both values between 0 and 100°C, with the minimum no greater than the maximum.");
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
