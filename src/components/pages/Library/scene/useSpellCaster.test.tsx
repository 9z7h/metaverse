import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSpellCaster } from "./useSpellCaster";
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
