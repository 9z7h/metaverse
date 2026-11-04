import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, Object3D } from "three";
import type { Group, InstancedMesh, MeshStandardMaterial } from "three";
import type { DeskLayout, SceneColors } from "./sceneLayout";
import { ROOM } from "./sceneLayout";

interface RoomProps {
  colors: SceneColors;
  desks: DeskLayout[];
}

/* ── 책장: InstancedMesh 1개로 책 수백 권을 한 번에 그린다 (모바일 draw call 절약) ── */

interface ShelfSpec {
  x: number;
  z: number;
  /** y축 회전 — 벽을 등지고 방 안쪽을 보게 */
  ry: number;
  width: number;
}

const SHELF_HEIGHT = 3.2;
const SHELF_DEPTH = 0.45;
const SHELF_ROWS = 5;

function useShelves(): ShelfSpec[] {
  return useMemo(() => {
    const back = [-4, 0, 4].map((x) => ({
      x,
      z: ROOM.minZ - 0.5,
      ry: 0,
      width: 3.6,
    }));
    const sides = [-4.5, -1, 2.5].flatMap((z) => [
      { x: ROOM.minX - 0.5, z, ry: Math.PI / 2, width: 3.2 },
      { x: ROOM.maxX + 0.5, z, ry: -Math.PI / 2, width: 3.2 },
    ]);
    return [...back, ...sides];
  }, []);
}

/** 결정적 의사난수 (렌더마다 같은 책 배치) */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function Books({
  shelves,
  palette,
}: {
  shelves: ShelfSpec[];
  palette: string[];
}) {
  const ref = useRef<InstancedMesh>(null);
  const books = useMemo(() => {
    const rand = seeded(42);
    const list: {
      x: number;
      y: number;
      z: number;
      ry: number;
      h: number;
      w: number;
      c: number;
    }[] = [];
    for (const s of shelves) {
      const cos = Math.cos(s.ry);
      const sin = Math.sin(s.ry);
      for (let row = 0; row < SHELF_ROWS; row++) {
        const y = 0.12 + row * (SHELF_HEIGHT / SHELF_ROWS);
        let u = -s.width / 2 + 0.08;
        while (u < s.width / 2 - 0.12) {
          const w = 0.06 + rand() * 0.07;
          const h = 0.32 + rand() * 0.2;
          if (rand() > 0.08) {
            // 로컬 (u, 0) → 월드 (회전 적용)
            list.push({
              x: s.x + u * cos,
              y: y + h / 2,
              z: s.z - u * sin,
              ry: s.ry,
              h,
              w,
              c: Math.floor(rand() * palette.length),
            });
          }
          u += w + 0.01;
        }
      }
    }
    return list;
  }, [shelves, palette.length]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const o = new Object3D();
    const color = new Color();
    books.forEach((b, i) => {
      o.position.set(b.x, b.y, b.z);
      o.rotation.set(0, b.ry, 0);
      o.scale.set(b.w, b.h, 0.3);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
      mesh.setColorAt(i, color.set(palette[b.c]));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [books, palette]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, books.length]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial roughness={0.85} />
    </instancedMesh>
  );
}

function Shelf({ spec, wood }: { spec: ShelfSpec; wood: string }) {
  const rowH = SHELF_HEIGHT / SHELF_ROWS;
  return (
    <group position={[spec.x, 0, spec.z]} rotation={[0, spec.ry, 0]}>
      {/* 뒤판 */}
      <mesh position={[0, SHELF_HEIGHT / 2, -SHELF_DEPTH / 2]}>
        <boxGeometry args={[spec.width, SHELF_HEIGHT, 0.05]} />
        <meshStandardMaterial color={wood} roughness={0.9} />
      </mesh>
      {/* 선반 */}
      {Array.from({ length: SHELF_ROWS + 1 }, (_, i) => (
        <mesh key={i} position={[0, 0.08 + i * rowH, 0]}>
          <boxGeometry args={[spec.width, 0.05, SHELF_DEPTH]} />
          <meshStandardMaterial color={wood} roughness={0.9} />
        </mesh>
      ))}
      {/* 옆판 */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * spec.width) / 2, SHELF_HEIGHT / 2, 0]}>
          <boxGeometry args={[0.06, SHELF_HEIGHT, SHELF_DEPTH]} />
          <meshStandardMaterial color={wood} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

/* ── 책상 + 의자 + 촛불 ── */

function Desk({ layout, colors }: { layout: DeskLayout; colors: SceneColors }) {
  const flame = useRef<MeshStandardMaterial>(null);
  const phase = useMemo(() => layout.desk.x * 3.1 + layout.desk.z, [layout]);

  useFrame(({ clock }) => {
    if (!flame.current) return;
    const t = clock.elapsedTime + phase;
    flame.current.emissiveIntensity =
      2.2 + Math.sin(t * 7) * 0.3 + Math.sin(t * 13) * 0.2;
  });

  const { desk, chair } = layout;
  const wood = colors["--color-scene-wood"];
  const dark = colors["--color-scene-wood-dark"];
  return (
    <group>
      {/* 상판 */}
      <mesh position={[desk.x, 0.75, desk.z]}>
        <boxGeometry args={[2.2, 0.08, 1]} />
        <meshStandardMaterial color={wood} roughness={0.7} />
      </mesh>
      {/* 다리 */}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh
            key={`${sx}${sz}`}
            position={[desk.x + sx * 1, 0.36, desk.z + sz * 0.4]}
          >
            <boxGeometry args={[0.08, 0.72, 0.08]} />
            <meshStandardMaterial color={dark} />
          </mesh>
        )),
      )}
      {/* 펼친 책 */}
      <mesh
        position={[desk.x, 0.8, desk.z + 0.15]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[0.6, 0.4]} />
        <meshStandardMaterial
          color={colors["--color-scene-wood-light"]}
          roughness={1}
        />
      </mesh>
      {/* 촛대 + 불꽃 */}
      <mesh position={[desk.x + 0.75, 0.9, desk.z - 0.2]}>
        <cylinderGeometry args={[0.05, 0.06, 0.22, 10]} />
        <meshStandardMaterial color={colors["--color-scene-wood-light"]} />
      </mesh>
      <mesh position={[desk.x + 0.75, 1.07, desk.z - 0.2]}>
        <sphereGeometry args={[0.06, 10, 10]} />
        <meshStandardMaterial
          ref={flame}
          color={colors["--color-scene-flame"]}
          emissive={colors["--color-scene-flame"]}
          emissiveIntensity={2.2}
          toneMapped={false}
        />
      </mesh>
      {/* 의자 — 등받이는 낮게 (뒤에서 보는 카메라가 아바타를 가리지 않도록) */}
      <mesh position={[chair.x, 0.42, chair.z]}>
        <boxGeometry args={[0.55, 0.06, 0.5]} />
        <meshStandardMaterial color={dark} />
      </mesh>
      <mesh position={[chair.x, 0.62, chair.z + 0.25]}>
        <boxGeometry args={[0.55, 0.36, 0.05]} />
        <meshStandardMaterial color={dark} />
      </mesh>
    </group>
  );
}

/* ── 떠다니는 책 (마법학교 분위기) ── */

function FloatingBooks({ colors }: { colors: SceneColors }) {
  const group = useRef<Group>(null);
  const items = useMemo(
    () => [
      { x: -1.2, y: 2.6, z: -2, c: "--color-scene-robe-1" as const },
      { x: 1.6, y: 3.0, z: 1.4, c: "--color-scene-robe-2" as const },
      { x: -3.8, y: 2.8, z: 5.2, c: "--color-scene-robe-3" as const },
      { x: 3.9, y: 2.4, z: -5.4, c: "--color-scene-robe-4" as const },
    ],
    [],
  );
  useFrame(({ clock }) => {
    group.current?.children.forEach((child, i) => {
      const t = clock.elapsedTime + i * 1.7;
      child.position.y = items[i].y + Math.sin(t * 0.9) * 0.15;
      child.rotation.y = t * 0.25;
      child.rotation.z = Math.sin(t * 0.7) * 0.15;
    });
  });
  return (
    <group ref={group}>
      {items.map((b) => (
        <mesh key={`${b.x}${b.z}`} position={[b.x, b.y, b.z]}>
          <boxGeometry args={[0.42, 0.08, 0.3]} />
          <meshStandardMaterial color={colors[b.c]} roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

export function LibraryRoom({ colors, desks }: RoomProps) {
  const shelves = useShelves();
  const bookPalette = useMemo(
    () => [
      colors["--color-scene-robe-1"],
      colors["--color-scene-robe-2"],
      colors["--color-scene-robe-3"],
      colors["--color-scene-robe-4"],
      colors["--color-scene-wood-light"],
      colors["--color-scene-flame"],
    ],
    [colors],
  );
  const w = ROOM.maxX - ROOM.minX + 2;
  const d = ROOM.maxZ - ROOM.minZ + 4;
  const cz = (ROOM.maxZ + ROOM.minZ) / 2;

  return (
    <group>
      {/* 바닥 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, cz]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial
          color={colors["--color-scene-floor"]}
          roughness={0.95}
        />
      </mesh>
      {/* 중앙 통로 러그 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, cz]}>
        <planeGeometry args={[1.4, d - 2]} />
        <meshStandardMaterial
          color={colors["--color-scene-rug"]}
          roughness={1}
        />
      </mesh>
      {/* 벽 (뒤·좌·우) — 앞쪽은 카메라 시야를 위해 열어둔다 */}
      <mesh position={[0, 3, ROOM.minZ - 0.8]}>
        <boxGeometry args={[w, 6, 0.2]} />
        <meshStandardMaterial color={colors["--color-scene-wall"]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (ROOM.maxX + 0.8), 3, cz]}>
          <boxGeometry args={[0.2, 6, d]} />
          <meshStandardMaterial color={colors["--color-scene-wall"]} />
        </mesh>
      ))}

      {shelves.map((s) => (
        <Shelf
          key={`${s.x}${s.z}`}
          spec={s}
          wood={colors["--color-scene-wood-dark"]}
        />
      ))}
      <Books shelves={shelves} palette={bookPalette} />

      {desks.map((l) => (
        <Desk key={l.seatId} layout={l} colors={colors} />
      ))}
      <FloatingBooks colors={colors} />
    </group>
  );
}
