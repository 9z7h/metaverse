import { describe, it, expect } from "vitest";
import {
  CAMERA_BOUNDS,
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
