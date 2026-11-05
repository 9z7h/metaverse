import { describe, it, expect } from "vitest";
import {
  FLAG_MAX,
  FLAG_MIN,
  addMine,
  flagLength,
  balancedHouse,
  formatTotal,
  houseHeadcounts,
  rankHouses,
  zeroHouseSeconds,
} from "./houseRanking";
import { HOUSE_IDS } from "./houses";
import type { HouseId } from "./houses";

describe("balancedHouse — 인원 균등 배정", () => {
  it("인원이 가장 적은 기숙사에서만 뽑는다", () => {
    const counts = { baekho: 3, jujak: 1, hyeonmu: 2, cheongryong: 2 };
    for (const r of [0, 0.3, 0.7, 0.999]) {
      expect(balancedHouse(counts, () => r)).toBe("jujak");
    }
  });

  it("동률이면 그 후보들 안에서 무작위", () => {
    const counts = { baekho: 1, jujak: 2, hyeonmu: 1, cheongryong: 1 };
    const picks = new Set(
      [0, 0.4, 0.7, 0.999].map((r) => balancedHouse(counts, () => r)),
    );
    expect(picks).toEqual(new Set(["baekho", "hyeonmu", "cheongryong"]));
  });

  it("rand가 1을 반환해도 범위를 넘지 않는다", () => {
    expect(balancedHouse(zeroHouseSeconds(), () => 1)).toBe(HOUSE_IDS.at(-1));
  });

  it("100명을 차례로 배정하면 기숙사 인원 차이는 항상 1명 이내 (무작위 시드가 어떻든)", () => {
    for (let seed = 1; seed <= 20; seed++) {
      let s = seed;
      const rand = () => {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
      };
      const roster: HouseId[] = [];
      for (let n = 0; n < 100; n++) {
        roster.push(balancedHouse(houseHeadcounts(roster), rand));
        const c = Object.values(houseHeadcounts(roster));
        expect(Math.max(...c) - Math.min(...c)).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("rankHouses — 합계 순위", () => {
  it("시간 많은 순으로 정렬하고 순위를 매긴다", () => {
    const r = rankHouses({
      baekho: 600,
      jujak: 3600,
      hyeonmu: 1800,
      cheongryong: 60,
    });
    expect(r.map((e) => [e.house, e.rank])).toEqual([
      ["jujak", 1],
      ["hyeonmu", 2],
      ["baekho", 3],
      ["cheongryong", 4],
    ]);
  });

  it("동점은 같은 순위, 다음은 건너뜀 (1, 1, 3, 4)", () => {
    const r = rankHouses({
      baekho: 100,
      jujak: 100,
      hyeonmu: 50,
      cheongryong: 10,
    });
    expect(r.map((e) => e.rank)).toEqual([1, 1, 3, 4]);
  });

  it("전원 0이면 모두 1위", () => {
    expect(rankHouses(zeroHouseSeconds()).map((e) => e.rank)).toEqual([
      1, 1, 1, 1,
    ]);
  });
});

describe("addMine", () => {
  it("내 시간은 내 기숙사에만 더해지고, 기숙사가 없으면 그대로", () => {
    const base = { baekho: 10, jujak: 20, hyeonmu: 30, cheongryong: 40 };
    expect(addMine(base, "hyeonmu", 5).hyeonmu).toBe(35);
    expect(addMine(base, "hyeonmu", 5).jujak).toBe(20);
    expect(addMine(base, null, 999)).toBe(base);
  });
});

describe("formatTotal", () => {
  it("분/시간 표기", () => {
    expect(formatTotal(0)).toBe("0분");
    expect(formatTotal(59)).toBe("0분");
    expect(formatTotal(540)).toBe("9분");
    expect(formatTotal(3600)).toBe("1시간");
    expect(formatTotal(3725)).toBe("1시간 2분");
  });
});

describe("flagLength — 순위판 깃발 길이", () => {
  it("1위는 최대, 0분은 최소, 중간은 비례", () => {
    expect(flagLength(7200, 7200)).toBeCloseTo(FLAG_MAX);
    expect(flagLength(0, 7200)).toBeCloseTo(FLAG_MIN);
    expect(flagLength(3600, 7200)).toBeCloseTo((FLAG_MIN + FLAG_MAX) / 2);
  });

  it("전원 0분이면 모두 최소 길이 (0으로 나누지 않는다)", () => {
    expect(flagLength(0, 0)).toBe(FLAG_MIN);
  });

  it("범위를 넘는 입력은 최소~최대로 제한", () => {
    expect(flagLength(99999, 100)).toBeCloseTo(FLAG_MAX);
    expect(flagLength(-5, 100)).toBeCloseTo(FLAG_MIN);
  });
});
