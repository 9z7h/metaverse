import { describe, it, expect } from "vitest";
import { MAGIC_PARTICLES, magicParticle } from "./magicMotion";
import { HOUSE_IDS } from "../houses";

describe("magicParticle — 기숙사별 실습 마법", () => {
  it("모든 기숙사·시점에서 입자는 책상 위 좁은 공간(반경 1m, 높이 0.85~2.4m) 안에 있다", () => {
    for (const house of HOUSE_IDS) {
      for (let t = 0; t < 10; t += 0.37) {
        for (let i = 0; i < MAGIC_PARTICLES; i++) {
          const [x, y, z] = magicParticle(house, i, t);
          expect(Math.hypot(x, z)).toBeLessThanOrEqual(1);
          expect(y).toBeGreaterThanOrEqual(0.85);
          expect(y).toBeLessThanOrEqual(2.4);
          expect(Number.isFinite(x + y + z)).toBe(true);
        }
      }
    }
  });

  it("주작 불씨와 청룡 물줄기는 시간이 지나면 위로 올라간다", () => {
    for (const house of ["jujak", "cheongryong"] as const) {
      // 짧은 구간(0.05초)에서 대부분 입자가 상승 (주기 경계를 넘어 바닥으로 돌아가는 일부는 제외)
      let rising = 0;
      for (let i = 0; i < MAGIC_PARTICLES; i++) {
        if (magicParticle(house, i, 1.05)[1] > magicParticle(house, i, 1)[1])
          rising++;
      }
      expect(rising).toBeGreaterThan(MAGIC_PARTICLES * 0.8);
    }
  });

  it("백호 결계 고리는 퍼져 나간다 (반경 증가)", () => {
    let growing = 0;
    for (let i = 0; i < MAGIC_PARTICLES; i++) {
      const [x0, , z0] = magicParticle("baekho", i, 1);
      const [x1, , z1] = magicParticle("baekho", i, 1.05);
      if (Math.hypot(x1, z1) > Math.hypot(x0, z0)) growing++;
    }
    expect(growing).toBeGreaterThan(MAGIC_PARTICLES * 0.8);
  });

  it("현무 별빛은 일정한 궤도 반경을 유지한다", () => {
    for (let i = 0; i < 6; i++) {
      const r0 = Math.hypot(
        ...magicParticle("hyeonmu", i, 0).filter((_, k) => k !== 1),
      );
      const r1 = Math.hypot(
        ...magicParticle("hyeonmu", i, 3).filter((_, k) => k !== 1),
      );
      expect(r1).toBeCloseTo(r0);
    }
  });
});
