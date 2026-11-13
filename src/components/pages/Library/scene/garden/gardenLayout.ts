/**
 * 숨돌림 뜰(학교 후원) 배치·충돌·비행 — three.js에 의존하지 않는 순수 로직 (단위 테스트 대상).
 * 좌표계: x = 좌우, z = 앞뒤(+z가 남쪽), y = 높이, 단위 = m.
 *
 * 서고(북쪽 끝, 문이 남쪽을 향함)에서 나온 학생이 달밤의 후원을 거닐고,
 * 전통 구름을 타고 잠깐 하늘을 날며 머리를 식힌다.
 */
import type { DoorFrame, Vec2 } from "../sceneLayout";
import type { HouseId } from "../../houses";
import { seeded } from "../random";

/** 뜰 안쪽 경계 — x·z 모두 ±GARDEN_HALF (바깥은 꽃담) */
export const GARDEN_HALF = 34;
export const WALK_RADIUS = 0.35;

/** 서고에서 나왔을 때 서는 곳 — 서고 문 앞 */
export const GARDEN_SPAWN: Vec2 = { x: 0, z: -23.5 };

/** 서고 건물(북쪽). 몸체 앞면이 z = LIBRARY_BUILDING.frontZ */
export const LIBRARY_BUILDING = {
  x: 0,
  z: -32,
  halfW: 9.5,
  halfD: 4,
  frontZ: -28,
} as const;
/** 서고 문 앞 — 문을 눌러 이 앞까지 걸어가면 서고로 들어간다 */
export const LIBRARY_DOOR: Vec2 = { x: 0, z: -26.4 };
/** 뜰에서 보이는 서고 대문 (문틀 포함 여유) — 기단 높이 0.6 위에 서 있다 */
export const LIBRARY_DOOR_FRAME: DoorFrame = {
  x: LIBRARY_BUILDING.x,
  z: LIBRARY_BUILDING.frontZ + 0.12,
  baseY: 0.6,
  width: 2.7,
  height: 3.2,
};
export const DOOR_REACH = 3.4;
/** 서고 대문 앞 기단 가장자리를 오가며 문을 지키는 해태의 순찰길 — x ± halfRange, 기단 윗면 높이 y */
export const HAETAE_PATROL = { z: -25.8, halfRange: 4.4, y: 0.6 } as const;

export const POND = { x: 11, z: 3, r: 8 } as const;
export const PAVILION = { x: -12, z: 6, half: 3.2 } as const;

/** 서고 문에서 정자·연못으로 이어지는 징검길 (꺾은선) */
export const STONE_PATH: ReadonlyArray<Vec2> = [
  { x: 0, z: -26.5 },
  { x: 0, z: -16 },
  { x: -5, z: -6 },
  { x: -9, z: 2 },
  { x: -11.5, z: 5.5 },
];
/** 연못 가장자리로 갈라지는 길 */
export const POND_PATH: ReadonlyArray<Vec2> = [
  { x: -5, z: -6 },
  { x: 0, z: -3 },
  { x: 2.6, z: 1 },
];

/** 석등 (길가) */
export const STONE_LANTERNS: ReadonlyArray<Vec2> = [
  { x: 2.6, z: -23 },
  { x: -2.6, z: -23 },
  { x: 2.4, z: -13 },
  { x: -7.4, z: -9 },
  { x: -10.8, z: -2.5 },
  { x: 2, z: -6 },
  { x: -15.5, z: 4 },
  { x: -8, z: 10.6 },
];

/** 매화나무 (정자 곁) */
export const PLUM_TREES: ReadonlyArray<Vec2> = [
  { x: -19, z: 3 },
  { x: -19, z: 11 },
  { x: -10, z: 14.5 },
  { x: -15, z: 15 },
  { x: -21, z: 7 },
];

/** 대나무 숲 (동쪽) — 걸어서는 들어갈 수 없고 하늘에서 내려다본다 */
export const BAMBOO_GROVE = {
  minX: 20,
  maxX: 31,
  minZ: -22,
  maxZ: -2,
} as const;

/* ── 학교 건물 (입장 불가) ───────────────────────────────────
 * 설정집의 공간 중 마당에 보이는 건물들. 모두 남쪽을 향하고, 아직 들어갈 수 없어
 * 가까이 가면 "준비 중이에요"가 나타난다. 사방재는 네 기숙사 건물로 나눠 세운다. */

export interface SchoolBuilding {
  id: string;
  /** 화면에 보이는 이름 (docs/world.md 용어) */
  name: string;
  x: number;
  z: number;
  halfW: number;
  halfD: number;
  /** 건물 모양 — 문루(gate)·탑(tower)·기숙사(dorm)·공방(workshop) */
  kind: "gate" | "tower" | "dorm" | "workshop";
  /** 기숙사 건물이면 그 기숙사 — 지붕 아래 띠와 깃발 색 */
  house?: HouseId;
}

export const SCHOOL_BUILDINGS: ReadonlyArray<SchoolBuilding> = [
  {
    id: "maru",
    name: "가운데마루",
    x: 4,
    z: 25,
    halfW: 6.5,
    halfD: 3.5,
    kind: "gate",
  },
  {
    id: "baekho",
    name: "백호관",
    x: -27,
    z: -10,
    halfW: 4,
    halfD: 3,
    kind: "dorm",
    house: "baekho",
  },
  {
    id: "jujak",
    name: "주작관",
    x: -22,
    z: 24,
    halfW: 4,
    halfD: 3,
    kind: "dorm",
    house: "jujak",
  },
  {
    id: "hyeonmu",
    name: "현무관",
    x: 22,
    z: -28,
    halfW: 4,
    halfD: 3,
    kind: "dorm",
    house: "hyeonmu",
  },
  {
    id: "cheongryong",
    name: "청룡관",
    x: 27,
    z: 12,
    halfW: 4,
    halfD: 3,
    kind: "dorm",
    house: "cheongryong",
  },
  {
    id: "workshop",
    name: "물소리공방",
    x: 14,
    z: 15.5,
    halfW: 3.5,
    halfD: 2.5,
    kind: "workshop",
  },
  {
    id: "tower",
    name: "별읽는 누각",
    x: -29,
    z: 5,
    halfW: 2.5,
    halfD: 2.5,
    kind: "tower",
  },
];
/** 기단과 계단의 크기를 풍경과 보행 높이 계산에서 함께 사용한다. */
export const BUILDING_PLATFORMS = [
  {
    x: LIBRARY_BUILDING.x,
    z: LIBRARY_BUILDING.z + 1,
    halfW: LIBRARY_BUILDING.halfW + 1.5,
    halfD: LIBRARY_BUILDING.halfD + 2,
    height: 0.6,
  },
  // 정자 기단의 윗면과 앞 계단의 보행 높이를 맞춘다.
  {
    x: PAVILION.x,
    z: PAVILION.z,
    halfW: PAVILION.half,
    halfD: PAVILION.half,
    height: 0.48,
  },
  ...SCHOOL_BUILDINGS.filter((b) => b.kind !== "gate").map((b) => ({
    x: b.x,
    z: b.z + (b.kind === "tower" ? 0.2 : b.kind === "workshop" ? 0.3 : 0.4),
    halfW:
      b.halfW + (b.kind === "tower" ? 1 : b.kind === "workshop" ? 0.8 : 1.2),
    halfD:
      b.halfD + (b.kind === "tower" ? 1 : b.kind === "workshop" ? 0.8 : 1.2),
    height: b.kind === "tower" ? 1.2 : b.kind === "workshop" ? 0.5 : 0.4,
  })),
] as const;

export const STAIR_DEPTH = 0.65;
export const STAIR_WIDTH = 3;
export const STAIR_COUNT = 3;

/** 건물 기단과 앞 계단의 실제 윗면 높이. */
export function gardenWalkHeight(pos: Vec2): number {
  let height = 0;
  for (const p of BUILDING_PLATFORMS) {
    const dx = Math.abs(pos.x - p.x);
    const dz = pos.z - (p.z + p.halfD);
    if (dx <= p.halfW && pos.z >= p.z - p.halfD && dz <= 0) {
      height = Math.max(height, p.height);
    }
    if (dx <= STAIR_WIDTH / 2 && dz > 0 && dz <= STAIR_COUNT * STAIR_DEPTH) {
      const step = Math.min(STAIR_COUNT - 1, Math.floor(dz / STAIR_DEPTH));
      height = Math.max(
        height,
        (p.height * (STAIR_COUNT - step)) / (STAIR_COUNT + 1),
      );
    }
  }
  for (const b of SCHOOL_BUILDINGS) {
    if (b.kind !== "dorm") continue;
    if (
      Math.abs(pos.x - b.x) <= STAIR_WIDTH / 2 &&
      pos.z >= b.z + b.halfD + 0.8 &&
      pos.z <= b.z + b.halfD + 1.6
    )
      height = Math.max(height, 0.7);
    if (
      Math.abs(pos.x - b.x) <= b.halfW + 0.6 &&
      Math.abs(pos.z - (b.z + 0.2)) <= b.halfD + 0.6
    )
      height = Math.max(height, 1);
  }
  return height;
}
/** 건물 가장자리에서 이 거리 안에 서면 안내가 나타난다 */
export const BUILDING_REACH = 3;

/** 가까이 갔을 때 보여 줄 안내 — 이름 끝 받침에 맞춰 은/는을 고른다 */
export function preparingText(name: string): string {
  const code = name.charCodeAt(name.length - 1) - 0xac00;
  const hasFinal = code >= 0 && code <= 11171 && code % 28 !== 0;
  return `${name}${hasFinal ? "은" : "는"} 아직 준비 중이에요`;
}

/** 점에서 사각형 가장자리까지의 거리 (안쪽이면 0) */
function distToRect(p: Vec2, b: SchoolBuilding): number {
  const dx = Math.max(Math.abs(p.x - b.x) - b.halfW, 0);
  const dz = Math.max(Math.abs(p.z - b.z) - b.halfD, 0);
  return Math.hypot(dx, dz);
}

/** 가까이 있는 학교 건물 (가장 가까운 하나), 없으면 null */
export function nearSchoolBuilding(pos: Vec2): SchoolBuilding | null {
  let best: SchoolBuilding | null = null;
  let bestD = BUILDING_REACH;
  for (const b of SCHOOL_BUILDINGS) {
    const d = distToRect(pos, b);
    if (d <= bestD) {
      best = b;
      bestD = d;
    }
  }
  return best;
}

function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len2 = dx * dx + dz * dz;
  const t =
    len2 === 0
      ? 0
      : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.z - (a.z + t * dz));
}

/** 점에서 꺾은선까지의 가장 짧은 거리 */
export function distToPolyline(p: Vec2, line: ReadonlyArray<Vec2>): number {
  let best = Infinity;
  for (let i = 0; i + 1 < line.length; i++) {
    best = Math.min(best, distToSegment(p, line[i], line[i + 1]));
  }
  return best;
}

export interface Tree {
  x: number;
  z: number;
  /** 크기 배율 */
  s: number;
}

/** 소나무: 연못·정자·길·서고·대나무 숲·시작 위치를 피해 흩어 놓는다 */
export const PINES: ReadonlyArray<Tree> = (() => {
  const rand = seeded(2024);
  const out: Tree[] = [];
  for (let attempt = 0; attempt < 4000 && out.length < 26; attempt++) {
    const p = {
      x: (rand() * 2 - 1) * (GARDEN_HALF - 3),
      z: (rand() * 2 - 1) * (GARDEN_HALF - 3),
    };
    const s = 0.9 + rand() * 0.7;
    if (Math.hypot(p.x - POND.x, p.z - POND.z) < POND.r + 3) continue;
    if (Math.hypot(p.x - PAVILION.x, p.z - PAVILION.z) < 7) continue;
    if (Math.abs(p.x) < 15 && p.z < -19) continue; // 서고 앞마당
    if (SCHOOL_BUILDINGS.some((b) => distToRect(p, b) < 4)) continue;
    if (Math.hypot(p.x - GARDEN_SPAWN.x, p.z - GARDEN_SPAWN.z) < 6) continue;
    if (distToPolyline(p, STONE_PATH) < 3.2) continue;
    if (distToPolyline(p, POND_PATH) < 3.2) continue;
    if (
      p.x > BAMBOO_GROVE.minX - 3 &&
      p.x < BAMBOO_GROVE.maxX + 3 &&
      p.z > BAMBOO_GROVE.minZ - 3 &&
      p.z < BAMBOO_GROVE.maxZ + 3
    )
      continue;
    if (PLUM_TREES.some((q) => Math.hypot(p.x - q.x, p.z - q.z) < 4)) continue;
    if (out.some((q) => Math.hypot(p.x - q.x, p.z - q.z) < 5)) continue;
    out.push({ ...p, s });
  }
  return out;
})();

export interface Bamboo {
  x: number;
  z: number;
  /** 키(m) */
  h: number;
}

/** 기숙사 계단과 그 앞 접근로는 대나무와 숲 장애물에서 비운다. */
function overlapsDormStairs(x: number, z: number, radius = 0): boolean {
  return SCHOOL_BUILDINGS.some((b) => {
    if (b.kind !== "dorm") return false;
    const front = b.z + b.halfD + 1.6;
    return (
      Math.abs(x - b.x) <= STAIR_WIDTH / 2 + 0.6 + radius &&
      z >= front - 0.7 - radius &&
      z <= front + STAIR_COUNT * STAIR_DEPTH + 1 + radius
    );
  });
}

/** 대나무: 숲 안에 흩뿌리되 기숙사 계단은 비운다. */
export const BAMBOO: ReadonlyArray<Bamboo> = (() => {
  const rand = seeded(77);
  const bamboo: Bamboo[] = [];
  while (bamboo.length < 72) {
    const item = {
      x: BAMBOO_GROVE.minX + rand() * (BAMBOO_GROVE.maxX - BAMBOO_GROVE.minX),
      z: BAMBOO_GROVE.minZ + rand() * (BAMBOO_GROVE.maxZ - BAMBOO_GROVE.minZ),
      h: 6.5 + rand() * 3.5,
    };
    if (!overlapsDormStairs(item.x, item.z, 0.3)) bamboo.push(item);
  }
  return bamboo;
})();

export interface Circle {
  x: number;
  z: number;
  r: number;
}

/** 걸어서 지나갈 수 없는 둥근 장애물 (하늘에서는 상관없다) */
export const GARDEN_OBSTACLES: ReadonlyArray<Circle> = [
  { x: POND.x, z: POND.z, r: POND.r },
  // 정자 기둥 네 개
  ...[-1, 1].flatMap((sx) =>
    [-1, 1].map((sz) => ({
      x: PAVILION.x + sx * (PAVILION.half - 0.6),
      z: PAVILION.z + sz * (PAVILION.half - 0.6),
      r: 0.4,
    })),
  ),
  ...STONE_LANTERNS.map((p) => ({ ...p, r: 0.45 })),
  ...PLUM_TREES.map((p) => ({ ...p, r: 0.6 })),
  ...PINES.map((t) => ({ x: t.x, z: t.z, r: 0.55 * t.s })),
  // 대나무 숲은 굵은 원 몇 개로 막는다
  ...[-20, -15, -10, -5]
    .flatMap((z) => [22, 26, 30].map((x) => ({ x, z, r: 2.6 })))
    .filter(
      (obstacle) => !overlapsDormStairs(obstacle.x, obstacle.z, obstacle.r),
    ),
];

/** 서고 건물 몸체 (사각형) */
const BUILDING_RECT = {
  minX: LIBRARY_BUILDING.x - LIBRARY_BUILDING.halfW,
  maxX: LIBRARY_BUILDING.x + LIBRARY_BUILDING.halfW,
  minZ: -GARDEN_HALF - 2,
  maxZ: LIBRARY_BUILDING.frontZ,
};

/** 걸어서 갈 수 있는 위치로 보정: 꽃담 안쪽 + 장애물·서고 건물 밀어내기 */
export function resolveWalk(pos: Vec2): Vec2 {
  const lim = GARDEN_HALF - 0.6;
  let x = Math.min(lim, Math.max(-lim, pos.x));
  let z = Math.min(lim, Math.max(-lim, pos.z));
  // 겹쳐 놓은 장애물 사이에서도 파고들지 않도록 두 번 밀어낸다
  for (let pass = 0; pass < 2; pass++) {
    // 서고 건물: 덜 파고든 축으로 밀어낸다
    const bx0 = BUILDING_RECT.minX - WALK_RADIUS;
    const bx1 = BUILDING_RECT.maxX + WALK_RADIUS;
    const bz1 = BUILDING_RECT.maxZ + WALK_RADIUS;
    if (x > bx0 && x < bx1 && z < bz1) {
      const toLeft = x - bx0;
      const toRight = bx1 - x;
      const toFront = bz1 - z;
      const m = Math.min(toLeft, toRight, toFront);
      if (m === toFront) z = bz1;
      else if (m === toLeft) x = bx0;
      else x = bx1;
    }
    // 학교 건물: 덜 파고든 축으로 밀어낸다
    for (const b of SCHOOL_BUILDINGS) {
      const hx = b.halfW + WALK_RADIUS;
      const hz = b.halfD + WALK_RADIUS;
      const dx = x - b.x;
      const dz = z - b.z;
      if (Math.abs(dx) < hx && Math.abs(dz) < hz) {
        if (hx - Math.abs(dx) < hz - Math.abs(dz))
          x = b.x + Math.sign(dx || 1) * hx;
        else z = b.z + Math.sign(dz || 1) * hz;
      }
    }
    for (const o of GARDEN_OBSTACLES) {
      const min = o.r + WALK_RADIUS;
      const dx = x - o.x;
      const dz = z - o.z;
      const dist = Math.hypot(dx, dz);
      if (dist < min) {
        // 중심에서 바깥쪽으로 (정확히 중심이면 남쪽으로)
        const nx = dist === 0 ? 0 : dx / dist;
        const nz = dist === 0 ? 1 : dz / dist;
        x = o.x + nx * min;
        z = o.z + nz * min;
      }
    }
  }
  return { x, z };
}

/** 정원 카메라가 머물 수 있는 공간 (꽃담 바깥 조금까지, 높이는 비행 고도 위로) */
export const GARDEN_CAMERA_BOUNDS = {
  minX: -GARDEN_HALF - 2,
  maxX: GARDEN_HALF + 2,
  minZ: -GARDEN_HALF - 2,
  maxZ: GARDEN_HALF + 2,
  maxY: 24,
} as const;

/** 서고 문 가까이에 있는지 */
export function nearLibraryDoor(pos: Vec2): boolean {
  return (
    Math.hypot(pos.x - LIBRARY_DOOR.x, pos.z - LIBRARY_DOOR.z) <= DOOR_REACH
  );
}

/* ── 구름 비행 ───────────────────────────────────────────────
 * 탭한 곳으로 천천히 날아가고, 가만히 있으면 제자리에서 떠 있다.
 * 머리를 식히는 용도라 급가속·급선회 없이 부드럽게 움직인다. */

export const FLIGHT = {
  /** 순항 속도 m/s */
  cruiseSpeed: 6.5,
  accel: 5,
  decel: 6,
  /** 방향을 트는 속도 rad/s — 천천히 휘어 돈다 */
  turnRate: 2.2,
  /** 움직이는 동안 / 가만히 떠 있을 때 높이 */
  cruiseY: 4.2,
  hoverY: 2.4,
  /** 높이를 바꾸는 속도 (클수록 빨리 따라감) */
  climbRate: 1.6,
  /** 목표에 이만큼 가까워지면 도착 */
  arrive: 0.8,
  /** 이 거리 안에서는 속도를 줄이며 다가간다 */
  slowRadius: 6,
  /** 경계에서 안쪽으로 이만큼 여유 */
  edge: 1.5,
} as const;

export interface FlightState {
  x: number;
  z: number;
  y: number;
  /** 날아가는 방향(rad). 정면 벡터는 (sin, cos) */
  heading: number;
  speed: number;
}

export interface FlightIntent {
  /** 가고 싶은 방향(단위 벡터). null이면 제자리 */
  dir: Vec2 | null;
  /** 0~1: 순항 속도의 몇 배로 갈지 */
  speedFrac: number;
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

/** 각도를 [-π, π)로 (±π는 같은 방향) */
export function wrapAngle(a: number): number {
  const TAU = Math.PI * 2;
  return ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
}

/** 탭한 곳으로 가려는 의도 + 도착 여부 */
export function tapIntent(
  pos: Vec2,
  target: Vec2,
): { intent: FlightIntent; arrived: boolean } {
  const dx = target.x - pos.x;
  const dz = target.z - pos.z;
  const dist = Math.hypot(dx, dz);
  if (dist <= FLIGHT.arrive) {
    return { intent: { dir: null, speedFrac: 0 }, arrived: true };
  }
  return {
    intent: {
      dir: { x: dx / dist, z: dz / dist },
      // 가까워지면 속도를 줄이되 멈춰 서지는 않게 최소 속도를 둔다
      speedFrac: clamp(dist / FLIGHT.slowRadius, 0.25, 1),
    },
    arrived: false,
  };
}

/** 지금 땅 위에 내려와 있는지 */
export function isGrounded(s: FlightState): boolean {
  return s.y <= 0.03 && s.speed < 0.05;
}

/** 시간 `dt`초만큼 비행 상태를 진행한다. `landing`이면 천천히 내려앉는다. */
export function stepFlight(
  s: FlightState,
  dt: number,
  intent: FlightIntent,
  landing = false,
): FlightState {
  let { x, z, y, heading, speed } = s;
  const wantsMove = !landing && intent.dir !== null;

  if (wantsMove && intent.dir) {
    const want = Math.atan2(intent.dir.x, intent.dir.z);
    const diff = wrapAngle(want - heading);
    const step = FLIGHT.turnRate * dt;
    heading = wrapAngle(heading + clamp(diff, -step, step));
  }

  const wantSpeed = wantsMove
    ? FLIGHT.cruiseSpeed * clamp(intent.speedFrac, 0, 1)
    : 0;
  speed += clamp(wantSpeed - speed, -FLIGHT.decel * dt, FLIGHT.accel * dt);
  speed = Math.max(0, speed);

  x += Math.sin(heading) * speed * dt;
  z += Math.cos(heading) * speed * dt;

  // 꽃담 안쪽 경계 — 닿으면 속도를 줄인다
  const lim = GARDEN_HALF - FLIGHT.edge;
  if (Math.abs(x) > lim || Math.abs(z) > lim) {
    x = clamp(x, -lim, lim);
    z = clamp(z, -lim, lim);
    speed *= 0.6;
  }

  const targetY = landing ? 0 : speed > 0.8 ? FLIGHT.cruiseY : FLIGHT.hoverY;
  y += (targetY - y) * (1 - Math.exp(-FLIGHT.climbRate * dt));
  if (landing && y < 0.03) y = 0;

  return { x, z, y, heading, speed };
}

/* ── 정원 조명 풀 ─────────────────────────────────────────────
 * 점광원은 켜진 개수만큼 모든 조명 재질의 프래그먼트 셰이더가 무거워지고,
 * 개수가 바뀌면 셰이더가 다시 컴파일된다. 그래서 광원 후보는 많이 두되
 * 실제 점광원은 고정 개수(GARDEN_LIGHT_POOL)만 두고, 카메라에 가까운 후보에 배정한다. */

/** 동시에 켜 두는 점광원 수 — 항상 같은 개수를 유지해 셰이더 재컴파일을 막는다 */
export const GARDEN_LIGHT_POOL = 6;

/** 카메라가 빛이 닿는 거리보다 이만큼 더 멀어도 후보로 본다 (멀리서 보이는 건물 벽을 밝히려고) */
const LIGHT_VIEW_MARGIN = 25;

export interface LightSource {
  x: number;
  y: number;
  z: number;
  intensity: number;
  distance: number;
  decay: number;
}

/** 건물·정자의 고정 광원 후보 (서고 앞, 정문, 탑, 공방, 정자) */
export const STATIC_LIGHTS: ReadonlyArray<LightSource> = [
  {
    x: LIBRARY_BUILDING.x,
    y: 3.4,
    z: LIBRARY_BUILDING.frontZ + 3,
    intensity: 9,
    distance: 16,
    decay: 1.6,
  },
  ...SCHOOL_BUILDINGS.flatMap((b): LightSource[] => {
    if (b.kind === "gate") {
      return [
        {
          x: b.x,
          y: 5,
          z: b.z + b.halfD + 3,
          intensity: 7,
          distance: 18,
          decay: 1.6,
        },
      ];
    }
    if (b.kind === "tower") {
      return [
        {
          x: b.x,
          y: 6,
          z: b.z + b.halfD + 2,
          intensity: 6,
          distance: 16,
          decay: 1.6,
        },
      ];
    }
    if (b.kind === "workshop") {
      return [
        {
          x: b.x,
          y: 3,
          z: b.z + b.halfD - 0.3 + 1.5,
          intensity: 3,
          distance: 9,
          decay: 1.6,
        },
      ];
    }
    return [];
  }),
  {
    x: PAVILION.x,
    y: 0.45 + 2.6,
    z: PAVILION.z,
    intensity: 7,
    distance: 13,
    decay: 1.6,
  },
];

/**
 * 카메라 가까운 광원부터 `count`개를 고른다.
 * 빛이 닿는 거리 대비 상대 거리로 비교해, 멀리까지 비추는 큰 광원이 작은 등에 밀리지 않게 한다.
 */
export function pickNearestLights(
  sources: ReadonlyArray<LightSource>,
  at: Vec2,
  count: number,
): LightSource[] {
  return sources
    .map((s) => {
      const d = Math.hypot(s.x - at.x, s.z - at.z);
      return { s, d, score: d / s.distance };
    })
    .filter((c) => c.d < c.s.distance + LIGHT_VIEW_MARGIN)
    .sort((a, b) => a.score - b.score)
    .slice(0, count)
    .map((c) => c.s);
}

/**
 * 광원이 바뀌어도 이미 배정된 칸은 그대로 둔다 — 칸의 광원이 갑자기 다른 곳으로 튀지 않게.
 * 고른 광원 중 아직 칸이 없는 것만 빈 칸에 채운다. 남는 칸은 null.
 */
export function assignLightSlots(
  prev: ReadonlyArray<LightSource | null>,
  picked: ReadonlyArray<LightSource>,
): (LightSource | null)[] {
  const next = prev.map((s) => (s && picked.includes(s) ? s : null));
  for (const s of picked) {
    if (next.includes(s)) continue;
    const free = next.indexOf(null);
    if (free >= 0) next[free] = s;
  }
  return next;
}
