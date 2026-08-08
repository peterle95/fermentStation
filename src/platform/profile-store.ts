import { type ProfileState } from "../domain/profiles";

export interface ProfileStore {
  load(): ProfileState | null;
  save(state: ProfileState): void;
}

interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const storageKey = "fermentstation.profiles";

function isProfile(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  const profile = value as Record<string, unknown>;
  return ["id", "name", "guidance", "instructions"].every(
    (key) => typeof profile[key] === "string",
  );
}

function isProfileState(value: unknown): value is ProfileState {
  if (!value || typeof value !== "object") {
    return false;
  }

  const state = value as { profiles?: unknown; trash?: unknown };
  return (
    Array.isArray(state.profiles) &&
    state.profiles.every(isProfile) &&
    Array.isArray(state.trash) &&
    state.trash.every(
      (profile) =>
        isProfile(profile) &&
        typeof (profile as { deletedAt?: unknown }).deletedAt === "number",
    )
  );
}

export function createProfileStore(storage: KeyValueStore): ProfileStore {
  return {
    load() {
      try {
        const value = storage.getItem(storageKey);
        if (!value) {
          return null;
        }

        const state: unknown = JSON.parse(value);
        return isProfileState(state) ? state : null;
      } catch {
        return null;
      }
    },
    save(state) {
      try {
        storage.setItem(storageKey, JSON.stringify(state));
      } catch {
        // Profile management remains usable when persistent storage is blocked.
      }
    },
  };
}

export const browserProfileStore: ProfileStore = {
  load() {
    try {
      return createProfileStore(window.localStorage).load();
    } catch {
      return null;
    }
  },
  save(state) {
    try {
      createProfileStore(window.localStorage).save(state);
    } catch {
      // Profile management remains usable when persistent storage is blocked.
    }
  },
};
