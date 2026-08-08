import { describe, expect, it } from "vitest";
import { createProfileState, validateProfile } from "./profiles";
import {
  addTimelineEntry,
  addPhReading,
  adjustBatchCheck,
  calendarEvents,
  changeBatchStatus,
  createBatch,
  createBatchState,
  completeBatchCheck,
  deleteBatch,
  deleteTimelineEntry,
  discardExpiredBatches,
  dueBatchChecks,
  filterBatches,
  latestPhReading,
  prioritizeToday,
  phWarning,
  phZoneLabel,
  restoreBatch,
  restoreTimelineEntry,
  overrideBatchCalculation,
  setBatchInput,
  setFinishDate,
  statusLabel,
  updateTimelineEntry,
  updatePhReading,
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
      checks: [],
      finishDate: undefined,
      profileSnapshot: {
        id: "starter-kombucha-f1",
        name: "Kombucha F1",
        guidance: "Keep at room temperature and cover with a breathable cloth.",
        instructions: "Taste after 7 days, then bottle when pleasantly tart.",
        inputs: [],
        calculations: [],
        checks: [],
        phZones: [],
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

  it("leaves runtime-invalid suggestions incomplete and preserves overrides", () => {
    const source = {
      ...profile(),
      inputs: [{ name: "weight", unit: "kg" as const, defaultValue: 1 }],
      calculations: [{ name: "remainder", unit: "g" as const, formula: "weight - 1000" }],
    };

    expect(validateProfile(source)).toEqual([]);
    const batch = createBatch(source, {
      id: "runtime-negative", startDate: "2026-08-01", inputValues: { weight: 0.5 },
    });
    expect(batch.calculationValues.remainder.suggested).toBeNull();

    const overridden = overrideBatchCalculation(batch, "remainder", 10);
    expect(setBatchInput(overridden, "weight", 0.25).calculationValues.remainder)
      .toEqual({ suggested: null, override: 10 });
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

  it("copies, adjusts, completes, and restarts recurring checks", () => {
    const batch = createBatch(
      { ...profile(), checks: [{ name: "Taste", intervalDays: 2 }] },
      { id: "batch-1", startDate: "2026-08-01" },
    );
    const adjusted = adjustBatchCheck(batch, "Taste", 3);
    const completed = completeBatchCheck(adjusted, "Taste", "2026-08-06", "entry-1");

    expect(batch.checks[0].nextDueDate).toBe("2026-08-03");
    expect(adjusted.checks[0].nextDueDate).toBe("2026-08-04");
    expect(dueBatchChecks(adjusted, "2026-08-06")).toMatchObject([
      { name: "Taste", overdue: true },
    ]);
    expect(completed.checks[0].nextDueDate).toBe("2026-08-09");
    expect(completed.timeline[0]).toMatchObject({ kind: "check", checkName: "Taste" });
  });

  it("pauses checks outside active and emits sorted calendar work", () => {
    const batch = createBatch(
      { ...profile(), expectedDurationDays: 7, checks: [{ name: "Burp", intervalDays: 2 }] },
      { id: "batch-1", startDate: "2026-08-01" },
    );
    const ready = changeBatchStatus(batch, "ready");

    expect(dueBatchChecks(ready, "2026-08-10")).toEqual([]);
    expect(() => completeBatchCheck(ready, "Burp", "2026-08-10", "entry-1"))
      .toThrow("Checks are paused");
    expect(calendarEvents([batch])).toEqual([
      { batchId: "batch-1", batchName: "Kombucha F1", date: "2026-08-03", kind: "check", label: "Burp" },
      { batchId: "batch-1", batchName: "Kombucha F1", date: "2026-08-08", kind: "finish", label: "Finish date" },
    ]);
    expect(calendarEvents([ready])).toHaveLength(1);
  });

  it("shifts the next check by time spent paused", () => {
    const batch = createBatch(
      { ...profile(), checks: [{ name: "Taste", intervalDays: 2 }] },
      { id: "batch-1", startDate: "2026-08-01" },
    );
    const ready = changeBatchStatus(batch, "ready", "2026-08-02");
    const resumed = changeBatchStatus(ready, "active", "2026-08-05");

    expect(resumed.checks[0].nextDueDate).toBe("2026-08-06");
  });

  it("keeps check pauses correct when status timeline entries are edited or deleted", () => {
    const batch = createBatch(
      { ...profile(), checks: [{ name: "Taste", intervalDays: 2 }] },
      { id: "batch-1", startDate: "2026-08-01" },
    );
    const ready = addTimelineEntry(batch, {
      id: "status-1", date: "2026-08-02", kind: "status", status: "ready",
    });
    const redated = updateTimelineEntry(ready, {
      id: "status-1", date: "2026-08-03", kind: "status", status: "ready",
    }, "2026-08-03");
    const restoredActive = deleteTimelineEntry(redated, "status-1", Date.parse("2026-08-05T12:00:00Z"));

    expect(redated.checksPausedAt).toBe("2026-08-03");
    expect(restoredActive.status).toBe("active");
    expect(restoredActive.checksPausedAt).toBeUndefined();
    expect(restoredActive.checks[0].nextDueDate).toBe("2026-08-05");
  });

  it("records, orders, edits, warns, and labels pH readings", () => {
    const batch = createBatch({
      ...profile(),
      phZones: [
        { label: "safe", min: 2.5, max: 3.1 },
        { label: "optimal", min: 3.2, max: 3.6 },
      ],
    }, { id: "batch-1", startDate: "2026-08-01" });
    const first = addPhReading(batch, { id: "ph-1", date: "2026-08-03", kind: "ph", value: 3.45 });
    const second = addPhReading(first, { id: "ph-2", date: "2026-08-02", kind: "ph", value: 15 });
    const edited = updatePhReading(second, { id: "ph-2", date: "2026-08-04", kind: "ph", value: 3.05 });

    expect(edited.timeline.map(({ id }) => id)).toEqual(["ph-1", "ph-2"]);
    expect(latestPhReading(edited)?.value).toBe(3.05);
    expect(phWarning(15)).toBe("Outside the usual pH range of 0-14");
    expect(phZoneLabel(edited, 3.05)).toBe("safe");
    expect(phZoneLabel(edited, 3.45)).toBe("optimal");
    expect(() => addPhReading(batch, { id: "ph-3", date: "2026-08-05", kind: "ph", value: 3.456 }))
      .toThrow("two decimal places");
  });

  it("retains photo bytes through timeline trash and restore", () => {
    const batch = addTimelineEntry(
      createBatch(profile(), { id: "batch-1", startDate: "2026-08-01" }),
      {
        id: "photo-1", date: "2026-08-02", kind: "photo", name: "jar.jpg",
        mimeType: "image/jpeg", dataUrl: "data:image/jpeg;base64,b3JpZ2luYWw=", caption: "Jar",
      },
    );
    const deleted = deleteTimelineEntry(batch, "photo-1", 100);
    const restored = restoreTimelineEntry(deleted, "photo-1", 101);

    expect(restored.timeline[0]).toEqual(batch.timeline[0]);
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
