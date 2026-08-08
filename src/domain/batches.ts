import {
  calculateProfileValue,
  cloneProfile,
  type FermentationProfile,
} from "./profiles";

export const batchStatuses = ["active", "ready", "to-fridge"] as const;
export type BatchStatus = (typeof batchStatuses)[number];
export type BatchFilter = BatchStatus | "all";

export type TimelineEntry =
  | { id: string; date: string; kind: "note"; text: string }
  | { id: string; date: string; kind: "measurement"; text: string }
  | { id: string; date: string; kind: "status"; status: BatchStatus }
  | { id: string; date: string; kind: "check"; checkName: string }
  | { id: string; date: string; kind: "ph"; value: number };

export interface BatchCheck {
  id: string;
  name: string;
  intervalDays: number;
  nextDueDate: string;
  lastCompletedDate?: string;
}

export type TrashedTimelineEntry = TimelineEntry & { deletedAt: number };

export interface Batch {
  id: string;
  name: string;
  startDate: string;
  status: BatchStatus;
  profileSnapshot: FermentationProfile;
  timeline: TimelineEntry[];
  timelineTrash: TrashedTimelineEntry[];
  inputValues: Record<string, number | undefined>;
  calculationValues: Record<string, { suggested: number | null; override?: number }>;
  finishDate?: string;
  checks: BatchCheck[];
  checksPausedAt?: string;
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
  inputValues?: Record<string, number | undefined>;
  today?: string;
}

export function createBatch(
  profile: FermentationProfile,
  { id, name, startDate, inputValues = {}, today }: NewBatch,
): Batch {
  const profileSnapshot = cloneProfile(profile);
  const values = Object.fromEntries(profile.inputs.map((input) => [
    input.name,
    inputValues[input.name] ?? input.defaultValue,
  ]));
  for (const [inputName, value] of Object.entries(values)) {
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
      throw new Error(`${inputName} cannot be negative`);
    }
  }
  const finishDate = profile.expectedDurationDays
    ? addCalendarDays(startDate, profile.expectedDurationDays)
    : undefined;
  const batch: Batch = {
    id,
    name: name?.trim() || profile.name,
    startDate,
    status: "active",
    profileSnapshot,
    timeline: [],
    timelineTrash: [],
    inputValues: values,
    calculationValues: {},
    finishDate,
    checks: profile.checks.map((check) => ({
      id: check.name,
      name: check.name,
      intervalDays: check.intervalDays,
      nextDueDate: addCalendarDays(startDate, check.intervalDays),
    })),
  };
  const calculated = recalculateBatch(batch);
  return today ? updateBatchForDate(calculated, today) : calculated;
}

export function changeBatchStatus(batch: Batch, status: BatchStatus, date?: string): Batch {
  if (!date || status === batch.status) return { ...batch, status };
  if (batch.status === "active" && status !== "active") {
    return { ...batch, status, checksPausedAt: date };
  }
  if (batch.status !== "active" && status === "active" && batch.checksPausedAt) {
    const pausedDays = calendarDaysBetween(batch.checksPausedAt, date);
    return {
      ...batch,
      status,
      checksPausedAt: undefined,
      checks: batch.checks.map((check) => ({
        ...check,
        nextDueDate: addCalendarDays(check.nextDueDate, Math.max(0, pausedDays)),
      })),
    };
  }
  return { ...batch, status };
}

export function setBatchInput(batch: Batch, name: string, value?: number): Batch {
  if (!batch.profileSnapshot.inputs.some((input) => input.name === name)) {
    throw new Error(`Unknown input ${name}`);
  }
  if (value !== undefined && value < 0) throw new Error(`${name} cannot be negative`);
  return recalculateBatch({
    ...batch,
    inputValues: { ...batch.inputValues, [name]: value },
  });
}

export function overrideBatchCalculation(batch: Batch, name: string, value: number): Batch {
  if (value < 0) throw new Error(`${name} cannot be negative`);
  const calculation = batch.calculationValues[name];
  if (!calculation) throw new Error(`Unknown calculation ${name}`);
  return {
    ...batch,
    calculationValues: {
      ...batch.calculationValues,
      [name]: { ...calculation, override: value },
    },
  };
}

export function setFinishDate(batch: Batch, finishDate: string, today: string): Batch {
  return changeBatchStatus(
    { ...batch, finishDate },
    finishDate > today ? "active" : "ready",
    today,
  );
}

export function updateBatchForDate(batch: Batch, today: string): Batch {
  return batch.finishDate && batch.finishDate <= today && batch.status === "active"
    ? changeBatchStatus(batch, "ready", batch.finishDate)
    : batch;
}

export function addPhReading(batch: Batch, entry: Extract<TimelineEntry, { kind: "ph" }>): Batch {
  validatePhValue(entry.value);
  return addTimelineEntry(batch, entry);
}

export function updatePhReading(batch: Batch, entry: Extract<TimelineEntry, { kind: "ph" }>): Batch {
  validatePhValue(entry.value);
  return updateTimelineEntry(batch, entry);
}

export function latestPhReading(batch: Batch): Extract<TimelineEntry, { kind: "ph" }> | undefined {
  for (let index = batch.timeline.length - 1; index >= 0; index -= 1) {
    const entry = batch.timeline[index];
    if (entry.kind === "ph") return entry;
  }
}

export function phZoneLabel(batch: Batch, value: number): string | undefined {
  return batch.profileSnapshot.phZones.find((zone) => value >= zone.min && value <= zone.max)?.label;
}

export function phWarning(value: number): string | undefined {
  return value < 0 || value > 14 ? "Outside the usual pH range of 0-14" : undefined;
}

function validatePhValue(value: number): void {
  if (!Number.isFinite(value) || Math.abs(value * 100 - Math.round(value * 100)) > 1e-8) {
    throw new Error("pH readings support up to two decimal places");
  }
}

export function adjustBatchCheck(batch: Batch, id: string, intervalDays: number): Batch {
  if (!Number.isInteger(intervalDays) || intervalDays < 1) {
    throw new Error("Check interval must be a positive whole number");
  }
  return {
    ...batch,
    checks: batch.checks.map((check) => check.id === id ? {
      ...check,
      intervalDays,
      nextDueDate: addCalendarDays(check.lastCompletedDate ?? batch.startDate, intervalDays),
    } : check),
  };
}

export function completeBatchCheck(
  batch: Batch,
  id: string,
  completedDate: string,
  timelineEntryId: string,
): Batch {
  if (batch.status !== "active") throw new Error("Checks are paused while the batch is not active");
  const check = batch.checks.find((candidate) => candidate.id === id);
  if (!check) throw new Error(`Unknown check ${id}`);
  return addTimelineEntry({
    ...batch,
    checks: batch.checks.map((candidate) => candidate.id === id ? {
      ...candidate,
      lastCompletedDate: completedDate,
      nextDueDate: addCalendarDays(completedDate, candidate.intervalDays),
    } : candidate),
  }, {
    id: timelineEntryId,
    date: completedDate,
    kind: "check",
    checkName: check.name,
  });
}

export function dueBatchChecks(batch: Batch, today: string): Array<BatchCheck & { overdue: boolean }> {
  return batch.status === "active"
    ? batch.checks
      .filter((check) => check.nextDueDate <= today)
      .map((check) => ({ ...check, overdue: check.nextDueDate < today }))
    : [];
}

export interface CalendarEvent {
  batchId: string;
  batchName: string;
  date: string;
  kind: "finish" | "check";
  label: string;
}

export function calendarEvents(batches: Batch[]): CalendarEvent[] {
  return batches.flatMap((batch) => [
    ...(batch.finishDate ? [{
      batchId: batch.id,
      batchName: batch.name,
      date: batch.finishDate,
      kind: "finish" as const,
      label: "Finish date",
    }] : []),
    ...(batch.status === "active" ? batch.checks.map((check) => ({
      batchId: batch.id,
      batchName: batch.name,
      date: check.nextDueDate,
      kind: "check" as const,
      label: check.name,
    })) : []),
  ]).sort((left, right) => left.date.localeCompare(right.date));
}

function recalculateBatch(batch: Batch): Batch {
  return {
    ...batch,
    calculationValues: Object.fromEntries(batch.profileSnapshot.calculations.map((calculation) => {
      const current = batch.calculationValues[calculation.name];
      return [calculation.name, current?.override === undefined
        ? {
            suggested: calculateProfileValue(
              batch.profileSnapshot,
              calculation,
              batch.inputValues,
            ),
          }
        : current];
    })),
  };
}

function addCalendarDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function calendarDaysBetween(start: string, end: string): number {
  return (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000;
}

const recoveryPeriodMs = 7 * 24 * 60 * 60 * 1000;

export function createBatchState(batches: Batch[] = []): BatchState {
  return { batches, trash: [] };
}

export function addTimelineEntry(batch: Batch, entry: TimelineEntry): Batch {
  const timeline = [...batch.timeline, entry].sort((left, right) =>
    left.date.localeCompare(right.date),
  );
  const next = { ...batch, timeline };
  return entry.kind === "status"
    ? changeBatchStatus(next, latestTimelineStatus(timeline), entry.date)
    : next;
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

export function prioritizeToday(batches: Batch[], today?: string): Batch[] {
  const priority: Record<BatchStatus, number> = { ready: 0, active: 1, "to-fridge": 2 };
  return [...batches].sort((left, right) => {
    if (today) {
      const leftDue = dueBatchChecks(left, today)[0];
      const rightDue = dueBatchChecks(right, today)[0];
      if (leftDue?.overdue !== rightDue?.overdue) return leftDue?.overdue ? -1 : 1;
      if (!!leftDue !== !!rightDue) return leftDue ? -1 : 1;
    }
    return priority[left.status] - priority[right.status];
  });
}

export function statusLabel(status: BatchStatus): string {
  return status === "to-fridge" ? "To fridge" : status[0].toUpperCase() + status.slice(1);
}
