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
});
