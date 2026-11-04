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
  ...(["ember", "azure", "gold", "verdant"] as const).flatMap(
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
