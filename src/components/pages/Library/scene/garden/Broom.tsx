/** 구름 탈것과 학생 — 숨돌림 뜰에서 걷다가 한국 전통 구름을 타고 하늘을 난다. */
import { useEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  Color,
  DoubleSide,
  IcosahedronGeometry,
  PerspectiveCamera,
  Vector3,
} from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type {
  BufferAttribute,
  Group,
  Mesh,
  Points,
  ShaderMaterial,
} from "three";
import { Avatar } from "../Avatar";
import type { AvatarPose } from "../Avatar";
import type { BodyEffect } from "../spellLogic";
import { FOLLOW_RATE, IDLE_SEND_MS, MOVE_SEND_MS } from "../Characters";
import { roundGlowKey, roundGlowShader } from "../MagicEffect";
import { RUN_MULTIPLIER, cameraRelativeMove, cameraRig } from "../sceneLayout";
import type { Orbit, SceneColors, Vec2 } from "../sceneLayout";
import { houseToken } from "../../houses";
import type { HouseId } from "../../houses";
import type { RemoteMove, Walker } from "../../libraryPresence";
import {
  GARDEN_CAMERA_BOUNDS,
  GARDEN_SPAWN,
  gardenWalkHeight,
  isGrounded,
  nearLibraryDoor,
  nearSchoolBuilding,
  resolveWalk,
  stepFlight,
  tapIntent,
  wrapAngle,
} from "./gardenLayout";
import type { FlightState } from "./gardenLayout";

const WALK_SPEED = 4.0;
/** 아바타를 구름 위에 앉히는 높이 */
const SIT_Y = 0.12;

/* ── 한국 전통 구름 탈것 ────────────────────────────────────── */

function cloudRimShader(shader: { fragmentShader: string }) {
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <emissivemap_fragment>",
    `#include <emissivemap_fragment>
     float cloudRim = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.5);
     totalEmissiveRadiance += diffuse * cloudRim * 0.28;`,
  );
}

/** 바닥에 부드러운 그림자를 투영하고 높이에 따라 크기와 농도를 조절한다. */
function CloudShadow({
  target,
  visible,
}: {
  target: React.RefObject<Group | null>;
  visible: boolean;
}) {
  const mesh = useRef<Mesh>(null);
  const uniforms = useMemo(() => ({ strength: { value: 0 } }), []);
  useFrame(() => {
    if (!mesh.current || !target.current) return;
    const pos = target.current.position;
    const height = Math.max(0, pos.y);
    mesh.current.visible = visible && target.current.visible;
    mesh.current.position.set(pos.x, 0.015, pos.z);
    mesh.current.scale.setScalar(1 + Math.min(height * 0.13, 1.1));
    (mesh.current.material as ShaderMaterial).uniforms.strength.value =
      0.32 / (1 + height * 0.22);
  });
  return (
    <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
      <planeGeometry args={[2.5, 2.5]} />
      <shaderMaterial
        transparent
        depthWrite={false}
        uniforms={uniforms}
        vertexShader="varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }"
        fragmentShader="varying vec2 vUv; uniform float strength; void main() { float d = length((vUv - 0.5) * 2.0); float a = (1.0 - smoothstep(0.05, 1.0, d)); gl_FragColor = vec4(0.025, 0.03, 0.04, strength * a * a); }"
      />
    </mesh>
  );
}

function CloudMist({
  colors,
  reducedMotion,
}: {
  colors: SceneColors;
  reducedMotion: boolean;
}) {
  const points = useRef<Points>(null);
  const positions = useMemo(() => new Float32Array(24 * 3), []);
  useFrame(({ clock }) => {
    const t = reducedMotion ? 0 : clock.elapsedTime;
    for (let i = 0; i < 24; i++) {
      const angle = i * 2.39996;
      const phase = (t * 0.16 + i * 0.173) % 1;
      const radius = 0.34 + phase * 0.36;
      positions[i * 3] = Math.cos(angle + t * 0.06) * radius;
      positions[i * 3 + 1] = -0.13 + phase * 0.26;
      positions[i * 3 + 2] = Math.sin(angle + t * 0.06) * radius;
    }
    if (points.current) {
      (
        points.current.geometry.getAttribute("position") as BufferAttribute
      ).needsUpdate = true;
    }
  });
  return (
    <points ref={points} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={colors["--color-scene-collar"]}
        size={0.55}
        transparent
        opacity={0.2}
        depthWrite={false}
        onBeforeCompile={roundGlowShader}
        customProgramCacheKey={roundGlowKey}
      />
    </points>
  );
}

/**
 * 구름 덩어리 — [x, y, z, 가로, 세로, 깊이, 밝기].
 * 납작한 바닥층 위에 솟은 윗층·앞머리·불룩한 아랫배를 겹쳐 뭉게구름의 층을 만든다.
 * 아래쪽 덩어리일수록 어둡고 윗층일수록 밝다.
 */
const CLOUD_PUFFS: ReadonlyArray<readonly number[]> = [
  // 아랫배 (그늘)
  [0, 0.0, 0, 0.46, 0.12, 0.5, 0.86],
  // 바닥층
  [0, 0.11, 0, 0.56, 0.22, 0.6, 1],
  [-0.4, 0.09, -0.02, 0.36, 0.2, 0.4, 0.97],
  [0.4, 0.09, -0.02, 0.36, 0.2, 0.4, 0.97],
  [-0.22, 0.08, 0.34, 0.34, 0.2, 0.34, 0.99],
  [0.22, 0.08, 0.34, 0.34, 0.2, 0.34, 0.99],
  [-0.24, 0.08, -0.36, 0.34, 0.2, 0.34, 0.95],
  [0.24, 0.08, -0.36, 0.34, 0.2, 0.34, 0.95],
  // 윗층 (밝다)
  [0, 0.2, 0.18, 0.34, 0.17, 0.3, 1.04],
  [-0.26, 0.19, -0.08, 0.26, 0.15, 0.26, 1.02],
  [0.26, 0.19, -0.08, 0.26, 0.15, 0.26, 1.02],
  [0, 0.2, -0.25, 0.28, 0.15, 0.26, 1.0],
  // 앞머리
  [-0.06, 0.06, 0.5, 0.2, 0.12, 0.18, 0.98],
  [0.12, 0.06, 0.48, 0.16, 0.1, 0.16, 0.98],
];

/** 울퉁불퉁한 구 — 모든 덩어리가 공유한다 (정점을 합쳐 부드러운 법선을 얻는다) */
function useCloudGeometry() {
  const geometry = useMemo(() => {
    const raw = new IcosahedronGeometry(1, 3);
    raw.deleteAttribute("normal");
    raw.deleteAttribute("uv");
    const g = mergeVertices(raw);
    raw.dispose();
    const pos = g.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const n =
        (Math.sin(x * 4.9 + y * 3.1) +
          Math.sin(y * 5.7 + z * 4.3) +
          Math.sin(z * 5.1 + x * 3.3)) /
        3;
      const k = 1 + n * 0.11;
      pos.setXYZ(i, x * k, y * k, z * k);
    }
    g.computeVertexNormals();
    return g;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

export function BroomModel({
  colors,
  reducedMotion = false,
}: {
  colors: SceneColors;
  reducedMotion?: boolean;
}) {
  const geometry = useCloudGeometry();
  const puffRefs = useRef<Array<Mesh | null>>([]);
  const tints = useMemo(
    () =>
      CLOUD_PUFFS.map((p) =>
        new Color(colors["--color-scene-collar"]).multiplyScalar(p[6]),
      ),
    [colors],
  );
  // 덩어리마다 박자를 달리해 숨 쉬듯 부풀었다 가라앉는다
  useFrame(({ clock }) => {
    if (reducedMotion) return;
    const t = clock.elapsedTime;
    CLOUD_PUFFS.forEach((p, i) => {
      const m = puffRefs.current[i];
      if (!m) return;
      const breathe = 1 + Math.sin(t * 0.9 + i * 1.7) * 0.03;
      m.scale.set(p[3] * breathe, p[4] * (2 - breathe), p[5] * breathe);
      m.position.y = p[1] + Math.sin(t * 0.7 + i * 2.3) * 0.012;
    });
  });
  const material = (color: Color) => (
    <meshStandardMaterial
      color={color}
      emissive={color}
      emissiveIntensity={0.14}
      roughness={1}
      onBeforeCompile={cloudRimShader}
      customProgramCacheKey={() => "cloud-soft-rim"}
    />
  );
  return (
    <group scale={[1.12, 1.04, 1.12]}>
      {CLOUD_PUFFS.map((puff, index) => (
        <mesh
          key={index}
          ref={(m) => {
            puffRefs.current[index] = m;
          }}
          geometry={geometry}
          position={[puff[0], puff[1], puff[2]]}
          rotation={[0, index * 1.3, 0]}
          scale={[puff[3], puff[4], puff[5]]}
        >
          {material(tints[index])}
        </mesh>
      ))}
      <CloudMist colors={colors} reducedMotion={reducedMotion} />
    </group>
  );
}

/* ── 구름이 지나간 자리에 남는 자취 ───────────────────────────── */

const TRAIL_N = 40;
const TRAIL_LIFE = 1.9;

const TRAIL_VERT = `
attribute float aAge;
attribute float aSeed;
uniform float uPx;
varying float vAge;
varying float vSeed;
void main() {
  vAge = aAge;
  vSeed = aSeed;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float size = (0.5 + aAge * 1.6) * (0.7 + aSeed * 0.6);
  gl_PointSize = aAge >= 1.0 ? 0.0 : size * uPx / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const TRAIL_FRAG = `
uniform vec3 uColor;
varying float vAge;
varying float vSeed;
float hsh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vnoise(vec2 p){
  vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hsh(i),hsh(i+vec2(1.0,0.0)),f.x),mix(hsh(i+vec2(0.0,1.0)),hsh(i+vec2(1.0,1.0)),f.x),f.y);
}
float fbm(vec2 p){return vnoise(p)*0.5+vnoise(p*2.03)*0.25+vnoise(p*4.1)*0.125;}
void main() {
  vec2 pp = (gl_PointCoord - 0.5) * 2.0;
  float r = length(pp);
  float n = fbm(pp * 1.7 + vSeed * 13.0 + vAge * 0.8);
  float edge = 1.0 - smoothstep(0.3, 0.95, r + (n - 0.5) * 0.8);
  float shade = mix(0.78, 1.05, clamp(0.5 - pp.y * 0.5 + (n - 0.5) * 0.5, 0.0, 1.0));
  float life = 1.0 - vAge;
  float a = edge * edge * life * life * smoothstep(0.0, 0.08, vAge + 0.02) * 0.78;
  gl_FragColor = vec4(uColor * shade, a);
  #include <colorspace_fragment>
}`;

/**
 * 구름 뒤로 흩어지는 자취 — 입자마다 나이를 먹으며 커지고 옅어지고 위로 떠오른다.
 * 월드 좌표에 남기 때문에 구름이 움직인 궤적이 그대로 그려진다.
 */
function CloudTrail({
  root,
  speedRef,
  active,
  colors,
  reducedMotion,
}: {
  root: React.RefObject<Group | null>;
  speedRef: MutableRefObject<number>;
  active: boolean;
  colors: SceneColors;
  reducedMotion: boolean;
}) {
  const points = useRef<Points>(null);
  const data = useMemo(
    () => ({
      pos: new Float32Array(TRAIL_N * 3),
      age: new Float32Array(TRAIL_N).fill(1),
      seed: Float32Array.from({ length: TRAIL_N }, (_, i) => {
        const v = Math.sin(i * 91.7 + 3.1) * 43758.5453;
        return v - Math.floor(v);
      }),
      vel: new Float32Array(TRAIL_N * 3),
      head: 0,
      acc: 0,
    }),
    [],
  );
  const uniforms = useMemo(
    () => ({
      uPx: { value: 400 },
      uColor: { value: new Color(colors["--color-scene-collar"]) },
    }),
    [colors],
  );
  const gl = useThree((s) => s.gl);
  const height = useThree((s) => s.size.height);
  useFrame((_, rawDt) => {
    const g = root.current;
    const dt = Math.min(rawDt, 0.1);
    uniforms.uPx.value = height * gl.getPixelRatio() * 0.5;
    const sp = speedRef.current;
    if (g && active && !reducedMotion && sp > 0.8) {
      // 속도가 빠를수록 촘촘히 내보낸다
      data.acc += dt * (4 + sp * 2.2);
      while (data.acc >= 1) {
        data.acc -= 1;
        const i = data.head;
        data.head = (data.head + 1) % TRAIL_N;
        const r1 = Math.random();
        const r2 = Math.random();
        const back = 0.6 + r1 * 0.5;
        const side = (r2 - 0.5) * 0.7;
        const hx = Math.sin(g.rotation.y);
        const hz = Math.cos(g.rotation.y);
        data.pos[i * 3] = g.position.x - hx * back + hz * side;
        data.pos[i * 3 + 1] = g.position.y + 0.02 + r1 * 0.14;
        data.pos[i * 3 + 2] = g.position.z - hz * back - hx * side;
        data.vel[i * 3] = -hx * sp * 0.1 + (r2 - 0.5) * 0.3;
        data.vel[i * 3 + 1] = 0.1 + r1 * 0.14;
        data.vel[i * 3 + 2] = -hz * sp * 0.1 + (r1 - 0.5) * 0.3;
        data.age[i] = 0;
      }
    }
    for (let i = 0; i < TRAIL_N; i++) {
      if (data.age[i] >= 1) continue;
      data.age[i] = Math.min(1, data.age[i] + dt / TRAIL_LIFE);
      const damp = Math.max(0, 1 - 1.4 * dt);
      data.vel[i * 3] *= damp;
      data.vel[i * 3 + 2] *= damp;
      data.pos[i * 3] += data.vel[i * 3] * dt;
      data.pos[i * 3 + 1] += data.vel[i * 3 + 1] * dt;
      data.pos[i * 3 + 2] += data.vel[i * 3 + 2] * dt;
    }
    const geo = points.current?.geometry;
    if (geo) {
      (geo.getAttribute("position") as BufferAttribute).needsUpdate = true;
      (geo.getAttribute("aAge") as BufferAttribute).needsUpdate = true;
    }
  });
  return (
    <points ref={points} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data.pos, 3]} />
        <bufferAttribute attach="attributes-aAge" args={[data.age, 1]} />
        <bufferAttribute attach="attributes-aSeed" args={[data.seed, 1]} />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={TRAIL_VERT}
        fragmentShader={TRAIL_FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={DoubleSide}
      />
    </points>
  );
}

/* ── 타는 사람 ─────────────────────────────────────────────── */

export interface BroomRiderProps {
  colors: SceneColors;
  house: HouseId;
  /** 구름 탈것을 타고 있는지 (false면 걸어 다닌다) */
  riding: boolean;
  /** 키보드 입력 (x: 좌우, y: 화면 위아래) — 매 프레임 읽음. 움직이면 탭 목표는 취소 */
  input: MutableRefObject<{ x: number; y: number }>;
  /** 쉬프트를 누르고 있는지 — 지상 달리기 (매 프레임 읽음) */
  boost: MutableRefObject<boolean>;
  /** 탭한 목표 — 매 프레임 읽고, 도착하면 null로 비운다 */
  target: MutableRefObject<Vec2 | null>;
  orbit: MutableRefObject<Orbit>;
  dragging: MutableRefObject<boolean>;
  /** 서고 문 가까이에 있는지가 바뀔 때만 호출 */
  onNearDoorChange: (near: boolean) => void;
  /** 가까이 있는 학교 건물(이름)이 바뀔 때만 호출 — 없으면 null */
  onNearBuildingChange: (name: string | null) => void;
  /** 움직이는 중(걷기·비행·이륙·착륙)인지가 바뀔 때만 호출 — 부드럽게 그리려고 프레임을 올린다 */
  onMovingChange: (moving: boolean) => void;
  /** "동작 줄이기" — 흔들림·기울어짐·자취를 없애고 천천히 */
  reducedMotion: boolean;
  /** 내 머리 위에 잠깐 뜨는 말풍선 글 */
  bubble?: string;
  /** 내 위치·바라보는 방향(rad)을 매 프레임 기록 — 주문이 앞쪽 구역에 닿는 데 쓴다 */
  positionRef?: MutableRefObject<Vec2>;
  facingRef?: MutableRefObject<number>;
  /** 구름 높이 — 시전 높이를 맞출 때 읽는다 */
  heightRef?: MutableRefObject<number>;
  /** 주문을 시전한 시각(performance.now ms) — 지팡이를 휘두르는 연출 */
  castAt?: number | null;
  wandLightAt?: number | null;
  /** 이 사람에게 걸린 몸 주문(소신·거신·은형) */
  bodyEffect?: BodyEffect | null;
  /** 내 위치를 다른 접속자에게 알린다 (이 안에서 빈도를 조절하므로 그대로 보내면 된다) */
  onMove?: (
    x: number,
    z: number,
    ry: number,
    moving: boolean,
    y: number,
    riding: boolean,
  ) => void;
  /** 처음 서는 곳 (기본: GARDEN_SPAWN) — 서고 문에서 걸어 나올 때는 문 앞 */
  spawn?: Vec2;
}

const CAMERA_DIST = { walk: 7.6, fly: 10.5 };

export function BroomRider({
  colors,
  house,
  riding,
  input,
  boost,
  target,
  orbit,
  dragging,
  onNearDoorChange,
  onNearBuildingChange,
  onMovingChange,
  reducedMotion,
  bubble,
  positionRef,
  facingRef,
  heightRef,
  castAt,
  wandLightAt,
  bodyEffect,
  onMove,
  spawn,
}: BroomRiderProps) {
  const lastSent = useRef({ at: 0, moving: false });
  const root = useRef<Group>(null);
  const tilt = useRef<Group>(null);
  const avatar = useRef<Group>(null);
  const speedRef = useRef(0);
  const baseFov = useRef<number | null>(null);
  const pitch = useRef(0);
  const prevY = useRef(0);
  const state = useRef<FlightState>({
    x: (spawn ?? GARDEN_SPAWN).x,
    z: (spawn ?? GARDEN_SPAWN).z,
    y: 0,
    heading: 0, // 처음엔 남쪽(+z), 뜰 쪽을 바라봄
    speed: 0,
  });
  const bank = useRef(0);
  const prevHeading = useRef(0);
  const stuck = useRef(0);
  const nearRef = useRef<boolean | null>(null);
  const nearBuildingRef = useRef<string | null>(null);
  const movingRef = useRef<boolean | null>(null);
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
        const step =
          WALK_SPEED * (boost.current ? RUN_MULTIPLIER : 1) * slow * dt;
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
        // 걷는 동안엔 비행 속도(speed)를 0으로 둔다. 0.05 이상이면 isGrounded가 거짓이 되어
        // 다음 프레임이 비행(착륙) 계산으로 넘어가 속도가 서서히 줄다 다시 걷기로 튀는
        // 톱니 모양 끊김이 생긴다.
        s.speed = 0;
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

    // ── 자세·구름 탈것 표시
    const flying = cur.y > 0.04 || riding;
    if (flying !== showBroom) setShowBroom(flying);
    const nextPose: AvatarPose = flying
      ? "ride"
      : moving
        ? boost.current
          ? "run"
          : "walk"
        : "stand";
    if (nextPose !== pose) setPose(nextPose);

    // ── 배치: 몸통은 진행 방향으로, 비행 중에는 살짝 기울고 흔들린다
    const t = clock.elapsedTime;
    const bob =
      flying && !reducedMotion
        ? Math.sin(t * 1.6) * (cur.speed < 1 ? 0.08 : 0.03)
        : 0;
    const groundHeight = gardenWalkHeight(cur);
    const visualY = Math.max(cur.y, groundHeight) + bob;
    g.position.set(cur.x, visualY, cur.z);
    g.rotation.y = cur.heading;
    speedRef.current = cur.speed;
    if (positionRef) positionRef.current = { x: cur.x, z: cur.z };
    if (facingRef) facingRef.current = cur.heading;
    if (heightRef) heightRef.current = cur.y;
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
      // 가속하면 앞코가 숙고, 오르내림에 따라 코를 들거나 내린다. 부드럽게 따라간다
      const vy = (cur.y - prevY.current) / Math.max(dt, 1e-6);
      prevY.current = cur.y;
      const wantPitch = reducedMotion
        ? 0
        : -Math.min(0.16, cur.speed * 0.022) -
          Math.max(-0.12, Math.min(0.12, vy * 0.05));
      pitch.current += (wantPitch - pitch.current) * Math.min(1, dt * 3.5);
      tilt.current.rotation.x = pitch.current;
      // 바람에 흔들리듯 옆으로 아주 천천히 흔들린다
      if (!reducedMotion && flying) {
        tilt.current.rotation.z +=
          Math.sin(t * 1.15) * 0.022 * (1 + Math.min(cur.speed, 8) * 0.08);
      }
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

    // ── 서고 문 가까이 (돌아가기 버튼)
    const near = nearLibraryDoor(cur);
    if (nearRef.current !== near) {
      nearRef.current = near;
      onNearDoorChange(near);
    }
    const building = nearSchoolBuilding(cur)?.name ?? null;
    if (nearBuildingRef.current !== building) {
      nearBuildingRef.current = building;
      onNearBuildingChange(building);
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
    // 속도감: 빠를수록 시야가 살짝 넓어진다
    if (camera instanceof PerspectiveCamera) {
      if (baseFov.current === null) baseFov.current = camera.fov;
      const wantFov =
        baseFov.current + (reducedMotion ? 0 : Math.min(cur.speed * 0.5, 6));
      if (Math.abs(camera.fov - wantFov) > 0.01) {
        camera.fov += (wantFov - camera.fov) * Math.min(1, dt * 3);
        camera.updateProjectionMatrix();
      }
    }
  });

  return (
    <>
      <group ref={root}>
        <group ref={tilt}>
          {showBroom ? (
            <BroomModel colors={colors} reducedMotion={reducedMotion} />
          ) : null}
          <Avatar
            ref={avatar}
            house={house}
            robe={colors[houseToken(house, "primary")]}
            band={colors[houseToken(house, "accent")]}
            collar={colors["--color-scene-collar"]}
            skin={colors["--color-scene-skin"]}
            hat={colors["--color-scene-hat"]}
            pose={pose}
            footstep="grass"
            castAt={castAt}
            wandLightAt={wandLightAt}
            bodyEffect={bodyEffect}
            wand={{
              wood: colors["--color-scene-wood-dark"],
              glow: colors["--color-scene-flame"],
            }}
            name="나"
            showLabel={false}
            bubble={bubble}
          />
        </group>
      </group>
      <CloudShadow target={root} visible={showBroom} />
      {/* 날아간 자리에 남는 구름 자취 */}
      <CloudTrail
        root={root}
        speedRef={speedRef}
        active={showBroom}
        colors={colors}
        reducedMotion={reducedMotion}
      />
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
  /** 머리 위 말풍선 글 */
  bubble?: string;
  /** 이 사람이 주문을 시전한 시각(performance.now ms) — 지팡이를 휘두르는 연출 */
  castAt?: number | null;
  wandLightAt?: number | null;
  /** 이 사람에게 걸린 몸 주문(소신·거신·은형) */
  bodyEffect?: BodyEffect | null;
}

/**
 * 정원에서 걷거나 구름 탈것을 타고 나는 다른 접속자.
 * 받은 위치(300ms 간격)를 따라가며 보간하고, 날 때는 내 `BroomRider`와 같은 모습(구름·기울임)으로 그린다.
 */
export function RemoteRider({
  walker,
  colors,
  moves,
  reducedMotion,
  bubble,
  castAt = null,
  wandLightAt = null,
  bodyEffect = null,
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
  const speedRef = useRef(0);
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
    // 따라가는 속도로 구름 꼬리·자취의 세기를 정한다
    const est = Math.hypot(dx * k, dz * k) / Math.max(dt, 1e-6);
    speedRef.current += (est - speedRef.current) * Math.min(1, dt * 4);

    const flying = c.y > 0.04 || move.riding;
    if (flying !== showBroom) setShowBroom(flying);
    const walking = move.moving || Math.hypot(dx, dz) > 0.1;
    const nextPose: AvatarPose = flying ? "ride" : walking ? "walk" : "stand";
    if (nextPose !== pose) setPose(nextPose);

    const t = clock.elapsedTime;
    const bob = flying && !reducedMotion ? Math.sin(t * 1.6 + c.x) * 0.05 : 0;
    g.position.set(c.x, Math.max(c.y, gardenWalkHeight(c)) + bob, c.z);
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
    <>
      <group ref={root}>
        <group ref={tilt}>
          {showBroom ? (
            <BroomModel colors={colors} reducedMotion={reducedMotion} />
          ) : null}
          <Avatar
            ref={avatar}
            house={walker.house}
            robe={colors[houseToken(walker.house, "primary")]}
            band={colors[houseToken(walker.house, "accent")]}
            collar={colors["--color-scene-collar"]}
            houseDot={colors[houseToken(walker.house, "accent")]}
            skin={colors["--color-scene-skin"]}
            hat={colors["--color-scene-hat"]}
            pose={pose}
            castAt={castAt}
            wandLightAt={wandLightAt}
            bodyEffect={bodyEffect}
            wand={{
              wood: colors["--color-scene-wood-dark"],
              glow: colors["--color-scene-flame"],
            }}
            name={walker.name}
            showLabel
            bubble={bubble}
          />
        </group>
      </group>
      <CloudShadow target={root} visible={showBroom} />
      <CloudTrail
        root={root}
        speedRef={speedRef}
        active={showBroom}
        colors={colors}
        reducedMotion={reducedMotion}
      />
    </>
  );
}
