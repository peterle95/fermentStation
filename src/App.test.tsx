// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { setImmediate as yieldToRunner } from "node:timers/promises";
import { App } from "./App";
import { createProfileState } from "./domain/profiles";
import { createBatch, createBatchState } from "./domain/batches";
import { createShellState } from "./domain/shell";
import { iosGuideDismissedKey } from "./platform/ios-install-guide";
import * as camera from "./platform/camera";

// jsdom lacks native top-layer methods. Keep the shim here, not in production;
// native keyboard trapping and focus behavior remain browser QA requirements.
const nativeShowModal = vi.fn(function (this: HTMLDialogElement) {
  if (this.open) throw new DOMException("Dialog is already open", "InvalidStateError");
  this.open = true;
});
const nativeClose = vi.fn(function (this: HTMLDialogElement) { this.open = false; });
const dialogMethods = Object.fromEntries(["showModal", "close"].map((name) => [name, Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, name)]));
beforeAll(() => {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value: nativeShowModal },
    close: { configurable: true, value: nativeClose },
  });
});
afterAll(() => {
  for (const name of ["showModal", "close"] as const) {
    const descriptor = dialogMethods[name];
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
  }
});

it("dismisses the iOS install guide persistently", () => {
  localStorage.clear();
  vi.spyOn(navigator, "vendor", "get").mockReturnValue("Apple Computer, Inc.");
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue("iPhone");
  try {
    const view = render(<App />);
    expect(screen.getByRole("heading", { name: "Add FermentStation to your Home Screen" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss install guide" }));
    expect(screen.queryByRole("button", { name: "Dismiss install guide" })).toBeNull();
    expect(localStorage.getItem(iosGuideDismissedKey)).toBe("true");
    view.unmount();
    render(<App />);
    expect(screen.queryByRole("button", { name: "Dismiss install guide" })).toBeNull();
  } finally {
    cleanup();
    vi.restoreAllMocks();
  }
});

function localDateForTest() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function addDaysForTest(date: string, days: number) {
  const value = new Date(`${date}T00:00:00`);
  value.setDate(value.getDate() + days);
  return [value.getFullYear(), value.getMonth() + 1, value.getDate()]
    .map((part) => String(part).padStart(2, "0")).join("-");
}

function profileManagementButton(name: string) {
  const disclosure = screen.getByText("Manage profiles").closest("details")!;
  if (!disclosure.open) fireEvent.click(within(disclosure).getByText("Manage profiles"));
  expect(disclosure.open).toBe(true);
  return within(disclosure).getByRole("button", { name });
}

function newBatchSubmit() {
  return within(screen.getByRole("dialog", { name: "Start a batch" })).getByRole("button", { name: "Start a batch" });
}

function openBatchTools() {
  const detail = within(screen.getByRole("complementary", { name: "Selected batch" }));
  const toggle = detail.getByRole("button", { name: "More batch tools" });
  if (toggle.getAttribute("aria-expanded") !== "true") fireEvent.click(toggle);
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  return detail.getByRole("region", { name: "Batch management tools" });
}

function openMoreBatchActions() {
  const dashboard = within(document.querySelector(".design-dashboard")!);
  const summary = dashboard.getByText(/More batch actions/);
  if (!summary.closest("details")!.open) fireEvent.click(summary);
  expect(summary.closest("details")!.open).toBe(true);
  return dashboard;
}

describe("batch workflow", () => {
  beforeEach(() => { localStorage.clear(); nativeShowModal.mockClear(); nativeClose.mockClear(); });
  afterEach(async () => {
    cleanup();
    // Let worker IPC drain between synchronous DOM workflows instead of
    // starving Vitest's reporting RPC for the duration of the whole file.
    await yieldToRunner();
  });

  it("offers four truthful destinations, direct Settings and a separate start action", () => {
    render(<App />);
    const navigation = within(screen.getByRole("navigation", { name: "Primary navigation" }));
    expect(navigation.getAllByRole("button").map((button) => button.getAttribute("aria-label"))).toEqual(["My batches", "Checks", "Calendar", "Profiles"]);
    expect(navigation.getByRole("button", { name: "My batches" }).getAttribute("aria-current")).toBe("page");
    fireEvent.click(navigation.getByRole("button", { name: "Calendar" }));
    expect(screen.getByRole("heading", { name: "Calendar" })).toBeTruthy();
    expect(navigation.getByRole("button", { name: "Calendar" }).getAttribute("aria-current")).toBe("page");
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByRole("region", { name: "Settings" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Start a batch" }));
    expect(screen.getByRole("dialog", { name: "Start a batch" })).toBeTruthy();
  });

  it("keeps Start a batch available without profiles and links its guidance to Profiles", () => {
    localStorage.setItem("fermentstation.profiles", JSON.stringify({ profiles: [] }));
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Start a batch" }));
    const dialog = within(screen.getByRole("dialog", { name: "Start a batch" }));
    expect(dialog.getByText("Create or restore a fermentation profile before starting a batch.")).toBeTruthy();
    fireEvent.click(dialog.getByRole("button", { name: "Open Profiles" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("heading", { name: "No fermentation profiles yet" })).toBeTruthy();
  });

  it("switches Overview and All batches without losing search, sort, filters or selection", () => {
    const today = localDateForTest();
    const profile = createProfileState().profiles[0];
    const first = createBatch(profile, { id: "first", name: "First jar", startDate: today, today });
    localStorage.setItem("fermentstation.batches", JSON.stringify(createBatchState([first])));
    render(<App />);
    const views = within(screen.getByRole("group", { name: "My batches view" }));
    expect(views.getByRole("button", { name: "Overview" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "First" } });
    fireEvent.click(screen.getByRole("button", { name: "Sort batches by finish date" }));
    fireEvent.click(within(screen.getByRole("group", { name: "Filter batches by status" })).getByRole("button", { name: "Active" }));
    fireEvent.click(views.getByRole("button", { name: "All batches" }));
    expect(views.getByRole("button", { name: "All batches" }).getAttribute("aria-pressed")).toBe("true");
    expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("First");
    expect(screen.getByRole("button", { name: "Sort batches by finish date" }).getAttribute("aria-pressed")).toBe("true");
    expect(within(screen.getByRole("group", { name: "Filter batches by status" })).getByRole("button", { name: "Active" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Open First jar" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("keeps a failed user photo truthful and recoverable without replacing the saved original", () => {
    const batch = createBatch(createProfileState().profiles[0], { id: "jar", name: "Photo jar", startDate: localDateForTest() });
    batch.timeline.push({ id: "photo", kind: "photo", date: localDateForTest(), name: "my-jar.jpg", mimeType: "image/jpeg", caption: "My jar", dataUrl: "data:image/jpeg;base64,cGhvdG8=" });
    localStorage.setItem("fermentstation.batches", JSON.stringify(createBatchState([batch])));
    render(<App />);
    const card = within(screen.getByRole("button", { name: "Open Photo jar" }));
    const photo = card.getByRole("img", { name: "Batch photograph: My jar" });
    fireEvent.error(photo);
    expect(card.getByRole("img", { name: "Batch photograph unavailable; original retained" })).toBeTruthy();
    expect(card.queryByRole("img", { name: /stand-in/ })).toBeNull();
    expect(JSON.parse(localStorage.getItem("fermentstation.batches")!).batches[0].timeline[0].dataUrl).toBe("data:image/jpeg;base64,cGhvdG8=");
  });

  it("returns from a calendar batch to its original month and from a check to Checks", () => {
    const today = localDateForTest();
    const profile = { ...createProfileState().profiles[0], checks: [{ name: "Taste", intervalDays: 2 }] };
    const batch = { ...createBatch(profile, { id: "jar", name: "Return jar", startDate: today, today }), finishDate: addDaysForTest(today, 40) };
    localStorage.setItem("fermentstation.batches", JSON.stringify(createBatchState([batch])));
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Calendar" }));
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    const month = screen.getByRole("grid").getAttribute("aria-label");
    fireEvent.click(screen.getByRole("button", { name: `Open Return jar for ${batch.finishDate}` }));
    fireEvent.click(screen.getByRole("button", { name: "Back to Calendar" }));
    expect(screen.getByRole("grid").getAttribute("aria-label")).toBe(month);
    fireEvent.click(screen.getByRole("button", { name: "Checks" }));
    fireEvent.click(screen.getByRole("button", { name: "Open Return jar for Taste" }));
    fireEvent.click(screen.getByRole("button", { name: "Back to Checks" }));
    expect(screen.getByRole("heading", { name: "Your batch checks" })).toBeTruthy();
  });

  it("restores focus to the originating view when a day-picker choice no longer exists", async () => {
    const today = localDateForTest();
    const finishDate = addDaysForTest(today, 2);
    const profile = createProfileState().profiles[0];
    const batches = ["First", "Second"].map((name) => ({ ...createBatch(profile, { id: name, name, startDate: today, today }), finishDate }));
    localStorage.setItem("fermentstation.batches", JSON.stringify(createBatchState(batches)));
    render(<App />);
    for (const calendar of [true, false]) {
      fireEvent.click(screen.getByRole("button", { name: calendar ? "Calendar" : "My batches" }));
      if (!calendar) openMoreBatchActions();
      fireEvent.click(screen.getByRole("button", { name: `Choose a batch for ${finishDate}` }));
      const choice = within(screen.getByRole("dialog")).getByRole("button", { name: "Open First" });
      choice.focus();
      fireEvent.click(choice);
      fireEvent.click(screen.getByRole("button", { name: calendar ? "Back to Calendar" : "Back to batches" }));
      await act(async () => { await new Promise(requestAnimationFrame); });
      expect(document.activeElement).toBe(screen.getByRole("heading", { name: calendar ? "Calendar" : "My batches 2" }));
    }
  });

  it("keeps advanced management out of the default accessibility tree and opens all tools explicitly", () => {
    const today = localDateForTest();
    const profile = { ...createProfileState().profiles[0], inputs: [{ name: "Tea", unit: "l" as const, defaultValue: 2 }], calculations: [{ name: "Sugar", unit: "g" as const, formula: "Tea * 5" }], checks: [{ name: "Taste", intervalDays: 2 }] };
    const batch = createBatch(profile, { id: "jar", startDate: today });
    batch.timeline.push({ id: "note", kind: "note", date: today, text: "Real note" });
    localStorage.setItem("fermentstation.batches", JSON.stringify(createBatchState([batch])));
    render(<App />);
    const detail = within(screen.getByRole("complementary", { name: "Selected batch" }));
    const summary = detail.getByRole("button", { name: "More batch tools" });
    expect(summary.tagName).toBe("BUTTON"); // native keyboard activation, no custom key handling
    expect(summary.getAttribute("aria-expanded")).toBe("false");
    expect(summary.closest(".timeline-panel-heading")).toBeTruthy();
    expect(summary.getAttribute("aria-controls")).toBe("batch-management");
    for (const name of ["Take photo", "Delete batch", `Edit note from ${today}`, "Log activity"]) {
      expect(detail.queryByRole("button", { name })).toBeNull();
    }
    expect(detail.queryByRole("heading", { name: /Key measurements/ })).toBeNull();
    expect(detail.queryByRole("region", { name: "Batch configuration components" })).toBeNull();
    expect(detail.getByText("Real note")).toBeTruthy();
    expect(detail.getByRole("heading", { name: /Batch timeline/ }).tagName).toBe("H3");
    expect(detail.getByText("Note", { selector: ".timeline-entry strong" })).toBeTruthy();
    summary.focus();
    fireEvent.click(summary); // native keyboard activation dispatches click too
    expect(document.activeElement).toBe(summary);
    expect(summary.getAttribute("aria-expanded")).toBe("true");
    for (const name of ["Take photo", "Delete batch", `Edit note from ${today}`, "Log activity", "Edit recurring checks"]) {
      expect(detail.getByRole("button", { name })).toBeTruthy();
    }
    expect(detail.getByLabelText("Finish date")).toBeTruthy();
    expect(detail.getByLabelText("Tea (l)")).toBeTruthy();
    expect(detail.getByLabelText("Override Sugar")).toBeTruthy();
    expect(detail.getByLabelText("Taste interval days")).toBeTruthy();
    expect(detail.getByRole("heading", { name: /Key measurements/ })).toBeTruthy();
    fireEvent.click(summary);
    expect(detail.queryByRole("button", { name: "Log activity" })).toBeNull();
    expect(detail.queryByRole("button", { name: `Edit note from ${today}` })).toBeNull();
  });

  it("keeps the permanent logger outside closed management while a modal leaves the scroller unchanged", () => {
    const batch = createBatch(createProfileState().profiles[0], { id: "jar", startDate: localDateForTest() });
    localStorage.setItem("fermentstation.batches", JSON.stringify(createBatchState([batch])));
    render(<App />);
    const detail = screen.getByRole("complementary", { name: "Selected batch" });
    const form = document.querySelector<HTMLFormElement>("#batch-activity-form")!;
    const dialog = form.closest("dialog")!;
    const disclosure = openBatchTools();
    const summary = within(detail).getByRole("button", { name: "More batch tools" });
    const textarea = form.querySelector("textarea")!;
    const date = form.querySelector<HTMLInputElement>('[name="date"]')!;
    const file = form.querySelector<HTMLInputElement>('[name="photo"]')!;
    fireEvent.click(within(disclosure).getByRole("button", { name: "Take photo" }));
    const selected = new File(["photo"], "draft.jpg", { type: "image/jpeg" });
    fireEvent.change(file, { target: { files: [selected] } });
    fireEvent.change(textarea, { target: { value: "Unsent draft" } });
    fireEvent.change(date, { target: { value: addDaysForTest(localDateForTest(), -2) } });
    fireEvent.click(summary);
    expect(disclosure.hidden).toBe(true);
    expect(dialog.closest("details")).toBeNull();
    expect(within(detail).queryByRole("button", { name: "Log activity" })).toBeNull();
    detail.scrollTop = 123;
    fireEvent.click(within(detail).getByRole("button", { name: "Add observation" }));
    expect(disclosure.hidden).toBe(true);
    expect(dialog.closest("[hidden]")).toBeNull();
    expect(detail.scrollTop).toBe(123);
    expect(screen.getByRole("dialog")).toBe(dialog);
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(disclosure.hidden).toBe(true);
    expect(within(detail).queryByRole("button", { name: "Log activity" })).toBeNull();
    for (const route of ["Checks", "Profiles", "My batches"]) {
      fireEvent.click(screen.getByRole("button", { name: route }));
      for (const width of [344, 884]) {
        Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
        fireEvent(window, new Event("resize"));
        expect(document.querySelector("#batch-activity-form")).toBe(form);
        expect(form.closest("dialog")).toBe(dialog);
        expect(form.querySelector("textarea")).toBe(textarea);
        expect(form.querySelector('[name="date"]')).toBe(date);
        expect(form.querySelector('[name="photo"]')).toBe(file);
        expect(file.files?.[0]).toBe(selected);
      }
    }
    openBatchTools();
    expect(textarea.value).toBe("Unsent draft");
    expect(date.value).toBe(addDaysForTest(localDateForTest(), -2));
    expect(within(detail).getByRole("button", { name: "Log activity" })).toBeTruthy();
  });

  it("keeps the real upcoming calendar and ready actions behind More batch actions", () => {
    const today = localDateForTest();
    const profile = { ...createProfileState().profiles[0], checks: [{ name: "Taste", intervalDays: 2 }] };
    const first = createBatch(profile, { id: "first", name: "First jar", startDate: addDaysForTest(today, -2), today });
    const second = createBatch(profile, { id: "second", name: "Second jar", startDate: addDaysForTest(today, -2), today });
    const ready = { ...createBatch(profile, { id: "ready", name: "Ready jar", startDate: today }), status: "ready" as const };
    localStorage.setItem("fermentstation.batches", JSON.stringify(createBatchState([first, second, ready])));
    render(<App />);
    const dashboard = within(document.querySelector(".design-dashboard")!);
    const summary = dashboard.getByText(/More batch actions/);
    const disclosure = summary.closest("details")!;
    expect(disclosure.open).toBe(false);
    expect(screen.queryByRole("region", { name: /Upcoming/ })).toBeNull();
    expect(screen.queryByRole("button", { name: `Choose a batch for ${today}` })).toBeNull();
    expect(screen.queryByRole("button", { name: "Open ready batch Ready jar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Active · attention" })).toBeNull();
    expect(dashboard.getByRole("button", { name: "Complete Taste for First jar" })).toBeTruthy();
    expect(dashboard.getByRole("button", { name: "Open Second jar for Taste" })).toBeTruthy();
    fireEvent.click(summary);
    expect(disclosure.open).toBe(true);
    expect(dashboard.getByRole("region", { name: /Upcoming/ })).toBeTruthy();
    expect(dashboard.getByRole("button", { name: "Open ready batch Ready jar" })).toBeTruthy();
    expect(dashboard.getByRole("button", { name: "Active · attention" })).toBeTruthy();
    fireEvent.click(dashboard.getByRole("button", { name: `Choose a batch for ${today}` }));
    const chooser = within(screen.getByRole("dialog", { name: `Choose a batch for ${today}` }));
    expect(chooser.getByRole("button", { name: "Open First jar" })).toBeTruthy();
    expect(chooser.getByRole("button", { name: "Open Second jar" })).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(summary);
    expect(screen.queryByRole("region", { name: /Upcoming/ })).toBeNull();
    expect(screen.queryByRole("link", { name: "Open calendar" })).toBeNull();
    fireEvent.click(summary);
    fireEvent.click(dashboard.getByRole("link", { name: "Open calendar" }));
    expect(screen.getByRole("region", { name: "Fermentation calendar" })).toBeTruthy();
  });

  it("reveals restored photos before logger focus and ignores restoration for an unmounted batch", async () => {
    const today = localDateForTest();
    const profile = createProfileState().profiles[0];
    const first = createBatch(profile, { id: "first", name: "First jar", startDate: today });
    const second = createBatch(profile, { id: "second", name: "Second jar", startDate: today });
    localStorage.setItem("fermentstation.batches", JSON.stringify(createBatchState([first, second])));
    const listeners: Array<(photo: camera.CapturedPhoto) => void> = [];
    const dispose = vi.fn();
    const listen = vi.spyOn(camera, "listenForRestoredCameraPhoto").mockImplementation(async (listener) => { listeners.push(listener); return dispose; });
    const frames: FrameRequestCallback[] = [];
    const raf = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => { frames.push(callback); return frames.length; });
    const photo = { name: "restored.jpg", mimeType: "image/jpeg", dataUrl: "data:image/jpeg;base64,cGhvdG8=" };
    try {
      render(<App />);
      await act(async () => {});
      const firstListener = listeners[0];
      fireEvent.click(screen.getByRole("button", { name: "Open Second jar" }));
      await act(async () => {});
      expect(dispose).toHaveBeenCalledTimes(1);
      const form = document.querySelector<HTMLFormElement>("#batch-activity-form")!;
      const dialog = form.closest("dialog")!;
      const textarea = form.querySelector("textarea")!;
      const detail = within(screen.getByRole("complementary", { name: "Selected batch" }));
      const toggle = detail.getByRole("button", { name: "More batch tools" });
      act(() => firstListener(photo));
      expect(toggle.getAttribute("aria-expanded")).toBe("false");
      expect(screen.queryByText("Photo captured. Add a caption or save the activity.")).toBeNull();
      act(() => listeners.at(-1)!(photo));
      expect(toggle.getAttribute("aria-expanded")).toBe("true");
      expect(form.closest("[hidden]")).toBeNull();
      const focusTarget = form.querySelector<HTMLElement>("input:not([type=file]), textarea, button")!;
      const focus = vi.spyOn(focusTarget, "focus").mockImplementation(() => { expect(form.closest("[hidden]")).toBeNull(); });
      act(() => frames.splice(0).forEach((callback) => callback(0)));
      expect(focus).toHaveBeenCalledWith({ preventScroll: true });
      expect(within(form).getByLabelText("Photo")).toBeTruthy();
      expect(screen.getByText("Photo captured. Add a caption or save the activity.")).toBeTruthy();
      fireEvent.click(toggle);
      fireEvent.click(detail.getByRole("button", { name: "Add observation" }));
      act(() => listeners.at(-1)!({ ...photo, name: "latest.jpg" }));
      expect(toggle.getAttribute("aria-expanded")).toBe("false");
      expect(screen.getByRole("dialog")).toBe(dialog);
      expect(dialog.closest("[hidden]")).toBeNull();
      expect(document.querySelector("#batch-activity-form")).toBe(form);
      expect(form.querySelector("textarea")).toBe(textarea);
      fireEvent.click(within(dialog).getByRole("button", { name: "Log activity" }));
      const stored = JSON.parse(localStorage.getItem("fermentstation.batches")!);
      expect(stored.batches[0].timeline).toEqual([]);
      expect(stored.batches[1].timeline).toEqual([expect.objectContaining({ kind: "photo", name: "latest.jpg" })]);
      expect(screen.queryByRole("dialog")).toBeNull();
      focus.mockRestore();
    } finally { cleanup(); listen.mockRestore(); raf.mockRestore(); }
  });

  it("promotes the one observation logger and demotes without losing nodes or drafts", () => {
    const batch = createBatch(createProfileState().profiles[0], { id: "jar", name: "Observation jar", startDate: localDateForTest() });
    localStorage.setItem("fermentstation.batches", JSON.stringify(createBatchState([batch])));
    render(<App />);
    const form = document.querySelector<HTMLFormElement>("#batch-activity-form")!;
    const textarea = form.querySelector("textarea")!;
    const date = form.querySelector<HTMLInputElement>('[name="date"]')!;
    const file = form.querySelector<HTMLInputElement>('[name="photo"]')!;
    const dialog = form.closest("dialog")!;
    expect(dialog).toBeTruthy();
    expect(dialog.open).toBe(true);
    const before = localStorage.getItem("fermentstation.batches");
    const trigger = screen.getByRole("button", { name: "Add observation" });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getAllByRole("dialog")).toEqual([dialog]);
    expect(nativeClose.mock.invocationCallOrder[0]).toBeLessThan(nativeShowModal.mock.invocationCallOrder[0]);
    expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Close dialog" }));
    expect(within(dialog).getByLabelText("Observation")).toBe(textarea);
    expect(textarea.maxLength).toBe(500);
    expect(textarea.placeholder).toBe("What do you notice about this batch?");
    const temperature = within(dialog).getByLabelText("Temperature reading (°C)") as HTMLInputElement;
    expect([temperature.value, temperature.min, temperature.max, temperature.step]).toEqual(["", "-20", "100", "0.1"]);
    expect(dialog.textContent).toContain("Add a note, a reading, or both.");
    expect(date.closest("label")!.hidden).toBe(true);
    fireEvent.change(textarea, { target: { value: "Keep this observation" } });
    fireEvent.change(temperature, { target: { value: "0" } });
    fireEvent.click(dialog);
    expect(screen.getByRole("dialog")).toBe(dialog);
    for (const dismiss of ["Cancel", "Close dialog", "Escape"]) {
      if (dismiss === "Escape") fireEvent(dialog, new Event("cancel", { cancelable: true }));
      else fireEvent.click(within(dialog).getByRole("button", { name: dismiss }));
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(dialog.open).toBe(true); // nonmodal inline, not a fake modal
      expect(document.activeElement).toBe(trigger);
      for (const route of dismiss === "Cancel" ? ["Checks", "Profiles", "My batches"] : []) {
        fireEvent.click(screen.getByRole("button", { name: route }));
        for (const width of [344, 884]) {
          Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
          fireEvent(window, new Event("resize"));
          expect(document.querySelectorAll("#batch-activity-form")).toHaveLength(1);
          expect(document.querySelector("#batch-activity-form")).toBe(form);
          expect(form.closest("dialog")).toBe(dialog);
          expect(form.querySelector("textarea")).toBe(textarea);
          expect(form.querySelector('[name="date"]')).toBe(date);
          expect(form.querySelector('[name="photo"]')).toBe(file);
        }
      }
      fireEvent.click(trigger);
      fireEvent(dialog, new Event("close")); // queued inline close must not close the reopened modal
      expect(screen.getByRole("dialog")).toBe(dialog);
      expect(textarea.value).toBe("Keep this observation");
      expect(temperature.value).toBe("0");
    }
    expect(localStorage.getItem("fermentstation.batches")).toBe(before);
    fireEvent.click(screen.getByRole("button", { name: "Calendar" }));
    expect(dialog.open).toBe(true);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it.each([
    { note: "Note only", temperature: "", kinds: ["note"] },
    { note: "", temperature: "21.5", kinds: ["temperature"] },
    { note: "", temperature: "0", kinds: ["temperature"] },
    { note: "  Both together  ", temperature: "18", kinds: ["note", "temperature"] },
  ])("records a basic observation atomically ($note/$temperature)", ({ note, temperature, kinds }) => {
    const today = localDateForTest();
    const profile = { ...createProfileState().profiles[0], checks: [{ name: "Taste", intervalDays: 1 }] };
    const batch = createBatch(profile, { id: "jar", startDate: addDaysForTest(today, -3), today });
    localStorage.setItem("fermentstation.batches", JSON.stringify(createBatchState([batch])));
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Add observation" }));
    const dialog = screen.getByRole("dialog", { name: "Add observation" });
    fireEvent.change(within(dialog).getByLabelText("Observation"), { target: { value: note } });
    fireEvent.change(within(dialog).getByLabelText("Temperature reading (°C)"), { target: { value: temperature } });
    fireEvent.click(screen.getByRole("button", { name: `Complete Taste for ${batch.name}` }));
    const save = vi.spyOn(Storage.prototype, "setItem");
    try {
      fireEvent.click(within(dialog).getByRole("button", { name: "Add observation" }));
      const stored = JSON.parse(localStorage.getItem("fermentstation.batches")!).batches[0];
      const entries = stored.timeline.filter(({ kind }: { kind: string }) => kind !== "check");
      expect(entries.map(({ kind }: { kind: string }) => kind)).toEqual(kinds);
      expect(new Set(entries.map(({ id }: { id: string }) => id)).size).toBe(entries.length);
      expect(entries.every(({ date }: { date: string }) => date === today)).toBe(true);
      if (note) expect(entries[0].text).toBe(note.trim());
      if (temperature !== "") expect(entries.find(({ kind }: { kind: string }) => kind === "temperature").value).toBe(Number(temperature));
      expect(stored.timeline.filter(({ kind }: { kind: string }) => kind === "check")).toHaveLength(1);
      expect(stored.checks[0].lastCompletedDate).toBe(today);
      expect(save.mock.calls.filter(([key]) => key === "fermentstation.batches")).toHaveLength(1);
      expect(screen.queryByRole("dialog")).toBeNull();
    } finally { save.mockRestore(); }
  });

  it("validates empty and out-of-range observations without writes and clears errors on input", () => {
    const batch = createBatch(createProfileState().profiles[0], { id: "jar", startDate: localDateForTest() });
    localStorage.setItem("fermentstation.batches", JSON.stringify(createBatchState([batch])));
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Add observation" }));
    const dialog = screen.getByRole("dialog");
    const textarea = within(dialog).getByLabelText("Observation") as HTMLTextAreaElement;
    const temperature = within(dialog).getByLabelText("Temperature reading (°C)") as HTMLInputElement;
    const submit = within(dialog).getByRole("button", { name: "Add observation" });
    const before = localStorage.getItem("fermentstation.batches");
    fireEvent.click(submit);
    expect(textarea.validationMessage).toBe("Add a note or a temperature reading.");
    fireEvent.input(temperature, { target: { value: "0" } });
    expect(textarea.validationMessage).toBe("");
    for (const value of ["-20.1", "100.1", "1.25"]) {
      fireEvent.input(temperature, { target: { value } });
      expect(temperature.checkValidity()).toBe(false);
      fireEvent.click(submit);
      expect(screen.getByRole("dialog")).toBe(dialog);
      expect(localStorage.getItem("fermentstation.batches")).toBe(before);
    }
    fireEvent.input(textarea, { target: { value: "A valid note" } });
    fireEvent.input(temperature, { target: { value: "" } });
    fireEvent.click(submit);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("stores a basic Fahrenheit observation in Celsius and announces success for 3500ms", () => {
    vi.useFakeTimers();
    try {
      const batch = createBatch(createProfileState().profiles[0], { id: "jar", startDate: localDateForTest() });
      localStorage.setItem("fermentstation.batches", JSON.stringify(createBatchState([batch])));
      localStorage.setItem("fermentstation.shell", JSON.stringify({ ...createShellState(), units: "imperial" }));
      render(<App />);
      const trigger = screen.getByRole("button", { name: "Add observation" });
      fireEvent.click(trigger);
      const dialog = screen.getByRole("dialog", { name: "Add observation" });
      const temperature = within(dialog).getByLabelText("Temperature reading (°F)") as HTMLInputElement;
      expect([temperature.value, temperature.min, temperature.max, temperature.step]).toEqual(["", "-4", "212", "0.1"]);
      const submit = within(dialog).getByRole("button", { name: "Add observation" });
      fireEvent.click(submit);
      expect(screen.queryByRole("status")).toBeNull();
      fireEvent.input(temperature, { target: { value: "68" } });
      fireEvent.change(within(dialog).getByLabelText("Observation"), { target: { value: "A cool room" } });
      fireEvent.click(submit);
      const stored = JSON.parse(localStorage.getItem("fermentstation.batches")!).batches[0];
      expect(stored.timeline).toEqual([
        expect.objectContaining({ kind: "note", text: "A cool room" }),
        expect.objectContaining({ kind: "temperature", value: 20 }),
      ]);
      expect(screen.getByText("Temperature 68°F")).toBeTruthy();
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.activeElement).toBe(trigger);
      expect(screen.getByRole("status").textContent).toBe("Observation added");
      act(() => vi.advanceTimersByTime(3499));
      expect(screen.getByRole("status").textContent).toBe("Observation added");
      act(() => vi.advanceTimersByTime(1));
      expect(screen.queryByRole("status")).toBeNull();
    } finally {
      cleanup();
      vi.useRealTimers();
    }
  });

  it("does not carry basic-only validation into the advanced logger after dismissal", () => {
    const batch = createBatch(createProfileState().profiles[0], { id: "jar", startDate: localDateForTest() });
    localStorage.setItem("fermentstation.batches", JSON.stringify(createBatchState([batch])));
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Add observation" }));
    const dialog = screen.getByRole("dialog");
    const textarea = within(dialog).getByLabelText("Observation") as HTMLTextAreaElement;
    fireEvent.click(within(dialog).getByRole("button", { name: "Add observation" }));
    expect(textarea.validationMessage).toBe("Add a note or a temperature reading.");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    openBatchTools();
    const logger = within(textarea.closest("form")!);
    fireEvent.click(logger.getByRole("button", { name: "Status change" }));
    expect(textarea.validationMessage).toBe("");
    fireEvent.change(logger.getByLabelText("Activity status"), { target: { value: "ready" } });
    fireEvent.click(logger.getByRole("button", { name: "Log activity" }));
    expect(JSON.parse(localStorage.getItem("fermentstation.batches")!).batches[0].status).toBe("ready");
  });

  it.each([
    { kind: "note", text: "Original note" } as const,
    { kind: "ph", value: 4.2 } as const,
    { kind: "temperature", value: 18 } as const,
  ])("resets canceled inline $kind edits without replacing the new-entry form", (entry) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 8, 12));
    try {
      const today = localDateForTest();
      const past = addDaysForTest(today, -7);
      const original = { ...entry, id: "old", date: past };
      const batch = createBatch(createProfileState().profiles[0], { id: "jar", startDate: past, today });
      batch.timeline.push(original);
      localStorage.setItem("fermentstation.batches", JSON.stringify(createBatchState([batch])));
      render(<App />);
      openBatchTools();
      const detail = within(screen.getByRole("complementary", { name: "Selected batch" }));
      const form = document.querySelector<HTMLFormElement>("#batch-activity-form")!;
      const logger = within(form);
      const textarea = logger.getByLabelText("Activity context") as HTMLTextAreaElement;
      const date = logger.getByLabelText("Activity date") as HTMLInputElement;
      const file = form.querySelector('[name="photo"]');
      fireEvent.click(detail.getByRole("button", { name: `Edit ${entry.kind === "ph" ? "pH" : entry.kind} from ${past}` }));
      expect(date.value).toBe(past);
      const edited = entry.kind === "note" ? textarea : form.querySelector<HTMLInputElement>(`[data-value="${entry.kind}"]`)!;
      expect(edited.value).toBe(entry.kind === "note" ? entry.text : String(entry.value));
      fireEvent.input(edited, { target: { value: entry.kind === "note" ? "Canceled changes" : "5.5" } });
      fireEvent.click(logger.getByRole("button", { name: "Cancel" }));
      expect(document.querySelector("#batch-activity-form")).toBe(form);
      expect(logger.getByLabelText("Activity context")).toBe(textarea);
      expect(logger.getByLabelText("Activity date")).toBe(date);
      expect(form.querySelector('[name="photo"]')).toBe(file);
      expect(date.value).toBe(today);
      expect(textarea.value).toBe("");
      expect(Array.from(form.querySelectorAll<HTMLInputElement>("[data-value]")).map((input) => input.value)).toEqual(["", ""]);
      expect(logger.queryByRole("button", { name: "Cancel" })).toBeNull();
      expect(JSON.parse(localStorage.getItem("fermentstation.batches")!).batches[0].timeline).toEqual([original]);
      fireEvent.click(logger.getByRole("button", { name: "Note" }));
      fireEvent.input(textarea, { target: { value: "Fresh observation" } });
      fireEvent.click(logger.getByRole("button", { name: "Log activity" }));
      expect(JSON.parse(localStorage.getItem("fermentstation.batches")!).batches[0].timeline).toEqual([
        original,
        expect.objectContaining({ id: expect.any(String), kind: "note", date: today, text: "Fresh observation" }),
      ]);
    } finally {
      cleanup();
      vi.useRealTimers();
    }
  });

  it("retains advanced photo and long edit drafts across modal dismissal", () => {
    const today = localDateForTest();
    const batch = createBatch(createProfileState().profiles[0], { id: "jar", startDate: today });
    batch.timeline.push({ id: "long", kind: "note", date: today, text: "x".repeat(650) });
    localStorage.setItem("fermentstation.batches", JSON.stringify(createBatchState([batch])));
    render(<App />);
    openBatchTools();
    fireEvent.click(screen.getByRole("button", { name: "Take photo" }));
    const file = screen.getByLabelText("Photo") as HTMLInputElement;
    const selected = new File(["bytes"], "draft.jpg", { type: "image/jpeg" });
    fireEvent.change(file, { target: { files: [selected] } });
    fireEvent.change(screen.getByLabelText("Caption"), { target: { value: "Photo draft" } });
    const draftDate = addDaysForTest(today, -2);
    const date = screen.getByLabelText("Activity date") as HTMLInputElement;
    fireEvent.change(date, { target: { value: draftDate } });
    const before = localStorage.getItem("fermentstation.batches");
    fireEvent.click(screen.getByRole("button", { name: "Add observation" }));
    let dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("Photo")).toBe(file);
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(file.files?.[0]).toBe(selected);
    expect((screen.getByLabelText("Caption") as HTMLInputElement).value).toBe("Photo draft");
    expect(screen.getByLabelText("Activity date")).toBe(date);
    expect(date.value).toBe(draftDate);
    const form = file.closest("form");
    for (const route of ["Checks", "Profiles", "My batches"]) {
      fireEvent.click(screen.getByRole("button", { name: route }));
      for (const width of [344, 884]) {
        Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
        fireEvent(window, new Event("resize"));
        expect(document.querySelector('[name="photo"]')).toBe(file);
        expect(file.closest("form")).toBe(form);
        expect(form!.querySelector('[name="date"]')).toBe(date);
        expect(file.files?.[0]).toBe(selected);
      }
    }
    fireEvent.click(screen.getByRole("button", { name: `Edit note from ${today}` }));
    const textarea = screen.getByLabelText("Activity context") as HTMLTextAreaElement;
    fireEvent.click(screen.getByRole("button", { name: "Add observation" }));
    dialog = screen.getByRole("dialog");
    expect(textarea.value).toHaveLength(650);
    expect(textarea.hasAttribute("maxlength")).toBe(false);
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(screen.getByLabelText("Activity context")).toBe(textarea);
    expect(textarea.value).toHaveLength(650);
    expect(screen.getByRole("button", { name: "Save activity" })).toBeTruthy();
    expect(localStorage.getItem("fermentstation.batches")).toBe(before);
  });

  it("opens one compact Start dialog without changing the workspace and cancels fresh drafts", () => {
    const batch = createBatch(createProfileState().profiles[0], { id: "jar", name: "Selected jar", startDate: localDateForTest() });
    localStorage.setItem("fermentstation.batches", JSON.stringify(createBatchState([batch])));
    render(<App />);
    const header = document.querySelector(".design-topbar");
    const detail = screen.getByRole("complementary", { name: "Selected batch" });
    for (const route of ["My batches", "Checks", "Profiles"]) {
      fireEvent.click(screen.getByRole("button", { name: route }));
      const destination = localStorage.getItem("fermentstation.shell");
      const stored = localStorage.getItem("fermentstation.batches");
      const trigger = screen.getByRole("button", { name: "Start a batch" });
      trigger.focus();
      detail.scrollTop = 123;
      fireEvent.click(trigger);
      const dialog = screen.getByRole("dialog", { name: "Start a batch" });
      expect(dialog.tagName).toBe("DIALOG");
      expect(screen.getAllByRole("dialog")).toHaveLength(1);
      expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Close dialog" }));
      expect(Array.from(dialog.querySelectorAll("input, select")).slice(0, 3).map((field) => field.getAttribute("name"))).toEqual(["name", "profileId", "startDate"]);
      fireEvent.change(within(dialog).getByLabelText("Batch name"), { target: { value: "Canceled draft" } });
      fireEvent.click(dialog); // The backdrop/shell is not a dismiss action.
      expect(screen.getByRole("dialog")).toBe(dialog);
      fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.activeElement).toBe(trigger);
      expect(localStorage.getItem("fermentstation.shell")).toBe(destination);
      expect(localStorage.getItem("fermentstation.batches")).toBe(stored);
      expect(document.querySelector(".design-topbar")).toBe(header);
      expect(screen.getByRole("complementary", { name: "Selected batch" })).toBe(detail);
      expect(detail.scrollTop).toBe(123);
      fireEvent.click(trigger);
      expect((screen.getByLabelText("Batch name") as HTMLInputElement).value).toBe("");
      expect(fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }))).toBe(false);
      expect(screen.queryByRole("dialog")).toBeNull();
    }
  });

  it("hands a real profile to the same Start shell and preserves optional names and advanced inputs", () => {
    const state = createProfileState();
    state.profiles[1] = { ...state.profiles[1], expectedDurationDays: 7, inputs: [{ name: "Cabbage", unit: "kg", defaultValue: 1 }], calculations: [{ name: "salt", unit: "g", formula: "Cabbage * 2%" }], checks: [{ name: "Brine", intervalDays: 1 }] };
    localStorage.setItem("fermentstation.profiles", JSON.stringify(state));
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Profiles" }));
    fireEvent.click(screen.getByRole("button", { name: "View Kimchi guidance" }));
    const dialog = screen.getByRole("dialog", { name: "Kimchi" });
    expect(dialog.textContent).toContain("7 days");
    expect(dialog.textContent).toContain("Cabbage 1 kg");
    expect(dialog.textContent).toContain("Brine · every 1 day");
    expect(nativeShowModal).toHaveBeenCalledTimes(1);
    fireEvent.click(within(dialog).getByRole("button", { name: "Start a batch" }));
    expect(screen.getByRole("dialog", { name: "Start a batch" })).toBe(dialog);
    expect(nativeClose).toHaveBeenCalledTimes(1);
    expect(nativeShowModal).toHaveBeenCalledTimes(2);
    expect(nativeClose.mock.invocationCallOrder[0]).toBeLessThan(nativeShowModal.mock.invocationCallOrder[1]);
    expect((screen.getByLabelText("Fermentation profile") as HTMLSelectElement).value).toBe(state.profiles[1].id);
    expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Close dialog" }));
    const options = within(dialog).getByText("Batch input options").closest("details")!;
    expect(options.open).toBe(false);
    fireEvent.click(within(options).getByText("Batch input options"));
    fireEvent.change(screen.getByLabelText("Cabbage (kg)"), { target: { value: "2.5" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Start a batch" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    const stored = JSON.parse(localStorage.getItem("fermentstation.batches")!).batches[0];
    expect(nativeClose).toHaveBeenCalledTimes(2);
    expect(stored).toMatchObject({ name: "Kimchi", inputValues: { Cabbage: 2.5 }, calculationValues: { salt: { suggested: 50 } }, profileSnapshot: { id: state.profiles[1].id } });
    expect(screen.getByRole("status").textContent).toBe("Batch started · Kimchi");
  });

  it("reads Dates, Inputs and guidance from the selected batch snapshot even after profile deletion", () => {
    const profile = { ...createProfileState().profiles[0], guidance: ["Snapshot guidance."], inputs: [{ name: "Tea", unit: "l" as const, defaultValue: 2 }], expectedDurationDays: 7 };
    const batch = createBatch(profile, { id: "jar", name: "Snapshot jar", startDate: localDateForTest(), inputValues: { Tea: 3 } });
    localStorage.setItem("fermentstation.profiles", JSON.stringify({ profiles: [] }));
    localStorage.setItem("fermentstation.batches", JSON.stringify(createBatchState([batch])));
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Open Snapshot jar" }));
    const stored = localStorage.getItem("fermentstation.batches");
    fireEvent.click(screen.getByRole("button", { name: "View batch dates" }));
    let dialog = screen.getByRole("dialog", { name: "Batch dates" });
    expect(dialog.querySelector("input")).toBeNull();
    expect(Array.from(dialog.querySelectorAll("dt")).map((e) => e.textContent)).toEqual(["Start date", "Finish date", "Batch status"]);
    expect(dialog.querySelectorAll("dd")[2].textContent).toBe("Active");
    fireEvent.click(within(dialog).getByRole("button", { name: "Close dialog" }));
    fireEvent.click(within(document.querySelector(".design-input-summary")!).getByRole("button", { name: "See all" }));
    dialog = screen.getByRole("dialog", { name: "Profile inputs" });
    expect(dialog.textContent).toContain("Tea 2 L");
    expect(dialog.textContent).not.toContain("Tea 3 L");
    expect(dialog.textContent).toContain("Snapshot guidance.");
    expect(fireEvent(dialog, new Event("cancel", { cancelable: true }))).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "See fermentation profile" }));
    dialog = screen.getByRole("dialog", { name: profile.name });
    expect(dialog.textContent).toContain("Snapshot guidance.");
    expect(dialog.textContent).toContain("7 days");
    fireEvent.click(within(dialog).getByRole("button", { name: "Start a batch" }));
    expect((screen.getByLabelText("Fermentation profile") as HTMLSelectElement).value).toBe(profile.id);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
    expect(localStorage.getItem("fermentstation.batches")).toBe(stored);
    openBatchTools();
    expect(screen.getByRole("button", { name: "Edit batch dates" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Edit batch inputs and calculations" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Edit recurring checks" })).toBeTruthy();
  });

  it("opens truthful station information and keeps Settings and installed credits reachable", () => {
    render(<App />);
    fireEvent.click(screen.getAllByRole("button", { name: "Open station information" })[0]);
    const dialog = screen.getByRole("dialog", { name: "Your fermentation station" });
    expect(dialog.tagName).toBe("DIALOG");
    expect(dialog.textContent).not.toMatch(/reset on reload|prototype|browser tab/);
    expect(dialog.textContent).toContain("saved on this device");
    fireEvent.click(within(dialog).getByRole("button", { name: "Settings" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("heading", { name: "Credits and licenses" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "SIL Open Font License 1.1" })).toBeTruthy();
  });

  it("validates Start dates without writes and keeps real input defaults after a canceled draft", () => {
    const state = createProfileState();
    state.profiles[0].inputs = [{ name: "Tea", unit: "l", defaultValue: 2 }];
    localStorage.setItem("fermentstation.profiles", JSON.stringify(state));
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Start a batch" }));
    fireEvent.click(screen.getByText("Batch input options"));
    fireEvent.change(screen.getByLabelText("Tea (l)"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Start a batch" }));
    const dialog = screen.getByRole("dialog");
    const date = within(dialog).getByLabelText("Start date") as HTMLInputElement;
    expect(date.max).toBe(localDateForTest());
    expect(date.required).toBe(true);
    const before = localStorage.getItem("fermentstation.batches");
    for (const value of ["", addDaysForTest(localDateForTest(), 1)]) {
      fireEvent.change(date, { target: { value } });
      act(() => { expect(date.checkValidity()).toBe(false); });
      fireEvent.click(newBatchSubmit());
      expect(screen.getByRole("dialog")).toBe(dialog);
      expect(localStorage.getItem("fermentstation.batches")).toBe(before);
      expect(screen.queryByRole("status")).toBeNull();
    }
    fireEvent.change(date, { target: { value: localDateForTest() } });
    fireEvent.change(within(dialog).getByLabelText("Batch name"), { target: { value: "   " } });
    fireEvent.click(screen.getByText("Batch input options"));
    expect((screen.getByLabelText("Tea (l)") as HTMLInputElement).value).toBe("2");
    fireEvent.click(newBatchSubmit());
    expect(JSON.parse(localStorage.getItem("fermentstation.batches")!).batches[0]).toMatchObject({ name: "Kombucha F1", inputValues: { Tea: 2 } });
  });

  it("reveals secondary editing in the selected detail scroller and focuses without outer scrolling", () => {
    const batch = createBatch(createProfileState().profiles[0], { id: "jar", startDate: localDateForTest() });
    batch.timeline.push({ id: "note", kind: "note", date: localDateForTest(), text: "Edit this real entry" });
    localStorage.setItem("fermentstation.batches", JSON.stringify(createBatchState([batch])));
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Open Kombucha F1" }));
    const detail = screen.getByRole("complementary", { name: "Selected batch" });
    const tools = openBatchTools();
    const target = document.getElementById("batch-date-editor")!;
    const date = within(target).getByLabelText("Finish date");
    const scroll = vi.fn();
    Object.defineProperty(detail, "scrollTo", { configurable: true, value: scroll });
    const detailRect = vi.spyOn(detail, "getBoundingClientRect").mockReturnValue(new DOMRect(100, 100, 300, 600));
    const targetRect = vi.spyOn(target, "getBoundingClientRect").mockImplementation(() => {
      expect(tools.hidden).toBe(false);
      expect(target.closest("[hidden]")).toBeNull();
      return new DOMRect(100, 700, 300, 100);
    });
    const focus = vi.spyOn(date, "focus");
    const frames: FrameRequestCallback[] = [];
    const raf = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => { frames.push(callback); return frames.length; });
    try {
      detail.scrollTop = 120;
      fireEvent.click(screen.getByRole("button", { name: "Edit batch dates" }));
      expect(scroll).toHaveBeenCalledWith({ top: 704, behavior: "smooth" });
      expect(focus).toHaveBeenCalledWith({ preventScroll: true });
      expect(document.activeElement).toBe(date);
      expect(document.querySelector(".app-shell")!.scrollTop).toBe(0);
      const form = document.querySelector<HTMLFormElement>("#batch-activity-form")!;
      const formRect = vi.spyOn(form, "getBoundingClientRect").mockImplementation(() => {
        expect(form.closest("[hidden]")).toBeNull();
        return new DOMRect(100, 900, 300, 200);
      });
      try {
        fireEvent.click(within(detail).getByRole("button", { name: `Edit note from ${localDateForTest()}` }));
        expect(within(form).getByLabelText("Activity context")).toHaveProperty("value", "Edit this real entry");
        act(() => frames.splice(0).forEach((callback) => callback(0)));
        expect(scroll).toHaveBeenLastCalledWith({ top: 904, behavior: "smooth" });
        expect(document.activeElement).toBe(within(form).getByLabelText("Activity context"));
        expect(within(detail).getByRole("button", { name: "More batch tools" }).getAttribute("aria-expanded")).toBe("true");
      } finally { formRect.mockRestore(); }
    } finally {
      detailRect.mockRestore();
      targetRect.mockRestore();
      focus.mockRestore();
      raf.mockRestore();
    }
  });

  it("announces an actual completion for 3500ms without duplicating its timeline entry", () => {
    vi.useFakeTimers();
    try {
      const today = localDateForTest();
      const profile = { ...createProfileState().profiles[0], checks: [{ name: "Taste", intervalDays: 2 }] };
      const batch = createBatch(profile, { id: "jar", startDate: today });
      localStorage.setItem("fermentstation.batches", JSON.stringify(createBatchState([batch])));
      render(<App />);
      fireEvent.click(screen.getByRole("button", { name: "Checks" }));
      fireEvent.click(screen.getByRole("button", { name: "Complete Taste for Kombucha F1" }));
      expect(screen.getByRole("status").textContent).toMatch(/^Check completed · next due /);
      fireEvent.click(screen.getByRole("button", { name: "Completed Taste for Kombucha F1" }));
      expect(JSON.parse(localStorage.getItem("fermentstation.batches")!).batches[0].timeline.filter(({ kind }: { kind: string }) => kind === "check")).toHaveLength(1);
      act(() => vi.advanceTimersByTime(3499));
      expect(screen.getByRole("status")).toBeTruthy();
      act(() => vi.advanceTimersByTime(1));
      expect(screen.queryByRole("status")).toBeNull();
    } finally {
      cleanup();
      vi.useRealTimers();
    }
  });

  it("opens real Checks from navigation and bell without replacing Calendar or persisting a new destination", () => {
    const today = localDateForTest();
    const profile = { ...createProfileState().profiles[0], checks: [{ id: "taste", name: "Taste", intervalDays: 2 }] };
    const active = createBatch(profile, { id: "active", name: "Active jar", startDate: addDaysForTest(today, -4), today });
    const future = createBatch(profile, { id: "future", name: "Future jar", startDate: today, today });
    const paused = { ...createBatch(profile, { id: "paused", name: "Paused jar", startDate: today, today }), status: "ready" as const };
    localStorage.setItem("fermentstation.batches", JSON.stringify(createBatchState([active, future, paused])));
    render(<App />);
    expect(screen.queryByRole("button", { name: "Complete Taste for Future jar" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Checks" }));
    expect(screen.getByRole("heading", { name: "Your batch checks" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Calendar" })).toBeNull();
    expect(JSON.parse(localStorage.getItem("fermentstation.shell")!).destination).toBe("batches");
    expect(screen.getByRole("button", { name: "Complete Taste for Future jar" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Complete Taste for Paused jar" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Complete Taste for Active jar" }));
    expect((screen.getByRole("button", { name: "Completed Taste for Active jar" }) as HTMLButtonElement).disabled).toBe(true);
    const stored = JSON.parse(localStorage.getItem("fermentstation.batches")!).batches[0];
    expect(stored.checks[0]).toMatchObject({ lastCompletedDate: today, nextDueDate: addDaysForTest(today, 2) });
    expect(stored.timeline).toContainEqual(expect.objectContaining({ kind: "check", checkName: "Taste", date: today }));
    expect(screen.getByRole("status").textContent).toBe(`Check completed · next due ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(`${addDaysForTest(today, 2)}T12:00:00`))}`);
    fireEvent.click(screen.getByRole("button", { name: "Calendar" }));
    expect(screen.getByRole("heading", { name: "Calendar" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "My batches" }));
    expect(screen.queryByRole("button", { name: "Complete Taste for Active jar" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "View batch checks" }));
    expect(screen.getByRole("heading", { name: "Your batch checks" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Completed Taste for Active jar" })).toBeTruthy();
  });

  it.each(["Checks", "Profiles", "My batches", "Calendar", "Settings"])("keeps the selected detail and exact logger nodes across %s and responsive postures", (route) => {
    const batch = createBatch(createProfileState().profiles[0], { id: "jar", name: "Selected jar", startDate: localDateForTest() });
    localStorage.setItem("fermentstation.batches", JSON.stringify(createBatchState([batch])));
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Open Selected jar" }));
    openBatchTools();
    fireEvent.click(screen.getByRole("button", { name: "Note" }));
    const draft = screen.getByLabelText("Activity context") as HTMLTextAreaElement;
    const form = draft.closest("form");
    const dialog = form!.closest("dialog");
    const date = form!.querySelector('[name="date"]');
    const file = form!.querySelector('[name="photo"]');
    const ancestors: Element[] = [];
    for (let parent = draft.parentElement; parent; parent = parent.parentElement) ancestors.push(parent);
    const header = document.querySelector(".design-topbar");
    const detail = screen.getByRole("complementary", { name: "Selected batch" });
    fireEvent.change(draft, { target: { value: "Keep the same draft" } });
    detail.scrollTop = 420;
    fireEvent.click(screen.getByRole("button", { name: route }));
    expect(document.querySelector(".design-topbar")).toBe(header);
    expect(document.querySelector("#batch-activity-form")).toBe(form);
    expect(document.querySelector("[aria-label='Activity context']")).toBe(draft);
    expect(draft.value).toBe("Keep the same draft");
    expect(detail.scrollTop).toBe(420);
    expect(document.querySelector(".app-shell")?.classList.contains("has-open-batch")).toBe(false);
    for (const width of [320, 390, 640, 768, 884, 900, 901, 1024, 1440]) {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
      fireEvent(window, new Event("resize"));
      expect(document.querySelector("#batch-activity-form")).toBe(form);
      expect(form!.closest("dialog")).toBe(dialog);
      expect(form!.querySelector('[name="date"]')).toBe(date);
      expect(form!.querySelector('[name="photo"]')).toBe(file);
      const currentAncestors: Element[] = [];
      for (let parent = draft.parentElement; parent; parent = parent.parentElement) currentAncestors.push(parent);
      expect(currentAncestors).toEqual(ancestors);
    }
    fireEvent.click(screen.getByRole("button", { name: "My batches" }));
    fireEvent.click(screen.getByRole("button", { name: "Open Selected jar" }));
    expect(screen.getByLabelText("Activity context")).toBe(draft);
    fireEvent.click(screen.getByRole("button", { name: "Log activity" }));
    expect(JSON.parse(localStorage.getItem("fermentstation.batches")!).batches[0].timeline).toContainEqual(expect.objectContaining({ kind: "note", text: "Keep the same draft" }));
  });

  it("completes the next due check directly from detail without opening tools or requiring an observation", () => {
    const today = localDateForTest();
    const profile = { ...createProfileState().profiles[0], checks: [{ id: "taste", name: "Taste", intervalDays: 2 }] };
    const batch = createBatch(profile, { id: "jar", name: "Daily jar", startDate: addDaysForTest(today, -4), today });
    localStorage.setItem("fermentstation.batches", JSON.stringify(createBatchState([batch])));
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Open Daily jar" }));
    const detail = within(screen.getByRole("complementary", { name: "Selected batch" }));
    expect(detail.getByRole("button", { name: "More batch tools" }).getAttribute("aria-expanded")).toBe("false");
    const next = within(detail.getByRole("region", { name: "Next batch check" }));
    expect(next.getByText("Taste")).toBeTruthy();
    const complete = next.getByRole("button", { name: "Complete check: Taste for this batch" });
    const observation = detail.getByRole("button", { name: "Add observation" });
    const focus = vi.spyOn(observation, "focus");
    complete.focus();
    fireEvent.click(complete);
    expect(document.activeElement).toBe(observation);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    focus.mockRestore();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(detail.getByRole("button", { name: "More batch tools" }).getAttribute("aria-expanded")).toBe("false");
    expect(next.queryByRole("button", { name: "Complete check: Taste for this batch" })).toBeNull();
    const stored = JSON.parse(localStorage.getItem("fermentstation.batches")!).batches[0];
    expect(stored.checks[0]).toMatchObject({ lastCompletedDate: today, nextDueDate: addDaysForTest(today, 2) });
    expect(stored.timeline).toEqual([expect.objectContaining({ kind: "check", checkName: "Taste", date: today })]);
  });

  it("reflects edited cadence and pauses and resumes checks with batch status", () => {
    const today = localDateForTest();
    const profile = { ...createProfileState().profiles[0], checks: [{ id: "taste", name: "Taste", intervalDays: 2 }] };
    const batch = createBatch(profile, { id: "jar", name: "House jar", startDate: today, today });
    localStorage.setItem("fermentstation.batches", JSON.stringify(createBatchState([batch])));
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Open House jar" }));
    openBatchTools();
    fireEvent.change(screen.getByLabelText("Taste interval days"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Checks" }));
    const checks = within(screen.getByRole("region", { name: "Batch checks" }));
    expect(checks.getByText(`House jar · Due ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(`${addDaysForTest(today, 3)}T12:00:00`))}`)).toBeTruthy();
    fireEvent.click(checks.getByRole("button", { name: "Open House jar for Taste" }));
    fireEvent.change(screen.getByLabelText("Activity status"), { target: { value: "ready" } });
    fireEvent.click(screen.getByRole("button", { name: "Log activity" }));
    fireEvent.click(screen.getByRole("button", { name: "Checks" }));
    expect(screen.queryByRole("button", { name: "Complete Taste for House jar" })).toBeNull();
    expect(screen.getByText("No checks scheduled for your active batches.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "My batches" }));
    fireEvent.click(screen.getByRole("button", { name: "Open House jar" }));
    fireEvent.change(screen.getByLabelText("Activity status"), { target: { value: "active" } });
    fireEvent.click(screen.getByRole("button", { name: "Log activity" }));
    fireEvent.click(screen.getByRole("button", { name: "Checks" }));
    expect(screen.getByRole("button", { name: "Complete Taste for House jar" })).toBeTruthy();
    const stored = JSON.parse(localStorage.getItem("fermentstation.batches")!).batches[0];
    expect(stored.checks[0]).toMatchObject({ intervalDays: 3, nextDueDate: addDaysForTest(today, 3) });
    expect(stored.checksPausedAt).toBeUndefined();
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.queryByRole("region", { name: "Fermentation workspace" })).toBeNull();
    expect(screen.queryByRole("complementary", { name: "Selected batch" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Calendar" }));
    expect(screen.getByRole("heading", { name: "Calendar" })).toBeTruthy();
  });

  it("keeps every stored profile and exposes CRUD outside the compact guidance grid", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Profiles" }));
    expect(screen.getByRole("heading", { name: "Fermentation profiles" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /^View .* guidance$/ })).toHaveLength(createProfileState().profiles.length);
    expect(screen.getByText("Manage profiles").closest("details")?.open).toBe(false);
    expect(screen.getByRole("button", { name: "Edit Kombucha F1" }).closest("details")).toBe(screen.getByText("Manage profiles").closest("details"));
    fireEvent.click(profileManagementButton("Add profile"));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "House culture" } });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    expect(screen.getByRole("button", { name: "View House culture guidance" })).toBeTruthy();
    fireEvent.click(profileManagementButton("Delete House culture"));
    expect(screen.queryByRole("button", { name: "View House culture guidance" })).toBeNull();
  });

  it("shows the profile cards and opens profile guidance", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Profiles" }));

    expect(screen.getByRole("heading", { name: "Fermentation profiles" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "View Kombucha F1 guidance" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "View Milk kefir guidance" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "View Kombucha F1 guidance" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("Keep at room temperature and cover with a breathable cloth.");
    expect(within(dialog).getByRole("heading", { name: "Profile checks" })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Close dialog" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("explains an empty profile list and keeps profile creation available", () => {
    localStorage.setItem("fermentstation.profiles", JSON.stringify({ profiles: [] }));
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Profiles" }));
    expect(screen.getByRole("heading", { name: "No fermentation profiles yet" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^View .* guidance$/ })).toBeNull();
    fireEvent.click(profileManagementButton("Add profile"));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "House method" } });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    expect(screen.queryByRole("heading", { name: "No fermentation profiles yet" })).toBeNull();
    expect(screen.getByRole("button", { name: "View House method guidance" })).toBeTruthy();
  });

  it("supports an empty profile check list and stable check editing", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Profiles" }));
    fireEvent.click(profileManagementButton("Edit Kombucha F1"));

    expect((screen.getByLabelText(/Expected duration/) as HTMLInputElement).value).toBe("");
    expect(screen.getByText(/No recurring checks yet/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add check" }));
    const name = screen.getByLabelText("Check name 1");
    expect(document.activeElement).toBe(name);
    fireEvent.change(name, { target: { value: "Taste" } });
    fireEvent.change(screen.getByLabelText("Check interval 1"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Remove Taste" }));
    expect(screen.getByText(/No recurring checks yet/)).toBeTruthy();
  });

  it("links rejected profile temperature ranges to both adjacent fields without writes", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Profiles" }));
    fireEvent.click(profileManagementButton("Edit Kombucha F1"));
    const before = localStorage.getItem("fermentstation.profiles");
    const min = screen.getByLabelText("Temperature minimum");
    const max = screen.getByLabelText("Temperature maximum");
    fireEvent.change(min, { target: { value: "25" } });
    fireEvent.change(max, { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    for (const field of [min, max]) {
      expect(field.getAttribute("aria-invalid")).toBe("true");
      const message = document.getElementById(field.getAttribute("aria-describedby")!);
      expect(message?.textContent).toContain("minimum no greater than the maximum");
      expect(field.closest("label")!.contains(message)).toBe(true);
    }
    expect(localStorage.getItem("fermentstation.profiles")).toBe(before);
  });

  it("links native Start validation to its field without changing validation or writes", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Start a batch" }));
    const date = screen.getByLabelText("Start date");
    fireEvent.change(date, { target: { value: "" } });
    const before = localStorage.getItem("fermentstation.batches");
    fireEvent.click(newBatchSubmit());
    expect(date.getAttribute("aria-invalid")).toBe("true");
    const message = document.getElementById(date.getAttribute("aria-describedby")!);
    expect(message?.textContent?.length).toBeGreaterThan(0);
    expect(date.closest("label")!.contains(message)).toBe(true);
    expect(localStorage.getItem("fermentstation.batches")).toBe(before);
  });

  it.each(["name", "duration", "checks", "interval", "formula", "ph"])("links profile %s errors to affected fields without writes", (kind) => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Profiles" }));
    fireEvent.click(profileManagementButton("Edit Kombucha F1"));
    const before = localStorage.getItem("fermentstation.profiles");
    let fields: HTMLElement[];
    if (kind === "name" || kind === "duration") {
      fields = [screen.getByLabelText(kind === "name" ? "Name" : "Expected duration")];
      fireEvent.change(fields[0], { target: { value: kind === "name" ? "   " : "0" } });
    } else if (kind === "checks" || kind === "interval") {
      fireEvent.click(screen.getByRole("button", { name: "Add check" }));
      fireEvent.change(screen.getByLabelText("Check name 1"), { target: { value: "Taste" } });
      if (kind === "checks") {
        fireEvent.click(screen.getByRole("button", { name: "Add check" }));
        fireEvent.change(screen.getByLabelText("Check name 2"), { target: { value: "Taste" } });
        fields = [screen.getByLabelText("Check name 1"), screen.getByLabelText("Check name 2")];
      } else {
        fields = [screen.getByLabelText("Check interval 1")];
        fireEvent.change(fields[0], { target: { value: "0" } });
      }
    } else if (kind === "formula") {
      fireEvent.click(screen.getByRole("button", { name: "Add formula" }));
      fireEvent.change(screen.getByLabelText("Operator row 1"), { target: { value: "/" } });
      fields = [screen.getByLabelText("Operand row 1")];
      fireEvent.change(fields[0], { target: { value: "0" } });
    } else {
      fields = [screen.getByLabelText("pH minimum"), screen.getByLabelText("pH maximum")];
      fireEvent.change(fields[0], { target: { value: "10" } });
      fireEvent.change(fields[1], { target: { value: "2" } });
    }
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    for (const field of fields) {
      expect(field.getAttribute("aria-invalid")).toBe("true");
      const message = document.getElementById(field.getAttribute("aria-describedby")!);
      expect(message?.textContent?.length).toBeGreaterThan(0);
      expect(field.parentElement!.contains(message) || field.closest("label")?.contains(message)).toBe(true);
    }
    expect(localStorage.getItem("fermentstation.profiles")).toBe(before);
  });

  it("connects editable temperature and guidance to the profile card", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Profiles" }));
    fireEvent.click(profileManagementButton("Edit Kombucha F1"));

    expect(screen.getByLabelText("Name").closest("h1")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Guidance step 1"), { target: { value: "Keep it warm and shaded." } });
    fireEvent.change(screen.getByLabelText("Temperature minimum"), { target: { value: "18" } });
    fireEvent.change(screen.getByLabelText("Temperature maximum"), { target: { value: "22" } });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    const card = screen.getByRole("button", { name: "View Kombucha F1 guidance" }).closest("article");
    expect(card?.textContent).toContain("Keep it warm and shaded.");
    expect(card?.textContent).toContain("18–22°C");
    expect(card?.textContent).not.toContain("Sweet tea · SCOBY");
  });

  it("starts new profile guidance empty and adds numbered steps", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Profiles" }));
    fireEvent.click(profileManagementButton("Add profile"));

    expect(screen.getByText(/No guidance steps yet/)).toBeTruthy();
    expect(screen.queryByText("Instructions")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add step" }));
    fireEvent.change(screen.getByLabelText("Guidance step 1"), { target: { value: "Start below 25°C." } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "New profile" } });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    fireEvent.click(screen.getByRole("button", { name: "View New profile guidance" }));
    expect(screen.getByRole("dialog").textContent).toContain("Start below 25°C.");
  });

  it("starts, snapshots, monitors, and filters a batch", () => {
    render(<App />);
    const navigation = within(screen.getByRole("navigation", { name: "Primary navigation" }));
    const topbar = within(document.querySelector(".design-topbar")!);
    const detail = within(screen.getByRole("complementary", { name: "Selected batch" }));

    fireEvent.click(topbar.getByRole("button", { name: "Start a batch" }));
    const startDialog = within(screen.getByRole("dialog", { name: "Start a batch" }));
    fireEvent.change(startDialog.getByLabelText(/start date/i), {
      target: { value: "2026-08-01" },
    });
    fireEvent.change(startDialog.getByLabelText(/batch name/i), {
      target: { value: "Kitchen kombucha" },
    });
    fireEvent.click(newBatchSubmit());
    openBatchTools();
    const logger = within(document.getElementById("batch-activity-form")!);

    expect(detail.getByRole("heading", { name: "Kitchen kombucha" })).toBeTruthy();
    expect(detail.getByText("Active", { selector: ".status" })).toBeTruthy();
    expect(logger.getByRole("button", { name: "Status change" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("button", { name: "Measurement" })).toBeNull();
    const notifications = detail.getByRole("button", { name: "Notifications for Kitchen kombucha" });
    expect(notifications.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(notifications);
    expect(notifications.getAttribute("aria-pressed")).toBe("false");
    expect(JSON.parse(localStorage.getItem("fermentstation.batches")!).batches[0].notificationsMuted).toBe(true);

    fireEvent.click(navigation.getByRole("button", { name: "Profiles" }));
    fireEvent.click(profileManagementButton("Edit Kombucha F1"));
    const editor = within(document.querySelector(".profile-editor-page")!);
    fireEvent.change(editor.getByLabelText("Name"), { target: { value: "Renamed profile" } });
    fireEvent.click(editor.getByRole("button", { name: "Save profile" }));
    fireEvent.click(navigation.getByRole("button", { name: "My batches" }));
    let dashboard = within(document.querySelector(".design-dashboard")!);
    fireEvent.click(dashboard.getByRole("button", { name: "Open Kitchen kombucha" }));

    expect(detail.getByText("Profile snapshot:").parentElement?.textContent).toContain(
      "Kombucha F1",
    );

    fireEvent.change(logger.getByLabelText("Activity type"), { target: { value: "status" } });
    fireEvent.change(logger.getByLabelText("Activity status"), { target: { value: "ready" } });
    fireEvent.click(logger.getByRole("button", { name: "Log activity" }));
    expect(detail.getByText("Ready", { selector: ".status" })).toBeTruthy();

    fireEvent.click(navigation.getByRole("button", { name: "My batches" }));
    dashboard = within(document.querySelector(".design-dashboard")!);
    const filters = within(dashboard.getByRole("group", { name: "Filter batches by status" }));
    fireEvent.click(filters.getByRole("button", { name: "Active" }));
    expect(dashboard.getByText("No batches match this status.")).toBeTruthy();
    fireEvent.click(filters.getByRole("button", { name: "Ready" }));
    expect(within(dashboard.getByRole("region", { name: "Batch overview" })).getByText("Kitchen kombucha")).toBeTruthy();
  });

  it("records, edits, trashes, and restores batch activity and batches", () => {
    render(<App />);
    const navigation = within(screen.getByRole("navigation", { name: "Primary navigation" }));
    const topbar = within(document.querySelector(".design-topbar")!);
    const detail = within(screen.getByRole("complementary", { name: "Selected batch" }));
    fireEvent.click(topbar.getByRole("button", { name: "Start a batch" }));
    fireEvent.click(newBatchSubmit());
    openBatchTools();
    const logger = within(document.getElementById("batch-activity-form")!);

    fireEvent.click(logger.getByRole("button", { name: "Note" }));
    fireEvent.change(logger.getByLabelText("Activity date"), {
      target: { value: "2026-08-02" },
    });
    fireEvent.change(logger.getByLabelText("Activity context"), {
      target: { value: "Tasted tart" },
    });
    fireEvent.click(logger.getByRole("button", { name: "Log activity" }));
    expect(detail.getByText("Tasted tart")).toBeTruthy();
    expect(detail.getByRole("region", { name: /timeline$/i }).querySelector("form")).toBeNull();

    fireEvent.click(detail.getByRole("button", { name: "Edit note from 2026-08-02" }));
    fireEvent.change(logger.getByLabelText("Activity context"), {
      target: { value: "Tasted pleasantly tart" },
    });
    fireEvent.click(logger.getByRole("button", { name: "Save activity" }));
    expect(detail.getByText("Tasted pleasantly tart")).toBeTruthy();

    fireEvent.click(detail.getByRole("button", { name: "Delete note from 2026-08-02" }));
    fireEvent.click(detail.getByRole("button", { name: "Restore note from 2026-08-02" }));
    expect(detail.getByText("Tasted pleasantly tart")).toBeTruthy();

    fireEvent.change(logger.getByLabelText("Activity type"), { target: { value: "status" } });
    fireEvent.change(logger.getByLabelText("Activity status"), { target: { value: "ready" } });
    fireEvent.click(logger.getByRole("button", { name: "Log activity" }));
    expect(detail.getByText("Status: Ready")).toBeTruthy();
    fireEvent.click(detail.getByRole("button", { name: "Delete batch" }));
    expect(document.querySelector(".app-shell")?.classList.contains("has-open-batch")).toBe(false);
    expect(screen.queryByText("Recently deleted batches")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    const settings = within(screen.getByRole("region", { name: "Settings" }));
    fireEvent.click(settings.getByRole("button", { name: "Open recently deleted batches" }));
    fireEvent.click(settings.getByRole("button", { name: "Restore Kombucha F1" }));
    fireEvent.click(navigation.getByRole("button", { name: "My batches" }));
    const dashboard = within(document.querySelector(".design-dashboard")!);
    fireEvent.click(dashboard.getByRole("button", { name: "Open Kombucha F1" }));
    expect(detail.getByText("Tasted pleasantly tart")).toBeTruthy();
  });

  it("uses profile calculations, batch overrides, and finish dates", () => {
    render(<App />);
    const navigation = within(screen.getByRole("navigation", { name: "Primary navigation" }));
    const topbar = within(document.querySelector(".design-topbar")!);
    const detail = within(screen.getByRole("complementary", { name: "Selected batch" }));
    fireEvent.click(navigation.getByRole("button", { name: "Profiles" }));
    fireEvent.click(profileManagementButton("Edit Kombucha F1"));
    let editor = within(document.getElementById("profile-editor-form")!);
    fireEvent.change(editor.getByLabelText(/Expected duration/), { target: { value: "7" } });
    fireEvent.click(editor.getByRole("button", { name: "Add formula" }));
    fireEvent.change(editor.getByLabelText("Source unit row 1"), { target: { value: "kg" } });
    expect((editor.getByLabelText("Source unit row 1") as HTMLSelectElement).value).toBe("kg");
    fireEvent.click(editor.getByRole("button", { name: "Add formula" }));
    fireEvent.change(editor.getByLabelText("Source term row 2"), { target: { value: "water" } });
    fireEvent.change(editor.getByLabelText("Source unit row 2"), { target: { value: "l" } });
    fireEvent.change(editor.getByLabelText("Operator row 2"), { target: { value: "/" } });
    fireEvent.change(editor.getByLabelText("Operand row 2"), { target: { value: "17.63" } });
    fireEvent.change(editor.getByLabelText("Operand type row 2"), { target: { value: "number" } });
    fireEvent.change(editor.getByLabelText("Result term row 2"), { target: { value: "tea" } });
    fireEvent.click(editor.getByRole("button", { name: "Add formula" }));
    fireEvent.change(editor.getByLabelText("Source term row 3"), { target: { value: "water" } });
    expect((editor.getByLabelText("Source unit row 3") as HTMLSelectElement).value).toBe("l");
    fireEvent.change(editor.getByLabelText("Source unit row 2"), { target: { value: "ml" } });
    expect((editor.getByLabelText("Source unit row 3") as HTMLSelectElement).value).toBe("ml");
    fireEvent.change(editor.getByLabelText("Source unit row 2"), { target: { value: "l" } });
    fireEvent.click(editor.getByRole("button", { name: "Remove calculation 3" }));
    fireEvent.click(editor.getByRole("button", { name: "Save profile" }));

    fireEvent.click(profileManagementButton("Edit Kombucha F1"));
    editor = within(document.getElementById("profile-editor-form")!);
    expect((editor.getByLabelText("Source term row 1") as HTMLSelectElement).value).toBe("totalWeight");
    expect((editor.getByLabelText("Source unit row 1") as HTMLSelectElement).value).toBe("kg");
    expect((editor.getByLabelText("Result term row 2") as HTMLSelectElement).value).toBe("tea");
    expect(screen.queryByLabelText(/^Inputs/)).toBeNull();
    fireEvent.click(editor.getByRole("button", { name: "Cancel" }));

    fireEvent.click(navigation.getByRole("button", { name: "My batches" }));
    fireEvent.click(topbar.getByRole("button", { name: "Start a batch" }));
    const startDialog = within(screen.getByRole("dialog", { name: "Start a batch" }));
    fireEvent.click(startDialog.getByText("Batch input options"));
    fireEvent.change(startDialog.getByLabelText("totalWeight (kg)"), { target: { value: "1.25" } });
    fireEvent.change(startDialog.getByLabelText("water (l)"), { target: { value: "1" } });
    fireEvent.click(newBatchSubmit());
    openBatchTools();
    expect(detail.getByText(/25 g suggested/)).toBeTruthy();
    expect(detail.getByText("tea:").parentElement?.textContent).toContain("56.72 g suggested");
    expect(detail.getByText("salt").closest(".meas")?.textContent).toContain("25g");
    expect(detail.getByText("tea").closest(".meas")?.textContent).toContain("56.72g");

    fireEvent.change(detail.getByLabelText("totalWeight (kg)"), { target: { value: "2.5" } });
    fireEvent.click(detail.getByRole("button", { name: "Update inputs" }));
    expect(detail.getByText(/50 g suggested/)).toBeTruthy();
    const saltOverride = detail.getByLabelText("Override salt");
    fireEvent.change(saltOverride, { target: { value: "55.5" } });
    fireEvent.submit(saltOverride.closest("form")!);
    expect(detail.getByText(/55.5 g \(overridden\)/)).toBeTruthy();

    fireEvent.change(detail.getByLabelText("Finish date"), { target: { value: "2026-08-08" } });
    expect(detail.getByText("Ready", { selector: ".status" })).toBeTruthy();
  });

  it("persists editable device formula terms and uses them in profile dropdowns", () => {
    const view = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.change(screen.getByLabelText("Formula term 1"), { target: { value: "starterLiquid" } });
    expect(screen.getByRole("button", { name: "Remove formula term 1: starterLiquid" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save formula terms" }));
    expect(screen.getByText("Formula terms saved on this device.")).toBeTruthy();

    view.unmount();
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Profiles" }));
    fireEvent.click(profileManagementButton("Edit Kombucha F1"));
    fireEvent.click(screen.getByRole("button", { name: "Add formula" }));

    const option = Array.from((screen.getByLabelText("Source term row 1") as HTMLSelectElement).options)
      .find(({ value }) => value === "starterLiquid");
    expect(option?.textContent).toBe("Starter Liquid");
  });

  it("persists the settings page preferences", () => {
    const view = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.click(screen.getByRole("button", { name: "°F / qt" }));
    const notifications = within(screen.getByRole("group", { name: "Notifications" }));
    for (const [label, mode] of [["All", "all"], ["Checks", "checks"], ["Ready", "ready"], ["Off", "off"]]) {
      fireEvent.click(notifications.getByRole("button", { name: label }));
      expect(JSON.parse(localStorage.getItem("fermentstation.shell")!)).toMatchObject({
        units: "imperial",
        notificationMode: mode,
        suggestions: true,
      });
    }

    view.unmount();
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByRole("button", { name: "°F / qt" }).getAttribute("aria-pressed")).toBe("true");
    expect(within(screen.getByRole("group", { name: "Notifications" })).getByRole("button", { name: "Off" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("keeps calculation-only results out of sources and chooses unused results", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Profiles" }));
    fireEvent.click(profileManagementButton("Edit Kombucha F1"));
    fireEvent.click(screen.getByRole("button", { name: "Add formula" }));
    fireEvent.click(screen.getByRole("button", { name: "Add formula" }));

    expect((screen.getByLabelText("Result term row 1") as HTMLSelectElement).value).toBe("salt");
    expect((screen.getByLabelText("Result term row 2") as HTMLSelectElement).value).not.toBe("salt");
    expect(Array.from((screen.getByLabelText("Source term row 2") as HTMLSelectElement).options).map(({ value }) => value))
      .not.toContain("salt");
    expect(Array.from((screen.getByLabelText("Result term row 2") as HTMLSelectElement).options).map(({ value }) => value))
      .toContain("salt");
  });

  it("keeps complex legacy calculations unless they are removed", () => {
    const state = createProfileState();
    state.profiles[0].inputs = [{ name: "water", unit: "g" }];
    state.profiles[0].calculations = [{ name: "tea", unit: "g", formula: "water / (20 + 2)" }];
    localStorage.setItem("fermentstation.profiles", JSON.stringify(state));
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Profiles" }));
    fireEvent.click(profileManagementButton("Edit Kombucha F1"));

    expect(screen.getByText(/cannot be edited here, but will be kept/)).toBeTruthy();
    expect(screen.queryByLabelText(/^Calculations/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    expect(JSON.parse(localStorage.getItem("fermentstation.profiles")!).profiles[0].calculations[0].formula)
      .toBe("water / (20 + 2)");

    fireEvent.click(profileManagementButton("Edit Kombucha F1"));
    fireEvent.click(screen.getByRole("button", { name: "Remove calculation 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    expect(JSON.parse(localStorage.getItem("fermentstation.profiles")!).profiles[0].calculations).toEqual([]);
  });

  it("surfaces recurring checks on Today and Calendar", () => {
    render(<App />);
    const navigation = within(screen.getByRole("navigation", { name: "Primary navigation" }));
    const topbar = within(document.querySelector(".design-topbar")!);
    fireEvent.click(navigation.getByRole("button", { name: "Profiles" }));
    fireEvent.click(profileManagementButton("Edit Kombucha F1"));
    fireEvent.change(screen.getByLabelText(/Expected duration/), { target: { value: "14" } });
    fireEvent.click(screen.getByRole("button", { name: "Add check" }));
    fireEvent.change(screen.getByLabelText("Check name 1"), { target: { value: "Taste" } });
    fireEvent.change(screen.getByLabelText("Check interval 1"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    fireEvent.click(navigation.getByRole("button", { name: "My batches" }));
    fireEvent.click(topbar.getByRole("button", { name: "Start a batch" }));
    const today = localDateForTest();
    const startDate = addDaysForTest(today, -8);
    fireEvent.change(screen.getByLabelText(/start date/i), {
      target: { value: startDate },
    });
    fireEvent.click(newBatchSubmit());

    openBatchTools();
    expect(screen.getByText(new RegExp(`Overdue ${addDaysForTest(startDate, 2)}`))).toBeTruthy();
    const detail = within(screen.getByRole("complementary", { name: "Selected batch" }));
    fireEvent.click(detail.getByRole("button", { name: /Back to batches/i }));
    fireEvent.click(navigation.getByRole("button", { name: "My batches" }));
    expect(screen.getByRole("heading", { name: /Action queue/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open Kombucha F1 for Taste" }));
    openBatchTools();
    const completeCheck = detail.getByRole("button", { name: "Complete Taste check" });
    expect(completeCheck.textContent).toBe("✓");
    fireEvent.click(completeCheck);
    expect(screen.getByText("Completed check: Taste")).toBeTruthy();
    expect(screen.getByText(new RegExp(`Next ${addDaysForTest(today, 2)}`))).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Taste interval days"), { target: { value: "3" } });
    const adjustedDateValue = addDaysForTest(today, 3);
    expect(screen.getByText(new RegExp(`Next ${adjustedDateValue}|Overdue ${adjustedDateValue}`))).toBeTruthy();
    const expectedNextDate = addDaysForTest(today, 3);

    fireEvent.click(topbar.getByRole("button", { name: "Open calendar" }));
    const calendar = within(screen.getByRole("region", { name: "Fermentation calendar" }));
    expect(calendar.getByText("Finish date")).toBeTruthy();
    expect(calendar.getByText("Taste")).toBeTruthy();
    expect(calendar.getByText(expectedNextDate)).toBeTruthy();
    fireEvent.click(calendar.getByRole("button", { name: `Open Kombucha F1 for ${expectedNextDate}` }));
    expect(detail.getByRole("heading", { name: "Kombucha F1" })).toBeTruthy();

    fireEvent.click(topbar.getByRole("button", { name: "Open calendar" }));
    fireEvent.click(within(screen.getByRole("region", { name: "Fermentation calendar" })).getByRole("button", { name: "Open Kombucha F1: Taste" }));
    expect(detail.getByRole("heading", { name: "Kombucha F1" })).toBeTruthy();
  });

  it("chooses a batch when an upcoming day has multiple batches", () => {
    const finishDate = addDaysForTest(localDateForTest(), 2);
    render(<App />);
    const navigation = within(screen.getByRole("navigation", { name: "Primary navigation" }));
    const topbar = within(document.querySelector(".design-topbar")!);
    const detail = within(screen.getByRole("complementary", { name: "Selected batch" }));

    fireEvent.click(topbar.getByRole("button", { name: "Start a batch" }));
    fireEvent.change(screen.getByLabelText(/batch name/i), { target: { value: "First jar" } });
    fireEvent.click(newBatchSubmit());
    openBatchTools();
    fireEvent.change(screen.getByLabelText("Finish date"), { target: { value: finishDate } });
    fireEvent.click(detail.getByRole("button", { name: /Back to batches/i }));

    fireEvent.click(topbar.getByRole("button", { name: "Start a batch" }));
    fireEvent.change(screen.getByLabelText(/batch name/i), { target: { value: "Second jar" } });
    fireEvent.click(newBatchSubmit());
    openBatchTools();
    fireEvent.change(screen.getByLabelText("Finish date"), { target: { value: finishDate } });
    fireEvent.click(detail.getByRole("button", { name: /Back to batches/i }));
    fireEvent.click(navigation.getByRole("button", { name: "My batches" }));
    openMoreBatchActions();
    const upcoming = within(screen.getByRole("region", { name: /Upcoming/ }));

    fireEvent.click(upcoming.getByRole("button", { name: `Choose a batch for ${finishDate}` }));
    const chooser = screen.getByRole("dialog", { name: `Choose a batch for ${finishDate}` });
    expect(chooser.textContent).toContain("First jar");
    expect(chooser.textContent).toContain("Second jar");
    expect(within(chooser).getByRole("button", { name: "Close" })).toBeTruthy();

    fireEvent.click(chooser.parentElement!);
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(upcoming.getByRole("button", { name: `Choose a batch for ${finishDate}` }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(upcoming.getByRole("button", { name: `Choose a batch for ${finishDate}` }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Open Second jar" }));
    expect(detail.getByRole("heading", { name: "Second jar" })).toBeTruthy();

    fireEvent.click(topbar.getByRole("button", { name: "Open calendar" }));
    fireEvent.click(within(screen.getByRole("region", { name: "Fermentation calendar" })).getByRole("button", { name: `Choose a batch for ${finishDate}` }));
    const calendarChooser = screen.getByRole("dialog", { name: `Choose a batch for ${finishDate}` });
    expect(calendarChooser.textContent).toContain("First jar");
    fireEvent.click(within(calendarChooser).getByRole("button", { name: "Open First jar" }));
    expect(detail.getByRole("heading", { name: "First jar" })).toBeTruthy();
  });

  it("adds, renames, and removes a batch-local check", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Start a batch" }));
    fireEvent.click(newBatchSubmit());
    openBatchTools();
    fireEvent.click(screen.getByRole("button", { name: "Add check" }));
    fireEvent.change(screen.getByLabelText("Check name"), { target: { value: "Burp" } });
    fireEvent.click(screen.getByRole("button", { name: "Add recurring check" }));

    fireEvent.change(screen.getByLabelText("Burp interval days"), { target: { value: "0" } });
    const checks = within(screen.getByRole("article", { name: "Kombucha F1 checks" }));
    expect(checks.getByRole("alert").textContent).toContain("positive whole number");
    fireEvent.change(screen.getByLabelText("Burp interval days"), { target: { value: "2" } });
    expect(checks.queryByRole("alert")).toBeNull();

    const name = screen.getByDisplayValue("Burp");
    fireEvent.change(name, { target: { value: "Gas release" } });
    fireEvent.click(screen.getByRole("button", { name: "Save name" }));
    expect(screen.getByDisplayValue("Gas release")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove Gas release" }));
    expect(screen.getByText("No recurring checks yet.")).toBeTruthy();
  });

  it("records editable pH readings with warnings and profile zones", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Profiles" }));
    fireEvent.click(profileManagementButton("Edit Kombucha F1"));
    fireEvent.change(screen.getByLabelText("pH minimum"), { target: { value: "3.2" } });
    fireEvent.change(screen.getByLabelText("pH maximum"), { target: { value: "3.6" } });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    fireEvent.click(screen.getByRole("button", { name: "My batches" }));
    fireEvent.click(screen.getByRole("button", { name: "Start a batch" }));
    fireEvent.click(newBatchSubmit());

    openBatchTools();
    fireEvent.change(screen.getByLabelText("Activity type"), { target: { value: "ph" } });
    fireEvent.change(screen.getByLabelText("pH value"), { target: { value: "15" } });
    fireEvent.click(screen.getByRole("button", { name: "Log activity" }));
    expect(screen.getByText("Outside the usual pH range of 0-14")).toBeTruthy();
    const keyMeasurements = screen.getByRole("heading", { name: /key measurements/i }).closest(".wb-panel") as HTMLElement;
    const phMeasurement = within(keyMeasurements).getByText("pH").closest(".meas")!;
    expect(phMeasurement.className).toContain("meas-alert");
    expect(phMeasurement.querySelector<HTMLElement>(".measurement-zone i")!.style.left).toBe("100%");

    fireEvent.click(screen.getByRole("button", { name: /Edit pH/ }));
    fireEvent.change(screen.getByLabelText("pH value"), { target: { value: "2.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Save activity" }));
    expect(phMeasurement.className).toContain("meas-alert");
    expect(phMeasurement.querySelector<HTMLElement>(".measurement-zone i")!.style.left).toBe("0%");

    fireEvent.click(screen.getByRole("button", { name: /Edit pH/ }));
    fireEvent.change(screen.getByLabelText("Activity date"), { target: { value: "2026-08-02" } });
    fireEvent.change(screen.getByLabelText("pH value"), { target: { value: "3.45" } });
    fireEvent.click(screen.getByRole("button", { name: "Save activity" }));
    expect(screen.getByText("optimal")).toBeTruthy();
    expect(phMeasurement.textContent).toContain("3.45 · optimal");
    expect(phMeasurement.textContent).toContain("Latest read 2026-08-02");
    expect(phMeasurement.className).not.toContain("meas-alert");
    expect(Number(phMeasurement.querySelector<HTMLElement>(".measurement-zone i")!.style.left.replace("%", ""))).toBeCloseTo(62.5);
  });

  it("logs temperature in the selected unit and stores Celsius", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Profiles" }));
    fireEvent.click(profileManagementButton("Edit Kombucha F1"));
    fireEvent.change(screen.getByLabelText("Temperature minimum"), { target: { value: "18" } });
    fireEvent.change(screen.getByLabelText("Temperature maximum"), { target: { value: "22" } });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.click(screen.getByRole("button", { name: "°F / qt" }));
    fireEvent.click(screen.getByRole("button", { name: "My batches" }));
    fireEvent.click(screen.getByRole("button", { name: "Start a batch" }));
    fireEvent.click(newBatchSubmit());

    openBatchTools();
    fireEvent.change(screen.getByLabelText("Activity type"), { target: { value: "temperature" } });
    expect(screen.getByLabelText("Temperature (°F)")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Temperature (°F)"), { target: { value: "68" } });
    fireEvent.click(screen.getByRole("button", { name: "Log activity" }));

    expect(screen.getByText("Temperature 68°F")).toBeTruthy();
    const keyMeasurements = screen.getByRole("heading", { name: /key measurements/i }).closest(".wb-panel") as HTMLElement;
    const temperatureMeasurement = within(keyMeasurements).getByText("Temperature").closest(".meas")!;
    expect(temperatureMeasurement.textContent).toContain("68 °F");
    expect(temperatureMeasurement.textContent).toContain(`Latest read ${localDateForTest()}`);
    expect(temperatureMeasurement.textContent).toContain("range 64.4–71.6°F");
    expect(temperatureMeasurement.className).not.toContain("meas-cool");
    expect(temperatureMeasurement.className).not.toContain("meas-alert");

    fireEvent.click(screen.getByRole("button", { name: /Edit temperature/ }));
    fireEvent.change(screen.getByLabelText("Temperature (°F)"), { target: { value: "60" } });
    fireEvent.click(screen.getByRole("button", { name: "Save activity" }));
    expect(temperatureMeasurement.className).toContain("meas-cool");

    fireEvent.click(screen.getByRole("button", { name: /Edit temperature/ }));
    fireEvent.change(screen.getByLabelText("Temperature (°F)"), { target: { value: "80" } });
    fireEvent.click(screen.getByRole("button", { name: "Save activity" }));
    expect(temperatureMeasurement.className).toContain("meas-alert");
    expect(JSON.parse(localStorage.getItem("fermentstation.batches")!).batches[0].timeline)
      .toContainEqual(expect.objectContaining({ kind: "temperature", value: expect.closeTo((80 - 32) * 5 / 9) }));
  });

  it("attaches, displays, edits, deletes, and restores a local photo", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Start a batch" }));
    fireEvent.click(newBatchSubmit());
    openBatchTools();
    fireEvent.click(screen.getByRole("button", { name: "Take photo" }));
    expect(screen.getByLabelText("Photo")).toBeTruthy();
    const file = new File(["original photo bytes"], "jar.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText("Photo"), { target: { files: [file] } });
    fireEvent.change(screen.getByLabelText("Caption"), { target: { value: "Jar day one" } });
    fireEvent.submit(screen.getByRole("button", { name: "Log activity" }).closest("form")!);

    const image = await screen.findByRole("img", { name: "Jar day one" });
    expect(image.getAttribute("src")).toContain("data:image/jpeg;base64,");
    fireEvent.click(screen.getByRole("button", { name: /Edit photo/ }));
    fireEvent.change(screen.getByLabelText("Caption"), { target: { value: "Jar day two" } });
    fireEvent.submit(screen.getByRole("button", { name: "Save activity" }).closest("form")!);
    expect(await screen.findByRole("img", { name: "Jar day two" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Delete photo/ }));
    fireEvent.click(screen.getByRole("button", { name: /Restore photo/ }));
    expect(await screen.findByRole("img", { name: "Jar day two" })).toBeTruthy();
  });

  it.each([
    { edit: false, switchBatch: false },
    { edit: false, switchBatch: true },
    { edit: true, switchBatch: false },
    { edit: true, switchBatch: true },
  ])("keeps concurrent checks when a deferred photo resolves (edit=$edit, switch=$switchBatch)", async ({ edit, switchBatch }) => {
    const today = localDateForTest();
    const profile = { ...createProfileState().profiles[0], checks: [{ id: "taste", name: "Taste", intervalDays: 2 }] };
    const first = createBatch(profile, { id: "first", name: "First jar", startDate: addDaysForTest(today, -4), today });
    const second = createBatch(profile, { id: "second", name: "Second jar", startDate: today, today });
    if (edit) first.timeline.push({ id: "photo", kind: "photo", date: today, name: "old.jpg", mimeType: "image/jpeg", dataUrl: "data:image/jpeg;base64,b2xk", caption: "Old photo" });
    localStorage.setItem("fermentstation.batches", JSON.stringify(createBatchState([first, second])));
    let reader: FileReader | undefined;
    const read = vi.spyOn(FileReader.prototype, "readAsDataURL").mockImplementation(function (this: FileReader) { reader = this; });
    try {
      render(<App />);
      fireEvent.click(screen.getByRole("button", { name: "Open First jar" }));
      openBatchTools();
      fireEvent.click(screen.getByRole("button", { name: edit ? `Edit photo from ${today}` : "Take photo" }));
      fireEvent.change(screen.getByLabelText("Photo"), { target: { files: [new File(["new bytes"], "new.jpg", { type: "image/jpeg" })] } });
      fireEvent.change(screen.getByLabelText("Caption"), { target: { value: "New photo" } });
      fireEvent.submit(screen.getByRole("button", { name: edit ? "Save activity" : "Log activity" }).closest("form")!);
      expect(reader).toBeDefined();

      fireEvent.click(screen.getByRole("button", { name: "Complete Taste for First jar" }));
      fireEvent.change(screen.getByLabelText("Taste interval days"), { target: { value: "3" } });
      const completed = JSON.parse(localStorage.getItem("fermentstation.batches")!).batches[0];
      expect(completed.checks[0]).toMatchObject({ lastCompletedDate: today, nextDueDate: addDaysForTest(today, 3), intervalDays: 3 });
      let draft: HTMLTextAreaElement | undefined;
      if (switchBatch) {
        fireEvent.click(screen.getByRole("button", { name: "Open Second jar" }));
        openBatchTools();
        fireEvent.click(screen.getByRole("button", { name: "Note" }));
        draft = screen.getByLabelText("Activity context") as HTMLTextAreaElement;
        fireEvent.change(draft, { target: { value: "Second jar unsaved draft" } });
        draft.focus();
      }

      await act(async () => {
        Object.defineProperty(reader!, "result", { value: "data:image/jpeg;base64,bmV3" });
        reader!.dispatchEvent(new Event("load"));
      });

      const stored = JSON.parse(localStorage.getItem("fermentstation.batches")!);
      expect(stored.batches[0].checks).toEqual(completed.checks);
      expect(stored.batches[0].timeline.filter(({ kind }: { kind: string }) => kind === "check")).toEqual(completed.timeline.filter(({ kind }: { kind: string }) => kind === "check"));
      expect(stored.batches[0].timeline.filter(({ kind }: { kind: string }) => kind === "photo")).toEqual([
        expect.objectContaining({ ...(edit ? { id: "photo" } : {}), name: "new.jpg", caption: "New photo", dataUrl: "data:image/jpeg;base64,bmV3" }),
      ]);
      expect(stored.batches[1]).toEqual(second);
      if (draft) {
        expect(screen.getByLabelText("Activity context")).toBe(draft);
        expect(draft.value).toBe("Second jar unsaved draft");
        expect(document.activeElement).toBe(draft);
      }
      expect(within(screen.getByRole("complementary", { name: "Selected batch" })).getByRole("heading", { name: switchBatch ? "Second jar" : "First jar" })).toBeTruthy();
    } finally {
      read.mockRestore();
    }
  });

  it("does not reset or focus a newer same-batch draft when an older modal photo finishes", async () => {
    const batch = createBatch(createProfileState().profiles[0], { id: "jar", startDate: localDateForTest() });
    localStorage.setItem("fermentstation.batches", JSON.stringify(createBatchState([batch])));
    let reader: FileReader | undefined;
    const read = vi.spyOn(FileReader.prototype, "readAsDataURL").mockImplementation(function (this: FileReader) { reader = this; });
    try {
      render(<App />);
      openBatchTools();
      fireEvent.click(screen.getByRole("button", { name: "Take photo" }));
      const file = screen.getByLabelText("Photo") as HTMLInputElement;
      fireEvent.change(file, { target: { files: [new File(["old"], "old.jpg", { type: "image/jpeg" })] } });
      fireEvent.change(screen.getByLabelText("Caption"), { target: { value: "Submitted caption" } });
      fireEvent.click(screen.getByRole("button", { name: "Add observation" }));
      const dialog = screen.getByRole("dialog");
      fireEvent.submit(file.closest("form")!);
      expect(reader).toBeDefined();
      const selected = new File(["new draft"], "new-draft.jpg", { type: "image/jpeg" });
      fireEvent.change(file, { target: { files: [selected] } });
      const caption = within(dialog).getByLabelText("Caption") as HTMLInputElement;
      fireEvent.change(caption, { target: { value: "Newer caption draft" } });
      caption.focus();
      await act(async () => {
        Object.defineProperty(reader!, "result", { value: "data:image/jpeg;base64,b2xk" });
        reader!.dispatchEvent(new Event("load"));
      });
      expect(screen.getByRole("dialog")).toBe(dialog);
      expect(file.files?.[0]).toBe(selected);
      expect(caption.value).toBe("Newer caption draft");
      expect(document.activeElement).toBe(caption);
      const stored = JSON.parse(localStorage.getItem("fermentstation.batches")!).batches[0];
      expect(stored.timeline).toEqual([expect.objectContaining({ kind: "photo", name: "old.jpg", caption: "Submitted caption" })]);
    } finally { read.mockRestore(); }
  });

  it("preserves an intervening status update and newer draft when a deferred photo finishes", async () => {
    const batch = createBatch(createProfileState().profiles[0], { id: "jar", startDate: localDateForTest() });
    localStorage.setItem("fermentstation.batches", JSON.stringify(createBatchState([batch])));
    let reader: FileReader | undefined;
    const read = vi.spyOn(FileReader.prototype, "readAsDataURL").mockImplementation(function (this: FileReader) { reader = this; });
    try {
      render(<App />);
      openBatchTools();
      fireEvent.click(screen.getByRole("button", { name: "Take photo" }));
      const form = document.querySelector<HTMLFormElement>("#batch-activity-form")!;
      const logger = within(form);
      fireEvent.change(logger.getByLabelText("Photo"), { target: { files: [new File(["bytes"], "pending.jpg", { type: "image/jpeg" })] } });
      fireEvent.submit(form);
      expect(reader).toBeDefined();
      fireEvent.click(logger.getByRole("button", { name: "Status change" }));
      fireEvent.change(logger.getByLabelText("Activity status"), { target: { value: "ready" } });
      fireEvent.click(logger.getByRole("button", { name: "Log activity" }));
      fireEvent.click(logger.getByRole("button", { name: "Note" }));
      const draft = logger.getByLabelText("Activity context") as HTMLTextAreaElement;
      fireEvent.change(draft, { target: { value: "Keep this newer draft" } });
      draft.focus();
      await act(async () => {
        Object.defineProperty(reader!, "result", { value: "data:image/jpeg;base64,cGhvdG8=" });
        reader!.dispatchEvent(new Event("load"));
      });
      const stored = JSON.parse(localStorage.getItem("fermentstation.batches")!).batches[0];
      expect(stored.status).toBe("ready");
      expect(stored.timeline).toEqual([
        expect.objectContaining({ kind: "status", status: "ready" }),
        expect.objectContaining({ kind: "photo", name: "pending.jpg" }),
      ]);
      expect(logger.getByLabelText("Activity context")).toBe(draft);
      expect(draft.value).toBe("Keep this newer draft");
      expect(document.activeElement).toBe(draft);
    } finally { read.mockRestore(); }
  });

  it("keeps both pending photos when file reads finish before React renders", async () => {
    const batch = createBatch(createProfileState().profiles[0], { id: "jar", startDate: localDateForTest() });
    localStorage.setItem("fermentstation.batches", JSON.stringify(createBatchState([batch])));
    const readers: FileReader[] = [];
    const read = vi.spyOn(FileReader.prototype, "readAsDataURL").mockImplementation(function (this: FileReader) { readers.push(this); });
    try {
      render(<App />);
      fireEvent.click(screen.getByRole("button", { name: `Open ${batch.name}` }));
      openBatchTools();
      fireEvent.click(screen.getByRole("button", { name: "Take photo" }));
      for (const name of ["first.jpg", "second.jpg"]) {
        fireEvent.change(screen.getByLabelText("Photo"), { target: { files: [new File([name], name, { type: "image/jpeg" })] } });
        fireEvent.submit(screen.getByRole("button", { name: "Log activity" }).closest("form")!);
      }
      expect(readers).toHaveLength(2);
      await act(async () => {
        for (const reader of readers) {
          Object.defineProperty(reader, "result", { value: "data:image/jpeg;base64,cGhvdG8=" });
          reader.dispatchEvent(new Event("load"));
        }
      });
      const stored = JSON.parse(localStorage.getItem("fermentstation.batches")!);
      expect(stored.batches[0].timeline.map(({ name }: { name: string }) => name)).toEqual(["first.jpg", "second.jpg"]);
    } finally {
      read.mockRestore();
    }
  });

  it("preserves destination and unsaved draft across Fold6 postures", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "My batches" }));
    fireEvent.click(screen.getByRole("button", { name: "Start a batch" }));
    fireEvent.click(newBatchSubmit());
    openBatchTools();
    fireEvent.click(screen.getByRole("button", { name: "Note" }));
    fireEvent.change(screen.getByLabelText("Activity context"), {
      target: { value: "Unsaved cover-screen observation" },
    });

    Object.defineProperty(window, "innerWidth", { configurable: true, value: 344 });
    fireEvent(window, new Event("resize"));
    expect(screen.getByRole("button", { name: "My batches" }).getAttribute("aria-current")).toBe("page");
    expect((screen.getByLabelText("Activity context") as HTMLInputElement).value)
      .toBe("Unsaved cover-screen observation");

    Object.defineProperty(window, "innerWidth", { configurable: true, value: 884 });
    fireEvent(window, new Event("resize"));
    expect(screen.getByRole("button", { name: "My batches" }).getAttribute("aria-current")).toBe("page");
    expect((screen.getByLabelText("Activity context") as HTMLInputElement).value)
      .toBe("Unsaved cover-screen observation");
    expect(screen.getByRole("button", { name: "Settings" })).toBeTruthy();
  });

  it("searches profile names and sorts finish dates without retargeting a selected draft", () => {
    const profile = createProfileState().profiles[0];
    const today = localDateForTest();
    const first = { ...createBatch(profile, { id: "first", name: "First jar", startDate: today }), finishDate: addDaysForTest(today, 5) };
    const second = { ...createBatch(profile, { id: "second", name: "Second jar", startDate: today }), finishDate: addDaysForTest(today, 2) };
    localStorage.setItem("fermentstation.batches", JSON.stringify(createBatchState([first, second])));
    render(<App />);
    const overview = within(screen.getByRole("region", { name: "Batch overview" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search batches" }), { target: { value: "KOMBUCHA" } });
    expect(overview.getAllByRole("button").map((button) => button.getAttribute("aria-label"))).toEqual(["Open First jar", "Open Second jar"]);
    fireEvent.click(screen.getByRole("button", { name: "Sort batches by finish date" }));
    expect(overview.getAllByRole("button").map((button) => button.getAttribute("aria-label"))).toEqual(["Open Second jar", "Open First jar"]);
    fireEvent.click(screen.getByRole("button", { name: "Open First jar" }));
    openBatchTools();
    fireEvent.click(screen.getByRole("button", { name: "Note" }));
    const draft = screen.getByLabelText("Activity context");
    const logger = draft.closest("form");
    fireEvent.change(draft, { target: { value: "Keep this on the first jar" } });
    fireEvent.change(screen.getByRole("searchbox", { name: "Search batches" }), { target: { value: "nothing matches" } });
    fireEvent.click(within(screen.getByRole("group", { name: "Filter batches by status" })).getByRole("button", { name: "Ready" }));
    fireEvent.click(screen.getByRole("button", { name: "Sort batches by finish date" }));
    for (const width of [344, 884, 344]) {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
      fireEvent(window, new Event("resize"));
      expect(screen.getByLabelText("Activity context")).toBe(draft);
      expect(document.querySelectorAll("#batch-activity-form")).toHaveLength(1);
      expect(draft.closest("form")).toBe(logger);
    }
    const detail = within(screen.getByRole("complementary", { name: "Selected batch" }));
    expect(detail.getByRole("heading", { name: "First jar" })).toBeTruthy();
    fireEvent.click(detail.getByRole("button", { name: "Log activity" }));
    const stored = JSON.parse(localStorage.getItem("fermentstation.batches")!);
    expect(stored.batches[0].timeline).toContainEqual(expect.objectContaining({ kind: "note", text: "Keep this on the first jar" }));
    expect(stored.batches[1].timeline).toEqual([]);
  });

  it("makes the bundled font and share-alike photograph credits reachable in Settings", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByRole("link", { name: "SIL Open Font License 1.1" }).getAttribute("href")).toContain("new-design/OFL.txt");
    fireEvent.click(within(screen.getByRole("region", { name: "Settings" })).getByText("Photographs via Wikimedia Commons"));
    expect(screen.getByRole("link", { name: "CC BY-SA 4.0" }).getAttribute("href")).toBe("https://creativecommons.org/licenses/by-sa/4.0/");
    expect(screen.getByRole("link", { name: "CC BY-SA 3.0" }).getAttribute("href")).toBe("https://creativecommons.org/licenses/by-sa/3.0/");
  });

  it("starts a batch from other destinations through the same creation form", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    const start = screen.getByRole("button", { name: "Start a batch" });
    expect(start.closest("nav")).toBeNull();
    expect(screen.getByRole("banner").contains(start)).toBe(true);
    expect(screen.queryByText("Reached from the overflow menu")).toBeNull();
    fireEvent.click(start);
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(newBatchSubmit()).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("exposes explicit local ZIP exchange without live database sync", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));

    expect(screen.getByRole("heading", { name: "Data storage" })).toBeTruthy();
    expect(screen.getByText("Shared folder: Not selected")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Export ZIP archive" })).toBeTruthy();
    expect(screen.getByLabelText("Import ZIP archive")).toBeTruthy();
    expect(screen.getByText(/Live databases and app-private directories are never synchronized/))
      .toBeTruthy();
  });

  it("returns from the profile editor with its mobile menu button", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Profiles" }));
    fireEvent.click(profileManagementButton("Edit Kombucha F1"));
    const mobileLogo = document.querySelector<HTMLImageElement>(".profile-mobile-bar .brand-mark img")!;
    expect(mobileLogo.getAttribute("src")).toBe(document.querySelector(".brand .brand-mark img")!.getAttribute("src"));
    expect(mobileLogo.getAttribute("src")).toContain("logo-transparent-96.png");
    fireEvent.click(screen.getByRole("button", { name: "Close profile editor menu" }));
    expect(screen.getByRole("heading", { name: "Fermentation profiles" })).toBeTruthy();
  });
});
