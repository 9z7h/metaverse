/**
 * 먹빛각의 뼈대 — 높은 우물천장(서까래·대들보·단청 띠), 윗단 기둥, 벽을 따라 도는 2층 회랑.
 * 한옥 서고의 구조 어휘(서까래·대들보·공포·난간)로 높고 넓은 공간감을 만든다.
 * 반복되는 부재는 전부 InstancedMesh로 묶어 draw call을 아낀다.
 */
import { useLayoutEffect, useMemo, useRef } from "react";
import { Color } from "three";
import type { InstancedMesh } from "three";
import { useSurfaceTexture } from "./surfaceTexture";
import { fillBoxes } from "./LibraryRoom";
import type { Box } from "./LibraryRoom";
import { BEAM_Z, FRONT_WALL_Z, HALL, ROOM } from "./sceneLayout";
import type { SceneColors } from "./sceneLayout";

const WALL_X = ROOM.maxX + 0.7; // 좌우 벽 안쪽 면
const BACK_Z = ROOM.minZ - 0.7; // 뒷벽 안쪽 면
const W = WALL_X * 2;
const D = FRONT_WALL_Z - BACK_Z;
const CZ = (FRONT_WALL_Z + BACK_Z) / 2;
const H = HALL.wallH;

/** 회랑이 이어지는 z 범위 (옆 서가가 있는 구간) */
const LEDGE_Z0 = ROOM.minZ + 0.4;
const LEDGE_Z1 = 8.2;
const LEDGE_LEN = LEDGE_Z1 - LEDGE_Z0;
const LEDGE_CZ = (LEDGE_Z0 + LEDGE_Z1) / 2;

function Boxes({
  boxes,
  color,
  roughness = 0.85,
}: {
  boxes: Box[];
  color: string;
  roughness?: number;
}) {
  const grain = useSurfaceTexture("wood", 1, 3);
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => fillBoxes(ref.current, boxes), [boxes]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, boxes.length]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color={color}
        map={grain}
        bumpMap={grain}
        bumpScale={0.02}
        roughness={roughness}
      />
    </instancedMesh>
  );
}

/** 대들보 옆면을 두르는 단청 띠 — 주작 홍 / 청룡 청 두 줄 */
function BeamStripes({ colors }: { colors: SceneColors }) {
  const ref = useRef<InstancedMesh>(null);
  const items = useMemo(() => {
    const out: { box: Box; blue: boolean }[] = [];
    for (const z of BEAM_Z)
      for (const face of [-1, 1])
        for (const blue of [false, true])
          out.push({
            blue,
            box: {
              p: [0, H - 0.6 + (blue ? -0.12 : 0.12), z + face * 0.26],
              s: [W, 0.06, 0.02],
            },
          });
    return out;
  }, []);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    fillBoxes(
      mesh,
      items.map((i) => i.box),
    );
    const c = new Color();
    items.forEach((it, i) =>
      mesh.setColorAt(
        i,
        c.set(
          it.blue
            ? colors["--color-house-cheongryong-primary"]
            : colors["--color-house-jujak-primary"],
        ),
      ),
    );
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [items, colors]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial />
    </instancedMesh>
  );
}

export function HallFrame({ colors }: { colors: SceneColors }) {
  const wood = colors["--color-scene-wood"];
  const dark = colors["--color-scene-wood-dark"];

  const rafters = useMemo<Box[]>(() => {
    const n = Math.floor((W - 0.9) / 0.85) + 1;
    return Array.from({ length: n }, (_, i) => ({
      p: [-WALL_X + 0.45 + i * 0.85, H - 0.14, CZ],
      s: [0.14, 0.18, D],
    }));
  }, []);

  const beams = useMemo<Box[]>(
    () => BEAM_Z.map((z) => ({ p: [0, H - 0.6, z], s: [W, 0.55, 0.5] })),
    [],
  );

  // 대들보를 받치는 윗단 기둥 (윗단 서가 위, 천장까지)
  const posts = useMemo<Box[]>(() => {
    const bottom = HALL.upperShelfY + 3.3;
    const top = H - 0.875;
    return BEAM_Z.flatMap((z) =>
      [-1, 1].map((side) => ({
        p: [side * (WALL_X - 0.22), (bottom + top) / 2, z] as Box["p"],
        s: [0.4, top - bottom, 0.4] as Box["s"],
      })),
    );
  }, []);

  // 회랑: 바닥판 + 난간 손잡이 + 난간동자 + 공포(받침)
  const ledges = useMemo<Box[]>(
    () =>
      [-1, 1].map((side) => ({
        p: [side * (WALL_X - HALL.ledge / 2), HALL.galleryY, LEDGE_CZ],
        s: [HALL.ledge, 0.12, LEDGE_LEN],
      })),
    [],
  );
  const railTops = useMemo<Box[]>(
    () =>
      [-1, 1].map((side) => ({
        p: [side * (WALL_X - HALL.ledge + 0.05), HALL.galleryY + 1, LEDGE_CZ],
        s: [0.09, 0.07, LEDGE_LEN],
      })),
    [],
  );
  const balusters = useMemo<Box[]>(() => {
    const n = Math.floor(LEDGE_LEN / 0.5) + 1;
    return [-1, 1].flatMap((side) =>
      Array.from({ length: n }, (_, i) => ({
        p: [
          side * (WALL_X - HALL.ledge + 0.05),
          HALL.galleryY + 0.55,
          LEDGE_Z0 + i * 0.5,
        ] as Box["p"],
        s: [0.05, 0.95, 0.05] as Box["s"],
      })),
    );
  }, []);
  const brackets = useMemo<Box[]>(() => {
    const n = Math.floor(LEDGE_LEN / 1.75) + 1;
    return [-1, 1].flatMap((side) =>
      Array.from({ length: n }, (_, i) => {
        const z = LEDGE_Z0 + i * 1.75;
        return [
          // 벽에서 뻗은 팔
          {
            p: [side * (WALL_X - 0.45), HALL.galleryY - 0.2, z],
            s: [0.9, 0.18, 0.3],
          },
          // 팔을 받치는 짧은 동자
          {
            p: [side * (WALL_X - 0.2), HALL.galleryY - 0.45, z],
            s: [0.2, 0.55, 0.3],
          },
        ] as Box[];
      }).flat(),
    );
  }, []);

  return (
    <group>
      {/* 우물천장 */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, H, CZ]}>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial color={dark} roughness={0.95} />
      </mesh>
      <Boxes boxes={rafters} color={wood} />
      <Boxes boxes={beams} color={dark} />
      <BeamStripes colors={colors} />
      <Boxes boxes={posts} color={dark} />

      {/* 2층 회랑 */}
      <Boxes boxes={ledges} color={wood} roughness={0.8} />
      <Boxes boxes={railTops} color={dark} />
      <Boxes boxes={balusters} color={dark} />
      <Boxes boxes={brackets} color={dark} />
    </group>
  );
}
