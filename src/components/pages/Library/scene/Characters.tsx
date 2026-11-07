import { useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Plane, Raycaster, Vector2, Vector3 } from "three";
import type { Group, Mesh, MeshBasicMaterial, PerspectiveCamera } from "three";
import { Avatar } from "./Avatar";
import { DissolveEffect, MagicEffect } from "./MagicEffect";
import { dissolveAlpha, dissolveProgress, dissolveRise } from "./magicMotion";
import type { AvatarPose } from "./Avatar";
import {
  BOARD_LIFT,
  DOOR,
  boardLift,
  cameraRelativeMove,
  cameraRig,
  deskLayout,
  nearestFreeSeat,
  nearExit,
  planPath,
  resolveCollision,
  shortestYawTarget,
  boardCameraRig,
  PLAYER_SPAWN,
} from "./sceneLayout";
import type { DeskLayout, Orbit, SceneColors, Vec2 } from "./sceneLayout";
import type {
  PresencePlace,
  PresenceStudent,
  RemoteMove,
  Walker,
} from "../libraryPresence";
import { houseToken } from "../houses";
import type { HouseId } from "../houses";

const WALK_SPEED = 4.0; // m/s
const BOT_SPEED = 1.4;
/** 내 위치를 알리는 간격 — 걷는 중 / 가만히 있을 때(새로 들어온 사람이 내 위치를 알 수 있게) */
export const MOVE_SEND_MS = 300;
export const IDLE_SEND_MS = 2000;

/* ── 내 아바타 ─────────────────────────────────────────── */

/** 탭으로 내린 이동 명령. 경로는 Player가 현재 위치에서 처음 한 번 계산한다. */
export interface MoveOrder {
  target: Vec2;
  /** 빈 책상을 탭했으면 그 좌석 — 도착하면 자동으로 앉음 */
  seatId: string | null;
  path?: Vec2[];
}

export interface PlayerProps {
  colors: SceneColors;
  desks: DeskLayout[];
  /** 키보드 입력 (x: 좌우, y: 화면 위아래) — 매 프레임 읽음. 움직이면 탭 이동은 취소 */
  input: MutableRefObject<{ x: number; y: number }>;
  /** 탭 이동 명령 — 매 프레임 읽고, 도착하면 null로 비운다 */
  moveOrder: MutableRefObject<MoveOrder | null>;
  /** 탭한 빈 책상에 도착 */
  onArriveSeat: (seatId: string) => void;
  /** 실습 중 — 지팡이를 들고 마법을 씀 */
  practicing: boolean;
  /** 다른 학생이 앉은 좌석 */
  occupied: Set<string>;
  /** 앉아 있는 좌석 (null이면 걷는 중) */
  seat: DeskLayout | null;
  focusing: boolean;
  subject: string;
  /** 내 기숙사 — 로브·모자 띠 색 */
  house: HouseId;
  /** 근처 빈 좌석이 바뀔 때만 호출 */
  onNearSeatChange: (seatId: string | null) => void;
  /** 정원으로 나가는 문 앞인지가 바뀔 때만 호출 */
  onNearExitChange?: (near: boolean) => void;
  /** 드래그·줌으로 바뀌는 카메라 궤도 — 매 프레임 읽음 */
  orbit: MutableRefObject<Orbit>;
  /** 드래그 중인지 (카메라 반응 속도 상향) */
  dragging: MutableRefObject<boolean>;
  /** 내 현재 위치를 매 프레임 기록 — 광원이 나를 따라가는 데 쓴다 */
  positionRef?: MutableRefObject<Vec2>;
  /** true면 카메라가 순위판 앞으로 날아가 순위판을 크게 보여 준다 (매 프레임 읽음) */
  boardView?: MutableRefObject<boolean>;
  /** 내 머리 위 말풍선 글 */
  bubble?: string;
  /** 걷는 동안 내 위치를 다른 접속자에게 알린다 (이 안에서 빈도를 조절하므로 그대로 보내면 된다) */
  onMove?: (x: number, z: number, ry: number, moving: boolean) => void;
}

/** 카메라 기본 거리 — 걸을 때 / 앉아 있을 때 */
const WALK_DIST = 7.6;
const SEATED_DIST = 5.2;

/**
 * 앉을 때 **한 번만** 시점을 내 등 뒤(테이블 쪽 정면)로 맞춘다.
 * 좌석이 "바뀔 때"만 동작해야 해서 객체가 아니라 id로 비교한다 — `seat` 객체는 부모가
 * 렌더할 때마다 새로 만들어지므로, 객체를 의존성으로 쓰면 1초마다 시점이 되돌려져
 * 앉은 채로 주위를 둘러볼 수 없게 된다.
 */
export function useFaceSeatOnSit(
  seatId: string | null,
  orbit: MutableRefObject<Orbit>,
) {
  useEffect(() => {
    if (!seatId) return;
    orbit.current.yaw = shortestYawTarget(
      orbit.current.yaw,
      deskLayout(seatId).facing + Math.PI,
    );
  }, [seatId, orbit]);
}

export function Player({
  colors,
  desks,
  input,
  moveOrder,
  onArriveSeat,
  practicing,
  occupied,
  seat,
  focusing,
  subject,
  house,
  onNearSeatChange,
  onNearExitChange,
  orbit,
  dragging,
  positionRef,
  boardView,
  bubble,
  onMove,
}: PlayerProps) {
  const ref = useRef<Group>(null);
  const lastSent = useRef({ at: 0, moving: false });
  const pos = useRef<Vec2>({ ...PLAYER_SPAWN });
  const facing = useRef(Math.PI); // 처음엔 방 안쪽(-z)을 바라봄
  const nearRef = useRef<string | null>(null);
  const nearExitRef = useRef(false);
  const [pose, setPose] = useState<AvatarPose>("stand");
  // 문 위 순위판을 보는 중이면 내 이름표를 숨긴다 (깃발을 가리므로). 경계를 넘을 때만 갱신.
  const [facingBoard, setFacingBoard] = useState(false);
  const camera = useThree((s) => s.camera);
  const look = useRef(new Vector3());
  const camTarget = useRef(new Vector3());
  const lookTarget = useRef(new Vector3());

  // 일어나면 의자 뒤 통로 쪽으로 한 발 물러선다
  const prevSeat = useRef<DeskLayout | null>(null);
  useEffect(() => {
    if (prevSeat.current && !seat) {
      pos.current = resolveCollision(prevSeat.current.stand);
    }
    prevSeat.current = seat;
  }, [seat]);

  useFaceSeatOnSit(seat?.seatId ?? null, orbit);

  useFrame((_, rawDt) => {
    const g = ref.current;
    if (!g) return;
    const dt = Math.min(rawDt, 0.1); // 저프레임 모드에서 순간이동 방지

    const lookingAtBoard =
      Boolean(boardView?.current) ||
      boardLift(orbit.current.yaw) > BOARD_LIFT * 0.6;
    if (lookingAtBoard !== facingBoard) setFacingBoard(lookingAtBoard);

    if (seat) {
      g.position.set(seat.chair.x, 0, seat.chair.z);
      g.rotation.y = seat.facing; // 테이블 쪽을 바라봄
      if (pose !== "sit") setPose("sit");
      if (nearRef.current !== null) {
        nearRef.current = null;
        onNearSeatChange(null);
      }
      // 내 자리 뒤에서 나와 앞줄을 함께 봄 — 드래그로 돌려볼 수 있음.
      // 시선을 너무 앞(3m)에 두면 내 아바타가 화면 맨 아래 타이머 바에 가려져
      // 내가 마법 쓰는 모습이 안 보이므로, 책상 바로 앞(0.8m)을 본다.
      const rig = cameraRig(
        seat.chair,
        orbit.current,
        SEATED_DIST,
        0.8,
        boardLift(orbit.current.yaw),
      );
      camTarget.current.set(...rig.cam);
      lookTarget.current.set(...rig.look);
    } else {
      const { x, y } = input.current;
      const keyMoving = Math.hypot(x, y) > 0.05;
      let moving = false;
      if (keyMoving) {
        // 키보드 위 = 카메라가 보는 방향. 키보드로 움직이면 탭 이동은 취소
        moveOrder.current = null;
        const move = cameraRelativeMove(x, y, orbit.current.yaw);
        pos.current = resolveCollision({
          x: pos.current.x + move.x * WALK_SPEED * dt,
          z: pos.current.z + move.z * WALK_SPEED * dt,
        });
        facing.current = Math.atan2(move.x, move.z);
        moving = true;
      } else if (moveOrder.current) {
        // 탭 이동: 책상을 피해 가는 경유점을 차례로 따라감
        const order = moveOrder.current;
        order.path ??= planPath(pos.current, order.target);
        const next = order.path[0];
        if (next) {
          const dx = next.x - pos.current.x;
          const dz = next.z - pos.current.z;
          const dist = Math.hypot(dx, dz);
          const step = WALK_SPEED * dt;
          if (dist <= step) {
            pos.current = { ...next };
            order.path.shift();
          } else {
            pos.current = {
              x: pos.current.x + (dx / dist) * step,
              z: pos.current.z + (dz / dist) * step,
            };
            facing.current = Math.atan2(dx, dz);
          }
          moving = true;
        }
        if (order.path.length === 0) {
          moveOrder.current = null;
          // 가는 사이 다른 학생이 앉았으면 앉지 않고 멈춤
          if (order.seatId && !occupied.has(order.seatId)) {
            onArriveSeat(order.seatId);
          }
        }
      }
      const nextPose: AvatarPose = moving ? "walk" : "stand";
      if (pose !== nextPose) setPose(nextPose);

      g.position.set(pos.current.x, 0, pos.current.z);
      g.rotation.y = facing.current;

      if (onMove) {
        const now = performance.now();
        const sent = lastSent.current;
        // 멈추는 순간은 바로 알려서 상대 화면에서 계속 걷지 않게 한다
        const stopped = sent.moving && !moving;
        const due = now - sent.at >= (moving ? MOVE_SEND_MS : IDLE_SEND_MS);
        if (stopped || due) {
          lastSent.current = { at: now, moving };
          onMove(pos.current.x, pos.current.z, facing.current, moving);
        }
      }

      const near =
        nearestFreeSeat(pos.current, desks, occupied)?.seatId ?? null;
      if (near !== nearRef.current) {
        nearRef.current = near;
        onNearSeatChange(near);
      }
      const atExit = nearExit(pos.current);
      if (atExit !== nearExitRef.current) {
        nearExitRef.current = atExit;
        onNearExitChange?.(atExit);
      }
      // 시선을 앞쪽(3m)에 둬 뒷줄이 화면 위 HUD에 가리지 않게 한다
      const rig = cameraRig(
        pos.current,
        orbit.current,
        WALK_DIST,
        3,
        boardLift(orbit.current.yaw),
      );
      camTarget.current.set(...rig.cam);
      lookTarget.current.set(...rig.look);
    }

    if (positionRef) positionRef.current = { x: g.position.x, z: g.position.z };

    // 순위판 보기: 어디에 있든 순위판 앞으로 날아가 크게 보여 준다 (카메라는 아래에서 부드럽게 따라감)
    if (boardView?.current) {
      const r = boardCameraRig((camera as PerspectiveCamera).aspect || 1);
      camTarget.current.set(...r.cam);
      lookTarget.current.set(...r.look);
    }

    // 카메라는 부드럽게 따라감 (프레임레이트와 무관한 감쇠).
    // 드래그 중엔 손가락을 바로 따라오도록 더 빠르게.
    const k = 1 - Math.exp(-dt * (dragging.current ? 18 : 6));
    camera.position.lerp(camTarget.current, k);
    look.current.lerp(lookTarget.current, k);
    camera.lookAt(look.current);
  });

  return (
    <Avatar
      ref={ref}
      robe={colors[houseToken(house, "primary")]}
      band={colors[houseToken(house, "accent")]}
      collar={colors["--color-scene-collar"]}
      skin={colors["--color-scene-skin"]}
      hat={colors["--color-scene-hat"]}
      pose={pose}
      focusing={focusing}
      practicing={practicing}
      wand={{
        wood: colors["--color-scene-wood-dark"],
        glow: colors["--color-scene-flame"],
      }}
      name="나"
      bubble={bubble}
      subject={seat ? subject : undefined}
      highlight
      // 앉아 있을 땐 내 이름표 숨김 (카메라가 가까워 화면을 가림), 순위판을 볼 때도 숨김
      showLabel={!seat && !facingBoard}
    />
  );
}

/* ── 다른 학생 (봇) ────────────────────────────────────── */

/** 봇이 지금 어디서 무엇을 하고 있는지 — 나갈 때 그 자리에서 연출하려고 공유한다 */
export interface BotSnapshot {
  x: number;
  z: number;
  /** y축 회전 */
  ry: number;
  /** 아직 자리로 걸어가는 중 */
  walking: boolean;
}
export type BotRegistry = MutableRefObject<Map<string, BotSnapshot>>;

export interface BotProps {
  student: PresenceStudent;
  colors: SceneColors;
  /** true면 입구에서 걸어 들어와 앉음, false면 처음부터 앉아 있음 */
  entering: boolean;
  /** 현재 위치를 기록해 둘 곳 (나갈 때 퇴장 연출이 읽는다) */
  registry?: BotRegistry;
  /** 머리 위 말풍선 글 */
  bubble?: string;
  /** 걸어 들어올 때 출발 위치 — 서고를 걷다 앉은 사람은 그 자리에서 이어서 걸어간다. 없으면 입구 */
  from?: Vec2;
}

export function Bot({
  student,
  colors,
  entering,
  registry,
  bubble,
  from,
}: BotProps) {
  const ref = useRef<Group>(null);
  const layout = deskLayout(student.seatId);
  // 입구 → 자기 의자. 긴 테이블을 돌아가야 하는 벽 쪽 의자도 길찾기가 알아서 찾는다.
  const path = useRef<Vec2[]>(
    entering ? planPath(from ?? DOOR, layout.chair) : [],
  );
  const pos = useRef<Vec2>(
    entering ? { ...(from ?? DOOR) } : { ...layout.chair },
  );
  const [pose, setPose] = useState<AvatarPose>(entering ? "walk" : "sit");

  useFrame((_, rawDt) => {
    const g = ref.current;
    if (!g) return;
    const dt = Math.min(rawDt, 0.1);
    const target = path.current[0];
    if (target) {
      const dx = target.x - pos.current.x;
      const dz = target.z - pos.current.z;
      const dist = Math.hypot(dx, dz);
      const step = BOT_SPEED * dt;
      if (dist <= step) {
        pos.current = { ...target };
        path.current.shift();
        if (path.current.length === 0) setPose("sit");
      } else {
        pos.current = {
          x: pos.current.x + (dx / dist) * step,
          z: pos.current.z + (dz / dist) * step,
        };
        g.rotation.y = Math.atan2(dx, dz);
      }
    } else {
      g.rotation.y = layout.facing;
    }
    g.position.set(pos.current.x, 0, pos.current.z);
    registry?.current.set(student.id, {
      x: pos.current.x,
      z: pos.current.z,
      ry: g.rotation.y,
      walking: path.current.length > 0,
    });
  });

  const practicing =
    pose === "sit" && student.focusing && student.mode === "practice";

  return (
    <>
      <Avatar
        ref={ref}
        robe={colors[houseToken(student.house, "primary")]}
        band={colors[houseToken(student.house, "accent")]}
        collar={colors["--color-scene-collar"]}
        houseDot={colors[houseToken(student.house, "accent")]}
        skin={colors["--color-scene-skin"]}
        hat={colors["--color-scene-hat"]}
        pose={pose}
        focusing={student.focusing}
        practicing={practicing}
        wand={{
          wood: colors["--color-scene-wood-dark"],
          glow: colors["--color-scene-flame"],
        }}
        name={student.name}
        subject={student.subject}
        bubble={bubble}
        // 걸어 들어오는 중엔 이름표 숨김 — 카메라 가까이 지나갈 때 화면을 가리지 않도록
        showLabel={pose === "sit"}
      />
      {/* 실습 중 + 집중 중이면 책상 위로 기숙사 마법이 피어오름 */}
      {practicing ? (
        <MagicEffect colors={colors} house={student.house} at={layout.desk} />
      ) : null}
    </>
  );
}

/* ── 걸어 다니는 다른 접속자 ────────────────────────────── */

/** 이 속도로 받은 위치를 따라간다 (클수록 빨리 붙는다) — 300ms 간격 위치가 끊겨 보이지 않게 보간 */
export const FOLLOW_RATE = 7;

export interface RemoteWalkerProps {
  walker: Walker;
  /** 지금 내가 있는 곳 — 다른 곳에서 보낸 위치는 좌표계가 달라 그리지 않는다 */
  place: PresencePlace;
  colors: SceneColors;
  /** 걷는 사람들의 최근 위치 — 매 프레임 읽는다 */
  moves: MutableRefObject<Map<string, RemoteMove>>;
  /** 머리 위 말풍선 글 */
  bubble?: string;
}

export function RemoteWalker({
  walker,
  place,
  colors,
  moves,
  bubble,
}: RemoteWalkerProps) {
  const ref = useRef<Group>(null);
  const pos = useRef<Vec2 | null>(null);
  const ry = useRef(0);
  const [pose, setPose] = useState<AvatarPose>("stand");

  useFrame((_, rawDt) => {
    const g = ref.current;
    if (!g) return;
    const move = moves.current.get(walker.id);
    // 첫 위치를 받기 전에는 엉뚱한 곳에 서 있지 않도록 숨긴다
    if (!move || move.place !== place) {
      g.visible = false;
      pos.current = null;
      return;
    }
    g.visible = true;
    if (!pos.current) {
      pos.current = { x: move.x, z: move.z };
      ry.current = move.ry;
    }
    const dt = Math.min(rawDt, 0.1);
    const k = 1 - Math.exp(-dt * FOLLOW_RATE);
    const dx = move.x - pos.current.x;
    const dz = move.z - pos.current.z;
    pos.current = { x: pos.current.x + dx * k, z: pos.current.z + dz * k };
    ry.current += (shortestYawTarget(ry.current, move.ry) - ry.current) * k;
    g.position.set(pos.current.x, 0, pos.current.z);
    g.rotation.y = ry.current;
    const walking = move.moving || Math.hypot(dx, dz) > 0.1;
    const next: AvatarPose = walking ? "walk" : "stand";
    if (next !== pose) setPose(next);
  });

  return (
    <Avatar
      ref={ref}
      robe={colors[houseToken(walker.house, "primary")]}
      band={colors[houseToken(walker.house, "accent")]}
      collar={colors["--color-scene-collar"]}
      houseDot={colors[houseToken(walker.house, "accent")]}
      skin={colors["--color-scene-skin"]}
      hat={colors["--color-scene-hat"]}
      pose={pose}
      focusing={false}
      practicing={false}
      wand={{
        wood: colors["--color-scene-wood-dark"],
        glow: colors["--color-scene-flame"],
      }}
      name={walker.name}
      bubble={bubble}
      showLabel
    />
  );
}

/* ── 퇴장: 마법처럼 스르륵 사라지는 학생 ───────────────────── */

/** 그룹 안 모든 재질의 불투명도를 `alpha` 배로 (원래 불투명도를 처음 한 번 기억해 둔다) */
function applyFade(root: Group, alpha: number) {
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      m.userData.baseOpacity ??= m.opacity;
      m.transparent = true;
      m.opacity = (m.userData.baseOpacity as number) * alpha;
      // 거의 불투명할 때만 깊이를 써서, 반투명 부품끼리 비쳐 보이게
      m.depthWrite = alpha > 0.98;
    }
  });
}

export interface LeavingBotProps {
  /** 나간 순간의 모습 */
  student: PresenceStudent;
  colors: SceneColors;
  /** 퇴장이 시작된 시각 (performance.now 기준 ms) */
  since: number;
  /** 봇들이 기록해 둔 위치 — 있으면 나간 순간의 실제 위치·자세에서 연출한다 */
  registry?: BotRegistry;
}

/**
 * 나간 학생을 나간 순간의 자리에서 잠시 더 그린다 (걸어 들어오던 중이면 통로에서): 기숙사색 빛 입자가 솟아오르고,
 * 아바타는 위로 떠오르며 서서히 투명해진다. 시간이 다 되면 부모가 제거한다.
 */
export function LeavingBot({
  student,
  colors,
  since,
  registry,
}: LeavingBotProps) {
  const ref = useRef<Group>(null);
  const layout = deskLayout(student.seatId);
  // 첫 렌더에서 한 번만 정한다 — 기록이 없으면(처음부터 앉아 있던 학생) 자기 의자
  const start = useRef<BotSnapshot>(
    registry?.current.get(student.id) ?? {
      x: layout.chair.x,
      z: layout.chair.z,
      ry: layout.facing,
      walking: false,
    },
  );

  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const p = dissolveProgress(performance.now() - since);
    g.position.set(start.current.x, dissolveRise(p), start.current.z);
    g.rotation.y = start.current.ry;
    applyFade(g, dissolveAlpha(p));
  });

  return (
    <>
      <Avatar
        ref={ref}
        robe={colors[houseToken(student.house, "primary")]}
        band={colors[houseToken(student.house, "accent")]}
        collar={colors["--color-scene-collar"]}
        houseDot={colors[houseToken(student.house, "accent")]}
        skin={colors["--color-scene-skin"]}
        hat={colors["--color-scene-hat"]}
        pose={start.current.walking ? "walk" : "sit"}
        name={student.name}
        // 이름표는 바로 숨김 — 사라지는 아바타 위에 글자만 남지 않도록
        showLabel={false}
      />
      <DissolveEffect
        colors={colors}
        house={student.house}
        at={start.current}
        since={since}
      />
    </>
  );
}

/* ── 탭 이동 보조: 화면 좌표 → 바닥 좌표, 목적지 표시 ─────── */

/** 화면 좌표 → 높이 `y`인 수평면과 만나는 점 (기본: 바닥 y=0) */
export type FloorPick = (
  clientX: number,
  clientY: number,
  y?: number,
) => Vec2 | null;

/** Canvas 안에서 카메라를 알고 있으므로, 탭한 화면 위치를 수평면 좌표로 바꾸는 함수를 ref로 내보낸다 */
export function FloorPicker({
  pickRef,
}: {
  pickRef: MutableRefObject<FloorPick | null>;
}) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const raycaster = new Raycaster();
    const ndc = new Vector2();
    const hit = new Vector3();
    const plane = new Plane(new Vector3(0, 1, 0), 0);
    pickRef.current = (clientX, clientY, y = 0) => {
      plane.constant = -y; // 평면 y = 높이
      const rect = gl.domElement.getBoundingClientRect();
      ndc.set(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      return raycaster.ray.intersectPlane(plane, hit)
        ? { x: hit.x, z: hit.z }
        : null;
    };
    return () => {
      pickRef.current = null;
    };
  }, [camera, gl, pickRef]);
  return null;
}

/** 탭한 목적지 바닥에 잠깐 퍼졌다 사라지는 고리 (기숙사 색) */
export function TapMarker({ at, color }: { at: Vec2; color: string }) {
  const ref = useRef<Mesh>(null);
  const born = useRef<number | null>(null);
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    born.current ??= clock.elapsedTime;
    const p = Math.min(1, (clock.elapsedTime - born.current) / 0.9);
    const s = 0.6 + p * 0.6;
    m.scale.set(s, s, s);
    (m.material as MeshBasicMaterial).opacity = 1 - p;
    m.visible = p < 1;
  });
  return (
    <mesh
      ref={ref}
      position={[at.x, 0.02, at.z]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <ringGeometry args={[0.28, 0.36, 32]} />
      <meshBasicMaterial
        color={color}
        transparent
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

/* ── 프레임레이트 제어 (배터리) ────────────────────────── */

/**
 * Canvas는 frameloop="demand"로 두고 여기서 invalidate()를 원하는 주기로 호출한다.
 * - fps ≥ 60: requestAnimationFrame 매 프레임
 * - 그 외: setInterval(1000 / fps)
 * - 탭이 숨겨지면 완전히 정지
 */
export function FrameDriver({ fps }: { fps: number }) {
  const invalidate = useThree((s) => s.invalidate);
  const [hidden, setHidden] = useState(
    typeof document !== "undefined" && document.hidden,
  );

  useEffect(() => {
    const onVis = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    if (hidden) return;
    if (fps >= 60) {
      let raf = 0;
      const loop = () => {
        invalidate();
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(raf);
    }
    const id = window.setInterval(() => invalidate(), 1000 / fps);
    return () => window.clearInterval(id);
  }, [fps, hidden, invalidate]);

  return null;
}
