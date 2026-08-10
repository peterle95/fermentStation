export const destinations = [
  "today",
  "batches",
  "calendar",
  "profiles",
  "settings",
] as const;

export type Destination = (typeof destinations)[number];

export const defaultFormulaTerms = [
  "totalWeight",
  "water",
  "salt",
  "sugar",
  "tea",
] as const;

export type UnitSystem = "metric" | "imperial";

export interface ShellPreferences {
  units: UnitSystem;
  checkReminders: boolean;
  suggestions: boolean;
}

export interface ShellState extends ShellPreferences {
  destination: Destination;
  formulaTerms: string[];
}

export function createShellState(): ShellState {
  return {
    destination: "today",
    formulaTerms: [...defaultFormulaTerms],
    units: "metric",
    checkReminders: true,
    suggestions: true,
  };
}

export function selectDestination(
  state: ShellState,
  destination: Destination,
): ShellState {
  return state.destination === destination ? state : { ...state, destination };
}
