import { type FermentationProfile } from "./profiles";

export const batchStatuses = ["active", "ready", "to-fridge"] as const;
export type BatchStatus = (typeof batchStatuses)[number];
export type BatchFilter = BatchStatus | "all";

export type TimelineEntry =
  | { id: string; date: string; kind: "note"; text: string }
  | { id: string; date: string; kind: "measurement"; text: string }
  | { id: string; date: string; kind: "status"; status: BatchStatus };

export type TrashedTimelineEntry = TimelineEntry & { deletedAt: number };

export interface Batch {
  id: string;
  name: string;
  startDate: string;
  status: BatchStatus;
  profileSnapshot: FermentationProfile;
  timeline: TimelineEntry[];
  timelineTrash: TrashedTimelineEntry[];
}

export interface TrashedBatch extends Batch {
  deletedAt: number;
}

export interface BatchState {
  batches: Batch[];
  trash: TrashedBatch[];
}

interface NewBatch {
  id: string;
  name?: string;
  startDate: string;
}

export function createBatch(
  profile: FermentationProfile,
  { id, name, startDate }: NewBatch,
): Batch {
  return {
    id,
    name: name?.trim() || profile.name,
    startDate,
    status: "active",
    profileSnapshot: { ...profile },
    timeline: [],
    timelineTrash: [],
  };
}

export function changeBatchStatus(batch: Batch, status: BatchStatus): Batch {
  return { ...batch, status };
}

const recoveryPeriodMs = 7 * 24 * 60 * 60 * 1000;

export function createBatchState(batches: Batch[] = []): BatchState {
  return { batches, trash: [] };
}

export function addTimelineEntry(batch: Batch, entry: TimelineEntry): Batch {
  const timeline = [...batch.timeline, entry].sort((left, right) =>
    left.date.localeCompare(right.date),
  );
  return {
    ...batch,
    status: entry.kind === "status" ? latestTimelineStatus(timeline) : batch.status,
    timeline,
  };
}

export function updateTimelineEntry(batch: Batch, entry: TimelineEntry): Batch {
  if (!batch.timeline.some(({ id }) => id === entry.id)) {
    return batch;
  }

  const previous = batch.timeline.find(({ id }) => id === entry.id)!;
  const timeline = batch.timeline
    .map((current) => current.id === entry.id ? entry : current)
    .sort((left, right) => left.date.localeCompare(right.date));
  return {
    ...batch,
    status: previous.kind === "status" || entry.kind === "status"
      ? latestTimelineStatus(timeline)
      : batch.status,
    timeline,
  };
}

export function deleteTimelineEntry(batch: Batch, id: string, deletedAt: number): Batch {
  const current = discardExpiredTimelineEntries(batch, deletedAt);
  const entry = current.timeline.find((candidate) => candidate.id === id);
  const timeline = current.timeline.filter((candidate) => candidate.id !== id);
  return entry ? {
    ...current,
    status: entry.kind === "status" ? latestTimelineStatus(timeline) : current.status,
    timeline,
    timelineTrash: [...current.timelineTrash, { ...entry, deletedAt }],
  } : current;
}

function latestTimelineStatus(timeline: TimelineEntry[]): BatchStatus {
  for (let index = timeline.length - 1; index >= 0; index -= 1) {
    const entry = timeline[index];
    if (entry.kind === "status") return entry.status;
  }
  return "active";
}

export function restoreTimelineEntry(batch: Batch, id: string, now: number): Batch {
  const entry = batch.timelineTrash.find((candidate) => candidate.id === id);
  if (!entry || now - entry.deletedAt >= recoveryPeriodMs) {
    return discardExpiredTimelineEntries(batch, now);
  }

  const { deletedAt: _deletedAt, ...restored } = entry;
  return {
    ...addTimelineEntry(batch, restored),
    timelineTrash: batch.timelineTrash.filter((candidate) => candidate.id !== id),
  };
}

export function discardExpiredTimelineEntries(batch: Batch, now: number): Batch {
  const timelineTrash = batch.timelineTrash.filter(
    (entry) => now - entry.deletedAt < recoveryPeriodMs,
  );
  return timelineTrash.length === batch.timelineTrash.length
    ? batch
    : { ...batch, timelineTrash };
}

export function deleteBatch(state: BatchState, id: string, deletedAt: number): BatchState {
  const current = discardExpiredBatches(state, deletedAt);
  const batch = current.batches.find((candidate) => candidate.id === id);
  return batch ? {
    batches: current.batches.filter((candidate) => candidate.id !== id),
    trash: [...current.trash, { ...batch, deletedAt }],
  } : current;
}

export function restoreBatch(state: BatchState, id: string, now: number): BatchState {
  const batch = state.trash.find((candidate) => candidate.id === id);
  if (!batch || now - batch.deletedAt >= recoveryPeriodMs) {
    return discardExpiredBatches(state, now);
  }

  const { deletedAt: _deletedAt, ...restored } = batch;
  return {
    batches: state.batches.some((candidate) => candidate.id === id)
      ? state.batches
      : [...state.batches, restored],
    trash: state.trash.filter((candidate) => candidate.id !== id),
  };
}

export function discardExpiredBatches(state: BatchState, now: number): BatchState {
  const trash = state.trash.filter((batch) => now - batch.deletedAt < recoveryPeriodMs);
  const batches = state.batches.map((batch) => discardExpiredTimelineEntries(batch, now));
  return trash.length === state.trash.length && batches.every((batch, index) => batch === state.batches[index])
    ? state
    : { batches, trash };
}

export function filterBatches(batches: Batch[], filter: BatchFilter): Batch[] {
  return filter === "all" ? batches : batches.filter(({ status }) => status === filter);
}

export function prioritizeToday(batches: Batch[]): Batch[] {
  const priority: Record<BatchStatus, number> = { ready: 0, active: 1, "to-fridge": 2 };
  return [...batches].sort((left, right) => priority[left.status] - priority[right.status]);
}

export function statusLabel(status: BatchStatus): string {
  return status === "to-fridge" ? "To fridge" : status[0].toUpperCase() + status.slice(1);
}
