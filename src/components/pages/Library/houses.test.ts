import { afterEach, describe, it, expect } from "vitest";
import {
  HOUSE_IDS,
  clearHouse,
  isHouseId,
  loadHouse,
  randomHouse,
  saveHouse,
} from "./houses";

afterEach(() => clearHouse());

describe("randomHouse", () => {
  it("[0,1) 구간을 4등분해 각 기숙사에 균등 배정", () => {
    expect(randomHouse(() => 0)).toBe(HOUSE_IDS[0]);
    expect(randomHouse(() => 0.26)).toBe(HOUSE_IDS[1]);
    expect(randomHouse(() => 0.51)).toBe(HOUSE_IDS[2]);
    expect(randomHouse(() => 0.9999)).toBe(HOUSE_IDS[3]);
  });

  it("rand가 1을 반환해도 범위를 넘지 않는다", () => {
    expect(randomHouse(() => 1)).toBe(HOUSE_IDS[3]);
  });

  it("기숙사는 빨강·파랑·노랑·초록 4개", () => {
    expect(HOUSE_IDS).toEqual(["ember", "azure", "gold", "verdant"]);
  });
});

describe("저장 — 한 번 배정되면 유지", () => {
  it("저장 전에는 null, 저장 후엔 같은 값", () => {
    expect(loadHouse()).toBeNull();
    saveHouse("azure");
    expect(loadHouse()).toBe("azure");
  });

  it("저장소에 이상한 값이 있으면 무시", () => {
    window.localStorage.setItem("hanul-academy:house", "unknown-house");
    expect(loadHouse()).toBeNull();
    expect(isHouseId("unknown-house")).toBe(false);
  });
});
