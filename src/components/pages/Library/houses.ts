/**
 * 사신학당 네 기숙사 — 사신수(백호·주작·현무·청룡)에서 모티브를 얻은 창작 설정.
 * 기숙사를 가르는 것은 재능이나 혈통이 아니라 "마법의 힘으로 무엇을 지키고 이루려 하는가"다.
 * 색 토큰은 `--color-house-<id>-{primary|accent|subtle|on}` (tokens/themes/library.json).
 */

export type HouseId = "baekho" | "jujak" | "hyeonmu" | "cheongryong";
export type HousePart = "primary" | "accent" | "subtle" | "on";

export interface House {
  id: HouseId;
  /** 기숙사 이름 */
  name: string;
  /** 가호하는 사신수 */
  guardian: string;
  /** 상징색 (스크린리더·설명용) */
  colorName: string;
  /** 기숙사 표어 */
  motto: string;
  /** 핵심 가치 */
  values: string;
  /** 기숙사가 학생에게 던지는 질문 */
  question: string;
}

export const HOUSES: Record<HouseId, House> = {
  baekho: {
    id: "baekho",
    name: "백호관",
    guardian: "백호",
    colorName: "아이보리와 먹색",
    motto: "힘을 얻은 자는 먼저 나선다.",
    values: "정의 · 용기 · 책임",
    question: "부당한 일을 보았을 때 나설 수 있는가?",
  },
  jujak: {
    id: "jujak",
    name: "주작관",
    guardian: "주작",
    colorName: "주홍과 금색",
    motto: "작은 숨결도 가벼이 여기지 않는다.",
    values: "생명 · 공감 · 회복",
    question: "상처 입은 존재를 끝까지 돌볼 수 있는가?",
  },
  hyeonmu: {
    id: "hyeonmu",
    name: "현무관",
    guardian: "현무",
    colorName: "남색과 은색",
    motto: "깊이 살피고, 때가 오면 움직인다.",
    values: "지혜 · 탐구 · 신중함",
    question: "눈앞의 답을 의심하고 진실을 찾을 수 있는가?",
  },
  cheongryong: {
    id: "cheongryong",
    name: "청룡관",
    guardian: "청룡",
    colorName: "청록과 금색",
    motto: "새 길을 열어, 함께 살아갈 터를 넓힌다.",
    values: "개척 · 포부 · 번영",
    question: "아직 없는 길을 열고 그 결과를 책임질 수 있는가?",
  },
};

export const HOUSE_IDS = Object.keys(HOUSES) as HouseId[];

export function isHouseId(v: unknown): v is HouseId {
  return typeof v === "string" && v in HOUSES;
}

/** CSS에서 쓰는 토큰 참조 */
export const houseVar = (id: HouseId, part: HousePart) =>
  `var(--color-house-${id}-${part})`;
/** getComputedStyle로 읽을 때 쓰는 토큰 이름 */
export const houseToken = (id: HouseId, part: HousePart) =>
  `--color-house-${id}-${part}` as const;

/* ── 저장: 한 번 배정되면 유지 ──────────────────────────────
 * 프로토타입이라 브라우저(localStorage)에 저장한다. 비공개 창 등에서 저장이
 * 막혀도 동작은 하고, 그 경우 새로고침 시 다시 배정된다.
 * 이전 설정(주작당·해태당 등)의 값은 isHouseId에서 걸러져 새로 배정된다.
 * 실시간 연동 시 사용자 프로필(Supabase)로 옮길 것. */

const STORAGE_KEY = "hanul-academy:house";

export function loadHouse(): HouseId | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return isHouseId(v) ? v : null;
  } catch {
    return null;
  }
}

export function saveHouse(id: HouseId): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* 저장 불가 환경 — 이번 세션 메모리에만 유지 */
  }
}

export function clearHouse(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}

/* ── 다시 배정: 하루 1번 ─────────────────────────────────────
 * 마지막으로 다시 배정한 날(YYYY-MM-DD)을 저장한다. 기숙사별 순위가 생기면서
 * 마음에 드는 기숙사가 나올 때까지 계속 다시 배정하는 것을 막기 위함.
 * 이 기록도 브라우저에만 있으므로 실제 서비스에서는 서버에서 검증해야 한다. */

const REROLL_KEY = "hanul-academy:reroll-day";

export function loadRerollDay(): string | null {
  try {
    return window.localStorage.getItem(REROLL_KEY);
  } catch {
    return null;
  }
}

export function saveRerollDay(day: string): void {
  try {
    window.localStorage.setItem(REROLL_KEY, day);
  } catch {
    /* 저장 불가 환경 — 이번 세션 메모리(상태)에만 유지 */
  }
}

export function clearRerollDay(): void {
  try {
    window.localStorage.removeItem(REROLL_KEY);
  } catch {
    /* noop */
  }
}

/** 오늘(`today`) 아직 다시 배정하지 않았으면 true */
export function canReroll(
  lastRerollDay: string | null,
  today: string,
): boolean {
  return lastRerollDay !== today;
}
