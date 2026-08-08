import { batchStatuses, type Batch } from "../domain/batches";

export interface BatchStore {
  load(): Batch[] | null;
  save(batches: Batch[]): void;
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
  return (
    ["id", "name", "startDate"].every((key) => typeof batch[key] === "string") &&
    typeof batch.status === "string" &&
    batchStatuses.includes(batch.status as Batch["status"]) &&
    !!profile &&
    typeof profile === "object" &&
    ["id", "name", "guidance", "instructions"].every(
      (key) => typeof (profile as Record<string, unknown>)[key] === "string",
    )
  );
}

export function createBatchStore(storage: KeyValueStore): BatchStore {
  return {
    load() {
      try {
        const value = storage.getItem(storageKey);
        if (!value) {
          return null;
        }

        const batches: unknown = JSON.parse(value);
        return Array.isArray(batches) && batches.every(isBatch) ? batches : null;
      } catch {
        return null;
      }
    },
    save(batches) {
      try {
        storage.setItem(storageKey, JSON.stringify(batches));
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
  save(batches) {
    try {
      createBatchStore(window.localStorage).save(batches);
    } catch {
      // Batch tracking remains usable when persistent storage is blocked.
    }
  },
};
