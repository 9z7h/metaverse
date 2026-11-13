import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSpellCaster } from "./useSpellCaster";
import { BODY_FADE_OUT_MS } from "./spellLogic";
import type { SpellCast } from "./spellLogic";

afterEach(() => vi.restoreAllMocks());

describe("지팡이 불빛 토글", () => {
  it("명경 버튼을 다시 누르면 묵령을 보내고 불빛을 끈다", () => {
    const now = vi.spyOn(performance, "now").mockReturnValue(1000);
    const { result } = renderHook(() =>
      useSpellCaster({
        selfId: "me",
        getPose: () => ({ x: 0, z: 0, ry: 0 }),
        enabled: true,
      }),
    );
    const sent: SpellCast[] = [];
    act(() => {
      const cast = result.current.cast("myeonggyeong");
      if (cast) sent.push(cast);
    });
    expect(sent[0]?.spell).toBe("myeonggyeong");
    expect(result.current.lightOn).toBe(true);
    now.mockReturnValue(1500);
    act(() => {
      const cast = result.current.cast("myeonggyeong");
      if (cast) sent.push(cast);
    });
    expect(sent[1]?.spell).toBe("mukryeong");
    expect(result.current.lightOn).toBe(false);
    now.mockReturnValue(2000);
    act(() => {
      const cast = result.current.cast("mukryeong");
      if (cast) sent.push(cast);
    });
    expect(sent[2]?.spell).toBe("myeonggyeong");
    expect(result.current.lightOn).toBe(true);
  });

  it("화룡과 부운은 서로 독립적인 쿨타임을 적용한다", () => {
    const now = vi.spyOn(performance, "now").mockReturnValue(1000);
    const { result } = renderHook(() =>
      useSpellCaster({
        selfId: "me",
        getPose: () => ({ x: 0, z: 0, ry: 0 }),
        enabled: true,
      }),
    );
    const results: (SpellCast | null)[] = [];
    act(() => {
      results.push(result.current.cast("hwaryong"));
    });
    act(() => {
      results.push(result.current.cast("buun"));
    });
    expect(results.map((c) => c?.spell)).toEqual(["hwaryong", "buun"]);
    expect(result.current.cooldowns.hwaryong).toBe(8000);
    expect(result.current.cooldowns.buun).toBe(6000);
    now.mockReturnValue(6999);
    act(() => {
      results.push(result.current.cast("buun"));
    });
    expect(results[2]).toBeNull();
    now.mockReturnValue(7000);
    act(() => {
      results.push(result.current.cast("buun"));
    });
    expect(results[3]?.spell).toBe("buun");
    expect(result.current.cooldowns.hwaryong).toBe(2000);
    now.mockReturnValue(8999);
    act(() => {
      results.push(result.current.cast("hwaryong"));
    });
    expect(results[4]).toBeNull();
    now.mockReturnValue(9000);
    act(() => {
      results.push(result.current.cast("hwaryong"));
    });
    expect(results[5]?.spell).toBe("hwaryong");
  });
});

describe("해금과 몸 주문", () => {
  const setup = (totalSeconds?: number) =>
    renderHook(() =>
      useSpellCaster({
        selfId: "me",
        getPose: () => ({ x: 0, z: 0, ry: 0 }),
        enabled: true,
        totalSeconds,
      }),
    );

  it("누적 수련 시간이 모자라면 풀리지 않은 주문을 시전하지 못한다", () => {
    vi.spyOn(performance, "now").mockReturnValue(1000);
    const { result } = setup(3599);
    const results: (SpellCast | null)[] = [];
    act(() => {
      results.push(result.current.cast("sosin"));
      results.push(result.current.cast("suhoryeong"));
      results.push(result.current.cast("hwaryong"));
    });
    expect(results.map((c) => c?.spell ?? null)).toEqual([
      null,
      null,
      "hwaryong",
    ]);
    // 거부된 시전은 쿨다운을 쓰지 않는다
    expect(result.current.cooldowns.sosin).toBe(0);
  });

  it("풀린 뒤에는 시전하고 효과 시간만큼 쿨다운이 돈다", () => {
    const now = vi.spyOn(performance, "now").mockReturnValue(1000);
    const { result } = setup(3600);
    const results: (SpellCast | null)[] = [];
    act(() => {
      results.push(result.current.cast("sosin"));
    });
    expect(results[0]?.spell).toBe("sosin");
    expect(result.current.cooldowns.sosin).toBe(1500);
    now.mockReturnValue(1000 + 1499);
    act(() => {
      results.push(result.current.cast("sosin"));
    });
    expect(results[1]).toBeNull();
  });

  it("몸 주문은 한 사람에게 하나만 남는다", () => {
    vi.spyOn(performance, "now").mockReturnValue(1000);
    const { result } = setup(5 * 3600);
    act(() => {
      result.current.cast("sosin");
    });
    act(() => {
      result.current.cast("eunhyeong");
    });
    const body = result.current.casts
      .filter((c) => c.caster === "me")
      .map((c) => c.spell);
    expect(body).toEqual(["eunhyeong"]);
  });

  it("소신 중에 거신을 쓰면 원래 크기로 돌아온다", () => {
    const now = vi.spyOn(performance, "now").mockReturnValue(1000);
    const { result } = setup(3600);
    act(() => {
      result.current.cast("sosin");
    });
    const first = result.current.casts.find((c) => c.spell === "sosin");
    expect(first?.durationMs).toBeUndefined();
    now.mockReturnValue(1000 + 60_000);
    act(() => {
      result.current.cast("geosin");
    });
    const kinds = result.current.casts.map((c) => c.spell);
    expect(kinds).toEqual(["sosin"]);
    // 시전 사이 60초가 지난 시점에서 서서히 끝난다
    expect(result.current.casts[0].durationMs).toBe(60_000 + BODY_FADE_OUT_MS);
  });
});
