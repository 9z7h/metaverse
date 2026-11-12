/**
 * 숨돌림 뜰의 풍경 — 달밤의 한국식 후원.
 * 서고 건물, 정자, 연못, 소나무·대나무·매화, 석등, 꽃담, 연등, 달과 별, 반딧불.
 * 반복되는 것은 전부 InstancedMesh로 묶어 draw call을 아낀다. 색은 모두 장면 토큰에서 읽는다.
 */
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useTexture } from "@react-three/drei";
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Object3D,
  RepeatWrapping,
  SRGBColorSpace,
} from "three";
import type { Group, InstancedMesh, PointLight, Points, Texture } from "three";
import { gardenDaylight } from "./gardenTime";
import { HanokDoor } from "../HanokDoor";
import { useSurfaceTexture } from "../surfaceTexture";
import { MergedBoxes, fillBoxes } from "../LibraryRoom";
import type { Box, TrimBox } from "../LibraryRoom";
import { roundGlowKey, roundGlowShader } from "../MagicEffect";
import type { SceneColors } from "../sceneLayout";
import {
  BAMBOO,
  BUILDING_PLATFORMS,
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
  STAIR_COUNT,
  STAIR_DEPTH,
  STAIR_WIDTH,
  GARDEN_LIGHT_POOL,
  STATIC_LIGHTS,
  assignLightSlots,
  pickNearestLights,
} from "./gardenLayout";
import type { LightSource, SchoolBuilding } from "./gardenLayout";
import { GuardianFlag } from "./GuardianFlag";
import { MysticFox } from "./MysticFox";
import { GuardianToad } from "./GuardianToad";
import { Haetae } from "./Haetae";
import type { HouseId } from "../../houses";

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

function Ground() {
  const size = (GARDEN_HALF + 3) * 2;
  const ground = useTexture(
    `${import.meta.env.BASE_URL}textures/garden-green.jpg`,
    (texture) => {
      texture.colorSpace = SRGBColorSpace;
      texture.wrapS = texture.wrapT = RepeatWrapping;
      texture.repeat.set(16, 16);
      texture.anisotropy = 8;
    },
  );
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial
        map={ground}
        bumpMap={ground}
        bumpScale={0.025}
        roughness={1}
      />
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
    <Inst
      boxes={boxes}
      color={colors["--color-scene-stone"]}
      roughness={0.9}
      map={stone}
    >
      {box()}
    </Inst>
  );
}

function Pond({ colors }: { colors: SceneColors }) {
  const water = useTexture(
    `${import.meta.env.BASE_URL}textures/garden-water.jpg`,
    (texture) => {
      texture.colorSpace = SRGBColorSpace;
      texture.wrapS = texture.wrapT = RepeatWrapping;
      texture.repeat.set(2, 2);
      texture.anisotropy = 8;
    },
  );
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useFrame((_, delta) => {
    if (!reducedMotion) {
      water.offset.x = (water.offset.x + Math.min(delta, 0.1) * 0.002) % 1;
      water.offset.y = (water.offset.y + Math.min(delta, 0.1) * 0.001) % 1;
    }
  });
  const stone = useSurfaceTexture("stone", 2, 2);
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
          map={water}
          bumpMap={water}
          bumpScale={0.012}
          roughness={0.28}
          metalness={0.15}
          emissive={colors["--color-scene-moonlight"]}
          emissiveIntensity={0.1}
        />
      </mesh>
      <Inst
        boxes={rim}
        color={colors["--color-scene-stone"]}
        roughness={0.9}
        map={stone}
      >
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
/** 기와 지붕 단면 — 용마루가 위, 양쪽 처마가 아래인 삼각기둥. 길이 1, 폭 1, 높이 1 단위 */
function usePrism() {
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    const P = (x: number, y: number, z: number) => [x, y, z];
    const quads: number[][][] = [
      // 앞쪽 경사 (UV: u=길이, v=경사 방향)
      [P(-0.5, 0, 0.5), P(0.5, 0, 0.5), P(0.5, 1, 0), P(-0.5, 1, 0)],
      // 뒤쪽 경사
      [P(0.5, 0, -0.5), P(-0.5, 0, -0.5), P(-0.5, 1, 0), P(0.5, 1, 0)],
    ];
    const pos: number[] = [];
    const uv: number[] = [];
    for (const q of quads) {
      const t = [0, 1, 2, 0, 2, 3];
      const uvs = [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ];
      for (const i of t) {
        pos.push(...q[i]);
        uv.push(...uvs[i]);
      }
    }
    // 양 끝 삼각형
    for (const sx of [-1, 1]) {
      const tri =
        sx < 0
          ? [P(-0.5, 0, -0.5), P(-0.5, 0, 0.5), P(-0.5, 1, 0)]
          : [P(0.5, 0, 0.5), P(0.5, 0, -0.5), P(0.5, 1, 0)];
      for (const v of tri) {
        pos.push(...v);
        uv.push(0.5, v[1]);
      }
    }
    g.setAttribute("position", new Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    return g;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/**
 * 뜰을 두른 한옥 기와 담장 — 베이지 회벽 몸체 위에 기와 지붕·용마루.
 * 모서리는 동서(x 방향) 담이 바깥 모서리까지 덮고, 남북 담은 그 중심선에서 멈춰
 * 용마루끼리 만나게 해서 끊김·튀어나옴 없이 이어진다.
 */
function FlowerWall({ colors }: { colors: SceneColors }) {
  const plaster = useSurfaceTexture("plaster", 2, 2);
  const tile = useSurfaceTexture("tile", 1.35, 0.5);
  const wood = useSurfaceTexture("wood", 1, 2);
  const prism = usePrism();
  // 밤에도 기와의 이랑이 읽히도록 기와색에 석재색을 살짝 섞는다 (둘 다 토큰)
  const roofColor = useMemo(
    () =>
      new Color(colors["--color-scene-roof-tile"]).lerp(
        new Color(colors["--color-scene-stone"]),
        0.4,
      ),
    [colors],
  );
  const { bodies, roofs, trims } = useMemo(() => {
    const bodies: Box[] = [];
    const roofs: Box[] = [];
    const trims: Box[] = [];
    const edge = GARDEN_HALF + 0.4;
    const wallH = 1.7;
    const baseY = 1.78;
    const roofH = 0.62;
    const segments = 35;
    const run = (half: number, ry: number, side: number) => {
      const len = (half * 2) / segments;
      for (let i = 0; i < segments; i++) {
        const c = -half + len * (i + 0.5);
        const at = (y: number): [number, number, number] =>
          ry === 0 ? [c, y, side * edge] : [side * edge, y, c];
        const r = ry === 0 ? undefined : ry;
        bodies.push({ p: at(wallH / 2), s: [len + 0.01, wallH, 0.4], ry: r });
        trims.push({ p: at(1.74), s: [len + 0.01, 0.1, 0.78], ry: r });
        trims.push({
          p: at(baseY + roofH + 0.03),
          s: [len + 0.01, 0.1, 0.16],
          ry: r,
        });
        roofs.push({ p: at(baseY), s: [len + 0.01, roofH, 0.98], ry: r });
      }
    };
    for (const side of [-1, 1]) {
      run(edge + 0.5, 0, side); // 남·북: 바깥 모서리까지
      run(edge, Math.PI / 2, side); // 동·서: 남북 담의 중심선에서 멈춤
    }
    return { bodies, roofs, trims };
  }, []);
  return (
    <group>
      <Inst
        boxes={bodies}
        map={plaster}
        color={colors["--color-scene-wall"]}
        roughness={0.95}
      >
        {box()}
      </Inst>
      <Inst
        boxes={trims}
        map={wood}
        color={colors["--color-scene-wood-dark"]}
        roughness={0.8}
      >
        {box()}
      </Inst>
      <Inst boxes={roofs} map={tile} color={roofColor} roughness={0.5}>
        <primitive object={prism} attach="geometry" />
      </Inst>
    </group>
  );
}

/* ── 서고 건물(뒷모습이 아닌 정면) ───────────────────────────── */

function LibraryHall({
  colors,
  doorOpen,
}: {
  colors: SceneColors;
  doorOpen: boolean;
}) {
  const stone = useSurfaceTexture("stone", 3, 2);
  const plaster = useSurfaceTexture("plaster", 3, 2);
  const woodMap = useSurfaceTexture("wood", 1, 2);
  const tile = useSurfaceTexture("tile", 3, 2);
  const pyramid = usePyramid();
  const { x, z, halfW, halfD, frontZ } = LIBRARY_BUILDING;
  const dark = colors["--color-scene-wood-dark"];
  const baseTop = 0.6;
  const wallH = 5.9;
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
          map={stone}
          bumpMap={stone}
          bumpScale={0.02}
          roughness={0.9}
        />
      </mesh>
      {/* 몸체 */}
      <mesh position={[x, baseTop + wallH / 2, z]}>
        <boxGeometry args={[halfW * 2 - 1, wallH, halfD * 2]} />
        <meshStandardMaterial
          color={colors["--color-scene-wall"]}
          map={plaster}
        />
      </mesh>
      <Inst boxes={columns} color={dark} map={woodMap}>
        {cyl(10)}
      </Inst>
      {/* 불 켜진 창호 */}
      <Inst boxes={windows} color={colors["--color-scene-flame"]} basic>
        {box()}
      </Inst>
      {/* 서고와 같은 창호·고리 손잡이를 쓰는 대문 */}
      <group position={[x, baseTop, frontZ + 0.12]}>
        <HanokDoor
          colors={colors}
          width={2.4}
          height={3}
          warmInside
          open={doorOpen}
          backdrop={colors["--color-scene-wood-dark"]}
        />
      </group>
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
          map={tile}
          bumpMap={tile}
          bumpScale={0.04}
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

const BuildingMaterials = createContext<{
  colors: SceneColors;
  stone: Texture;
  wall: Texture;
  wood: Texture;
} | null>(null);

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
  const materials = useContext(BuildingMaterials);
  const map =
    materials &&
    (color === materials.colors["--color-scene-stone"]
      ? materials.stone
      : color === materials.colors["--color-scene-wall"]
        ? materials.wall
        : color === materials.colors["--color-scene-wood"] ||
            color === materials.colors["--color-scene-wood-dark"]
          ? materials.wood
          : undefined);
  return (
    <mesh position={at}>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        map={map || undefined}
        roughness={roughness}
      />
    </mesh>
  );
}

function gateStuds(cx: number, z: number): TrimBox[] {
  const out: TrimBox[] = [];
  for (const sx of [-1, 1])
    for (const y of [0.9, 1.4, 1.9])
      for (const dx of [-0.35, 0.35])
        out.push({ at: [cx + sx * 0.75 + dx, y, z], size: [0.12, 0.12, 0.06] });
  return out;
}

function dormTrim(
  cx: number,
  cz: number,
  halfW: number,
  halfD: number,
  frontZ: number,
  step2: number,
  wallH: number,
): TrimBox[] {
  const out: TrimBox[] = [
    {
      at: [cx, step2 + wallH - 0.03, cz + 0.2],
      size: [(halfW + 1.5) * 2 - 0.4, 0.14, (halfD + 1.5) * 2 - 0.4],
    },
  ];
  for (const sx of [-1, 1]) {
    out.push({
      at: [cx + sx * 0.5, step2 + 1.3, frontZ + 0.12],
      size: [0.05, 2.6, 0.04],
    });
    for (const y of [0.6, 1.3, 2.0])
      out.push({
        at: [cx + sx * 0.5, step2 + y, frontZ + 0.12],
        size: [0.96, 0.05, 0.04],
      });
    const wx = cx + sx * halfW * 0.55;
    out.push({ at: [wx, step2 + 1.9, frontZ + 0.08], size: [0.05, 1.2, 0.04] });
    out.push({ at: [wx, step2 + 1.9, frontZ + 0.08], size: [1.2, 0.05, 0.04] });
  }
  return out;
}

function tierTrim(
  x: number,
  y: number,
  z: number,
  w: number,
  d: number,
  wallH: number,
  windows: boolean,
): TrimBox[] {
  const out: TrimBox[] = [
    { at: [x, y + wallH - 0.02, z], size: [w * 2 + 0.7, 0.14, d * 2 + 0.7] },
  ];
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      out.push({
        at: [x + sx * (w - 0.28), y + wallH / 2, z + sz * (d - 0.28)],
        size: [0.24, wallH, 0.24],
      });
  if (windows) {
    const wz = z + d - 0.3 + 0.07;
    out.push({
      at: [x, y + wallH * 0.55, wz],
      size: [0.05, wallH * 0.45, 0.04],
    });
    out.push({
      at: [x, y + wallH * 0.55, wz],
      size: [Math.min(1.4, w), 0.05, 0.04],
    });
  }
  return out;
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
        {/* 창살·네 귀퉁이 기둥·처마 밑 서까래 판 — 한 덩어리 */}
        <MergedBoxes
          boxes={tierTrim(x, y, z, w, d, wallH, windows)}
          color={colors["--color-scene-wood-dark"]}
          roughness={0.8}
        />
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
  const woodTexture = useSurfaceTexture("wood", 1, 2);
  const wood = colors["--color-scene-wood"];
  const dark = colors["--color-scene-wood-dark"];
  const stone = colors["--color-scene-stone"];
  const wall = colors["--color-scene-wall"];
  const roofTile = colors["--color-scene-roof-tile"];
  const flame = colors["--color-scene-flame"];
  const bandColor = b.house
    ? colors[`--color-house-${b.house}-primary`]
    : colors["--color-scene-dancheong"];
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
        {/* 문의 놋쇠 징 */}
        <MergedBoxes
          boxes={gateStuds(b.x, b.z + b.halfD + 0.17)}
          color={colors["--color-scene-brass"]}
          roughness={0.4}
        />
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
          <meshStandardMaterial
            color={dark}
            map={woodTexture}
            roughness={0.8}
          />
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
      {/* 문살·창살·처마 밑 서까래 판 — 한 덩어리 */}
      <MergedBoxes
        boxes={dormTrim(b.x, b.z, b.halfW, b.halfD, frontZ, step2, wallH)}
        color={dark}
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
      {/* 입구 좌우의 사신수 깃발 — 계단 폭 바깥, 기단 윗면에 선다 */}
      {b.house
        ? [-1, 1].map((sx) => (
            <GuardianFlag
              key={sx}
              house={b.house as HouseId}
              colors={colors}
              position={[b.x + sx * 3.1, step2 + 0.2, b.z + b.halfD + 0.5]}
              phase={sx * 1.3}
              poleSide={sx < 0 ? -1 : 1}
            />
          ))
        : null}
    </group>
  );
}

function SchoolHalls({ colors }: { colors: SceneColors }) {
  const stone = useSurfaceTexture("stone", 2, 2);
  const wall = useSurfaceTexture("plaster", 2, 2);
  const wood = useSurfaceTexture("wood", 1, 2);
  const materials = useMemo(
    () => ({ colors, stone, wall, wood }),
    [colors, stone, wall, wood],
  );
  return (
    <BuildingMaterials.Provider value={materials}>
      {SCHOOL_BUILDINGS.map((b) => (
        <SchoolHall key={b.id} b={b} colors={colors} />
      ))}
    </BuildingMaterials.Provider>
  );
}

function BuildingSteps({ colors }: { colors: SceneColors }) {
  const stone = useSurfaceTexture("stone", 2, 2);
  return (
    <group>
      {BUILDING_PLATFORMS.flatMap((p, building) =>
        Array.from({ length: STAIR_COUNT }, (_, i) => {
          const height = (p.height * (STAIR_COUNT - i)) / (STAIR_COUNT + 1);
          return (
            <mesh
              key={`${building}-${i}`}
              position={[
                p.x,
                height / 2,
                p.z + p.halfD + STAIR_DEPTH * (i + 0.5),
              ]}
            >
              <boxGeometry args={[STAIR_WIDTH, height, STAIR_DEPTH]} />
              <meshStandardMaterial
                color={colors["--color-scene-stone"]}
                map={stone}
                bumpMap={stone}
                bumpScale={0.02}
                roughness={0.9}
              />
            </mesh>
          );
        }),
      )}
      {SCHOOL_BUILDINGS.filter((b) => b.kind === "dorm").map((b) => (
        <mesh key={`upper-${b.id}`} position={[b.x, 0.35, b.z + b.halfD + 1.2]}>
          <boxGeometry args={[STAIR_WIDTH, 0.7, 0.8]} />
          <meshStandardMaterial
            color={colors["--color-scene-stone"]}
            map={stone}
            bumpMap={stone}
            bumpScale={0.02}
            roughness={0.9}
          />
        </mesh>
      ))}
    </group>
  );
}

/* ── 숲과 산으로 둘러싸인 원경 ─────────────────────────── */
function Landscape({ daylight }: { daylight: number }) {
  const map = useTexture(
    `${import.meta.env.BASE_URL}textures/garden-panorama.jpg`,
    (texture) => {
      texture.colorSpace = SRGBColorSpace;
      texture.anisotropy = 8;
    },
  );
  return (
    <mesh>
      <sphereGeometry args={[150, 32, 16]} />
      <meshBasicMaterial
        map={map}
        color={new Color().setScalar(0.045 + daylight * 0.955)}
        side={BackSide}
        fog={false}
        toneMapped={false}
        depthWrite={false}
      />
    </mesh>
  );
}

/** 수평선과 나무 위로 충분히 떨어진 높은 하늘의 구름 */
function Clouds({ daylight }: { daylight: number }) {
  const group = useRef<Group>(null);
  const map = useTexture(
    `${import.meta.env.BASE_URL}textures/garden-clouds.jpg`,
    (texture) => {
      texture.colorSpace = SRGBColorSpace;
      texture.anisotropy = 8;
    },
  );
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useFrame((_, delta) => {
    if (group.current && !reducedMotion)
      group.current.rotation.y += Math.min(delta, 0.1) * 0.003;
  });
  return (
    <group ref={group}>
      <mesh>
        <sphereGeometry args={[140, 32, 16, 0, Math.PI * 2, 0, Math.PI / 3]} />
        <meshBasicMaterial
          map={map}
          side={BackSide}
          transparent
          opacity={0.12 + daylight * 0.48}
          blending={AdditiveBlending}
          depthWrite={false}
          fog={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

/* ── 정자 ──────────────────────────────────────────────────── */

function Pavilion({ colors }: { colors: SceneColors }) {
  const woodMap = useSurfaceTexture("wood", 2, 2);
  const tile = useSurfaceTexture("tile", 3, 2);
  const stone = useSurfaceTexture("stone", 2, 2);
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
          map={stone}
          roughness={0.9}
        />
      </mesh>
      <mesh position={[x, baseTop + 0.03, z]}>
        <boxGeometry args={[half * 2 - 0.6, 0.06, half * 2 - 0.6]} />
        <meshStandardMaterial color={wood} map={woodMap} />
      </mesh>
      <Inst boxes={posts} color={dark} map={woodMap}>
        {cyl(10)}
      </Inst>
      <Inst boxes={rails} color={dark} map={woodMap}>
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
          map={tile}
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
    </group>
  );
}

/* ── 나무: 소나무·대나무·매화 ────────────────────────────────── */

function Pines() {
  const { scene } = useGLTF(
    `${import.meta.env.BASE_URL}models/pine-sapling.glb`,
  );
  const trees = useMemo(
    () =>
      PINES.flatMap((tree, i) => {
        const variants = [
          "pine_sapling_small_a",
          "pine_sapling_small_b",
          "pine_sapling_small_c",
        ];
        return [0, 1, 2].map((layer) => {
          const source = scene.getObjectByName(
            variants[(i + layer) % variants.length],
          );
          if (!source) return null;
          const model = source.clone(true);
          model.position.set(tree.x, 0, tree.z);
          model.rotation.y = i * 2.39996 + layer * 1.7;
          model.scale.set(
            tree.s * 4.5 * [1.2, 1.42, 1.3][layer],
            tree.s * 4.5 * [1, 0.86, 0.96][layer],
            tree.s * 4.5 * [1.2, 1.42, 1.3][layer],
          );
          return model;
        });
      }),
    [scene],
  );
  return (
    <group>
      {trees.map((tree, i) => tree && <primitive key={i} object={tree} />)}
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
  const bark = useSurfaceTexture("wood", 1, 2);
  const blossoms = useTexture(
    `${import.meta.env.BASE_URL}textures/plum-branch.png`,
    (texture) => {
      texture.colorSpace = SRGBColorSpace;
      texture.anisotropy = 8;
    },
  );
  const trunks = useMemo<Box[]>(
    () =>
      PLUM_TREES.map((tree) => ({
        p: [tree.x, 1.05, tree.z],
        s: [0.16, 2.1, 0.16],
      })),
    [],
  );
  return (
    <group>
      <Inst boxes={trunks} color={colors["--color-scene-wood-dark"]} map={bark}>
        {cyl(10)}
      </Inst>
      {PLUM_TREES.map((tree, i) => (
        <group key={i} position={[tree.x, 0, tree.z]}>
          {[0, 1, 2].map((branch) => (
            <group
              key={branch}
              rotation={[0, (branch * Math.PI) / 3 + i * 0.4, 0]}
            >
              <mesh position={[0, 2.35, 0]}>
                <planeGeometry args={[3.5, 2.35]} />
                <meshStandardMaterial
                  map={blossoms}
                  transparent
                  alphaTest={0.35}
                  side={DoubleSide}
                  roughness={0.9}
                />
              </mesh>
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}

/** 매화 위에 떠 있는 하얀 구름 무리 */
function WhiteCloudClusters({ colors }: { colors: SceneColors }) {
  const clouds = useMemo<Box[]>(() => {
    const rand = seeded(31);
    return PLUM_TREES.flatMap((tree) =>
      Array.from({ length: 7 }, () => {
        const angle = rand() * Math.PI * 2;
        const radius = 0.2 + rand() * 0.9;
        const size = 0.45 + rand() * 0.35;
        return {
          p: [
            tree.x + Math.cos(angle) * radius,
            5.3 + rand() * 0.6,
            tree.z + Math.sin(angle) * radius,
          ],
          s: [size, size * 0.8, size],
        };
      }),
    );
  }, []);
  return (
    <Inst
      boxes={clouds}
      color={colors["--color-house-baekho-primary"]}
      emissive={colors["--color-house-baekho-primary"]}
      roughness={0.8}
    >
      <sphereGeometry args={[1, 8, 8]} />
    </Inst>
  );
}

/* ── 석등 ──────────────────────────────────────────────────── */

/**
 * 정원의 점광원 전부. 후보(건물·정자·석등·떠다니는 등)는 많지만 실제 `pointLight`는
 * GARDEN_LIGHT_POOL개만 항상 켜 두고, 카메라 가까운 후보에 배정한다.
 * 켜진 점광원 수가 바뀌면 셰이더가 다시 컴파일되어 걸을 때 끊기므로, 쓰지 않는 칸은 intensity 0으로 둔다.
 */
function GardenLightPool({
  sources,
  color,
}: {
  sources: ReadonlyArray<LightSource>;
  color: string;
}) {
  const lights = useRef<(PointLight | null)[]>([]);
  const slots = useRef<(LightSource | null)[]>(
    Array.from({ length: GARDEN_LIGHT_POOL }, () => null),
  );
  const lastUpdate = useRef(-1);
  useFrame(({ camera, clock }) => {
    if (clock.elapsedTime - lastUpdate.current < 0.4) return;
    lastUpdate.current = clock.elapsedTime;
    const picked = pickNearestLights(
      sources,
      { x: camera.position.x, z: camera.position.z },
      GARDEN_LIGHT_POOL,
    );
    slots.current = assignLightSlots(slots.current, picked);
    lights.current.forEach((light, i) => {
      if (!light) return;
      const s = slots.current[i];
      if (!s) {
        light.intensity = 0;
        return;
      }
      light.position.set(s.x, s.y, s.z);
      light.intensity = s.intensity;
      light.distance = s.distance;
      light.decay = s.decay;
    });
  });
  return (
    <>
      {Array.from({ length: GARDEN_LIGHT_POOL }, (_, i) => (
        <pointLight
          key={i}
          ref={(light) => {
            lights.current[i] = light;
          }}
          color={color}
          intensity={0}
        />
      ))}
    </>
  );
}

/** 석등의 광원 후보 */
const STONE_LANTERN_LIGHTS: ReadonlyArray<LightSource> = STONE_LANTERNS.map(
  (l) => ({ x: l.x, y: 1.45, z: l.z, intensity: 1.6, distance: 8, decay: 1.7 }),
);

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
        size={4}
        opacity={0.22}
      />
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
const GARDEN_LANTERN_ITEMS = (() => {
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
})();
/** 떠다니는 등의 광원 후보 */
const FLOATING_LANTERN_LIGHTS: ReadonlyArray<LightSource> =
  GARDEN_LANTERN_ITEMS.map((it) => ({
    x: it.x,
    y: it.y,
    z: it.z,
    intensity: 0.7,
    distance: 4.5,
    decay: 1.8,
  }));
/** 정원 전체 광원 후보 */
const GARDEN_LIGHT_SOURCES: ReadonlyArray<LightSource> = [
  ...STATIC_LIGHTS,
  ...STONE_LANTERN_LIGHTS,
  ...FLOATING_LANTERN_LIGHTS,
];

function GardenLanterns({ colors }: { colors: SceneColors }) {
  const bodies = useRef<InstancedMesh>(null);
  const items = GARDEN_LANTERN_ITEMS;
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
        <meshStandardMaterial
          emissive={colors["--color-scene-flame"]}
          emissiveIntensity={0.18}
          roughness={0.9}
        />
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

function Sky({ colors, night }: { colors: SceneColors; night: number }) {
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
          opacity={0.85 * night}
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
          transparent
          opacity={night}
          depthWrite={false}
          fog={false}
          toneMapped={false}
        />
      </mesh>
      <GlowPoints
        positions={halo}
        color={colors["--color-scene-moonlight"]}
        size={150}
        opacity={0.28 * night}
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
export function GardenScenery({
  colors,
  libraryDoorOpen = false,
}: {
  colors: SceneColors;
  /** 서고 대문이 열려 있는지 */
  libraryDoorOpen?: boolean;
}) {
  const [daylight, setDaylight] = useState(() => gardenDaylight(new Date()));
  useEffect(() => {
    const update = () => setDaylight(gardenDaylight(new Date()));
    const timer = window.setInterval(update, 30_000);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return (
    <group>
      <Ground />
      <Paths colors={colors} />
      <Pond colors={colors} />
      <GuardianToad colors={colors} />
      <FlowerWall colors={colors} />
      <LibraryHall colors={colors} doorOpen={libraryDoorOpen} />
      <SchoolHalls colors={colors} />
      <BuildingSteps colors={colors} />
      <Landscape daylight={daylight} />
      <Clouds daylight={daylight} />
      <ambientLight
        color={new Color(colors["--color-scene-moonlight"]).lerp(
          new Color(colors["--color-scene-light"]),
          daylight,
        )}
        intensity={0.3 + daylight * 0.85}
      />
      <hemisphereLight
        args={[
          colors["--color-scene-moonlight"],
          colors["--color-scene-floor"],
          0.26 + daylight * 0.19,
        ]}
      />
      <directionalLight
        position={[-18, 40, 12]}
        intensity={0.4 + daylight * 0.3}
        color={new Color(colors["--color-scene-moonlight"]).lerp(
          new Color(colors["--color-scene-light"]),
          daylight,
        )}
      />
      <Pavilion colors={colors} />
      <MysticFox colors={colors} />
      <Haetae colors={colors} />
      <Pines />
      <Bamboo colors={colors} />
      <PlumTrees colors={colors} />
      <WhiteCloudClusters colors={colors} />
      <StoneLanterns colors={colors} />
      <GardenLanterns colors={colors} />
      <Sky colors={colors} night={1 - daylight} />
      <Fireflies colors={colors} />
      <GardenLightPool
        sources={GARDEN_LIGHT_SOURCES}
        color={colors["--color-scene-flame"]}
      />
    </group>
  );
}
