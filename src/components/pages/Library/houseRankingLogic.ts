/**
 * 사신제 — 기숙사별 오늘 집중 시간 합계·순위, 그리고 기숙사 인원 균등 배정.
 * 화면과 분리된 순수 함수 (단위 테스트 대상).
 */
import { HOUSE_IDS } from "./houses";
import type { HouseId } from "./houses";

export type HouseSeconds = Record<HouseId, number>;

export function zeroHouseSeconds(): HouseSeconds {
  return Object.fromEntries(HOUSE_IDS.map((h) => [h, 0])) as HouseSeconds;
}

/** 학생들의 기숙사 목록 → 기숙사별 인원 */
export function houseHeadcounts(houses: HouseId[]): Record<HouseId, number> {
  const counts = zeroHouseSeconds();
  for (const h of houses) counts[h] += 1;
  return counts;
}

/**
 * 인원이 가장 적은 기숙사 중에서 무작위로 배정한다.
 * 그냥 무작위로 뽑으면 우연히 한쪽으로 쏠려 합계 순위가 불공정해지므로,
 * 하루 동안 기숙사 인원 차이가 1명 이내로 유지되게 한다.
 * `rand`는 테스트용 주입.
 */
export function balancedHouse(
  counts: Record<HouseId, number>,
  rand: () => number = Math.random,
  /** 다시 배정할 때 지금 기숙사를 후보에서 뺀다 — 같은 곳이 또 나와 기회를 날리지 않도록 */
  exclude?: HouseId,
): HouseId {
  const pool = HOUSE_IDS.filter((h) => h !== exclude);
  const min = Math.min(...pool.map((h) => counts[h]));
  const candidates = pool.filter((h) => counts[h] === min);
  // rand는 [0,1) 균등 → 후보 수로 환산
  const i = Math.min(
    candidates.length - 1,
    Math.floor(rand() * candidates.length),
  );
  return candidates[i];
}

export interface RankEntry {
  house: HouseId;
  seconds: number;
  /** 동점이면 같은 순위 (1, 1, 3, 4) */
  rank: number;
}

/** 기숙사별 합계 → 시간 많은 순 정렬 + 순위 (동점은 같은 순위, 같은 시간이면 기숙사 순서 고정) */
export function rankHouses(totals: HouseSeconds): RankEntry[] {
  const sorted = [...HOUSE_IDS].sort(
    (a, b) =>
      totals[b] - totals[a] || HOUSE_IDS.indexOf(a) - HOUSE_IDS.indexOf(b),
  );
  const out: RankEntry[] = [];
  sorted.forEach((house, i) => {
    const seconds = Math.floor(totals[house]);
    const rank =
      i > 0 && seconds === out[i - 1].seconds ? out[i - 1].rank : i + 1;
    out.push({ house, seconds, rank });
  });
  return out;
}

/** 벽 순위판 깃발의 최소·최대 길이(m) */
export const FLAG_MIN = 1.2;
export const FLAG_MAX = 1.9;

/**
 * 깃발 길이 — 1위(가장 긴 시간)가 FLAG_MAX, 0분이면 FLAG_MIN.
 * 시간 차이가 길이로 한눈에 보이되, 꼴찌도 글자가 들어갈 최소 길이는 유지한다.
 */
export function flagLength(seconds: number, maxSeconds: number): number {
  if (maxSeconds <= 0) return FLAG_MIN;
  const ratio = Math.min(1, Math.max(0, seconds / maxSeconds));
  return FLAG_MIN + (FLAG_MAX - FLAG_MIN) * ratio;
}

/** 다른 학생 합계에 내 오늘 누적을 내 기숙사로 더한다 */
export function addMine(
  others: HouseSeconds,
  myHouse: HouseId | null,
  mySeconds: number,
): HouseSeconds {
  if (!myHouse) return others;
  return { ...others, [myHouse]: others[myHouse] + mySeconds };
}

/** 3725초 → "1시간 2분", 540초 → "9분", 0초 → "0분" */
export function formatTotal(seconds: number): string {
  const m = Math.floor(Math.max(0, seconds) / 60);
  const h = Math.floor(m / 60);
  if (h === 0) return `${m}분`;
  return m % 60 === 0 ? `${h}시간` : `${h}시간 ${m % 60}분`;
}
