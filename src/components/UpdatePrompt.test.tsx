// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UpdatePrompt } from "./UpdatePrompt";
import { pwaUpdate } from "../platform/pwa";

afterEach(cleanup);

describe("UpdatePrompt", () => {
  it("stays hidden until an update waits, then applies it on Update", () => {
    render(<UpdatePrompt />);
    expect(screen.queryByTestId("update-prompt")).toBeNull();

    const apply = vi.fn(() => Promise.resolve());
    act(() => pwaUpdate.offer(apply));
    fireEvent.click(screen.getByRole("button", { name: "Update" }));

    expect(apply).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Updating…" })).toHaveProperty("disabled", true);
  });

  it("hides on Later without applying", () => {
    const apply = vi.fn(() => Promise.resolve());
    act(() => pwaUpdate.offer(apply));
    render(<UpdatePrompt />);
    fireEvent.click(screen.getByRole("button", { name: "Later" }));
    expect(screen.queryByTestId("update-prompt")).toBeNull();
    expect(apply).not.toHaveBeenCalled();
  });
});
