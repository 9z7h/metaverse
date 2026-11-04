import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Joystick, toJoystickVector } from "./Joystick";

// jsdom에는 PointerEvent가 없어 clientX/pointerId가 전달되지 않는다 → MouseEvent 기반 폴리필
if (typeof window.PointerEvent === "undefined") {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
    }
  }
  window.PointerEvent = PointerEventPolyfill as unknown as typeof PointerEvent;
}

describe("toJoystickVector", () => {
  it("반지름 안쪽은 그대로 정규화", () => {
    expect(toJoystickVector(28, 0, 56)).toEqual({ x: 0.5, y: 0 });
  });
  it("반지름 밖은 길이 1로 클램프", () => {
    const v = toJoystickVector(300, 400, 56);
    expect(v.x).toBeCloseTo(0.6);
    expect(v.y).toBeCloseTo(0.8);
  });
  it("반지름 0이거나 좌표가 숫자가 아니면 0 벡터", () => {
    expect(toJoystickVector(10, 10, 0)).toEqual({ x: 0, y: 0 });
    expect(toJoystickVector(NaN, 10, 56)).toEqual({ x: 0, y: 0 });
  });
});

describe("Joystick", () => {
  it("드래그 → onMove, 손 떼면 onEnd + 노브 원위치", () => {
    const onMove = vi.fn();
    const onEnd = vi.fn();
    render(<Joystick onMove={onMove} onEnd={onEnd} />);
    const pad = screen.getByRole("application", { name: "이동 조이스틱" });

    // jsdom은 레이아웃이 없어 중심 (0,0), 반지름 56(fallback) 기준으로 계산된다
    fireEvent.pointerDown(pad, { pointerId: 1, clientX: 0, clientY: -56 });
    expect(onMove).toHaveBeenLastCalledWith({ x: 0, y: -1 });

    fireEvent.pointerMove(pad, { pointerId: 1, clientX: 28, clientY: 0 });
    expect(onMove).toHaveBeenLastCalledWith({ x: 0.5, y: 0 });

    // 다른 포인터의 move는 무시
    fireEvent.pointerMove(pad, { pointerId: 2, clientX: 0, clientY: 56 });
    expect(onMove).toHaveBeenCalledTimes(2);

    fireEvent.pointerUp(pad, { pointerId: 1 });
    expect(onEnd).toHaveBeenCalledOnce();
    expect(screen.getByTestId("joystick-knob").style.transform).toContain(
      "* 0)",
    );
  });
});
