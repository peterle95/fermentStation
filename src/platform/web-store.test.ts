// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory, IDBObjectStore } from "fake-indexeddb";
import { addTimelineEntry, createBatch, createBatchState } from "../domain/batches";
import { createProfileState } from "../domain/profiles";
import { createShellState } from "../domain/shell";
import { loadWebState, saveWebState } from "./web-store";

beforeEach(() => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("window", { localStorage: storage });
  vi.stubGlobal("indexedDB", new IDBFactory());
});

describe("web storage", () => {
  it("migrates validated local data and removes keys only after writing", async () => {
    const shell = createShellState();
    const profiles = createProfileState();
    const batches = createBatchState();
    localStorage.setItem("fermentstation.shell", JSON.stringify(shell));
    localStorage.setItem("fermentstation.profiles", JSON.stringify(profiles));
    localStorage.setItem("fermentstation.batches", JSON.stringify(batches));

    expect(await loadWebState()).toEqual({ shell, profileState: profiles, batchState: batches });
    expect(localStorage.getItem("fermentstation.batches")).toBeNull();
    expect(await loadWebState()).toEqual({ shell, profileState: profiles, batchState: batches });
  });

  it("leaves invalid legacy data untouched", async () => {
    localStorage.setItem("fermentstation.batches", "invalid");
    await expect(loadWebState()).rejects.toThrow("migration stopped");
    expect(localStorage.getItem("fermentstation.batches")).toBe("invalid");
  });

  it("migrates custom shell preferences and preserves the install-guide dismissal", async () => {
    const shell = { ...createShellState(), units: "imperial" as const, notificationMode: "all" as const, suggestions: false };
    const profiles = createProfileState();
    const batches = createBatchState();
    localStorage.setItem("fermentstation.shell", JSON.stringify(shell));
    localStorage.setItem("fermentstation.profiles", JSON.stringify(profiles));
    localStorage.setItem("fermentstation.batches", JSON.stringify(batches));
    localStorage.setItem("fermentstation.ios-guide-dismissed", "true");

    expect(await loadWebState()).toEqual({ shell, profileState: profiles, batchState: batches });
    expect(localStorage.getItem("fermentstation.shell")).toBeNull();
    expect(localStorage.getItem("fermentstation.ios-guide-dismissed")).toBe("true");
    expect(await loadWebState()).toEqual({ shell, profileState: profiles, batchState: batches });
  });

  it("migrates a legacy photo payload and restores it after reload", async () => {
    vi.stubGlobal("FileReader", class {
      result = "";
      onload = () => {};
      async readAsDataURL(blob: Blob) {
        this.result = `data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString("base64")}`;
        this.onload();
      }
    });
    const photo = { id: "legacy-photo", date: "2026-08-08", kind: "photo" as const, name: "jar.png", mimeType: "image/png", dataUrl: "data:image/png;base64,aGVsbG8=", caption: "" };
    const batch = addTimelineEntry(createBatch(createProfileState().profiles[0], { id: "b", startDate: "2026-08-08" }), photo);
    localStorage.setItem("fermentstation.shell", JSON.stringify(createShellState()));
    localStorage.setItem("fermentstation.profiles", JSON.stringify(createProfileState()));
    localStorage.setItem("fermentstation.batches", JSON.stringify(createBatchState([batch])));

    const migrated = await loadWebState();
    expect(migrated?.batchState?.batches[0].timeline).toEqual(batch.timeline);
    expect(localStorage.getItem("fermentstation.batches")).toBeNull();
    expect(await loadWebState()).toEqual(migrated);
  });

  it("keeps legacy data when the migration write fails", async () => {
    const value = JSON.stringify(createShellState());
    localStorage.setItem("fermentstation.shell", value);
    const put = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementationOnce(() => { throw new Error("quota"); });
    await expect(loadWebState()).rejects.toThrow("quota");
    expect(localStorage.getItem("fermentstation.shell")).toBe(value);
    put.mockRestore();
  });

  it("stores photos separately and restores them on reload", async () => {
    vi.stubGlobal("FileReader", class {
      result = "";
      onload = () => {};
      async readAsDataURL(blob: Blob) {
        this.result = `data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString("base64")}`;
        this.onload();
      }
    });
    const photo = { id: "p", date: "2026-08-08", kind: "photo" as const, name: "jar.png", mimeType: "image/png", dataUrl: "data:image/png;base64,aGVsbG8=", caption: "" };
    const batch = addTimelineEntry(createBatch(createProfileState().profiles[0], { id: "b", startDate: "2026-08-08" }), photo);
    const snapshot = { shell: createShellState(), profileState: createProfileState(), batchState: createBatchState([batch]) };
    await saveWebState(snapshot);
    expect(await loadWebState()).toEqual(snapshot);
  });

  it("round-trips more than 5 MB of photos", async () => {
    vi.stubGlobal("FileReader", class {
      result = "";
      onload = () => {};
      async readAsDataURL(blob: Blob) {
        this.result = `data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString("base64")}`;
        this.onload();
      }
    });
    const data = `data:image/png;base64,${Buffer.alloc(3 * 1024 * 1024, 42).toString("base64")}`;
    let batch = createBatch(createProfileState().profiles[0], { id: "b", startDate: "2026-08-08" });
    for (const id of ["one", "two"]) {
      batch = addTimelineEntry(batch, { id, date: "2026-08-08", kind: "photo", name: `${id}.png`, mimeType: "image/png", dataUrl: data, caption: "" });
    }
    const batchState = createBatchState([batch]);
    await saveWebState({ shell: null, profileState: null, batchState });
    expect((await loadWebState())?.batchState).toEqual(batchState);
  }, 30000);
});
