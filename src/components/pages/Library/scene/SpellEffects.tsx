/**
 * 구역에 나타나는 주문 연출. 시전 하나가 구역 하나(반지름 CAST_RADIUS)만 쓰고 파티클은 MAX_PARTICLES 이하다.
 * 명경의 빛은 아바타 지팡이에 붙고, 소신·거신·은형은 아바타 모습이 바뀌므로 여기서 따로 그리지 않는다.
 */
import { useCallback, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  CanvasTexture,
  CapsuleGeometry,
  CatmullRomCurve3,
  Color,
  LatheGeometry,
  NormalBlending,
  SRGBColorSpace,
  TubeGeometry,
  Vector2,
  Vector3,
} from "three";
import type {
  BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  PointLight,
} from "three";
import { roundGlowShader } from "./MagicEffect";
import type { SceneColors } from "./sceneLayout";
import {
  CAST_DISTANCE,
  PARTICLE_COUNTS,
  SPELLS,
  castProgress,
} from "./spellLogic";
import type { SpellCast } from "./spellLogic";

/** 0~1 결정적 의사난수 (입자마다 고정) */
function hash(i: number, salt = 0): number {
  const x = Math.sin(i * 127.1 + salt * 311.7 + 17.3) * 43758.5453;
  return x - Math.floor(x);
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (v: number) => {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
};

/** 부드러운 방사형 번짐 텍스처 (바닥 불빛·후광용) — 한 번만 만들어 공유 */
let haloTexture: CanvasTexture | null = null;
function getHalo(): CanvasTexture {
  if (haloTexture) return haloTexture;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.35, "rgba(255,255,255,0.45)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  }
  haloTexture = new CanvasTexture(canvas);
  haloTexture.colorSpace = SRGBColorSpace;
  return haloTexture;
}

/** 효과 시작 직후 `inMs`에 걸쳐 나타나고 끝나기 전 `outMs`에 걸쳐 사라지는 0~1 */
function fade(p: number, totalMs: number, inMs: number, outMs: number) {
  const t = p * totalMs;
  return smooth(t / inMs) * smooth((totalMs - t) / outMs);
}

const NOISE_GLSL = `
varying float vSeed;
uniform float uShapeTime;
float hsh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vnoise(vec2 p){
  vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hsh(i),hsh(i+vec2(1.0,0.0)),f.x),mix(hsh(i+vec2(0.0,1.0)),hsh(i+vec2(1.0,1.0)),f.x),f.y);
}
float fbm(vec2 p){return vnoise(p)*0.5+vnoise(p*2.03)*0.25+vnoise(p*4.1)*0.125;}
`;

/** 불꽃: 노이즈로 일렁이는 혀 모양. 속은 희고 뜨겁고 끝으로 갈수록 붉어진다 */
const FLAME_GLSL = `
float h = 1.0 - gl_PointCoord.y;
float x = (gl_PointCoord.x - 0.5) * 2.0;
float n = fbm(vec2(x * 1.4 + vSeed * 10.0, h * 3.5 - uShapeTime * (1.6 + vSeed)));
float bend = (n - 0.45) * 0.6 * h + sin(h * 6.0 - uShapeTime * 5.0 + vSeed * 6.28) * 0.08 * h;
float width = 0.62 * pow(max(0.0, 1.0 - h), 0.6) * smoothstep(0.0, 0.12, h) + 0.03;
float dx = abs(x - bend);
float body = 1.0 - smoothstep(width * 0.35, width, dx + (n - 0.5) * 0.25 * h);
float tip = (1.0 - smoothstep(0.55 + n * 0.3, 1.0, h)) * smoothstep(0.0, 0.06, h);
float core = (1.0 - smoothstep(width * 0.05, width * 0.55, dx)) * (1.0 - smoothstep(0.1, 0.6, h));
float heat = clamp(core * 1.2 + (1.0 - h) * 0.35, 0.0, 1.0);
diffuseColor.rgb *= mix(vec3(1.0, 0.55, 0.35), vec3(1.0), heat) * mix(0.85, 1.9, core);
diffuseColor.rgb += vec3(0.5) * core * core;
diffuseColor.a *= body * tip;
`;

/** 뭉게구름·연기: 노이즈로 가장자리가 뭉글뭉글하고 윗면이 밝다 */
const PUFF_GLSL = `
vec2 pp = (gl_PointCoord - 0.5) * 2.0;
float pr = length(pp);
float pn = fbm(pp * 1.8 + vSeed * 17.0 + uShapeTime * 0.15);
float pedge = 1.0 - smoothstep(0.3, 0.95, pr + (pn - 0.5) * 0.75);
diffuseColor.rgb *= mix(0.7, 1.08, clamp(0.5 - pp.y * 0.5 + (pn - 0.5) * 0.5, 0.0, 1.0));
diffuseColor.a *= pedge * pedge;
`;

type GlowShape = "round" | "flame" | "puff";

/** 광점 한 무리 — 위치는 부모가 프레임마다 채운다 */
function Glow({
  pointsRef,
  matRef,
  positions,
  color,
  size,
  additive = true,
  shape = "round",
}: {
  pointsRef: React.RefObject<Points | null>;
  matRef: React.RefObject<PointsMaterial | null>;
  positions: Float32Array;
  color: string | Color;
  size: number;
  additive?: boolean;
  shape?: GlowShape;
}) {
  const uTime = useMemo(() => ({ value: 0 }), []);
  const seeds = useMemo(() => {
    const a = new Float32Array(positions.length / 3);
    for (let i = 0; i < a.length; i++) a[i] = hash(i, 9);
    return a;
  }, [positions]);
  const onBeforeCompile = useCallback(
    (shader: {
      vertexShader: string;
      fragmentShader: string;
      uniforms: Record<string, { value: unknown }>;
    }) => {
      if (shape === "round") {
        roundGlowShader(shader);
        return;
      }
      shader.uniforms.uShapeTime = uTime;
      shader.vertexShader = shader.vertexShader
        .replace(
          "void main() {",
          "attribute float aSeed;\nvarying float vSeed;\nvoid main() {",
        )
        .replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvSeed = aSeed;",
        );
      shader.fragmentShader = shader.fragmentShader
        .replace("void main() {", `${NOISE_GLSL}\nvoid main() {`)
        .replace(
          "#include <map_particle_fragment>",
          shape === "flame" ? FLAME_GLSL : PUFF_GLSL,
        );
    },
    [shape, uTime],
  );
  useFrame(({ clock }) => {
    if (shape !== "round") uTime.value = clock.elapsedTime;
  });
  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSeed" args={[seeds, 1]} />
      </bufferGeometry>
      <pointsMaterial
        ref={matRef}
        color={color}
        size={size}
        sizeAttenuation
        transparent
        opacity={0}
        blending={additive ? AdditiveBlending : NormalBlending}
        depthWrite={false}
        toneMapped={false}
        onBeforeCompile={onBeforeCompile}
        customProgramCacheKey={() => `glow-${shape}-v2`}
      />
    </points>
  );
}

function touch(points: Points | null) {
  const attr = points?.geometry.getAttribute("position") as
    | BufferAttribute
    | undefined;
  if (attr) attr.needsUpdate = true;
}

interface EffectProps {
  cast: SpellCast;
  colors: SceneColors;
}

/* ── 묵령: 먹물이 스며들 듯 번져 흩어진다 (남의 불빛은 건드리지 않음) ── */

const SMOKE = PARTICLE_COUNTS.mukryeong;

function Mukryeong({ cast, colors }: EffectProps) {
  const root = useRef<Group>(null);
  const smoke = useRef<Points>(null);
  const smokeMat = useRef<PointsMaterial>(null);
  const pos = useMemo(() => new Float32Array(SMOKE * 3), []);

  useFrame(() => {
    const now = performance.now();
    const p = castProgress(cast, now);
    if (root.current) root.current.visible = p !== null;
    if (p === null) return;
    const e = smooth(p * 1.4);
    for (let i = 0; i < SMOKE; i++) {
      // 먹물이 번지듯: 처음엔 모여 있다가 소용돌이치며 위로 퍼지고, 입자마다 속도가 달라 결이 생긴다
      const sp = 0.6 + hash(i, 3) * 0.9;
      const ang = hash(i) * Math.PI * 2 + p * sp * 2.2;
      const wob = Math.sin(p * 7 + i * 1.7) * 0.05;
      const r = (0.03 + hash(i, 1) * 0.5) * e + wob * e;
      pos[i * 3] = Math.cos(ang) * r;
      pos[i * 3 + 1] = 1.05 + hash(i, 2) * 0.45 * e + p * p * 0.35;
      pos[i * 3 + 2] = Math.sin(ang) * r;
    }
    touch(smoke.current);
    if (smokeMat.current) {
      smokeMat.current.opacity = smooth(p / 0.08) * (1 - p) * (1 - p) * 0.8;
      smokeMat.current.size = 0.16 + e * 0.2;
    }
  });

  return (
    <group
      ref={root}
      position={[
        cast.x - Math.sin(cast.ry) * (CAST_DISTANCE - 0.4),
        cast.y ?? 0,
        cast.z - Math.cos(cast.ry) * (CAST_DISTANCE - 0.4),
      ]}
    >
      <Glow
        pointsRef={smoke}
        matRef={smokeMat}
        positions={pos}
        color={colors["--color-scene-stone"]}
        size={0.5}
        additive={false}
        shape="puff"
      />
    </group>
  );
}

/* ── 화룡: 작은 불꽃 한 줄기가 날아가 자리에 불꽃을 남긴다 ─────── */

const FLAMES = 8;
const SPARKS = 6;
const WISPS = 4;
const TRAIL = PARTICLE_COUNTS.hwaryong - FLAMES - SPARKS - WISPS;
/** 날아가는 시간이 전체에서 차지하는 비율 (약 1초) */
const FLIGHT = 0.12;

function Hwaryong({ cast, colors }: EffectProps) {
  const root = useRef<Group>(null);
  const trail = useRef<Points>(null);
  const trailMat = useRef<PointsMaterial>(null);
  const fire = useRef<Points>(null);
  const fireMat = useRef<PointsMaterial>(null);
  const fireLight = useRef<PointLight>(null);
  const trailPos = useMemo(() => new Float32Array(TRAIL * 3), []);
  const firePos = useMemo(() => new Float32Array(FLAMES * 3), []);
  const sparks = useRef<Points>(null);
  const sparkMat = useRef<PointsMaterial>(null);
  const sparkPos = useMemo(() => new Float32Array(SPARKS * 3), []);
  const wisps = useRef<Points>(null);
  const wispMat = useRef<PointsMaterial>(null);
  const wispPos = useMemo(() => new Float32Array(WISPS * 3), []);
  const scorch = useRef<Mesh>(null);
  const scorchMat = useRef<MeshBasicMaterial>(null);
  const ground = useRef<Mesh>(null);
  const groundMat = useRef<MeshBasicMaterial>(null);
  const halo = useMemo(() => getHalo(), []);
  const total = SPELLS.hwaryong.durationMs;
  const trailColor = useMemo(
    () =>
      new Color(colors["--color-scene-spell-ember"])
        .lerp(new Color(colors["--color-scene-flame"]), 0.55)
        .multiplyScalar(1.5),
    [colors],
  );
  const fx = Math.sin(cast.ry);
  const fz = Math.cos(cast.ry);

  useFrame(() => {
    const now = performance.now();
    const p = castProgress(cast, now);
    if (root.current) root.current.visible = p !== null;
    if (p === null) return;
    const t = (now - cast.t0) / 1000;
    const u = clamp01(p / FLIGHT);
    // 시전자 앞 손끝에서 구역 중심 앞쪽까지, 구역 중심이 원점
    const from = -(CAST_DISTANCE - 0.4);
    const to = 0.5;
    for (let k = 0; k < TRAIL; k++) {
      const uk = clamp01(u - k * 0.05);
      const d = from + (to - from) * smooth(uk);
      // 용처럼 몸을 구불이며 날아가고 땅으로 내려앉는다
      const wave = Math.sin(uk * 12 + k * 0.55) * 0.16 * (1 - uk * 0.5);
      trailPos[k * 3] = fx * d + fz * wave;
      trailPos[k * 3 + 1] = 1.15 - 0.85 * uk + Math.cos(uk * 9 + k) * 0.03;
      trailPos[k * 3 + 2] = fz * d - fx * wave;
    }
    touch(trail.current);
    const landed = clamp01((p - FLIGHT) / 0.03);
    if (trailMat.current)
      trailMat.current.opacity = u < 1 ? 0.95 : (1 - landed) * 0.95;

    const burn = fade(
      clamp01((p - FLIGHT) / (1 - FLIGHT)),
      total * (1 - FLIGHT),
      300,
      1500,
    );
    for (let i = 0; i < FLAMES; i++) {
      const ph = (t * 1.1 + hash(i)) % 1;
      firePos[i * 3] =
        fx * to + (hash(i, 1) - 0.5) * 0.3 + Math.sin(t * 2.5 + i) * 0.035;
      firePos[i * 3 + 1] = 0.12 + ph * 0.5;
      firePos[i * 3 + 2] =
        fz * to + (hash(i, 2) - 0.5) * 0.3 + Math.cos(t * 2 + i) * 0.035;
    }
    touch(fire.current);
    if (fireMat.current) fireMat.current.opacity = p < FLIGHT ? 0 : burn * 0.9;
    // 불씨: 불꽃에서 떨어져 나와 흔들리며 솟다가 꺼진다
    for (let i = 0; i < SPARKS; i++) {
      const life = (t * (0.55 + hash(i, 4) * 0.4) + hash(i, 5)) % 1;
      sparkPos[i * 3] =
        fx * to +
        (hash(i, 6) - 0.5) * 0.28 +
        Math.sin(t * 3 + i * 2) * 0.08 * life;
      sparkPos[i * 3 + 1] = 0.25 + life * 0.95;
      sparkPos[i * 3 + 2] =
        fz * to +
        (hash(i, 7) - 0.5) * 0.28 +
        Math.cos(t * 2.4 + i) * 0.08 * life;
    }
    touch(sparks.current);
    if (sparkMat.current)
      sparkMat.current.opacity = p < FLIGHT ? 0 : burn * 0.95;
    // 불꽃 위로 피어오르는 가는 연기
    for (let i = 0; i < WISPS; i++) {
      const life = (t * 0.35 + hash(i, 8)) % 1;
      wispPos[i * 3] =
        fx * to +
        (hash(i, 10) - 0.5) * 0.2 +
        Math.sin(t * 0.9 + i * 2) * 0.12 * life;
      wispPos[i * 3 + 1] = 0.7 + life * 1.1;
      wispPos[i * 3 + 2] =
        fz * to +
        (hash(i, 11) - 0.5) * 0.2 +
        Math.cos(t * 0.8 + i) * 0.12 * life;
    }
    touch(wisps.current);
    if (wispMat.current) {
      wispMat.current.opacity = p < FLIGHT ? 0 : burn * 0.22;
      wispMat.current.size = 0.35 + 0.3 * smooth(burn);
    }
    // 그을린 자국
    if (scorch.current && scorchMat.current) {
      scorch.current.position.set(fx * to, 0.012, fz * to);
      scorchMat.current.opacity =
        p < FLIGHT
          ? 0
          : smooth((p - FLIGHT) / 0.1) * smooth((1 - p) / 0.08) * 0.4;
    }
    // 바닥에 번지는 불빛
    if (ground.current && groundMat.current) {
      const fl = 0.9 + 0.1 * Math.sin(t * 9) + 0.05 * Math.sin(t * 23);
      ground.current.position.set(fx * to, 0.02, fz * to);
      ground.current.scale.setScalar(0.9 + 0.1 * fl);
      groundMat.current.opacity = p < FLIGHT ? 0 : burn * 0.55 * fl;
    }
    if (fireLight.current) {
      const flicker =
        0.85 + 0.1 * Math.sin(t * 11) + 0.05 * Math.sin(t * 27 + 1);
      const traveling = p < FLIGHT;
      const d = from + (to - from) * smooth(u);
      fireLight.current.position.set(
        fx * d,
        traveling ? 1.15 - 0.85 * u : 0.35,
        fz * d,
      );
      fireLight.current.intensity = traveling
        ? 1.2 * flicker
        : 1.8 * burn * flicker;
    }
  });

  return (
    <group ref={root} position={[cast.x, cast.y ?? 0, cast.z]}>
      <pointLight
        ref={fireLight}
        color={trailColor}
        intensity={0}
        distance={3}
        decay={2}
      />
      <Glow
        pointsRef={trail}
        matRef={trailMat}
        positions={trailPos}
        color={trailColor}
        size={0.42}
        shape="flame"
      />
      <Glow
        pointsRef={fire}
        matRef={fireMat}
        positions={firePos}
        color={colors["--color-scene-flame"]}
        size={0.48}
        shape="flame"
      />
      <Glow
        pointsRef={sparks}
        matRef={sparkMat}
        positions={sparkPos}
        color={colors["--color-scene-spell-ember"]}
        size={0.06}
      />
      <Glow
        pointsRef={wisps}
        matRef={wispMat}
        positions={wispPos}
        color={colors["--color-scene-stone"]}
        size={0.4}
        additive={false}
        shape="puff"
      />
      <mesh ref={scorch} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.8, 0.8]} />
        <meshBasicMaterial
          ref={scorchMat}
          map={halo}
          color={colors["--color-scene-hat"]}
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={ground} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.5, 1.5]} />
        <meshBasicMaterial
          ref={groundMat}
          map={halo}
          color={trailColor}
          transparent
          opacity={0}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

/* ── 부운: 작은 조약돌 하나가 흰 구름 조각 위에 떠올랐다 내려온다 ─── */

const PUFFS = PARTICLE_COUNTS.buun;

/** 0→1로 떠올라 머물다가 1→0으로 내려오는 높이 비율 */
function hoverLift(p: number): number {
  return smooth(p / 0.2) * smooth((1 - p) / 0.22);
}

function Buun({ cast, colors }: EffectProps) {
  const root = useRef<Group>(null);
  const pebble = useRef<Mesh>(null);
  const shadow = useRef<Mesh>(null);
  const ring = useRef<Mesh>(null);
  const orbs = useRef<Group>(null);
  const puffs = useRef<Points>(null);
  const puffMat = useRef<PointsMaterial>(null);
  const pos = useMemo(() => new Float32Array(PUFFS * 3), []);

  useFrame(() => {
    const now = performance.now();
    const p = castProgress(cast, now);
    if (root.current) root.current.visible = p !== null;
    if (p === null) return;
    const t = (now - cast.t0) / 1000;
    const lift = hoverLift(p);
    const h = 0.1 + lift * 0.8 + Math.sin(t * 2) * 0.025 * lift;
    if (pebble.current) {
      pebble.current.position.set(0, h, 0);
      pebble.current.rotation.y = t * 0.8;
      pebble.current.rotation.x = Math.sin(t * 1.7) * 0.12 * lift;
      pebble.current.rotation.z = Math.cos(t * 1.3) * 0.1 * lift;
    }
    if (shadow.current) shadow.current.scale.setScalar(1 + lift * 0.35);
    // 구름 조각: 두 겹으로 둥글게 모여 천천히 부풀었다 가라앉는다
    for (let i = 0; i < PUFFS; i++) {
      const layer = i % 2;
      const ang = (i / PUFFS) * Math.PI * 2 + t * (layer ? -0.18 : 0.25);
      const r =
        (0.14 +
          layer * 0.1 +
          hash(i) * 0.08 +
          Math.sin(t * 1.3 + i * 1.9) * 0.04) *
        (0.6 + lift * 0.5);
      pos[i * 3] = Math.cos(ang) * r;
      pos[i * 3 + 1] = h - 0.14 + layer * 0.05 + Math.sin(t * 1.1 + i) * 0.025;
      pos[i * 3 + 2] = Math.sin(ang) * r;
    }
    if (ring.current) {
      const pulse = (t * 0.6) % 1;
      ring.current.scale.setScalar(0.5 + pulse * 1.3);
      (ring.current.material as MeshBasicMaterial).opacity =
        lift * (1 - pulse) * 0.45;
    }
    if (orbs.current) {
      orbs.current.position.y = h;
      orbs.current.rotation.y = t * 1.5;
      orbs.current.visible = lift > 0.05;
    }
    touch(puffs.current);
    if (puffMat.current) {
      puffMat.current.opacity = smooth(p / 0.08) * smooth((1 - p) / 0.1) * 0.9;
    }
  });

  return (
    <group ref={root} position={[cast.x, cast.y ?? 0, cast.z]}>
      <mesh
        ref={shadow}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.015, 0]}
      >
        <circleGeometry args={[0.18, 24]} />
        <meshBasicMaterial
          color={colors["--color-scene-hat"]}
          transparent
          opacity={0.2}
          depthWrite={false}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[0.9, 0.9]} />
        <meshBasicMaterial
          map={getHalo()}
          color={colors["--color-scene-collar"]}
          transparent
          opacity={0.35}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={pebble} position={[0, 0.1, 0]}>
        <icosahedronGeometry args={[0.09, 0]} />
        <meshStandardMaterial
          color={colors["--color-scene-stone"]}
          flatShading
          roughness={0.9}
        />
      </mesh>
      <Glow
        pointsRef={puffs}
        matRef={puffMat}
        positions={pos}
        color={colors["--color-scene-collar"]}
        size={0.5}
        additive={false}
        shape="puff"
      />
      {/* 떠오른 돌을 도는 작은 조각 둘 */}
      <group ref={orbs}>
        {[0, Math.PI].map((a) => (
          <mesh
            key={a}
            position={[
              Math.cos(a) * 0.26,
              0.02 * Math.sin(a + 1),
              Math.sin(a) * 0.26,
            ]}
          >
            <icosahedronGeometry args={[0.022, 0]} />
            <meshStandardMaterial
              color={colors["--color-scene-stone"]}
              flatShading
              roughness={0.9}
            />
          </mesh>
        ))}
      </group>
      {/* 바닥으로 번져 나가는 파문 */}
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
        <ringGeometry args={[0.28, 0.3, 40]} />
        <meshBasicMaterial
          color={colors["--color-scene-collar"]}
          transparent
          opacity={0}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

/* ── 수호령: 다섯 동물의 은빛 영체이 구역을 한 바퀴 돌고 흩어진다 ───────── */

const TIGER = PARTICLE_COUNTS.suhoryeong;
/** 호랑이가 도는 반지름 — 구역 반지름(CAST_RADIUS) 안에 머문다 */
const TIGER_RING = 0.85;
/** 시전 시간 동안 도는 바퀴 수 */
const TIGER_LAPS = 1.1;

/**
 * 호랑이 옆모습 광점 28개. [앞뒤(머리 쪽이 +), 높이, 다리 번호(-1이면 다리 아님)].
 * 다리는 번호별로 걸음 위상이 달라 앞뒤로 흔들린다.
 */
const TIGER_SHAPE: ReadonlyArray<readonly [number, number, number]> = [
  // 등선
  [-0.4, 0.5, -1],
  [-0.27, 0.56, -1],
  [-0.13, 0.58, -1],
  [0.02, 0.58, -1],
  [0.16, 0.56, -1],
  [0.3, 0.52, -1],
  // 배선
  [-0.32, 0.34, -1],
  [-0.14, 0.3, -1],
  [0.06, 0.3, -1],
  [0.24, 0.34, -1],
  // 머리·주둥이·귀
  [0.42, 0.55, -1],
  [0.5, 0.5, -1],
  [0.58, 0.44, -1],
  [0.4, 0.66, -1],
  [0.34, 0.65, -1],
  // 꼬리
  [-0.49, 0.48, -1],
  [-0.59, 0.5, -1],
  [-0.67, 0.56, -1],
  // 다리 (앞다리 둘, 뒷다리 둘 — 각 2점)
  [0.26, 0.2, 0],
  [0.26, 0.04, 0],
  [0.14, 0.2, 1],
  [0.14, 0.04, 1],
  [-0.26, 0.2, 1],
  [-0.26, 0.04, 1],
  [-0.38, 0.2, 0],
  [-0.38, 0.04, 0],
  // 어깨·엉덩이 줄무늬 점
  [0.1, 0.45, -1],
  [-0.2, 0.46, -1],
];

/** 점 목록을 부드러운 곡선으로 이은 뒤 회전체로 빚는다 — 이음매 없는 매끈한 몸. [반지름, 축 위치] */
function smoothLathe(
  profile: ReadonlyArray<readonly [number, number]>,
  segments = 40,
) {
  const curve = new CatmullRomCurve3(
    profile.map(([r, y]) => new Vector3(r, y, 0)),
    false,
    "centripetal",
  );
  const pts = curve
    .getPoints(segments)
    .map((v) => new Vector2(Math.max(0, v.x), v.y));
  return new LatheGeometry(pts, 36);
}

/** 몸통: 엉덩이에서 목까지 한 덩이. 축이 앞뒤(+z가 앞)가 되도록 눕힌다. */
const TORSO_GEOMETRY = (() => {
  const g = smoothLathe([
    [0, -0.44],
    [0.08, -0.41],
    [0.15, -0.33],
    [0.18, -0.18],
    [0.175, 0],
    [0.185, 0.16],
    [0.16, 0.29],
    [0.115, 0.38],
    [0.08, 0.4],
    [0, 0.44],
  ]);
  g.rotateX(Math.PI / 2);
  g.scale(0.92, 1.08, 1);
  return g;
})();

/** 머리 윤곽은 동물별로 빚는다. 축의 양수 쪽이 주둥이다. */
const SPIRIT_HEAD_GEOMETRIES = [
  // 백호: 넓은 볼과 짧고 두툼한 주둥이.
  [
    [0, -0.16],
    [0.13, -0.12],
    [0.18, -0.03],
    [0.17, 0.06],
    [0.105, 0.13],
    [0.095, 0.19],
    [0, 0.205],
  ],
  // 여우: 작은 뒤통수에서 가늘고 긴 주둥이로 이어진다.
  [
    [0, -0.14],
    [0.09, -0.1],
    [0.13, -0.02],
    [0.105, 0.06],
    [0.065, 0.14],
    [0.025, 0.245],
    [0, 0.26],
  ],
  // 사슴: 이마가 좁고 콧등이 길다.
  [
    [0, -0.14],
    [0.075, -0.1],
    [0.105, -0.02],
    [0.08, 0.08],
    [0.055, 0.2],
    [0.045, 0.25],
    [0, 0.27],
  ],
  // 토끼: 둥근 볼과 짧은 코.
  [
    [0, -0.13],
    [0.1, -0.1],
    [0.145, -0.01],
    [0.13, 0.07],
    [0.075, 0.13],
    [0, 0.15],
  ],
  // 반달가슴곰: 넓은 두개골과 앞으로 나온 짧은 주둥이.
  [
    [0, -0.17],
    [0.13, -0.12],
    [0.18, -0.025],
    [0.16, 0.07],
    [0.085, 0.14],
    [0.075, 0.21],
    [0, 0.23],
  ],
].map((profile) => {
  const geometry = smoothLathe(profile as Array<[number, number]>);
  geometry.rotateX(Math.PI / 2);
  geometry.scale(1, 0.9, 1);
  return geometry;
});
const RABBIT_EAR_GEOMETRY = smoothLathe([
  [0, -0.035],
  [0.028, 0],
  [0.043, 0.12],
  [0.037, 0.27],
  [0.02, 0.34],
  [0, 0.36],
]);
const BEAR_CRESCENT_GEOMETRY = new TubeGeometry(
  new CatmullRomCurve3([
    new Vector3(-0.14, 0.03, 0.085),
    new Vector3(-0.085, -0.035, 0.12),
    new Vector3(0, -0.065, 0.135),
    new Vector3(0.085, -0.035, 0.12),
    new Vector3(0.14, 0.03, 0.085),
  ]),
  28,
  0.018,
  10,
);

/** 꼬리: 등 뒤로 내려왔다가 끝이 위로 말린다 */
const TAIL_GEOMETRY = new TubeGeometry(
  new CatmullRomCurve3([
    new Vector3(0, 0.0, 0),
    new Vector3(0, -0.07, -0.12),
    new Vector3(0, -0.1, -0.26),
    new Vector3(0, -0.03, -0.38),
    new Vector3(0, 0.1, -0.44),
  ]),
  28,
  0.028,
  12,
);
const EAR_GEOMETRY = new CapsuleGeometry(0.035, 0.03, 8, 16);
const POINTED_EAR_GEOMETRY = smoothLathe(
  [
    [0, -0.055],
    [0.035, -0.04],
    [0.04, 0],
    [0.028, 0.06],
    [0, 0.13],
  ],
  24,
);
const FOX_TAIL_GEOMETRY = (() => {
  const g = smoothLathe([
    [0, -0.53],
    [0.035, -0.47],
    [0.085, -0.36],
    [0.105, -0.24],
    [0.075, -0.12],
    [0.035, -0.025],
    [0, 0],
  ]);
  g.rotateX(Math.PI / 2);
  g.rotateX(-0.3);
  return g;
})();
const NECK_GEOMETRY = new CapsuleGeometry(0.105, 0.16, 12, 24);
const SHORT_TAIL_GEOMETRY = new CapsuleGeometry(0.065, 0.035, 12, 24);
const ANTLER_STEM = new TubeGeometry(
  new CatmullRomCurve3([
    new Vector3(0, 0, 0),
    new Vector3(0.025, 0.1, -0.015),
    new Vector3(0.07, 0.19, -0.04),
    new Vector3(0.12, 0.25, -0.06),
  ]),
  20,
  0.008,
  8,
);
const ANTLER_BRANCH = new TubeGeometry(
  new CatmullRomCurve3([
    new Vector3(0, 0, 0),
    new Vector3(0.025, 0.035, 0.015),
    new Vector3(0.035, 0.085, 0.02),
  ]),
  12,
  0.006,
  8,
);
const UPPER_LEG_GEOMETRY = new CapsuleGeometry(0.064, 0.085, 12, 24);
const LOWER_LEG_GEOMETRY = new CapsuleGeometry(0.038, 0.085, 12, 24);
const PAW_GEOMETRY = new CapsuleGeometry(0.045, 0.035, 12, 24);

/** 표면은 은은하게 남기고 가장자리에 빛이 모이게 한다. */
function spiritRimShader(shader: {
  vertexShader: string;
  fragmentShader: string;
}) {
  shader.vertexShader = shader.vertexShader
    .replace(
      "void main() {",
      "varying vec3 vSpiritNormal;\nvarying vec3 vSpiritView;\nvoid main() {",
    )
    .replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nvSpiritNormal = normalize(normalMatrix * normal);\nvSpiritView = normalize(-(modelViewMatrix * vec4(position, 1.0)).xyz);",
    );
  shader.fragmentShader = shader.fragmentShader
    .replace(
      "void main() {",
      "varying vec3 vSpiritNormal;\nvarying vec3 vSpiritView;\nvoid main() {",
    )
    .replace(
      "#include <color_fragment>",
      "#include <color_fragment>\nfloat rim = pow(1.0 - abs(dot(normalize(vSpiritNormal), normalize(vSpiritView))), 1.6);\nfloat softLight = 0.5 + 0.5 * dot(normalize(vSpiritNormal), normalize(vec3(-0.4, 0.8, 0.6)));\ndiffuseColor.rgb *= 0.66 + softLight * 0.22 + rim * 0.12;",
    );
}

function tigerSpiritShader(shader: Parameters<typeof spiritRimShader>[0]) {
  spiritRimShader(shader);
  shader.vertexShader = shader.vertexShader.replace(
    "void main() {",
    "varying vec3 vSpiritLocal;\nvoid main() {\nvSpiritLocal = position;",
  );
  shader.fragmentShader = shader.fragmentShader
    .replace("void main() {", "varying vec3 vSpiritLocal;\nvoid main() {")
    .replace(
      "#include <color_fragment>",
      `#include <color_fragment>
      float wave = abs(sin(vSpiritLocal.z * 29.0 + vSpiritLocal.y * 9.0 + sin(vSpiritLocal.y * 24.0) * 0.45));
      float stripe = (1.0 - smoothstep(0.16, 0.32, wave)) * smoothstep(0.035, 0.12, abs(vSpiritLocal.x));
      diffuseColor.rgb *= 1.0 - stripe * 0.38;
    `,
    );
}

function Suhoryeong({ cast, colors }: EffectProps) {
  // 백호, 여우, 사슴, 토끼, 반달가슴곰 순서. 이전 클라이언트는 백호로 표시한다.
  const animal = cast.spiritAnimal ?? 0;
  const root = useRef<Group>(null);
  const body = useRef<Points>(null);
  const bodyMat = useRef<PointsMaterial>(null);
  const glow = useRef<Mesh>(null);
  const glowMat = useRef<MeshBasicMaterial>(null);
  const mist = useRef<Points>(null);
  const mistMat = useRef<PointsMaterial>(null);
  const driftingMist = useRef<Points>(null);
  const driftingMistMat = useRef<PointsMaterial>(null);
  const driftingMistPos = useMemo(() => new Float32Array(14 * 3), []);
  const spiritMist = useRef<Group>(null);
  const spiritForm = useRef<Group>(null);
  const spiritLegs = useRef<Array<Group | null>>([]);
  const spiritKnees = useRef<Array<Group | null>>([]);
  const spiritTail = useRef<Group>(null);
  const pos = useMemo(() => new Float32Array(TIGER * 3), []);
  const halo = useMemo(() => getHalo(), []);

  useFrame(() => {
    const now = performance.now();
    const p = castProgress(cast, now);
    if (root.current) root.current.visible = p !== null;
    if (p === null) return;
    const t = (now - cast.t0) / 1000;
    const angle = cast.ry + p * TIGER_LAPS * Math.PI * 2;
    // 원의 접선 방향이 호랑이가 바라보는 앞이다
    const tx = -Math.sin(angle);
    const tz = Math.cos(angle);
    // 여우는 긴 꼬리까지 시전 구역 안에 들어오도록 조금 안쪽을 돈다.
    const ring = animal === 1 ? 0.58 : TIGER_RING;
    const cx = Math.cos(angle) * ring;
    const cz = Math.sin(angle) * ring;
    const stride = t * (animal === 3 ? 6 : animal === 4 ? 3.8 : 4.6);
    for (let i = 0; i < TIGER; i++) {
      const [lx, ly, leg] = TIGER_SHAPE[i];
      const swing = leg < 0 ? 0 : Math.sin(stride + leg * Math.PI) * 0.08;
      const lift =
        leg < 0 ? 0 : Math.max(0, Math.cos(stride + leg * Math.PI)) * 0.03;
      // 윤곽에 고정된 점 대신 작은 빛이 몸 주위에서 느리게 흘러간다.
      const bob = Math.sin(stride * 2) * 0.012;
      const phase = hash(i, 21) * Math.PI * 2;
      const drift = t * (0.55 + hash(i, 22) * 0.35) + phase;
      const along = lx + swing + Math.sin(drift) * 0.015;
      const across = Math.cos(drift * 0.8 + phase) * 0.025;
      pos[i * 3] = cx + tx * along - tz * across;
      pos[i * 3 + 1] = ly + lift + bob + Math.sin(drift * 1.1) * 0.015;
      pos[i * 3 + 2] = cz + tz * along + tx * across;
    }
    touch(body.current);
    touch(mist.current);
    // 빛 안개가 몸에서 뒤쪽으로 길게 흘러나오며 부드럽게 소용돌이친다.
    for (let i = 0; i < driftingMistPos.length / 3; i++) {
      const phase = t * (0.55 + hash(i, 48) * 0.25) + hash(i, 49) * Math.PI * 2;
      const along = -0.18 - hash(i, 51) * 0.55 + Math.sin(phase) * 0.14;
      const across = Math.cos(phase + i) * (0.12 + hash(i, 52) * 0.18);
      driftingMistPos[i * 3] = cx + tx * along - tz * across;
      driftingMistPos[i * 3 + 1] =
        0.24 + hash(i, 50) * 0.48 + Math.sin(phase * 1.2) * 0.1;
      driftingMistPos[i * 3 + 2] = cz + tz * along + tx * across;
    }
    touch(driftingMist.current);
    const a = fade(p, SPELLS.suhoryeong.durationMs, 700, 1500);
    if (bodyMat.current) bodyMat.current.opacity = a;
    if (mistMat.current) mistMat.current.opacity = a * 0.16;
    if (driftingMistMat.current) driftingMistMat.current.opacity = a * 0.28;
    if (spiritMist.current) {
      spiritMist.current.position.set(cx, Math.sin(stride * 2) * 0.012, cz);
      spiritMist.current.rotation.y = Math.atan2(tx, tz);
      spiritMist.current.children.forEach((sprite) => {
        const material = (sprite as import("three").Sprite).material;
        material.opacity = a * (0.15 + Math.sin(t * 1.6) * 0.015);
      });
    }
    if (spiritForm.current) {
      spiritForm.current.position.set(cx, Math.sin(stride * 2) * 0.012, cz);
      spiritForm.current.rotation.y = Math.atan2(tx, tz);
      spiritForm.current.traverse((part) => {
        if ((part as Mesh).isMesh) {
          ((part as Mesh).material as MeshBasicMaterial).opacity = a * 0.96;
        }
      });
    }
    spiritLegs.current.forEach((leg, i) => {
      const phase =
        stride +
        (animal === 3
          ? i % 2 === 0
            ? 0
            : 0.8
          : i === 0 || i === 3
            ? 0
            : Math.PI);
      if (leg)
        leg.rotation.x =
          Math.sin(phase) * (animal === 2 ? 0.38 : animal === 4 ? 0.26 : 0.33);
      const knee = spiritKnees.current[i];
      // 발이 뒤에서 앞으로 나올 때만 무릎이 접힌다
      if (knee) knee.rotation.x = Math.max(0, Math.cos(phase)) * 0.42;
    });
    if (spiritTail.current) {
      spiritTail.current.rotation.y = Math.sin(t * 2.2) * 0.28;
      spiritTail.current.rotation.x = Math.sin(stride * 2) * 0.05;
    }
    if (glow.current) {
      glow.current.position.set(cx, 0.02, cz);
      glow.current.scale.setScalar(1 + Math.sin(stride * 2) * 0.04);
    }
    if (glowMat.current) glowMat.current.opacity = a * 0.4;
  });

  return (
    <group ref={root} position={[cast.x, cast.y ?? 0, cast.z]}>
      <Glow
        pointsRef={body}
        matRef={bodyMat}
        positions={pos}
        color={colors["--color-scene-moonlight"]}
        size={0.055}
      />
      {/* 같은 입자 위치에 넓고 흐릿한 푸른 후광을 겹친다. */}
      <Glow
        pointsRef={mist}
        matRef={mistMat}
        positions={pos}
        color={colors["--color-scene-moonlight"]}
        size={0.23}
      />
      <Glow
        pointsRef={driftingMist}
        matRef={driftingMistMat}
        positions={driftingMistPos}
        color={colors["--color-scene-moonlight"]}
        size={0.55}
        shape="puff"
      />
      {/* 동물별 체형 위로 은빛 광점과 옅은 안개를 겹친다. */}
      <group ref={spiritForm}>
        <mesh
          geometry={TORSO_GEOMETRY}
          position={[0, animal === 2 ? 0.55 : animal === 3 ? 0.32 : 0.43, 0]}
          scale={
            animal === 4
              ? [1.65, 1.5, 0.95]
              : animal === 3
                ? [1.12, 1.12, 0.65]
                : animal === 2
                  ? [0.72, 0.92, 0.92]
                  : animal === 1
                    ? [0.7, 0.78, 1.08]
                    : [1.15, 1.08, 1.08]
          }
        >
          <meshBasicMaterial
            color={colors["--color-scene-moonlight"]}
            onBeforeCompile={animal === 0 ? tigerSpiritShader : spiritRimShader}
            transparent
            opacity={0}
            depthWrite={true}
            blending={NormalBlending}
            toneMapped={false}
          />
        </mesh>
        <mesh
          geometry={NECK_GEOMETRY}
          position={[
            0,
            animal === 2 ? 0.69 : animal === 3 ? 0.37 : 0.45,
            animal === 3 ? 0.2 : 0.29,
          ]}
          rotation={[0.38, 0, 0]}
          scale={
            animal === 2
              ? [0.65, 1.75, 0.75]
              : animal === 4
                ? [1.6, 1.05, 1.45]
                : animal === 1
                  ? [0.85, 0.75, 0.85]
                  : animal === 3
                    ? [0.9, 0.55, 0.9]
                    : [1.2, 0.9, 1.1]
          }
        >
          <meshBasicMaterial
            color={colors["--color-scene-moonlight"]}
            onBeforeCompile={spiritRimShader}
            transparent
            opacity={0}
            depthWrite={true}
            toneMapped={false}
          />
        </mesh>
        {animal === 4 && (
          <mesh geometry={BEAR_CRESCENT_GEOMETRY} position={[0, 0.35, 0.33]}>
            <meshBasicMaterial
              color={colors["--color-scene-collar"]}
              transparent
              opacity={0}
              depthWrite
              toneMapped={false}
            />
          </mesh>
        )}
        <group
          position={[
            0,
            animal === 2
              ? 0.92
              : animal === 3
                ? 0.44
                : animal === 4
                  ? 0.56
                  : 0.51,
            animal === 3 ? 0.28 : 0.4,
          ]}
          rotation={[0.12, 0, 0]}
          scale={
            animal === 1
              ? [0.85, 0.88, 1.14]
              : animal === 2
                ? [0.78, 1, 1.08]
                : animal === 3
                  ? [0.9, 0.9, 0.8]
                  : animal === 4
                    ? [1.15, 1.1, 0.95]
                    : [1, 1, 1]
          }
        >
          <mesh
            geometry={
              SPIRIT_HEAD_GEOMETRIES[animal] ?? SPIRIT_HEAD_GEOMETRIES[0]
            }
          >
            <meshBasicMaterial
              color={colors["--color-scene-moonlight"]}
              onBeforeCompile={spiritRimShader}
              transparent
              opacity={0}
              depthWrite={true}
              blending={NormalBlending}
              toneMapped={false}
            />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh
              key={side}
              geometry={
                animal === 3
                  ? RABBIT_EAR_GEOMETRY
                  : animal === 1 || animal === 2
                    ? POINTED_EAR_GEOMETRY
                    : EAR_GEOMETRY
              }
              position={[
                side * (animal === 4 ? 0.135 : animal === 0 ? 0.12 : 0.075),
                animal === 3 ? 0.1 : 0.12,
                -0.065,
              ]}
              scale={
                animal === 3
                  ? [1, 1, 0.45]
                  : animal === 1
                    ? [1.6, 1.35, 0.65]
                    : animal === 4
                      ? [1.65, 1.4, 0.85]
                      : animal === 2
                        ? [1.25, 0.9, 0.45]
                        : [1.2, 0.9, 0.8]
              }
              rotation={[
                animal === 3 ? -0.16 : 0,
                0,
                side * (animal === 2 ? -0.95 : animal === 3 ? -0.12 : -0.3),
              ]}
            >
              <meshBasicMaterial
                color={colors["--color-scene-moonlight"]}
                onBeforeCompile={spiritRimShader}
                transparent
                opacity={0}
                depthWrite={true}
                blending={NormalBlending}
                toneMapped={false}
              />
            </mesh>
          ))}
          {animal === 2 &&
            [-1, 1].flatMap((side) =>
              [0, 1, 2].map((branch) => (
                <mesh
                  key={`${side}-${branch}`}
                  geometry={branch === 0 ? ANTLER_STEM : ANTLER_BRANCH}
                  position={[
                    side *
                      (0.055 +
                        (branch === 0 ? 0 : branch === 1 ? 0.03 : 0.065) *
                          1.45),
                    0.11 +
                      (branch === 0 ? 0 : branch === 1 ? 0.1 : 0.15) * 1.45,
                    -0.07,
                  ]}
                  scale={[side * 1.45, 1.45, 1.25]}
                >
                  <meshBasicMaterial
                    color={colors["--color-scene-moonlight"]}
                    onBeforeCompile={spiritRimShader}
                    transparent
                    opacity={0}
                    depthWrite={true}
                    blending={NormalBlending}
                    toneMapped={false}
                  />
                </mesh>
              )),
            )}
        </group>
        <group
          ref={spiritTail}
          position={[
            0,
            animal === 3 ? 0.36 : animal === 2 ? 0.59 : 0.48,
            animal === 3 ? -0.29 : -0.4,
          ]}
          scale={
            animal === 1
              ? [1.65, 1.65, 1.25]
              : animal === 3 || animal === 4
                ? [animal === 3 ? 1.15 : 0.7, 0.85, 1]
                : animal === 2
                  ? [0.7, 0.45, 0.4]
                  : [1, 1, 1]
          }
        >
          <mesh
            geometry={
              animal === 1
                ? FOX_TAIL_GEOMETRY
                : animal === 3 || animal === 4
                  ? SHORT_TAIL_GEOMETRY
                  : TAIL_GEOMETRY
            }
          >
            <meshBasicMaterial
              color={colors["--color-scene-moonlight"]}
              onBeforeCompile={spiritRimShader}
              transparent
              opacity={0}
              depthWrite={true}
              blending={NormalBlending}
              toneMapped={false}
            />
          </mesh>
        </group>
        {[-1, 1].flatMap((side) =>
          [-1, 1].map((front, i) => {
            const idx = (side === -1 ? 0 : 2) + i;
            return (
              <group
                key={`${side}-${front}`}
                position={[
                  side * (animal === 4 ? 0.18 : animal === 3 ? 0.13 : 0.1),
                  animal === 2 ? 0.5 : animal === 3 ? 0.25 : 0.34,
                  front * (animal === 3 ? 0.18 : 0.25),
                ]}
                scale={
                  animal === 2
                    ? [0.6, 1.45, 0.6]
                    : animal === 4
                      ? [1.7, 0.95, 1.5]
                      : animal === 3
                        ? [
                            front === -1 ? 1.8 : 0.7,
                            0.68,
                            front === -1 ? 1.85 : 0.7,
                          ]
                        : animal === 1
                          ? [0.7, 0.95, 0.75]
                          : [1.25, 0.95, 1.25]
                }
                ref={(el) => {
                  spiritLegs.current[idx] = el;
                }}
              >
                <mesh geometry={UPPER_LEG_GEOMETRY} position={[0, -0.07, 0]}>
                  <meshBasicMaterial
                    color={colors["--color-scene-moonlight"]}
                    onBeforeCompile={spiritRimShader}
                    transparent
                    opacity={0}
                    depthWrite={true}
                    blending={NormalBlending}
                    toneMapped={false}
                  />
                </mesh>
                <group
                  position={[0, -0.145, 0]}
                  ref={(el) => {
                    spiritKnees.current[idx] = el;
                  }}
                >
                  <mesh geometry={LOWER_LEG_GEOMETRY} position={[0, -0.07, 0]}>
                    <meshBasicMaterial
                      color={colors["--color-scene-moonlight"]}
                      onBeforeCompile={spiritRimShader}
                      transparent
                      opacity={0}
                      depthWrite={true}
                      blending={NormalBlending}
                      toneMapped={false}
                    />
                  </mesh>
                  <mesh
                    geometry={PAW_GEOMETRY}
                    scale={
                      animal === 3 && front === -1
                        ? [1, 1.8, 1]
                        : animal === 2
                          ? [0.85, 0.7, 1]
                          : [1, 1, 1]
                    }
                    position={[0, -0.14, 0.03]}
                    rotation={[Math.PI / 2, 0, 0]}
                  >
                    <meshBasicMaterial
                      color={colors["--color-scene-moonlight"]}
                      onBeforeCompile={spiritRimShader}
                      transparent
                      opacity={0}
                      depthWrite={true}
                      blending={NormalBlending}
                      toneMapped={false}
                    />
                  </mesh>
                </group>
              </group>
            );
          }),
        )}
      </group>
      {/* 경계가 없는 빛을 겹쳐 몸 안쪽에 연기 같은 질감을 만든다. */}
      <group ref={spiritMist}>
        {(
          [
            [0, 0.43, -0.17, 0.76, 0.6],
            [0, 0.44, 0.12, 0.77, 0.6],
            [0, 0.52, 0.42, 0.37, 0.37],
            [0, 0.22, -0.27, 0.18, 0.32],
            [0, 0.22, 0.23, 0.18, 0.32],
          ] as const
        ).map(([x, y, z, width, height], i) => (
          <sprite key={i} position={[x, y, z]} scale={[width, height, 1]}>
            <spriteMaterial
              map={halo}
              color={colors["--color-scene-moonlight"]}
              transparent
              opacity={0}
              blending={AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </sprite>
        ))}
      </group>
      {/* 걷는 자리에 번지는 은빛 */}
      <mesh ref={glow} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.3, 1.3]} />
        <meshBasicMaterial
          ref={glowMat}
          map={halo}
          color={colors["--color-scene-moonlight"]}
          transparent
          opacity={0}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

/* ── 모아 그리기 ───────────────────────────────────────── */

const EFFECT: Record<SpellCast["spell"], (p: EffectProps) => React.ReactNode> =
  {
    myeonggyeong: () => null,
    mukryeong: (p) => <Mukryeong {...p} />,
    hwaryong: (p) => <Hwaryong {...p} />,
    buun: (p) => <Buun {...p} />,
    // 몸 주문은 아바타 모습이 바뀌므로 구역에 그릴 것이 없다
    sosin: () => null,
    geosin: () => null,
    eunhyeong: () => null,
    suhoryeong: (p) => <Suhoryeong {...p} />,
  };

export interface SpellEffectsProps {
  colors: SceneColors;
  /** 지금 장면에 남아 있는 주문 효과 (`addCast`로 관리, 상한 MAX_ACTIVE) */
  casts: ReadonlyArray<SpellCast>;
}

export function SpellEffects({ colors, casts }: SpellEffectsProps) {
  return (
    <>
      {casts.map((cast) => (
        <group key={cast.id}>{EFFECT[cast.spell]({ cast, colors })}</group>
      ))}
    </>
  );
}
