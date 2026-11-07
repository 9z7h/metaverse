import { describe, expect, it } from "vitest";
import {
  BAMBOO,
  BAMBOO_GROVE,
  DOOR_REACH,
  FLIGHT,
  GARDEN_HALF,
  GARDEN_OBSTACLES,
  GARDEN_SPAWN,
  LIBRARY_BUILDING,
  LIBRARY_DOOR,
  PAVILION,
  PINES,
  PLUM_TREES,
  POND,
  POND_PATH,
  STONE_LANTERNS,
  STONE_PATH,
  WALK_RADIUS,
  distToPolyline,
  isGrounded,
  nearLibraryDoor,
  resolveWalk,
  stepFlight,
  tapIntent,
  wrapAngle,
} from "./gardenLayout";
import type { FlightState } from "./gardenLayout";

const at = (over: Partial<FlightState> = {}): FlightState => ({
  x: 0,
  z: 0,
  y: FLIGHT.hoverY,
  heading: 0,
  speed: 0,
  ...over,
});

/** 한 번에 여러 걸음 진행 (60fps) */
const run = (
  s: FlightState,
  seconds: number,
  intent: Parameters<typeof stepFlight>[2],
  landing = false,
) => {
  let cur = s;
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    cur = stepFlight(cur, 1 / 60, intent, landing);
  }
  return cur;
};

describe("뜰 배치", () => {
  it("서고에서 나온 자리와 문 앞은 걸어서 닿을 수 있고 서로 가깝다", () => {
    expect(resolveWalk(GARDEN_SPAWN)).toEqual(GARDEN_SPAWN);
    expect(resolveWalk(LIBRARY_DOOR)).toEqual(LIBRARY_DOOR);
    expect(
      Math.hypot(
        GARDEN_SPAWN.x - LIBRARY_DOOR.x,
        GARDEN_SPAWN.z - LIBRARY_DOOR.z,
      ),
    ).toBeLessThan(DOOR_REACH + 1);
  });

  it("처음 서 있는 자리에서 서고 문 가까이로 판정된다 (돌아가기 버튼)", () => {
    expect(nearLibraryDoor(LIBRARY_DOOR)).toBe(true);
    expect(nearLibraryDoor({ x: 0, z: 0 })).toBe(false);
  });

  it("소나무는 충분히 있고, 모두 뜰 안에서 연못·정자·길·서고 앞·시작 자리를 피한다", () => {
    expect(PINES.length).toBeGreaterThanOrEqual(20);
    for (const t of PINES) {
      expect(Math.abs(t.x)).toBeLessThan(GARDEN_HALF);
      expect(Math.abs(t.z)).toBeLessThan(GARDEN_HALF);
      expect(Math.hypot(t.x - POND.x, t.z - POND.z)).toBeGreaterThan(
        POND.r + 2,
      );
      expect(Math.hypot(t.x - PAVILION.x, t.z - PAVILION.z)).toBeGreaterThan(6);
      expect(distToPolyline(t, STONE_PATH)).toBeGreaterThan(3);
      expect(distToPolyline(t, POND_PATH)).toBeGreaterThan(3);
      expect(
        Math.hypot(t.x - GARDEN_SPAWN.x, t.z - GARDEN_SPAWN.z),
      ).toBeGreaterThan(5);
    }
  });

  it("소나무끼리는 서로 겹치지 않는다", () => {
    for (let i = 0; i < PINES.length; i++)
      for (let j = i + 1; j < PINES.length; j++) {
        expect(
          Math.hypot(PINES[i].x - PINES[j].x, PINES[i].z - PINES[j].z),
        ).toBeGreaterThan(4);
      }
  });

  it("같은 배치가 매번 나온다 (결정적)", async () => {
    const again = await import("./gardenLayout");
    expect(again.PINES).toEqual(PINES);
    expect(again.BAMBOO).toEqual(BAMBOO);
  });

  it("대나무는 모두 숲 구역 안에 있다", () => {
    expect(BAMBOO.length).toBeGreaterThan(50);
    for (const b of BAMBOO) {
      expect(b.x).toBeGreaterThanOrEqual(BAMBOO_GROVE.minX);
      expect(b.x).toBeLessThanOrEqual(BAMBOO_GROVE.maxX);
      expect(b.z).toBeGreaterThanOrEqual(BAMBOO_GROVE.minZ);
      expect(b.z).toBeLessThanOrEqual(BAMBOO_GROVE.maxZ);
      expect(b.h).toBeGreaterThan(5);
    }
  });

  it("석등·매화·정자는 뜰 안에 있고 연못 물 위에 놓이지 않는다", () => {
    const all = [...STONE_LANTERNS, ...PLUM_TREES, PAVILION];
    for (const p of all) {
      expect(Math.abs(p.x)).toBeLessThan(GARDEN_HALF);
      expect(Math.abs(p.z)).toBeLessThan(GARDEN_HALF);
      expect(Math.hypot(p.x - POND.x, p.z - POND.z)).toBeGreaterThan(POND.r);
    }
  });

  it("징검길은 서고 문 앞에서 시작해 정자 쪽으로 이어진다", () => {
    const first = STONE_PATH[0];
    const last = STONE_PATH[STONE_PATH.length - 1];
    expect(
      Math.hypot(first.x - LIBRARY_DOOR.x, first.z - LIBRARY_DOOR.z),
    ).toBeLessThan(2);
    expect(Math.hypot(last.x - PAVILION.x, last.z - PAVILION.z)).toBeLessThan(
      PAVILION.half + 2,
    );
  });
});

describe("resolveWalk — 걷기 충돌", () => {
  it("꽃담 밖으로 나가지 못한다", () => {
    const out = resolveWalk({ x: 999, z: 999 });
    expect(Math.abs(out.x)).toBeLessThan(GARDEN_HALF);
    expect(Math.abs(out.z)).toBeLessThan(GARDEN_HALF);
  });

  it("연못 물 속으로 걸어 들어갈 수 없다 (한가운데여도 밀려난다)", () => {
    const out = resolveWalk({ x: POND.x, z: POND.z });
    expect(Math.hypot(out.x - POND.x, out.z - POND.z)).toBeGreaterThanOrEqual(
      POND.r + WALK_RADIUS - 1e-9,
    );
    expect(Number.isFinite(out.x + out.z)).toBe(true);
  });

  it("서고 건물 속으로 들어갈 수 없다", () => {
    const out = resolveWalk({ x: 0, z: LIBRARY_BUILDING.z });
    expect(out.z).toBeGreaterThanOrEqual(LIBRARY_BUILDING.frontZ);
  });

  it("서고 건물 옆(건물 폭 밖)은 걸어갈 수 있다", () => {
    const p = { x: LIBRARY_BUILDING.halfW + 3, z: LIBRARY_BUILDING.z };
    expect(resolveWalk(p)).toEqual(p);
  });

  it("모든 장애물 가장자리에서 한 발 밖은 막히지 않는다 (다른 장애물과 겹치는 자리는 제외)", () => {
    for (const o of GARDEN_OBSTACLES) {
      const p = { x: o.x, z: o.z + o.r + WALK_RADIUS + 0.05 };
      const overlapped = GARDEN_OBSTACLES.some(
        (q) =>
          q !== o &&
          Math.hypot(p.x - q.x, p.z - q.z) < q.r + WALK_RADIUS + 0.01,
      );
      if (overlapped || Math.abs(p.z) > GARDEN_HALF - 1) continue;
      const out = resolveWalk(p);
      // 다른 장애물이나 경계에 밀릴 수는 있지만 장애물 중심 안으로 들어가지는 않는다
      expect(Math.hypot(out.x - o.x, out.z - o.z)).toBeGreaterThanOrEqual(
        o.r + WALK_RADIUS - 1e-6,
      );
    }
  });

  it("정자 한가운데는 걸어서 들어갈 수 있다 (기둥만 장애물)", () => {
    const p = { x: PAVILION.x, z: PAVILION.z };
    expect(resolveWalk(p)).toEqual(p);
  });
});

describe("tapIntent — 탭한 곳으로", () => {
  it("멀면 그 방향으로, 가까워질수록 느리게 (하지만 멈춰 서지는 않게 최소 속도)", () => {
    const far = tapIntent({ x: 0, z: 0 }, { x: 0, z: 30 });
    expect(far.arrived).toBe(false);
    expect(far.intent.dir).toEqual({ x: 0, z: 1 });
    expect(far.intent.speedFrac).toBe(1);
    const near = tapIntent({ x: 0, z: 0 }, { x: 0, z: 2 });
    expect(near.intent.speedFrac).toBeLessThan(1);
    expect(near.intent.speedFrac).toBeGreaterThanOrEqual(0.25);
  });

  it("도착 거리 안이면 도착으로 알리고 가만히 있는다", () => {
    const r = tapIntent({ x: 0, z: 0 }, { x: 0, z: FLIGHT.arrive - 0.1 });
    expect(r.arrived).toBe(true);
    expect(r.intent.dir).toBeNull();
  });
});

describe("stepFlight — 빗자루 비행", () => {
  it("가만히 있으면 제자리에서 떠 있는다 (hoverY)", () => {
    const s = run(at({ y: 0 }), 4, { dir: null, speedFrac: 0 });
    expect(s.speed).toBe(0);
    expect(s.x).toBe(0);
    expect(s.z).toBe(0);
    expect(s.y).toBeCloseTo(FLIGHT.hoverY, 1);
  });

  it("가려는 방향으로 서서히 가속하고 순항 속도를 넘지 않는다", () => {
    const intent = { dir: { x: 0, z: 1 }, speedFrac: 1 };
    const early = run(at(), 0.3, intent);
    expect(early.speed).toBeGreaterThan(0);
    expect(early.speed).toBeLessThan(FLIGHT.cruiseSpeed);
    const later = run(at(), 4, intent);
    expect(later.speed).toBeLessThanOrEqual(FLIGHT.cruiseSpeed + 1e-9);
    expect(later.z).toBeGreaterThan(5);
  });

  it("움직이는 동안은 순항 높이로 오르고, 멈추면 다시 내려와 떠 있는다", () => {
    const flying = run(at(), 4, { dir: { x: 0, z: 1 }, speedFrac: 1 });
    expect(flying.y).toBeGreaterThan(FLIGHT.hoverY + 1);
    const stopped = run(flying, 6, { dir: null, speedFrac: 0 });
    expect(stopped.speed).toBeCloseTo(0, 1);
    expect(stopped.y).toBeCloseTo(FLIGHT.hoverY, 1);
  });

  it("방향은 한 번에 휙 돌지 않고 천천히 휘어 돈다", () => {
    const s = stepFlight(at({ heading: 0, speed: 3 }), 1 / 60, {
      dir: { x: 1, z: 0 }, // 90° 오른쪽
      speedFrac: 1,
    });
    expect(Math.abs(s.heading)).toBeLessThan(0.1);
    const later = run(at({ heading: 0, speed: 3 }), 2, {
      dir: { x: 1, z: 0 },
      speedFrac: 1,
    });
    expect(later.heading).toBeCloseTo(Math.PI / 2, 1);
  });

  it("가까운 쪽으로 돈다 (반대편 목표에서도 한 바퀴를 돌지 않음)", () => {
    // heading 170° → 목표 -170° (실제로는 20° 차이)
    const s = stepFlight(
      at({ heading: (170 * Math.PI) / 180, speed: 2 }),
      0.1,
      {
        dir: {
          x: Math.sin((-170 * Math.PI) / 180),
          z: Math.cos((-170 * Math.PI) / 180),
        },
        speedFrac: 1,
      },
    );
    // 같은 부호 방향(170° 쪽으로 더 커짐 → 180° 넘어 -170°로 감기)으로 돌았다
    expect(Math.abs(wrapAngle(s.heading - (170 * Math.PI) / 180))).toBeLessThan(
      0.3,
    );
  });

  it("꽃담 안쪽 경계를 넘지 않는다", () => {
    const s = run(at({ x: GARDEN_HALF - 3, z: 0, heading: Math.PI / 2 }), 6, {
      dir: { x: 1, z: 0 },
      speedFrac: 1,
    });
    expect(Math.abs(s.x)).toBeLessThanOrEqual(GARDEN_HALF - FLIGHT.edge + 1e-9);
  });

  it("내려앉기(landing)는 속도를 줄이며 땅까지 내려와 멈춘다", () => {
    const flying = run(at(), 3, { dir: { x: 0, z: 1 }, speedFrac: 1 });
    const landed = run(flying, 8, { dir: { x: 0, z: 1 }, speedFrac: 1 }, true);
    expect(landed.y).toBe(0);
    expect(isGrounded(landed)).toBe(true);
  });

  it("떠 있으면 땅에 내려온 것이 아니다", () => {
    expect(isGrounded(at())).toBe(false);
    expect(isGrounded(at({ y: 0, speed: 0 }))).toBe(true);
    expect(isGrounded(at({ y: 0, speed: 3 }))).toBe(false);
  });

  it("어떤 입력에도 값이 유한하다 (큰 dt, 0 속도 등)", () => {
    for (const dt of [0, 1 / 120, 0.1, 1]) {
      const s = stepFlight(at(), dt, { dir: { x: 1, z: 0 }, speedFrac: 2 });
      for (const v of [s.x, s.y, s.z, s.heading, s.speed])
        expect(Number.isFinite(v)).toBe(true);
    }
  });
});

describe("wrapAngle", () => {
  it("[-π, π)로 감는다 (±π는 같은 방향)", () => {
    expect(wrapAngle(0)).toBeCloseTo(0);
    expect(Math.abs(wrapAngle(Math.PI * 3))).toBeCloseTo(Math.PI);
    expect(Math.abs(wrapAngle(-Math.PI * 3))).toBeCloseTo(Math.PI);
    expect(wrapAngle(Math.PI * 2 + 0.5)).toBeCloseTo(0.5);
    for (const a of [-20, -3.2, 0.1, 3.2, 9, 40]) {
      const w = wrapAngle(a);
      expect(w).toBeGreaterThanOrEqual(-Math.PI);
      expect(w).toBeLessThan(Math.PI);
      expect(Math.cos(w)).toBeCloseTo(Math.cos(a));
      expect(Math.sin(w)).toBeCloseTo(Math.sin(a));
    }
  });
});
