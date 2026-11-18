import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  chatLengthBucket,
  initAnalytics,
  resetAnalyticsForTest,
  totalHoursBucket,
  trackEvent,
  trackFirstMove,
  trackOnce,
  trackWorldLoaded,
} from "./analytics";

describe("analytics", () => {
  let gtag: ReturnType<typeof vi.fn<(...args: unknown[]) => void>>;

  beforeEach(() => {
    resetAnalyticsForTest();
    gtag = vi.fn<(...args: unknown[]) => void>();
    window.gtag = gtag;
  });
  afterEach(() => {
    delete window.gtag;
  });

  it("개발·테스트 빌드에서는 GA 스크립트를 넣지 않는다", () => {
    delete window.gtag;
    initAnalytics();
    expect(
      document.querySelector('script[src*="googletagmanager"]'),
    ).toBeNull();
    expect(window.gtag).toBeUndefined();
  });

  it("GA가 없으면 trackEvent가 아무 일도 하지 않는다", () => {
    delete window.gtag;
    expect(() => trackEvent("music_toggle", { state: "on" })).not.toThrow();
  });

  it("trackEvent는 이름과 파라미터를 gtag로 넘긴다", () => {
    trackEvent("spell_cast", { spell_id: "hwaryong" });
    expect(gtag).toHaveBeenCalledWith("event", "spell_cast", {
      spell_id: "hwaryong",
    });
  });

  it("trackOnce는 같은 key로 한 번만 보낸다", () => {
    expect(trackOnce("joystick_used", {})).toBe(true);
    expect(trackOnce("joystick_used", {})).toBe(false);
    expect(gtag).toHaveBeenCalledTimes(1);
  });

  it("trackOnce는 key가 다르면 따로 센다", () => {
    trackOnce("spell_locked_view", { spell_id: "sosin" }, "a:sosin");
    trackOnce("spell_locked_view", { spell_id: "geosin" }, "a:geosin");
    trackOnce("spell_locked_view", { spell_id: "sosin" }, "a:sosin");
    expect(gtag).toHaveBeenCalledTimes(2);
  });

  it("첫 이동은 먼저 온 입력만 기록한다", () => {
    trackFirstMove("joystick");
    trackFirstMove("keyboard");
    expect(gtag).toHaveBeenCalledTimes(1);
    expect(gtag.mock.calls[0][2]).toMatchObject({ input: "joystick" });
  });

  it("3D 로딩·첫 이동 시간은 입장 화면에 머문 시간을 빼고 잰다", () => {
    const now = vi.spyOn(performance, "now");
    now.mockReturnValue(30_000);
    trackWorldLoaded("library", 27_500);
    now.mockReturnValue(34_000);
    trackFirstMove("keyboard");
    expect(gtag.mock.calls[0][2]).toEqual({ scene: "library", load_ms: 2500 });
    expect(gtag.mock.calls[1][2]).toEqual({
      input: "keyboard",
      sec_after_world: 4,
    });
    now.mockRestore();
  });

  it("채팅 길이는 구간으로만 보낸다", () => {
    expect(chatLengthBucket("안녕")).toBe("short");
    expect(chatLengthBucket("오늘은 알고리즘 문제를 세 개 풀었어요")).toBe(
      "mid",
    );
    expect(chatLengthBucket("가".repeat(41))).toBe("long");
  });

  it("누적 수련 시간 구간은 주문 해제 기준과 같다", () => {
    expect(totalHoursBucket(0)).toBe("0");
    expect(totalHoursBucket(3599)).toBe("0");
    expect(totalHoursBucket(3600)).toBe("1+");
    expect(totalHoursBucket(3 * 3600)).toBe("3+");
    expect(totalHoursBucket(5 * 3600)).toBe("5+");
  });
});
