import { beforeEach, describe, expect, it } from "vitest";
import { createBatch, createBatchState } from "../domain/batches";
import { createProfileState } from "../domain/profiles";
import { createShellState } from "../domain/shell";
import type { SharedDirectoryBridge } from "./shared-directory-bridge";
import { SharedDataStore, type SharedSnapshot } from "./shared-data-store";

class MemoryBridge implements SharedDirectoryBridge {
  readonly available = true;
  location: string | null = null;
  files = new Map<string, string>();
  writes: string[] = [];

  async getLocation() { return this.location; }
  async chooseLocation() { this.location = "Test folder"; return this.location; }
  async listFiles() { return [...this.files.keys()]; }
  async readFile(path: string) { return this.files.get(path) ?? null; }
  async writeFile(path: string, data: string) {
    this.writes.push(path);
    this.files.set(path, data);
  }
}

let bridge: MemoryBridge;
let store: SharedDataStore;
let snapshot: SharedSnapshot;

beforeEach(() => {
  bridge = new MemoryBridge();
  store = new SharedDataStore(bridge);
  const profileState = createProfileState();
  snapshot = {
    shell: createShellState(),
    profileState,
    batchState: createBatchState([
      createBatch(profileState.profiles[0], { id: "batch/one", startDate: "2026-08-01" }),
    ]),
  };
});

describe("shared data store", () => {
  it("migrates existing device data into an empty selected folder and round-trips it", async () => {
    const selected = await store.chooseLocation(snapshot, true);

    expect(selected.status.state).toBe("ready");
    expect(selected.snapshot).toEqual(snapshot);
    expect(readJson(bridge, "manifest.json")).toEqual({ schemaVersion: 1 });
    expect(bridge.writes.at(-1)).toBe("manifest.json");
  });

  it("writes photos as regular relative files and hydrates them on reload", async () => {
    snapshot.batchState.batches[0].timeline.push({
      id: "photo one",
      date: "2026-08-02",
      kind: "photo",
      name: "jar.jpg",
      mimeType: "image/jpeg",
      dataUrl: "data:image/jpeg;base64,cGhvdG8=",
      caption: "Day one",
    });

    const selected = await store.chooseLocation(snapshot, false);
    const stored = readJson(bridge, "records/batches.json") as { batches: Array<{ timeline: Array<Record<string, unknown>> }> };

    expect(stored.batches[0].timeline[0]).toMatchObject({
      photoRef: "photos/batch%2Fone/photo%20one.jpg",
    });
    expect(stored.batches[0].timeline[0]).not.toHaveProperty("dataUrl");
    expect(bridge.files.get("photos/batch%2Fone/photo%20one.jpg")).toBe("cGhvdG8=");
    expect(selected.snapshot).toEqual(snapshot);
  });

  it("rejects malformed JSON, unsupported schemas, and missing record files", async () => {
    await store.chooseLocation(snapshot, false);
    bridge.files.set("records/profiles.json", textData("{"));
    expect((await store.reload()).status.state).toBe("problem");

    bridge.files.set("records/profiles.json", jsonData(snapshot.profileState));
    bridge.files.set("manifest.json", jsonData({ schemaVersion: 2 }));
    expect((await store.reload()).status.message).toMatch(/schema version/i);

    bridge.files.set("manifest.json", jsonData({ schemaVersion: 1 }));
    bridge.files.delete("records/shell.json");
    expect((await store.reload()).status.message).toContain("Missing records/shell.json");
  });

  it("requires an explicit choice when both the device and selected folder contain data", async () => {
    await store.chooseLocation(snapshot, false);
    const secondStore = new SharedDataStore(bridge);
    const device = structuredClone(snapshot);
    device.shell.units = "imperial";

    const pending = await secondStore.chooseLocation(device, true);
    expect(pending.status.state).toBe("migration");
    expect(pending.snapshot).toBeUndefined();
    expect((await secondStore.reload()).status.state).toBe("migration");

    const resolved = await secondStore.resolveMigration("device", device);
    expect(resolved.snapshot?.shell.units).toBe("imperial");
    expect([...bridge.files.keys()].some((path) => path.startsWith("migration-backup/"))).toBe(true);
  });

  it("detects Syncthing conflict copies without loading them as canonical records", async () => {
    await store.chooseLocation(snapshot, false);
    bridge.files.set("records/batches.sync-conflict-20260810-123456.json", jsonData({ batches: [] }));

    const reloaded = await store.reload();

    expect(reloaded.status.state).toBe("conflict");
    expect(reloaded.status.conflicts).toEqual(["records/batches.sync-conflict-20260810-123456.json"]);
    expect(reloaded.snapshot).toEqual(snapshot);

    await store.saveShell({ ...snapshot.shell, units: "imperial" });
    expect((readJson(bridge, "records/shell.json") as { units: string }).units).toBe("imperial");
  });

  it("marks an interrupted multi-file write as incomplete", async () => {
    await store.chooseLocation(snapshot, false);
    const migratingStore = new SharedDataStore(bridge);
    const replacement = structuredClone(snapshot);
    replacement.shell.units = "imperial";
    await migratingStore.chooseLocation(replacement, true);
    const originalWrite = bridge.writeFile.bind(bridge);
    let writes = 0;
    bridge.writeFile = async (path, data) => {
      if (!path.startsWith("migration-backup/") && ++writes === 3) throw new Error("disk full");
      await originalWrite(path, data);
    };

    expect((await migratingStore.resolveMigration("device", replacement)).status.state).toBe("problem");
    expect((await migratingStore.reload()).status.state).toBe("problem");
  });

  it("reloads valid external changes and keeps malformed changes out of memory", async () => {
    await store.chooseLocation(snapshot, false);
    const changed = { ...snapshot.shell, units: "imperial" as const };
    bridge.files.set("records/shell.json", jsonData(changed));

    expect((await store.reload()).snapshot?.shell.units).toBe("imperial");
    bridge.files.set("records/shell.json", jsonData({ destination: "invalid" }));
    expect((await store.reload()).snapshot).toBeUndefined();
  });

  it("does not rewrite unchanged files or overwrite unrelated state", async () => {
    await store.chooseLocation(snapshot, false);
    bridge.writes = [];
    const profilesBefore = bridge.files.get("records/profiles.json");

    await store.saveShell({ ...snapshot.shell, units: "imperial" });
    await store.saveShell({ ...snapshot.shell, units: "imperial" });

    expect(bridge.writes).toEqual(["records/shell.json"]);
    expect(bridge.files.get("records/profiles.json")).toBe(profilesBefore);
  });
});

function jsonData(value: unknown): string {
  return textData(`${JSON.stringify(value, null, 2)}\n`);
}

function textData(value: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(value)));
}

function readJson(bridge: MemoryBridge, path: string): unknown {
  return JSON.parse(new TextDecoder().decode(
    Uint8Array.from(atob(bridge.files.get(path)!), (character) => character.charCodeAt(0)),
  ));
}
