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
  | { id: string; date: string; kind: "ph"; value: number }
  | { id: string; date: string; kind: "temperature"; value: number }
  | {
      id: string;
      date: string;
      kind: "photo";
      name: string;
      mimeType: string;
      dataUrl: string;
      caption: string;
    };

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
    checks: profileSnapshot.checks.map((check) => ({
      id: createStableId("batch-check"),
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

export function addBatchCheck(
  batch: Batch,
  name: string,
  intervalDays: number,
  addedDate: string,
): Batch {
  if (batch.status !== "active") throw new Error("Checks are paused while the batch is not active");
  assertCheckInterval(intervalDays);
  const trimmedName = name.trim();
  assertUniqueCheckName(batch.checks, trimmedName);
  return {
    ...batch,
    checks: [...batch.checks, {
      id: createStableId("batch-check"),
      name: trimmedName,
      intervalDays,
      nextDueDate: addCalendarDays(addedDate, intervalDays),
    }],
  };
}

export function renameBatchCheck(batch: Batch, id: string, name: string): Batch {
  if (!batch.checks.some((check) => check.id === id)) throw new Error(`Unknown check ${id}`);
  const trimmedName = name.trim();
  assertUniqueCheckName(batch.checks, trimmedName, id);
  return {
    ...batch,
    checks: batch.checks.map((check) => check.id === id ? { ...check, name: trimmedName } : check),
  };
}

export function removeBatchCheck(batch: Batch, id: string): Batch {
  return { ...batch, checks: batch.checks.filter((check) => check.id !== id) };
}

export function adjustBatchCheck(
  batch: Batch,
  id: string,
  intervalDays: number,
  today: string,
): Batch {
  if (batch.status !== "active") throw new Error("Checks are paused while the batch is not active");
  assertCheckInterval(intervalDays);
  if (!batch.checks.some((check) => check.id === id)) throw new Error(`Unknown check ${id}`);
  return {
    ...batch,
    checks: batch.checks.map((check) => check.id === id ? {
      ...check,
      intervalDays,
      nextDueDate: addCalendarDays(check.lastCompletedDate ?? today, intervalDays),
    } : check),
  };
}

function assertCheckInterval(intervalDays: number): void {
  if (!Number.isInteger(intervalDays) || intervalDays < 1) {
    throw new Error("Check interval must be a positive whole number");
  }
}

function assertUniqueCheckName(checks: BatchCheck[], name: string, currentId?: string): void {
  if (!name || checks.some((check) => check.id !== currentId && check.name.trim().toLowerCase() === name.toLowerCase())) {
    throw new Error("Check names must be present and unique");
  }
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
      .sort(compareDueChecks)
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
  ]).sort((left, right) => left.date.localeCompare(right.date) ||
    left.batchName.localeCompare(right.batchName) || left.label.localeCompare(right.label));
}

function recalculateBatch(batch: Batch): Batch {
  return {
    ...batch,
    calculationValues: Object.fromEntries(batch.profileSnapshot.calculations.map((calculation) => {
      const current = batch.calculationValues[calculation.name];
      if (current?.override !== undefined) return [calculation.name, current];
      try {
        return [calculation.name, {
          suggested: calculateProfileValue(
            batch.profileSnapshot,
            calculation,
            batch.inputValues,
          ),
        }];
      } catch {
        return [calculation.name, { suggested: null }];
      }
    })),
  };
}

function addCalendarDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function createStableId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
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

export function updateTimelineEntry(
  batch: Batch,
  entry: TimelineEntry,
  changedDate = entry.date,
): Batch {
  if (!batch.timeline.some(({ id }) => id === entry.id)) {
    return batch;
  }

  const previous = batch.timeline.find(({ id }) => id === entry.id)!;
  const timeline = batch.timeline
    .map((current) => current.id === entry.id ? entry : current)
    .sort((left, right) => left.date.localeCompare(right.date));
  const next = { ...batch, timeline };
  if (previous.kind !== "status" && entry.kind !== "status") return next;
  const status = latestTimelineStatus(timeline);
  if (status !== batch.status) return changeBatchStatus(next, status, changedDate);
  return status === "active" ? next : {
    ...next,
    checksPausedAt: latestPauseDate(timeline) ?? batch.checksPausedAt,
  };
}

export function deleteTimelineEntry(batch: Batch, id: string, deletedAt: number): Batch {
  const current = discardExpiredTimelineEntries(batch, deletedAt);
  const entry = current.timeline.find((candidate) => candidate.id === id);
  const timeline = current.timeline.filter((candidate) => candidate.id !== id);
  if (!entry) return current;
  const next = {
    ...current,
    timeline,
    timelineTrash: [...current.timelineTrash, { ...entry, deletedAt }],
  };
  if (entry.kind !== "status") return next;
  const status = latestTimelineStatus(timeline);
  return status === current.status
    ? next
    : changeBatchStatus(next, status, new Date(deletedAt).toISOString().slice(0, 10));
}

function latestTimelineStatus(timeline: TimelineEntry[]): BatchStatus {
  for (let index = timeline.length - 1; index >= 0; index -= 1) {
    const entry = timeline[index];
    if (entry.kind === "status") return entry.status;
  }
  return "active";
}

function latestPauseDate(timeline: TimelineEntry[]): string | undefined {
  let status: BatchStatus = "active";
  let pausedAt: string | undefined;
  for (const entry of timeline) {
    if (entry.kind !== "status") continue;
    if (status === "active" && entry.status !== "active") pausedAt = entry.date;
    if (entry.status === "active") pausedAt = undefined;
    status = entry.status;
  }
  return pausedAt;
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
      if (leftDue && rightDue) return compareDueChecks(leftDue, rightDue);
    }
    return priority[left.status] - priority[right.status] || left.name.localeCompare(right.name);
  });
}

function compareDueChecks(left: BatchCheck, right: BatchCheck): number {
  return left.nextDueDate.localeCompare(right.nextDueDate) ||
    left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
}

export function statusLabel(status: BatchStatus): string {
  return status === "to-fridge" ? "To fridge" : status[0].toUpperCase() + status.slice(1);
}
