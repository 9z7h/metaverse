import { describe, it, expect } from "vitest";
import { SEGMENTS, STREAKS, streakPoint, tornadoStreak } from "./magicMotion";

describe("마법 회오리 — tornadoStreak / streakPoint", () => {
  it("모든 가닥·마디는 책상 위 좁은 공간(반경 0.7m, 높이 0.6~2.4m) 안에 있다", () => {
    for (let t = 0; t < 8; t += 0.21) {
      for (let i = 0; i < STREAKS; i++) {
        const f = tornadoStreak(i, t);
        for (let s = 0; s < SEGMENTS; s++) {
          const [x, y, z] = streakPoint(f, s / (SEGMENTS - 1));
          expect(Math.hypot(x, z)).toBeLessThanOrEqual(0.7);
          expect(y).toBeGreaterThanOrEqual(0.6);
          expect(y).toBeLessThanOrEqual(2.4);
        }
      }
    }
  });

  it("깔때기 모양 — 높이 올라갈수록 반지름이 넓다", () => {
    // 같은 가닥에서 아래쪽(h<0.3)일 때와 위쪽(h>0.7)일 때를 비교
    const frames = Array.from({ length: 300 }, (_, k) =>
      tornadoStreak(0, k * 0.01),
    );
    const low = frames.find((f) => f.h < 0.3)!;
    const high = frames.find((f) => f.h > 0.7)!;
    expect(high.y).toBeGreaterThan(low.y);
    expect(high.radius).toBeGreaterThan(low.radius);
  });

  it("바닥과 꼭대기에선 흐리고(fade≈0) 중간에서 가장 밝다", () => {
    for (let i = 0; i < STREAKS; i++) {
      for (let t = 0; t < 4; t += 0.13) {
        const f = tornadoStreak(i, t);
        expect(f.fade).toBeGreaterThanOrEqual(0);
        expect(f.fade).toBeLessThanOrEqual(1);
        if (f.h < 0.05 || f.h > 0.95) expect(f.fade).toBeLessThan(0.2);
      }
    }
  });

  it("회오리는 돈다 — 짧은 시간에 머리 각도가 증가", () => {
    for (let i = 0; i < STREAKS; i++) {
      expect(tornadoStreak(i, 1.02).angle).toBeGreaterThan(
        tornadoStreak(i, 1).angle,
      );
    }
  });
});
