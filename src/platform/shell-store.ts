import { defaultFormulaTerms, destinations, type ShellPreferences, type ShellState } from "../domain/shell";

export interface ShellStore {
  load(): ShellState | null;
  save(state: ShellState): void;
}

interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const storageKey = "fermentstation.shell";

export function parseShellState(value: unknown): ShellState | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const { destination, formulaTerms, units, checkReminders, suggestions } = value as {
    destination?: unknown;
    formulaTerms?: unknown;
    units?: unknown;
    checkReminders?: unknown;
    suggestions?: unknown;
  };

  if (!destinations.some((validDestination) => validDestination === destination)) {
    return null;
  }
  if (formulaTerms !== undefined && (!Array.isArray(formulaTerms) || formulaTerms.length === 0 ||
      formulaTerms.some((term) => typeof term !== "string" || !/^[A-Za-z][A-Za-z0-9_]*$/.test(term)) ||
      new Set(formulaTerms).size !== formulaTerms.length)) {
    return null;
  }
  if (units !== undefined && units !== "metric" && units !== "imperial") return null;
  if (checkReminders !== undefined && typeof checkReminders !== "boolean") return null;
  if (suggestions !== undefined && typeof suggestions !== "boolean") return null;

  const preferences: ShellPreferences = {
    units: units ?? "metric",
    checkReminders: checkReminders ?? true,
    suggestions: suggestions ?? true,
  };
  return {
    destination: destination as ShellState["destination"],
    formulaTerms: formulaTerms ?? [...defaultFormulaTerms],
    ...preferences,
  };
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
        return parseShellState(state);
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
