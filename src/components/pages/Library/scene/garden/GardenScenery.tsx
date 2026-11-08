/**
 * 숨돌림 뜰의 풍경 — 달밤의 한국식 후원.
 * 서고 건물, 정자, 연못, 소나무·대나무·매화, 석등, 꽃담, 연등, 달과 별, 반딧불.
 * 반복되는 것은 전부 InstancedMesh로 묶어 draw call을 아낀다. 색은 모두 장면 토큰에서 읽는다.
 */
import { useLayoutEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferAttribute, Color, ConeGeometry, Object3D } from "three";
import type { InstancedMesh, Points, Texture } from "three";
import { useSurfaceTexture } from "../surfaceTexture";
import { fillBoxes } from "../LibraryRoom";
import type { Box } from "../LibraryRoom";
import { roundGlowKey, roundGlowShader } from "../MagicEffect";
import type { SceneColors } from "../sceneLayout";
import {
  BAMBOO,
  GARDEN_HALF,
  LIBRARY_BUILDING,
  PAVILION,
  PINES,
  PLUM_TREES,
  POND,
  SCHOOL_BUILDINGS,
  POND_PATH,
  STONE_LANTERNS,
  STONE_PATH,
} from "./gardenLayout";
import type { SchoolBuilding, Tree } from "./gardenLayout";

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/* ── 공통: 같은 재질의 모양 여러 개를 InstancedMesh 하나로 ───────────
 * 단위 크기 모양(상자·원기둥·원뿔·구)을 `scale`로 키워 쓴다. */

function Inst({
  boxes,
  color,
  roughness = 0.85,
  tint,
  children,
  emissive,
  basic = false,
  map,
}: {
  boxes: Box[];
  color: string | Color;
  roughness?: number;
  /** 모양마다 밝기 배율 (같은 재질에 살짝 변화를 준다) */
  tint?: number[];
  children: ReactNode;
  emissive?: string;
  /** 조명 영향을 받지 않는 발광 재질 */
  basic?: boolean;
  map?: Texture;
}) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    fillBoxes(mesh, boxes);
    if (tint) {
      const base = new Color(color);
      const c = new Color();
      tint.forEach((t, i) =>
        mesh.setColorAt(i, c.copy(base).multiplyScalar(t)),
      );
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }, [boxes, tint, color]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, boxes.length]}>
      {children}
      {basic ? (
        <meshBasicMaterial color={color} toneMapped={false} />
      ) : (
        <meshStandardMaterial
          color={tint ? undefined : color}
          roughness={roughness}
          map={map}
          bumpMap={map}
          bumpScale={0.025}
          emissive={emissive}
          emissiveIntensity={emissive ? 0.6 : 0}
        />
      )}
    </instancedMesh>
  );
}

const box = () => <boxGeometry args={[1, 1, 1]} />;
const cyl = (n = 10) => <cylinderGeometry args={[1, 1, 1, n]} />;

/** 점 번짐(텍스처 없이 둥글게) — 반딧불·불빛·달무리 */
function GlowPoints({
  positions,
  color,
  size,
  opacity,
  attenuate = true,
}: {
  positions: Float32Array;
  color: string;
  size: number;
  opacity: number;
  attenuate?: boolean;
}) {
  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={color}
        size={size}
        sizeAttenuation={attenuate}
        transparent
        opacity={opacity}
        depthWrite={false}
        toneMapped={false}
        onBeforeCompile={roundGlowShader}
        customProgramCacheKey={roundGlowKey}
      />
    </points>
  );
}

/** 한 변이 축에 맞는 피라미드(사각뿔) — 기와지붕 */
function usePyramid() {
  return useMemo(() => new ConeGeometry(1, 1, 4).rotateY(Math.PI / 4), []);
}

/* ── 땅·길·연못·꽃담 ─────────────────────────────────────────── */

function Ground({ colors }: { colors: SceneColors }) {
  const size = (GARDEN_HALF + 3) * 2;
  const ground = useMemo(
    () => new Color(colors["--color-scene-leaf"]).multiplyScalar(0.32),
    [colors],
  );
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial color={ground} roughness={1} />
    </mesh>
  );
}

/** 꺾은선을 따라 징검돌을 놓는다 */
function slabsAlong(
  line: ReadonlyArray<{ x: number; z: number }>,
  seed: number,
): Box[] {
  const rand = seeded(seed);
  const out: Box[] = [];
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i];
    const b = line[i + 1];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const n = Math.max(1, Math.floor(len / 1.15));
    const heading = Math.atan2(b.x - a.x, b.z - a.z);
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      out.push({
        p: [
          a.x + (b.x - a.x) * t + (rand() - 0.5) * 0.25,
          0.04,
          a.z + (b.z - a.z) * t + (rand() - 0.5) * 0.25,
        ],
        s: [0.95 + rand() * 0.3, 0.08, 0.7 + rand() * 0.25],
        ry: heading + (rand() - 0.5) * 0.4,
      });
    }
  }
  return out;
}

function Paths({ colors }: { colors: SceneColors }) {
  const stone = useSurfaceTexture("stone", 2, 2);
  const boxes = useMemo(
    () => [...slabsAlong(STONE_PATH, 11), ...slabsAlong(POND_PATH, 23)],
    [],
  );
  return (
    <Inst boxes={boxes} color={colors["--color-scene-stone"]} roughness={0.9} map={stone}>
      {box()}
    </Inst>
  );
}

function Pond({ colors }: { colors: SceneColors }) {
  const rim = useMemo<Box[]>(() => {
    const n = 44;
    return Array.from({ length: n }, (_, i) => {
      const th = (i / n) * Math.PI * 2;
      const r = POND.r + 0.3;
      return {
        p: [POND.x + Math.cos(th) * r, 0.14, POND.z + Math.sin(th) * r],
        s: [1.15, 0.3, 0.7],
        // 접선 방향으로 눕힌다
        ry: -th - Math.PI / 2,
      };
    });
  }, []);
  const moon = useMemo(
    () => new Float32Array([POND.x - 2.5, 0.08, POND.z - 1.5]),
    [],
  );
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[POND.x, 0.03, POND.z]}>
        <circleGeometry args={[POND.r, 56]} />
        <meshStandardMaterial
          color={colors["--color-scene-water"]}
          roughness={0.12}
          metalness={0.55}
          emissive={colors["--color-scene-moonlight"]}
          emissiveIntensity={0.1}
        />
      </mesh>
      <Inst boxes={rim} color={colors["--color-scene-stone"]} roughness={0.9}>
        {box()}
      </Inst>
      {/* 물에 비친 달무리 */}
      <GlowPoints
        positions={moon}
        color={colors["--color-scene-moonlight"]}
        size={6}
        opacity={0.5}
      />
    </group>
  );
}

/** 꽃담: 뜰을 둘러싼 낮은 담과 기와 지붕돌 */
function FlowerWall({ colors }: { colors: SceneColors }) {
  const { bodies, caps } = useMemo(() => {
    const bodies: Box[] = [];
    const caps: Box[] = [];
    const edge = GARDEN_HALF + 0.4;
    const step = 2;
    for (let c = -GARDEN_HALF - 1; c <= GARDEN_HALF + 1; c += step) {
      for (const side of [-1, 1]) {
        // 남·북 (x 방향으로 긴 담)
        bodies.push({ p: [c, 0.85, side * edge], s: [step, 1.7, 0.4] });
        caps.push({ p: [c, 1.8, side * edge], s: [step + 0.15, 0.22, 0.62] });
        // 동·서 (z 방향으로 긴 담)
        bodies.push({
          p: [side * edge, 0.85, c],
          s: [step, 1.7, 0.4],
          ry: Math.PI / 2,
        });
        caps.push({
          p: [side * edge, 1.8, c],
          s: [step + 0.15, 0.22, 0.62],
          ry: Math.PI / 2,
        });
      }
    }
    return { bodies, caps };
  }, []);
  return (
    <group>
      <Inst
        boxes={bodies}
        color={colors["--color-scene-wall"]}
        roughness={0.95}
      >
        {box()}
      </Inst>
      <Inst boxes={caps} color={colors["--color-scene-roof-tile"]}>
        {box()}
      </Inst>
    </group>
  );
}

/* ── 서고 건물(뒷모습이 아닌 정면) ───────────────────────────── */

function LibraryHall({ colors }: { colors: SceneColors }) {
  const pyramid = usePyramid();
  const { x, z, halfW, halfD, frontZ } = LIBRARY_BUILDING;
  const wood = colors["--color-scene-wood"];
  const dark = colors["--color-scene-wood-dark"];
  const baseTop = 0.6;
  const wallH = 4.2;
  const roofW = halfW + 2.4;
  const roofD = halfD + 2.6;
  const glow = useMemo(
    () => new Float32Array([-3.2, 2.6, frontZ + 0.9, 3.2, 2.6, frontZ + 0.9]),
    [frontZ],
  );

  const columns = useMemo<Box[]>(
    () =>
      Array.from({ length: 8 }, (_, i) => ({
        p: [
          x - halfW + 1 + (i * (2 * halfW - 2)) / 7,
          baseTop + wallH / 2,
          frontZ + 0.5,
        ],
        s: [0.28, wallH, 0.28],
      })),
    [x, halfW, frontZ],
  );
  const windows = useMemo<Box[]>(
    () =>
      [-7, -4.6, 4.6, 7].map((wx) => ({
        p: [x + wx, baseTop + 2.5, frontZ + 0.04],
        s: [1.5, 1.7, 0.06],
      })),
    [x, frontZ],
  );

  return (
    <group>
      {/* 기단(돌 받침) */}
      <mesh position={[x, baseTop / 2, z + 1]}>
        <boxGeometry args={[halfW * 2 + 3, baseTop, halfD * 2 + 4]} />
        <meshStandardMaterial
          color={colors["--color-scene-stone"]}
          roughness={0.9}
        />
      </mesh>
      {/* 몸체 */}
      <mesh position={[x, baseTop + wallH / 2, z]}>
        <boxGeometry args={[halfW * 2 - 1, wallH, halfD * 2]} />
        <meshStandardMaterial color={colors["--color-scene-wall"]} />
      </mesh>
      <Inst boxes={columns} color={dark}>
        {cyl(10)}
      </Inst>
      {/* 불 켜진 창호 */}
      <Inst boxes={windows} color={colors["--color-scene-flame"]} basic>
        {box()}
      </Inst>
      {/* 대문 */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[x + s * 0.62, baseTop + 1.5, frontZ + 0.08]}>
          <boxGeometry args={[1.18, 3, 0.14]} />
          <meshStandardMaterial color={wood} />
        </mesh>
      ))}
      <mesh position={[x, baseTop + 3.2, frontZ + 0.1]}>
        <boxGeometry args={[2.9, 0.3, 0.3]} />
        <meshStandardMaterial color={dark} />
      </mesh>
      {/* 처마 밑 단청 띠 */}
      <mesh position={[x, baseTop + wallH - 0.15, frontZ + 0.6]}>
        <boxGeometry args={[halfW * 2, 0.34, 0.2]} />
        <meshStandardMaterial color={colors["--color-scene-dancheong"]} />
      </mesh>
      {/* 기와지붕 */}
      <mesh
        geometry={pyramid}
        position={[x, baseTop + wallH + 2.3, z + 0.4]}
        scale={[roofW / 0.7071, 4.6, roofD / 0.7071]}
      >
        <meshStandardMaterial
          color={colors["--color-scene-roof-tile"]}
          roughness={0.7}
        />
      </mesh>
      {/* 처마 앞 연등 */}
      <GlowPoints
        positions={glow}
        color={colors["--color-scene-flame"]}
        size={2.6}
        opacity={0.45}
      />
      <pointLight
        position={[x, 3.4, frontZ + 3]}
        intensity={9}
        distance={16}
        decay={1.6}
        color={colors["--color-scene-flame"]}
      />
    </group>
  );
}

/* ── 학교 건물 (입장 불가) ────────────────────────────────────
 * 먹빛각과 같은 한옥 어휘로 지은 건물들. 문은 닫혀 있고 창에는 불이 켜져 있다.
 * 모양은 kind별 — 문루(성곽 기단 + 겹층 누각), 탑(층마다 줄어드는 5층), 기숙사(기단·계단·기둥·겹처마), 공방. */

/** 기와 지붕 하나 — 피라미드를 크기에 맞춰 늘린다 */
function Roof({
  pyramid,
  at,
  w,
  d,
  h,
  color,
}: {
  pyramid: ConeGeometry;
  at: [number, number, number];
  w: number;
  d: number;
  h: number;
  color: string;
}) {
  const tile = useSurfaceTexture("tile", 3, 2);
  return (
    <mesh
      geometry={pyramid}
      position={[at[0], at[1] + h / 2, at[2]]}
      scale={[w / 0.7071, h, d / 0.7071]}
    >
      <meshStandardMaterial
        color={color}
        map={tile}
        bumpMap={tile}
        bumpScale={0.045}
        roughness={0.65}
      />
    </mesh>
  );
}

/** 칸 하나 — 상자 */
function Block({
  at,
  size,
  color,
  roughness = 0.85,
}: {
  at: [number, number, number];
  size: [number, number, number];
  color: string;
  roughness?: number;
}) {
  return (
    <mesh position={at}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={roughness} />
    </mesh>
  );
}

/** 층층이 올라가는 누각 몸체 + 처마. 층마다 `shrink`배로 줄어든다. */
function Tiers({
  pyramid,
  colors,
  x,
  z,
  y0,
  halfW,
  halfD,
  count,
  shrink,
  wallH,
  roofH,
  windows = true,
}: {
  pyramid: ConeGeometry;
  colors: SceneColors;
  x: number;
  z: number;
  y0: number;
  halfW: number;
  halfD: number;
  count: number;
  shrink: number;
  wallH: number;
  roofH: number;
  windows?: boolean;
}) {
  const layers: ReactNode[] = [];
  let y = y0;
  let w = halfW;
  let d = halfD;
  for (let i = 0; i < count; i++) {
    layers.push(
      <group key={i}>
        <Block
          at={[x, y + wallH / 2, z]}
          size={[w * 2 - 0.6, wallH, d * 2 - 0.6]}
          color={colors["--color-scene-wall"]}
        />
        {/* 층마다 불 켜진 창 */}
        {windows ? (
          <mesh position={[x, y + wallH * 0.55, z + d - 0.3 + 0.03]}>
            <boxGeometry args={[Math.min(1.4, w), wallH * 0.45, 0.06]} />
            <meshBasicMaterial color={colors["--color-scene-flame"]} />
          </mesh>
        ) : null}
        {/* 처마 밑 단청 띠 */}
        <Block
          at={[x, y + wallH - 0.12, z + d - 0.3 + 0.12]}
          size={[w * 2 - 0.6, 0.26, 0.2]}
          color={colors["--color-scene-dancheong"]}
        />
        <Roof
          pyramid={pyramid}
          at={[x, y + wallH, z]}
          w={w + 1.3}
          d={d + 1.3}
          h={roofH}
          color={colors["--color-scene-roof-tile"]}
        />
      </group>,
    );
    y += wallH + roofH * 0.55;
    w *= shrink;
    d *= shrink;
  }
  return <>{layers}</>;
}

/** 지붕 꼭대기 장식(놋쇠 첨탑) */
function Finial({
  colors,
  at,
  h = 1.4,
}: {
  colors: SceneColors;
  at: [number, number, number];
  h?: number;
}) {
  return (
    <mesh position={[at[0], at[1] + h / 2, at[2]]}>
      <cylinderGeometry args={[0.05, 0.14, h, 8]} />
      <meshStandardMaterial
        color={colors["--color-scene-brass"]}
        roughness={0.4}
      />
    </mesh>
  );
}

function SchoolHall({ b, colors }: { b: SchoolBuilding; colors: SceneColors }) {
  const pyramid = usePyramid();
  const wood = colors["--color-scene-wood"];
  const dark = colors["--color-scene-wood-dark"];
  const stone = colors["--color-scene-stone"];
  const wall = colors["--color-scene-wall"];
  const roofTile = colors["--color-scene-roof-tile"];
  const flame = colors["--color-scene-flame"];
  const bandColor = b.house
    ? colors[`--color-house-${b.house}-primary`]
    : colors["--color-scene-dancheong"];
  const flagColor = b.house ? colors[`--color-house-${b.house}-accent`] : null;
  const frontZ = b.z + b.halfD - 0.3;
  const bodyW = b.halfW * 2 - 0.6;
  const bodyD = b.halfD * 2 - 0.6;

  if (b.kind === "gate") {
    // 성곽 기단(돌) + 붉은 문 + 그 위로 겹층 누각
    const wallTop = 3.6;
    return (
      <group>
        <Block
          at={[b.x, wallTop / 2, b.z]}
          size={[b.halfW * 2, wallTop, b.halfD * 2]}
          color={stone}
          roughness={0.9}
        />
        {/* 성가퀴(성벽 위 톱니) */}
        {Array.from({ length: 9 }, (_, i) => (
          <Block
            key={i}
            at={[
              b.x - b.halfW + 0.7 + (i * (b.halfW * 2 - 1.4)) / 8,
              wallTop + 0.3,
              b.z + b.halfD - 0.2,
            ]}
            size={[0.7, 0.6, 0.4]}
            color={stone}
            roughness={0.9}
          />
        ))}
        {/* 붉은 대문과 문 위 아치 */}
        <Block
          at={[b.x, 1.5, b.z + b.halfD + 0.04]}
          size={[3, 3, 0.1]}
          color={colors["--color-scene-dancheong"]}
        />
        <Block
          at={[b.x, 3.1, b.z + b.halfD + 0.06]}
          size={[3.4, 0.4, 0.14]}
          color={dark}
        />
        {[-1, 1].map((sx) => (
          <Block
            key={sx}
            at={[b.x + sx * 0.75, 1.4, b.z + b.halfD + 0.12]}
            size={[1.3, 2.6, 0.06]}
            color={wood}
          />
        ))}
        <Tiers
          pyramid={pyramid}
          colors={colors}
          x={b.x}
          z={b.z}
          y0={wallTop + 0.3}
          halfW={b.halfW - 1}
          halfD={b.halfD - 0.4}
          count={2}
          shrink={0.62}
          wallH={2.4}
          roofH={2.2}
        />
        <Finial colors={colors} at={[b.x, 12.3, b.z]} />
        <pointLight
          position={[b.x, 5, b.z + b.halfD + 3]}
          intensity={7}
          distance={18}
          decay={1.6}
          color={flame}
        />
      </group>
    );
  }

  if (b.kind === "tower") {
    // 5층 탑 — 돌 기단 위로 층마다 줄어들고, 꼭대기에 첨탑
    const base = 1.2;
    return (
      <group>
        <Block
          at={[b.x, base / 2, b.z + 0.2]}
          size={[b.halfW * 2 + 2, base, b.halfD * 2 + 2]}
          color={stone}
          roughness={0.9}
        />
        <Tiers
          pyramid={pyramid}
          colors={colors}
          x={b.x}
          z={b.z}
          y0={base}
          halfW={b.halfW}
          halfD={b.halfD}
          count={5}
          shrink={0.84}
          wallH={2.4}
          roofH={1.5}
        />
        <Finial colors={colors} at={[b.x, 17.4, b.z]} h={2.4} />
        <pointLight
          position={[b.x, 6, b.z + b.halfD + 2]}
          intensity={6}
          distance={16}
          decay={1.6}
          color={flame}
        />
      </group>
    );
  }

  if (b.kind === "workshop") {
    // 낮은 기단 + 한 채 + 연못 쪽(북) 물레방아
    return (
      <group>
        <Block
          at={[b.x, 0.25, b.z + 0.3]}
          size={[b.halfW * 2 + 1.6, 0.5, b.halfD * 2 + 1.6]}
          color={stone}
          roughness={0.9}
        />
        <Block
          at={[b.x, 0.5 + 1.5, b.z]}
          size={[bodyW, 3, bodyD]}
          color={wall}
        />
        <Block
          at={[b.x - 0.5, 1.8, frontZ + 0.05]}
          size={[0.96, 2.6, 0.1]}
          color={wood}
        />
        <Block
          at={[b.x + 0.5, 1.8, frontZ + 0.05]}
          size={[0.96, 2.6, 0.1]}
          color={wood}
        />
        <Roof
          pyramid={pyramid}
          at={[b.x, 3.5, b.z + 0.2]}
          w={b.halfW + 1.6}
          d={b.halfD + 1.6}
          h={2.4}
          color={roofTile}
        />
        <Finial colors={colors} at={[b.x, 5.9, b.z + 0.2]} h={0.8} />
        {/* 물레방아 — 옆면(동쪽)에 세운다 */}
        <group position={[b.x + b.halfW + 0.2, 1.6, b.z]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[1.4, 1.4, 0.3, 12]} />
            <meshStandardMaterial color={dark} roughness={0.9} />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[1.0, 1.0, 0.36, 12]} />
            <meshStandardMaterial color={wood} roughness={0.9} />
          </mesh>
        </group>
        <pointLight
          position={[b.x, 3, frontZ + 1.5]}
          intensity={3}
          distance={9}
          decay={1.6}
          color={flame}
        />
      </group>
    );
  }

  // 기숙사 — 2단 기단, 앞 계단, 기둥 열, 겹처마
  const wallH = 3.2;
  const step1 = 0.4;
  const step2 = 0.8;
  const cols = 6;
  return (
    <group>
      <Block
        at={[b.x, step1 / 2, b.z + 0.4]}
        size={[b.halfW * 2 + 2.4, step1, b.halfD * 2 + 2.4]}
        color={stone}
        roughness={0.9}
      />
      <Block
        at={[b.x, (step2 + step1) / 2 - 0.2 + 0.2, b.z + 0.2]}
        size={[b.halfW * 2 + 1.2, step2 - step1 + step1, b.halfD * 2 + 1.2]}
        color={stone}
        roughness={0.9}
      />
      {/* 앞 계단 */}
      {[0, 1].map((i) => (
        <Block
          key={i}
          at={[b.x, 0.25 + i * 0.3, b.z + b.halfD + 1.2 + (1 - i) * 0.5]}
          size={[2.4, 0.5 + i * 0.3, 0.8]}
          color={stone}
          roughness={0.9}
        />
      ))}
      {/* 몸체 */}
      <Block
        at={[b.x, step2 + wallH / 2, b.z]}
        size={[bodyW, wallH, bodyD]}
        color={wall}
      />
      {/* 앞 기둥 열 */}
      {Array.from({ length: cols }, (_, i) => (
        <mesh
          key={i}
          position={[
            b.x - b.halfW + 0.6 + (i * (b.halfW * 2 - 1.2)) / (cols - 1),
            step2 + wallH / 2,
            b.z + b.halfD - 0.1,
          ]}
        >
          <cylinderGeometry args={[0.15, 0.15, wallH, 10]} />
          <meshStandardMaterial color={dark} roughness={0.8} />
        </mesh>
      ))}
      {/* 닫힌 문과 창 */}
      {[-1, 1].map((sx) => (
        <Block
          key={sx}
          at={[b.x + sx * 0.5, step2 + 1.3, frontZ + 0.05]}
          size={[0.96, 2.6, 0.1]}
          color={wood}
        />
      ))}
      {[-1, 1].map((sx) => (
        <mesh
          key={sx}
          position={[b.x + sx * b.halfW * 0.55, step2 + 1.9, frontZ + 0.03]}
        >
          <boxGeometry args={[1.2, 1.2, 0.06]} />
          <meshBasicMaterial color={flame} />
        </mesh>
      ))}
      <Block
        at={[b.x, step2 + wallH - 0.15, frontZ + 0.2]}
        size={[bodyW, 0.32, 0.2]}
        color={bandColor}
      />
      {/* 겹처마: 아래 처마 → 낮은 윗몸 → 위 지붕 */}
      <Roof
        pyramid={pyramid}
        at={[b.x, step2 + wallH, b.z + 0.2]}
        w={b.halfW + 1.5}
        d={b.halfD + 1.5}
        h={0.9}
        color={roofTile}
      />
      <Block
        at={[b.x, step2 + wallH + 0.6, b.z]}
        size={[bodyW * 0.7, 1.2, bodyD * 0.7]}
        color={wall}
      />
      <Roof
        pyramid={pyramid}
        at={[b.x, step2 + wallH + 0.9, b.z + 0.1]}
        w={b.halfW * 0.7 + 1.5}
        d={b.halfD * 0.7 + 1.5}
        h={2.2}
        color={roofTile}
      />
      <Finial colors={colors} at={[b.x, step2 + wallH + 3, b.z]} h={0.9} />
      {/* 기숙사 깃발 */}
      {flagColor ? (
        <group position={[b.x + b.halfW + 0.4, 0, b.z + b.halfD + 1.6]}>
          <mesh position={[0, 2.4, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 4.8, 8]} />
            <meshStandardMaterial color={dark} />
          </mesh>
          <mesh position={[0.45, 4, 0]}>
            <boxGeometry args={[0.9, 1.3, 0.04]} />
            <meshStandardMaterial color={flagColor} />
          </mesh>
        </group>
      ) : null}
    </group>
  );
}

function SchoolHalls({ colors }: { colors: SceneColors }) {
  return (
    <>
      {SCHOOL_BUILDINGS.map((b) => (
        <SchoolHall key={b.id} b={b} colors={colors} />
      ))}
    </>
  );
}

/* ── 먼 산 ─────────────────────────────────────────────────────
 * 꽃담 너머로 겹겹이 이어진 능선. 멀수록 크고 안개에 묻히며, 꼭대기는 달빛 받은 눈. */

const MOUNTAIN_LAYERS = [
  { count: 14, radius: 80, width: 32, height: 24, seed: 11 },
  { count: 16, radius: 104, width: 40, height: 34, seed: 29 },
] as const;

function Mountains({ colors }: { colors: SceneColors }) {
  const cone = useMemo(() => new ConeGeometry(1, 1, 5), []);
  const peaks = useMemo(
    () =>
      MOUNTAIN_LAYERS.flatMap((layer) => {
        const rand = seeded(layer.seed);
        return Array.from({ length: layer.count }, (_, i) => {
          const a = (i / layer.count) * Math.PI * 2 + rand() * 0.2;
          return {
            x: Math.sin(a) * layer.radius,
            z: Math.cos(a) * layer.radius,
            w: layer.width * (0.7 + rand() * 0.6),
            h: layer.height * (0.7 + rand() * 0.6),
          };
        });
      }),
    [],
  );
  const body = useMemo<Box[]>(
    () =>
      peaks.map((m) => ({ p: [m.x, m.h / 2 - 1, m.z], s: [m.w, m.h, m.w] })),
    [peaks],
  );
  const bodyTint = useMemo(
    () => peaks.map((_, i) => 0.28 + (i % 3) * 0.05),
    [peaks],
  );
  // 눈 덮인 꼭대기: 같은 모양의 위쪽 28%
  const snow = useMemo<Box[]>(
    () =>
      peaks.map((m) => ({
        p: [m.x, m.h * 0.86 - 1, m.z],
        s: [m.w * 0.28, m.h * 0.28, m.w * 0.28],
      })),
    [peaks],
  );
  return (
    <group>
      {/* 달밤이라 산 몸체는 어둡게 눌러 윤곽으로만 보이게 한다 */}
      <Inst
        boxes={body}
        color={colors["--color-scene-stone"]}
        roughness={1}
        tint={bodyTint}
      >
        <primitive object={cone} attach="geometry" />
      </Inst>
      <Inst
        boxes={snow}
        color={colors["--color-scene-moonlight"]}
        roughness={1}
        emissive={colors["--color-scene-moonlight"]}
      >
        <primitive object={cone} attach="geometry" />
      </Inst>
    </group>
  );
}

/* ── 정자 ──────────────────────────────────────────────────── */

function Pavilion({ colors }: { colors: SceneColors }) {
  const pyramid = usePyramid();
  const { x, z, half } = PAVILION;
  const dark = colors["--color-scene-wood-dark"];
  const wood = colors["--color-scene-wood"];
  const baseTop = 0.45;
  const postH = 3.4;
  const inset = half - 0.6;

  const posts = useMemo<Box[]>(
    () =>
      [-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => ({
          p: [x + sx * inset, baseTop + postH / 2, z + sz * inset] as Box["p"],
          s: [0.17, postH, 0.17] as Box["s"],
        })),
      ),
    [x, z, inset],
  );
  // 난간 — 남쪽(앞)은 열어 둔다
  const rails = useMemo<Box[]>(
    () => [
      { p: [x, baseTop + 0.55, z - inset], s: [inset * 2, 0.09, 0.09] },
      { p: [x - inset, baseTop + 0.55, z], s: [0.09, 0.09, inset * 2] },
      { p: [x + inset, baseTop + 0.55, z], s: [0.09, 0.09, inset * 2] },
    ],
    [x, z, inset],
  );
  const glow = useMemo(() => new Float32Array([x, baseTop + 2.6, z]), [x, z]);

  return (
    <group>
      <mesh position={[x, baseTop / 2, z]}>
        <boxGeometry args={[half * 2, baseTop, half * 2]} />
        <meshStandardMaterial
          color={colors["--color-scene-stone"]}
          roughness={0.9}
        />
      </mesh>
      <mesh position={[x, baseTop + 0.03, z]}>
        <boxGeometry args={[half * 2 - 0.6, 0.06, half * 2 - 0.6]} />
        <meshStandardMaterial color={wood} />
      </mesh>
      <Inst boxes={posts} color={dark}>
        {cyl(10)}
      </Inst>
      <Inst boxes={rails} color={dark}>
        {box()}
      </Inst>
      {/* 도리(가로보)와 단청 띠 */}
      <mesh position={[x, baseTop + postH + 0.1, z]}>
        <boxGeometry args={[half * 2 - 0.2, 0.28, half * 2 - 0.2]} />
        <meshStandardMaterial color={dark} />
      </mesh>
      <mesh position={[x, baseTop + postH - 0.12, z]}>
        <boxGeometry args={[half * 2 - 0.5, 0.1, half * 2 - 0.5]} />
        <meshStandardMaterial color={colors["--color-scene-dancheong"]} />
      </mesh>
      {/* 사모지붕 + 절병통(꼭대기) */}
      <mesh
        geometry={pyramid}
        position={[x, baseTop + postH + 0.24 + 1.3, z]}
        scale={[(half + 1.5) / 0.7071, 2.6, (half + 1.5) / 0.7071]}
      >
        <meshStandardMaterial
          color={colors["--color-scene-roof-tile"]}
          roughness={0.7}
        />
      </mesh>
      <mesh position={[x, baseTop + postH + 0.24 + 2.75, z]}>
        <sphereGeometry args={[0.22, 10, 10]} />
        <meshStandardMaterial
          color={colors["--color-scene-brass"]}
          metalness={0.6}
          roughness={0.4}
        />
      </mesh>
      <GlowPoints
        positions={glow}
        color={colors["--color-scene-flame"]}
        size={3}
        opacity={0.5}
      />
      <pointLight
        position={[x, baseTop + 2.6, z]}
        intensity={7}
        distance={13}
        decay={1.6}
        color={colors["--color-scene-flame"]}
      />
    </group>
  );
}

/* ── 나무: 소나무·대나무·매화 ────────────────────────────────── */

function Pines({ colors }: { colors: SceneColors }) {
  const parts = useMemo(() => {
    const tiers = [
      { y: 2.6, r: 2.0, h: 2.6 },
      { y: 4.3, r: 1.6, h: 2.3 },
      { y: 5.8, r: 1.15, h: 2.0 },
    ];
    const trunks: Box[] = PINES.map((t: Tree) => ({
      p: [t.x, 1.2 * t.s, t.z],
      s: [0.22 * t.s, 2.4 * t.s, 0.22 * t.s],
    }));
    const cones = tiers.map((tier) =>
      PINES.map((t: Tree) => ({
        p: [t.x, tier.y * t.s, t.z] as Box["p"],
        s: [tier.r * t.s, tier.h * t.s, tier.r * t.s] as Box["s"],
      })),
    );
    // 나무마다 잎 색을 조금씩 달리
    const rand = seeded(5);
    const tint = PINES.map(() => 0.85 + rand() * 0.3);
    return { trunks, cones, tint };
  }, []);
  return (
    <group>
      <Inst boxes={parts.trunks} color={colors["--color-scene-wood-dark"]}>
        {cyl(8)}
      </Inst>
      {parts.cones.map((boxes, i) => (
        <Inst
          key={i}
          boxes={boxes}
          color={colors["--color-scene-leaf"]}
          tint={parts.tint}
          roughness={0.95}
        >
          <coneGeometry args={[1, 1, 9]} />
        </Inst>
      ))}
    </group>
  );
}

function Bamboo({ colors }: { colors: SceneColors }) {
  const { boxes, tint } = useMemo(() => {
    const rand = seeded(9);
    return {
      boxes: BAMBOO.map((b) => ({
        p: [b.x, b.h / 2, b.z] as Box["p"],
        s: [0.07, b.h, 0.07] as Box["s"],
      })),
      tint: BAMBOO.map(() => 1.0 + rand() * 0.45),
    };
  }, []);
  return (
    <Inst boxes={boxes} color={colors["--color-scene-leaf"]} tint={tint}>
      {cyl(6)}
    </Inst>
  );
}

/** 매화: 줄기와 하얗게 핀 꽃무리 (백호관 아이보리색) */
function PlumTrees({ colors }: { colors: SceneColors }) {
  const { trunks, blossoms } = useMemo(() => {
    const rand = seeded(31);
    const trunks: Box[] = PLUM_TREES.map((t) => ({
      p: [t.x, 0.9, t.z],
      s: [0.16, 1.8, 0.16],
    }));
    const blossoms: Box[] = PLUM_TREES.flatMap((t) =>
      Array.from({ length: 7 }, () => {
        const a = rand() * Math.PI * 2;
        const r = 0.2 + rand() * 0.9;
        const s = 0.45 + rand() * 0.35;
        return {
          p: [t.x + Math.cos(a) * r, 2.0 + rand() * 0.9, t.z + Math.sin(a) * r],
          s: [s, s, s],
        } as Box;
      }),
    );
    return { trunks, blossoms };
  }, []);
  return (
    <group>
      <Inst boxes={trunks} color={colors["--color-scene-wood-dark"]}>
        {cyl(7)}
      </Inst>
      <Inst
        boxes={blossoms}
        color={colors["--color-house-baekho-primary"]}
        emissive={colors["--color-house-baekho-primary"]}
        roughness={0.8}
      >
        <sphereGeometry args={[1, 8, 8]} />
      </Inst>
    </group>
  );
}

/* ── 석등 ──────────────────────────────────────────────────── */

function StoneLanterns({ colors }: { colors: SceneColors }) {
  const { stone, flame, caps, glow } = useMemo(() => {
    const stone: Box[] = [];
    const flame: Box[] = [];
    const caps: Box[] = [];
    const glow: number[] = [];
    for (const l of STONE_LANTERNS) {
      stone.push({ p: [l.x, 0.14, l.z], s: [0.75, 0.28, 0.75] });
      stone.push({ p: [l.x, 0.72, l.z], s: [0.3, 0.9, 0.3] });
      flame.push({ p: [l.x, 1.45, l.z], s: [0.5, 0.46, 0.5] });
      caps.push({ p: [l.x, 1.95, l.z], s: [0.62, 0.45, 0.62] });
      glow.push(l.x, 1.45, l.z);
    }
    return { stone, flame, caps, glow: new Float32Array(glow) };
  }, []);
  const pyramid = usePyramid();
  return (
    <group>
      <Inst boxes={stone} color={colors["--color-scene-stone"]} roughness={0.9}>
        {box()}
      </Inst>
      <Inst boxes={flame} color={colors["--color-scene-flame"]} basic>
        {box()}
      </Inst>
      <InstancedPyramids boxes={caps} geometry={pyramid} colors={colors} />
      <GlowPoints
        positions={glow}
        color={colors["--color-scene-flame"]}
        size={2.2}
        opacity={0.4}
      />
    </group>
  );
}

/** 석등 지붕돌 — 피라미드 모양 인스턴스 */
function InstancedPyramids({
  boxes,
  geometry,
  colors,
}: {
  boxes: Box[];
  geometry: ConeGeometry;
  colors: SceneColors;
}) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => fillBoxes(ref.current, boxes), [boxes]);
  return (
    <instancedMesh ref={ref} args={[geometry, undefined, boxes.length]}>
      <meshStandardMaterial
        color={colors["--color-scene-roof-tile"]}
        roughness={0.7}
      />
    </instancedMesh>
  );
}

/* ── 연등(떠 있는 청사초롱) ──────────────────────────────────── */

const LANTERN_COUNT = 30;

function GardenLanterns({ colors }: { colors: SceneColors }) {
  const bodies = useRef<InstancedMesh>(null);
  const items = useMemo(() => {
    const rand = seeded(13);
    const spots = [...STONE_PATH, ...POND_PATH];
    return Array.from({ length: LANTERN_COUNT }, (_, i) => {
      const a = spots[i % spots.length];
      return {
        x: a.x + (rand() - 0.5) * 9,
        z: a.z + (rand() - 0.5) * 9,
        y: 2.6 + rand() * 1.6,
        phase: rand() * Math.PI * 2,
        blue: i % 2 === 0,
      };
    });
  }, []);
  const glow = useMemo(() => {
    const arr = new Float32Array(items.length * 3);
    items.forEach((it, i) => arr.set([it.x, it.y, it.z], i * 3));
    return arr;
  }, [items]);

  useLayoutEffect(() => {
    const c = new Color();
    items.forEach((it, i) =>
      bodies.current?.setColorAt(
        i,
        c.set(
          it.blue
            ? colors["--color-house-cheongryong-primary"]
            : colors["--color-house-jujak-primary"],
        ),
      ),
    );
    if (bodies.current?.instanceColor)
      bodies.current.instanceColor.needsUpdate = true;
  }, [items, colors]);

  const o = useMemo(() => new Object3D(), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    items.forEach((it, i) => {
      const sway = Math.sin(t * 0.6 + it.phase) * 0.1;
      o.position.set(it.x, it.y + Math.sin(t * 0.8 + it.phase) * 0.14, it.z);
      o.rotation.set(sway, t * 0.2 + it.phase, sway * 0.5);
      o.scale.setScalar(1.15);
      o.updateMatrix();
      bodies.current?.setMatrixAt(i, o.matrix);
    });
    if (bodies.current) bodies.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <group>
      <instancedMesh ref={bodies} args={[undefined, undefined, LANTERN_COUNT]}>
        <cylinderGeometry args={[0.17, 0.2, 0.44, 12]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <GlowPoints
        positions={glow}
        color={colors["--color-scene-flame"]}
        size={1.7}
        opacity={0.3}
      />
    </group>
  );
}

/* ── 하늘(달·별)과 반딧불 ───────────────────────────────────── */

function Sky({ colors }: { colors: SceneColors }) {
  const stars = useMemo(() => {
    const rand = seeded(3);
    const arr = new Float32Array(520 * 3);
    for (let i = 0; i < 520; i++) {
      const theta = rand() * Math.PI * 2;
      // 위쪽 반구(수평선 위)에만
      const phi = Math.acos(0.08 + rand() * 0.92);
      const r = 130;
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.cos(phi);
      arr[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    return arr;
  }, []);
  const moonAt: [number, number, number] = [-46, 46, -84];
  const halo = useMemo(() => new Float32Array(moonAt), []);
  return (
    <group>
      <points frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[stars, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color={colors["--color-scene-moonlight"]}
          size={1.8}
          sizeAttenuation={false}
          transparent
          opacity={0.85}
          depthWrite={false}
          fog={false}
          toneMapped={false}
          onBeforeCompile={roundGlowShader}
          customProgramCacheKey={roundGlowKey}
        />
      </points>
      <mesh position={moonAt}>
        <sphereGeometry args={[6, 24, 24]} />
        <meshBasicMaterial
          color={colors["--color-scene-moonlight"]}
          fog={false}
          toneMapped={false}
        />
      </mesh>
      <GlowPoints
        positions={halo}
        color={colors["--color-scene-moonlight"]}
        size={150}
        opacity={0.28}
      />
    </group>
  );
}

const FIREFLIES = 170;
function Fireflies({ colors }: { colors: SceneColors }) {
  const ref = useRef<Points>(null);
  const seeds = useMemo(() => {
    const rand = seeded(99);
    return Array.from({ length: FIREFLIES }, () => ({
      x: (rand() * 2 - 1) * (GARDEN_HALF - 2),
      z: (rand() * 2 - 1) * (GARDEN_HALF - 2),
      y: 0.4 + rand() * 2.8,
      phase: rand() * Math.PI * 2,
      speed: 0.25 + rand() * 0.4,
    }));
  }, []);
  const positions = useMemo(() => new Float32Array(FIREFLIES * 3), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    seeds.forEach((s, i) => {
      positions[i * 3] = s.x + Math.sin(t * s.speed + s.phase) * 1.4;
      positions[i * 3 + 1] = s.y + Math.sin(t * s.speed * 1.7 + s.phase) * 0.5;
      positions[i * 3 + 2] = s.z + Math.cos(t * s.speed * 0.9 + s.phase) * 1.4;
    });
    const attr = ref.current?.geometry.getAttribute("position") as
      | BufferAttribute
      | undefined;
    if (attr) attr.needsUpdate = true;
  });
  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={colors["--color-scene-flame"]}
        size={0.22}
        sizeAttenuation
        transparent
        opacity={0.85}
        depthWrite={false}
        toneMapped={false}
        onBeforeCompile={roundGlowShader}
        customProgramCacheKey={roundGlowKey}
      />
    </points>
  );
}

/** 숨돌림 뜰 전체 */
export function GardenScenery({ colors }: { colors: SceneColors }) {
  return (
    <group>
      <Ground colors={colors} />
      <Paths colors={colors} />
      <Pond colors={colors} />
      <FlowerWall colors={colors} />
      <LibraryHall colors={colors} />
      <SchoolHalls colors={colors} />
      <Mountains colors={colors} />
      <Pavilion colors={colors} />
      <Pines colors={colors} />
      <Bamboo colors={colors} />
      <PlumTrees colors={colors} />
      <StoneLanterns colors={colors} />
      <GardenLanterns colors={colors} />
      <Sky colors={colors} />
      <Fireflies colors={colors} />
    </group>
  );
}
