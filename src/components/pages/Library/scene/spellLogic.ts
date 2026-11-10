/**
 * 기본 주문 4종의 시전 규칙 (three.js 무관, 단위 테스트 대상).
 * 주문은 월드의 공용 물건을 바꾸지 않는다. 시전자마다 작은 구역에 개인 효과를 남기고 곧 사라진다.
 * 그래서 여럿이 동시에 써도 서로의 효과가 겹치거나 지워지지 않는다.
 */

export type SpellId = "myeonggyeong" | "mukryeong" | "hwaryong" | "buun";

export interface SpellInfo {
  id: SpellId;
  /** 화면에 보이는 이름 */
  name: string;
  /** 한 줄 설명 (칩 라벨 보조) */
  hint: string;
  /** 효과가 남는 시간 ms */
  durationMs: number;
}

export const SPELLS: Record<SpellId, SpellInfo> = {
  myeonggyeong: {
    id: "myeonggyeong",
    name: "명경",
    hint: "지팡이 불빛",
    durationMs: Number.POSITIVE_INFINITY,
  },
  mukryeong: {
    id: "mukryeong",
    name: "묵령",
    hint: "내 불빛 끄기",
    durationMs: 1200,
  },
  hwaryong: {
    id: "hwaryong",
    name: "화룡",
    hint: "작은 불꽃",
    durationMs: 8000,
  },
  buun: {
    id: "buun",
    name: "부운",
    hint: "조약돌 띄우기",
    durationMs: 6000,
  },
};

/** 숫자키 1~4 순서이자 칩이 놓이는 순서 */
export const SPELL_ORDER: ReadonlyArray<SpellId> = [
  "myeonggyeong",
  "mukryeong",
  "hwaryong",
  "buun",
];

/** 시전자 앞 이만큼 떨어진 곳이 구역의 중심 (m) */
export const CAST_DISTANCE = 1.6;
/** 구역 반지름 (m) — 효과는 이 안에서만 그린다 */
export const CAST_RADIUS = 1.2;
/** 주문별 재시전 간격(ms). 명경·묵령은 같은 토글 간격을 공유한다. */
export const COOLDOWN_MS: Record<SpellId, number> = {
  myeonggyeong: 500,
  mukryeong: 500,
  hwaryong: 8000,
  buun: 6000,
};
/** 한 장면에 동시에 남는 주문 효과 수 (넘으면 가장 오래된 것부터 지운다) */
export const MAX_ACTIVE = 6;
/** 주문 효과 하나가 쓰는 파티클 수 상한 */
export const MAX_PARTICLES = 24;

/** 주문별 파티클 수 — 각각 MAX_PARTICLES 이하 (SpellEffects가 이 수만큼 그린다) */
export const PARTICLE_COUNTS: Record<SpellId, number> = {
  myeonggyeong: 11,
  mukryeong: 14,
  hwaryong: 18,
  buun: 8,
};

/** 지팡이를 휘두르는 연출 길이 ms */
export const CAST_SWING_MS = 1200;
/** 시전 시작 후 지팡이가 앞으로 나아가는 정점까지 ms — 효과는 이 순간에 풀려난다 */
export const CAST_RELEASE_MS = 480;

const ease = (v: number) => {
  const c = Math.min(1, Math.max(0, v));
  return c * c * (3 - 2 * c);
};

/**
 * 시전 시작 후 `elapsedMs`의 팔 자세. weight는 평소 자세에서 지팡이를 든 자세로 섞는 비율(0~1),
 * flick은 든 팔의 앞뒤 움직임(-1~1, 양수는 뒤로 젖힘, 음수는 앞으로 내뻗음). 연출 밖이면 둘 다 0.
 * 팔을 들어 올리고(0~20%) → 뒤로 젖혔다가(~25%) → 앞으로 내뻗고(정점 40%) → 천천히 내려놓는다.
 */
export function swingPose(elapsedMs: number): {
  weight: number;
  flick: number;
} {
  if (elapsedMs < 0 || elapsedMs >= CAST_SWING_MS)
    return { weight: 0, flick: 0 };
  const t = elapsedMs / CAST_SWING_MS;
  const weight = ease(t / 0.2) * ease((1 - t) / 0.3);
  const peak = CAST_RELEASE_MS / CAST_SWING_MS;
  let flick: number;
  if (t < 0.25) flick = 0.8 * ease(t / 0.25);
  else if (t < peak) flick = 0.8 - 1.8 * ease((t - 0.25) / (peak - 0.25));
  else if (t < 0.7) flick = -1 + ease((t - peak) / (0.7 - peak));
  else flick = 0;
  return { weight, flick };
}

export function isSpellId(value: unknown): value is SpellId {
  return typeof value === "string" && Object.hasOwn(SPELLS, value);
}

export interface SpellCast {
  /** 시전 한 번을 가리키는 고유 값 */
  id: string;
  caster: string;
  spell: SpellId;
  /** 구역 중심 */
  x: number;
  z: number;
  /** 구역 높이. 구름 위에서 시전하면 구름 높이 (없으면 땅) */
  y?: number;
  /** 시전 방향 rad (아바타 rotation.y와 같은 기준) */
  ry: number;
  /** 시전 시각 ms */
  t0: number;
}

/** 시전자 위치와 방향에서 구역 중심을 구한다. 아바타의 앞은 (sin ry, cos ry) */
export function castZone(
  x: number,
  z: number,
  ry: number,
): { x: number; z: number } {
  return {
    x: x + Math.sin(ry) * CAST_DISTANCE,
    z: z + Math.cos(ry) * CAST_DISTANCE,
  };
}

/** 쿨다운이 지났는가. 처음 쓰는 경우(lastCastAt이 null)는 항상 가능 */
export function canCast(
  lastCastAt: number | null,
  now: number,
  spell: SpellId,
): boolean {
  return lastCastAt === null || now - lastCastAt >= COOLDOWN_MS[spell];
}

/** 0(막 시작)~1(끝). 끝났으면 null */
export function castProgress(cast: SpellCast, now: number): number | null {
  const t = (now - cast.t0) / SPELLS[cast.spell].durationMs;
  return t < 0 || t >= 1 ? null : t;
}

/** 명경은 시전 정점부터 묵령으로 끌 때까지 지팡이 끝을 밝힌다. */
export function wandLightIsOn(start: number | null, now: number): boolean {
  return start !== null && now >= start;
}

/** 빛 주문 버튼과 단축키는 현재 상태에 따라 켜기 또는 끄기로 동작한다. */
export function resolveLightToggle(spell: SpellId, lightOn: boolean): SpellId {
  if (spell !== "myeonggyeong" && spell !== "mukryeong") return spell;
  return lightOn ? "mukryeong" : "myeonggyeong";
}

/** 아직 끝나지 않은 효과만 */
export function activeCasts(
  casts: ReadonlyArray<SpellCast>,
  now: number,
): SpellCast[] {
  // 아직 시작 전인 것(동작 정점을 기다리는 중)도 남아 있는 효과로 센다
  return casts.filter((c) => now < c.t0 + SPELLS[c.spell].durationMs);
}

/**
 * 새 시전을 목록에 넣는다.
 * - 같은 사람이 같은 주문을 다시 쓰면 앞의 것을 바꾼다 (한 사람당 주문마다 하나).
 * - 묵령은 시전자 자신의 명경만 거둔다. 남의 불빛은 건드리지 않는다.
 * - 일시적인 효과가 MAX_ACTIVE개를 넘으면 가장 오래된 것부터 지운다.
 * - 켜진 명경은 다른 효과 때문에 사라지지 않는다.
 */
export function addCast(
  casts: ReadonlyArray<SpellCast>,
  next: SpellCast,
  now: number,
): SpellCast[] {
  const kept = activeCasts(casts, now).filter(
    (c) =>
      !(c.caster === next.caster && c.spell === next.spell) &&
      !(
        next.spell === "mukryeong" &&
        c.caster === next.caster &&
        c.spell === "myeonggyeong"
      ),
  );
  const all = [...kept, next];
  const temporary = all.filter((cast) => cast.spell !== "myeonggyeong");
  const remove = new Set(
    temporary.slice(0, Math.max(0, temporary.length - MAX_ACTIVE)),
  );
  return all.filter((cast) => !remove.has(cast));
}
