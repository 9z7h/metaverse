/**
 * 한울 마법학당 기숙사 — 한국 전통 상징(사신, 십장생)에서 가져온 오리지널 설정.
 * 색 토큰은 `--color-house-<id>-{primary|accent|subtle|on}` (tokens/themes/library.json).
 */

export type HouseId = "ember" | "azure" | "gold" | "verdant";
export type HousePart = "primary" | "accent" | "subtle" | "on";

export interface House {
  id: HouseId;
  /** 기숙사 이름 */
  name: string;
  /** 상징 */
  creature: string;
  /** 색 이름 (스크린리더·설명용) */
  colorName: string;
  /** 한 줄 성향 */
  trait: string;
  /** 배정 화면 환영 문구 */
  welcome: string;
}

export const HOUSES: Record<HouseId, House> = {
  ember: {
    id: "ember",
    name: "주작당",
    creature: "주작",
    colorName: "빨강",
    trait: "불꽃처럼 몰입하는 열정",
    welcome: "한번 타오르면 끝을 보는 이들이 모이는 곳입니다.",
  },
  azure: {
    id: "azure",
    name: "청룡당",
    creature: "청룡",
    colorName: "파랑",
    trait: "깊은 물처럼 파고드는 탐구",
    welcome: "질문을 끝까지 따라가는 이들이 모이는 곳입니다.",
  },
  gold: {
    id: "gold",
    name: "해태당",
    creature: "해태",
    colorName: "노랑",
    trait: "서로를 지켜주는 든든함",
    welcome: "옆자리 동료를 먼저 챙기는 이들이 모이는 곳입니다.",
  },
  verdant: {
    id: "verdant",
    name: "장생당",
    creature: "거북",
    colorName: "초록",
    trait: "느려도 끝까지 가는 끈기",
    welcome: "하루하루 쌓아 멀리 가는 이들이 모이는 곳입니다.",
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
