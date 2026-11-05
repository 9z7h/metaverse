import { useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import type { Group } from "three";
import { Avatar } from "./Avatar";
import { MagicEffect } from "./MagicEffect";
import type { AvatarPose } from "./Avatar";
import {
  DOOR,
  cameraRelativeMove,
  cameraRig,
  deskLayout,
  nearestFreeSeat,
  resolveCollision,
} from "./sceneLayout";
import type { DeskLayout, Orbit, SceneColors, Vec2 } from "./sceneLayout";
import type { PresenceStudent } from "../libraryPresence";
import { houseToken } from "../houses";
import type { HouseId } from "../houses";

const WALK_SPEED = 2.6; // m/s
const BOT_SPEED = 1.4;

/* ── 내 아바타 ─────────────────────────────────────────── */

export interface PlayerProps {
  colors: SceneColors;
  desks: DeskLayout[];
  /** 조이스틱 + 키보드 입력 (x: 좌우, y: 화면 위아래) — 매 프레임 읽음 */
  input: MutableRefObject<{ x: number; y: number }>;
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
  /** 드래그·줌으로 바뀌는 카메라 궤도 — 매 프레임 읽음 */
  orbit: MutableRefObject<Orbit>;
  /** 드래그 중인지 (카메라 반응 속도 상향) */
  dragging: MutableRefObject<boolean>;
}

/** 카메라 기본 거리 — 걸을 때 / 앉아 있을 때 */
const WALK_DIST = 7.6;
const SEATED_DIST = 5.2;

export function Player({
  colors,
  desks,
  input,
  occupied,
  seat,
  focusing,
  subject,
  house,
  onNearSeatChange,
  orbit,
  dragging,
}: PlayerProps) {
  const ref = useRef<Group>(null);
  const pos = useRef<Vec2>({ ...DOOR, z: DOOR.z - 1 });
  const facing = useRef(Math.PI); // 처음엔 방 안쪽(-z)을 바라봄
  const nearRef = useRef<string | null>(null);
  const [pose, setPose] = useState<AvatarPose>("stand");
  const camera = useThree((s) => s.camera);
  const look = useRef(new Vector3());
  const camTarget = useRef(new Vector3());
  const lookTarget = useRef(new Vector3());

  // 일어나면 의자 뒤 통로 쪽으로 한 발 물러선다
  const prevSeat = useRef<DeskLayout | null>(null);
  useEffect(() => {
    if (prevSeat.current && !seat) {
      pos.current = resolveCollision(
        { x: prevSeat.current.chair.x, z: prevSeat.current.chair.z + 0.7 },
        desks,
      );
    }
    prevSeat.current = seat;
  }, [seat, desks]);

  useFrame((_, rawDt) => {
    const g = ref.current;
    if (!g) return;
    const dt = Math.min(rawDt, 0.1); // 저프레임 모드에서 순간이동 방지

    if (seat) {
      g.position.set(seat.chair.x, 0, seat.chair.z);
      g.rotation.y = Math.PI; // 책상(-z)을 바라봄
      if (pose !== "sit") setPose("sit");
      if (nearRef.current !== null) {
        nearRef.current = null;
        onNearSeatChange(null);
      }
      // 내 자리 뒤에서 앞줄(함께 공부하는 사람들)을 바라봄 — 드래그로 돌려볼 수 있음
      const rig = cameraRig(seat.chair, orbit.current, SEATED_DIST, 3);
      camTarget.current.set(...rig.cam);
      lookTarget.current.set(...rig.look);
    } else {
      const { x, y } = input.current;
      const moving = Math.hypot(x, y) > 0.05;
      if (moving) {
        // 조이스틱 위 = 카메라가 보는 방향
        const move = cameraRelativeMove(x, y, orbit.current.yaw);
        const next = resolveCollision(
          {
            x: pos.current.x + move.x * WALK_SPEED * dt,
            z: pos.current.z + move.z * WALK_SPEED * dt,
          },
          desks,
        );
        pos.current = next;
        facing.current = Math.atan2(move.x, move.z);
      }
      const nextPose: AvatarPose = moving ? "walk" : "stand";
      if (pose !== nextPose) setPose(nextPose);

      g.position.set(pos.current.x, 0, pos.current.z);
      g.rotation.y = facing.current;

      const near =
        nearestFreeSeat(pos.current, desks, occupied)?.seatId ?? null;
      if (near !== nearRef.current) {
        nearRef.current = near;
        onNearSeatChange(near);
      }
      // 시선을 앞쪽(3m)에 둬 뒷줄이 화면 위 HUD에 가리지 않게 한다
      const rig = cameraRig(pos.current, orbit.current, WALK_DIST, 3);
      camTarget.current.set(...rig.cam);
      lookTarget.current.set(...rig.look);
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
      skin={colors["--color-scene-skin"]}
      hat={colors["--color-scene-hat"]}
      pose={pose}
      focusing={focusing}
      name="나"
      subject={seat ? subject : undefined}
      highlight
      // 앉아 있을 땐 내 이름표 숨김 (카메라가 가까워 화면을 가림)
      showLabel={!seat}
    />
  );
}

/* ── 다른 학생 (봇) ────────────────────────────────────── */

export interface BotProps {
  student: PresenceStudent;
  colors: SceneColors;
  /** true면 입구에서 걸어 들어와 앉음, false면 처음부터 앉아 있음 */
  entering: boolean;
}

export function Bot({ student, colors, entering }: BotProps) {
  const ref = useRef<Group>(null);
  const layout = deskLayout(student.seatId);
  // 입구 → 중앙 통로(x=0) → 자기 의자. 통로로 돌아가면 책상과 부딪히지 않는다.
  const path = useRef<Vec2[]>(
    entering ? [{ x: 0, z: layout.chair.z + 0.8 }, layout.chair] : [],
  );
  const pos = useRef<Vec2>(entering ? { ...DOOR } : { ...layout.chair });
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
      g.rotation.y = Math.PI;
    }
    g.position.set(pos.current.x, 0, pos.current.z);
  });

  const practicing =
    pose === "sit" && student.focusing && student.mode === "practice";

  return (
    <>
      <Avatar
        ref={ref}
        robe={colors[houseToken(student.house, "primary")]}
        band={colors[houseToken(student.house, "accent")]}
        houseDot={colors[houseToken(student.house, "accent")]}
        skin={colors["--color-scene-skin"]}
        hat={colors["--color-scene-hat"]}
        pose={pose}
        focusing={student.focusing}
        practicing={practicing}
        name={student.name}
        subject={student.subject}
        // 걸어 들어오는 중엔 이름표 숨김 — 카메라 가까이 지나갈 때 화면을 가리지 않도록
        showLabel={pose === "sit"}
      />
      {/* 실습 중 + 집중 중이면 책상 위로 기숙사 마법이 피어오름 */}
      {practicing ? (
        <MagicEffect house={student.house} colors={colors} at={layout.desk} />
      ) : null}
    </>
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
