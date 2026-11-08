import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferAttribute,
  CanvasTexture,
  Color,
  DoubleSide,
} from "three";
import type {
  Group,
  Mesh,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  Texture,
} from "three";
import { MASK_WHITE_TOKEN, rootToken } from "./sceneLayout";
import type { SceneColors, Vec2 } from "./sceneLayout";
import { houseToken } from "../houses";
import type { HouseId, HousePart } from "../houses";
import {
  DISSOLVE_PARTICLES,
  dissolveParticle,
  dissolveProgress,
} from "./magicMotion";

/* ── 공유 알파 마스크 — 실제 색은 장면 토큰에서 가져온다 ── */

/**
 * 파티클을 네모 대신 둥근 빛으로. 텍스처 없이 셰이더가 점 안의 거리(gl_PointCoord)로 번짐을 계산한다.
 * 캔버스 텍스처의 알파에 의존하면 기기·환경에 따라 알파가 사라져 불투명한 네모로 보일 수 있어서다.
 * `pointsMaterial`의 `onBeforeCompile`과 `customProgramCacheKey`에 함께 넘긴다.
 */
export function roundGlowShader(shader: { fragmentShader: string }) {
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <map_particle_fragment>",
    `float glowD = clamp(length(gl_PointCoord - vec2(0.5)) * 2.0, 0.0, 1.0);
    float glowA = 1.0 - glowD;
    diffuseColor.a *= glowA * glowA;`,
  );
}
export const roundGlowKey = () => "round-glow";

let practiceSealTexture: Texture | null = null;
/** 세계관의 기록 문양에서 착안한 창작 장식. 실제 문자나 의례 문양을 뜻하지 않는다. */
function getPracticeSealTexture(): Texture {
  if (practiceSealTexture) return practiceSealTexture;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const white = rootToken(MASK_WHITE_TOKEN);
    ctx.strokeStyle = white;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.translate(256, 256);
    for (const [radius, width] of [
      [219, 2],
      [207, 1],
      [155, 2],
      [57, 1.5],
    ]) {
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    // 네 방위에 놓인 매듭과 붓획 모양의 짧은 선.
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.rotate((i * Math.PI) / 2);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, -188);
      ctx.lineTo(13, -175);
      ctx.lineTo(0, -162);
      ctx.lineTo(-13, -175);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-12, -132);
      ctx.quadraticCurveTo(30, -108, 0, -82);
      ctx.quadraticCurveTo(-30, -108, 12, -132);
      ctx.moveTo(-21, -110);
      ctx.lineTo(21, -110);
      ctx.stroke();
      ctx.restore();
    }
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      const inner = i % 4 === 0 ? 190 : 199;
      ctx.lineWidth = i % 4 === 0 ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
      ctx.lineTo(Math.cos(a) * 204, Math.sin(a) * 204);
      ctx.stroke();
    }
    // 가운데는 비워 책과 등잔이 보이도록 한다.
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -35);
    ctx.quadraticCurveTo(7, -7, 35, 0);
    ctx.quadraticCurveTo(7, 7, 0, 35);
    ctx.quadraticCurveTo(-7, 7, -35, 0);
    ctx.quadraticCurveTo(-7, -7, 0, -35);
    ctx.stroke();
  }
  practiceSealTexture = new CanvasTexture(canvas);
  return practiceSealTexture;
}

/* ── 실습 문양 ─────────────────────────────────────── */

export interface MagicEffectProps {
  colors: SceneColors;
  /** 시전자의 기숙사 — 원형 문양의 빛깔 */
  house: HouseId;
  /** 책상 중심 (월드 좌표) */
  at: Vec2;
}

/**
 * 원형 문양의 기숙사 색.
 * 주작(금색)·청룡(옅은 금색) accent 대신 primary를 쓰고, 어두운 primary는
 * 빛을 더하는(additive) 렌더링에서 흐려지므로 밝기 배율(gain)을 곱한다.
 * 현무는 은색 accent가 백호의 은백색과 겹쳐서 남색 primary를 쓴다.
 */
const MAGIC_TINT: Record<HouseId, { part: HousePart; gain: number }> = {
  baekho: { part: "accent", gain: 1 }, // 은백색
  jujak: { part: "primary", gain: 1.6 }, // 붉은색
  hyeonmu: { part: "primary", gain: 1.6 }, // 푸른 남색
  cheongryong: { part: "primary", gain: 1.9 }, // 청록색
};

/**
 * 책 위의 원형 기록 문양과 떠오르는 작은 빛 입자.
 */
export function MagicEffect({ colors, house, at }: MagicEffectProps) {
  const born = useRef<number | null>(null);
  const seal = useRef<Group>(null);
  const sealMat = useRef<MeshBasicMaterial>(null);
  const motes = useRef<Points>(null);
  const moteMat = useRef<PointsMaterial>(null);
  const motePositions = useMemo(() => new Float32Array(64 * 3), []);

  const sealColor = useMemo(() => {
    const tint = MAGIC_TINT[house];
    return new Color(colors[houseToken(house, tint.part)]).multiplyScalar(
      tint.gain,
    );
  }, [colors, house]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (born.current === null) born.current = t;
    const appear = Math.min(1, (t - born.current) / 0.8);
    if (seal.current) {
      seal.current.rotation.y = -t * 0.12;
      seal.current.position.y = 0.89 + Math.sin(t * 1.2) * 0.018;
    }
    if (sealMat.current)
      sealMat.current.opacity = appear * (0.48 + Math.sin(t * 1.6) * 0.06);
    if (moteMat.current) moteMat.current.opacity = appear * 0.72;
    for (let i = 0; i < 64; i++) {
      const h = (i * 0.618034 + t * (0.11 + (i % 5) * 0.009)) % 1;
      const angle = i * 2.39996 + t * 0.45;
      const radius = (0.12 + (i % 7) * 0.058) * Math.sin(Math.PI * h);
      motePositions[i * 3] = Math.cos(angle) * radius;
      motePositions[i * 3 + 1] = 0.91 + h * 1.3;
      motePositions[i * 3 + 2] = Math.sin(angle) * radius;
    }
    const moteAttr = motes.current?.geometry.getAttribute("position");
    if (moteAttr) moteAttr.needsUpdate = true;
  });

  return (
    <group>
      <group position={[at.x, 0, at.z]}>
        <group ref={seal} position={[0, 0.89, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[1.2, 1.2]} />
            <meshBasicMaterial
              ref={sealMat}
              map={getPracticeSealTexture()}
              color={sealColor}
              transparent
              opacity={0}
              blending={AdditiveBlending}
              side={DoubleSide}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        </group>
        <points ref={motes} frustumCulled={false}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[motePositions, 3]}
            />
          </bufferGeometry>
          <pointsMaterial
            ref={moteMat}
            color={colors["--color-scene-flame"]}
            size={0.045}
            transparent
            opacity={0}
            blending={AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
            onBeforeCompile={roundGlowShader}
            customProgramCacheKey={roundGlowKey}
          />
        </points>
      </group>
    </group>
  );
}

/* ── 퇴장 연출: 기숙사색 빛 입자가 솟아오르고 바닥에 빛 고리가 번진다 ─────── */

export interface DissolveEffectProps {
  colors: SceneColors;
  /** 나가는 학생의 기숙사 — 입자 색 */
  house: HouseId;
  /** 학생이 서 있던 자리(의자) */
  at: Vec2;
  /** 퇴장이 시작된 시각 (performance.now 기준 ms) */
  since: number;
}

export function DissolveEffect({
  colors,
  house,
  at,
  since,
}: DissolveEffectProps) {
  const points = useRef<Points>(null);
  const pointsMat = useRef<PointsMaterial>(null);
  const ring = useRef<Mesh>(null);
  const ringMat = useRef<MeshBasicMaterial>(null);
  const positions = useMemo(() => new Float32Array(DISSOLVE_PARTICLES * 3), []);
  // 기숙사 accent에 촛불 색을 조금 섞어 따뜻한 빛으로
  const color = useMemo(
    () =>
      new Color(colors[houseToken(house, "accent")]).lerp(
        new Color(colors["--color-scene-flame"]),
        0.35,
      ),
    [colors, house],
  );

  useFrame(() => {
    const p = dissolveProgress(performance.now() - since);
    for (let i = 0; i < DISSOLVE_PARTICLES; i++) {
      const q = dissolveParticle(i, p);
      positions[i * 3] = q.x;
      positions[i * 3 + 1] = q.y;
      positions[i * 3 + 2] = q.z;
    }
    const attr = points.current?.geometry.getAttribute("position") as
      | BufferAttribute
      | undefined;
    if (attr) attr.needsUpdate = true;
    // 입자는 빠르게 밝아졌다가 사라짐 (개별 입자 밝기 대신 전체 투명도)
    if (pointsMat.current)
      pointsMat.current.opacity = Math.min(1, p * 6) * (1 - p) * 0.95;
    if (ring.current) ring.current.scale.setScalar(0.3 + p * 1.1);
    if (ringMat.current)
      ringMat.current.opacity = Math.min(1, p * 8) * (1 - p) * 0.6;
  });

  return (
    <group position={[at.x, 0, at.z]}>
      <points ref={points} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          ref={pointsMat}
          color={color}
          size={0.22}
          sizeAttenuation
          transparent
          opacity={0}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          onBeforeCompile={roundGlowShader}
          customProgramCacheKey={roundGlowKey}
        />
      </points>
      {/* 바닥에 번지는 빛 고리 */}
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[0.9, 1, 48]} />
        <meshBasicMaterial
          ref={ringMat}
          color={color}
          transparent
          opacity={0}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          side={DoubleSide}
        />
      </mesh>
    </group>
  );
}
