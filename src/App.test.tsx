// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "./App";

describe("batch workflow", () => {
  beforeEach(() => localStorage.clear());

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
});
