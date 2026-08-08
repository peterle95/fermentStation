import { type FermentationProfile } from "./profiles";

export const batchStatuses = ["active", "ready", "to-fridge"] as const;
export type BatchStatus = (typeof batchStatuses)[number];
export type BatchFilter = BatchStatus | "all";

export interface Batch {
  id: string;
  name: string;
  startDate: string;
  status: BatchStatus;
  profileSnapshot: FermentationProfile;
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
  };
}

export function changeBatchStatus(batch: Batch, status: BatchStatus): Batch {
  return { ...batch, status };
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
