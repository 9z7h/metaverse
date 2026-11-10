/**
 * 기숙사 입구 깃발 — 사신수(청룡·주작·백호·현무) 문양을 캔버스에 그려 천에 입힌다.
 * 바탕은 기숙사 primary, 문양은 accent, 테두리는 놋쇠색. 모두 장면 토큰에서 읽는다.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import {
  CanvasTexture,
  DoubleSide,
  RepeatWrapping,
  SRGBColorSpace,
} from "three";
import type { Group } from "three";
import { HOUSES } from "../../houses";
import { houseCrestUrl } from "../../HouseCrest";
import type { HouseId } from "../../houses";
import type { SceneColors } from "../sceneLayout";

export const FLAG_CLOTH = { w: 0.8, h: 2.1 } as const;
const POLE_H = 2.9;
const TEX_W = 256;
const TEX_H = Math.round((TEX_W * FLAG_CLOTH.h) / FLAG_CLOTH.w);

function drawFlag(
  canvas: HTMLCanvasElement,
  house: HouseId,
  ground: string,
  on: string,
  brass: string,
  fabric: CanvasImageSource,
  brocade: CanvasImageSource,
  crest: CanvasImageSource,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, TEX_W, TEX_H);
  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, TEX_W, TEX_H);
  ctx.globalCompositeOperation = "multiply";
  ctx.drawImage(fabric, 0, 0, TEX_W, TEX_H);
  ctx.globalCompositeOperation = "source-over";
  for (const [x, y, w, h] of [
    [0, 0, TEX_W, 34],
    [0, TEX_H - 34, TEX_W, 34],
    [0, 34, 16, TEX_H - 68],
    [TEX_W - 16, 34, 16, TEX_H - 68],
  ]) {
    ctx.drawImage(brocade, x, y, w, h);
    ctx.strokeStyle = brass;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
  }
  ctx.drawImage(crest, 30, 150, TEX_W - 60, TEX_W - 60);
  ctx.fillStyle = on;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 42px ${getComputedStyle(document.body).fontFamily}`;
  ctx.fillText(HOUSES[house].guardian, TEX_W / 2, TEX_H - 90);
}

/* ── 깃대와 천 ───────────────────────────────────────── */

export function GuardianFlag({
  house,
  colors,
  position,
  phase = 0,
  poleSide = -1,
}: {
  house: HouseId;
  colors: SceneColors;
  /** 깃대 발치 (기단 윗면) */
  position: [number, number, number];
  /** 바람에 흔들리는 박자를 깃발마다 어긋나게 */
  phase?: number;
  poleSide?: -1 | 1;
}) {
  const ground = colors[`--color-house-${house}-primary`];
  const on = colors[`--color-house-${house}-on`];
  const brass = colors["--color-scene-brass"];
  const dark = colors["--color-scene-wood-dark"];
  const crest = useTexture(houseCrestUrl(house));
  const fabric = useTexture(
    `${import.meta.env.BASE_URL}textures/scroll-silk.jpg`,
  );
  const brocade = useTexture(
    `${import.meta.env.BASE_URL}textures/scroll-brocade.jpg`,
  );
  const bump = useTexture(
    `${import.meta.env.BASE_URL}textures/scroll-silk-bump.jpg`,
    (tex) => {
      tex.wrapS = tex.wrapT = RepeatWrapping;
      tex.repeat.set(5, 14);
      tex.anisotropy = 4;
    },
  );
  const canvas = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = TEX_W;
    c.height = TEX_H;
    return c;
  }, []);
  const texture = useMemo(() => {
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    return tex;
  }, [canvas]);
  const swing = useRef<Group>(null);
  const still = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true,
    [],
  );

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      drawFlag(
        canvas,
        house,
        ground,
        on,
        brass,
        fabric.image as CanvasImageSource,
        brocade.image as CanvasImageSource,
        crest.image as CanvasImageSource,
      );
      texture.needsUpdate = true;
    };
    run();
    document.fonts?.ready.then(run).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [canvas, texture, house, ground, on, brass, fabric, brocade, crest]);
  useEffect(() => () => texture.dispose(), [texture]);

  useFrame(({ clock }) => {
    if (still || !swing.current) return;
    swing.current.rotation.x =
      Math.sin(clock.elapsedTime * 1.1 + phase) * 0.045;
  });

  const topY = POLE_H - 0.1;
  return (
    <group position={position}>
      <mesh
        position={[poleSide * (FLAG_CLOTH.w / 2 + 0.06), POLE_H / 2, -0.06]}
      >
        <cylinderGeometry args={[0.05, 0.06, POLE_H, 8]} />
        <meshStandardMaterial color={dark} />
      </mesh>
      <mesh
        position={[poleSide * (FLAG_CLOTH.w / 2 + 0.06), POLE_H + 0.06, -0.06]}
      >
        <sphereGeometry args={[0.09, 12, 8]} />
        <meshStandardMaterial
          color={brass}
          emissive={brass}
          emissiveIntensity={0.4}
          metalness={0.3}
          roughness={0.35}
        />
      </mesh>
      <mesh position={[0, topY, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.04, 0.04, FLAG_CLOTH.w + 0.16, 8]} />
        <meshStandardMaterial color={dark} />
      </mesh>
      <group ref={swing} position={[0, topY - 0.03, 0]}>
        <mesh position={[0, -FLAG_CLOTH.h / 2, 0.02]}>
          <planeGeometry args={[FLAG_CLOTH.w, FLAG_CLOTH.h]} />
          <meshStandardMaterial
            map={texture}
            bumpMap={bump}
            bumpScale={0.003}
            emissiveMap={texture}
            emissive="white"
            emissiveIntensity={0.3}
            roughness={0.8}
            side={DoubleSide}
          />
        </mesh>
      </group>
    </group>
  );
}
