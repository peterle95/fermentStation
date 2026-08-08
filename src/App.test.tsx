// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "./App";

describe("batch workflow", () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

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

    expect(screen.getByText("Profile snapshot:").parentElement?.textContent).toContain(
      "Kombucha F1",
    );

    fireEvent.click(screen.getByRole("button", { name: "Mark ready" }));
    expect(screen.getByText("Ready", { selector: ".status" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Batches" }));
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "active" } });
    expect(screen.getByText("No batches match this status.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "ready" } });
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
    fireEvent.click(screen.getByRole("button", { name: "Add activity" }));
    expect(screen.getByText("Tasted tart")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Edit note from 2026-08-02" }));
    fireEvent.change(screen.getByLabelText("Note or measurement"), {
      target: { value: "Tasted pleasantly tart" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save activity" }));
    expect(screen.getByText("Tasted pleasantly tart")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Delete note from 2026-08-02" }));
    fireEvent.click(screen.getByRole("button", { name: "Restore note from 2026-08-02" }));
    expect(screen.getByText("Tasted pleasantly tart")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Mark ready" }));
    expect(screen.getByText("Status: Ready")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete batch" }));
    fireEvent.click(screen.getByRole("button", { name: "Restore Kombucha F1" }));
    expect(screen.getByText("Tasted pleasantly tart")).toBeTruthy();
  });

  it("uses profile calculations, batch overrides, and finish dates", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Profiles" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit Kombucha F1" }));
    fireEvent.change(screen.getByLabelText(/Expected duration/), { target: { value: "7" } });
    fireEvent.change(screen.getByLabelText(/^Inputs/), {
      target: { value: "cabbage, kg, 2" },
    });
    fireEvent.change(screen.getByLabelText(/^Calculations/), {
      target: { value: "salt, g, cabbage * 2%" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    fireEvent.click(screen.getByRole("button", { name: "Start batch" }));
    fireEvent.change(screen.getByLabelText("cabbage (kg)"), { target: { value: "1.25" } });
    fireEvent.click(screen.getByRole("button", { name: "Create active batch" }));
    expect(screen.getByText(/25 g suggested/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("cabbage (kg)"), { target: { value: "2.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Update inputs" }));
    expect(screen.getByText(/50 g suggested/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Override salt"), { target: { value: "55.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Override" }));
    expect(screen.getByText(/55.5 g \(overridden\)/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Finish date"), { target: { value: "2026-08-08" } });
    expect(screen.getByText("Ready", { selector: ".status" })).toBeTruthy();
  });

  it("surfaces recurring checks on Today and Calendar", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Profiles" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit Kombucha F1" }));
    fireEvent.change(screen.getByLabelText(/Expected duration/), { target: { value: "14" } });
    fireEvent.change(screen.getByLabelText(/^Recurring checks/), {
      target: { value: "Taste, 2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    fireEvent.click(screen.getByRole("button", { name: "Start batch" }));
    fireEvent.change(screen.getByLabelText(/start date/i), {
      target: { value: "2026-08-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create active batch" }));

    expect(screen.getByText(/Overdue 2026-08-03/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Taste interval days"), { target: { value: "3" } });
    expect(screen.getByText(/Overdue 2026-08-04/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Complete Taste" }));
    expect(screen.getByText("Completed check: Taste")).toBeTruthy();
    expect(screen.getByText(/Next 2026-08-11/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Calendar" }));
    expect(screen.getByText("Finish date")).toBeTruthy();
    expect(screen.getByText("Taste")).toBeTruthy();
    expect(screen.getByText("2026-08-11")).toBeTruthy();
  });

  it("records editable pH readings with warnings and profile zones", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Profiles" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit Kombucha F1" }));
    fireEvent.change(screen.getByLabelText(/^pH zones/), {
      target: { value: "safe, 2.5, 3.1\noptimal, 3.2, 3.6" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    fireEvent.click(screen.getByRole("button", { name: "Start batch" }));
    fireEvent.click(screen.getByRole("button", { name: "Create active batch" }));

    fireEvent.change(screen.getByLabelText("pH value"), { target: { value: "15" } });
    fireEvent.click(screen.getByRole("button", { name: "Add pH" }));
    expect(screen.getByText("Outside the usual pH range of 0-14")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Edit pH/ }));
    fireEvent.change(screen.getByLabelText("pH date"), { target: { value: "2026-08-02" } });
    fireEvent.change(screen.getByLabelText("pH value"), { target: { value: "3.45" } });
    fireEvent.click(screen.getByRole("button", { name: "Save pH" }));
    expect(screen.getByText("optimal")).toBeTruthy();
    expect(screen.getByText("Latest:").parentElement?.textContent).toContain("3.45 on 2026-08-02");
  });

  it("attaches, displays, edits, deletes, and restores a local photo", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Start batch" }));
    fireEvent.click(screen.getByRole("button", { name: "Create active batch" }));
    const file = new File(["original photo bytes"], "jar.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText("Photo"), { target: { files: [file] } });
    fireEvent.change(screen.getByLabelText("Caption"), { target: { value: "Jar day one" } });
    fireEvent.submit(screen.getByRole("button", { name: "Attach photo" }).closest("form")!);

    const image = await screen.findByRole("img", { name: "Jar day one" });
    expect(image.getAttribute("src")).toContain("data:image/jpeg;base64,");
    fireEvent.click(screen.getByRole("button", { name: /Edit photo/ }));
    fireEvent.change(screen.getByLabelText("Caption"), { target: { value: "Jar day two" } });
    fireEvent.click(screen.getByRole("button", { name: "Save photo" }));
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
});
