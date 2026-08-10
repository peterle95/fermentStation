import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import type { BatchState, TimelineEntry } from "../domain/batches";
import { parseBatchState } from "./batch-store";
import type { ProfileState } from "../domain/profiles";
import { parseProfileState } from "./profile-store";
import type { ShellState } from "../domain/shell";
import { parseShellState } from "./shell-store";

const directory = Directory.Data;
const paths = {
  shell: "records/shell.json",
  profiles: "records/profiles.json",
  batches: "records/batches.json",
};

export interface NativeState {
  shell: ShellState | null;
  profileState: ProfileState | null;
  batchState: BatchState | null;
}

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

export async function loadNativeState(): Promise<NativeState | null> {
  if (!isNativePlatform()) return null;
  const [shell, profileState, batchState] = await Promise.all([
    readJson(paths.shell, parseShellState),
    readJson(paths.profiles, parseProfileState),
    readJson(paths.batches, parseNativeBatchState),
  ]);
  return shell || profileState || batchState ? { shell, profileState, batchState } : null;
}

export async function saveNativeState(
  shell: ShellState,
  profileState: ProfileState,
  batchState: BatchState,
): Promise<void> {
  if (!isNativePlatform()) return;
  const records = structuredClone(batchState);
  await persistPhotos(records);
  await Promise.all([
    writeJson(paths.shell, shell),
    writeJson(paths.profiles, profileState),
    writeJson(paths.batches, records),
  ]);
}

async function readJson<T>(path: string, parse: (value: unknown) => T | null | Promise<T | null>): Promise<T | null> {
  try {
    const result = await Filesystem.readFile({ path, directory, encoding: Encoding.UTF8 });
    return await parse(JSON.parse(String(result.data)));
  } catch {
    return null;
  }
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await Filesystem.writeFile({
    path,
    directory,
    data: JSON.stringify(value),
    encoding: Encoding.UTF8,
    recursive: true,
  });
}

async function persistPhotos(state: BatchState): Promise<void> {
  for (const batch of [...state.batches, ...state.trash]) {
    for (const entry of [...batch.timeline, ...batch.timelineTrash]) {
      if (entry.kind !== "photo") continue;
      const photoPath = `photos/${batch.id}/${entry.id}`;
      await Filesystem.writeFile({
        path: photoPath,
        directory,
        data: dataUrlBytes(entry.dataUrl),
      });
      (entry as TimelineEntry & { photoRef?: string; dataUrl?: string }).photoRef = photoPath;
      delete (entry as { dataUrl?: string }).dataUrl;
    }
  }
}

async function parseNativeBatchState(value: unknown): Promise<BatchState | null> {
  const state = value as BatchState | null;
  if (!state || typeof state !== "object") return null;
  for (const batch of [...state.batches, ...state.trash]) {
    for (const entry of [...batch.timeline, ...batch.timelineTrash]) {
      if (entry.kind !== "photo") continue;
      const photoRef = (entry as TimelineEntry & { photoRef?: unknown }).photoRef;
      if (typeof photoRef !== "string") continue;
      try {
        const photo = await Filesystem.readFile({ path: photoRef, directory });
        (entry as TimelineEntry & { dataUrl?: string }).dataUrl = `data:${entry.mimeType};base64,${String(photo.data)}`;
        delete (entry as { photoRef?: string }).photoRef;
      } catch {
        return null;
      }
    }
  }
  return parseBatchState(state);
}

function dataUrlBytes(dataUrl: string): string {
  const encoded = dataUrl.split(",", 2)[1];
  if (!encoded) throw new Error("Photo data is invalid");
  return encoded;
}
