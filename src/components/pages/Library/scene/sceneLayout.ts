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
  /** 책상 중심 */
  desk: Vec2;
  /** 의자(앉는 위치) — 책상 앞(+z) */
  chair: Vec2;
}

/** 방 안쪽 이동 가능 범위 (벽 두께·책장 깊이 제외) */
export const ROOM = { minX: -5.6, maxX: 5.6, minZ: -6.6, maxZ: 8 } as const;
/** 입구 — 새로 들어오는 학생/내가 처음 서는 위치 */
export const DOOR: Vec2 = { x: 0, z: 7.4 };
export const PLAYER_RADIUS = 0.35;
/** 책상 반폭(x)·반깊이(z) */
export const DESK_HALF = { x: 1.1, z: 0.5 } as const;
/** 이 거리 안에 들어오면 "앉기" 버튼 노출 */
export const SIT_DISTANCE = 1.5;

const ROWS: Record<string, number> = { A: -4, B: -0.5, C: 3 };
const COLS: Record<string, number> = { "1": -2.6, "2": 2.6 };

/** 좌석 id(`A1`, `B2` …) → 책상/의자 위치 */
export function deskLayout(seatId: string): DeskLayout {
  const z = ROWS[seatId[0]] ?? 0;
  const x = COLS[seatId.slice(1)] ?? 0;
  return { seatId, desk: { x, z }, chair: { x, z: z + 0.95 } };
}

/** 방 경계 + 책상 AABB 밀어내기. 반환값은 실제로 이동 가능한 위치. */
export function resolveCollision(pos: Vec2, desks: DeskLayout[]): Vec2 {
  let x = Math.min(ROOM.maxX, Math.max(ROOM.minX, pos.x));
  let z = Math.min(ROOM.maxZ, Math.max(ROOM.minZ, pos.z));
  for (const { desk } of desks) {
    const hx = DESK_HALF.x + PLAYER_RADIUS;
    const hz = DESK_HALF.z + PLAYER_RADIUS;
    const dx = x - desk.x;
    const dz = z - desk.z;
    if (Math.abs(dx) < hx && Math.abs(dz) < hz) {
      // 덜 파고든 축으로 밀어낸다
      const px = hx - Math.abs(dx);
      const pz = hz - Math.abs(dz);
      if (px < pz) x = desk.x + Math.sign(dx || 1) * hx;
      else z = desk.z + Math.sign(dz || 1) * hz;
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
 * 앞벽에서 0.3m 안쪽, 벽 높이(6m)보다 아래.
 */
export const CAMERA_BOUNDS = {
  minX: ROOM.minX - 0.2,
  maxX: ROOM.maxX + 0.2,
  minZ: ROOM.minZ - 0.2,
  maxZ: FRONT_WALL_Z - 0.3,
  maxY: 5.6,
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
 * 시선은 대상보다 `lookAhead`m 앞에 둬서 앞쪽(다른 학생들)이 화면 중앙에 오게 한다.
 */
export function cameraRig(
  target: Vec2,
  o: Orbit,
  baseDist: number,
  lookAhead: number,
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
    look: [target.x - sy * lookAhead, 0.9, target.z - cy * lookAhead],
  };
}

/**
 * 조이스틱 입력(화면 기준: y=-1이 위) → 월드 이동 벡터.
 * "위로 밀기 = 카메라가 보는 방향"이 되도록 yaw만큼 회전한다.
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
  "--color-scene-moonlight",
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
