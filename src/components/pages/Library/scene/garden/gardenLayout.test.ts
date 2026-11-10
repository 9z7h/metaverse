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
  SCHOOL_BUILDINGS,
  BUILDING_REACH,
  BUILDING_PLATFORMS,
  STAIR_DEPTH,
  gardenWalkHeight,
  STONE_LANTERNS,
  STONE_PATH,
  WALK_RADIUS,
  distToPolyline,
  isGrounded,
  nearLibraryDoor,
  nearSchoolBuilding,
  preparingText,
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
  it("서고 앞 계단을 따라가면 바닥에서 기단까지 높이가 단계적으로 올라간다", () => {
    const p = BUILDING_PLATFORMS[0];
    const front = p.z + p.halfD;
    const heights = [3.2, 2.5, 1.5, 0.5, -0.1].map((step) =>
      gardenWalkHeight({ x: p.x, z: front + step * STAIR_DEPTH }),
    );
    [0, 0.15, 0.3, 0.45, 0.6].forEach((h, i) =>
      expect(heights[i]).toBeCloseTo(h),
    );
  });

  it("정자 앞 계단을 따라가면 기단 높이까지 자연스럽게 올라간다", () => {
    const p = BUILDING_PLATFORMS.find((platform) => platform.x === PAVILION.x)!;
    const front = p.z + p.halfD;
    const heights = [1.7, 1, 0.5, 0.1, -0.1].map((step) =>
      gardenWalkHeight({ x: PAVILION.x, z: front + step }),
    );
    [0.12, 0.24, 0.36, 0.36, 0.48].forEach((height, i) =>
      expect(heights[i]).toBeCloseTo(height),
    );
  });

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

  it("현무관 계단과 접근로에는 대나무와 보행 장애물이 없다", () => {
    const dorm = SCHOOL_BUILDINGS.find((b) => b.id === "hyeonmu")!;
    const front = dorm.z + dorm.halfD + 1.6;
    for (const bamboo of BAMBOO) {
      const inStairs = Math.abs(bamboo.x - dorm.x) <= 2.4 &&
        bamboo.z >= front - 1 && bamboo.z <= front + 3 * STAIR_DEPTH + 1.3;
      expect(inStairs).toBe(false);
    }
    for (const z of [front, front + STAIR_DEPTH, front + 2 * STAIR_DEPTH]) {
      const resolved = resolveWalk({ x: dorm.x, z });
      expect(resolved.x).toBeCloseTo(dorm.x);
      expect(resolved.z).toBeCloseTo(z);
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

describe("stepFlight — 구름 비행", () => {
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

  it("부스트(쉬프트)면 순항 속도의 boostMultiplier배까지 빨라진다", () => {
    const dir = { x: 0, z: 1 };
    // 2초 — 꽃담 경계(속도 감쇠)에 닿기 전까지만 비교한다
    const normal = run(at(), 2, { dir, speedFrac: 1 });
    const boosted = run(at(), 2, { dir, speedFrac: 1, boost: true });
    expect(boosted.speed).toBeGreaterThan(FLIGHT.cruiseSpeed);
    expect(boosted.speed).toBeLessThanOrEqual(
      FLIGHT.cruiseSpeed * FLIGHT.boostMultiplier + 1e-9,
    );
    expect(boosted.z).toBeGreaterThan(normal.z);
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

describe("학교 건물 (입장 불가)", () => {
  const rectGap = (
    a: { x: number; z: number; halfW: number; halfD: number },
    b: { x: number; z: number; halfW: number; halfD: number },
  ) =>
    Math.hypot(
      Math.max(Math.abs(a.x - b.x) - a.halfW - b.halfW, 0),
      Math.max(Math.abs(a.z - b.z) - a.halfD - b.halfD, 0),
    );

  it("설정집 공간 7곳이 이름과 함께 있다 (사방재는 기숙사 네 채)", () => {
    expect(SCHOOL_BUILDINGS.map((b) => b.name).sort()).toEqual(
      [
        "가운데마루",
        "물소리공방",
        "백호관",
        "별읽는 누각",
        "주작관",
        "청룡관",
        "현무관",
      ].sort(),
    );
    expect(new Set(SCHOOL_BUILDINGS.map((b) => b.id)).size).toBe(
      SCHOOL_BUILDINGS.length,
    );
    expect(SCHOOL_BUILDINGS.filter((b) => b.house)).toHaveLength(4);
  });

  it("건물 모양(kind): 문루·탑은 하나씩, 기숙사 네 채, 공방 하나", () => {
    const count = (k: string) =>
      SCHOOL_BUILDINGS.filter((b) => b.kind === k).length;
    expect(count("gate")).toBe(1);
    expect(count("tower")).toBe(1);
    expect(count("dorm")).toBe(4);
    expect(count("workshop")).toBe(1);
    // 기숙사 모양이면 기숙사 색이 있다
    for (const b of SCHOOL_BUILDINGS)
      expect(Boolean(b.house)).toBe(b.kind === "dorm");
  });

  it("꽃담 안에 있고 서로·서고·정자·연못·대나무 숲·시작 위치와 겹치지 않는다", () => {
    for (const b of SCHOOL_BUILDINGS) {
      expect(Math.abs(b.x) + b.halfW + 2).toBeLessThan(GARDEN_HALF);
      expect(Math.abs(b.z) + b.halfD + 2).toBeLessThan(GARDEN_HALF);
      for (const o of SCHOOL_BUILDINGS)
        if (o !== b) expect(rectGap(b, o)).toBeGreaterThan(3);
      expect(
        rectGap(b, {
          x: LIBRARY_BUILDING.x,
          z: LIBRARY_BUILDING.z,
          halfW: LIBRARY_BUILDING.halfW + 2.4,
          halfD: LIBRARY_BUILDING.halfD + 2.6,
        }),
      ).toBeGreaterThan(2);
      expect(
        rectGap(b, { ...PAVILION, halfW: 3.2, halfD: 3.2 }),
      ).toBeGreaterThan(3);
      // 연못은 원 → 가장 가까운 점까지의 거리
      const dx = Math.max(Math.abs(POND.x - b.x) - b.halfW, 0);
      const dz = Math.max(Math.abs(POND.z - b.z) - b.halfD, 0);
      expect(Math.hypot(dx, dz)).toBeGreaterThan(POND.r + 1);
      expect(
        rectGap(b, {
          x: (BAMBOO_GROVE.minX + BAMBOO_GROVE.maxX) / 2,
          z: (BAMBOO_GROVE.minZ + BAMBOO_GROVE.maxZ) / 2,
          halfW: (BAMBOO_GROVE.maxX - BAMBOO_GROVE.minX) / 2,
          halfD: (BAMBOO_GROVE.maxZ - BAMBOO_GROVE.minZ) / 2,
        }),
      ).toBeGreaterThan(2);
      expect(
        rectGap(b, { ...GARDEN_SPAWN, halfW: 0, halfD: 0 }),
      ).toBeGreaterThan(6);
      expect(distToPolyline({ x: b.x, z: b.z }, STONE_PATH)).toBeGreaterThan(
        Math.max(b.halfW, b.halfD) + 1,
      );
    }
  });

  it("소나무·매화·석등이 건물 위에 서지 않는다", () => {
    for (const b of SCHOOL_BUILDINGS)
      for (const p of [...PINES, ...PLUM_TREES, ...STONE_LANTERNS])
        expect(rectGap(b, { ...p, halfW: 0, halfD: 0 })).toBeGreaterThan(1);
  });

  it("걸어서는 건물 안으로 들어갈 수 없다 (밀려난다)", () => {
    for (const b of SCHOOL_BUILDINGS) {
      const out = resolveWalk({ x: b.x, z: b.z });
      expect(
        Math.abs(out.x - b.x) >= b.halfW || Math.abs(out.z - b.z) >= b.halfD,
      ).toBe(true);
    }
  });

  it("가까이 가면 그 건물이, 멀면 null이 나온다", () => {
    for (const b of SCHOOL_BUILDINGS) {
      const front = { x: b.x, z: b.z + b.halfD + BUILDING_REACH - 0.5 };
      expect(nearSchoolBuilding(front)?.id).toBe(b.id);
    }
    expect(nearSchoolBuilding(GARDEN_SPAWN)).toBeNull();
  });

  it("안내 문구는 이름 끝 받침에 맞춰 은/는을 고른다", () => {
    expect(preparingText("가운데마루")).toBe("가운데마루는 아직 준비 중이에요");
    expect(preparingText("백호관")).toBe("백호관은 아직 준비 중이에요");
    expect(preparingText("별읽는 누각")).toBe(
      "별읽는 누각은 아직 준비 중이에요",
    );
  });
});
