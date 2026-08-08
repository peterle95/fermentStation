import { describe, expect, it } from "vitest";
import { createProfileState } from "./profiles";
import {
  addTimelineEntry,
  changeBatchStatus,
  createBatch,
  createBatchState,
  deleteBatch,
  deleteTimelineEntry,
  discardExpiredBatches,
  filterBatches,
  prioritizeToday,
  restoreBatch,
  restoreTimelineEntry,
  overrideBatchCalculation,
  setBatchInput,
  setFinishDate,
  statusLabel,
  updateTimelineEntry,
  updateBatchForDate,
} from "./batches";

const profile = () => createProfileState().profiles[0];

describe("batches", () => {
  it("starts an active batch from a named profile snapshot", () => {
    const source = profile();
    const batch = createBatch(source, {
      id: "batch-1",
      name: "Kitchen kombucha",
      startDate: "2026-08-08",
    });

    source.name = "Changed later";

    expect(batch).toEqual({
      id: "batch-1",
      name: "Kitchen kombucha",
      startDate: "2026-08-08",
      status: "active",
      timeline: [],
      timelineTrash: [],
      inputValues: {},
      calculationValues: {},
      profileSnapshot: {
        id: "starter-kombucha-f1",
        name: "Kombucha F1",
        guidance: "Keep at room temperature and cover with a breathable cloth.",
        instructions: "Taste after 7 days, then bottle when pleasantly tart.",
        inputs: [],
        calculations: [],
      },
    });
  });

  it("uses the profile name when the optional batch name is blank", () => {
    expect(
      createBatch(profile(), { id: "batch-2", name: "  ", startDate: "2026-08-08" })
        .name,
    ).toBe("Kombucha F1");
  });

  it("filters supported statuses and exposes text labels", () => {
    const active = createBatch(profile(), { id: "active", startDate: "2026-08-08" });
    const ready = changeBatchStatus(
      createBatch(profile(), { id: "ready", startDate: "2026-08-07" }),
      "ready",
    );
    const fridge = changeBatchStatus(
      createBatch(profile(), { id: "fridge", startDate: "2026-08-06" }),
      "to-fridge",
    );
    const batches = [active, fridge, ready];

    expect(filterBatches(batches, "ready")).toEqual([ready]);
    expect(filterBatches(batches, "all")).toEqual(batches);
    expect([statusLabel(active.status), statusLabel(ready.status), statusLabel(fridge.status)])
      .toEqual(["Active", "Ready", "To fridge"]);
  });

  it("puts ready decisions before active work and cold storage", () => {
    const active = createBatch(profile(), { id: "active", startDate: "2026-08-08" });
    const ready = changeBatchStatus(
      createBatch(profile(), { id: "ready", startDate: "2026-08-07" }),
      "ready",
    );
    const fridge = changeBatchStatus(
      createBatch(profile(), { id: "fridge", startDate: "2026-08-06" }),
      "to-fridge",
    );

    expect(prioritizeToday([fridge, active, ready]).map(({ id }) => id)).toEqual([
      "ready",
      "active",
      "fridge",
    ]);
  });

  it("records, orders, edits, and applies timeline activity", () => {
    const batch = createBatch(profile(), { id: "batch-1", startDate: "2026-08-01" });
    const withNote = addTimelineEntry(batch, {
      id: "note-1", date: "2026-08-03", kind: "note", text: "Tasted tart",
    });
    const withMeasurement = addTimelineEntry(withNote, {
      id: "measurement-1", date: "2026-08-02", kind: "measurement", text: "pH 3.4",
    });
    const ready = addTimelineEntry(withMeasurement, {
      id: "status-1", date: "2026-08-04", kind: "status", status: "ready",
    });
    const edited = updateTimelineEntry(ready, {
      id: "note-1", date: "2026-08-05", kind: "note", text: "Tasted pleasantly tart",
    });

    expect(edited.status).toBe("ready");
    expect(edited.timeline.map(({ id }) => id)).toEqual([
      "measurement-1", "status-1", "note-1",
    ]);
    expect(edited.timeline[2]).toMatchObject({ text: "Tasted pleasantly tart" });
  });

  it("derives the current status from the latest remaining status change", () => {
    const active = createBatch(profile(), { id: "batch-1", startDate: "2026-08-01" });
    const ready = addTimelineEntry(active, {
      id: "ready", date: "2026-08-04", kind: "status", status: "ready",
    });
    const backdated = addTimelineEntry(ready, {
      id: "fridge", date: "2026-08-03", kind: "status", status: "to-fridge",
    });

    expect(backdated.status).toBe("ready");
    expect(deleteTimelineEntry(backdated, "ready", 1).status).toBe("to-fridge");
    expect(deleteTimelineEntry(ready, "ready", 1).status).toBe("active");
  });

  it("snapshots inputs, updates decimal suggestions, and freezes overrides per batch", () => {
    const source = {
      ...profile(),
      inputs: [{ name: "cabbage", unit: "kg" as const, defaultValue: 2 }],
      calculations: [{ name: "salt", unit: "g" as const, formula: "cabbage * 2%" }],
    };
    const first = createBatch(source, { id: "first", startDate: "2026-08-01" });
    const second = createBatch(source, { id: "second", startDate: "2026-08-01" });
    const changed = setBatchInput(first, "cabbage", 1.25);
    const overridden = overrideBatchCalculation(changed, "salt", 26.5);
    const changedAgain = setBatchInput(overridden, "cabbage", 3);

    source.inputs[0].defaultValue = 5;
    expect(changed.calculationValues.salt.suggested).toBe(25);
    expect(changedAgain.calculationValues.salt).toEqual({ suggested: 25, override: 26.5 });
    expect(second.calculationValues.salt.suggested).toBe(40);
    expect(first.profileSnapshot.inputs[0].defaultValue).toBe(2);
  });

  it("uses calendar finish dates for automatic and manual status transitions", () => {
    const scheduled = createBatch(
      { ...profile(), expectedDurationDays: 7 },
      { id: "batch-1", startDate: "2026-08-01", today: "2026-08-07" },
    );
    const earlyReady = changeBatchStatus(scheduled, "ready");

    expect(scheduled.finishDate).toBe("2026-08-08");
    expect(updateBatchForDate(scheduled, "2026-08-08").status).toBe("ready");
    expect(updateBatchForDate(earlyReady, "2026-08-07")).toMatchObject({
      status: "ready", finishDate: "2026-08-08",
    });
    expect(setFinishDate(earlyReady, "2026-08-10", "2026-08-08").status).toBe("active");
  });

  it("trashes and restores timeline entries for seven days", () => {
    const day = 24 * 60 * 60 * 1000;
    const batch = addTimelineEntry(
      createBatch(profile(), { id: "batch-1", startDate: "2026-08-01" }),
      { id: "note-1", date: "2026-08-02", kind: "note", text: "Bubbly" },
    );
    const deleted = deleteTimelineEntry(batch, "note-1", 100 * day);

    expect(restoreTimelineEntry(deleted, "note-1", 106 * day).timeline).toHaveLength(1);
    expect(restoreTimelineEntry(deleted, "note-1", 107 * day).timelineTrash).toHaveLength(0);
  });

  it("trashes, restores, and expires batches after seven days", () => {
    const day = 24 * 60 * 60 * 1000;
    const batch = createBatch(profile(), { id: "batch-1", startDate: "2026-08-01" });
    const deleted = deleteBatch(createBatchState([batch]), "batch-1", 100 * day);

    expect(restoreBatch(deleted, "batch-1", 106 * day).batches).toEqual([batch]);
    expect(discardExpiredBatches(deleted, 107 * day)).toEqual({ batches: [], trash: [] });
  });
});
