export const destinations = [
  "today",
  "batches",
  "calendar",
  "profiles",
  "settings",
] as const;

export type Destination = (typeof destinations)[number];

export type UnitSystem = "metric" | "imperial";
export const notificationModes = ["all", "checks", "ready", "off"] as const;
export type NotificationMode = (typeof notificationModes)[number];

export interface ShellPreferences {
  units: UnitSystem;
  notificationMode: NotificationMode;
  suggestions: boolean;
}

export interface ShellState extends ShellPreferences {
  destination: Destination;
}

export function createShellState(): ShellState {
  return {
    destination: "today",
    units: "metric",
    notificationMode: "off",
    suggestions: true,
  };
}

export function selectDestination(
  state: ShellState,
  destination: Destination,
): ShellState {
  return state.destination === destination ? state : { ...state, destination };
}
