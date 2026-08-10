import { describe, expect, it } from "vitest";
import { createProfileState, deleteProfile } from "../domain/profiles";
import { createProfileStore } from "./profile-store";

describe("profile store", () => {
  it("round-trips profiles", () => {
    const values = new Map<string, string>();
    const store = createProfileStore({
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    });

    const state = deleteProfile(createProfileState(), "starter-sauerkraut");
    store.save(state);

    expect(store.load()).toEqual(state);
  });

  it("ignores invalid persisted data", () => {
    const store = createProfileStore({
      getItem: () => '{"profiles":[{"id":"profile"}],"trash":[]}',
      setItem: () => undefined,
    });

    expect(store.load()).toBeNull();
  });

  it("ignores legacy profile trash while loading", () => {
    const store = createProfileStore({
      getItem: () => JSON.stringify({ profiles: [createProfileState().profiles[0]], trash: [{ id: "deleted" }] }),
      setItem: () => undefined,
    });

    expect(store.load()).toEqual({ profiles: [createProfileState().profiles[0]] });
  });

  it("migrates profile checks without IDs", () => {
    const profile = createProfileState().profiles[0];
    profile.checks = [{ name: " Taste ", intervalDays: 2 }];
    const store = createProfileStore({
      getItem: () => JSON.stringify({ profiles: [profile] }),
      setItem: () => undefined,
    });

    const loaded = store.load()!;
    expect(loaded.profiles[0].checks[0]).toMatchObject({ name: "Taste", intervalDays: 2 });
    expect(loaded.profiles[0].checks[0].id).toEqual(expect.any(String));
    expect(store.load()?.profiles[0].checks[0].id).toBe(loaded.profiles[0].checks[0].id);
  });

  it("migrates legacy guidance and instructions into guidance steps", () => {
    const profile = createProfileState().profiles[0];
    const legacyProfile = { ...profile, guidance: profile.guidance[0], instructions: profile.guidance[1] };
    const store = createProfileStore({
      getItem: () => JSON.stringify({ profiles: [legacyProfile] }),
      setItem: () => undefined,
    });

    expect(store.load()?.profiles[0].guidance).toEqual(profile.guidance);
  });
});
