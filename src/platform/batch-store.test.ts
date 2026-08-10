import { describe, expect, it } from "vitest";
import { addTimelineEntry, createBatch, createBatchState, deleteBatch } from "../domain/batches";
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

  it("retains original local photo data through storage", () => {
    const values = new Map<string, string>();
    const store = createBatchStore({
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    });
    const batch = addTimelineEntry(
      createBatch(createProfileState().profiles[0], { id: "batch-1", startDate: "2026-08-08" }),
      {
        id: "photo-1",
        date: "2026-08-08",
        kind: "photo",
        name: "jar.jpg",
        mimeType: "image/jpeg",
        dataUrl: "data:image/jpeg;base64,b3JpZ2luYWw=",
        caption: "Jar day one",
      },
    );

    store.save(createBatchState([batch]));

    expect(store.load()?.batches[0].timeline[0]).toEqual(batch.timeline[0]);
  });

  it("migrates batch checks without IDs", () => {
    const values = new Map<string, string>();
    const store = createBatchStore({
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    });
    const batch = createBatch({
      ...createProfileState().profiles[0],
      checks: [{ name: "Taste", intervalDays: 2 }],
    }, { id: "batch-1", startDate: "2026-08-08" });
    delete (batch.checks[0] as { id?: string }).id;
    values.set("fermentstation.batches", JSON.stringify(createBatchState([batch])));

    const loaded = store.load()!;
    expect(loaded.batches[0].checks[0].id).toEqual(expect.any(String));
    expect(store.load()?.batches[0].checks[0].id).toBe(loaded.batches[0].checks[0].id);
  });

  it("migrates legacy guidance in profile snapshots", () => {
    const values = new Map<string, string>();
    const store = createBatchStore({
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    });
    const batch = createBatch(createProfileState().profiles[0], { id: "batch-1", startDate: "2026-08-08" });
    const legacyBatch = {
      ...batch,
      profileSnapshot: {
        ...batch.profileSnapshot,
        guidance: batch.profileSnapshot.guidance[0],
        instructions: batch.profileSnapshot.guidance[1],
      },
    };
    values.set("fermentstation.batches", JSON.stringify({ batches: [legacyBatch], trash: [] }));

    expect(store.load()?.batches[0].profileSnapshot.guidance).toEqual(batch.profileSnapshot.guidance);
  });
});
