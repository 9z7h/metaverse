import { describe, it, expect } from "vitest";
import {
  CAST_DISTANCE,
  CAST_RELEASE_MS,
  CAST_SWING_MS,
  COOLDOWN_MS,
  MAX_ACTIVE,
  MAX_PARTICLES,
  PARTICLE_COUNTS,
  SPELLS,
  SPELL_ORDER,
  activeCasts,
  addCast,
  canCast,
  castProgress,
  castZone,
  isSpellId,
  resolveLightToggle,
  swingPose,
  wandLightIsOn,
} from "./spellLogic";
import type { SpellCast, SpellId } from "./spellLogic";

function cast(
  caster: string,
  spell: SpellId,
  t0 = 0,
  id = `${caster}-${spell}-${t0}`,
): SpellCast {
  return { id, caster, spell, x: 0, z: 0, ry: 0, t0 };
}

describe("주문 표", () => {
  it("네 주문이 순서대로 있고 이름이 모두 다르다", () => {
    expect(SPELL_ORDER).toHaveLength(4);
    const names = SPELL_ORDER.map((id) => SPELLS[id].name);
    expect(new Set(names).size).toBe(4);
    expect(names).toEqual(["명경", "묵령", "화룡", "부운"]);
  });

  it("isSpellId는 목록의 주문만 통과시킨다", () => {
    for (const id of SPELL_ORDER) expect(isSpellId(id)).toBe(true);
    for (const bad of ["", "toString", "__proto__", 3, null, undefined]) {
      expect(isSpellId(bad)).toBe(false);
    }
  });
});

describe("지팡이 불빛", () => {
  it("시작 시각부터 끌 때까지 켜져 있다", () => {
    const start = 1000;
    expect(wandLightIsOn(null, start)).toBe(false);
    expect(wandLightIsOn(start, start - 1)).toBe(false);
    expect(wandLightIsOn(start, start)).toBe(true);
    expect(wandLightIsOn(start, start + 24 * 60 * 60 * 1000)).toBe(true);
  });
  it("명경과 묵령 입력은 현재 불빛 상태를 반전한다", () => {
    for (const spell of ["myeonggyeong", "mukryeong"] as const) {
      expect(resolveLightToggle(spell, false)).toBe("myeonggyeong");
      expect(resolveLightToggle(spell, true)).toBe("mukryeong");
    }
    expect(resolveLightToggle("hwaryong", true)).toBe("hwaryong");
  });
  it("다른 주문이 많아져도 켜진 명경은 유지된다", () => {
    let list = [cast("a", "myeonggyeong", 0)];
    for (let i = 0; i < MAX_ACTIVE + 3; i++) {
      list = addCast(list, cast(`u${i}`, "buun", i), i);
    }
    expect(
      list.some((c) => c.caster === "a" && c.spell === "myeonggyeong"),
    ).toBe(true);
    expect(list.filter((c) => c.spell !== "myeonggyeong")).toHaveLength(
      MAX_ACTIVE,
    );
    expect(activeCasts(list, 24 * 60 * 60 * 1000).map((c) => c.spell)).toEqual([
      "myeonggyeong",
    ]);
  });
});

describe("파티클 예산", () => {
  it("주문 하나가 쓰는 파티클은 MAX_PARTICLES 이하다", () => {
    for (const id of SPELL_ORDER) {
      expect(PARTICLE_COUNTS[id]).toBeGreaterThan(0);
      expect(PARTICLE_COUNTS[id]).toBeLessThanOrEqual(MAX_PARTICLES);
    }
  });

  it("동시에 남는 최대 효과의 파티클 합이 작게 유지된다", () => {
    const worst = Math.max(...SPELL_ORDER.map((id) => PARTICLE_COUNTS[id]));
    expect(worst * MAX_ACTIVE).toBeLessThanOrEqual(150);
  });
});

describe("castZone", () => {
  it("방향 0이면 +z 쪽, 방향 90도면 +x 쪽 CAST_DISTANCE만큼 앞이다", () => {
    const a = castZone(2, 3, 0);
    expect(a.x).toBeCloseTo(2);
    expect(a.z).toBeCloseTo(3 + CAST_DISTANCE);
    const b = castZone(2, 3, Math.PI / 2);
    expect(b.x).toBeCloseTo(2 + CAST_DISTANCE);
    expect(b.z).toBeCloseTo(3);
  });

  it("어느 방향이든 시전자와 구역 중심 사이 거리는 같다", () => {
    for (let ry = -3; ry <= 3; ry += 0.5) {
      const p = castZone(5, -4, ry);
      expect(Math.hypot(p.x - 5, p.z + 4)).toBeCloseTo(CAST_DISTANCE);
    }
  });
});

describe("canCast", () => {
  it("처음은 가능하고 쿨다운 안에서는 막힌다", () => {
    for (const spell of SPELL_ORDER) {
      expect(canCast(null, 0, spell)).toBe(true);
      expect(canCast(1000, 1000 + COOLDOWN_MS[spell] - 1, spell)).toBe(false);
      expect(canCast(1000, 1000 + COOLDOWN_MS[spell], spell)).toBe(true);
    }
    expect(COOLDOWN_MS).toEqual({
      myeonggyeong: 500,
      mukryeong: 500,
      hwaryong: 8000,
      buun: 6000,
    });
  });
});

describe("castProgress / activeCasts", () => {
  it("지속 시간 안에서는 0~1, 끝나면 null", () => {
    const c = cast("a", "hwaryong", 1000);
    const d = SPELLS.hwaryong.durationMs;
    expect(castProgress(c, 1000)).toBe(0);
    expect(castProgress(c, 1000 + d / 2)).toBeCloseTo(0.5);
    expect(castProgress(c, 1000 + d)).toBeNull();
    expect(castProgress(c, 999)).toBeNull();
  });

  it("끝난 효과는 목록에서 빠진다", () => {
    const list = [cast("a", "mukryeong", 0), cast("b", "buun", 0)];
    const now = SPELLS.mukryeong.durationMs + 1;
    expect(activeCasts(list, now).map((c) => c.caster)).toEqual(["b"]);
  });
});

describe("addCast — 여럿이 써도 부딪히지 않는다", () => {
  it("서로 다른 사람의 같은 주문은 나란히 남는다", () => {
    let list: SpellCast[] = [];
    list = addCast(list, cast("a", "myeonggyeong"), 0);
    list = addCast(list, cast("b", "myeonggyeong"), 10);
    expect(list.map((c) => c.caster)).toEqual(["a", "b"]);
  });

  it("같은 사람이 같은 주문을 다시 쓰면 앞의 것을 바꾼다", () => {
    let list: SpellCast[] = [];
    list = addCast(list, cast("a", "hwaryong", 0), 0);
    list = addCast(list, cast("a", "hwaryong", 2000), 2000);
    expect(list).toHaveLength(1);
    expect(list[0].t0).toBe(2000);
  });

  it("같은 사람의 다른 주문은 함께 남는다", () => {
    let list: SpellCast[] = [];
    list = addCast(list, cast("a", "myeonggyeong"), 0);
    list = addCast(list, cast("a", "hwaryong"), 10);
    expect(list.map((c) => c.spell)).toEqual(["myeonggyeong", "hwaryong"]);
  });

  it("묵령은 시전자 자신의 명경만 거두고 남의 명경은 그대로 둔다", () => {
    let list: SpellCast[] = [];
    list = addCast(list, cast("a", "myeonggyeong"), 0);
    list = addCast(list, cast("b", "myeonggyeong"), 0);
    list = addCast(list, cast("a", "mukryeong", 100), 100);
    const left = list.map((c) => `${c.caster}:${c.spell}`);
    expect(left).toContain("b:myeonggyeong");
    expect(left).not.toContain("a:myeonggyeong");
    expect(left).toContain("a:mukryeong");
  });

  it("MAX_ACTIVE를 넘으면 가장 오래된 것부터 지운다", () => {
    let list: SpellCast[] = [];
    for (let i = 0; i < MAX_ACTIVE + 3; i++) {
      list = addCast(list, cast(`u${i}`, "buun", i), i);
    }
    expect(list).toHaveLength(MAX_ACTIVE);
    expect(list[0].caster).toBe("u3");
    expect(list[list.length - 1].caster).toBe(`u${MAX_ACTIVE + 2}`);
  });

  it("끝난 효과는 새 시전을 넣을 때 정리된다", () => {
    let list: SpellCast[] = [];
    list = addCast(list, cast("a", "mukryeong", 0), 0);
    const later = SPELLS.mukryeong.durationMs + 5;
    list = addCast(list, cast("b", "buun", later), later);
    expect(list.map((c) => c.caster)).toEqual(["b"]);
  });
});

describe("swingPose", () => {
  it("연출 전·후에는 평소 자세다", () => {
    expect(swingPose(-1)).toEqual({ weight: 0, flick: 0 });
    expect(swingPose(CAST_SWING_MS)).toEqual({ weight: 0, flick: 0 });
  });

  it("연출 중 weight는 0~1, flick은 -1~1이다", () => {
    for (let ms = 0; ms < CAST_SWING_MS; ms += 20) {
      const { weight, flick } = swingPose(ms);
      expect(weight).toBeGreaterThanOrEqual(0);
      expect(weight).toBeLessThanOrEqual(1);
      expect(Math.abs(flick)).toBeLessThanOrEqual(1);
    }
  });

  it("정점 전에는 뒤로 젖히고(양수), 정점에서는 앞으로 내뻗는다(음수)", () => {
    expect(swingPose(CAST_SWING_MS * 0.25).flick).toBeGreaterThan(0.5);
    const peak = swingPose(CAST_RELEASE_MS);
    expect(peak.flick).toBeCloseTo(-1, 1);
    expect(peak.weight).toBeCloseTo(1, 1);
  });

  it("끝날 때는 팔이 천천히 평소 자세로 돌아온다", () => {
    const late = swingPose(CAST_SWING_MS * 0.9);
    expect(late.weight).toBeLessThan(0.5);
    expect(swingPose(CAST_SWING_MS * 0.99).weight).toBeLessThan(0.05);
  });
});

describe("시작 전 효과", () => {
  it("동작 정점을 기다리는 효과도 목록에서 지워지지 않는다", () => {
    let list: SpellCast[] = [];
    list = addCast(list, cast("a", "hwaryong", CAST_RELEASE_MS), 0);
    expect(list).toHaveLength(1);
    expect(castProgress(list[0], 0)).toBeNull();
    expect(castProgress(list[0], CAST_RELEASE_MS + 1)).not.toBeNull();
    expect(activeCasts(list, 100)).toHaveLength(1);
  });
});
