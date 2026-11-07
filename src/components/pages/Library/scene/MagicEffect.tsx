import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
} from "three";
import type {
  Mesh,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  Texture,
} from "three";
import { MASK_WHITE_TOKEN, rootToken, withAlpha } from "./sceneLayout";
import type { SceneColors, Vec2 } from "./sceneLayout";
import { houseToken } from "../houses";
import type { HouseId, HousePart } from "../houses";
import {
  DISSOLVE_PARTICLES,
  SEGMENTS,
  STREAKS,
  dissolveParticle,
  dissolveProgress,
  streakPoint,
  tornadoStreak,
} from "./magicMotion";

/* ── 공유 알파 마스크 ──────────────────────────────────────
 * 흰색(gray/100 토큰)→투명 그라데이션은 "모양(번짐)"만 정하고, 실제 색은 토큰에서 온 색이 곱해진다.
 * 투명도가 있는 색은 `withAlpha`로 토큰에서 만든다 (rgba 직접 작성 금지). */

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

let streakTexture: Texture | null = null;
/**
 * 빛줄기 한 가닥의 번짐 — 두께 방향은 가운데가 밝고 가장자리로 흐려지고(블러),
 * 길이 방향은 머리가 밝고 꼬리로 갈수록 사라진다.
 */
function getStreakTexture(): Texture {
  if (streakTexture) return streakTexture;
  const w = 128;
  const h = 32;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const white = rootToken(MASK_WHITE_TOKEN);
    const across = ctx.createLinearGradient(0, 0, 0, h);
    across.addColorStop(0, withAlpha(white, 0));
    across.addColorStop(0.5, withAlpha(white, 1));
    across.addColorStop(1, withAlpha(white, 0));
    ctx.fillStyle = across;
    ctx.fillRect(0, 0, w, h);
    // 길이 방향 페이드: 머리(u=0) 밝게 → 꼬리(u=1) 투명
    ctx.globalCompositeOperation = "destination-in";
    const along = ctx.createLinearGradient(0, 0, w, 0);
    along.addColorStop(0, withAlpha(white, 0.3));
    along.addColorStop(0.12, withAlpha(white, 1));
    along.addColorStop(1, withAlpha(white, 0));
    ctx.fillStyle = along;
    ctx.fillRect(0, 0, w, h);
  }
  streakTexture = new CanvasTexture(canvas);
  return streakTexture;
}

/* ── 마법 회오리 ─────────────────────────────────────── */

export interface MagicEffectProps {
  colors: SceneColors;
  /** 시전자의 기숙사 — 노란 빛줄기 사이에 기숙사 색 가닥이 섞인다 */
  house: HouseId;
  /** 책상 중심 (월드 좌표) */
  at: Vec2;
}

const VERTS_PER_STREAK = SEGMENTS * 2;

/**
 * 회오리에 섞을 기숙사 색. 노란 빛과 구분돼야 하므로
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
 * 실습 중 책상 위로 솟는 노란 마법 회오리. 흐릿한(블러) 빛줄기 14가닥이 깔때기 모양으로
 * 돌며 솟아오른다. 전체가 메시 하나(draw call 1회)이고, 매 프레임 정점 위치·밝기만 갱신한다.
 * 색은 촛불 토큰(--color-scene-flame, --color-scene-light) 두 가지를 가닥마다 번갈아 쓴다.
 */
export function MagicEffect({ colors, house, at }: MagicEffectProps) {
  const mat = useRef<MeshBasicMaterial>(null);
  const born = useRef<number | null>(null);

  const { geometry, positions, colorAttr, palette } = useMemo(() => {
    const total = STREAKS * VERTS_PER_STREAK;
    const positions = new Float32Array(total * 3);
    const colorArr = new Float32Array(total * 3);
    const uvs = new Float32Array(total * 2);
    const index: number[] = [];
    for (let s = 0; s < STREAKS; s++) {
      const base = s * VERTS_PER_STREAK;
      for (let k = 0; k < SEGMENTS; k++) {
        const u = k / (SEGMENTS - 1);
        // 위·아래 두 정점 (빛줄기 두께)
        uvs.set([u, 1, u, 0], (base + k * 2) * 2);
        if (k < SEGMENTS - 1) {
          const a = base + k * 2;
          index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      }
    }
    const geometry = new BufferGeometry();
    const posAttr = new BufferAttribute(positions, 3);
    const colorAttr = new BufferAttribute(colorArr, 3);
    geometry.setAttribute("position", posAttr);
    geometry.setAttribute("color", colorAttr);
    geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
    geometry.setIndex(index);
    // 가닥마다 번갈아: 노란 빛(촛불 토큰) / 기숙사 색.
    const tint = MAGIC_TINT[house];
    const palette = [
      new Color(colors["--color-scene-flame"]),
      new Color(colors[houseToken(house, tint.part)]).multiplyScalar(tint.gain),
    ];
    return { geometry, positions, colorAttr, palette };
  }, [colors, house]);

  const tmp = useMemo(() => new Color(), []);
  // 실습을 멈추면 언마운트 → 정점 버퍼 해제 (텍스처는 공유라 유지)
  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (born.current === null) born.current = t;
    for (let s = 0; s < STREAKS; s++) {
      const f = tornadoStreak(s, t);
      tmp.copy(palette[s % 2]).multiplyScalar(f.fade);
      for (let k = 0; k < SEGMENTS; k++) {
        const [x, y, z] = streakPoint(f, k / (SEGMENTS - 1));
        const v = (s * VERTS_PER_STREAK + k * 2) * 3;
        positions[v] = at.x + x;
        positions[v + 1] = y + f.width / 2;
        positions[v + 2] = at.z + z;
        positions[v + 3] = at.x + x;
        positions[v + 4] = y - f.width / 2;
        positions[v + 5] = at.z + z;
        tmp.toArray(colorAttr.array as Float32Array, v);
        tmp.toArray(colorAttr.array as Float32Array, v + 3);
      }
    }
    geometry.getAttribute("position").needsUpdate = true;
    colorAttr.needsUpdate = true;
    // 처음 0.6초 동안 서서히 나타남
    if (mat.current)
      mat.current.opacity = Math.min(1, (t - born.current) / 0.6);
  });

  return (
    <mesh geometry={geometry} frustumCulled={false}>
      <meshBasicMaterial
        ref={mat}
        map={getStreakTexture()}
        vertexColors
        transparent
        opacity={0}
        side={DoubleSide}
        depthWrite={false}
        blending={AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
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
