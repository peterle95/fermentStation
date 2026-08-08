import { afterEach, describe, expect, it, vi } from "vitest";
import { createShellState, defaultFormulaTerms } from "../domain/shell";
import { browserShellStore, createShellStore } from "./shell-store";

describe("shell store", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("persists through the browser storage adapter", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });

    browserShellStore.save({ destination: "calendar", formulaTerms: ["water", "tea"] });

    expect(browserShellStore.load()).toEqual({ destination: "calendar", formulaTerms: ["water", "tea"] });
  });

  it("round-trips a selected destination", () => {
    const values = new Map<string, string>();
    const store = createShellStore({
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    });

    store.save({ destination: "batches", formulaTerms: ["totalWeight", "salt"] });

    expect(store.load()).toEqual({ destination: "batches", formulaTerms: ["totalWeight", "salt"] });
  });

  it("adds default formula terms to older persisted state", () => {
    const store = createShellStore({
      getItem: () => '{"destination":"profiles"}',
      setItem: () => undefined,
    });

    expect(store.load()).toEqual({ destination: "profiles", formulaTerms: defaultFormulaTerms });
  });

  it.each([
    '[]',
    '["water","water"]',
    '["water weight"]',
    '[42]',
  ])("rejects malformed formula terms: %s", (formulaTerms) => {
    const store = createShellStore({
      getItem: () => `{"destination":"profiles","formulaTerms":${formulaTerms}}`,
      setItem: () => undefined,
    });

    expect(store.load()).toBeNull();
  });

  it("ignores an invalid persisted destination", () => {
    const store = createShellStore({
      getItem: () => '{"destination":"unknown"}',
      setItem: () => undefined,
    });

    expect(store.load()).toBeNull();
  });

  it("ignores malformed persisted data", () => {
    const store = createShellStore({
      getItem: () => "{",
      setItem: () => undefined,
    });

    expect(store.load()).toBeNull();
  });

  it.each(["42", "true", "[]", "null"])("ignores %s persisted data", (value) => {
    const store = createShellStore({
      getItem: () => value,
      setItem: () => undefined,
    });

    expect(store.load()).toBeNull();
  });

  it("continues when local persistence is unavailable", () => {
    const store = createShellStore({
      getItem: () => {
        throw new Error("storage blocked");
      },
      setItem: () => {
        throw new Error("storage blocked");
      },
    });

    expect(store.load()).toBeNull();
    expect(() => store.save(createShellState())).not.toThrow();
  });
});
