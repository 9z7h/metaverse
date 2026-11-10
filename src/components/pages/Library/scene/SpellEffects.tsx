/**
 * 기본 주문 4종의 연출. 시전 하나가 구역 하나(반지름 CAST_RADIUS)만 쓰고 파티클은 MAX_PARTICLES 이하다.
 * 명경의 빛은 아바타 지팡이에 붙고, 나머지 효과는 시전자 앞 구역에 나타난다.
 */
import { useCallback, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, Color, NormalBlending } from "three";
import type {
  BufferAttribute,
  Group,
  Mesh,
  Points,
  PointsMaterial,
  PointLight,
} from "three";
import { roundGlowKey, roundGlowShader } from "./MagicEffect";
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

/** 효과 시작 직후 `inMs`에 걸쳐 나타나고 끝나기 전 `outMs`에 걸쳐 사라지는 0~1 */
function fade(p: number, totalMs: number, inMs: number, outMs: number) {
  const t = p * totalMs;
  return smooth(t / inMs) * smooth((totalMs - t) / outMs);
}

/** 광점 한 무리 — 위치는 부모가 프레임마다 채운다 */
function Glow({
  pointsRef,
  matRef,
  positions,
  color,
  size,
  additive = true,
  flameShape = false,
}: {
  pointsRef: React.RefObject<Points | null>;
  matRef: React.RefObject<PointsMaterial | null>;
  positions: Float32Array;
  color: string | Color;
  size: number;
  additive?: boolean;
  flameShape?: boolean;
}) {
  const flameTime = useMemo(() => ({ value: 0 }), []);
  const flameShader = useCallback(
    (shader: {
      fragmentShader: string;
      uniforms: Record<string, { value: unknown }>;
    }) => {
      shader.uniforms.uFlameTime = flameTime;
      shader.fragmentShader = shader.fragmentShader
        .replace("void main() {", "uniform float uFlameTime;\nvoid main() {")
        .replace(
          "#include <map_particle_fragment>",
          `float h = 1.0 - gl_PointCoord.y;
       float x = (gl_PointCoord.x - 0.5) * 2.0;
       float phase = gl_FragCoord.x * 0.015 + gl_FragCoord.y * 0.009;
       float bend = (sin(h * 9.0 - uFlameTime * 7.0 + phase) * 0.18
         + sin(h * 17.0 + uFlameTime * 5.0 + phase) * 0.08) * h;
       float width = 0.72 * pow(max(0.0, 1.0 - h), 0.65) * smoothstep(0.0, 0.16, h) + 0.025;
       float edge = 1.0 - smoothstep(width * 0.55, width, abs(x - bend));
       float tip = (1.0 - smoothstep(0.78, 1.0, h)) * smoothstep(0.0, 0.08, h);
       float core = (1.0 - smoothstep(width * 0.1, width * 0.6, abs(x - bend))) * (1.0 - smoothstep(0.25, 0.8, h));
       diffuseColor.rgb *= mix(0.7, 1.8, core);
       diffuseColor.a *= edge * tip;`,
        );
    },
    [flameTime],
  );
  useFrame(({ clock }) => {
    if (flameShape) flameTime.value = clock.elapsedTime;
  });
  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
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
        onBeforeCompile={flameShape ? flameShader : roundGlowShader}
        customProgramCacheKey={
          flameShape ? () => "flame-particle-v1" : roundGlowKey
        }
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
      const ang = hash(i) * Math.PI * 2 + p * (0.8 + hash(i, 3));
      const r = (0.04 + hash(i, 1) * 0.45) * e;
      pos[i * 3] = Math.cos(ang) * r;
      pos[i * 3 + 1] = 1.2 + hash(i, 2) * 0.5 * p - p * 0.15;
      pos[i * 3 + 2] = Math.sin(ang) * r;
    }
    touch(smoke.current);
    if (smokeMat.current) {
      smokeMat.current.opacity = smooth(p / 0.08) * (1 - p) * (1 - p) * 0.8;
      smokeMat.current.size = 0.18 + e * 0.12;
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
        size={0.38}
        additive={false}
      />
    </group>
  );
}

/* ── 화룡: 작은 불꽃 한 줄기가 날아가 자리에 불꽃을 남긴다 ─────── */

const FLAMES = 8;
const TRAIL = PARTICLE_COUNTS.hwaryong - FLAMES;
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
    if (fireLight.current) {
      const flicker = 0.85 + 0.15 * Math.sin(t * 11);
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
        flameShape
      />
      <Glow
        pointsRef={fire}
        matRef={fireMat}
        positions={firePos}
        color={colors["--color-scene-flame"]}
        size={0.48}
        flameShape
      />
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
    for (let i = 0; i < PUFFS; i++) {
      const ang = (i / PUFFS) * Math.PI * 2 + t * 0.3;
      const r =
        (0.17 + hash(i) * 0.1 + Math.sin(t * 1.8 + i) * 0.035) *
        (0.65 + lift * 0.35);
      pos[i * 3] = Math.cos(ang) * r;
      pos[i * 3 + 1] = h - 0.1 + hash(i, 1) * 0.06;
      pos[i * 3 + 2] = Math.sin(ang) * r;
    }
    touch(puffs.current);
    if (puffMat.current) {
      puffMat.current.opacity = smooth(p / 0.08) * smooth((1 - p) / 0.1) * 0.85;
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
        size={0.34}
        additive={false}
      />
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
