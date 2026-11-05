import { describe, it, expect } from "vitest";
import {
  DISSOLVE_MS,
  DISSOLVE_PARTICLES,
  SEGMENTS,
  STREAKS,
  dissolveAlpha,
  dissolveParticle,
  dissolveProgress,
  dissolveRise,
  streakPoint,
  tornadoStreak,
  trackLeavers,
} from "./magicMotion";
import type { PresenceStudent } from "../libraryPresence";

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

describe("퇴장 — 스르륵 사라지기", () => {
  it("진행도는 0~1로 고정된다", () => {
    expect(dissolveProgress(-50)).toBe(0);
    expect(dissolveProgress(DISSOLVE_MS / 2)).toBeCloseTo(0.5);
    expect(dissolveProgress(DISSOLVE_MS * 9)).toBe(1);
  });

  it("아바타 불투명도는 1에서 시작해 0으로 끝나고, 줄어들기만 한다", () => {
    expect(dissolveAlpha(0)).toBe(1);
    expect(dissolveAlpha(1)).toBe(0);
    let prev = 1;
    for (let p = 0; p <= 1.0001; p += 0.02) {
      const a = dissolveAlpha(p);
      expect(a).toBeLessThanOrEqual(prev + 1e-9);
      prev = a;
    }
  });

  it("떠오르는 높이는 0에서 0.45m까지 늘어나기만 한다", () => {
    expect(dissolveRise(0)).toBe(0);
    expect(dissolveRise(1)).toBeCloseTo(0.45);
    expect(dissolveRise(0.5)).toBeGreaterThan(dissolveRise(0.2));
    expect(dissolveRise(5)).toBeCloseTo(0.45);
  });

  it("빛 입자는 몸 주변 좁은 공간(반경 0.7m, 높이 0.25~2.8m)에서 유한한 값으로 움직인다", () => {
    for (let p = 0; p <= 1; p += 0.05)
      for (let i = 0; i < DISSOLVE_PARTICLES; i++) {
        const q = dissolveParticle(i, p);
        expect(Number.isFinite(q.x + q.y + q.z + q.alpha)).toBe(true);
        expect(Math.hypot(q.x, q.z)).toBeLessThanOrEqual(0.7);
        expect(q.y).toBeGreaterThanOrEqual(0.25);
        expect(q.y).toBeLessThanOrEqual(2.8);
        expect(q.alpha).toBeGreaterThanOrEqual(0);
        expect(q.alpha).toBeLessThanOrEqual(1);
      }
  });

  it("입자는 결정적이고 시간이 지나면 위로 올라간다", () => {
    expect(dissolveParticle(3, 0.4)).toEqual(dissolveParticle(3, 0.4));
    expect(dissolveParticle(3, 0.9).y).toBeGreaterThan(
      dissolveParticle(3, 0.1).y,
    );
    expect(dissolveParticle(3, 0).alpha).toBe(0);
    expect(dissolveParticle(3, 1).alpha).toBe(0);
  });
});

describe("퇴장 추적 — trackLeavers", () => {
  const student = (id: string, seatId = "L1"): PresenceStudent => ({
    id,
    name: id,
    subject: "",
    seatId,
    focusing: false,
    focusSeconds: 0,
    house: "jujak",
    mode: "theory",
  });
  const a = student("a");
  const b = student("b", "L2");

  it("목록에서 빠진 학생이 퇴장자가 된다", () => {
    const out = trackLeavers([a, b], [b], [], 1000);
    expect(out).toEqual([{ student: a, since: 1000 }]);
  });

  it("바뀐 게 없으면 같은 항목을 그대로 돌려준다 (불필요한 상태 갱신 방지)", () => {
    const first = trackLeavers([a, b], [b], [], 1000);
    const again = trackLeavers([b], [b], first, 1100);
    expect(again[0]).toBe(first[0]);
    expect(trackLeavers([a], [a], [], 0)).toEqual([]);
  });

  it("시간이 다 된 퇴장자는 사라진다", () => {
    const first = trackLeavers([a], [], [], 0);
    expect(trackLeavers([], [], first, DISSOLVE_MS - 1)).toHaveLength(1);
    expect(trackLeavers([], [], first, DISSOLVE_MS)).toHaveLength(0);
  });

  it("퇴장 중에 같은 학생이 다시 들어오면 연출을 접는다", () => {
    const first = trackLeavers([a], [], [], 0);
    expect(trackLeavers([], [a], first, 300)).toEqual([]);
  });

  it("같은 학생을 두 번 퇴장자로 올리지 않는다", () => {
    const first = trackLeavers([a], [], [], 0);
    const out = trackLeavers([a], [], first, 200);
    expect(out).toHaveLength(1);
    expect(out[0].since).toBe(0);
  });

  it("여러 명이 한꺼번에 나가도 모두 추적한다", () => {
    const out = trackLeavers([a, b], [], [], 50);
    expect(out.map((l) => l.student.id)).toEqual(["a", "b"]);
  });
});
