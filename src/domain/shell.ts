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

export interface ShellState {
  destination: Destination;
  formulaTerms: string[];
}

export function createShellState(): ShellState {
  return { destination: "today", formulaTerms: [...defaultFormulaTerms] };
}

export function selectDestination(
  state: ShellState,
  destination: Destination,
): ShellState {
  return state.destination === destination ? state : { ...state, destination };
}
