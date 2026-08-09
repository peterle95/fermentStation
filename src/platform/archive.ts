import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { type Batch, type BatchState } from "../domain/batches";
import { validateProfile, type ProfileState } from "../domain/profiles";
import { parseBatchState } from "./batch-store";
import { parseProfileState } from "./profile-store";

interface ArchiveManifest {
  schemaVersion: 1;
  recordsHash: string;
  photos: string[];
}

interface ArchiveRecords {
  profileState: ProfileState;
  batchState: BatchState;
}

export interface ArchiveCollision {
  kind: "profile" | "batch";
  id: string;
  local: unknown;
  imported: unknown;
}

export interface ArchiveImport {
  profileState: ProfileState;
  batchState: BatchState;
  collisions: ArchiveCollision[];
  pendingProfileState?: ProfileState;
  pendingBatchState?: BatchState;
}

export async function createArchive(
  profileState: ProfileState,
  batchState: BatchState,
): Promise<Uint8Array> {
  validateStableIds(profileState, batchState);
  const records = structuredClone({ profileState, batchState }) as ArchiveRecords;
  if (records.profileState.profiles.some((profile) => validateProfile(profile).length > 0)) {
    throw new Error("Archive contains an invalid profile");
  }
  const photos: Record<string, Uint8Array> = {};
  for (const batch of [...records.batchState.batches, ...records.batchState.trash]) {
    for (const entry of [...batch.timeline, ...batch.timelineTrash]) {
      if (entry.kind !== "photo") continue;
      const bytes = dataUrlBytes(entry.dataUrl);
      const hash = await sha256(bytes);
      photos[hash] = bytes;
      const archived = entry as unknown as Record<string, unknown>;
      archived.photoHash = hash;
      delete archived.dataUrl;
    }
  }
  const recordsBytes = strToU8(JSON.stringify(records));
  const manifest: ArchiveManifest = {
    schemaVersion: 1,
    recordsHash: await sha256(recordsBytes),
    photos: Object.keys(photos).sort(),
  };
  return zipSync({
    "manifest.json": strToU8(JSON.stringify(manifest)),
    "records.json": recordsBytes,
    ...Object.fromEntries(Object.entries(photos).map(([hash, bytes]) => [`photos/${hash}`, bytes])),
  });
}

export async function importArchive(
  archive: Uint8Array,
  localProfiles: ProfileState,
  localBatches: BatchState,
): Promise<ArchiveImport> {
  let files: Record<string, Uint8Array>;
  try {
    if (archive.byteLength > 200 * 1024 * 1024) throw new Error("Archive exceeds the 200 MB limit");
    let expandedSize = 0;
    files = unzipSync(archive, { filter(file) {
      expandedSize += file.originalSize;
      if (expandedSize > 250 * 1024 * 1024) throw new Error("Archive expands beyond the 250 MB limit");
      return true;
    } });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Archive ")) throw error;
    throw new Error("Archive is not a valid ZIP file");
  }
  if (!files["manifest.json"] || !files["records.json"]) {
    throw new Error("Archive must contain manifest.json and records.json");
  }
  const manifest = parseManifest(files["manifest.json"]);
  const allowedFiles = new Set(["manifest.json", "records.json", ...manifest.photos.map((hash) => `photos/${hash}`)]);
  if (Object.keys(files).some((name) => !allowedFiles.has(name)) ||
      [...allowedFiles].some((name) => !files[name])) {
    throw new Error("Archive structure does not match its manifest");
  }
  if (await sha256(files["records.json"]) !== manifest.recordsHash) {
    throw new Error("Records hash does not match the manifest");
  }
  for (const hash of manifest.photos) {
    if (await sha256(files[`photos/${hash}`]) !== hash) {
      throw new Error(`Photo hash mismatch: ${hash}`);
    }
  }

  let records: ArchiveRecords;
  try {
    records = JSON.parse(strFromU8(files["records.json"])) as ArchiveRecords;
  } catch {
    throw new Error("Archive records are not valid JSON");
  }
  if (!records || typeof records !== "object" || !records.batchState || !records.profileState) {
    throw new Error("Archive records do not match the schema");
  }
  hydratePhotos(records.batchState, manifest, files);
  const profileState = parseProfileState(records.profileState);
  const batchState = parseBatchState(records.batchState);
  if (!profileState || !batchState) throw new Error("Archive records do not match the schema");
  validateImportedRecords(profileState, batchState);
  validateStableIds(profileState, batchState);

  const collisions = findCollisions(localProfiles, localBatches, profileState, batchState);
  if (collisions.length > 0) return {
    profileState: localProfiles,
    batchState: localBatches,
    collisions,
    pendingProfileState: profileState,
    pendingBatchState: batchState,
  };
  return {
    profileState: {
      profiles: [...localProfiles.profiles, ...profileState.profiles],
    },
    batchState: {
      batches: [...localBatches.batches, ...batchState.batches],
      trash: [...localBatches.trash, ...batchState.trash],
    },
    collisions: [],
  };
}

export function resolveArchiveCollisions(
  imported: ArchiveImport,
  strategy: "local" | "archive",
): Pick<ArchiveImport, "profileState" | "batchState"> {
  if (!imported.pendingProfileState || !imported.pendingBatchState) {
    return { profileState: imported.profileState, batchState: imported.batchState };
  }
  const profileIds = new Set(imported.collisions.filter(({ kind }) => kind === "profile").map(({ id }) => id));
  const batchIds = new Set(imported.collisions.filter(({ kind }) => kind === "batch").map(({ id }) => id));
  const keep = strategy === "local";
  return {
    profileState: {
      profiles: [
        ...imported.profileState.profiles.filter(({ id }) => keep || !profileIds.has(id)),
        ...imported.pendingProfileState.profiles.filter(({ id }) => !keep || !profileIds.has(id)),
      ],
    },
    batchState: {
      batches: [
        ...imported.batchState.batches.filter(({ id }) => keep || !batchIds.has(id)),
        ...imported.pendingBatchState.batches.filter(({ id }) => !keep || !batchIds.has(id)),
      ],
      trash: [
        ...imported.batchState.trash.filter(({ id }) => keep || !batchIds.has(id)),
        ...imported.pendingBatchState.trash.filter(({ id }) => !keep || !batchIds.has(id)),
      ],
    },
  };
}

function parseManifest(bytes: Uint8Array): ArchiveManifest {
  let value: unknown;
  try {
    value = JSON.parse(strFromU8(bytes));
  } catch {
    throw new Error("Archive manifest is not valid JSON");
  }
  if (!value || typeof value !== "object") throw new Error("Archive manifest is invalid");
  const manifest = value as Record<string, unknown>;
  if (manifest.schemaVersion !== 1) throw new Error("Unsupported archive schema version");
  if (typeof manifest.recordsHash !== "string" || !Array.isArray(manifest.photos) ||
      !manifest.photos.every((hash) => typeof hash === "string" && /^[a-f0-9]{64}$/.test(hash)) ||
      new Set(manifest.photos).size !== manifest.photos.length) {
    throw new Error("Archive manifest is invalid");
  }
  return manifest as unknown as ArchiveManifest;
}

function hydratePhotos(
  state: BatchState,
  manifest: ArchiveManifest,
  files: Record<string, Uint8Array>,
): void {
  const referenced = new Set<string>();
  for (const batch of [...state.batches, ...state.trash]) {
    for (const entry of [...batch.timeline, ...batch.timelineTrash]) {
      if (entry.kind !== "photo") continue;
      const archived = entry as unknown as Record<string, unknown>;
      const hash = archived.photoHash;
      if (typeof hash !== "string" || !manifest.photos.includes(hash) || typeof entry.mimeType !== "string") {
        throw new Error("Photo record does not reference a manifest photo");
      }
      referenced.add(hash);
      entry.dataUrl = `data:${entry.mimeType};base64,${bytesToBase64(files[`photos/${hash}`])}`;
      delete archived.photoHash;
    }
  }
  if (referenced.size !== manifest.photos.length) throw new Error("Archive contains unreferenced photos");
}

function validateStableIds(profiles: ProfileState, batches: BatchState): void {
  uniqueIds(profiles.profiles, "profile");
  uniqueIds([...batches.batches, ...batches.trash], "batch");
  for (const batch of [...batches.batches, ...batches.trash]) {
    uniqueIds(batch.checks, `checks in ${batch.id}`);
    uniqueIds([...batch.timeline, ...batch.timelineTrash], `timeline entries in ${batch.id}`);
  }
}

function validateImportedRecords(profiles: ProfileState, batches: BatchState): void {
  for (const profile of profiles.profiles) {
    if (validateProfile(profile).length > 0) throw new Error("Archive contains an invalid profile");
  }
  for (const batch of [...batches.batches, ...batches.trash]) {
    if (!validDate(batch.startDate) || batch.finishDate !== undefined && !validDate(batch.finishDate) ||
        batch.checksPausedAt !== undefined && !validDate(batch.checksPausedAt)) {
      throw new Error("Archive contains an invalid batch date");
    }
    if (validateProfile(batch.profileSnapshot).length > 0) {
      throw new Error("Archive contains an invalid profile snapshot");
    }
    if (Object.values(batch.inputValues).some((value) => value !== undefined && !nonnegative(value))) {
      throw new Error("Archive contains an invalid batch input");
    }
    if (Object.values(batch.calculationValues).some((value) =>
      !value || typeof value !== "object" ||
      value.suggested !== null && !nonnegative(value.suggested) ||
      value.override !== undefined && !nonnegative(value.override))) {
      throw new Error("Archive contains an invalid batch calculation");
    }
    const checkNames = new Set<string>();
    if (batch.checks.some((check) => {
      const name = check.name.trim().toLowerCase();
      const duplicate = !name || checkNames.has(name);
      checkNames.add(name);
      return duplicate || !Number.isInteger(check.intervalDays) || check.intervalDays < 1 ||
        !validDate(check.nextDueDate) || check.lastCompletedDate !== undefined && !validDate(check.lastCompletedDate);
    })) {
      throw new Error("Archive contains an invalid batch check");
    }
    for (const entry of [...batch.timeline, ...batch.timelineTrash]) {
      if (!validDate(entry.date) || entry.kind === "ph" &&
          (!Number.isFinite(entry.value) || Math.abs(entry.value * 100 - Math.round(entry.value * 100)) > 1e-8)) {
        throw new Error("Archive contains an invalid timeline entry");
      }
      if ("deletedAt" in entry &&
          (typeof entry.deletedAt !== "number" || !validTimestamp(entry.deletedAt))) {
        throw new Error("Archive contains an invalid timeline trash timestamp");
      }
    }
    if ("deletedAt" in batch &&
        (typeof batch.deletedAt !== "number" || !validTimestamp(batch.deletedAt))) {
      throw new Error("Archive contains an invalid batch trash timestamp");
    }
  }
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validTimestamp(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function nonnegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function uniqueIds(records: Array<{ id: string }>, label: string): void {
  const ids = new Set<string>();
  for (const record of records) {
    if (!record.id.trim() || ids.has(record.id)) throw new Error(`Archive has invalid or duplicate ${label} IDs`);
    ids.add(record.id);
  }
}

function findCollisions(
  localProfiles: ProfileState,
  localBatches: BatchState,
  importedProfiles: ProfileState,
  importedBatches: BatchState,
): ArchiveCollision[] {
  const collisions: ArchiveCollision[] = [];
  collectCollisions("profile", localProfiles.profiles, importedProfiles.profiles, collisions);
  collectCollisions("batch", [...localBatches.batches, ...localBatches.trash], [...importedBatches.batches, ...importedBatches.trash], collisions);
  return collisions;
}

function collectCollisions(
  kind: ArchiveCollision["kind"],
  local: Array<{ id: string }>,
  imported: Array<{ id: string }>,
  collisions: ArchiveCollision[],
): void {
  const localById = new Map(local.map((record) => [record.id, record]));
  for (const record of imported) {
    const current = localById.get(record.id);
    if (current) collisions.push({ kind, id: record.id, local: current, imported: record });
  }
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function dataUrlBytes(dataUrl: string): Uint8Array {
  const encoded = dataUrl.split(",", 2)[1];
  if (!encoded) throw new Error("Photo data is invalid");
  return Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
