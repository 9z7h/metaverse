import { describe, it, expect, vi, afterEach } from "vitest";
import {
  TABLE_GAP,
  type DeskLayout,
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
  PLAYER_RADIUS,
  DOOR,
  HALL,
  OBSTACLES,
  ROOM,
  SEATS_PER_SIDE,
  SEAT_PITCH,
  SEAT_Z0,
  TABLES,
  TABLE_CANDLES,
  deskLayout,
  nearestFreeSeat,
  resolveCollision,
  BEAM_Z,
  FRONT_WALL_Z,
  SIDE_SHELF_PITCH,
  SIDE_SHELF_Z,
  boardCameraRig,
  BOARD_EXTENT,
  BOARD_VIEW_DIST,
  CAMERA_FOV,
  nearExit,
  EXIT_ZONE,
  PLAYER_SPAWN,
} from "./sceneLayout";
import { SEATS } from "../libraryPresence";

const desks = SEATS.map((s) => deskLayout(s.id));
/** 이 좌석 앞의 테이블 토막 — 같은 줄에서 좌석 z를 품은 것 */
const tableOf = (d: DeskLayout) =>
  TABLES.find(
    (t) =>
      t.x === TABLES[d.seatId[0] === "R" ? 1 : 0].x &&
      Math.abs(d.chair.z - t.z) < t.hz,
  )!;

describe("deskLayout — 긴 테이블 양면 좌석", () => {
  it("L은 왼쪽, R은 오른쪽 테이블이고 1~16은 통로 쪽, 17~32는 벽 쪽 면", () => {
    expect(deskLayout("L1").chair.x).toBeGreaterThan(TABLES[0].x); // 왼쪽 테이블의 통로 쪽
    expect(deskLayout("L17").chair.x).toBeLessThan(TABLES[0].x); // 벽 쪽
    expect(deskLayout("R1").chair.x).toBeLessThan(TABLES[1].x);
    expect(deskLayout("R17").chair.x).toBeGreaterThan(TABLES[1].x);
    // 같은 번호의 반대 면은 같은 z에서 마주 본다
    expect(deskLayout("L1").chair.z).toBe(deskLayout("L17").chair.z);
  });

  it("좌석은 안쪽(뒷벽)에서 입구 쪽으로 SEAT_PITCH 간격", () => {
    expect(deskLayout("L1").chair.z).toBeCloseTo(SEAT_Z0);
    expect(deskLayout("L2").chair.z).toBeCloseTo(SEAT_Z0 + SEAT_PITCH);
    expect(deskLayout("R16").chair.z).toBeCloseTo(
      SEAT_Z0 + (SEATS_PER_SIDE - 1) * SEAT_PITCH,
    );
  });

  it("아바타는 항상 테이블 쪽을 바라본다 (정면 (sin, cos)가 테이블 중심을 향함)", () => {
    for (const d of desks) {
      const t = tableOf(d);
      const toward = Math.sign(t.x - d.chair.x);
      expect(Math.sign(Math.sin(d.facing))).toBe(toward);
      // 정면으로 한 발 나가면 테이블 쪽으로 가까워진다
      const ahead = d.chair.x + Math.sin(d.facing) * 0.5;
      expect(Math.abs(ahead - t.x)).toBeLessThan(Math.abs(d.chair.x - t.x));
    }
  });

  it("마주 앉은 두 면은 서로 반대 방향을 본다", () => {
    expect(
      Math.sin(deskLayout("L1").facing) + Math.sin(deskLayout("L17").facing),
    ).toBeCloseTo(0);
    expect(
      Math.sin(deskLayout("R1").facing) + Math.sin(deskLayout("R17").facing),
    ).toBeCloseTo(0);
  });

  it("테이블 위 자리(desk)는 상판 위, 일어설 자리(stand)는 의자 뒤쪽 통로", () => {
    for (const d of desks) {
      const t = tableOf(d);
      expect(Math.abs(d.desk.x - t.x)).toBeLessThanOrEqual(t.hx);
      expect(Math.abs(d.desk.z - t.z)).toBeLessThanOrEqual(t.hz);
      // stand는 테이블 반대쪽으로 의자보다 더 멀다
      expect(Math.abs(d.stand.x - t.x)).toBeGreaterThan(
        Math.abs(d.chair.x - t.x),
      );
      expect(d.stand.z).toBe(d.chair.z);
      expect(resolveCollision(d.stand)).toEqual(d.stand);
    }
  });
});

describe("64석 배치", () => {
  it("좌석 목록은 64석이고 id가 서로 다르다", () => {
    expect(SEATS).toHaveLength(64);
    expect(new Set(SEATS.map((s) => s.id)).size).toBe(64);
  });

  it("모든 좌석이 고유한 의자 위치를 갖는다", () => {
    const keys = desks.map((d) => `${d.chair.x},${d.chair.z}`);
    expect(new Set(keys).size).toBe(64);
  });

  it("의자는 모두 방 안, 테이블 길이 범위 안에 있다", () => {
    for (const d of desks) {
      const t = tableOf(d);
      expect(d.chair.x).toBeGreaterThan(ROOM.minX);
      expect(d.chair.x).toBeLessThan(ROOM.maxX);
      expect(Math.abs(d.chair.z - t.z)).toBeLessThan(t.hz);
    }
  });

  it("의자는 걸어서 닿을 수 있는 자리다 (충돌에 밀려나지 않음)", () => {
    for (const d of desks) expect(resolveCollision(d.chair)).toEqual(d.chair);
  });

  it("가운데 통로는 넓게 뚫려 있다 (양쪽 통로 쪽 의자 사이 ≥ 3m)", () => {
    const inner = desks.filter(
      (d) => Number(d.seatId.slice(1)) <= SEATS_PER_SIDE,
    );
    const left = Math.max(
      ...inner.filter((d) => d.seatId[0] === "L").map((d) => d.chair.x),
    );
    const right = Math.min(
      ...inner.filter((d) => d.seatId[0] === "R").map((d) => d.chair.x),
    );
    expect(right - left).toBeGreaterThanOrEqual(3);
    // 그 사이 한가운데는 입구에서 안쪽까지 곧장 걸어갈 수 있다
    expect(segmentClear({ x: 0, z: DOOR.z }, { x: 0, z: ROOM.minZ })).toBe(
      true,
    );
  });

  it("테이블은 가운데 통로·벽 쪽 통로와 서로 겹치지 않고 방 안에 있다", () => {
    for (const t of TABLES) {
      expect(Math.abs(t.x) - t.hx).toBeGreaterThan(2.1); // 통로 폭 확보
      expect(Math.abs(t.x) + t.hx).toBeLessThan(ROOM.maxX - 2);
      expect(t.z - t.hz).toBeGreaterThanOrEqual(ROOM.minZ);
      expect(t.z + t.hz).toBeLessThan(DOOR.z);
    }
  });

  it("입구에서 모든 의자까지 막힘 없는 길이 있다 (벽 쪽 의자는 테이블 끝을 돌아서)", () => {
    for (const d of desks) {
      const path = planPath(DOOR, d.chair);
      let cur = DOOR;
      for (const p of path) {
        expect(segmentClear(cur, p)).toBe(true);
        cur = p;
      }
      expect(cur).toEqual(d.chair);
    }
  });

  it("벽 쪽 의자까지의 길은 테이블을 가로지르지 않고 돌아간다 (경유점이 늘어남)", () => {
    const outer = deskLayout("L17");
    expect(planPath(DOOR, outer.chair).length).toBeGreaterThan(1);
  });
});

describe("테이블 위 등잔", () => {
  it("좌석 사이마다 하나, 모두 상판 위(테이블 한가운데)에 있다", () => {
    expect(TABLE_CANDLES).toHaveLength(2 * (SEATS_PER_SIDE - 2)); // 가운데 통로 자리는 뺌
    for (const c of TABLE_CANDLES) {
      expect(
        TABLES.some((t) => t.x === c.x && Math.abs(c.z - t.z) < t.hz),
      ).toBe(true);
    }
  });
});

describe("고정 장식(혼천의) 장애물", () => {
  const o = OBSTACLES[0];

  it("장애물 안으로 들어가면 바깥으로 밀려난다", () => {
    const out = resolveCollision({ x: o.x + 0.2, z: o.z });
    expect(Math.hypot(out.x - o.x, out.z - o.z)).toBeGreaterThanOrEqual(
      o.r + PLAYER_RADIUS - 1e-9,
    );
  });

  it("정확히 중심이어도 밀려난다 (0으로 나누지 않음)", () => {
    const out = resolveCollision({ x: o.x, z: o.z });
    expect(Number.isFinite(out.x) && Number.isFinite(out.z)).toBe(true);
    expect(Math.hypot(out.x - o.x, out.z - o.z)).toBeGreaterThan(o.r);
  });

  it("직선이 장애물을 통과하면 막힌 것으로 보고 돌아간다", () => {
    const from = { x: o.x - 3, z: o.z };
    const to = { x: o.x + 1.2, z: o.z };
    expect(segmentClear(from, to)).toBe(false);
    const path = planPath(from, to);
    expect(path.length).toBeGreaterThan(1);
    let cur = from;
    for (const p of path) {
      expect(segmentClear(cur, p)).toBe(true);
      cur = p;
    }
  });

  it("방 안, 테이블과 겹치지 않는 자리에 있다", () => {
    expect(o.x).toBeLessThan(ROOM.maxX);
    expect(o.z).toBeGreaterThan(ROOM.minZ);
    for (const t of TABLES) {
      const dx = Math.max(Math.abs(o.x - t.x) - t.hx, 0);
      const dz = Math.max(Math.abs(o.z - t.z) - t.hz, 0);
      expect(Math.hypot(dx, dz)).toBeGreaterThan(o.r);
    }
  });
});

describe("한옥 서고의 수직 구성", () => {
  it("회랑 < 윗단 서가 < 천장 순서이고, 카메라는 천장 아래에 머문다", () => {
    expect(HALL.galleryY).toBeLessThan(HALL.upperShelfY);
    expect(HALL.upperShelfY).toBeLessThan(HALL.wallH);
    expect(CAMERA_BOUNDS.maxY).toBeLessThan(HALL.wallH);
  });
});

describe("resolveCollision", () => {
  it("방 밖으로 나가지 못한다", () => {
    expect(resolveCollision({ x: 99, z: -99 })).toEqual({
      x: ROOM.maxX,
      z: ROOM.minZ,
    });
  });

  it("테이블 안으로 들어가면 가장 얕은 축으로 밀려난다", () => {
    const t = TABLES[0];
    // 테이블 통로 쪽 가장자리를 살짝 파고든 위치 → x축으로 밀려남
    const out = resolveCollision({
      x: t.x + t.hx + PLAYER_RADIUS - 0.05,
      z: t.z,
    });
    expect(out.z).toBe(t.z);
    expect(out.x).toBeCloseTo(t.x + t.hx + PLAYER_RADIUS);
  });

  it("테이블 위를 가로질러 걸을 수 없다", () => {
    const t = TABLES[1];
    expect(segmentClear({ x: 0, z: t.z }, { x: t.x + 3, z: t.z })).toBe(false);
  });

  it("중앙 통로(x=0)는 막히지 않는다", () => {
    expect(resolveCollision({ x: 0, z: -0.5 })).toEqual({ x: 0, z: -0.5 });
  });
});

describe("nearestFreeSeat", () => {
  it("가까운 빈 의자를 찾고, 사용 중인 좌석은 건너뛴다", () => {
    const l3 = deskLayout("L3");
    expect(nearestFreeSeat(l3.chair, desks, new Set())?.seatId).toBe("L3");
    // L3 바로 맞은편(L19)은 테이블 폭 너머라 SIT_DISTANCE(1.5m) 밖
    expect(nearestFreeSeat(l3.chair, desks, new Set(["L3"]))?.seatId).not.toBe(
      "L19",
    );
  });

  it("멀리 있으면 null", () => {
    expect(nearestFreeSeat({ x: 0, z: 9 }, desks, new Set())).toBeNull();
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

  it("빈 의자를 탭하면 그 자리, 사용 중이면 바닥", () => {
    const l3 = deskLayout("L3");
    expect(tapTarget(l3.chair, null, desks, free)).toEqual({
      kind: "seat",
      seat: l3,
    });
    const taken = tapTarget(l3.chair, null, desks, new Set(["L3"]));
    expect(taken.kind).toBe("floor");
  });

  it("테이블 상판을 탭하면 탭한 쪽에서 가장 가까운 빈 좌석에 앉는다", () => {
    const l3 = deskLayout("L3");
    const l11 = deskLayout("L19"); // L3의 맞은편(벽 쪽 면, L19)
    const far = { x: 0, z: 9 };
    // 통로 쪽 면을 탭하면 L3, 벽 쪽 면을 탭하면 L11
    expect(tapTarget(far, l3.desk, desks, free)).toEqual({
      kind: "seat",
      seat: l3,
    });
    expect(tapTarget(far, l11.desk, desks, free)).toEqual({
      kind: "seat",
      seat: l11,
    });
  });

  it("가까운 좌석이 이미 찼으면 상판을 탭해도 앉지 않고 바닥 처리", () => {
    const l3 = deskLayout("L3");
    const everyoneNear = new Set(
      desks
        .filter((d) => Math.abs(d.desk.z - l3.desk.z) < 1.4)
        .map((d) => d.seatId),
    );
    const t = tapTarget({ x: 0, z: 9 }, l3.desk, desks, everyoneNear);
    expect(t.kind).toBe("floor");
  });

  it("[버그 재현] 상판을 탭하면 바닥 높이 교차점은 테이블 1~2m 뒤 — 상판 높이 교차점으로 판정해야 앉는다", () => {
    const r5 = deskLayout("R5");
    // 상판을 탭하면 바닥 높이 교차점은 테이블보다 안쪽(−z) 1~2m 뒤 바닥이 된다
    const atFloor = { x: r5.desk.x, z: r5.desk.z - 1.6 };
    expect(tapTarget(atFloor, null, desks, free).kind).toBe("floor");
    expect(tapTarget(atFloor, r5.desk, desks, free)).toEqual({
      kind: "seat",
      seat: r5,
    });
  });

  it("바닥 탭은 갈 수 있는 위치로 보정 (방 밖 → 벽 안쪽)", () => {
    const t = tapTarget({ x: 50, z: 0 }, null, desks, free);
    expect(t).toEqual({ kind: "floor", point: { x: ROOM.maxX, z: 0 } });
  });

  it("막힘 없으면 곧장 목표로 (가운데 통로)", () => {
    expect(planPath({ x: 0, z: 9 }, { x: 0, z: -5 })).toEqual([
      { x: 0, z: -5 },
    ]);
  });

  it("테이블 너머로 가려면 테이블 끝을 돌아가고, 모든 구간이 막히지 않는다", () => {
    const from = { x: 0, z: -2 };
    const to = { x: TABLES[1].x + 2.5, z: -2 }; // 오른쪽 테이블 건너편(벽 쪽)
    expect(segmentClear(from, to)).toBe(false);
    const path = planPath(from, to);
    expect(path.length).toBeGreaterThan(1);
    expect(path.at(-1)).toEqual(to);
    let cur = from;
    for (const p of path) {
      expect(segmentClear(cur, p)).toBe(true);
      cur = p;
    }
  });

  it("왼쪽 벽 쪽에서 오른쪽 벽 쪽까지 — 어디서든 길을 찾는다", () => {
    const from = { x: ROOM.minX + 0.4, z: 6 };
    const to = { x: ROOM.maxX - 0.4, z: -10 };
    const path = planPath(from, to);
    let cur = from;
    for (const p of path) {
      expect(segmentClear(cur, p)).toBe(true);
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
  it("3자리 hex와 rgb()/rgba()도 알파를 붙인다 — 알파가 사라지면 번짐이 불투명한 네모가 된다", () => {
    expect(withAlpha("#fff", 0.5)).toBe("rgba(255, 255, 255, 0.5)");
    expect(withAlpha("#1a2", 1)).toBe("rgba(17, 170, 34, 1)");
    expect(withAlpha("rgb(245, 245, 245)", 0.4)).toBe(
      "rgba(245, 245, 245, 0.4)",
    );
    expect(withAlpha("rgba(10 20 30 / 1)", 0.2)).toBe("rgba(10, 20, 30, 0.2)");
  });

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

describe("withAlpha — 브라우저만 해석하는 색(oklch 등)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  /** 브라우저처럼 동작하는 가짜 canvas: oklch/이름 색은 알고, 나머지는 무시한다 */
  function stubBrowserCanvas() {
    // 앞선 테스트가 "canvas 없음"을 캐시한 모듈을 버리고 새로 불러오게 한다
    vi.resetModules();
    const known: Record<string, [number, number, number]> = {
      "oklch(96.7% 0.003 264.542)": [243, 244, 246],
      rebeccapurple: [102, 51, 153],
    };
    let style = "#000000";
    let pixel: [number, number, number] = [0, 0, 0];
    const ctx = {
      get fillStyle() {
        return style;
      },
      set fillStyle(v: string) {
        // 브라우저처럼: 이름 색·아는 색만 받아들이고 해석할 수 없는 값은 무시
        if (v === "black") style = "#000000";
        else if (v === "white") style = "#ffffff";
        else if (v in known) {
          style = "#aabbcc";
          pixel = known[v];
        }
      },
      clearRect: () => undefined,
      fillRect: () => undefined,
      getImageData: () => ({ data: [...pixel, 255] }),
    };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D,
    );
  }

  it("oklch 값에도 알파를 붙인다 — Tailwind 기본 팔레트와 토큰 이름이 겹쳐도 번짐이 네모가 되지 않는다", async () => {
    stubBrowserCanvas();
    const { withAlpha: fresh } = await import("./sceneLayout");
    expect(fresh("oklch(96.7% 0.003 264.542)", 0.5)).toBe(
      "rgba(243, 244, 246, 0.5)",
    );
    expect(fresh("rebeccapurple", 0.3)).toBe("rgba(102, 51, 153, 0.3)");
  });

  it("브라우저도 모르는 값은 그대로, 빈 값은 검은색으로 오해하지 않는다", async () => {
    stubBrowserCanvas();
    const { withAlpha: fresh } = await import("./sceneLayout");
    expect(fresh("not-a-color", 0.5)).toBe("not-a-color");
    expect(fresh("", 0.5)).toBe("");
  });
});

describe("서고 길이에서 계산하는 값 — 서가·살창·대들보", () => {
  it("옆 서가는 입구 쪽(6.5)에서 뒷벽까지 같은 간격으로 이어지고 모두 서고 안에 있다", () => {
    expect(SIDE_SHELF_Z[0]).toBe(6.5);
    SIDE_SHELF_Z.forEach((z, i) => {
      if (i > 0) expect(SIDE_SHELF_Z[i - 1] - z).toBeCloseTo(SIDE_SHELF_PITCH);
      // 서가 폭(3.2m)의 절반까지 포함해 뒷벽·입구 홀 안쪽
      expect(z - 1.6).toBeGreaterThanOrEqual(ROOM.minZ - 1);
      expect(z + 1.6).toBeLessThanOrEqual(FRONT_WALL_Z);
    });
  });

  it("서고가 길어진 만큼 서가가 늘어난다 (뒷벽 가까이까지 이어짐)", () => {
    const last = SIDE_SHELF_Z[SIDE_SHELF_Z.length - 1];
    expect(last - 1.6).toBeLessThanOrEqual(ROOM.minZ + 0.1);
    expect(SIDE_SHELF_Z.length).toBeGreaterThanOrEqual(10);
  });

  it("대들보는 옆벽 살창(서가 중심)을 가리지 않고 그 사이에 놓인다", () => {
    expect(BEAM_Z.length).toBeGreaterThanOrEqual(10);
    for (const b of BEAM_Z) {
      // 살창 폭 2.2m의 절반 + 기둥 폭 여유
      for (const w of SIDE_SHELF_Z)
        expect(Math.abs(b - w)).toBeGreaterThan(1.3);
      expect(b).toBeGreaterThan(ROOM.minZ);
      expect(b).toBeLessThan(FRONT_WALL_Z);
    }
  });

  it("테이블은 가운데에서 한 번 끊겨 한 줄에 두 토막이고, 뒷벽 가까이에서 시작한다", () => {
    expect(TABLES).toHaveLength(4);
    for (const side of [0, 1]) {
      const [back, front] = TABLES.filter((t) => t.x === TABLES[side].x).sort(
        (a, b) => a.z - b.z,
      );
      expect(back.z - back.hz - ROOM.minZ).toBeLessThan(4);
      const gap = front.z - front.hz - (back.z + back.hz);
      expect(gap).toBeCloseTo(TABLE_GAP);
      expect(back.hz * 2 + front.hz * 2).toBeGreaterThan(30);
    }
  });

  it("가운데 틈으로 테이블 줄을 가로질러 건너갈 수 있다", () => {
    const mid = (TABLES[0].z + TABLES[0].hz + TABLES[2].z - TABLES[2].hz) / 2;
    for (const t of [TABLES[0], TABLES[1]]) {
      const from = { x: t.x - 3, z: mid };
      const to = { x: t.x + 3, z: mid };
      expect(segmentClear(from, to)).toBe(true);
    }
  });
});

describe("boardCameraRig — 순위판 보기 카메라", () => {
  const tanHalf = Math.tan((CAMERA_FOV * Math.PI) / 360);
  const aspects = [0.46, 0.56, 0.75, 1, 1.6, 2.2];
  const view = (aspect: number) => {
    const { cam, look } = boardCameraRig(aspect);
    const d = FRONT_WALL_Z - cam[2];
    const visibleH = 2 * d * tanHalf;
    /** 높이 y의 점이 화면 위에서 어느 비율에 오는지 (0 = 맨 위, 1 = 맨 아래) */
    const frac = (y: number) => 0.5 - (y - look[1]) / visibleH;
    return { cam, look, d, frac };
  };

  it("가운데 통로 위에서 순위판(앞벽, +z)을 정면으로 바라본다", () => {
    for (const a of aspects) {
      const { cam, look } = boardCameraRig(a);
      expect(cam[0]).toBe(0);
      expect(look[0]).toBe(0);
      expect(look[2]).toBe(FRONT_WALL_Z);
      expect(look[2]).toBeGreaterThan(cam[2]);
    }
  });

  it("어떤 화면 비율에서도 순위판이 가로로 잘리지 않는다", () => {
    for (const a of aspects) {
      const { d } = view(a);
      expect(d * tanHalf * a).toBeGreaterThanOrEqual(BOARD_EXTENT.halfWidth);
    }
  });

  it("순위판 전체가 화면 안에 있고, 아래 하단 패널(약 35%)에 가리지 않는다", () => {
    for (const a of aspects) {
      const { frac } = view(a);
      expect(frac(BOARD_EXTENT.top)).toBeGreaterThanOrEqual(0.02);
      expect(frac(BOARD_EXTENT.bottom)).toBeLessThanOrEqual(0.65);
    }
  });

  it("화면이 가로로 넓을수록 더 가까이 선다 (세로로 긴 휴대폰은 멀리)", () => {
    let prev = Infinity;
    for (const a of aspects) {
      const { d } = view(a);
      expect(d).toBeLessThanOrEqual(prev + 1e-9);
      prev = d;
    }
    expect(view(0.46).d).toBeGreaterThan(view(1.6).d);
  });

  it("카메라는 항상 서고 안(앞벽 가까이도 아니고 뒷벽 밖도 아님)에 있다", () => {
    for (const a of [0.2, ...aspects, 4]) {
      const { cam, d } = view(a);
      expect(cam[2]).toBeGreaterThanOrEqual(ROOM.minZ);
      expect(d).toBeGreaterThanOrEqual(BOARD_VIEW_DIST.min);
      expect(d).toBeLessThanOrEqual(BOARD_VIEW_DIST.max);
      expect(cam[1]).toBeLessThan(HALL.wallH);
    }
  });
});

describe("정원으로 나가는 문 — nearExit", () => {
  it("문 앞 구역 안이면 true, 멀면 false", () => {
    expect(nearExit({ x: 0, z: ROOM.maxZ })).toBe(true);
    expect(nearExit({ x: EXIT_ZONE.halfWidth, z: ROOM.maxZ })).toBe(true);
    expect(nearExit({ x: EXIT_ZONE.halfWidth + 0.1, z: ROOM.maxZ })).toBe(
      false,
    );
    expect(nearExit({ x: 0, z: EXIT_ZONE.minZ - 0.1 })).toBe(false);
  });

  it("시작 위치는 문 구역 밖이지만 문까지는 걸어갈 수 있다", () => {
    expect(nearExit(PLAYER_SPAWN)).toBe(false);
    expect(nearExit({ x: DOOR.x, z: DOOR.z })).toBe(true);
    expect(DOOR.z).toBeLessThanOrEqual(ROOM.maxZ);
  });
});
