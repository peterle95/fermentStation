import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import {
  addTimelineEntry,
  createBatch,
  createBatchState,
  deleteBatch,
  deleteTimelineEntry,
} from "../domain/batches";
import { createProfileState } from "../domain/profiles";
import { createArchive, importArchive, refreshArchiveCollisions, resolveArchiveCollisions } from "./archive";

const emptyProfiles = { profiles: [] };
const emptyBatches = createBatchState();

function statesWithPhoto() {
  const profileState = createProfileState();
  const batch = addTimelineEntry(
    createBatch(profileState.profiles[0], { id: "batch-1", startDate: "2026-08-08" }),
    {
      id: "photo-1", date: "2026-08-08", kind: "photo", name: "jar.jpg",
      mimeType: "image/jpeg", dataUrl: "data:image/jpeg;base64,b3JpZ2luYWw=", caption: "Jar",
    },
  );
  return { profileState, batchState: createBatchState([batch]) };
}

describe("FermentStation archive boundary", () => {
  it("exports and imports schema-versioned records and hash-addressed photos", async () => {
    const source = statesWithPhoto();
    const archive = await createArchive(source.profileState, source.batchState);
    const files = unzipSync(archive);
    const manifest = JSON.parse(strFromU8(files["manifest.json"]));

    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.photos).toHaveLength(1);
    expect(files[`photos/${manifest.photos[0]}`]).toBeTruthy();

    const imported = await importArchive(archive, emptyProfiles, emptyBatches);
    expect(imported.collisions).toEqual([]);
    expect(imported.batchState.batches[0].timeline[0]).toMatchObject({
      id: "photo-1", dataUrl: "data:image/jpeg;base64,b3JpZ2luYWw=",
    });
  });

  it("rejects unsupported schemas, unexpected private data, and duplicate stable IDs", async () => {
    const source = statesWithPhoto();
    const archive = await createArchive(source.profileState, source.batchState);
    const schemaFiles = unzipSync(archive);
    const manifest = JSON.parse(strFromU8(schemaFiles["manifest.json"]));
    schemaFiles["manifest.json"] = strToU8(JSON.stringify({ ...manifest, schemaVersion: 2 }));
    await expect(importArchive(zipSync(schemaFiles), emptyProfiles, emptyBatches))
      .rejects.toThrow("Unsupported archive schema version");

    const privateFiles = unzipSync(archive);
    privateFiles["database.sqlite-wal"] = strToU8("live database data");
    await expect(importArchive(zipSync(privateFiles), emptyProfiles, emptyBatches))
      .rejects.toThrow("structure does not match");

    await expect(createArchive(
      { profiles: [source.profileState.profiles[0], source.profileState.profiles[0]] },
      emptyBatches,
    )).rejects.toThrow("duplicate profile IDs");
  });

  it("rejects photo hash mismatches before returning imported data", async () => {
    const source = statesWithPhoto();
    const files = unzipSync(await createArchive(source.profileState, source.batchState));
    const manifest = JSON.parse(strFromU8(files["manifest.json"]));
    files[`photos/${manifest.photos[0]}`] = strToU8("tampered");

    await expect(importArchive(zipSync(files), emptyProfiles, emptyBatches))
      .rejects.toThrow("Photo hash mismatch");
  });

  it("rejects structurally valid records that violate domain rules", async () => {
    const source = statesWithPhoto();
    source.batchState.batches[0].checks = [{
      id: "bad-check", name: "Bad", intervalDays: -2, nextDueDate: "not-a-date",
    }];
    const archive = await createArchive(source.profileState, source.batchState);

    await expect(importArchive(archive, emptyProfiles, emptyBatches))
      .rejects.toThrow("invalid batch check");
  });

  it("round-trips trashed batches and trashed photo entries", async () => {
    const source = statesWithPhoto();
    const trashedPhotoBatch = deleteTimelineEntry(
      addTimelineEntry(
        source.batchState.batches[0],
        {
          id: "photo-trashed", date: "2026-08-09", kind: "photo", name: "trashed.jpg",
          mimeType: "image/jpeg", dataUrl: "data:image/jpeg;base64,dHJhc2hlZA==", caption: "Trashed",
        },
      ),
      "photo-1",
      Date.now(),
    );
    const withTrash = deleteBatch(
      { batches: [trashedPhotoBatch], trash: [] },
      "batch-1",
      Date.now(),
    );
    const archive = await createArchive(source.profileState, withTrash);
    const files = unzipSync(archive);
    const manifest = JSON.parse(strFromU8(files["manifest.json"]));

    expect(manifest.photos).toHaveLength(2);
    const imported = await importArchive(archive, emptyProfiles, emptyBatches);
    expect(imported.collisions).toEqual([]);
    expect(imported.batchState.trash).toHaveLength(1);
    expect(imported.batchState.trash[0].timelineTrash.map(({ id }) => id)).toContain("photo-1");
    expect(imported.batchState.trash[0].timeline.map(({ id }) => id)).toContain("photo-trashed");
    const trashedPhoto = imported.batchState.trash[0].timeline.find(({ id }) => id === "photo-trashed");
    expect(trashedPhoto).toMatchObject({
      kind: "photo", dataUrl: "data:image/jpeg;base64,dHJhc2hlZA==",
    });
    const restoredPhoto = imported.batchState.trash[0].timelineTrash.find(({ id }) => id === "photo-1");
    expect(restoredPhoto).toMatchObject({
      kind: "photo", dataUrl: "data:image/jpeg;base64,b3JpZ2luYWw=",
    });
  });

  it("preserves both sides of identifier collisions without changing local state", async () => {
    const source = statesWithPhoto();
    const archive = await createArchive(source.profileState, source.batchState);
    const imported = await importArchive(archive, source.profileState, source.batchState);

    expect(imported.profileState).toBe(source.profileState);
    expect(imported.batchState).toBe(source.batchState);
    expect(imported.collisions.some(({ kind, id }) => kind === "batch" && id === "batch-1"))
      .toBe(true);
    expect(imported.collisions[0]).toHaveProperty("local");
    expect(imported.collisions[0]).toHaveProperty("imported");
    const resolved = resolveArchiveCollisions(imported, "archive");
    expect(resolved.batchState.batches).toHaveLength(1);
    expect(resolved.batchState.batches[0].timeline[0]).toMatchObject({ id: "photo-1" });
  });

  it.each(["local", "archive"] as const)("refreshes collisions across active and trashed records before keeping %s versions", async (strategy) => {
    const source = statesWithPhoto();
    const second = { ...structuredClone(source.batchState.batches[0]), id: "batch-2", name: "Archive second" };
    const archive = await createArchive(source.profileState, createBatchState([...source.batchState.batches, second]));
    const imported = await importArchive(archive, source.profileState, source.batchState);
    expect(imported.collisions.some(({ id }) => id === second.id)).toBe(false);
    const current = deleteBatch(createBatchState([...source.batchState.batches, { ...second, name: "Local second" }]), second.id, Date.now());
    const before = structuredClone(current);
    const refreshed = refreshArchiveCollisions(imported, source.profileState, current);
    expect(refreshed.collisions.find(({ id }) => id === second.id)).toMatchObject({
      local: { name: "Local second" }, imported: { name: "Archive second" },
    });
    expect(imported.batchState).toBe(source.batchState);
    const resolved = resolveArchiveCollisions(refreshed, strategy);
    const all = [...resolved.batchState.batches, ...resolved.batchState.trash];
    expect(all.filter(({ id }) => id === second.id)).toHaveLength(1);
    expect(all.find(({ id }) => id === second.id)?.name).toBe(strategy === "local" ? "Local second" : "Archive second");
    expect(resolved.batchState.trash).toHaveLength(strategy === "local" ? 1 : 0);
    expect(current).toEqual(before);
    const roundTrip = await importArchive(await createArchive(resolved.profileState, resolved.batchState), emptyProfiles, emptyBatches);
    expect(roundTrip.batchState).toEqual(resolved.batchState);
  });
});
