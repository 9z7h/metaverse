import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import {
  dayKey,
  loadPastSeconds,
  loadToday,
  useFocusTimer,
} from "./useFocusTimer";

const KEY = "hanul-academy:focus";
const PAST = "hanul-academy:past";

beforeEach(() => {
  window.localStorage.removeItem(KEY);
  window.localStorage.removeItem(PAST);
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

describe("loadPastSeconds — 오늘 이전 누적(데모)", () => {
  const now = new Date(2026, 10, 5, 21, 0, 0).getTime();
  const yesterday = dayKey(new Date(2026, 10, 4, 12).getTime());

  it("기록이 없으면 0", () => {
    expect(loadPastSeconds(now)).toBe(0);
  });

  it("오늘 기록은 합치지 않는다", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ date: dayKey(now), seconds: 900 }),
    );
    expect(loadPastSeconds(now)).toBe(0);
    expect(loadToday(now)).toBe(900);
  });

  it("지난 날 기록은 누적에 합치고 오늘 기록을 비운다 — 두 번 불러도 한 번만", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ date: yesterday, seconds: 1800 }),
    );
    expect(loadPastSeconds(now)).toBe(1800);
    expect(loadPastSeconds(now)).toBe(1800);
    expect(loadToday(now)).toBe(0);
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ date: yesterday, seconds: 600 }),
    );
    expect(loadPastSeconds(now)).toBe(2400);
  });

  it("망가진 값은 0으로 본다", () => {
    window.localStorage.setItem(PAST, "많이");
    window.localStorage.setItem(KEY, "{");
    expect(loadPastSeconds(now)).toBe(0);
  });
});
