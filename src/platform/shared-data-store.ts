import type { BatchState, TimelineEntry } from "../domain/batches";
import type { ProfileState } from "../domain/profiles";
import type { ShellState } from "../domain/shell";
import { parseBatchState } from "./batch-store";
import { parseProfileState } from "./profile-store";
import { createPlatformSharedDirectoryBridge, type SharedDirectoryBridge } from "./shared-directory-bridge";
import { parseShellState } from "./shell-store";

const manifestPath = "manifest.json";
const recordPaths = {
  shell: "records/shell.json",
  profiles: "records/profiles.json",
  batches: "records/batches.json",
} as const;
const conflictPattern = /\.sync-conflict-[^/]+/i;
const pendingMigrationKey = "fermentstation.shared.migration-pending";

export interface SharedSnapshot {
  shell: ShellState;
  profileState: ProfileState;
  batchState: BatchState;
}

export interface SharedStorageStatus {
  state: "unavailable" | "unconfigured" | "ready" | "migration" | "problem" | "conflict";
  location?: string;
  message: string;
  conflicts: string[];
}

export interface SharedStorageResult {
  status: SharedStorageStatus;
  snapshot?: SharedSnapshot;
}

interface StoredPhoto extends Omit<Extract<TimelineEntry, { kind: "photo" }>, "dataUrl"> {
  photoRef?: string;
  dataUrl?: string;
}

export class SharedDataStore {
  private status: SharedStorageStatus;
  private pendingShared: SharedSnapshot | null = null;
  private queue = Promise.resolve();
  private writeFailed = false;

  constructor(private readonly bridge: SharedDirectoryBridge) {
    this.status = status(bridge.available ? "unconfigured" : "unavailable");
  }

  getStatus(): SharedStorageStatus {
    return this.status;
  }

  async initialize(): Promise<SharedStorageResult> {
    if (!this.bridge.available) return { status: this.status };
    try {
      const location = await this.bridge.getLocation();
      if (!location) return this.update(status("unconfigured"));
      if (migrationPending()) {
        const inspected = await this.readSnapshot(location);
        if (inspected.kind === "valid") {
          this.pendingShared = inspected.snapshot;
          return this.update({
            ...status("migration", location),
            message: "This folder and this device both contain FermentStation data. Choose which copy becomes canonical.",
            conflicts: inspected.conflicts,
          });
        }
        if (inspected.kind === "error") return this.problem(inspected.error, location, inspected.conflicts);
      }
      return await this.loadLocation(location);
    } catch (error) {
      return this.problem(error);
    }
  }

  async chooseLocation(current: SharedSnapshot, hasLegacyData: boolean): Promise<SharedStorageResult> {
    setMigrationPending(true);
    try {
      const location = await this.bridge.chooseLocation();
      if (!location) {
        setMigrationPending(false);
        return { status: this.status };
      }
      const inspected = await this.readSnapshot(location);
      if (inspected.kind === "empty") {
        await this.writeSnapshot(current);
        setMigrationPending(false);
        return this.loadLocation(location);
      }
      if (inspected.kind === "error") return this.problem(inspected.error, location, inspected.conflicts);
      if (hasLegacyData) {
        this.pendingShared = inspected.snapshot;
        setMigrationPending(true);
        return this.update({
          ...status("migration", location),
          message: "This folder and this device both contain FermentStation data. Choose which copy becomes canonical.",
          conflicts: inspected.conflicts,
        });
      }
      setMigrationPending(false);
      return this.acceptSnapshot(location, inspected.snapshot, inspected.conflicts);
    } catch (error) {
      return this.problem(error);
    }
  }

  async resolveMigration(choice: "shared" | "device", current: SharedSnapshot): Promise<SharedStorageResult> {
    const location = this.status.location;
    if (!location || !this.pendingShared) return this.problem(new Error("No migration is pending"));
    if (choice === "shared") {
      const snapshot = this.pendingShared;
      this.pendingShared = null;
      setMigrationPending(false);
      return this.acceptSnapshot(location, snapshot, this.status.conflicts);
    }
    try {
      await this.backupCurrentFiles();
      await this.writeSnapshot(current);
      this.pendingShared = null;
      setMigrationPending(false);
      return this.loadLocation(location);
    } catch (error) {
      return this.problem(error, location, this.status.conflicts);
    }
  }

  async reload(): Promise<SharedStorageResult> {
    const operation = this.queue.then(async () => {
      if (this.writeFailed || this.status.state === "migration" && this.pendingShared) {
        return { status: this.status };
      }
      const location = this.status.location ?? await this.bridge.getLocation();
      if (!location) return this.update(status("unconfigured"));
      return this.loadLocation(location);
    });
    this.queue = operation.then(() => undefined, () => undefined);
    return operation;
  }

  saveShell(value: ShellState): Promise<void> {
    return this.enqueue(async () => this.writeRecord(recordPaths.shell, value));
  }

  saveProfiles(value: ProfileState): Promise<void> {
    return this.enqueue(async () => this.writeRecord(recordPaths.profiles, value));
  }

  saveBatches(value: BatchState): Promise<void> {
    return this.enqueue(async () => {
      const stored = structuredClone(value);
      await this.externalizePhotos(stored);
      await this.writeRecord(recordPaths.batches, stored);
    });
  }

  private enqueue(work: () => Promise<void>): Promise<void> {
    if (this.status.state !== "ready" && this.status.state !== "conflict") return Promise.resolve();
    const next = this.queue.then(work);
    void next.then(() => { this.writeFailed = false; }, () => undefined);
    this.queue = next.catch((error) => {
      this.writeFailed = true;
      this.problem(error, this.status.location, this.status.conflicts);
    });
    return next;
  }

  private async loadLocation(location: string): Promise<SharedStorageResult> {
    const inspected = await this.readSnapshot(location);
    if (inspected.kind === "empty") {
      return this.update({
        ...status("problem", location),
        message: "The selected folder does not contain a FermentStation dataset.",
      });
    }
    if (inspected.kind === "error") return this.problem(inspected.error, location, inspected.conflicts);
    return this.acceptSnapshot(location, inspected.snapshot, inspected.conflicts);
  }

  private acceptSnapshot(location: string, snapshot: SharedSnapshot, conflicts: string[]): SharedStorageResult {
    this.writeFailed = false;
    const nextStatus: SharedStorageStatus = conflicts.length > 0
      ? {
          state: "conflict",
          location,
          message: "Synchronization conflict detected. Your files have been preserved.",
          conflicts,
        }
      : status("ready", location);
    return this.update(nextStatus, snapshot);
  }

  private async readSnapshot(location: string): Promise<
    | { kind: "empty" }
    | { kind: "valid"; snapshot: SharedSnapshot; conflicts: string[] }
    | { kind: "error"; error: Error; conflicts: string[] }
  > {
    const files = await this.bridge.listFiles();
    const conflicts = files.filter((path) => conflictPattern.test(path)).sort();
    if (!files.includes(manifestPath)) return { kind: "empty" };
    try {
      const manifest = await this.readJson(manifestPath);
      if (!manifest || typeof manifest !== "object" || (manifest as { schemaVersion?: unknown }).schemaVersion !== 1 ||
          (manifest as { writeInProgress?: unknown }).writeInProgress === true) {
        throw new Error("Unsupported or malformed shared-data schema version");
      }
      const shell = parseShellState(await this.readJson(recordPaths.shell));
      const profileState = parseProfileState(await this.readJson(recordPaths.profiles));
      const storedBatches = await this.readJson(recordPaths.batches);
      const batchState = await this.hydrateBatches(storedBatches);
      if (!shell || !profileState || !batchState) throw new Error("Shared records do not match the FermentStation schema");
      return { kind: "valid", snapshot: { shell, profileState, batchState }, conflicts };
    } catch (error) {
      return { kind: "error", error: asError(error), conflicts };
    }
  }

  private async writeSnapshot(snapshot: SharedSnapshot): Promise<void> {
    await this.writeRecord(manifestPath, { schemaVersion: 1, writeInProgress: true });
    await this.writeRecord(recordPaths.shell, snapshot.shell);
    await this.writeRecord(recordPaths.profiles, snapshot.profileState);
    const batches = structuredClone(snapshot.batchState);
    await this.externalizePhotos(batches);
    await this.writeRecord(recordPaths.batches, batches);
    await this.writeRecord(manifestPath, { schemaVersion: 1 });
  }

  private async externalizePhotos(state: BatchState): Promise<void> {
    for (const batch of [...state.batches, ...state.trash]) {
      for (const entry of [...batch.timeline, ...batch.timelineTrash]) {
        if (entry.kind !== "photo") continue;
        const path = `photos/${safeSegment(batch.id)}/${safeSegment(entry.id)}.${photoExtension(entry.mimeType)}`;
        const encoded = entry.dataUrl.split(",", 2)[1];
        if (!encoded) throw new Error("Photo data is invalid");
        await this.writeIfChanged(path, encoded);
        const stored = entry as StoredPhoto;
        stored.photoRef = path;
        delete stored.dataUrl;
      }
    }
  }

  private async hydrateBatches(value: unknown): Promise<BatchState | null> {
    if (!value || typeof value !== "object") return null;
    const candidate = structuredClone(value) as Partial<BatchState>;
    if (!Array.isArray(candidate.batches) || !Array.isArray(candidate.trash)) return null;
    for (const batch of [...candidate.batches, ...candidate.trash]) {
      for (const entry of [...(batch.timeline ?? []), ...(batch.timelineTrash ?? [])]) {
        if (entry.kind !== "photo") continue;
        const stored = entry as StoredPhoto;
        if (typeof stored.photoRef !== "string" || !stored.photoRef.startsWith("photos/") || stored.photoRef.includes("..")) {
          return null;
        }
        const data = await this.bridge.readFile(stored.photoRef);
        if (!data) return null;
        stored.dataUrl = `data:${stored.mimeType};base64,${data}`;
        delete stored.photoRef;
      }
    }
    return parseBatchState(candidate);
  }

  private async backupCurrentFiles(): Promise<void> {
    const prefix = `migration-backup/${new Date().toISOString().replace(/[:.]/g, "-")}`;
    for (const path of await this.bridge.listFiles()) {
      if (path === manifestPath || path.startsWith("records/") || path.startsWith("photos/")) {
        const data = await this.bridge.readFile(path);
        if (data !== null) await this.writeIfChanged(`${prefix}/${path}`, data);
      }
    }
  }

  private async readJson(path: string): Promise<unknown> {
    const encoded = await this.bridge.readFile(path);
    if (encoded === null) throw new Error(`Missing ${path}`);
    try {
      return JSON.parse(new TextDecoder().decode(base64ToBytes(encoded)));
    } catch {
      throw new Error(`${path} is not valid JSON`);
    }
  }

  private writeRecord(path: string, value: unknown): Promise<void> {
    const text = `${JSON.stringify(value, null, 2)}\n`;
    return this.writeIfChanged(path, bytesToBase64(new TextEncoder().encode(text)));
  }

  private async writeIfChanged(path: string, data: string): Promise<void> {
    if (await this.bridge.readFile(path) === data) return;
    await this.bridge.writeFile(path, data);
  }

  private problem(error: unknown, location = this.status.location, conflicts: string[] = []): SharedStorageResult {
    return this.update({
      state: "problem",
      location,
      message: asError(error).message,
      conflicts,
    });
  }

  private update(nextStatus: SharedStorageStatus, snapshot?: SharedSnapshot): SharedStorageResult {
    this.status = nextStatus;
    return { status: nextStatus, snapshot };
  }
}

function status(state: SharedStorageStatus["state"], location?: string): SharedStorageStatus {
  const messages: Record<SharedStorageStatus["state"], string> = {
    unavailable: "Shared folders are available in the Android and desktop apps.",
    unconfigured: "No shared folder selected.",
    ready: "Ready",
    migration: "Choose which data to keep.",
    problem: "Shared folder problem.",
    conflict: "Synchronization conflict detected.",
  };
  return { state, location, message: messages[state], conflicts: [] };
}

function safeSegment(value: string): string {
  return encodeURIComponent(value).replace(/\./g, "%2E");
}

function photoExtension(mimeType: string): string {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/gif") return "gif";
  return "img";
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function migrationPending(): boolean {
  try {
    return localStorage.getItem(pendingMigrationKey) === "true";
  } catch {
    return false;
  }
}

function setMigrationPending(pending: boolean): void {
  try {
    if (pending) localStorage.setItem(pendingMigrationKey, "true");
    else localStorage.removeItem(pendingMigrationKey);
  } catch {
    // The current session still retains the pending migration in memory.
  }
}

export const sharedDataStore = new SharedDataStore(createPlatformSharedDirectoryBridge());
