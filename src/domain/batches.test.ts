import { describe, expect, it } from "vitest";
import { createProfileState } from "./profiles";
import {
  changeBatchStatus,
  createBatch,
  filterBatches,
  prioritizeToday,
  statusLabel,
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
      profileSnapshot: {
        id: "starter-kombucha-f1",
        name: "Kombucha F1",
        guidance: "Keep at room temperature and cover with a breathable cloth.",
        instructions: "Taste after 7 days, then bottle when pleasantly tart.",
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
});
