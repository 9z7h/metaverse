import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SpaceSelect } from "./SpaceSelect";

describe("SpaceSelect", () => {
  it.each([
    ["garden", "먹빛각 · 서고 이동", "library"],
    ["library", "숨돌림 뜰 · 쉬어 가는 중 이동", "garden"],
  ] as const)("moves from %s", async (current, label, destination) => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SpaceSelect current={current} onChange={onChange} />);
    await user.click(
      screen.getByText(
        current === "garden" ? "숨돌림 뜰 · 쉬어 가는 중" : "먹빛각 · 서고",
      ),
    );
    await user.click(screen.getByRole("button", { name: label }));
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith(destination);
  });
  it("closes on Escape and restores focus", async () => {
    const user = userEvent.setup();
    render(<SpaceSelect current="garden" onChange={vi.fn()} />);
    const trigger = screen
      .getByText("숨돌림 뜰 · 쉬어 가는 중")
      .closest("summary")!;
    await user.click(trigger);
    trigger.focus();
    await user.keyboard("{Escape}");
    expect(trigger.parentElement).not.toHaveAttribute("open");
    expect(trigger).toHaveFocus();
  });
});
