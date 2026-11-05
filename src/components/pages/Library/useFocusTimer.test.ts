import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { dayKey, loadToday, useFocusTimer } from "./useFocusTimer";

const KEY = "hanul-academy:focus";

beforeEach(() => {
  window.localStorage.removeItem(KEY);
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 5, 21, 0, 0)); // 밤 9시
});
afterEach(() => vi.useRealTimers());

const tick = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe("useFocusTimer — 누적 스톱워치", () => {
  it("처음엔 idle·0초, 시작하면 올라간다", () => {
    const { result } = renderHook(() => useFocusTimer());
    expect(result.current.status).toBe("idle");
    expect(result.current.elapsedSeconds).toBe(0);
    act(() => result.current.start());
    tick(65_000);
    expect(result.current.status).toBe("running");
    expect(result.current.elapsedSeconds).toBe(65);
  });

  it("멈췄다 다시 시작해도 이어서 쌓이고, 이번 연속 시간은 새로 센다", () => {
    const { result } = renderHook(() => useFocusTimer());
    act(() => result.current.start());
    tick(30_000);
    act(() => result.current.pause());
    expect(result.current.runSeconds).toBe(30);
    tick(60_000); // 쉬는 시간은 쌓이지 않음
    expect(result.current.elapsedSeconds).toBe(30);
    act(() => result.current.start());
    tick(10_000);
    expect(result.current.elapsedSeconds).toBe(40);
    expect(result.current.runSeconds).toBe(10);
  });

  it("새로고침(재마운트)해도 오늘 누적은 유지되고 paused로 시작", () => {
    const first = renderHook(() => useFocusTimer());
    act(() => first.result.current.start());
    tick(90_000);
    first.unmount();

    const second = renderHook(() => useFocusTimer());
    expect(second.result.current.elapsedSeconds).toBe(90);
    expect(second.result.current.status).toBe("paused");
  });

  it("어제 기록은 오늘 0으로 시작", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ date: "2026-11-04", seconds: 5000 }),
    );
    expect(loadToday(Date.now())).toBe(0);
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ date: dayKey(Date.now()), seconds: 5000 }),
    );
    expect(loadToday(Date.now())).toBe(5000);
  });

  it("집중 중 자정을 넘기면 새 날 0부터", () => {
    vi.setSystemTime(new Date(2026, 10, 5, 23, 59, 50));
    const { result } = renderHook(() => useFocusTimer());
    act(() => result.current.start());
    tick(5_000);
    expect(result.current.elapsedSeconds).toBe(5);
    tick(10_000); // 00:00:05
    expect(result.current.elapsedSeconds).toBeLessThanOrEqual(5);
  });
});
