/**
 * 몽당 싸리비와 그것을 타는 학생 — 숨돌림 뜰에서 걷다가 빗자루를 타고 하늘을 난다.
 *
 * 설정(⚠ [보강]): 오래 쓴 몽당 싸리비가 도깨비 기운으로 떠올라 학생을 태워 준다.
 * 급가속·급선회 없이 천천히 움직여 머리를 식히는 용도에 맞춘다 (stepFlight).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import type { BufferAttribute, Group, Points } from "three";
import { Avatar } from "../Avatar";
import type { AvatarPose } from "../Avatar";
import { FOLLOW_RATE, IDLE_SEND_MS, MOVE_SEND_MS } from "../Characters";
import { roundGlowKey, roundGlowShader } from "../MagicEffect";
import { cameraRelativeMove, cameraRig } from "../sceneLayout";
import type { Orbit, SceneColors, Vec2 } from "../sceneLayout";
import { houseToken } from "../../houses";
import type { HouseId } from "../../houses";
import type { RemoteMove, Walker } from "../../libraryPresence";
import {
  GARDEN_CAMERA_BOUNDS,
  GARDEN_SPAWN,
  isGrounded,
  nearLibraryDoor,
  resolveWalk,
  stepFlight,
  tapIntent,
  wrapAngle,
} from "./gardenLayout";
import type { FlightState } from "./gardenLayout";

const WALK_SPEED = 4.0;
/** 아바타를 빗자루 위에 앉히는 높이 — sit 자세가 몸을 0.22 낮추므로 치맛자락 밑으로 손잡이가 지난다 */
const SIT_Y = 0.45;
const TRAIL = 16;

/* ── 몽당 싸리비 모델 ───────────────────────────────────────── */

export function BroomModel({ colors }: { colors: SceneColors }) {
  const handle = colors["--color-scene-wood-light"];
  const twig = colors["--color-scene-wood"];
  const twigDark = colors["--color-scene-wood-dark"];
  return (
    <group>
      {/* 자루 */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.2]}>
        <cylinderGeometry args={[0.04, 0.045, 2.2, 8]} />
        <meshStandardMaterial color={handle} roughness={0.8} />
      </mesh>
      {/* 싸리 다발 — 꼬리 쪽으로 퍼지는 몽당 빗자루 (들쭉날쭉하게 세 갈래) */}
      {[
        { x: 0, y: 0, len: 0.85, r: 0.27, c: twig },
        { x: 0.13, y: 0.05, len: 0.7, r: 0.18, c: twigDark },
        { x: -0.12, y: -0.04, len: 0.62, r: 0.16, c: twigDark },
      ].map((b, i) => (
        <mesh
          key={i}
          rotation={[Math.PI / 2, 0, 0]}
          position={[b.x, b.y, -0.95 - b.len / 2 + 0.25]}
        >
          <coneGeometry args={[b.r, b.len, 9]} />
          <meshStandardMaterial color={b.c} roughness={0.95} />
        </mesh>
      ))}
      {/* 묶은 끈 */}
      <mesh position={[0, 0, -0.72]}>
        <torusGeometry args={[0.1, 0.022, 6, 14]} />
        <meshStandardMaterial
          color={colors["--color-scene-dancheong"]}
          roughness={0.6}
        />
      </mesh>
    </group>
  );
}

/* ── 타는 사람 ─────────────────────────────────────────────── */

export interface BroomRiderProps {
  colors: SceneColors;
  house: HouseId;
  /** 빗자루를 타고 있는지 (false면 걸어 다닌다) */
  riding: boolean;
  /** 키보드 입력 (x: 좌우, y: 화면 위아래) — 매 프레임 읽음. 움직이면 탭 목표는 취소 */
  input: MutableRefObject<{ x: number; y: number }>;
  /** 탭한 목표 — 매 프레임 읽고, 도착하면 null로 비운다 */
  target: MutableRefObject<Vec2 | null>;
  orbit: MutableRefObject<Orbit>;
  dragging: MutableRefObject<boolean>;
  /** 서고 문 가까이에 있는지가 바뀔 때만 호출 */
  onNearDoorChange: (near: boolean) => void;
  /** 움직이는 중(걷기·비행·이륙·착륙)인지가 바뀔 때만 호출 — 부드럽게 그리려고 프레임을 올린다 */
  onMovingChange: (moving: boolean) => void;
  /** "동작 줄이기" — 흔들림·기울어짐·자취를 없애고 천천히 */
  reducedMotion: boolean;
  /** 내 위치를 다른 접속자에게 알린다 (이 안에서 빈도를 조절하므로 그대로 보내면 된다) */
  onMove?: (
    x: number,
    z: number,
    ry: number,
    moving: boolean,
    y: number,
    riding: boolean,
  ) => void;
}

const CAMERA_DIST = { walk: 7.6, fly: 10.5 };

export function BroomRider({
  colors,
  house,
  riding,
  input,
  target,
  orbit,
  dragging,
  onNearDoorChange,
  onMovingChange,
  reducedMotion,
  onMove,
}: BroomRiderProps) {
  const lastSent = useRef({ at: 0, moving: false });
  const root = useRef<Group>(null);
  const tilt = useRef<Group>(null);
  const avatar = useRef<Group>(null);
  const trail = useRef<Points>(null);
  const state = useRef<FlightState>({
    x: GARDEN_SPAWN.x,
    z: GARDEN_SPAWN.z,
    y: 0,
    heading: 0, // 처음엔 남쪽(+z), 뜰 쪽을 바라봄
    speed: 0,
  });
  const bank = useRef(0);
  const prevHeading = useRef(0);
  const stuck = useRef(0);
  const nearRef = useRef<boolean | null>(null);
  const movingRef = useRef<boolean | null>(null);
  const history = useRef<number[]>([]);
  const lastTrail = useRef(0);
  const trailPositions = useMemo(() => new Float32Array(TRAIL * 3), []);
  const [pose, setPose] = useState<AvatarPose>("stand");
  const [showBroom, setShowBroom] = useState(false);
  const camera = useThree((s) => s.camera);
  const look = useRef(new Vector3());
  const camTarget = useRef(new Vector3());
  const lookTarget = useRef(new Vector3());

  // 처음 프레임에 카메라가 먼 곳에서 날아오지 않게 시작 위치 뒤로 맞춰 둔다
  useEffect(() => {
    camera.position.set(GARDEN_SPAWN.x, 5, GARDEN_SPAWN.z - 7);
    look.current.set(GARDEN_SPAWN.x, 1, GARDEN_SPAWN.z + 3);
  }, [camera]);

  useFrame(({ clock }, rawDt) => {
    const g = root.current;
    if (!g) return;
    const dt = Math.min(rawDt, 0.1);
    const s = state.current;
    const slow = reducedMotion ? 0.6 : 1;

    // ── 무엇을 하려는가: 키보드가 우선, 아니면 탭한 곳으로
    let dir: Vec2 | null = null;
    let speedFrac = 1;
    const { x: kx, y: ky } = input.current;
    if (Math.hypot(kx, ky) > 0.05) {
      target.current = null;
      const m = cameraRelativeMove(kx, ky, orbit.current.yaw);
      const len = Math.hypot(m.x, m.z) || 1;
      dir = { x: m.x / len, z: m.z / len };
    } else if (target.current) {
      const r = tapIntent(s, target.current);
      if (r.arrived) target.current = null;
      else {
        dir = r.intent.dir;
        speedFrac = r.intent.speedFrac;
      }
    }

    const grounded = isGrounded(s);
    let moving: boolean;
    if (riding || !grounded) {
      // 비행(이륙·순항·착륙) — riding이 꺼지면 천천히 내려앉는다
      const next = stepFlight(
        s,
        dt,
        { dir, speedFrac: speedFrac * slow },
        !riding,
      );
      state.current = next;
      moving = true;
    } else {
      // 걷기
      moving = false;
      if (dir) {
        const step = WALK_SPEED * slow * dt;
        const nx = s.x + dir.x * step;
        const nz = s.z + dir.z * step;
        const out = resolveWalk({ x: nx, z: nz });
        const moved = Math.hypot(out.x - s.x, out.z - s.z);
        // 막혀서 못 가는 채로 오래 있으면 탭 목표를 포기한다
        stuck.current = moved < step * 0.2 ? stuck.current + dt : 0;
        if (stuck.current > 0.5) {
          target.current = null;
          stuck.current = 0;
        }
        s.x = out.x;
        s.z = out.z;
        s.heading = Math.atan2(dir.x, dir.z);
        s.speed = moved / Math.max(dt, 1e-6);
        moving = moved > 0.001;
      } else {
        s.speed = 0;
        stuck.current = 0;
      }
    }
    const cur = state.current;
    if (movingRef.current !== moving) {
      movingRef.current = moving;
      onMovingChange(moving);
    }

    // ── 자세·빗자루 표시
    const flying = cur.y > 0.04 || riding;
    if (flying !== showBroom) setShowBroom(flying);
    const nextPose: AvatarPose = flying ? "sit" : moving ? "walk" : "stand";
    if (nextPose !== pose) setPose(nextPose);

    // ── 배치: 몸통은 진행 방향으로, 비행 중에는 살짝 기울고 흔들린다
    const t = clock.elapsedTime;
    const bob =
      flying && !reducedMotion
        ? Math.sin(t * 1.6) * (cur.speed < 1 ? 0.08 : 0.03)
        : 0;
    g.position.set(cur.x, cur.y + bob, cur.z);
    g.rotation.y = cur.heading;
    if (tilt.current) {
      // 돌아가는 쪽으로 몸을 기울인다. 이 아바타는 +z를 보고 있어 +x가 왼쪽이므로
      // 왼쪽으로 돌 때(heading 증가) 왼쪽으로 기울이려면 z축 회전은 음수다
      const turnRate =
        wrapAngle(cur.heading - prevHeading.current) / Math.max(dt, 1e-6);
      prevHeading.current = cur.heading;
      const wantBank = reducedMotion
        ? 0
        : -Math.max(
            -0.35,
            Math.min(0.35, turnRate * 0.18 * Math.min(1, cur.speed / 4)),
          );
      bank.current += (wantBank - bank.current) * Math.min(1, dt * 4);
      tilt.current.rotation.z = bank.current;
      // 가속 중엔 앞코가 살짝 들리고 멈추면 수평으로
      tilt.current.rotation.x = reducedMotion
        ? 0
        : -Math.min(0.14, cur.speed * 0.02);
    }
    if (avatar.current) avatar.current.position.y = flying ? SIT_Y : 0;

    // ── 내 위치를 알린다 (멈추는 순간은 바로, 그 밖에는 걷거나 날 때 300ms · 가만히 있을 땐 2초)
    if (onMove) {
      const now = performance.now();
      const sent = lastSent.current;
      const stopped = sent.moving && !moving;
      const due = now - sent.at >= (moving ? MOVE_SEND_MS : IDLE_SEND_MS);
      if (stopped || due) {
        lastSent.current = { at: now, moving };
        onMove(cur.x, cur.z, cur.heading, moving, cur.y, flying);
      }
    }

    // ── 반딧불 자취: 날아가는 동안 뒤에 남는 빛
    if (trail.current) {
      if (
        flying &&
        !reducedMotion &&
        cur.speed > 1 &&
        t - lastTrail.current > 0.05
      ) {
        lastTrail.current = t;
        history.current.unshift(
          cur.x - Math.sin(cur.heading) * 1.1,
          cur.y + 0.1,
          cur.z - Math.cos(cur.heading) * 1.1,
        );
        history.current.length = Math.min(history.current.length, TRAIL * 3);
      } else if (history.current.length > 0 && (cur.speed <= 1 || !flying)) {
        // 멈추면 자취가 뒤에서부터 하나씩 사라진다
        history.current.length = Math.max(0, history.current.length - 3);
      }
      for (let i = 0; i < TRAIL; i++) {
        const h = history.current;
        // 기록이 없는 칸은 눈에 보이지 않는 먼 곳에 둔다
        trailPositions[i * 3] = h[i * 3] ?? 0;
        trailPositions[i * 3 + 1] = h[i * 3 + 1] ?? -50;
        trailPositions[i * 3 + 2] = h[i * 3 + 2] ?? 0;
      }
      (
        trail.current.geometry.getAttribute("position") as BufferAttribute
      ).needsUpdate = true;
    }

    // ── 서고 문 가까이 (돌아가기 버튼)
    const near = nearLibraryDoor(cur);
    if (nearRef.current !== near) {
      nearRef.current = near;
      onNearDoorChange(near);
    }

    // ── 카메라: 걸을 때는 가깝게, 날 때는 멀고 높게 (비행 높이만큼 함께 오른다)
    const dist = flying ? CAMERA_DIST.fly : CAMERA_DIST.walk;
    const rig = cameraRig(
      cur,
      orbit.current,
      dist,
      flying ? 4 : 3,
      cur.y,
      GARDEN_CAMERA_BOUNDS,
    );
    camTarget.current.set(rig.cam[0], rig.cam[1] + cur.y, rig.cam[2]);
    lookTarget.current.set(...rig.look);
    const k = 1 - Math.exp(-dt * (dragging.current ? 18 : 5));
    camera.position.lerp(camTarget.current, k);
    look.current.lerp(lookTarget.current, k);
    camera.lookAt(look.current);
  });

  return (
    <>
      <group ref={root}>
        <group ref={tilt}>
          {showBroom ? <BroomModel colors={colors} /> : null}
          <Avatar
            ref={avatar}
            robe={colors[houseToken(house, "primary")]}
            band={colors[houseToken(house, "accent")]}
            collar={colors["--color-scene-collar"]}
            skin={colors["--color-scene-skin"]}
            hat={colors["--color-scene-hat"]}
            pose={pose}
            name="나"
            showLabel={false}
          />
        </group>
      </group>
      {/* 날아간 자리에 남는 도깨비불 */}
      <points ref={trail} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[trailPositions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          color={colors[houseToken(house, "accent")]}
          size={0.45}
          sizeAttenuation
          transparent
          opacity={0.7}
          depthWrite={false}
          toneMapped={false}
          onBeforeCompile={roundGlowShader}
          customProgramCacheKey={roundGlowKey}
        />
      </points>
    </>
  );
}

/* ── 정원의 다른 접속자 ─────────────────────────────────────── */

export interface RemoteRiderProps {
  walker: Walker;
  colors: SceneColors;
  /** 걷는 사람들의 최근 위치 — 매 프레임 읽는다 */
  moves: MutableRefObject<Map<string, RemoteMove>>;
  /** "동작 줄이기" — 기울어짐·흔들림을 없앤다 */
  reducedMotion: boolean;
}

/**
 * 정원에서 걷거나 싸리비를 타고 나는 다른 접속자.
 * 받은 위치(300ms 간격)를 따라가며 보간하고, 날 때는 내 `BroomRider`와 같은 모습(빗자루·기울임)으로 그린다.
 */
export function RemoteRider({
  walker,
  colors,
  moves,
  reducedMotion,
}: RemoteRiderProps) {
  const root = useRef<Group>(null);
  const tilt = useRef<Group>(null);
  const avatar = useRef<Group>(null);
  const cur = useRef<{
    x: number;
    y: number;
    z: number;
    heading: number;
  } | null>(null);
  const prevHeading = useRef(0);
  const bank = useRef(0);
  const [pose, setPose] = useState<AvatarPose>("stand");
  const [showBroom, setShowBroom] = useState(false);

  useFrame(({ clock }, rawDt) => {
    const g = root.current;
    if (!g) return;
    const move = moves.current.get(walker.id);
    // 첫 위치를 받기 전, 또는 서고에서 보낸 위치는 숨긴다 (좌표계가 다르다)
    if (!move || move.place !== "garden") {
      g.visible = false;
      cur.current = null;
      return;
    }
    g.visible = true;
    if (!cur.current) {
      cur.current = { x: move.x, y: move.y, z: move.z, heading: move.ry };
      prevHeading.current = move.ry;
    }
    const c = cur.current;
    const dt = Math.min(rawDt, 0.1);
    const k = 1 - Math.exp(-dt * FOLLOW_RATE);
    const dx = move.x - c.x;
    const dz = move.z - c.z;
    c.x += dx * k;
    c.z += dz * k;
    c.y += (move.y - c.y) * k;
    c.heading += wrapAngle(move.ry - c.heading) * k;

    const flying = c.y > 0.04 || move.riding;
    if (flying !== showBroom) setShowBroom(flying);
    const walking = move.moving || Math.hypot(dx, dz) > 0.1;
    const nextPose: AvatarPose = flying ? "sit" : walking ? "walk" : "stand";
    if (nextPose !== pose) setPose(nextPose);

    const t = clock.elapsedTime;
    const bob = flying && !reducedMotion ? Math.sin(t * 1.6 + c.x) * 0.05 : 0;
    g.position.set(c.x, c.y + bob, c.z);
    g.rotation.y = c.heading;
    if (tilt.current) {
      // 돌아가는 쪽으로 기울이는 방식은 BroomRider와 같다
      const turnRate =
        wrapAngle(c.heading - prevHeading.current) / Math.max(dt, 1e-6);
      prevHeading.current = c.heading;
      const wantBank =
        reducedMotion || !flying
          ? 0
          : -Math.max(-0.35, Math.min(0.35, turnRate * 0.18 * 0.5));
      bank.current += (wantBank - bank.current) * Math.min(1, dt * 4);
      tilt.current.rotation.z = bank.current;
    }
    if (avatar.current) avatar.current.position.y = flying ? SIT_Y : 0;
  });

  return (
    <group ref={root}>
      <group ref={tilt}>
        {showBroom ? <BroomModel colors={colors} /> : null}
        <Avatar
          ref={avatar}
          robe={colors[houseToken(walker.house, "primary")]}
          band={colors[houseToken(walker.house, "accent")]}
          collar={colors["--color-scene-collar"]}
          houseDot={colors[houseToken(walker.house, "accent")]}
          skin={colors["--color-scene-skin"]}
          hat={colors["--color-scene-hat"]}
          pose={pose}
          name={walker.name}
          showLabel
        />
      </group>
    </group>
  );
}
