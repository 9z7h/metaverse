import { describe, it, expect } from "vitest";
import {
  CAMERA_BOUNDS,
  planPath,
  BOARD_LIFT,
  withAlpha,
  boardLift,
  shortestYawTarget,
  YAW_FACING_DOOR,
  segmentClear,
  tapTarget,
  ORBIT_DEFAULT,
  ORBIT_LIMITS,
  cameraRelativeMove,
  cameraRig,
  clampOrbit,
  DESK_HALF,
  PLAYER_RADIUS,
  ROOM,
  deskLayout,
  nearestFreeSeat,
  resolveCollision,
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

describe("카메라 궤도", () => {
  it("기본값(yaw 0)은 대상 뒤(+z) 위에서 앞(-z)을 바라본다", () => {
    const { cam, look } = cameraRig({ x: 0, z: 0 }, ORBIT_DEFAULT, 7.6, 3);
    expect(cam[0]).toBeCloseTo(0);
    expect(cam[1]).toBeCloseTo(4.6, 1); // 기존 고정 카메라 높이와 같음
    expect(cam[2]).toBeCloseTo(6.05, 1); // cos(0.65)×7.6 — 기존 고정 카메라(z+6)와 5cm 차이
    expect(look[0]).toBeCloseTo(0);
    expect(look[1]).toBeCloseTo(0.9);
    expect(look[2]).toBeCloseTo(-3);
  });

  it("yaw 90°면 대상 오른쪽(+x)에서 왼쪽(-x)을 바라본다", () => {
    const { cam, look } = cameraRig(
      { x: 0, z: 0 },
      { ...ORBIT_DEFAULT, yaw: Math.PI / 2 },
      7.6,
      3,
    );
    expect(cam[0]).toBeGreaterThan(5);
    expect(cam[2]).toBeCloseTo(0);
    expect(look[0]).toBeCloseTo(-3);
  });

  it("줌 배율만큼 거리가 늘고, 각도·줌은 범위 안으로 제한", () => {
    const near = cameraRig(
      { x: 0, z: 0 },
      { ...ORBIT_DEFAULT, zoom: 0.5 },
      8,
      0,
    );
    const far = cameraRig({ x: 0, z: 0 }, { ...ORBIT_DEFAULT, zoom: 1 }, 8, 0);
    expect(Math.hypot(...far.cam)).toBeCloseTo(Math.hypot(...near.cam) * 2);
    const c = clampOrbit({ yaw: 5, pitch: 9, zoom: 0.01 });
    expect(c).toEqual({
      yaw: 5,
      pitch: ORBIT_LIMITS.pitchMax,
      zoom: ORBIT_LIMITS.zoomMin,
    });
  });
});

describe("카메라 충돌 — 벽 밖으로 나가지 않음", () => {
  const inside = ([x, y, z]: [number, number, number]) =>
    x >= CAMERA_BOUNDS.minX - 1e-9 &&
    x <= CAMERA_BOUNDS.maxX + 1e-9 &&
    z >= CAMERA_BOUNDS.minZ - 1e-9 &&
    z <= CAMERA_BOUNDS.maxZ + 1e-9 &&
    y <= CAMERA_BOUNDS.maxY + 1e-9;

  it("어느 방향으로 돌리고 최대로 줌아웃해도 카메라는 방 안", () => {
    for (const target of [
      { x: 0, z: ROOM.maxZ },
      { x: ROOM.minX, z: ROOM.minZ },
      { x: ROOM.maxX, z: 0 },
    ]) {
      for (let yaw = 0; yaw < Math.PI * 2; yaw += Math.PI / 8) {
        const { cam } = cameraRig(
          target,
          { yaw, pitch: ORBIT_LIMITS.pitchMax, zoom: ORBIT_LIMITS.zoomMax },
          7.6,
          3,
        );
        expect(inside(cam)).toBe(true);
      }
    }
  });

  it("입구 근처(z=6.4)에서도 기본 카메라는 밀리지 않는다 (입구 홀 덕분)", () => {
    const free = cameraRig({ x: 0, z: 6.4 }, ORBIT_DEFAULT, 7.6, 3);
    expect(free.cam[1]).toBeCloseTo(4.6, 1);
    expect(free.cam[2]).toBeCloseTo(6.4 + 6.05, 1);
  });
});

describe("cameraRelativeMove — 조이스틱 위 = 카메라가 보는 방향", () => {
  it("yaw 0: 위(y=-1)는 -z, 오른쪽(x=1)은 +x", () => {
    const up = cameraRelativeMove(0, -1, 0);
    expect(up.x).toBeCloseTo(0);
    expect(up.z).toBeCloseTo(-1);
    const right = cameraRelativeMove(1, 0, 0);
    expect(right.x).toBeCloseTo(1);
    expect(right.z).toBeCloseTo(0);
  });

  it("yaw 90°(카메라가 -x를 봄): 위는 -x", () => {
    const up = cameraRelativeMove(0, -1, Math.PI / 2);
    expect(up.x).toBeCloseTo(-1);
    expect(up.z).toBeCloseTo(0);
  });
});

describe("탭 이동 — tapTarget / planPath", () => {
  const free = new Set<string>();

  it("빈 책상 상판이나 그 의자를 탭하면 그 자리, 사용 중이면 바닥", () => {
    const b1 = deskLayout("B1");
    const far = { x: 0, z: 6 };
    expect(tapTarget(far, b1.desk, desks, free)).toEqual({
      kind: "seat",
      seat: b1,
    });
    expect(tapTarget(b1.chair, null, desks, free)).toEqual({
      kind: "seat",
      seat: b1,
    });
    const taken = tapTarget(b1.chair, b1.desk, desks, new Set(["B1"]));
    expect(taken.kind).toBe("floor");
  });

  it("[버그 재현] 상판을 탭하면 바닥 높이 교차점은 책상 1~2m 뒤 — 상판 높이 교차점으로 판정해야 앉는다", () => {
    const c1 = deskLayout("C1");
    // 실측: 시작 카메라에서 C-1 상판 중심을 탭 → 바닥 교차점 (-3.13, 1.07)
    const atFloor = { x: -3.13, z: 1.07 };
    expect(tapTarget(atFloor, null, desks, free).kind).toBe("floor");
    expect(tapTarget(atFloor, c1.desk, desks, free)).toEqual({
      kind: "seat",
      seat: c1,
    });
  });

  it("바닥 탭은 갈 수 있는 위치로 보정 (방 밖 → 벽 안쪽)", () => {
    const t = tapTarget({ x: 50, z: 0 }, null, desks, free);
    expect(t).toEqual({ kind: "floor", point: { x: ROOM.maxX, z: 0 } });
  });

  it("막힘 없으면 곧장 목표로", () => {
    expect(planPath({ x: 0, z: 6 }, { x: 0, z: -5 }, desks)).toEqual([
      { x: 0, z: -5 },
    ]);
  });

  it("책상 너머(A1 의자 → A1 뒤쪽)는 책상을 돌아가고, 모든 구간이 책상과 겹치지 않는다", () => {
    const from = deskLayout("A1").chair;
    const to = { x: -2.6, z: -5.8 };
    expect(segmentClear(from, to, desks)).toBe(false);
    const path = planPath(from, to, desks);
    expect(path.length).toBeGreaterThan(1);
    expect(path.at(-1)).toEqual(to);
    let cur = from;
    for (const p of path) {
      expect(segmentClear(cur, p, desks)).toBe(true);
      cur = p;
    }
  });

  it("C열 옆 벽 쪽에서 반대편 벽 쪽 B열 뒤로 — 어디서든 길을 찾는다", () => {
    const from = { x: 5.2, z: 3 };
    const to = { x: -5.2, z: -1.6 };
    const path = planPath(from, to, desks);
    let cur = from;
    for (const p of path) {
      expect(segmentClear(cur, p, desks)).toBe(true);
      cur = p;
    }
    expect(cur).toEqual(to);
  });
});

describe("shortestYawTarget — 순위판 쪽으로 가장 짧게 돌기", () => {
  it("정면(0)에서 입구(π)로는 π만큼 (어느 쪽이든 절댓값 π)", () => {
    expect(Math.abs(shortestYawTarget(0, YAW_FACING_DOOR))).toBeCloseTo(
      Math.PI,
    );
  });

  it("이미 여러 바퀴 돌아간 yaw에서도 한 바퀴를 되돌지 않는다", () => {
    const yaw = 7 * Math.PI + 0.2; // 3바퀴 반 + 0.2
    const t = shortestYawTarget(yaw, YAW_FACING_DOOR);
    expect(Math.abs(t - yaw)).toBeLessThanOrEqual(Math.PI + 1e-9);
    // 도착 방향은 정확히 입구 쪽
    expect(Math.cos(t)).toBeCloseTo(Math.cos(YAW_FACING_DOOR));
    expect(Math.sin(t)).toBeCloseTo(Math.sin(YAW_FACING_DOOR));
  });

  it("이미 입구를 보고 있으면 움직이지 않는다", () => {
    expect(shortestYawTarget(YAW_FACING_DOOR, YAW_FACING_DOOR)).toBeCloseTo(
      YAW_FACING_DOOR,
    );
  });
});

describe("boardLift — 문 쪽을 볼 때 시선을 들어 올림", () => {
  it("문을 정면으로 보면 최대, 등지면 0", () => {
    expect(boardLift(YAW_FACING_DOOR)).toBeCloseTo(BOARD_LIFT);
    expect(boardLift(0)).toBe(0);
  });

  it("옆을 볼 때(yaw ±90°)는 0 — 시야가 갑자기 튀지 않는다", () => {
    expect(boardLift(Math.PI / 2)).toBeCloseTo(0);
    expect(boardLift(-Math.PI / 2)).toBeCloseTo(0);
  });

  it("문에 가까워질수록 커진다 (단조 증가)", () => {
    const a = boardLift(Math.PI * 0.6);
    const b = boardLift(Math.PI * 0.8);
    const c = boardLift(Math.PI);
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
  });

  it("몇 바퀴를 돌았든 같은 방향이면 같은 값", () => {
    expect(boardLift(YAW_FACING_DOOR + 6 * Math.PI)).toBeCloseTo(BOARD_LIFT);
  });

  it("cameraRig는 lookLift만큼 시선 높이만 올린다 (카메라 위치는 그대로)", () => {
    const base = cameraRig(
      { x: 0, z: 6 },
      { yaw: Math.PI, pitch: 0.25, zoom: 0.5 },
      7.6,
      3,
    );
    const lifted = cameraRig(
      { x: 0, z: 6 },
      { yaw: Math.PI, pitch: 0.25, zoom: 0.5 },
      7.6,
      3,
      2.4,
    );
    expect(lifted.cam).toEqual(base.cam);
    expect(lifted.look[1]).toBeCloseTo(base.look[1] + 2.4);
    expect(lifted.look[2]).toBeCloseTo(base.look[2]);
  });
});

describe("withAlpha — 토큰 색 + 투명도", () => {
  it("#rrggbb를 rgba 문자열로", () => {
    expect(withAlpha("#ffffff", 0.5)).toBe("rgba(255, 255, 255, 0.5)");
    expect(withAlpha("#16100d", 1)).toBe("rgba(22, 16, 13, 1)");
    expect(withAlpha(" #FFD98A ", 0)).toBe("rgba(255, 217, 138, 0)");
  });

  it("hex가 아니면 그대로 돌려준다", () => {
    expect(withAlpha("rebeccapurple", 0.3)).toBe("rebeccapurple");
    expect(withAlpha("", 0.3)).toBe("");
  });
});
