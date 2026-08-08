import {
  batchStatuses,
  createBatchState,
  type Batch,
  type BatchState,
  type TimelineEntry,
} from "../domain/batches";

export interface BatchStore {
  load(): BatchState | null;
  save(state: BatchState): void;
}

interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const storageKey = "fermentstation.batches";

function isBatch(value: unknown): value is Batch {
  if (!value || typeof value !== "object") {
    return false;
  }

  const batch = value as Record<string, unknown>;
  const profile = batch.profileSnapshot;
  const timeline = batch.timeline ?? [];
  const timelineTrash = batch.timelineTrash ?? [];
  return (
    ["id", "name", "startDate"].every((key) => typeof batch[key] === "string") &&
    typeof batch.status === "string" &&
    batchStatuses.includes(batch.status as Batch["status"]) &&
    !!profile &&
    typeof profile === "object" &&
    ["id", "name", "guidance", "instructions"].every(
      (key) => typeof (profile as Record<string, unknown>)[key] === "string",
    ) &&
    Array.isArray(timeline) && timeline.every(isTimelineEntry) &&
    Array.isArray(timelineTrash) && timelineTrash.every(
      (entry) => isTimelineEntry(entry) && typeof (entry as Record<string, unknown>).deletedAt === "number",
    )
  );
}

function isTimelineEntry(value: unknown): value is TimelineEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  if (typeof entry.id !== "string" || typeof entry.date !== "string") return false;
  if (entry.kind === "status") {
    return typeof entry.status === "string" && batchStatuses.includes(entry.status as Batch["status"]);
  }
  return (entry.kind === "note" || entry.kind === "measurement") && typeof entry.text === "string";
}

function normalizeBatch(batch: Batch): Batch {
  return { ...batch, timeline: batch.timeline ?? [], timelineTrash: batch.timelineTrash ?? [] };
}

export function createBatchStore(storage: KeyValueStore): BatchStore {
  return {
    load() {
      try {
        const value = storage.getItem(storageKey);
        if (!value) {
          return null;
        }

        const state: unknown = JSON.parse(value);
        if (Array.isArray(state) && state.every(isBatch)) {
          return createBatchState(state.map(normalizeBatch));
        }
        if (!state || typeof state !== "object") return null;
        const candidate = state as BatchState;
        return Array.isArray(candidate.batches) && candidate.batches.every(isBatch) &&
          Array.isArray(candidate.trash) && candidate.trash.every(
            (batch) => isBatch(batch) && typeof batch.deletedAt === "number",
          )
          ? {
              batches: candidate.batches.map(normalizeBatch),
              trash: candidate.trash.map((batch) => ({ ...normalizeBatch(batch), deletedAt: batch.deletedAt })),
            }
          : null;
      } catch {
        return null;
      }
    },
    save(state) {
      try {
        storage.setItem(storageKey, JSON.stringify(state));
      } catch {
        // Batch tracking remains usable when persistent storage is blocked.
      }
    },
  };
}

export const browserBatchStore: BatchStore = {
  load() {
    try {
      return createBatchStore(window.localStorage).load();
    } catch {
      return null;
    }
  },
  save(state) {
    try {
      createBatchStore(window.localStorage).save(state);
    } catch {
      // Batch tracking remains usable when persistent storage is blocked.
    }
  },
};
