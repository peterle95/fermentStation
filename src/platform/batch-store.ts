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
    isProfileDetails(profile as Record<string, unknown>) &&
    (batch.finishDate === undefined || typeof batch.finishDate === "string") &&
    (batch.inputValues === undefined || isNumberRecord(batch.inputValues)) &&
    (batch.calculationValues === undefined || typeof batch.calculationValues === "object") &&
    (batch.checks === undefined || Array.isArray(batch.checks) && batch.checks.every(isBatchCheck)) &&
    (batch.checksPausedAt === undefined || typeof batch.checksPausedAt === "string") &&
    Array.isArray(timeline) && timeline.every(isTimelineEntry) &&
    Array.isArray(timelineTrash) && timelineTrash.every(
      (entry) => isTimelineEntry(entry) && typeof (entry as Record<string, unknown>).deletedAt === "number",
    )
  );
}

function isBatchCheck(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const check = value as Record<string, unknown>;
  return ["id", "name", "nextDueDate"].every((key) => typeof check[key] === "string") &&
    typeof check.intervalDays === "number" &&
    (check.lastCompletedDate === undefined || typeof check.lastCompletedDate === "string");
}

function isProfileDetails(profile: Record<string, unknown>): boolean {
  const inputs = profile.inputs ?? [];
  const calculations = profile.calculations ?? [];
  const checks = profile.checks ?? [];
  const phZones = profile.phZones ?? [];
  return Array.isArray(inputs) && inputs.every((input) => {
    if (!input || typeof input !== "object") return false;
    const value = input as Record<string, unknown>;
    return typeof value.name === "string" && ["g", "kg", "ml", "l"].includes(String(value.unit)) &&
      (value.defaultValue === undefined || typeof value.defaultValue === "number");
  }) && Array.isArray(calculations) && calculations.every((calculation) => {
    if (!calculation || typeof calculation !== "object") return false;
    const value = calculation as Record<string, unknown>;
    return typeof value.name === "string" && typeof value.formula === "string" &&
      ["g", "kg", "ml", "l"].includes(String(value.unit));
  }) && Array.isArray(checks) && checks.every((check) => {
    if (!check || typeof check !== "object") return false;
    const value = check as Record<string, unknown>;
    return typeof value.name === "string" && typeof value.intervalDays === "number";
  }) && Array.isArray(phZones) && phZones.every((zone) => {
    if (!zone || typeof zone !== "object") return false;
    const value = zone as Record<string, unknown>;
    return ["danger", "safe", "optimal"].includes(String(value.label)) &&
      typeof value.min === "number" && typeof value.max === "number";
  });
}

function isNumberRecord(value: unknown): boolean {
  return !!value && typeof value === "object" && Object.values(value).every(
    (item) => item === undefined || typeof item === "number",
  );
}

function isTimelineEntry(value: unknown): value is TimelineEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  if (typeof entry.id !== "string" || typeof entry.date !== "string") return false;
  if (entry.kind === "status") {
    return typeof entry.status === "string" && batchStatuses.includes(entry.status as Batch["status"]);
  }
  if (entry.kind === "check") return typeof entry.checkName === "string";
  if (entry.kind === "ph") return typeof entry.value === "number";
  return (entry.kind === "note" || entry.kind === "measurement") && typeof entry.text === "string";
}

function normalizeBatch(batch: Batch): Batch {
  const profileSnapshot = {
    ...batch.profileSnapshot,
    inputs: batch.profileSnapshot.inputs ?? [],
    calculations: batch.profileSnapshot.calculations ?? [],
    checks: batch.profileSnapshot.checks ?? [],
    phZones: batch.profileSnapshot.phZones ?? [],
  };
  return {
    ...batch,
    profileSnapshot,
    timeline: batch.timeline ?? [],
    timelineTrash: batch.timelineTrash ?? [],
    inputValues: batch.inputValues ?? Object.fromEntries(
      profileSnapshot.inputs.map((input) => [input.name, input.defaultValue]),
    ),
    calculationValues: batch.calculationValues ?? {},
    checks: batch.checks ?? [],
  };
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
