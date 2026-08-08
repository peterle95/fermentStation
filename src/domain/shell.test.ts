import { describe, expect, it } from "vitest";
import { createShellState, defaultFormulaTerms, selectDestination } from "./shell";

describe("shell state", () => {
  it("selects a primary destination without mutating the previous state", () => {
    const today = createShellState();

    const batches = selectDestination(today, "batches");

    expect(today.destination).toBe("today");
    expect(today.formulaTerms).toEqual(defaultFormulaTerms);
    expect(batches).toEqual({ destination: "batches", formulaTerms: defaultFormulaTerms });
  });

  it("preserves state when selecting the current destination", () => {
    const today = createShellState();

    expect(selectDestination(today, "today")).toBe(today);
  });
});
