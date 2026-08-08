import { describe, expect, it } from "vitest";
import { createBatch, createBatchState, deleteBatch } from "../domain/batches";
import { createProfileState } from "../domain/profiles";
import { createBatchStore } from "./batch-store";

describe("batch store", () => {
  it("round-trips batches with their profile snapshots", () => {
    const values = new Map<string, string>();
    const store = createBatchStore({
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    });
    const state = createBatchState([
      createBatch(createProfileState().profiles[0], {
        id: "batch-1",
        startDate: "2026-08-08",
      }),
    ]);

    store.save(state);

    expect(store.load()).toEqual(state);
  });

  it("ignores invalid persisted batches", () => {
    const store = createBatchStore({
      getItem: () => '[{"id":"batch-1","status":"unknown"}]',
      setItem: () => undefined,
    });

    expect(store.load()).toBeNull();
  });

  it("round-trips batch trash", () => {
    const values = new Map<string, string>();
    const store = createBatchStore({
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    });
    const batch = createBatch(createProfileState().profiles[0], {
      id: "batch-1", startDate: "2026-08-08",
    });
    const state = deleteBatch(createBatchState([batch]), "batch-1", 123);

    store.save(state);

    expect(store.load()).toEqual(state);
  });
});
