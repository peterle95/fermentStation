// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "./App";
import { createProfileState } from "./domain/profiles";

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

describe("batch workflow", () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it("shows the profile cards and opens profile guidance", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Profiles" }));

    expect(screen.getByRole("heading", { name: "Profiles" })).toBeTruthy();
    expect(screen.getByText("Kombucha F1")).toBeTruthy();
    expect(screen.getByText("Milk kefir")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "View Kombucha F1 guidance" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("Profile calculation");
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("supports an empty profile check list and stable check editing", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Profiles" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit Kombucha F1" }));

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

  it("connects editable temperature and guidance to the profile card", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Profiles" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit Kombucha F1" }));

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
    fireEvent.click(screen.getByRole("button", { name: "Add profile" }));

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

    fireEvent.click(screen.getByRole("button", { name: "Start batch" }));
    fireEvent.change(screen.getByLabelText(/start date/i), {
      target: { value: "2026-08-01" },
    });
    fireEvent.change(screen.getByLabelText(/batch name/i), {
      target: { value: "Kitchen kombucha" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create active batch" }));

    expect(screen.getByText("Kitchen kombucha")).toBeTruthy();
    expect(screen.getByText("Active", { selector: ".status" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Profiles" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit Kombucha F1" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Renamed profile" } });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    fireEvent.click(screen.getByRole("button", { name: "Open Kitchen kombucha" }));

    expect(screen.getByText("Profile snapshot:").parentElement?.textContent).toContain(
      "Kombucha F1",
    );

    fireEvent.change(screen.getByLabelText("Activity type"), { target: { value: "status" } });
    fireEvent.change(screen.getByLabelText("Activity status"), { target: { value: "ready" } });
    fireEvent.click(screen.getByRole("button", { name: "Log activity" }));
    expect(screen.getByText("Ready", { selector: ".status" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Batches" }));
    fireEvent.click(screen.getByRole("button", { name: "Active" }));
    expect(screen.getByText("No batches match this status.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ready" }));
    expect(screen.getByText("Kitchen kombucha")).toBeTruthy();
  });

  it("records, edits, trashes, and restores batch activity and batches", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Start batch" }));
    fireEvent.click(screen.getByRole("button", { name: "Create active batch" }));

    fireEvent.change(screen.getByLabelText("Activity date"), {
      target: { value: "2026-08-02" },
    });
    fireEvent.change(screen.getByLabelText("Note or measurement"), {
      target: { value: "Tasted tart" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Log activity" }));
    expect(screen.getByText("Tasted tart")).toBeTruthy();
    expect(screen.getByRole("region", { name: /timeline$/i }).querySelector("form")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Edit note from 2026-08-02" }));
    fireEvent.change(screen.getByLabelText("Note or measurement"), {
      target: { value: "Tasted pleasantly tart" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save activity" }));
    expect(screen.getByText("Tasted pleasantly tart")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Delete note from 2026-08-02" }));
    fireEvent.click(screen.getByRole("button", { name: "Restore note from 2026-08-02" }));
    expect(screen.getByText("Tasted pleasantly tart")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Activity type"), { target: { value: "status" } });
    fireEvent.change(screen.getByLabelText("Activity status"), { target: { value: "ready" } });
    fireEvent.click(screen.getByRole("button", { name: "Log activity" }));
    expect(screen.getByText("Status: Ready")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete batch" }));
    expect(screen.queryByText("Recently deleted batches")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.click(screen.getByRole("button", { name: "Open recently deleted batches" }));
    fireEvent.click(screen.getByRole("button", { name: "Restore Kombucha F1" }));
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    fireEvent.click(screen.getByRole("button", { name: "Open Kombucha F1" }));
    expect(screen.getByText("Tasted pleasantly tart")).toBeTruthy();
  });

  it("uses profile calculations, batch overrides, and finish dates", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Profiles" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit Kombucha F1" }));
    fireEvent.change(screen.getByLabelText(/Expected duration/), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "Add formula" }));
    fireEvent.change(screen.getByLabelText("Source unit row 1"), { target: { value: "kg" } });
    expect((screen.getByLabelText("Source unit row 1") as HTMLSelectElement).value).toBe("kg");
    fireEvent.click(screen.getByRole("button", { name: "Add formula" }));
    fireEvent.change(screen.getByLabelText("Source term row 2"), { target: { value: "water" } });
    fireEvent.change(screen.getByLabelText("Source unit row 2"), { target: { value: "l" } });
    fireEvent.change(screen.getByLabelText("Operator row 2"), { target: { value: "/" } });
    fireEvent.change(screen.getByLabelText("Operand row 2"), { target: { value: "200" } });
    fireEvent.change(screen.getByLabelText("Operand type row 2"), { target: { value: "number" } });
    fireEvent.change(screen.getByLabelText("Result term row 2"), { target: { value: "tea" } });
    fireEvent.click(screen.getByRole("button", { name: "Add formula" }));
    fireEvent.change(screen.getByLabelText("Source term row 3"), { target: { value: "water" } });
    expect((screen.getByLabelText("Source unit row 3") as HTMLSelectElement).value).toBe("l");
    fireEvent.change(screen.getByLabelText("Source unit row 2"), { target: { value: "ml" } });
    expect((screen.getByLabelText("Source unit row 3") as HTMLSelectElement).value).toBe("ml");
    fireEvent.change(screen.getByLabelText("Source unit row 2"), { target: { value: "l" } });
    fireEvent.click(screen.getByRole("button", { name: "Remove calculation 3" }));
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    fireEvent.click(screen.getByRole("button", { name: "Edit Kombucha F1" }));
    expect((screen.getByLabelText("Source term row 1") as HTMLSelectElement).value).toBe("totalWeight");
    expect((screen.getByLabelText("Source unit row 1") as HTMLSelectElement).value).toBe("kg");
    expect((screen.getByLabelText("Result term row 2") as HTMLSelectElement).value).toBe("tea");
    expect(screen.queryByLabelText(/^Inputs/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    fireEvent.click(screen.getByRole("button", { name: "Start batch" }));
    fireEvent.change(screen.getByLabelText("totalWeight (kg)"), { target: { value: "1.25" } });
    fireEvent.change(screen.getByLabelText("water (l)"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Create active batch" }));
    expect(screen.getByText(/25 g suggested/)).toBeTruthy();
    expect(screen.getByText("tea:").parentElement?.textContent).toContain("5 g suggested");

    fireEvent.change(screen.getByLabelText("totalWeight (kg)"), { target: { value: "2.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Update inputs" }));
    expect(screen.getByText(/50 g suggested/)).toBeTruthy();
    const saltOverride = screen.getByLabelText("Override salt");
    fireEvent.change(saltOverride, { target: { value: "55.5" } });
    fireEvent.submit(saltOverride.closest("form")!);
    expect(screen.getByText(/55.5 g \(overridden\)/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Finish date"), { target: { value: "2026-08-08" } });
    expect(screen.getByText("Ready", { selector: ".status" })).toBeTruthy();
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
    fireEvent.click(screen.getByRole("button", { name: "Edit Kombucha F1" }));
    fireEvent.click(screen.getByRole("button", { name: "Add formula" }));

    const option = Array.from((screen.getByLabelText("Source term row 1") as HTMLSelectElement).options)
      .find(({ value }) => value === "starterLiquid");
    expect(option?.textContent).toBe("Starter Liquid");
  });

  it("persists the settings page preferences", () => {
    const view = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.click(screen.getByRole("button", { name: "°F / qt" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Off" })[0]);

    expect(JSON.parse(localStorage.getItem("fermentstation.shell")!)).toMatchObject({
      units: "imperial",
      checkReminders: false,
      suggestions: true,
    });

    view.unmount();
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByRole("button", { name: "°F / qt" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getAllByRole("button", { name: "Off" })[0].getAttribute("aria-pressed")).toBe("true");
  });

  it("keeps calculation-only results out of sources and chooses unused results", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Profiles" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit Kombucha F1" }));
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
    fireEvent.click(screen.getByRole("button", { name: "Edit Kombucha F1" }));

    expect(screen.getByText(/cannot be edited here, but will be kept/)).toBeTruthy();
    expect(screen.queryByLabelText(/^Calculations/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    expect(JSON.parse(localStorage.getItem("fermentstation.profiles")!).profiles[0].calculations[0].formula)
      .toBe("water / (20 + 2)");

    fireEvent.click(screen.getByRole("button", { name: "Edit Kombucha F1" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove calculation 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    expect(JSON.parse(localStorage.getItem("fermentstation.profiles")!).profiles[0].calculations).toEqual([]);
  });

  it("surfaces recurring checks on Today and Calendar", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Profiles" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit Kombucha F1" }));
    fireEvent.change(screen.getByLabelText(/Expected duration/), { target: { value: "14" } });
    fireEvent.click(screen.getByRole("button", { name: "Add check" }));
    fireEvent.change(screen.getByLabelText("Check name 1"), { target: { value: "Taste" } });
    fireEvent.change(screen.getByLabelText("Check interval 1"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    fireEvent.click(screen.getByRole("button", { name: "Start batch" }));
    const today = localDateForTest();
    const startDate = addDaysForTest(today, -8);
    fireEvent.change(screen.getByLabelText(/start date/i), {
      target: { value: startDate },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create active batch" }));

    expect(screen.getByText(new RegExp(`Overdue ${addDaysForTest(startDate, 2)}`))).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Back to today/i }));
    expect(screen.getByRole("heading", { name: /Action queue/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open Kombucha F1 for Taste" }));
    fireEvent.change(screen.getByLabelText("Taste interval days"), { target: { value: "3" } });
    const adjustedDateValue = addDaysForTest(today, 3);
    expect(screen.getByText(new RegExp(`Next ${adjustedDateValue}|Overdue ${adjustedDateValue}`))).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Activity type"), { target: { value: "check" } });
    fireEvent.click(screen.getByRole("button", { name: "Log activity" }));
    expect(screen.getByText("Completed check: Taste")).toBeTruthy();
    const expectedNextDate = addDaysForTest(today, 3);
    expect(screen.getByText(new RegExp(`Next ${expectedNextDate}`))).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Calendar" }));
    expect(screen.getByText("Finish date")).toBeTruthy();
    expect(screen.getByText("Taste")).toBeTruthy();
    expect(screen.getByText(expectedNextDate)).toBeTruthy();
  });

  it("adds, renames, and removes a batch-local check", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Start batch" }));
    fireEvent.click(screen.getByRole("button", { name: "Create active batch" }));
    fireEvent.click(screen.getByRole("button", { name: "Add check" }));
    fireEvent.change(screen.getByLabelText("Check name"), { target: { value: "Burp" } });
    fireEvent.click(screen.getByRole("button", { name: "Add recurring check" }));

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
    fireEvent.click(screen.getByRole("button", { name: "Edit Kombucha F1" }));
    fireEvent.change(screen.getByLabelText("pH minimum"), { target: { value: "3.2" } });
    fireEvent.change(screen.getByLabelText("pH maximum"), { target: { value: "3.6" } });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    fireEvent.click(screen.getByRole("button", { name: "Start batch" }));
    fireEvent.click(screen.getByRole("button", { name: "Create active batch" }));

    fireEvent.change(screen.getByLabelText("Activity type"), { target: { value: "ph" } });
    fireEvent.change(screen.getByLabelText("pH value"), { target: { value: "15" } });
    fireEvent.click(screen.getByRole("button", { name: "Log activity" }));
    expect(screen.getByText("Outside the usual pH range of 0-14")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Edit pH/ }));
    fireEvent.change(screen.getByLabelText("Activity date"), { target: { value: "2026-08-02" } });
    fireEvent.change(screen.getByLabelText("pH value"), { target: { value: "3.45" } });
    fireEvent.click(screen.getByRole("button", { name: "Save activity" }));
    expect(screen.getByText("optimal")).toBeTruthy();
    expect(screen.getByText("Latest:").parentElement?.textContent).toContain("3.45 on 2026-08-02");
  });

  it("logs temperature in the selected unit and stores Celsius", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.click(screen.getByRole("button", { name: "°F / qt" }));
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    fireEvent.click(screen.getByRole("button", { name: "Start batch" }));
    fireEvent.click(screen.getByRole("button", { name: "Create active batch" }));

    fireEvent.change(screen.getByLabelText("Activity type"), { target: { value: "temperature" } });
    expect(screen.getByLabelText("Temperature (°F)")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Temperature (°F)"), { target: { value: "68" } });
    fireEvent.click(screen.getByRole("button", { name: "Log activity" }));

    expect(screen.getByText("Temperature 68°F")).toBeTruthy();
    expect(JSON.parse(localStorage.getItem("fermentstation.batches")!).batches[0].timeline)
      .toContainEqual(expect.objectContaining({ kind: "temperature", value: 20 }));
  });

  it("attaches, displays, edits, deletes, and restores a local photo", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Start batch" }));
    fireEvent.click(screen.getByRole("button", { name: "Create active batch" }));
    fireEvent.change(screen.getByLabelText("Activity type"), { target: { value: "photo" } });
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

  it("preserves destination and unsaved draft across Fold6 postures", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Batches" }));
    fireEvent.click(screen.getByRole("button", { name: "Start batch" }));
    fireEvent.click(screen.getByRole("button", { name: "Create active batch" }));
    fireEvent.change(screen.getByLabelText("Note or measurement"), {
      target: { value: "Unsaved cover-screen observation" },
    });

    Object.defineProperty(window, "innerWidth", { configurable: true, value: 344 });
    fireEvent(window, new Event("resize"));
    expect(screen.getByRole("button", { name: "Batches" }).getAttribute("aria-current")).toBe("page");
    expect((screen.getByLabelText("Note or measurement") as HTMLInputElement).value)
      .toBe("Unsaved cover-screen observation");

    Object.defineProperty(window, "innerWidth", { configurable: true, value: 884 });
    fireEvent(window, new Event("resize"));
    expect(screen.getByRole("button", { name: "Batches" }).getAttribute("aria-current")).toBe("page");
    expect((screen.getByLabelText("Note or measurement") as HTMLInputElement).value)
      .toBe("Unsaved cover-screen observation");
    expect(screen.getByText("More")).toBeTruthy();
  });

  it("exposes explicit local ZIP exchange without live database sync", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));

    expect(screen.getByRole("button", { name: "Export ZIP archive" })).toBeTruthy();
    expect(screen.getByLabelText("Import ZIP archive")).toBeTruthy();
    expect(screen.getByText(/Live databases and app-private directories are never synchronized/))
      .toBeTruthy();
  });
});
