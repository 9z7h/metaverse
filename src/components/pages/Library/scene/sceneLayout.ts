/**
 * 3D 도서관 배치·충돌·색상 — three.js에 의존하지 않는 순수 로직 (단위 테스트 대상).
 * 좌표계: x = 좌우, z = 앞뒤(+z가 입구 쪽), 단위 = 미터 느낌.
 */

export interface Vec2 {
  x: number;
  z: number;
}

export interface DeskLayout {
  seatId: string;
  /** 이 좌석 앞 테이블 위의 자리 (책·마법 연출 기준점) */
  desk: Vec2;
  /** 의자(앉는 위치) */
  chair: Vec2;
  /** 앉았을 때 아바타가 바라보는 방향 — y축 회전(rad). 테이블 쪽 */
  facing: number;
  /** 일어났을 때 한 발 물러서는 곳 (테이블 반대편 통로) */
  stand: Vec2;
}

/** 방 안쪽 이동 가능 범위 (벽 두께·책장 깊이 제외) */
export const ROOM = { minX: -8, maxX: 8, minZ: -13, maxZ: 11 } as const;
/** 입구 — 새로 들어오는 학생/내가 처음 서는 위치 */
export const DOOR: Vec2 = { x: 0, z: ROOM.maxZ - 0.6 };

/** 높은 한옥 서고의 수직 구성 (벽·회랑·천장) */
export const HALL = {
  /** 벽 높이 = 천장(대들보) 높이 */
  wallH: 10,
  /** 2층 회랑 바닥 높이 — 그 위로 윗단 서가 */
  galleryY: 3.55,
  /** 회랑이 벽에서 방 안쪽으로 튀어나온 폭 */
  ledge: 0.9,
  /** 윗단 서가가 시작하는 높이 */
  upperShelfY: 3.7,
} as const;

/**
 * 지나갈 수 없는 고정 장식(원형). 책상과 함께 충돌·경로 계산에 쓰인다.
 * 혼천의: 뒷벽 오른쪽 모서리 근처.
 */
export const OBSTACLES: ReadonlyArray<{ x: number; z: number; r: number }> = [
  { x: 6.2, z: -11.6, r: 0.7 },
];
export const PLAYER_RADIUS = 0.35;
/** 이 거리 안에 들어오면 "앉기" 버튼 노출 */
export const SIT_DISTANCE = 1.5;

/* ── 긴 열람 테이블 ───────────────────────────────────────────
 * 서고 길이 방향(z)으로 이어지는 테이블이 가운데 통로(x ±2.1) 양쪽에 하나씩.
 * 각 테이블의 양쪽(통로 쪽·벽 쪽)에 의자가 8석씩 마주 보고 놓인다 → 테이블당 16석, 모두 32석. */

export interface Table {
  /** 중심 */
  x: number;
  z: number;
  /** 반폭(x)·반길이(z) */
  hx: number;
  hz: number;
}

export const TABLES: ReadonlyArray<Table> = [
  { x: -3.8, z: -2.1, hx: 0.8, hz: 8.4 },
  { x: 3.8, z: -2.1, hx: 0.8, hz: 8.4 },
];
/** 한쪽 면의 좌석 수와 간격, 첫 좌석(가장 안쪽)의 z */
export const SEATS_PER_SIDE = 8;
export const SEAT_PITCH = 2.1;
export const SEAT_Z0 = -9.45;
/** 테이블 가장자리에서 의자 중심까지 */
const CHAIR_GAP = 0.55;

/** 테이블 위 등잔 자리 — 같은 면 좌석 사이마다 하나 (양쪽 면이 함께 쓴다) */
export const TABLE_CANDLES: ReadonlyArray<Vec2> = TABLES.flatMap((t) =>
  Array.from({ length: SEATS_PER_SIDE - 1 }, (_, k) => ({
    x: t.x,
    z: SEAT_Z0 + k * SEAT_PITCH + SEAT_PITCH / 2,
  })),
);

/**
 * 좌석 id(`L1`~`L16`, `R1`~`R16`) → 테이블/의자 위치.
 * L·R은 왼쪽·오른쪽 테이블, 1~8은 통로 쪽 면, 9~16은 벽 쪽 면 (각각 안쪽 → 입구 쪽 순서).
 */
export function deskLayout(seatId: string): DeskLayout {
  const t = seatId[0] === "R" ? TABLES[1] : TABLES[0];
  const n = Math.min(
    SEATS_PER_SIDE * 2,
    Math.max(1, Math.floor(Number(seatId.slice(1))) || 1),
  );
  const inner = n <= SEATS_PER_SIDE;
  const k = (n - 1) % SEATS_PER_SIDE;
  // 이 테이블에서 가운데 통로가 있는 쪽(±1), 그리고 의자가 놓인 쪽
  const aisleDir = t.x < 0 ? 1 : -1;
  const chairDir = inner ? aisleDir : -aisleDir;
  const z = SEAT_Z0 + k * SEAT_PITCH;
  const chairX = t.x + chairDir * (t.hx + CHAIR_GAP);
  return {
    seatId,
    desk: { x: t.x + chairDir * 0.3, z },
    chair: { x: chairX, z },
    // 의자에서 테이블 쪽(-chairDir)을 봄. 아바타 정면은 (sin ry, cos ry)
    facing: Math.atan2(-chairDir, 0),
    stand: { x: chairX + chairDir * 0.9, z },
  };
}

/** 방 경계 + 테이블·고정 장식 밀어내기. 반환값은 실제로 이동 가능한 위치. */
export function resolveCollision(pos: Vec2): Vec2 {
  let x = Math.min(ROOM.maxX, Math.max(ROOM.minX, pos.x));
  let z = Math.min(ROOM.maxZ, Math.max(ROOM.minZ, pos.z));
  for (const t of TABLES) {
    const hx = t.hx + PLAYER_RADIUS;
    const hz = t.hz + PLAYER_RADIUS;
    const dx = x - t.x;
    const dz = z - t.z;
    if (Math.abs(dx) < hx && Math.abs(dz) < hz) {
      // 덜 파고든 축으로 밀어낸다
      const px = hx - Math.abs(dx);
      const pz = hz - Math.abs(dz);
      if (px < pz) x = t.x + Math.sign(dx || 1) * hx;
      else z = t.z + Math.sign(dz || 1) * hz;
    }
  }
  for (const o of OBSTACLES) {
    const min = o.r + PLAYER_RADIUS;
    const dx = x - o.x;
    const dz = z - o.z;
    const dist = Math.hypot(dx, dz);
    if (dist < min) {
      // 중심에서 바깥쪽으로 밀어낸다 (정확히 중심이면 입구 쪽으로)
      const nx = dist === 0 ? 0 : dx / dist;
      const nz = dist === 0 ? 1 : dz / dist;
      x = o.x + nx * min;
      z = o.z + nz * min;
    }
  }
  return { x, z };
}

/** 가장 가까운 빈 의자 (SIT_DISTANCE 이내), 없으면 null */
export function nearestFreeSeat(
  pos: Vec2,
  desks: DeskLayout[],
  occupied: Set<string>,
): DeskLayout | null {
  let best: DeskLayout | null = null;
  let bestD = SIT_DISTANCE;
  for (const d of desks) {
    if (occupied.has(d.seatId)) continue;
    const dist = Math.hypot(pos.x - d.chair.x, pos.z - d.chair.z);
    if (dist <= bestD) {
      best = d;
      bestD = dist;
    }
  }
  return best;
}

/* ── 탭 이동: 탭한 곳 해석 + 테이블을 피해 가는 경로 ─────────── */

/** 점이 (아바타 반경만큼 넓힌) 테이블·고정 장식 안에 있는지 */
function blocked(p: Vec2): boolean {
  return (
    TABLES.some(
      (t) =>
        Math.abs(p.x - t.x) < t.hx + PLAYER_RADIUS &&
        Math.abs(p.z - t.z) < t.hz + PLAYER_RADIUS,
    ) ||
    OBSTACLES.some(
      (o) => Math.hypot(p.x - o.x, p.z - o.z) < o.r + PLAYER_RADIUS,
    )
  );
}

/** a→b 직선으로 걸어갈 때 막히지 않는지 (0.1m 간격으로 확인) */
export function segmentClear(a: Vec2, b: Vec2): boolean {
  const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.1));
  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    if (blocked({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }))
      return false;
  }
  return true;
}

export type TapTarget =
  | { kind: "seat"; seat: DeskLayout }
  | { kind: "floor"; point: Vec2 };

/** 테이블 상판 높이 — 탭 판정용 */
export const DESK_TOP_Y = 0.78;

/** 상판을 탭했을 때 이 거리 안의 빈 좌석이 있으면 거기 앉는다 */
const TAP_SEAT_REACH = 1.3;

/**
 * 탭한 지점 → 이동 목표.
 * 비스듬히 내려다보는 카메라에서는 같은 탭이라도 높이에 따라 닿는 곳이 다르다
 * (상판을 탭해도 바닥 높이로 계산하면 1~2m 뒤 바닥이 된다). 그래서
 * - `atFloor`(바닥 높이)가 빈 의자 근처면 그 자리
 * - `atDesk`(상판 높이에서의 교차점)가 테이블 위면 가장 가까운 빈 좌석
 * - 아니면 `atFloor`를 갈 수 있는 위치로 보정한 바닥
 */
export function tapTarget(
  atFloor: Vec2,
  atDesk: Vec2 | null,
  desks: DeskLayout[],
  occupied: Set<string>,
): TapTarget {
  for (const d of desks) {
    if (occupied.has(d.seatId)) continue;
    if (Math.hypot(atFloor.x - d.chair.x, atFloor.z - d.chair.z) <= 0.7)
      return { kind: "seat", seat: d };
  }
  const onTable =
    atDesk !== null &&
    TABLES.some(
      (t) =>
        Math.abs(atDesk.x - t.x) <= t.hx + 0.1 &&
        Math.abs(atDesk.z - t.z) <= t.hz + 0.1,
    );
  if (atDesk && onTable) {
    let best: DeskLayout | null = null;
    let bestD = TAP_SEAT_REACH;
    for (const d of desks) {
      if (occupied.has(d.seatId)) continue;
      const dist = Math.hypot(atDesk.x - d.desk.x, atDesk.z - d.desk.z);
      if (dist < bestD) {
        best = d;
        bestD = dist;
      }
    }
    if (best) return { kind: "seat", seat: best };
  }
  return { kind: "floor", point: resolveCollision(atFloor) };
}

const GRID = 0.5;

/**
 * from → to 경로. 직선이 막히면 0.5m 격자에서 BFS로 길을 찾고,
 * 보이는 지점까지 건너뛰어(string pulling) 꺾이는 곳만 남긴다.
 * 반환값은 from 다음부터 to까지의 경유점 (마지막은 항상 to).
 */
export function planPath(from: Vec2, to: Vec2): Vec2[] {
  if (segmentClear(from, to)) return [to];

  const cols = Math.floor((ROOM.maxX - ROOM.minX) / GRID) + 1;
  const rows = Math.floor((ROOM.maxZ - ROOM.minZ) / GRID) + 1;
  const cell = (c: number, r: number): Vec2 => ({
    x: ROOM.minX + c * GRID,
    z: ROOM.minZ + r * GRID,
  });
  const walkable = (c: number, r: number) =>
    c >= 0 && r >= 0 && c < cols && r < rows && !blocked(cell(c, r));
  const nearestCell = (p: Vec2): [number, number] => {
    let best: [number, number] = [0, 0];
    let bestD = Infinity;
    for (let c = 0; c < cols; c++)
      for (let r = 0; r < rows; r++) {
        if (!walkable(c, r)) continue;
        const q = cell(c, r);
        const d = Math.hypot(q.x - p.x, q.z - p.z);
        if (d < bestD && segmentClear(p, q)) {
          bestD = d;
          best = [c, r];
        }
      }
    return best;
  };

  const [sc, sr] = nearestCell(from);
  const [gc, gr] = nearestCell(to);
  const key = (c: number, r: number) => r * cols + c;
  const prev = new Map<number, number>([[key(sc, sr), -1]]);
  const queue: [number, number][] = [[sc, sr]];
  while (queue.length) {
    const [c, r] = queue.shift()!;
    if (c === gc && r === gr) break;
    for (const [dc, dr] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ]) {
      const nc = c + dc;
      const nr = r + dr;
      // 대각선은 양옆이 모두 비어 있어야 (모서리 깎기 방지)
      if (dc && dr && (!walkable(c + dc, r) || !walkable(c, r + dr))) continue;
      if (!walkable(nc, nr) || prev.has(key(nc, nr))) continue;
      prev.set(key(nc, nr), key(c, r));
      queue.push([nc, nr]);
    }
  }
  if (!prev.has(key(gc, gr))) return [resolveCollision(to)];

  const cells: Vec2[] = [];
  for (let k = key(gc, gr); k !== -1; k = prev.get(k)!) {
    cells.unshift(cell(k % cols, Math.floor(k / cols)));
  }
  const points = [...cells, to];

  // string pulling: 지금 위치에서 직선으로 보이는 가장 먼 경유점으로 건너뜀
  const out: Vec2[] = [];
  let cur = from;
  let i = 0;
  while (i < points.length) {
    let far = i;
    for (let j = points.length - 1; j > i; j--) {
      if (segmentClear(cur, points[j])) {
        far = j;
        break;
      }
    }
    out.push(points[far]);
    cur = points[far];
    i = far + 1;
  }
  return out;
}

/* ── 카메라: 드래그로 돌리는 궤도(orbit) 카메라 ─────────────── */

export interface Orbit {
  /** 수평 회전(rad). 0 = 대상 뒤(+z)에서 -z 방향을 봄 */
  yaw: number;
  /** 내려다보는 각도(rad) */
  pitch: number;
  /** 거리 배율 (휠·핀치 줌) */
  zoom: number;
}

export const ORBIT_DEFAULT: Orbit = { yaw: 0, pitch: 0.65, zoom: 1 };

/**
 * 앞벽(입구) 안쪽 면 z. 시점을 돌릴 수 있게 되면서 앞쪽도 막아야 한다.
 * 열람실(ROOM) 앞에 6m 입구 홀을 둬서, 입구 근처에 서 있어도
 * 기본 카메라(뒤로 약 6m)가 벽에 밀려 아바타 바로 뒤로 붙지 않게 한다.
 */
export const FRONT_WALL_Z = ROOM.maxZ + 6.3;

/**
 * 카메라가 머물 수 있는 공간. 좌우·뒤 책장 앞면(벽에서 0.45m)보다 안쪽,
 * 앞벽에서 0.3m 안쪽, 천장(10m) 대들보보다 아래.
 */
export const CAMERA_BOUNDS = {
  minX: ROOM.minX - 0.2,
  maxX: ROOM.maxX + 0.2,
  minZ: ROOM.minZ - 0.2,
  maxZ: FRONT_WALL_Z - 0.3,
  maxY: 7.6,
} as const;

export const ORBIT_LIMITS = {
  pitchMin: 0.2,
  pitchMax: 1.3,
  zoomMin: 0.5,
  zoomMax: 1.8,
} as const;

export function clampOrbit(o: Orbit): Orbit {
  return {
    yaw: o.yaw,
    pitch: Math.min(
      ORBIT_LIMITS.pitchMax,
      Math.max(ORBIT_LIMITS.pitchMin, o.pitch),
    ),
    zoom: Math.min(
      ORBIT_LIMITS.zoomMax,
      Math.max(ORBIT_LIMITS.zoomMin, o.zoom),
    ),
  };
}

/**
 * 대상 위치 + 궤도 → 카메라 위치와 바라볼 점.
 * 시선은 대상보다 `lookAhead`m 앞에 둬서 앞쪽(다른 학생들)이 화면 중앙에 오게 하고,
 * `lookLift`만큼 시선 높이를 올린다(문 위 순위판을 볼 때 `boardLift`).
 */
export function cameraRig(
  target: Vec2,
  o: Orbit,
  baseDist: number,
  lookAhead: number,
  lookLift = 0,
): { cam: [number, number, number]; look: [number, number, number] } {
  const d = baseDist * o.zoom;
  const sy = Math.sin(o.yaw);
  const cy = Math.cos(o.yaw);
  const horiz = Math.cos(o.pitch) * d;
  // 카메라가 벽·천장 밖으로 나가면 시선 방향을 따라 안쪽으로 당긴다 (카메라 충돌)
  const off = { x: sy * horiz, y: Math.sin(o.pitch) * d, z: cy * horiz };
  let t = 1;
  const fit = (from: number, delta: number, min: number, max: number) => {
    if (from + delta * t > max && delta > 0)
      t = Math.min(t, (max - from) / delta);
    if (from + delta * t < min && delta < 0)
      t = Math.min(t, (min - from) / delta);
  };
  fit(target.x, off.x, CAMERA_BOUNDS.minX, CAMERA_BOUNDS.maxX);
  fit(target.z, off.z, CAMERA_BOUNDS.minZ, CAMERA_BOUNDS.maxZ);
  fit(0, off.y, 0, CAMERA_BOUNDS.maxY);
  t = Math.max(0, t);
  return {
    cam: [target.x + off.x * t, off.y * t, target.z + off.z * t],
    look: [
      target.x - sy * lookAhead,
      0.9 + lookLift,
      target.z - cy * lookAhead,
    ],
  };
}

/**
 * 현재 yaw에서 `target`(rad)을 향해 가장 짧게 도는 도착 yaw.
 * yaw는 드래그로 몇 바퀴든 돌 수 있으므로, 단순히 target으로 보간하면 한 바퀴를 돌아간다.
 */
export function shortestYawTarget(yaw: number, target: number): number {
  const TAU = Math.PI * 2;
  const delta = ((((target - yaw) % TAU) + 3 * Math.PI) % TAU) - Math.PI;
  return yaw + delta;
}

/** 입구 쪽(앞벽, +z)을 바라보는 yaw — 카메라가 대상 앞(-z)에서 +z를 본다 */
export const YAW_FACING_DOOR = Math.PI;

/** 문 쪽을 정면으로 볼 때 시선을 들어 올리는 높이(m) — 문 위 높이 걸린 순위판이 화면 가운데에 오도록 */
export const BOARD_LIFT = 1.5;

/**
 * 시선 높이 가산값. 문 쪽을 볼수록(yaw가 π에 가까울수록) 커지고, 등지면 0.
 * 순위판 보기 버튼이든 화면을 끌어 직접 돌리든 같은 결과가 되도록 yaw만으로 정한다.
 * 제곱을 써서 비스듬히 볼 때는 조금만 올라가 시야가 갑자기 튀지 않는다.
 */
export function boardLift(yaw: number): number {
  const facing = Math.max(0, -Math.cos(yaw));
  return BOARD_LIFT * facing * facing;
}

/**
 * 키보드 입력(화면 기준: y=-1이 위) → 월드 이동 벡터.
 * "위 = 카메라가 보는 방향"이 되도록 yaw만큼 회전한다.
 */
export function cameraRelativeMove(x: number, y: number, yaw: number): Vec2 {
  const sy = Math.sin(yaw);
  const cy = Math.cos(yaw);
  // right = (cos, -sin), forward = (-sin, -cos); 이동 = right*x + forward*(-y)
  return { x: x * cy + y * sy, z: -x * sy + y * cy };
}

/* ── 색상: CSS 디자인 토큰 → three.js ───────────────────── */

export const SCENE_COLOR_TOKENS = [
  "--color-background-default",
  "--color-scene-floor",
  "--color-scene-wall",
  "--color-scene-fog",
  "--color-scene-wood",
  "--color-scene-wood-dark",
  "--color-scene-wood-light",
  "--color-scene-flame",
  "--color-scene-light",
  "--color-scene-skin",
  "--color-scene-hat",
  "--color-scene-robe-1",
  "--color-scene-robe-2",
  "--color-scene-robe-3",
  "--color-scene-robe-4",
  "--color-scene-rug",
  "--color-scene-collar",
  "--color-scene-moonlight",
  "--color-scene-brass",
  "--color-scene-dancheong",
  ...(["baekho", "jujak", "hyeonmu", "cheongryong"] as const).flatMap(
    (h) =>
      [
        `--color-house-${h}-primary`,
        `--color-house-${h}-accent`,
        `--color-house-${h}-on`,
        `--color-house-${h}-subtle`,
      ] as const,
  ),
] as const;

export type SceneColorToken = (typeof SCENE_COLOR_TOKENS)[number];
export type SceneColors = Record<SceneColorToken, string>;

/**
 * `data-theme="library"` 요소에서 토큰 값을 읽는다. 커스텀 프로퍼티의 computed
 * value는 var() 참조가 이미 치환된 hex 문자열이라 three.js Color에 바로 넘길 수 있다.
 */
export function readSceneColors(el: Element): SceneColors {
  const cs = getComputedStyle(el);
  const out = {} as SceneColors;
  for (const t of SCENE_COLOR_TOKENS) out[t] = cs.getPropertyValue(t).trim();
  return out;
}

/** `:root`에 정의된 프리미티브 토큰 값 (장면 밖에서 만드는 공유 텍스처용) */
export function rootToken(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

/** 알파 마스크용 흰색 — gray/100 프리미티브 토큰 */
export const MASK_WHITE_TOKEN = "--color-gray-100";

const parsedCache = new Map<string, [number, number, number] | null>();
let probeCtx: CanvasRenderingContext2D | null | undefined;

/**
 * hex·rgb()가 아닌 색(oklch, 이름 색 등)을 브라우저의 색 파서로 RGB로 바꾼다.
 * canvas의 fillStyle에 넣고 한 픽셀을 읽는다. 해석할 수 없는 값이면 null.
 * (Tailwind 기본 팔레트와 토큰 이름이 겹치면 oklch 값이 들어올 수 있다)
 */
function parseWithBrowser(color: string): [number, number, number] | null {
  const hit = parsedCache.get(color);
  if (hit !== undefined) return hit;
  let out: [number, number, number] | null = null;
  try {
    if (probeCtx === undefined) {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      probeCtx = canvas.getContext("2d", { willReadFrequently: true });
    }
    if (probeCtx) {
      const ctx = probeCtx;
      // 해석할 수 없는 색을 대입하면 fillStyle이 이전 값 그대로 남는다.
      // 검정·흰색 두 번 시험해서 하나라도 바뀌면 브라우저가 이해한 색이다
      // (이름으로 시험하므로 색 리터럴을 쓰지 않고, 색이 검정/흰색 자체여도 구분된다)
      const accepted = (probe: string) => {
        ctx.fillStyle = probe;
        const before = ctx.fillStyle;
        ctx.fillStyle = color;
        return ctx.fillStyle !== before;
      };
      ctx.clearRect(0, 0, 1, 1);
      if (accepted("black") || accepted("white")) {
        ctx.fillRect(0, 0, 1, 1);
        const d = ctx.getImageData(0, 0, 1, 1).data;
        out = [d[0], d[1], d[2]];
      }
    }
  } catch {
    out = null;
  }
  parsedCache.set(color, out);
  return out;
}

/**
 * 토큰 값에 투명도를 붙여 canvas 색 문자열로 만든다.
 * 반투명 그라데이션·질감을 그릴 때 `rgba(...)`를 직접 쓰지 않고 토큰에서 만들기 위함.
 * `#rrggbb`·`#rgb`·`rgb()/rgba()`는 바로 처리하고, oklch 같은 그 밖의 색은 브라우저가 해석한다.
 * 해석할 수 없는 값이면 그대로 돌려준다.
 * (알파가 조용히 사라지면 번짐 텍스처가 불투명한 네모가 되므로, 어떤 형식이든 받는다)
 */
export function withAlpha(color: string, alpha: number): string {
  const c = color.trim();
  const long = /^#([0-9a-f]{6})$/i.exec(c);
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(c);
  const hex = long
    ? long[1]
    : short
      ? short[1] + short[1] + short[2] + short[2] + short[3] + short[3]
      : null;
  if (hex) {
    const n = parseInt(hex, 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  }
  const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(c);
  if (rgb) return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${alpha})`;
  const parsed = c ? parseWithBrowser(c) : null;
  if (parsed) return `rgba(${parsed[0]}, ${parsed[1]}, ${parsed[2]}, ${alpha})`;
  return color;
}
