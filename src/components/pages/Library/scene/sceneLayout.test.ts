import { describe, it, expect } from "vitest";
import {
  DESK_HALF,
  PLAYER_RADIUS,
  ROOM,
  deskLayout,
  nearestFreeSeat,
  resolveCollision,
  robeToken,
} from "./sceneLayout";

const desks = ["A1", "A2", "B1", "B2", "C1", "C2"].map(deskLayout);

describe("deskLayout", () => {
  it("행(A/B/C)은 z, 열(1/2)은 x로 배치되고 의자는 책상 앞(+z)", () => {
    const a1 = deskLayout("A1");
    const c2 = deskLayout("C2");
    expect(a1.desk.x).toBeLessThan(0);
    expect(c2.desk.x).toBeGreaterThan(0);
    expect(a1.desk.z).toBeLessThan(c2.desk.z);
    expect(a1.chair.z).toBeGreaterThan(a1.desk.z);
  });
});

describe("resolveCollision", () => {
  it("방 밖으로 나가지 못한다", () => {
    expect(resolveCollision({ x: 99, z: -99 }, desks)).toEqual({
      x: ROOM.maxX,
      z: ROOM.minZ,
    });
  });

  it("책상 안으로 들어가면 가장 얕은 축으로 밀려난다", () => {
    const { desk } = deskLayout("B1");
    // 책상 앞쪽 가장자리를 살짝 파고든 위치 → z축으로 밀려남
    const out = resolveCollision(
      { x: desk.x, z: desk.z + DESK_HALF.z + PLAYER_RADIUS - 0.05 },
      desks,
    );
    expect(out.x).toBe(desk.x);
    expect(out.z).toBeCloseTo(desk.z + DESK_HALF.z + PLAYER_RADIUS);
  });

  it("중앙 통로(x=0)는 막히지 않는다", () => {
    expect(resolveCollision({ x: 0, z: -0.5 }, desks)).toEqual({
      x: 0,
      z: -0.5,
    });
  });
});

describe("nearestFreeSeat", () => {
  it("가까운 빈 의자를 찾고, 사용 중인 좌석은 건너뛴다", () => {
    const c1 = deskLayout("C1");
    expect(nearestFreeSeat(c1.chair, desks, new Set())?.seatId).toBe("C1");
    expect(nearestFreeSeat(c1.chair, desks, new Set(["C1"]))).toBeNull();
  });

  it("멀리 있으면 null", () => {
    expect(nearestFreeSeat({ x: 0, z: 7 }, desks, new Set())).toBeNull();
  });
});

describe("robeToken", () => {
  it("같은 id는 항상 같은 색 토큰", () => {
    expect(robeToken("s1")).toBe(robeToken("s1"));
    expect(robeToken("s1")).toMatch(/^--color-scene-robe-[1-4]$/);
  });
});
