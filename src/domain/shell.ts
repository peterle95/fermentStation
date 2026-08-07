export const destinations = [
  "today",
  "batches",
  "calendar",
  "profiles",
  "settings",
] as const;

export type Destination = (typeof destinations)[number];

export interface ShellState {
  destination: Destination;
}

export function createShellState(): ShellState {
  return { destination: "today" };
}

export function selectDestination(
  state: ShellState,
  destination: Destination,
): ShellState {
  return state.destination === destination ? state : { destination };
}
