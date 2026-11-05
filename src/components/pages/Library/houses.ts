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
    colorName: "백색과 먹색",
    motto: "힘을 얻은 자는 먼저 나선다.",
    values: "정의 · 용맹 · 책임",
    question: "부당한 일을 보았을 때 나설 수 있는가?",
  },
  jujak: {
    id: "jujak",
    name: "주작관",
    guardian: "주작",
    colorName: "붉은색과 따뜻한 금색",
    motto: "작은 숨결도 가벼이 여기지 않는다.",
    values: "생명 존중 · 공감 · 회복",
    question: "상처 입은 존재를 끝까지 돌볼 수 있는가?",
  },
  hyeonmu: {
    id: "hyeonmu",
    name: "현무관",
    guardian: "현무",
    colorName: "짙은 남색과 은색",
    motto: "깊이 살피고, 때가 오면 움직인다.",
    values: "지혜 · 탐구 · 신중함",
    question: "눈앞의 답을 의심하고 진실을 찾을 수 있는가?",
  },
  cheongryong: {
    id: "cheongryong",
    name: "청룡관",
    guardian: "청룡",
    colorName: "청록색과 옅은 금색",
    motto: "새 길을 열어, 함께 살아갈 터를 넓힌다.",
    values: "개척 · 포부 · 번영",
    question: "아직 없는 길을 열고 그 결과를 책임질 수 있는가?",
  },
};

export const HOUSE_IDS = Object.keys(HOUSES) as HouseId[];

export function isHouseId(v: unknown): v is HouseId {
  return typeof v === "string" && v in HOUSES;
}

/** 균등 랜덤 배정. `rand`는 테스트용 주입. */
export function randomHouse(rand: () => number = Math.random): HouseId {
  return HOUSE_IDS[
    Math.min(HOUSE_IDS.length - 1, Math.floor(rand() * HOUSE_IDS.length))
  ];
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
