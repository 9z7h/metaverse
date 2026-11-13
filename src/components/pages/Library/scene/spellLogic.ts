/**
 * 주문의 시전 규칙 (three.js 무관, 단위 테스트 대상).
 * 기본 4종은 처음부터 쓰고, 나머지는 누적 수련 시간이 차야 하나씩 풀린다.
 * 주문은 월드의 공용 물건을 바꾸지 않는다. 시전자마다 작은 구역(또는 자기 모습)에 개인 효과를 남기고 곧 사라진다.
 * 그래서 여럿이 동시에 써도 서로의 효과가 겹치거나 지워지지 않는다.
 */

export type SpellId =
  | "myeonggyeong"
  | "mukryeong"
  | "hwaryong"
  | "buun"
  | "sosin"
  | "geosin"
  | "eunhyeong"
  | "suhoryeong";

export interface SpellInfo {
  id: SpellId;
  /** 화면에 보이는 이름 */
  name: string;
  /** 한 줄 설명 (칩 라벨 보조) */
  hint: string;
  /** 어떤 주문인지 풀어 쓴 설명 (잠긴 칩의 말풍선) */
  detail: string;
  /** 효과가 남는 시간 ms */
  durationMs: number;
  /** 풀리는 누적 수련 시간(초). 0이면 처음부터 쓴다 */
  unlockSeconds: number;
}

const HOUR = 3600;

export const SPELLS: Record<SpellId, SpellInfo> = {
  myeonggyeong: {
    id: "myeonggyeong",
    name: "명경",
    hint: "지팡이 불빛",
    detail: "지팡이 끝에 밝은 흰빛을 켭니다. 묵령으로 끌 때까지 유지돼요.",
    durationMs: Number.POSITIVE_INFINITY,
    unlockSeconds: 0,
  },
  mukryeong: {
    id: "mukryeong",
    name: "묵령",
    hint: "내 불빛 끄기",
    detail: "내 명경을 먹물처럼 흩어 끕니다.",
    durationMs: 1200,
    unlockSeconds: 0,
  },
  hwaryong: {
    id: "hwaryong",
    name: "화룡",
    hint: "작은 불꽃",
    detail: "작은 붉은 불꽃이 용처럼 움직이며 불씨를 남깁니다.",
    durationMs: 8000,
    unlockSeconds: 0,
  },
  buun: {
    id: "buun",
    name: "부운",
    hint: "조약돌 띄우기",
    detail: "작은 조약돌을 구름 조각 위로 띄웠다가 내립니다.",
    durationMs: 6000,
    unlockSeconds: 0,
  },
  sosin: {
    id: "sosin",
    name: "소신",
    hint: "몸 줄이기",
    detail:
      "내 모습이 0.55배로 작아집니다(10분). 거신을 쓰면 원래 크기로 돌아와요.",
    durationMs: 10 * 60 * 1000,
    unlockSeconds: HOUR,
  },
  geosin: {
    id: "geosin",
    name: "거신",
    hint: "몸 키우기",
    detail:
      "내 모습이 1.5배로 커집니다(30분). 소신을 쓰면 원래 크기로 돌아와요.",
    durationMs: 30 * 60 * 1000,
    unlockSeconds: HOUR,
  },
  eunhyeong: {
    id: "eunhyeong",
    name: "은형",
    hint: "모습 감추기",
    detail:
      "내 모습이 흐려져 남에게는 거의 보이지 않습니다(10초). 나에게는 옅게 보여요.",
    durationMs: 10000,
    unlockSeconds: 3 * HOUR,
  },
  suhoryeong: {
    id: "suhoryeong",
    name: "수호령",
    hint: "은빛 백호",
    detail: "은빛 백호의 윤곽이 구역을 한 바퀴 돌고 흩어집니다(8초).",
    durationMs: 8000,
    unlockSeconds: 5 * HOUR,
  },
};

/** 숫자키 1~8 순서이자 칩이 놓이는 순서 */
export const SPELL_ORDER: ReadonlyArray<SpellId> = [
  "myeonggyeong",
  "mukryeong",
  "hwaryong",
  "buun",
  "sosin",
  "geosin",
  "eunhyeong",
  "suhoryeong",
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
  // 소신·거신은 서로를 눌러 원래대로 돌아오는 데도 쓰므로 짧게 둔다
  sosin: 1500,
  geosin: 1500,
  eunhyeong: 10000,
  suhoryeong: 8000,
};
/** 한 장면에 동시에 남는 주문 효과 수 (넘으면 가장 오래된 것부터 지운다) */
export const MAX_ACTIVE = 6;
/** 주문 효과 하나가 쓰는 파티클 수 상한 */
export const MAX_PARTICLES = 28;

/** 주문별 파티클 수 — 각각 MAX_PARTICLES 이하 (SpellEffects가 이 수만큼 그린다) */
export const PARTICLE_COUNTS: Record<SpellId, number> = {
  myeonggyeong: 11,
  mukryeong: 20,
  hwaryong: 28,
  buun: 12,
  // 몸 주문은 아바타를 바꾸므로 따로 그리는 파티클이 없다
  sosin: 0,
  geosin: 0,
  eunhyeong: 0,
  suhoryeong: 28,
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
  /** 주문 기본 지속 시간 대신 쓸 값 ms — 몸 주문을 도중에 되돌릴 때 앞당겨 끝낸다 */
  durationMs?: number;
}

/** 이 시전이 남는 시간 ms */
export function castDuration(cast: SpellCast): number {
  return cast.durationMs ?? SPELLS[cast.spell].durationMs;
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

/* ── 몸 주문: 아바타의 보이는 모습만 잠깐 바꾼다 ───────────────
 * 충돌 반경·이동 속도·카메라·앉기는 그대로 두고, 한 사람에게 하나만 남는다. */

export type BodyKind = "small" | "big" | "hidden";

const BODY_KIND: Partial<Record<SpellId, BodyKind>> = {
  sosin: "small",
  geosin: "big",
  eunhyeong: "hidden",
};

/** 몸 주문이면 어떤 모습인지, 아니면 null */
export function bodyKindOf(spell: SpellId): BodyKind | null {
  return BODY_KIND[spell] ?? null;
}

/** 소신·거신일 때 몸 배율 */
export const BODY_SCALE: Record<Exclude<BodyKind, "hidden">, number> = {
  small: 0.55,
  big: 1.5,
};
/** 은형일 때 남에게 남는 불투명도 / 내 화면에 남는 불투명도 */
export const HIDDEN_OPACITY_OTHERS = 0.1;
export const HIDDEN_OPACITY_SELF = 0.4;
/** 몸이 바뀌고 돌아오는 데 걸리는 시간 ms */
export const BODY_FADE_IN_MS = 500;
export const BODY_FADE_OUT_MS = 700;

/** 아바타 한 명에게 지금 걸린 몸 주문 */
export interface BodyEffect {
  kind: BodyKind;
  /** 효과 시작 시각 ms (performance.now 기준) */
  at: number;
  durationMs: number;
}

/**
 * 몸 주문이 시작된 뒤 `elapsedMs`의 변화량. amount는 0(평소)~1(완전히 바뀜).
 * 시작 전·끝난 뒤에는 0이다.
 */
export function bodyAmount(elapsedMs: number, durationMs: number): number {
  if (elapsedMs < 0 || elapsedMs >= durationMs) return 0;
  return (
    ease(elapsedMs / BODY_FADE_IN_MS) *
    ease((durationMs - elapsedMs) / BODY_FADE_OUT_MS)
  );
}

/** 목록에서 시전자 한 명의 몸 주문(아직 끝나지 않은 것)을 찾는다 */
export function bodyEffectOf(
  casts: ReadonlyArray<SpellCast>,
  caster: string,
  now: number,
): BodyEffect | null {
  for (const c of casts) {
    const kind = bodyKindOf(c.spell);
    if (kind === null || c.caster !== caster) continue;
    const durationMs = castDuration(c);
    if (now < c.t0 + durationMs) return { kind, at: c.t0, durationMs };
  }
  return null;
}

/**
 * 지금 몸이 바뀌거나 돌아오는 중인 몸 주문이 있는가. 장면이 가만히 있어도
 * 이때만 화면을 다시 그려야 모습이 부드럽게 바뀐다(몸 주문은 10분 넘게 남을 수 있다).
 */
export function bodyFadeNow(
  casts: ReadonlyArray<SpellCast>,
  now: number,
): boolean {
  return casts.some((c) => {
    if (bodyKindOf(c.spell) === null) return false;
    const d = castDuration(c);
    return (
      (now >= c.t0 - 100 && now < c.t0 + BODY_FADE_IN_MS) ||
      (now >= c.t0 + d - BODY_FADE_OUT_MS && now < c.t0 + d)
    );
  });
}

/** `bodyFadeNow`의 값이 다음에 바뀔 때까지 ms. 더 바뀔 일이 없으면 null */
export function nextBodyFadeChange(
  casts: ReadonlyArray<SpellCast>,
  now: number,
): number | null {
  let next: number | null = null;
  for (const c of casts) {
    if (bodyKindOf(c.spell) === null) continue;
    const d = castDuration(c);
    for (const edge of [
      c.t0 - 100,
      c.t0 + BODY_FADE_IN_MS,
      c.t0 + d - BODY_FADE_OUT_MS,
      c.t0 + d,
    ]) {
      if (edge > now && (next === null || edge - now < next)) next = edge - now;
    }
  }
  return next;
}

/* ── 해금 ─────────────────────────────────────────────── */

/** 누적 수련 시간(초)으로 이 주문을 쓸 수 있는가 */
export function isUnlocked(spell: SpellId, totalSeconds: number): boolean {
  return totalSeconds >= SPELLS[spell].unlockSeconds;
}

/** 풀리기까지 남은 수련 시간(초). 이미 풀렸으면 0 */
export function secondsToUnlock(spell: SpellId, totalSeconds: number): number {
  return Math.max(0, SPELLS[spell].unlockSeconds - totalSeconds);
}

/** "1시간 20분", "35분" 같은 남은 시간 표기 */
export function formatRemaining(seconds: number): string {
  const minutes = Math.ceil(seconds / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}분`;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

/** 0(막 시작)~1(끝). 끝났으면 null */
export function castProgress(cast: SpellCast, now: number): number | null {
  const t = (now - cast.t0) / castDuration(cast);
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

/** 시전자가 소신↔거신 중 반대쪽을 쓰면 되돌릴 앞의 시전. 아니면 undefined */
function sizeUndo(
  active: ReadonlyArray<SpellCast>,
  next: SpellCast,
): SpellCast | undefined {
  const want = bodyKindOf(next.spell);
  if (want !== "small" && want !== "big") return undefined;
  return active.find((c) => {
    if (c.caster !== next.caster) return false;
    const kind = bodyKindOf(c.spell);
    return (kind === "small" || kind === "big") && kind !== want;
  });
}

/** 아직 끝나지 않은 효과만 */
export function activeCasts(
  casts: ReadonlyArray<SpellCast>,
  now: number,
): SpellCast[] {
  // 아직 시작 전인 것(동작 정점을 기다리는 중)도 남아 있는 효과로 센다
  return casts.filter((c) => now < c.t0 + castDuration(c));
}

/**
 * 새 시전을 목록에 넣는다.
 * - 같은 사람이 같은 주문을 다시 쓰면 앞의 것을 바꾼다 (한 사람당 주문마다 하나).
 * - 묵령은 시전자 자신의 명경만 거둔다. 남의 불빛은 건드리지 않는다.
 * - 일시적인 효과가 MAX_ACTIVE개를 넘으면 가장 오래된 것부터 지운다.
 * - 몸 주문(소신·거신·은형)은 한 사람에게 하나만 남고, 새로 쓰면 앞의 것이 끝난다.
 * - 소신 중에 거신(또는 거신 중에 소신)을 쓰면 반대로 커지거나 작아지지 않고 원래 크기로 돌아온다.
 * - 켜진 명경과 몸 주문은 다른 효과 때문에 사라지지 않는다.
 */
export function addCast(
  casts: ReadonlyArray<SpellCast>,
  next: SpellCast,
  now: number,
): SpellCast[] {
  const nextBody = bodyKindOf(next.spell) !== null;
  const active = activeCasts(casts, now);
  const undo = sizeUndo(active, next);
  if (undo) {
    // 앞의 몸 주문을 지금 시점에서 끝내 모습이 서서히 돌아오게 하고, 새 시전은 남기지 않는다
    const endsAfter = Math.max(0, next.t0 - undo.t0) + BODY_FADE_OUT_MS;
    return active.map((c) =>
      c === undo ? { ...c, durationMs: endsAfter } : c,
    );
  }
  const kept = active.filter(
    (c) =>
      !(c.caster === next.caster && c.spell === next.spell) &&
      !(nextBody && c.caster === next.caster && bodyKindOf(c.spell) !== null) &&
      !(
        next.spell === "mukryeong" &&
        c.caster === next.caster &&
        c.spell === "myeonggyeong"
      ),
  );
  const all = [...kept, next];
  const temporary = all.filter(
    (cast) => cast.spell !== "myeonggyeong" && bodyKindOf(cast.spell) === null,
  );
  const remove = new Set(
    temporary.slice(0, Math.max(0, temporary.length - MAX_ACTIVE)),
  );
  return all.filter((cast) => !remove.has(cast));
}
