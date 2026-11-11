// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { webcrypto } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { createBatch, createBatchState, deleteBatch } from "./domain/batches";
import { createProfileState } from "./domain/profiles";
import { createShellState } from "./domain/shell";
import { createArchive, importArchive } from "./platform/archive";
import * as transfer from "./platform/native-transfer";
import { sharedDataStore, type SharedStorageStatus } from "./platform/shared-data-store";

const profile = createProfileState().profiles[0];
const today = new Date().toISOString().slice(0, 10);
const batch = createBatch(profile, { id: "kitchen-jar", name: "Kitchen jar", startDate: today });
const profiles = { profiles: [profile] };
let status: SharedStorageStatus;
const dialogMethods = Object.fromEntries(["showModal", "close"].map((name) => [name, Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, name)]));
beforeAll(() => {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } },
    close: { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; } },
  });
});
afterAll(() => {
  for (const name of ["showModal", "close"] as const) {
    const descriptor = dialogMethods[name];
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
  }
});

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("fermentstation.profiles", JSON.stringify(profiles));
  localStorage.setItem("fermentstation.batches", JSON.stringify(createBatchState([batch])));
  vi.stubGlobal("crypto", webcrypto);
  status = { state: "unavailable", message: "Shared folders are available in the Android and desktop apps.", conflicts: [] };
  vi.spyOn(sharedDataStore, "getStatus").mockImplementation(() => status);
  vi.spyOn(sharedDataStore, "initialize").mockImplementation(async () => ({ status }));
  vi.spyOn(sharedDataStore, "saveShell").mockResolvedValue();
  vi.spyOn(sharedDataStore, "saveBatches").mockResolvedValue();
  vi.spyOn(sharedDataStore, "saveProfiles").mockResolvedValue();
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function openSettings() {
  render(<App />);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Settings" })); });
  return within(screen.getByRole("region", { name: "Settings" }));
}

function upload(bytes: Uint8Array) {
  const input = screen.getByLabelText("Import ZIP archive") as HTMLInputElement;
  const file = new File([bytes as BlobPart], "backup.zip", { type: "application/zip" });
  Object.defineProperty(file, "arrayBuffer", { value: async () => bytes.slice().buffer });
  fireEvent.change(input, { target: { files: [file] } });
  return input;
}

describe("Settings and data feedback", () => {
  it.each(["profile", "start"])("keeps a %s draft while accepting newer shared records before saving", async (kind) => {
    const remoteProfile = { ...profile, id: "remote-profile", name: "Remote culture" };
    const remoteBatch = createBatch(remoteProfile, { id: "remote-batch", name: "Remote jar", startDate: today });
    status = { state: "ready", location: "Kitchen/shared", message: "Ready", conflicts: [] };
    vi.spyOn(sharedDataStore, "reload").mockResolvedValue({ status, snapshot: { shell: createShellState(), profileState: { profiles: [remoteProfile] }, batchState: createBatchState([batch, remoteBatch]) } });
    render(<App />);
    await act(async () => {});
    if (kind === "profile") {
      fireEvent.click(screen.getByRole("button", { name: "Profiles" }));
      fireEvent.click(screen.getByRole("button", { name: "Edit Kombucha F1" }));
    } else fireEvent.click(screen.getByRole("button", { name: "Start a batch" }));
    const name = screen.getByLabelText(kind === "profile" ? "Name" : "Batch name") as HTMLInputElement;
    fireEvent.change(name, { target: { value: "Local draft" } });
    await act(async () => fireEvent.focus(window));
    expect(screen.getByLabelText(kind === "profile" ? "Name" : "Batch name")).toBe(name);
    expect(name.value).toBe("Local draft");
    fireEvent.click(kind === "profile" ? screen.getByRole("button", { name: "Save profile" }) : within(screen.getByRole("dialog")).getByRole("button", { name: "Start a batch" }));
    if (kind === "start") {
      fireEvent.click(screen.getByRole("button", { name: "My batches" }));
      expect(screen.getByRole("button", { name: "Open Remote jar" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Open Local draft" })).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Profiles" }));
    }
    expect(screen.getByRole("button", { name: "View Remote culture guidance" })).toBeTruthy();
  });

  it.each(["check", "entry"])("protects an edited %s removed from a retained shared batch", async (kind) => {
    const tracked = createBatch({ ...profile, checks: [{ name: "Taste", intervalDays: 2 }] }, { id: batch.id, startDate: today });
    tracked.timeline.push({ id: "note", kind: "note", date: today, text: "Original note" });
    localStorage.setItem("fermentstation.batches", JSON.stringify(createBatchState([tracked])));
    status = { state: "ready", location: "Kitchen/shared", message: "Ready", conflicts: [] };
    vi.spyOn(sharedDataStore, "reload").mockResolvedValue({ status, snapshot: { shell: createShellState(), profileState: profiles, batchState: createBatchState([{ ...tracked, checks: [], timeline: [] }]) } });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<App />);
    await act(async () => {});
    fireEvent.click(screen.getByRole("button", { name: "More batch tools" }));
    if (kind === "entry") fireEvent.click(screen.getByRole("button", { name: `Edit note from ${today}` }));
    else fireEvent.change(screen.getByLabelText(`Check name: ${tracked.checks[0].name}`), { target: { value: "Unsaved check name" } });
    const draft = screen.getByLabelText("Activity context") as HTMLTextAreaElement;
    fireEvent.change(draft, { target: { value: "Unsaved note" } });
    await act(async () => fireEvent.focus(window));
    expect(confirm).toHaveBeenCalledOnce();
    expect(draft.value).toBe("Unsaved note");
    expect(screen.getByLabelText(`Check name: ${tracked.checks[0].name}`)).toBeTruthy();
    confirm.mockReturnValue(true);
    await act(async () => fireEvent.focus(window));
    expect(screen.queryByLabelText(`Check name: ${tracked.checks[0].name}`)).toBeNull();
    expect(draft.value).toBe(kind === "entry" ? "" : "Unsaved note");
    expect(screen.queryByRole("button", { name: "Save activity" })).toBeNull();
  });

  it("protects an observation and file when a shared reload removes the selected batch", async () => {
    status = { state: "ready", location: "Kitchen/shared", message: "Ready", conflicts: [] };
    const reload = vi.spyOn(sharedDataStore, "reload").mockResolvedValue({ status, snapshot: { shell: createShellState(), profileState: profiles, batchState: createBatchState() } });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<App />);
    await act(async () => {});
    fireEvent.click(screen.getByRole("button", { name: "More batch tools" }));
    fireEvent.click(screen.getByRole("button", { name: "Photo" }));
    const file = screen.getByLabelText("Photo") as HTMLInputElement;
    const selected = new File(["bytes"], "draft.jpg", { type: "image/jpeg" });
    fireEvent.change(file, { target: { files: [selected] } });
    const caption = screen.getByLabelText("Caption") as HTMLInputElement;
    fireEvent.change(caption, { target: { value: "Unsaved caption" } });
    await act(async () => fireEvent.focus(window));
    expect(reload).toHaveBeenCalledOnce();
    expect(confirm).toHaveBeenCalledOnce();
    expect(screen.getByLabelText("Photo")).toBe(file);
    expect(file.files?.[0]).toBe(selected);
    expect(caption.value).toBe("Unsaved caption");
    expect(screen.getByText(/Shared data was not loaded because it would discard/)).toBeTruthy();
    confirm.mockReturnValue(true);
    await act(async () => fireEvent.focus(window));
    expect(screen.getByRole("heading", { name: "Your batch details" })).toBeTruthy();
    expect(document.querySelector("#batch-activity-form")).toBeNull();
  });

  it("exposes named groups, dark-selection semantics, formula feedback and bundled licenses", async () => {
    const settings = await openSettings();
    for (const name of ["Household preferences", "Notifications", "Data storage", "Data exchange", "Recently deleted batches", "Formula dropdown terms", "About FermentStation", "Credits and licenses"]) {
      expect(settings.getByRole("region", { name })).toBeTruthy();
      expect(settings.getByRole("heading", { name, level: 2 })).toBeTruthy();
    }
    fireEvent.click(within(settings.getByRole("group", { name: "Units" })).getByRole("button", { name: "°F / qt" }));
    fireEvent.click(within(settings.getByRole("group", { name: "Suggestions" })).getByRole("button", { name: "Off" }));
    expect(JSON.parse(localStorage.getItem("fermentstation.shell")!)).toMatchObject({ units: "imperial", suggestions: false });
    expect(settings.queryByRole("button", { name: "Choose folder" })).toBeNull();

    const term = settings.getByLabelText("New formula term");
    fireEvent.change(term, { target: { value: "bad term" } });
    fireEvent.click(settings.getByRole("button", { name: "Add term" }));
    expect(settings.getByText(/Formula terms must start with a letter/).closest('[role="alert"]')).toBeTruthy();
    expect(term.getAttribute("aria-describedby")).toContain("formula-term-error");
    fireEvent.change(term, { target: { value: "starterLiquid" } });
    fireEvent.click(settings.getByRole("button", { name: "Add term" }));
    fireEvent.click(settings.getByRole("button", { name: "Save formula terms" }));
    expect(JSON.parse(localStorage.getItem("fermentstation.shell")!).formulaTerms).toContain("starterLiquid");
    expect(settings.getByText("Formula terms saved on this device.").closest('[role="status"]')).toBeTruthy();
    expect(settings.getByRole("link", { name: "Unique end-user license" }).getAttribute("href")).toContain("fonts/unique/License.pdf");
    expect(settings.getByRole("link", { name: "Sofia Sans Open Font License" }).getAttribute("href")).toContain("SofiaSansExtraCondensed-OFL.txt");
  });

  it.each(["shared", "device"] as const)("explains migration consequences and preserves the %s choice", async (choice) => {
    status = { state: "migration", location: "Kitchen/shared", message: "Both copies contain data.", conflicts: [] };
    const resolve = vi.spyOn(sharedDataStore, "resolveMigration").mockImplementation(async () => {
      status = { ...status, state: "ready", message: "Ready" };
      return { status };
    });
    const settings = await openSettings();
    expect(settings.getByText(/these copies will not be merged/)).toBeTruthy();
    expect(settings.getByText(/replaces this device's current records and preferences/)).toBeTruthy();
    await act(async () => fireEvent.click(settings.getByRole("button", { name: choice === "shared" ? "Use shared folder data" : "Use this device's data" })));
    expect(resolve).toHaveBeenCalledWith(choice, expect.objectContaining({ profileState: profiles, batchState: createBatchState([batch]) }));
    expect(settings.queryByRole("button", { name: "Use shared folder data" })).toBeNull();
    expect(settings.getByText("Folder connected")).toBeTruthy();
  });

  it("announces a shared-storage problem outside Settings and keeps conflict paths and retry reachable", async () => {
    status = { state: "conflict", location: "Kitchen/shared", message: "Synchronization conflict detected. Your files have been preserved.", conflicts: ["records/batches.sync-conflict-very-long-device-name.json"] };
    vi.spyOn(sharedDataStore, "reload").mockRejectedValue(new Error("Folder permission lost"));
    render(<App />);
    await act(async () => {});
    fireEvent.click(screen.getByRole("button", { name: "Review data storage" }));
    const storage = within(screen.getByRole("region", { name: "Data storage" }));
    expect(storage.getByText("Conflicting files preserved").closest('[role="alert"]')).toBeTruthy();
    expect(storage.getByText(status.conflicts[0])).toBeTruthy();
    await act(async () => fireEvent.click(storage.getByRole("button", { name: "Reload from shared folder" })));
    expect(storage.getByText(/Storage action failed: Folder permission lost/).closest('[role="alert"]')).toBeTruthy();
    expect((storage.getByRole("button", { name: "Reload from shared folder" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("announces folder selection in progress and prevents overlapping storage or transfer actions", async () => {
    status = { state: "unconfigured", message: "No shared folder selected.", conflicts: [] };
    let complete!: () => void;
    const choose = vi.spyOn(sharedDataStore, "chooseLocation").mockImplementation(() => new Promise((resolve) => {
      complete = () => {
        status = { state: "ready", message: "Ready", location: "Kitchen/shared", conflicts: [] };
        resolve({ status });
      };
    }));
    const settings = await openSettings();
    const button = settings.getByRole("button", { name: "Choose folder" }) as HTMLButtonElement;
    fireEvent.click(button);
    expect(settings.getByText("Opening folder selection…").closest('[role="status"]')).toBeTruthy();
    expect(button.disabled).toBe(true);
    expect((settings.getByRole("button", { name: "Export ZIP archive" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button);
    expect(choose).toHaveBeenCalledTimes(1);
    await act(async () => complete());
    expect(button.disabled).toBe(false);
    expect(settings.getByRole("button", { name: "Reload from shared folder" })).toBeTruthy();
  });

  it("reports native export failures, allows retry, and exports a restorable ZIP and readable journal", async () => {
    vi.spyOn(transfer, "isNativeTransferAvailable").mockReturnValue(true);
    const share = vi.spyOn(transfer, "shareNativeFile").mockRejectedValueOnce(new Error("Sharing unavailable")).mockResolvedValue();
    const before = localStorage.getItem("fermentstation.batches");
    const settings = await openSettings();
    fireEvent.click(settings.getByRole("button", { name: "Export ZIP archive" }));
    await waitFor(() => expect(settings.getByText(/Transfer failed: Sharing unavailable/)).toBeTruthy());
    expect(localStorage.getItem("fermentstation.batches")).toBe(before);
    fireEvent.click(settings.getByRole("button", { name: "Export ZIP archive" }));
    await waitFor(() => expect(settings.getByText("Archive ready to share or save.")).toBeTruthy());
    const archived = await importArchive(share.mock.calls[1][0], { profiles: [] }, createBatchState());
    expect(archived.batchState.batches[0]).toEqual(batch);
    expect(share.mock.calls[1][1]).toMatch(/^fermentstation-.*\.zip$/);
    fireEvent.click(settings.getByRole("button", { name: "Export journal" }));
    await waitFor(() => expect(settings.getByText("Journal ready to share or save.")).toBeTruthy());
    expect(new TextDecoder().decode(share.mock.calls[2][0])).toContain("Kitchen jar (kitchen-jar)");
    expect(share.mock.calls[2][1]).toMatch(/^fermentstation-journal-.*\.txt$/);
  });

  it("rejects corrupt or unreadable uploads without changing data and allows the same file to be retried", async () => {
    const settings = await openSettings();
    const before = localStorage.getItem("fermentstation.batches");
    const input = upload(new Uint8Array([1, 2, 3]));
    await waitFor(() => expect(settings.getByText(/Archive is not a valid ZIP file/)).toBeTruthy());
    expect(input.value).toBe("");
    const file = new File([], "unreadable.zip");
    Object.defineProperty(file, "arrayBuffer", { value: async () => { throw new Error("File could not be read"); } });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(settings.getByText(/File could not be read/)).toBeTruthy());
    expect(localStorage.getItem("fermentstation.batches")).toBe(before);
    expect(input.disabled).toBe(false);
  });

  it.each(["Keep local versions", "Use archive versions", "Cancel import"])("resolves import collisions through %s without an early write", async (choice) => {
    const importedProfile = { ...profile, name: "Archive method" };
    const extra = { ...batch, id: "extra-jar", name: "Extra jar" };
    const archived = await createArchive({ profiles: [importedProfile] }, createBatchState([{ ...batch, name: "Archive jar" }, extra]));
    const settings = await openSettings();
    const before = localStorage.getItem("fermentstation.batches");
    upload(archived);
    await waitFor(() => expect(settings.getByRole("heading", { name: "Identifier collisions" })).toBeTruthy());
    await waitFor(() => expect(document.activeElement).toBe(settings.getByRole("heading", { name: "Identifier collisions" })));
    expect(localStorage.getItem("fermentstation.batches")).toBe(before);
    expect(settings.getByText("profile: " + profile.id)).toBeTruthy();
    expect(settings.getByText("batch: kitchen-jar")).toBeTruthy();
    expect((settings.getByLabelText("Import ZIP archive") as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(settings.getByRole("button", { name: choice }));
    expect(settings.queryByRole("heading", { name: "Identifier collisions" })).toBeNull();
    const saved = JSON.parse(localStorage.getItem("fermentstation.batches")!);
    if (choice === "Cancel import") expect(saved.batches).toEqual([batch]);
    else {
      expect(saved.batches.map(({ name }: { name: string }) => name)).toEqual([choice === "Use archive versions" ? "Archive jar" : "Kitchen jar", "Extra jar"]);
      expect(JSON.parse(localStorage.getItem("fermentstation.profiles")!).profiles[0].name).toBe(choice === "Use archive versions" ? "Archive method" : profile.name);
    }
  });

  it("imports archive trash, restores an eligible batch and returns focus to the disclosure", async () => {
    const trashed = deleteBatch(createBatchState([{ ...batch, id: "deleted-jar", name: "Deleted jar" }]), "deleted-jar", Date.now());
    const archived = await createArchive({ profiles: [] }, trashed);
    const settings = await openSettings();
    upload(archived);
    await waitFor(() => expect(settings.getByText("Archive imported.")).toBeTruthy());
    const toggle = settings.getByRole("button", { name: "Open recently deleted batches" });
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(settings.getByRole("button", { name: "Restore Deleted jar" }));
    expect(document.activeElement).toBe(toggle);
    expect(settings.getByText("No recently deleted batches.")).toBeTruthy();
    expect(settings.getByText("Batch restored · Deleted jar").closest('[role="status"]')).toBeTruthy();
    const saved = JSON.parse(localStorage.getItem("fermentstation.batches")!);
    expect(saved.trash).toEqual([]);
    expect(saved.batches.map(({ id }: { id: string }) => id)).toEqual(["kitchen-jar", "deleted-jar"]);
  });

  it("does not restore a batch after the seven-day boundary passes while Settings stays open", async () => {
    const now = Date.now();
    const deletedAt = now - 7 * 86_400_000 + 1000;
    localStorage.setItem("fermentstation.batches", JSON.stringify(deleteBatch(createBatchState([batch]), batch.id, deletedAt)));
    const settings = await openSettings();
    fireEvent.click(settings.getByRole("button", { name: "Open recently deleted batches" }));
    vi.spyOn(Date, "now").mockReturnValue(now + 1000);
    fireEvent.click(settings.getByRole("button", { name: "Restore Kitchen jar" }));
    expect(settings.getByText(/seven-day recovery period for Kitchen jar has ended/)).toBeTruthy();
    expect(JSON.parse(localStorage.getItem("fermentstation.batches")!)).toEqual(createBatchState());
  });

  it("cancels pending choices on navigation and preserves new records when importing again", async () => {
    const archived = await createArchive(profiles, createBatchState([{ ...batch, name: "Archive jar" }]));
    const settings = await openSettings();
    upload(archived);
    await waitFor(() => expect(settings.getByRole("heading", { name: "Identifier collisions" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Start a batch" }));
    const dialog = within(screen.getByRole("dialog", { name: "Start a batch" }));
    fireEvent.change(dialog.getByLabelText("Batch name"), { target: { value: "New jar during import" } });
    fireEvent.click(dialog.getByRole("button", { name: "Start a batch" }));
    // Navigating away intentionally cancels the pending choice, so recreate the
    // collision against the now-current dataset rather than holding stale state.
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    upload(archived);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Identifier collisions" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Keep local versions" }));
    expect(JSON.parse(localStorage.getItem("fermentstation.batches")!).batches.map(({ name }: { name: string }) => name)).toEqual(["Kitchen jar", "New jar during import"]);
  });

  it("keeps the native archive picker available and reports picker failures without writes", async () => {
    vi.spyOn(transfer, "isNativeTransferAvailable").mockReturnValue(true);
    const pick = vi.spyOn(transfer, "pickNativeArchive").mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("Picker permission denied"));
    const settings = await openSettings();
    const before = localStorage.getItem("fermentstation.batches");
    await act(async () => fireEvent.click(settings.getByRole("button", { name: "Choose ZIP from device" })));
    expect(pick).toHaveBeenCalledTimes(1);
    expect(settings.queryByText("Archive imported.")).toBeNull();
    await act(async () => fireEvent.click(settings.getByRole("button", { name: "Choose ZIP from device" })));
    expect(settings.getByText(/Transfer failed: Picker permission denied/).closest('[role="alert"]')).toBeTruthy();
    expect(localStorage.getItem("fermentstation.batches")).toBe(before);
  });

  it.each(["Keep local versions", "Use archive versions"])("refreshes all collision IDs after a shared reload before %s", async (choice) => {
    const archiveSecond = { ...batch, id: "second-jar", name: "Archive second jar" };
    const archived = await createArchive(profiles, createBatchState([{ ...batch, name: "Archive first jar" }, archiveSecond]));
    const settings = await openSettings();
    upload(archived);
    await waitFor(() => expect(settings.getByRole("heading", { name: "Identifier collisions" })).toBeTruthy());
    expect(settings.queryByText("batch: second-jar")).toBeNull();
    status = { state: "ready", location: "Kitchen/shared", message: "Ready", conflicts: [] };
    const current = createBatchState([batch, { ...archiveSecond, name: "Local second jar" }, { ...batch, id: "third-jar", name: "Local third jar" }]);
    const currentProfiles = { profiles: [profile, { ...profile, id: "new-profile", name: "New shared profile" }] };
    const shell = { ...JSON.parse(localStorage.getItem("fermentstation.shell")!), destination: "settings" as const };
    vi.spyOn(sharedDataStore, "reload").mockResolvedValue({ status, snapshot: { shell, profileState: currentProfiles, batchState: current } });
    await act(async () => { fireEvent(window, new Event("focus")); });
    expect(settings.getByText("batch: second-jar")).toBeTruthy();
    fireEvent.click(settings.getByRole("button", { name: choice }));
    const saved = JSON.parse(localStorage.getItem("fermentstation.batches")!);
    expect(saved.batches.map(({ id }: { id: string }) => id).sort()).toEqual(["kitchen-jar", "second-jar", "third-jar"]);
    expect(saved.batches.find(({ id }: { id: string }) => id === "second-jar").name).toBe(choice === "Keep local versions" ? "Local second jar" : "Archive second jar");
    const savedProfiles = JSON.parse(localStorage.getItem("fermentstation.profiles")!);
    expect(savedProfiles.profiles.map(({ id }: { id: string }) => id).sort()).toEqual([profile.id, "new-profile"].sort());
    // A subsequent archive validates stable IDs and remains restorable.
    expect(await createArchive(savedProfiles, saved)).toBeInstanceOf(Uint8Array);
  });
});
