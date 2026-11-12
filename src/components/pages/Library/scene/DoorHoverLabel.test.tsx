import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DoorHoverLabel, moveDoorLabel } from "./DoorHoverLabel";

describe("문 위 안내", () => {
  it("글을 보여 주고 처음 마우스 곁에 놓인다", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <DoorHoverLabel
        label="정원으로 나가기"
        labelRef={ref}
        at={{ x: 100, y: 50 }}
      />,
    );
    expect(screen.getByText("정원으로 나가기")).toBe(ref.current);
    expect(ref.current?.style.transform).toBe("translate(116px, 70px)");
  });

  it("클릭을 가로채지 않는다", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <DoorHoverLabel label="들어가기" labelRef={ref} at={{ x: 0, y: 0 }} />,
    );
    expect(ref.current?.style.pointerEvents).toBe("none");
  });

  it("마우스를 따라 옮겨진다", () => {
    const el = document.createElement("div");
    moveDoorLabel(el, 10, 20);
    expect(el.style.transform).toBe("translate(26px, 40px)");
    expect(() => moveDoorLabel(null, 1, 1)).not.toThrow();
  });
});
