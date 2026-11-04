import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { FocusTimer, formatClock } from "./FocusTimer";

describe("formatClock", () => {
  it("MM:SS 로 포맷하고 음수는 00:00", () => {
    expect(formatClock(1500)).toBe("25:00");
    expect(formatClock(61)).toBe("01:01");
    expect(formatClock(-3)).toBe("00:00");
  });
});

describe("FocusTimer", () => {
  it("idle: 집중 시작 → onStart, 초기화는 비활성", async () => {
    const onStart = vi.fn();
    render(
      <FocusTimer
        totalSeconds={1500}
        remainingSeconds={1500}
        onStart={onStart}
      />,
    );
    expect(screen.getByRole("timer")).toHaveTextContent("25:00");
    expect(screen.getByRole("button", { name: "초기화" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "집중 시작" }));
    expect(onStart).toHaveBeenCalledOnce();
  });

  it("running: 일시정지 → onPause", async () => {
    const onPause = vi.fn();
    render(
      <FocusTimer
        totalSeconds={1500}
        remainingSeconds={1000}
        status="running"
        onPause={onPause}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "일시정지" }));
    expect(onPause).toHaveBeenCalledOnce();
  });

  it("paused: 계속하기 → onStart, 초기화 → onReset", async () => {
    const onStart = vi.fn();
    const onReset = vi.fn();
    render(
      <FocusTimer
        totalSeconds={1500}
        remainingSeconds={1000}
        status="paused"
        onStart={onStart}
        onReset={onReset}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "계속하기" }));
    await userEvent.click(screen.getByRole("button", { name: "초기화" }));
    expect(onStart).toHaveBeenCalledOnce();
    expect(onReset).toHaveBeenCalledOnce();
  });

  it("진행률만큼 링이 채워진다 (절반 → dashoffset = 둘레/2)", () => {
    render(<FocusTimer totalSeconds={100} remainingSeconds={50} />);
    const ring = screen.getByTestId("focus-timer-progress");
    const dash = Number(ring.getAttribute("stroke-dasharray"));
    const offset = Number(ring.getAttribute("stroke-dashoffset"));
    expect(offset).toBeCloseTo(dash / 2);
  });
});
