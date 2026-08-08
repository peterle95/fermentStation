import { describe, expect, it } from "vitest";
import { createProfileState, deleteProfile } from "../domain/profiles";
import { createProfileStore } from "./profile-store";

describe("profile store", () => {
  it("round-trips profiles and trash", () => {
    const values = new Map<string, string>();
    const store = createProfileStore({
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    });

    const state = deleteProfile(createProfileState(), "starter-sauerkraut", 100);
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
});
