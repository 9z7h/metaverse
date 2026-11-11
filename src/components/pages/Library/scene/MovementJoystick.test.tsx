import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MovementJoystick } from "./MovementJoystick";

function pointer(type: string, x: number, y: number, id = 1) {
  const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
  Object.defineProperty(event, "pointerId", { value: id });
  return event;
}

describe("MovementJoystick", () => {
  it("방향을 제한하고 손을 떼거나 취소하면 이동을 멈춘다", () => {
    const onMove = vi.fn();
    render(<MovementJoystick onMove={onMove} />);
    const stick = screen.getByLabelText(/이동 조이스틱/);
    stick.setPointerCapture = vi.fn();
    vi.spyOn(stick, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
      right: 100,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    fireEvent(stick, pointer("pointerdown", 150, 50));
    expect(onMove).toHaveBeenLastCalledWith({ x: 1, y: 0 });
    fireEvent(stick, pointer("pointermove", 50, 0));
    expect(onMove).toHaveBeenLastCalledWith({ x: 0, y: -1 });
    fireEvent(stick, pointer("pointercancel", 50, 0));
    expect(onMove).toHaveBeenLastCalledWith({ x: 0, y: 0 });
  });
});
