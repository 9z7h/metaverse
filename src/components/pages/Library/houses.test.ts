import { afterEach, describe, it, expect } from "vitest";
import {
  HOUSE_IDS,
  canReroll,
  clearHouse,
  clearRerollDay,
  loadRerollDay,
  saveRerollDay,
  isHouseId,
  loadHouse,
  saveHouse,
} from "./houses";

afterEach(() => {
  clearHouse();
  clearRerollDay();
});

describe("다시 배정 — 하루 1번", () => {
  it("한 번도 안 했거나 어제 했으면 가능, 오늘 했으면 불가", () => {
    expect(canReroll(null, "2026-11-05")).toBe(true);
    expect(canReroll("2026-11-04", "2026-11-05")).toBe(true);
    expect(canReroll("2026-11-05", "2026-11-05")).toBe(false);
  });

  it("마지막으로 한 날을 저장하고 읽는다", () => {
    expect(loadRerollDay()).toBeNull();
    saveRerollDay("2026-11-05");
    expect(loadRerollDay()).toBe("2026-11-05");
  });
});

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
