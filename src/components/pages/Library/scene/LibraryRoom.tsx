import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, Object3D } from "three";
import type { Group, InstancedMesh, MeshStandardMaterial } from "three";
import type { DeskLayout, SceneColors } from "./sceneLayout";
import {
  FRONT_WALL_Z,
  HALL,
  ROOM,
  SIDE_SHELF_Z,
  TABLES,
  TABLE_CANDLES,
} from "./sceneLayout";
import { roundGlowKey, roundGlowShader } from "./MagicEffect";
import { useSurfaceTexture } from "./surfaceTexture";

interface RoomProps {
  colors: SceneColors;
  desks: DeskLayout[];
}

/* ── 공통: 상자 여러 개를 InstancedMesh 하나로 ────────────────
 * 서가·책상처럼 같은 재질의 상자가 수백 개 반복되는 곳은 draw call 1회로 그린다. */

export interface Box {
  p: [number, number, number];
  s: [number, number, number];
  ry?: number;
}

export function fillBoxes(mesh: InstancedMesh | null, boxes: Box[]) {
  if (!mesh) return;
  const o = new Object3D();
  boxes.forEach((b, i) => {
    o.position.set(...b.p);
    o.rotation.set(0, b.ry ?? 0, 0);
    o.scale.set(...b.s);
    o.updateMatrix();
    mesh.setMatrixAt(i, o.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
}

/* ── 서가: 두 단(아래 + 회랑 위) ──────────────────────────── */

interface ShelfSpec {
  x: number;
  z: number;
  /** y축 회전 — 벽을 등지고 방 안쪽을 보게 */
  ry: number;
  width: number;
  /** 이 서가 단의 바닥 높이 */
  y0: number;
}

const SHELF_HEIGHT = 3.2;
const SHELF_DEPTH = 0.45;
const SHELF_ROWS = 5;

/** 뒷벽 가운데는 큰 살창 자리라 비워 두고, 좌우 벽은 열람실 길이를 따라 이어 붙인다 */
export const BACK_SHELF_X = [-7.2, -4.2, 4.2, 7.2];

function useShelves(): ShelfSpec[] {
  return useMemo(() => {
    const base = [
      ...BACK_SHELF_X.map((x) => ({
        x,
        z: ROOM.minZ - 0.5,
        ry: 0,
        width: 3,
      })),
      ...SIDE_SHELF_Z.flatMap((z) => [
        { x: ROOM.minX - 0.5, z, ry: Math.PI / 2, width: 3.2 },
        { x: ROOM.maxX + 0.5, z, ry: -Math.PI / 2, width: 3.2 },
      ]),
    ];
    return [0, HALL.upperShelfY].flatMap((y0) =>
      base.map((s) => ({ ...s, y0 })),
    );
  }, []);
}

/**
 * 서가를 서고 길이 방향 구역으로 나눈다. 구역마다 InstancedMesh를 따로 두면
 * 화면 밖 구역은 그리지 않아서(프러스텀 컬링) 서고가 길어져도 부담이 비례해 늘지 않는다.
 */
const SHELF_CHUNKS = 4;
function chunkShelves(shelves: ShelfSpec[]): ShelfSpec[][] {
  const lo = ROOM.minZ - 1;
  const size = (ROOM.maxZ - lo) / SHELF_CHUNKS;
  const out: ShelfSpec[][] = Array.from({ length: SHELF_CHUNKS }, () => []);
  for (const s of shelves) {
    const i = Math.min(
      SHELF_CHUNKS - 1,
      Math.max(0, Math.floor((s.z - lo) / size)),
    );
    out[i].push(s);
  }
  return out.filter((c) => c.length > 0);
}

/** 결정적 의사난수 (렌더마다 같은 책 배치) */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** 서가 로컬 좌표(u: 폭, y, v: 깊이) → 월드 상자 */
function shelfBox(
  s: ShelfSpec,
  u: number,
  y: number,
  v: number,
  size: [number, number, number],
): Box {
  const cos = Math.cos(s.ry);
  const sin = Math.sin(s.ry);
  return {
    p: [s.x + u * cos + v * sin, s.y0 + y, s.z - u * sin + v * cos],
    s: size,
    ry: s.ry,
  };
}

function ShelfFrames({
  shelves,
  wood,
}: {
  shelves: ShelfSpec[];
  wood: string;
}) {
  const grain = useSurfaceTexture("wood", 1, 2);
  const ref = useRef<InstancedMesh>(null);
  const boxes = useMemo(() => {
    const rowH = SHELF_HEIGHT / SHELF_ROWS;
    return shelves.flatMap((s) => [
      // 뒤판 — 벽 안쪽 면과 같은 평면에 놓이면 두 면이 겹쳐 깜빡이므로(z-fighting)
      // 앞으로 3cm 당겨, 한쪽 면은 벽 안에 묻히고 다른 면은 벽보다 앞에 오게 한다
      shelfBox(s, 0, SHELF_HEIGHT / 2, -SHELF_DEPTH / 2 + 0.03, [
        s.width,
        SHELF_HEIGHT,
        0.05,
      ]),
      // 선반
      ...Array.from({ length: SHELF_ROWS + 1 }, (_, i) =>
        shelfBox(s, 0, 0.08 + i * rowH, 0, [s.width, 0.05, SHELF_DEPTH]),
      ),
      // 옆판
      ...[-1, 1].map((side) =>
        shelfBox(s, (side * s.width) / 2, SHELF_HEIGHT / 2, 0, [
          0.06,
          SHELF_HEIGHT,
          SHELF_DEPTH,
        ]),
      ),
    ]);
  }, [shelves]);
  useLayoutEffect(() => fillBoxes(ref.current, boxes), [boxes]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, boxes.length]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={wood} map={grain} roughness={0.82} />
    </instancedMesh>
  );
}

/** 책은 어느 방향에서 보아도 옆면이 닫힌 상자로 그린다. */
function Books({
  shelves,
  palette,
  seed,
}: {
  shelves: ShelfSpec[];
  palette: string[];
  seed: number;
}) {
  const ref = useRef<InstancedMesh>(null);
  const books = useMemo(() => {
    const rand = seeded(seed);
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
        const y = s.y0 + 0.12 + row * (SHELF_HEIGHT / SHELF_ROWS);
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
  }, [shelves, palette.length, seed]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const o = new Object3D();
    const color = new Color();
    const agedPaper = new Color(palette[4]);
    books.forEach((b, i) => {
      o.position.set(b.x, b.y, b.z);
      o.rotation.set(0, b.ry, 0);
      o.scale.set(b.w, b.h, 0.3);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
      mesh.setColorAt(i, color.set(palette[b.c]).lerp(agedPaper, 0.32));
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

/* ── 긴 열람 테이블 + 의자 + 등잔 ─────────────────────────────
 * 서고 길이 방향으로 이어진 테이블 2개, 양쪽에 의자 32석. 재질별 InstancedMesh 4개로 그린다. */

function DeskSet({
  layouts,
  colors,
}: {
  layouts: DeskLayout[];
  colors: SceneColors;
}) {
  const grain = useSurfaceTexture("wood", 1, 12, true);
  const paper = useSurfaceTexture("paper");
  const tops = useRef<InstancedMesh>(null);
  const darks = useRef<InstancedMesh>(null);
  const lights = useRef<InstancedMesh>(null);
  const flames = useRef<InstancedMesh>(null);
  const pages = useRef<InstancedMesh>(null);
  const flameMat = useRef<MeshStandardMaterial>(null);

  const parts = useMemo(() => {
    const top: Box[] = [];
    const dark: Box[] = [];
    const light: Box[] = [];
    const page: Box[] = [];
    const flame: Box[] = [];
    const glowAt: number[] = [];

    for (const t of TABLES) {
      // 상판 + 그 아래 받침판(앞치마)으로 하나로 이어진 두툼한 테이블
      top.push({ p: [t.x, 0.75, t.z], s: [t.hx * 2, 0.08, t.hz * 2] });
      dark.push({
        p: [t.x, 0.64, t.z],
        s: [t.hx * 2 - 0.12, 0.16, t.hz * 2 - 0.2],
      });
      // 다리: 길이를 따라 2.8m 안팎 간격으로 한 쌍씩
      const span = t.hz * 2 - 0.8;
      const pairs = Math.ceil(span / 2.8) + 1;
      for (let i = 0; i < pairs; i++) {
        const z = t.z - t.hz + 0.4 + (span * i) / (pairs - 1);
        for (const sx of [-1, 1])
          dark.push({
            p: [t.x + sx * (t.hx - 0.1), 0.36, z],
            s: [0.1, 0.72, 0.1],
          });
      }
    }

    for (const { desk, chair, facing } of layouts) {
      // 의자는 테이블 쪽을 보고, 등받이는 그 반대쪽 — 등받이는 낮게
      // (뒤에서 보는 카메라가 아바타를 가리지 않도록)
      const toTable = Math.round(Math.sin(facing));
      dark.push({ p: [chair.x, 0.42, chair.z], s: [0.5, 0.06, 0.55] });
      dark.push({
        p: [chair.x - toTable * 0.25, 0.62, chair.z],
        s: [0.05, 0.36, 0.55],
      });
      // 좌석 앞에 펼친 책
      page.push({
        p: [desk.x, 0.805, desk.z],
        s: [0.42, 0.025, 0.6],
        ry: facing - Math.PI / 2,
      });
      dark.push({
        p: [desk.x, 0.785, desk.z],
        s: [0.45, 0.015, 0.63],
        ry: facing - Math.PI / 2,
      });
    }

    // 등잔: 좌석 사이마다 테이블 한가운데에 하나 (양쪽 면이 함께 쓴다)
    for (const c of TABLE_CANDLES) {
      dark.push({ p: [c.x, 0.81, c.z], s: [0.24, 0.035, 0.24] });
      light.push({ p: [c.x, 0.9, c.z], s: [0.1, 0.22, 0.1] });
      flame.push({ p: [c.x, 1.07, c.z], s: [0.12, 0.12, 0.12] });
      glowAt.push(c.x, 1.1, c.z);
    }
    return { top, dark, light, page, flame, glowAt: new Float32Array(glowAt) };
  }, [layouts]);

  useLayoutEffect(() => {
    fillBoxes(tops.current, parts.top);
    fillBoxes(darks.current, parts.dark);
    fillBoxes(lights.current, parts.light);
    fillBoxes(flames.current, parts.flame);
    fillBoxes(pages.current, parts.page);
  }, [parts]);

  // 모든 등잔이 함께 일렁인다 (재질 하나 공유 — draw call 절약)
  useFrame(({ clock }) => {
    if (!flameMat.current) return;
    const t = clock.elapsedTime;
    flameMat.current.emissiveIntensity =
      2.2 + Math.sin(t * 7) * 0.3 + Math.sin(t * 13) * 0.2;
  });

  const wood = colors["--color-scene-wood"];
  const woodDark = colors["--color-scene-wood-dark"];
  const woodLight = colors["--color-scene-wood-light"];
  const flame = colors["--color-scene-flame"];
  return (
    <group>
      <instancedMesh ref={tops} args={[undefined, undefined, parts.top.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color={wood}
          map={grain}
          bumpMap={grain}
          bumpScale={0.012}
          roughness={0.48}
        />
      </instancedMesh>
      <instancedMesh
        ref={darks}
        args={[undefined, undefined, parts.dark.length]}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={woodDark} />
      </instancedMesh>
      <instancedMesh
        ref={lights}
        args={[undefined, undefined, parts.light.length]}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={woodLight} roughness={1} />
      </instancedMesh>
      <instancedMesh
        ref={pages}
        args={[undefined, undefined, parts.page.length]}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={woodLight} map={paper} roughness={0.95} />
      </instancedMesh>
      <instancedMesh
        ref={flames}
        args={[undefined, undefined, parts.flame.length]}
      >
        <sphereGeometry args={[0.5, 10, 10]} />
        <meshStandardMaterial
          ref={flameMat}
          color={flame}
          emissive={flame}
          emissiveIntensity={2.2}
          toneMapped={false}
        />
      </instancedMesh>
      {/* 등잔 불빛 번짐 — 텍스처 없이 셰이더로 둥글게 */}
      <points frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[parts.glowAt, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          color={flame}
          size={1.1}
          sizeAttenuation
          transparent
          opacity={0.45}
          depthWrite={false}
          toneMapped={false}
          onBeforeCompile={roundGlowShader}
          customProgramCacheKey={roundGlowKey}
        />
      </points>
    </group>
  );
}

/* ── 떠다니는 책 (마법학교 분위기) ── */

function FloatingBooks({ colors }: { colors: SceneColors }) {
  const group = useRef<Group>(null);
  // 서고 길이를 따라 2.6m 간격으로 흩어 놓는다
  const items = useMemo(() => {
    const colorsCycle = [
      "--color-scene-robe-1",
      "--color-scene-robe-2",
      "--color-scene-robe-3",
      "--color-scene-robe-4",
    ] as const;
    return Array.from({ length: 16 }, (_, i) => ({
      x: ((i * 7) % 13) - 6,
      y: 2.4 + (i % 4) * 0.25,
      z: 11 - i * 2.6,
      c: colorsCycle[i % 4],
    }));
  }, []);
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

/* ── 방 ─────────────────────────────────────────────── */

export function LibraryRoom({ colors, desks }: RoomProps) {
  const floorGrain = useSurfaceTexture("wood", 5, 12, true);
  const plaster = useSurfaceTexture("plaster", 6, 3);
  const shelves = useShelves();
  const chunks = useMemo(() => chunkShelves(shelves), [shelves]);
  const bookPalette = useMemo(
    () => [
      colors["--color-scene-robe-1"],
      colors["--color-scene-robe-2"],
      colors["--color-scene-robe-3"],
      colors["--color-scene-robe-4"],
      colors["--color-scene-wood-light"],
      colors["--color-scene-wall"],
    ],
    [colors],
  );
  const w = ROOM.maxX - ROOM.minX + 2;
  // 뒷벽 ~ 앞벽(입구 홀 포함)
  const backZ = ROOM.minZ - 0.9;
  const frontZ = FRONT_WALL_Z + 0.1;
  const d = frontZ - backZ;
  const cz = (frontZ + backZ) / 2;
  const wall = colors["--color-scene-wall"];
  const dark = colors["--color-scene-wood-dark"];
  const H = HALL.wallH;

  return (
    <group>
      {/* 바닥 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, cz]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial
          color={colors["--color-scene-floor"]}
          map={floorGrain}
          bumpMap={floorGrain}
          bumpScale={0.025}
          roughness={0.6}
        />
      </mesh>
      {/* 중앙 통로 러그 — 긴 서고를 가로지르는 붉은 길 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, cz]}>
        <planeGeometry args={[2, d - 2]} />
        <meshStandardMaterial
          color={colors["--color-scene-rug"]}
          roughness={1}
        />
      </mesh>
      {/* 벽 (뒤·좌·우·앞) — 시점을 돌려도 바깥 허공이 보이지 않게 사방을 막는다 */}
      <mesh position={[0, H / 2, ROOM.minZ - 0.8]}>
        <boxGeometry args={[w, H, 0.2]} />
        <meshStandardMaterial color={wall} map={plaster} roughness={0.94} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (ROOM.maxX + 0.8), H / 2, cz]}>
          <boxGeometry args={[0.2, H, d]} />
          <meshStandardMaterial color={wall} map={plaster} roughness={0.94} />
        </mesh>
      ))}
      <mesh position={[0, H / 2, frontZ]}>
        <boxGeometry args={[w, H, 0.2]} />
        <meshStandardMaterial color={wall} map={plaster} roughness={0.94} />
      </mesh>
      {/* 입구 대문: 문틀(기둥 2 + 인방) + 두 짝 문 */}
      <group position={[0, 0, FRONT_WALL_Z - 0.02]}>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 1.05, 1.4, 0]}>
            <boxGeometry args={[0.2, 2.8, 0.2]} />
            <meshStandardMaterial color={dark} />
          </mesh>
        ))}
        <mesh position={[0, 2.9, 0]}>
          <boxGeometry args={[2.5, 0.25, 0.25]} />
          <meshStandardMaterial color={dark} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={`door${s}`} position={[s * 0.48, 1.3, 0.02]}>
            <boxGeometry args={[0.92, 2.6, 0.04]} />
            <meshStandardMaterial color={colors["--color-scene-wood"]} />
          </mesh>
        ))}
      </group>

      {chunks.map((c, i) => (
        <group key={i}>
          <ShelfFrames shelves={c} wood={colors["--color-scene-wood-dark"]} />
          <Books shelves={c} palette={bookPalette} seed={42 + i * 101} />
        </group>
      ))}

      <DeskSet layouts={desks} colors={colors} />
      <FloatingBooks colors={colors} />
    </group>
  );
}
