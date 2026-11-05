import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, CanvasTexture, Color } from "three";
import type { BufferAttribute, Points, PointsMaterial, Texture } from "three";

let glowTexture: Texture | null = null;
/**
 * 파티클을 네모 대신 부드러운 원형 빛으로 그리기 위한 알파 마스크 (모든 파티클이 공유).
 * 흰색→투명 그라데이션은 "모양"만 정하고, 실제 색은 토큰에서 온 vertexColors가 곱해진다.
 */
export function getGlowTexture(): Texture {
  if (glowTexture) return glowTexture;
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const g = ctx.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2,
    );
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.35, "rgba(255,255,255,0.6)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  glowTexture = new CanvasTexture(canvas);
  return glowTexture;
}
import { houseToken } from "../houses";
import type { HouseId } from "../houses";
import type { SceneColors, Vec2 } from "./sceneLayout";
import { MAGIC_PARTICLES, magicParticle } from "./magicMotion";

export interface MagicEffectProps {
  house: HouseId;
  colors: SceneColors;
  /** 책상 중심 (월드 좌표) */
  at: Vec2;
}

/**
 * 실습 중 책상 위로 피어오르는 기숙사 마법. 입자 42개짜리 Points 하나 —
 * 색은 기숙사 accent·primary 토큰을 번갈아 써서 (예: 주작 = 금빛 + 붉은 불씨) 깊이감을 준다.
 * 마운트되면 0.6초에 걸쳐 서서히 나타난다.
 */
export function MagicEffect({ house, colors, at }: MagicEffectProps) {
  const ref = useRef<Points>(null);
  const mat = useRef<PointsMaterial>(null);
  const born = useRef<number | null>(null);

  const positions = useMemo(() => new Float32Array(MAGIC_PARTICLES * 3), []);
  const vertexColors = useMemo(() => {
    const out = new Float32Array(MAGIC_PARTICLES * 3);
    const a = new Color(colors[houseToken(house, "accent")]);
    const p = new Color(colors[houseToken(house, "primary")]);
    for (let i = 0; i < MAGIC_PARTICLES; i++) {
      (i % 3 === 0 ? p : a).toArray(out, i * 3);
    }
    return out;
  }, [house, colors]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (born.current === null) born.current = t;
    for (let i = 0; i < MAGIC_PARTICLES; i++) {
      const [x, y, z] = magicParticle(house, i, t);
      positions[i * 3] = at.x + x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = at.z + z;
    }
    const attr = ref.current?.geometry.getAttribute("position") as
      | BufferAttribute
      | undefined;
    if (attr) attr.needsUpdate = true;
    if (mat.current) {
      mat.current.opacity = Math.min(0.95, (t - born.current) / 0.6);
    }
  });

  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[vertexColors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        ref={mat}
        map={getGlowTexture()}
        vertexColors
        size={0.16}
        sizeAttenuation
        transparent
        opacity={0}
        depthWrite={false}
        blending={AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}
