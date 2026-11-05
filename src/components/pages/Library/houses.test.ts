import { afterEach, describe, it, expect } from "vitest";
import {
  HOUSE_IDS,
  clearHouse,
  isHouseId,
  loadHouse,
  saveHouse,
} from "./houses";

afterEach(() => clearHouse());

describe("기숙사 목록", () => {
  it("기숙사는 사신수 4개 — 백호·주작·현무·청룡", () => {
    expect(HOUSE_IDS).toEqual(["baekho", "jujak", "hyeonmu", "cheongryong"]);
  });
});

describe("저장 — 한 번 배정되면 유지", () => {
  it("저장 전에는 null, 저장 후엔 같은 값", () => {
    expect(loadHouse()).toBeNull();
    saveHouse("hyeonmu");
    expect(loadHouse()).toBe("hyeonmu");
  });

  it("저장소에 이상한 값이 있으면 무시", () => {
    window.localStorage.setItem("hanul-academy:house", "unknown-house");
    expect(loadHouse()).toBeNull();
    expect(isHouseId("unknown-house")).toBe(false);
  });

  it("이전 설정(주작당·해태당 등)의 id는 새로 배정되도록 무시", () => {
    for (const old of ["ember", "azure", "gold", "verdant"]) {
      window.localStorage.setItem("hanul-academy:house", old);
      expect(loadHouse()).toBeNull();
    }
  });
});
