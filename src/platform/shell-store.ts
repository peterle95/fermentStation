import { destinations, type ShellState } from "../domain/shell";

export interface ShellStore {
  load(): ShellState | null;
  save(state: ShellState): void;
}

interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const storageKey = "fermentstation.shell";

function isShellState(value: unknown): value is ShellState {
  if (!value || typeof value !== "object") {
    return false;
  }

  const { destination } = value as { destination?: unknown };

  return destinations.some((validDestination) => validDestination === destination);
}

export function createShellStore(storage: KeyValueStore): ShellStore {
  return {
    load() {
      try {
        const value = storage.getItem(storageKey);

        if (!value) {
          return null;
        }

        const state: unknown = JSON.parse(value);
        return isShellState(state) ? state : null;
      } catch {
        return null;
      }
    },
    save(state) {
      try {
        storage.setItem(storageKey, JSON.stringify(state));
      } catch {
        // The shell remains usable when a WebView blocks persistent storage.
      }
    },
  };
}

export const browserShellStore: ShellStore = {
  load() {
    try {
      return createShellStore(window.localStorage).load();
    } catch {
      return null;
    }
  },
  save(state) {
    try {
      createShellStore(window.localStorage).save(state);
    } catch {
      // The shell remains usable when a WebView blocks persistent storage.
    }
  },
};
