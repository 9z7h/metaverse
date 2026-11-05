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
import type { MeshBasicMaterial, Texture } from "three";
import type { SceneColors, Vec2 } from "./sceneLayout";
import { houseToken } from "../houses";
import type { HouseId, HousePart } from "../houses";
import { SEGMENTS, STREAKS, streakPoint, tornadoStreak } from "./magicMotion";

/* ── 공유 알파 마스크 ──────────────────────────────────────
 * 흰색→투명 그라데이션은 "모양(번짐)"만 정하고, 실제 색은 토큰에서 온 색이 곱해진다. */

let glowTexture: Texture | null = null;
/** 파티클을 네모 대신 부드러운 원형 빛으로 (반딧불 파티클이 공유) */
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
    const across = ctx.createLinearGradient(0, 0, 0, h);
    across.addColorStop(0, "rgba(255,255,255,0)");
    across.addColorStop(0.5, "rgba(255,255,255,1)");
    across.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = across;
    ctx.fillRect(0, 0, w, h);
    // 길이 방향 페이드: 머리(u=0) 밝게 → 꼬리(u=1) 투명
    ctx.globalCompositeOperation = "destination-in";
    const along = ctx.createLinearGradient(0, 0, w, 0);
    along.addColorStop(0, "rgba(255,255,255,0.3)");
    along.addColorStop(0.12, "rgba(255,255,255,1)");
    along.addColorStop(1, "rgba(255,255,255,0)");
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
