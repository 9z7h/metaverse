import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { FocusTimer, formatClock, hourProgress } from "./FocusTimer";

describe("formatClock", () => {
  it("1시간 미만은 MM:SS, 이상은 H:MM:SS, 음수는 00:00", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(61)).toBe("01:01");
    expect(formatClock(3599)).toBe("59:59");
    expect(formatClock(3600)).toBe("1:00:00");
    expect(formatClock(3 * 3600 + 5 * 60 + 9)).toBe("3:05:09");
    expect(formatClock(-3)).toBe("00:00");
  });
});

describe("hourProgress", () => {
  it("1시간마다 한 바퀴", () => {
    expect(hourProgress(0)).toBe(0);
    expect(hourProgress(1800)).toBe(0.5);
    expect(hourProgress(3600)).toBe(0);
    expect(hourProgress(3600 + 900)).toBe(0.25);
  });
});

describe("FocusTimer", () => {
  it("idle: 집중 시작 → onStart, 초기화 버튼 없음", async () => {
    const onStart = vi.fn();
    render(<FocusTimer elapsedSeconds={0} onStart={onStart} />);
    expect(screen.getByRole("timer")).toHaveTextContent("00:00");
    expect(screen.queryByRole("button", { name: "초기화" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "집중 시작" }));
    expect(onStart).toHaveBeenCalledOnce();
  });

  it("running: 일시정지 → onPause", async () => {
    const onPause = vi.fn();
    render(
      <FocusTimer elapsedSeconds={1000} status="running" onPause={onPause} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "일시정지" }));
    expect(onPause).toHaveBeenCalledOnce();
  });

  it("paused: 계속하기 → onStart", async () => {
    const onStart = vi.fn();
    render(
      <FocusTimer elapsedSeconds={1000} status="paused" onStart={onStart} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "계속하기" }));
    expect(onStart).toHaveBeenCalledOnce();
  });

  it("30분 누적 → 링 절반 (dashoffset = 둘레/2)", () => {
    render(<FocusTimer elapsedSeconds={1800} />);
    const ring = screen.getByTestId("focus-timer-progress");
    const dash = Number(ring.getAttribute("stroke-dasharray"));
    const offset = Number(ring.getAttribute("stroke-dashoffset"));
    expect(offset).toBeCloseTo(dash / 2);
  });
});
