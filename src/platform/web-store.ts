import type { BatchState, TimelineEntry } from "../domain/batches";
import type { ProfileState } from "../domain/profiles";
import type { ShellState } from "../domain/shell";
import { browserBatchStore, parseBatchState } from "./batch-store";
import { browserProfileStore, parseProfileState } from "./profile-store";
import { browserShellStore, parseShellState } from "./shell-store";

export interface WebSnapshot {
  shell: ShellState | null;
  profileState: ProfileState | null;
  batchState: BatchState | null;
}

const keys = ["fermentstation.shell", "fermentstation.profiles", "fermentstation.batches"] as const;
let queue: Promise<void> = Promise.resolve();
let loading: Promise<WebSnapshot | null> | undefined;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("fermentstation", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("records");
      request.result.createObjectStore("photos");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("IndexedDB upgrade blocked"));
  });
}

function complete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("Storage transaction aborted"));
    transaction.onerror = () => reject(transaction.error ?? new Error("Storage transaction failed"));
  });
}

function dataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function photoEntries(state: BatchState | null): TimelineEntry[] {
  return state ? [...state.batches, ...state.trash].flatMap((batch) => [...batch.timeline, ...batch.timelineTrash]) : [];
}

async function write(db: IDBDatabase, snapshot: WebSnapshot): Promise<void> {
  const records = structuredClone(snapshot);
  const photos: [string, Blob][] = [];
  for (const batch of records.batchState ? [...records.batchState.batches, ...records.batchState.trash] : []) {
    for (const entry of [...batch.timeline, ...batch.timelineTrash]) {
      if (entry.kind !== "photo") continue;
      const key = JSON.stringify([batch.id, entry.id]);
      const response = await fetch(entry.dataUrl);
      if (!response.ok) throw new Error("Unable to read photo");
      photos.push([key, await response.blob()]);
      Object.assign(entry, { photoRef: key });
      delete (entry as { dataUrl?: string }).dataUrl;
    }
  }
  const tx = db.transaction(["records", "photos"], "readwrite");
  const done = complete(tx);
  try {
    const store = tx.objectStore("photos");
    // ponytail: rewrite all photos per snapshot; use incremental writes if library size makes saves slow.
    store.clear();
    for (const [key, photo] of photos) store.put(photo, key);
    tx.objectStore("records").put(records, "snapshot");
  } catch (error) {
    tx.abort();
    await done.catch(() => undefined);
    throw error;
  }
  await done;
}

export function loadWebState(): Promise<WebSnapshot | null> {
  if (!loading) loading = readWebState().finally(() => { loading = undefined; });
  return loading;
}

async function readWebState(): Promise<WebSnapshot | null> {
  const db = await openDatabase();
  try {
    const tx = db.transaction(["records", "photos"], "readonly");
    const done = complete(tx);
    const request = tx.objectStore("records").get("snapshot");
    const photosRequest = tx.objectStore("photos").getAll();
    const keysRequest = tx.objectStore("photos").getAllKeys();
    await done;
    const stored = request.result as WebSnapshot | undefined;
    if (stored) {
      const photos = new Map(keysRequest.result.map((key, index) => [String(key), photosRequest.result[index] as Blob]));
      for (const entry of photoEntries(stored.batchState)) {
        if (entry.kind !== "photo") continue;
        const ref = (entry as TimelineEntry & { photoRef?: string }).photoRef;
        const photo = ref && photos.get(ref);
        if (!photo) throw new Error("A stored photo is missing");
        entry.dataUrl = await dataUrl(photo);
        delete (entry as TimelineEntry & { photoRef?: string }).photoRef;
      }
      const shell = stored.shell === null ? null : parseShellState(stored.shell);
      const profileState = stored.profileState === null ? null : parseProfileState(stored.profileState);
      const batchState = stored.batchState === null ? null : parseBatchState(stored.batchState);
      if ((stored.shell && !shell) || (stored.profileState && !profileState) || (stored.batchState && !batchState)) throw new Error("Stored data is invalid");
      return { shell, profileState, batchState };
    }
    const values = keys.map((key) => localStorage.getItem(key));
    if (values.every((value) => value === null)) return null;
    const snapshot = { shell: browserShellStore.load(), profileState: browserProfileStore.load(), batchState: browserBatchStore.load() };
    if (values.some((value, i) => value !== null && ![snapshot.shell, snapshot.profileState, snapshot.batchState][i])) throw new Error("Existing browser data is invalid; migration stopped");
    await write(db, snapshot);
    keys.forEach((key, i) => { if (localStorage.getItem(key) === values[i]) localStorage.removeItem(key); });
    return snapshot;
  } finally {
    db.close();
  }
}

export function saveWebState(snapshot: WebSnapshot): Promise<void> {
  const copy = structuredClone(snapshot);
  const operation = queue.catch(() => undefined).then(async () => {
    const db = await openDatabase();
    try { await write(db, copy); } finally { db.close(); }
  });
  queue = operation;
  return operation;
}
