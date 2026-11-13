import {
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  LatheGeometry,
  MathUtils,
  RepeatWrapping,
  SRGBColorSpace,
  TubeGeometry,
  Vector2,
  Vector3,
} from "three";
import type { Group, Mesh, PointLight } from "three";
import {
  MASK_WHITE_TOKEN,
  readSceneColors,
  rootToken,
} from "./scene/sceneLayout";
import type { SceneColors } from "./scene/sceneLayout";

/**
 * 사신갓 3D — 사신등 불빛이 깃들어 학생의 마음을 읽고 기숙사를 외치는 의식용 갓.
 * 평면 그림(`MagicGat`)과 같은 프롭을 쓰며, WebGL이 없을 때는 그쪽을 대신 쓴다.
 * 늘어진 대우, 주름진 양태, 눈 주름과 갈라진 입, 갓끈이 있고 색은 모두 장면 토큰에서 온다.
 */

export interface MagicGat3DProps {
  /** 가로 크기(px). 세로는 비율에 맞춰 따라온다 */
  size?: number;
  /** 말하는 중 — 입이 달싹이고 갓이 고개를 까딱인다 */
  talking?: boolean;
  /** 외치는 순간 — 한 번 크게 부풀며 빛이 번진다 */
  shout?: boolean;
}

/* ── 모양 (three 없이 계산하는 순수 함수 — 테스트 대상) ─────── */

/** 대우(갓의 둥근 윗부분) 윤곽 [반지름, 높이]. 아래에서 위로 */
export const CROWN_PROFILE: ReadonlyArray<readonly [number, number]> = [
  [0.5, 0],
  [0.49, 0.15],
  [0.47, 0.35],
  [0.45, 0.55],
  [0.43, 0.75],
  [0.4, 0.95],
  [0.33, 1.08],
  [0.2, 1.16],
  [0, 1.19],
];

/** 양태(넓은 챙) 단면 [반지름, 높이]. 위쪽 면을 따라 나갔다가 아래쪽 면으로 돌아온다 */
export const BRIM_PROFILE: ReadonlyArray<readonly [number, number]> = [
  [0.46, 0.05],
  [0.8, 0.03],
  [1.1, -0.01],
  [1.34, -0.07],
  [1.36, -0.1],
  [1.1, -0.05],
  [0.8, -0.01],
  [0.46, 0],
];

/** 높이 y에서 대우의 반지름 (윤곽을 선형으로 이은 값) */
export function crownRadiusAt(y: number): number {
  const p = CROWN_PROFILE;
  if (y <= p[0][1]) return p[0][0];
  for (let i = 1; i < p.length; i++) {
    if (y <= p[i][1]) {
      const [r0, y0] = p[i - 1];
      const [r1, y1] = p[i];
      return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
    }
  }
  return p[p.length - 1][0];
}

/** 대우 눈 높이에서 입 높이 등 얼굴 부위의 높이 */
export const FACE = { eyeY: 0.62, browY: 0.76, mouthY: 0.3 } as const;

/** 갓이 내려와 자리 잡는 데 걸리는 시간(초) */
export const DROP_SECONDS = 0.8;
/** 외치는 동작의 길이(초) */
export const SHOUT_SECONDS = 0.65;

/** 시작 후 `sec`초의 낙하 — 위에서 내려오며 기울어졌다가 곧게 선다 */
export function dropOffset(sec: number): { y: number; tilt: number } {
  const p = MathUtils.clamp(sec / DROP_SECONDS, 0, 1);
  const eased = 1 - (1 - p) ** 3;
  return { y: (1 - eased) * 2.4, tilt: (1 - eased) * -0.25 };
}

/**
 * 입이 벌어진 정도(0 닫힘~1 활짝). 말하는 동안은 빠르게 여닫고,
 * 외치는 동안(`shoutSec`이 있을 때)은 활짝 벌렸다가 천천히 닫는다.
 */
export function mouthOpenness(
  sec: number,
  talking: boolean,
  shoutSec: number | null,
): number {
  if (shoutSec !== null) {
    return shoutSec < 0.55 ? 1 : Math.max(0.05, 1 - (shoutSec - 0.55) * 3);
  }
  return talking ? 0.3 + 0.7 * Math.abs(Math.sin(sec * 13)) : 0.05;
}

/** 외칠 때 한 번 부푸는 배율. 외치지 않으면 1 */
export function shoutScale(shoutSec: number | null): number {
  if (shoutSec === null) return 1;
  const p = MathUtils.clamp(shoutSec / SHOUT_SECONDS, 0, 1);
  return 1 + 0.16 * Math.sin(Math.PI * p);
}

/** 눈 세로 크기 — 3.4초마다 한 번 깜빡인다 */
export function blinkScale(sec: number): number {
  const phase = sec % 3.4;
  if (phase < 3.22) return 1;
  const k = Math.abs((phase - 3.22) / 0.09 - 1); // 0(감김)~1(뜸)
  return 0.12 + 0.88 * MathUtils.clamp(k, 0, 1);
}

/* ── 모델 ────────────────────────────────────────────── */

/** 정점마다 밝기를 곱해 낡고 얼룩진 천 느낌을 낸다 */
function addWear(
  geometry: BufferGeometry,
  shade: (x: number, y: number, z: number, theta: number) => number,
) {
  const pos = geometry.getAttribute("position");
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const v = shade(x, y, z, Math.atan2(z, x));
    colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = v;
  }
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
}

/** 위로 갈수록 한쪽으로 늘어지고 주름이 진 대우 */
function buildCrown(): BufferGeometry {
  const g = new LatheGeometry(
    CROWN_PROFILE.map(([r, y]) => new Vector2(r, y)),
    56,
  );
  const pos = g.getAttribute("position");
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z);
    const t = Math.atan2(z, x);
    // 갓이 꺾이며 접힌 자국
    const crease = 1 - 0.07 * Math.exp(-(((y - 0.62) / 0.045) ** 2));
    const wrinkle =
      1 +
      (Math.sin(t * 5 + y * 7) * 0.025 + Math.sin(t * 13 - y * 11) * 0.012) *
        (0.3 + y);
    const rr = r * crease * wrinkle;
    pos.setXYZ(
      i,
      Math.cos(t) * rr + 0.16 * y * y,
      y - 0.04 * y * y,
      Math.sin(t) * rr - 0.05 * y * y,
    );
  }
  addWear(g, (_x, y, _z, t) => {
    const patch = 0.5 + 0.5 * Math.sin(t * 3 + y * 4.5);
    return (0.72 + 0.28 * patch) * (0.8 + 0.2 * Math.min(1, y / 0.4));
  });
  g.computeVertexNormals();
  return g;
}

/** 가장자리가 물결치고 앞뒤로 처진 양태 */
function buildBrim(): BufferGeometry {
  const g = new LatheGeometry(
    BRIM_PROFILE.map(([r, y]) => new Vector2(r, y)),
    72,
  );
  const pos = g.getAttribute("position");
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z);
    const t = Math.atan2(z, x);
    const e = MathUtils.clamp((r - 0.46) / 0.9, 0, 1);
    const rr = r * (1 + Math.sin(t * 9) * 0.012 * e);
    const ny =
      y +
      Math.sin(t * 7 + 1) * 0.035 * e +
      Math.sin(t * 3) * 0.03 * e * e -
      0.06 * e * e * (1 + Math.cos(2 * t));
    pos.setXYZ(i, Math.cos(t) * rr, ny, Math.sin(t) * rr);
  }
  addWear(g, (_x, _y, _z, t) => {
    const e = 0.5 + 0.5 * Math.sin(t * 4 + 2);
    return 0.68 + 0.3 * e;
  });
  g.computeVertexNormals();
  return g;
}

/** 방사형 번짐 — 갓 뒤에서 번지는 사신등 불빛 */
function buildHalo(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    // 알파 마스크용 흰색은 토큰에서 읽는다. 색은 재질의 color가 입힌다
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, rootToken(MASK_WHITE_TOKEN));
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** 갓끈 한 가닥 — 양태 옆에서 앞쪽으로 휘어 내려온다 */
function buildStrap(side: number): BufferGeometry {
  const curve = new CatmullRomCurve3([
    new Vector3(side * 0.5, 0.03, 0.22),
    new Vector3(side * 0.58, -0.22, 0.38),
    new Vector3(side * 0.5, -0.55, 0.32),
  ]);
  return new TubeGeometry(curve, 20, 0.018, 6, false);
}

const STRAP_TIP: ReadonlyArray<[number, number, number]> = [
  [-0.5, -0.57, 0.32],
  [0.5, -0.57, 0.32],
];

function GatModel({
  colors,
  talking,
  shout,
}: {
  colors: SceneColors;
  talking: boolean;
  shout: boolean;
}) {
  const fabric = useTexture(
    `${import.meta.env.BASE_URL}textures/hanbok-fabric.jpg`,
    (texture) => {
      texture.colorSpace = SRGBColorSpace;
      texture.anisotropy = 4;
    },
  );
  // 한복 천의 실제 섬유 사진을 부위별 크기로 반복해 대우와 양태의 결을 살린다.
  const [crownFabric, brimFabric] = useMemo(() => {
    const crownTexture = fabric.clone();
    crownTexture.wrapS = crownTexture.wrapT = RepeatWrapping;
    crownTexture.repeat.set(3, 2);
    crownTexture.anisotropy = 8;
    crownTexture.needsUpdate = true;
    const brimTexture = fabric.clone();
    brimTexture.wrapS = brimTexture.wrapT = RepeatWrapping;
    brimTexture.repeat.set(4, 2);
    brimTexture.anisotropy = 8;
    brimTexture.needsUpdate = true;
    return [crownTexture, brimTexture];
  }, [fabric]);
  const crown = useMemo(buildCrown, []);
  const brim = useMemo(buildBrim, []);
  const halo = useMemo(buildHalo, []);
  const straps = useMemo(() => [buildStrap(-1), buildStrap(1)], []);
  useEffect(
    () => () => {
      crown.dispose();
      brim.dispose();
      halo.dispose();
      straps.forEach((s) => s.dispose());
      crownFabric.dispose();
      brimFabric.dispose();
    },
    [crown, brim, halo, straps, crownFabric, brimFabric],
  );

  const tint = useMemo(
    () =>
      new Color(colors["--color-scene-hat"]).lerp(
        new Color(colors["--color-scene-stone"]),
        0.35,
      ),
    [colors],
  );
  const patchTint = useMemo(
    () => tint.clone().lerp(new Color(colors["--color-scene-wood-light"]), 0.5),
    [tint, colors],
  );

  const root = useRef<Group>(null);
  const hat = useRef<Group>(null);
  const mouth = useRef<Mesh>(null);
  const mouthGlow = useRef<Mesh>(null);
  const eyes = useRef<Group>(null);
  const brows = useRef<Group>(null);
  const haloMesh = useRef<Mesh>(null);
  const light = useRef<PointLight>(null);
  const shoutAt = useRef<number | null>(null);
  const open = useRef(0.05);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (shout && shoutAt.current === null) shoutAt.current = t;
    const shoutSec = shoutAt.current === null ? null : t - shoutAt.current;

    const drop = dropOffset(t);
    if (root.current) {
      root.current.position.y = drop.y + Math.sin(t * 2.1) * 0.03;
      root.current.rotation.z = drop.tilt;
      root.current.scale.setScalar(shoutScale(shoutSec));
    }
    if (hat.current) {
      // 둘러보듯 천천히 돌고, 외칠 때는 정면을 본다. 말할 때는 고개를 까딱인다
      const settled = shoutSec === null ? 1 : 0;
      hat.current.rotation.y = Math.sin(t * 0.9) * 0.28 * settled;
      hat.current.rotation.z = 0.05 + Math.sin(t * 1.3) * 0.025;
      hat.current.rotation.x =
        (talking && shoutSec === null ? Math.sin(t * 6.5) * 0.04 : 0) +
        (shoutSec !== null ? -0.06 : 0);
    }

    const target = mouthOpenness(t, talking, shoutSec);
    open.current += (target - open.current) * 0.4;
    if (mouth.current) mouth.current.scale.y = 0.02 + open.current * 0.085;
    if (mouthGlow.current) {
      mouthGlow.current.scale.y = 0.012 + open.current * 0.07;
      mouthGlow.current.visible = open.current > 0.12;
    }
    if (eyes.current) eyes.current.scale.y = blinkScale(t);
    if (brows.current) {
      brows.current.position.y =
        shoutSec !== null ? 0.035 : talking ? Math.sin(t * 6.5) * 0.008 : 0;
    }
    const shine = shoutSec !== null ? 1 : talking ? 0.55 : 0.3;
    if (light.current) light.current.intensity = 1.4 + shine * 3;
    if (haloMesh.current) {
      const m = haloMesh.current.material as { opacity: number };
      m.opacity = 0.12 + shine * 0.32;
      haloMesh.current.scale.setScalar(1 + shine * 0.25);
    }
  });

  const dark = colors["--color-scene-wood-dark"];
  const flame = colors["--color-scene-flame"];
  const faceR = crownRadiusAt(FACE.eyeY);
  const mouthR = crownRadiusAt(FACE.mouthY);
  const browR = crownRadiusAt(FACE.browY);

  return (
    <group ref={root}>
      {/* 뒤에서 번지는 사신등 불빛 */}
      <mesh ref={haloMesh} position={[0.05, 0.5, -0.9]}>
        <planeGeometry args={[4.4, 4.4]} />
        <meshBasicMaterial
          map={halo}
          color={flame}
          transparent
          opacity={0.2}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <group ref={hat} position={[0, -0.35, 0]}>
        {/* 양태와 대우 */}
        <mesh geometry={brim}>
          <meshStandardMaterial
            vertexColors
            color={tint}
            map={brimFabric}
            bumpMap={brimFabric}
            bumpScale={0.018}
            roughness={0.93}
            side={DoubleSide}
          />
        </mesh>
        <mesh geometry={crown} position={[0, 0.04, 0]}>
          <meshStandardMaterial
            vertexColors
            color={tint}
            map={crownFabric}
            bumpMap={crownFabric}
            bumpScale={0.018}
            roughness={0.9}
            side={DoubleSide}
          />
        </mesh>

        {/* 대우 밑동을 두른 띠와 꿰맨 자국 */}
        <mesh position={[0.0, 0.07, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.5, 0.022, 8, 56]} />
          <meshStandardMaterial color={dark} roughness={0.7} />
        </mesh>
        <mesh position={[0.02, 0.66, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.44, 0.008, 6, 56]} />
          <meshStandardMaterial color={dark} roughness={0.9} />
        </mesh>

        {/* 덧대어 기운 천 조각과 바느질 */}
        <group
          position={[
            Math.sin(-0.95) * (crownRadiusAt(0.55) + 0.003) + 0.03,
            0.58,
            Math.cos(-0.95) * (crownRadiusAt(0.55) + 0.003),
          ]}
          rotation={[0, -0.95, 0.06]}
        >
          <mesh>
            <boxGeometry args={[0.2, 0.15, 0.02]} />
            <meshStandardMaterial
              color={patchTint}
              map={crownFabric}
              bumpMap={crownFabric}
              bumpScale={0.012}
              roughness={0.95}
            />
          </mesh>
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2;
            return (
              <mesh
                key={i}
                position={[Math.cos(a) * 0.1, Math.sin(a) * 0.075, 0.012]}
                rotation={[0, 0, a]}
              >
                <boxGeometry args={[0.035, 0.007, 0.006]} />
                <meshStandardMaterial color={dark} roughness={0.9} />
              </mesh>
            );
          })}
        </group>

        {/* 얼굴: 눈썹의 주름, 불빛이 새는 눈, 갈라진 입 */}
        <group ref={brows}>
          {[-1, 1].map((side) => (
            <mesh
              key={side}
              position={[side * 0.17 + 0.02, FACE.browY, browR + 0.002]}
              rotation={[0, 0, side * -0.28]}
            >
              <torusGeometry args={[0.085, 0.014, 6, 16, Math.PI * 0.75]} />
              <meshStandardMaterial color={dark} roughness={0.8} />
            </mesh>
          ))}
        </group>
        <group ref={eyes} position={[0, FACE.eyeY, 0]}>
          {[-1, 1].map((side) => (
            <mesh
              key={side}
              position={[side * 0.17 + 0.02, 0, faceR + 0.004]}
              scale={[0.065, 0.1, 0.03]}
            >
              <sphereGeometry args={[1, 20, 14]} />
              <meshBasicMaterial color={flame} toneMapped={false} />
            </mesh>
          ))}
        </group>
        <mesh
          ref={mouth}
          position={[0.02, FACE.mouthY, mouthR + 0.004]}
          scale={[0.2, 0.02, 0.05]}
        >
          <sphereGeometry args={[1, 20, 14]} />
          <meshStandardMaterial color={dark} roughness={0.9} />
        </mesh>
        <mesh
          ref={mouthGlow}
          position={[0.02, FACE.mouthY, mouthR + 0.02]}
          scale={[0.16, 0.012, 0.02]}
          visible={false}
        >
          <sphereGeometry args={[1, 16, 10]} />
          <meshBasicMaterial color={flame} toneMapped={false} />
        </mesh>

        {/* 갓끈 */}
        {straps.map((geometry, i) => (
          <mesh key={i} geometry={geometry}>
            <meshStandardMaterial
              color={colors["--color-scene-light"]}
              roughness={0.5}
            />
          </mesh>
        ))}
        {STRAP_TIP.map((at, i) => (
          <mesh key={i} position={at}>
            <sphereGeometry args={[0.032, 12, 8]} />
            <meshStandardMaterial
              color={colors["--color-scene-light"]}
              roughness={0.5}
            />
          </mesh>
        ))}
      </group>

      {/* 입에서 새는 불빛 — 이 장면 안에서만 켜는 점광원 하나 */}
      <pointLight
        ref={light}
        position={[0.1, 0.1, 1.3]}
        color={flame}
        intensity={2}
        distance={6}
        decay={1.6}
      />
    </group>
  );
}

const frameStyle = (size: number): CSSProperties => ({
  width: size,
  height: size * 0.8,
  position: "relative",
});

/** 외친 뒤 이만큼(ms) 지나면 그리기를 멈춘다 — 입장 화면에서 GPU를 쓰지 않게 */
const SETTLE_MS = 1500;

export function MagicGat3D({
  size = 200,
  talking = false,
  shout = false,
}: MagicGat3DProps) {
  const box = useRef<HTMLDivElement>(null);
  const [colors, setColors] = useState<SceneColors | null>(null);
  useLayoutEffect(() => {
    if (box.current) setColors(readSceneColors(box.current));
  }, []);

  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (!shout) return;
    const id = window.setTimeout(() => setPaused(true), SETTLE_MS);
    return () => window.clearTimeout(id);
  }, [shout]);

  return (
    <div ref={box} style={frameStyle(size)} aria-hidden>
      {colors ? (
        <Canvas
          dpr={[1, 2]}
          frameloop={paused ? "never" : "always"}
          camera={{ position: [0, 0.35, 5.6], fov: 30, near: 0.1, far: 30 }}
          gl={{ alpha: true, antialias: true }}
          style={{ width: "100%", height: "100%" }}
        >
          <ambientLight
            intensity={0.9}
            color={colors["--color-scene-collar"]}
          />
          <directionalLight
            position={[2, 4, 5]}
            intensity={1.3}
            color={colors["--color-scene-collar"]}
          />
          <directionalLight
            position={[-4, 2, -3]}
            intensity={1.1}
            color={colors["--color-scene-flame"]}
          />
          <Suspense fallback={null}>
            <GatModel colors={colors} talking={talking} shout={shout} />
          </Suspense>
        </Canvas>
      ) : null}
    </div>
  );
}
