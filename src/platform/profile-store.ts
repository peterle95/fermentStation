import { type FermentationProfile, type ProfileState } from "../domain/profiles";

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
  const inputs = profile.inputs ?? [];
  const calculations = profile.calculations ?? [];
  const checks = profile.checks ?? [];
  return ["id", "name", "guidance", "instructions"].every(
    (key) => typeof profile[key] === "string",
  ) && Array.isArray(inputs) && inputs.every((input) => {
    if (!input || typeof input !== "object") return false;
    const candidate = input as Record<string, unknown>;
    return typeof candidate.name === "string" && ["g", "kg", "ml", "l"].includes(String(candidate.unit)) &&
      (candidate.defaultValue === undefined || typeof candidate.defaultValue === "number");
  }) && Array.isArray(calculations) && calculations.every((calculation) => {
    if (!calculation || typeof calculation !== "object") return false;
    const candidate = calculation as Record<string, unknown>;
    return ["name", "formula"].every((key) => typeof candidate[key] === "string") &&
      ["g", "kg", "ml", "l"].includes(String(candidate.unit));
  }) &&
    Array.isArray(checks) && checks.every((check) => {
      if (!check || typeof check !== "object") return false;
      const candidate = check as Record<string, unknown>;
      return typeof candidate.name === "string" && typeof candidate.intervalDays === "number";
    }) &&
    (profile.expectedDurationDays === undefined || typeof profile.expectedDurationDays === "number");
}

function normalizeProfile(profile: FermentationProfile): FermentationProfile {
  return {
    ...profile,
    inputs: profile.inputs ?? [],
    calculations: profile.calculations ?? [],
    checks: profile.checks ?? [],
  };
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
        return isProfileState(state) ? {
          profiles: state.profiles.map(normalizeProfile),
          trash: state.trash.map((profile) => ({
            ...normalizeProfile(profile), deletedAt: profile.deletedAt,
          })),
        } : null;
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
