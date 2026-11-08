/**
 * 사신학당 먹빛각 분위기 요소 — 청사초롱, 창호 달빛, 단청 띠, 기숙사 깃발, 반딧불 파티클.
 * 모바일 성능을 위해 반복 요소는 InstancedMesh/Points 한 덩어리로 그린다.
 */
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferAttribute,
  CanvasTexture,
  Color,
  DoubleSide,
  Object3D,
  SRGBColorSpace,
} from "three";
import type { InstancedMesh, Points } from "three";
import { CREST_SHAPES } from "../HouseCrest";
import { HOUSES, HOUSE_IDS, houseToken } from "../houses";
import type { HouseId } from "../houses";
import { FRONT_WALL_Z, HALL, ROOM, SIDE_SHELF_Z } from "./sceneLayout";
import { fillBoxes } from "./LibraryRoom";
import type { Box } from "./LibraryRoom";
import { useSurfaceTexture } from "./surfaceTexture";
import { roundGlowKey, roundGlowShader } from "./MagicEffect";
import type { SceneColors } from "./sceneLayout";

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const WALL_X = ROOM.maxX + 0.7; // 좌우 벽 안쪽 면
const BACK_Z = ROOM.minZ - 0.7; // 뒷벽 안쪽 면

/* ── 청사초롱: 공중에 떠서 흔들리는 비단 등 ─────────────────── */

const LANTERN_COUNT = 70;

function Lanterns({ colors }: { colors: SceneColors }) {
  const silk = useSurfaceTexture("plaster");
  const bodies = useRef<InstancedMesh>(null);
  const caps = useRef<InstancedMesh>(null);
  const items = useMemo(() => {
    const rand = seeded(7);
    return Array.from({ length: LANTERN_COUNT }, (_, i) => ({
      x: ROOM.minX + 0.6 + rand() * (ROOM.maxX - ROOM.minX - 1.2),
      // 열람실 + 입구 홀까지 (시점을 돌려 입구 쪽을 봐도 어둡지 않게).
      // 단, 문 위 순위판 앞 2.5m는 비운다 — 초롱이 깃발을 가리지 않도록
      z: ROOM.minZ + 0.6 + rand() * (FRONT_WALL_Z - 2.5 - ROOM.minZ - 0.6),
      // 아바타 모자(1.9m) 위, 카메라(4.6m) 아래 — 시야를 가리지 않는 높이
      y: 2.6 + rand() * 1.2,
      phase: rand() * Math.PI * 2,
      // 청사초롱: 파랑·빨강 번갈아
      blue: i % 2 === 0,
    }));
  }, []);

  useLayoutEffect(() => {
    const c = new Color();
    items.forEach((it, i) => {
      bodies.current?.setColorAt(
        i,
        c.set(
          it.blue
            ? colors["--color-house-cheongryong-primary"]
            : colors["--color-house-jujak-primary"],
        ),
      );
    });
    if (bodies.current?.instanceColor)
      bodies.current.instanceColor.needsUpdate = true;
  }, [items, colors]);

  const o = useMemo(() => new Object3D(), []);
  useFrame(({ clock, camera }) => {
    const t = clock.elapsedTime;
    items.forEach((it, i) => {
      const y = it.y + Math.sin(t * 0.8 + it.phase) * 0.12;
      const sway = Math.sin(t * 0.6 + it.phase) * 0.08;
      // 카메라 가까이(3m 이내)의 초롱은 화면을 크게 가리므로 숨김 (3~4.5m 사이는 서서히 작아짐)
      const dist = camera.position.distanceTo(o.position.set(it.x, y, it.z));
      const s = Math.min(1, Math.max(0, (dist - 3) / 1.5));
      o.rotation.set(sway, t * 0.2 + it.phase, sway * 0.5);
      o.scale.set(s, s, s);
      o.updateMatrix();
      bodies.current?.setMatrixAt(i, o.matrix);
      // 위·아래 덮개 (같은 변환에 y만 이동)
      o.position.set(it.x, y + 0.24, it.z);
      o.updateMatrix();
      caps.current?.setMatrixAt(i * 2, o.matrix);
      o.position.set(it.x, y - 0.24, it.z);
      o.updateMatrix();
      caps.current?.setMatrixAt(i * 2 + 1, o.matrix);
    });
    if (bodies.current) bodies.current.instanceMatrix.needsUpdate = true;
    if (caps.current) caps.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      {/* 몸통 — 청사초롱의 짙은 홍·청 비단 */}
      <instancedMesh ref={bodies} args={[undefined, undefined, LANTERN_COUNT]}>
        <cylinderGeometry args={[0.17, 0.2, 0.44, 12]} />
        {/* 비단의 질감과 등잔의 따뜻한 속빛 */}
        <meshStandardMaterial
          map={silk}
          roughness={0.88}
          emissive={colors["--color-scene-flame"]}
          emissiveIntensity={0.045}
        />
      </instancedMesh>
      <instancedMesh
        ref={caps}
        args={[undefined, undefined, LANTERN_COUNT * 2]}
      >
        <cylinderGeometry args={[0.13, 0.13, 0.05, 10]} />
        <meshStandardMaterial color={colors["--color-scene-wood-dark"]} />
      </instancedMesh>
    </group>
  );
}

/* ── 창호·살창: 문살 격자 사이로 달빛 ──────────────────────── */

interface WindowSpec {
  x: number;
  y: number;
  z: number;
  ry: number;
  w: number;
  h: number;
  /** 세로·가로 칸 수 (문살 개수 = 칸 수 - 1) */
  cols: number;
  rows: number;
  /** 문살 굵기 */
  bar: number;
}

const barsOf = (s: WindowSpec) => 4 + (s.cols - 1) + (s.rows - 1);

function Windows({ colors }: { colors: SceneColors }) {
  const bars = useRef<InstancedMesh>(null);
  const windows = useMemo<WindowSpec[]>(
    () => [
      // 뒷벽 가운데: 양옆 서가 사이를 높이 가르는 큰 격자 살창
      {
        x: 0,
        y: 5.4,
        z: BACK_Z + 0.02,
        ry: 0,
        w: 5,
        h: 6.8,
        cols: 8,
        rows: 10,
        bar: 0.06,
      },
      // 옆벽: 윗단 서가 위로, 서가 한 칸마다 높은 살창
      ...SIDE_SHELF_Z.flatMap((z) => [
        {
          x: -WALL_X + 0.02,
          y: 8.5,
          z,
          ry: Math.PI / 2,
          w: 2.2,
          h: 2.4,
          cols: 4,
          rows: 3,
          bar: 0.04,
        },
        {
          x: WALL_X - 0.02,
          y: 8.5,
          z,
          ry: -Math.PI / 2,
          w: 2.2,
          h: 2.4,
          cols: 4,
          rows: 3,
          bar: 0.04,
        },
      ]),
      // 입구 홀(서가 없는 앞쪽): 순위판 양옆 앞벽과 옆벽에도 살창을 내어 허전하지 않게
      ...[-5.5, 5.5].map((x) => ({
        x,
        y: 6.2,
        z: FRONT_WALL_Z - 0.02,
        ry: Math.PI,
        w: 2.2,
        h: 4,
        cols: 4,
        rows: 6,
        bar: 0.04,
      })),
      ...[12.6, 15.4].flatMap((z) => [
        {
          x: -WALL_X + 0.02,
          y: 7,
          z,
          ry: Math.PI / 2,
          w: 2.2,
          h: 3.4,
          cols: 4,
          rows: 5,
          bar: 0.04,
        },
        {
          x: WALL_X - 0.02,
          y: 7,
          z,
          ry: -Math.PI / 2,
          w: 2.2,
          h: 3.4,
          cols: 4,
          rows: 5,
          bar: 0.04,
        },
      ]),
    ],
    [],
  );
  const totalBars = useMemo(
    () => windows.reduce((n, w) => n + barsOf(w), 0),
    [windows],
  );

  useLayoutEffect(() => {
    const mesh = bars.current;
    if (!mesh) return;
    const o = new Object3D();
    const parent = new Object3D();
    let i = 0;
    const put = (lx: number, ly: number, sx: number, sy: number) => {
      o.position.set(lx, ly, 0.03);
      o.scale.set(sx, sy, 0.05);
      o.updateMatrix();
      o.matrix.premultiply(parent.matrix);
      mesh.setMatrixAt(i++, o.matrix);
    };
    for (const w of windows) {
      parent.position.set(w.x, w.y, w.z);
      parent.rotation.set(0, w.ry, 0);
      parent.updateMatrix();
      // 테두리
      put(0, w.h / 2, w.w + 0.12, 0.1);
      put(0, -w.h / 2, w.w + 0.12, 0.1);
      put(-w.w / 2, 0, 0.1, w.h);
      put(w.w / 2, 0, 0.1, w.h);
      // 세로·가로 문살
      for (let c = 1; c < w.cols; c++)
        put(-w.w / 2 + (c * w.w) / w.cols, 0, w.bar, w.h);
      for (let r = 1; r < w.rows; r++)
        put(0, -w.h / 2 + (r * w.h) / w.rows, w.w, w.bar);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [windows]);

  return (
    <group>
      {windows.map((w) => (
        <mesh
          key={`${w.x}${w.z}`}
          position={[w.x, w.y, w.z]}
          rotation={[0, w.ry, 0]}
        >
          <planeGeometry args={[w.w, w.h]} />
          {/* 창호지 너머 달빛 — 약하게 발광 */}
          <meshBasicMaterial
            color={colors["--color-scene-moonlight"]}
            toneMapped={false}
          />
        </mesh>
      ))}
      <instancedMesh ref={bars} args={[undefined, undefined, totalBars]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={colors["--color-scene-wood-dark"]} />
      </instancedMesh>
    </group>
  );
}

/* ── 단청 띠: 책장 위로 벽을 두르는 오방색 띠 ─────────────────── */

function DancheongBand({ colors }: { colors: SceneColors }) {
  // 윗단 서가 위, 살창 아래 — 높아진 벽을 가로지르는 띠
  const y = 7.15;
  const w = WALL_X * 2;
  // 뒷벽 ~ 앞벽(입구 홀 포함)
  const d = FRONT_WALL_Z - BACK_Z;
  const cz = (FRONT_WALL_Z + BACK_Z) / 2;
  const stripes = [
    { dy: 0.16, c: colors["--color-house-jujak-primary"] },
    { dy: -0.16, c: colors["--color-house-cheongryong-primary"] },
  ];
  return (
    <group>
      {/* 뒷벽·앞벽 (앞벽은 방 안쪽을 향하도록 z 방향 반대) */}
      {[
        { z: BACK_Z, dir: 1 },
        { z: FRONT_WALL_Z, dir: -1 },
      ].map(({ z, dir }) => (
        <group key={z}>
          <mesh position={[0, y, z + 0.05 * dir]}>
            <boxGeometry args={[w, 0.36, 0.08]} />
            <meshStandardMaterial color={colors["--color-scene-dancheong"]} />
          </mesh>
          {stripes.map((s) => (
            <mesh key={s.dy} position={[0, y + s.dy, z + 0.1 * dir]}>
              <boxGeometry args={[w, 0.05, 0.02]} />
              <meshStandardMaterial color={s.c} />
            </mesh>
          ))}
        </group>
      ))}
      {/* 좌우 벽 */}
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * (WALL_X - 0.05), y, cz]}>
            <boxGeometry args={[0.08, 0.36, d]} />
            <meshStandardMaterial color={colors["--color-scene-dancheong"]} />
          </mesh>
          {stripes.map((s) => (
            <mesh key={s.dy} position={[side * (WALL_X - 0.1), y + s.dy, cz]}>
              <boxGeometry args={[0.02, 0.05, d]} />
              <meshStandardMaterial color={s.c} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/* ── 기숙사 깃발: Canvas에 문장 + 세로 현판 글씨를 그려 텍스처로 ── */

function useBannerTexture(house: HouseId, colors: SceneColors) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 640;
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    return tex;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const draw = () => {
      if (cancelled) return;
      const ctx = (texture.image as HTMLCanvasElement).getContext("2d");
      if (!ctx) return;
      const primary = colors[houseToken(house, "primary")];
      const accent = colors[houseToken(house, "accent")];
      const W = 256;
      const H = 640;
      ctx.clearRect(0, 0, W, H);
      // 깃발 몸통 + 아래 제비꼬리
      ctx.fillStyle = primary;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(W, 0);
      ctx.lineTo(W, H);
      ctx.lineTo(W / 2, H - 70);
      ctx.lineTo(0, H);
      ctx.closePath();
      ctx.fill();
      // 안쪽 테두리
      ctx.strokeStyle = accent;
      ctx.lineWidth = 6;
      ctx.strokeRect(14, 14, W - 28, H - 120);
      // 문장 (64 좌표계 → 160px)
      ctx.save();
      ctx.translate(W / 2 - 80, 40);
      ctx.scale(2.5, 2.5);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (const s of CREST_SHAPES[house]) {
        const path = new Path2D(s.d);
        if (s.stroke) {
          ctx.strokeStyle = accent;
          ctx.lineWidth = s.stroke;
          ctx.stroke(path);
        } else {
          ctx.fillStyle = accent;
          ctx.fill(path, s.evenodd ? "evenodd" : "nonzero");
        }
      }
      ctx.restore();
      // 세로 현판 글씨 (한 글자씩)
      const family = getComputedStyle(document.body).fontFamily;
      ctx.fillStyle = accent;
      ctx.font = `700 64px ${family}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      [...HOUSES[house].name].forEach((ch, i) => {
        ctx.fillText(ch, W / 2, 268 + i * 84);
      });
      texture.needsUpdate = true;
    };
    draw();
    // Pretendard 로딩이 늦으면 폰트 준비 후 한 번 더 그림
    document.fonts?.ready.then(draw).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [house, colors, texture]);

  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

function Banner({
  house,
  colors,
  x,
}: {
  house: HouseId;
  colors: SceneColors;
  x: number;
}) {
  const map = useBannerTexture(house, colors);
  return (
    <mesh position={[x, 8.3, BACK_Z + 0.14]}>
      <planeGeometry args={[0.85, 2.1]} />
      <meshStandardMaterial
        map={map}
        transparent
        emissiveMap={map}
        emissive={colors["--color-scene-light"]}
        emissiveIntensity={0.35}
      />
    </mesh>
  );
}

function HouseBanners({ colors }: { colors: SceneColors }) {
  // 뒷벽 큰 살창 양옆, 윗단 서가 위
  const xs = [-7.2, -4.2, 4.2, 7.2];
  return (
    <group>
      {HOUSE_IDS.map((h, i) => (
        <Banner key={h} house={h} colors={colors} x={xs[i]} />
      ))}
    </group>
  );
}

/* ── 반딧불 파티클 ───────────────────────────────────────── */

const SPARK_COUNT = 420;

function Sparkles({ colors }: { colors: SceneColors }) {
  const ref = useRef<Points>(null);
  const seeds = useMemo(() => {
    const rand = seeded(99);
    return Array.from({ length: SPARK_COUNT }, () => ({
      x: ROOM.minX + rand() * (ROOM.maxX - ROOM.minX),
      z: ROOM.minZ + rand() * (ROOM.maxZ - ROOM.minZ),
      y: rand() * 9,
      speed: 0.08 + rand() * 0.12,
      phase: rand() * Math.PI * 2,
    }));
  }, []);
  const positions = useMemo(() => new Float32Array(SPARK_COUNT * 3), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    seeds.forEach((s, i) => {
      positions[i * 3] = s.x + Math.sin(t * 0.5 + s.phase) * 0.3;
      positions[i * 3 + 1] = (s.y + t * s.speed) % 9.4;
      positions[i * 3 + 2] = s.z + Math.cos(t * 0.4 + s.phase) * 0.3;
    });
    const attr = ref.current?.geometry.getAttribute("position") as
      | BufferAttribute
      | undefined;
    if (attr) attr.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        onBeforeCompile={roundGlowShader}
        customProgramCacheKey={roundGlowKey}
        color={colors["--color-scene-flame"]}
        size={0.1}
        sizeAttenuation
        transparent
        opacity={0.85}
        depthWrite={false}
        toneMapped={false}
      />
    </points>
  );
}

/* ── 떠다니는 두루마리 ──────────────────────────────────── */

function Scrolls({ colors }: { colors: SceneColors }) {
  const ref = useRef<InstancedMesh>(null);
  const items = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        x: ((i * 5) % 11) - 5,
        y: 2.6 + (i % 3) * 0.25,
        z: 12 - i * 3,
      })),
    [],
  );
  const o = useMemo(() => new Object3D(), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    items.forEach((it, i) => {
      o.position.set(it.x, it.y + Math.sin(t * 0.9 + i * 2) * 0.15, it.z);
      o.rotation.set(0, t * 0.3 + i, Math.PI / 2 + Math.sin(t * 0.7 + i) * 0.2);
      o.updateMatrix();
      ref.current?.setMatrixAt(i, o.matrix);
    });
    if (ref.current) ref.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]}>
      <cylinderGeometry args={[0.06, 0.06, 0.5, 10]} />
      <meshStandardMaterial
        color={colors["--color-scene-wood-light"]}
        roughness={1}
      />
    </instancedMesh>
  );
}

/* ── 등 다발: 높은 천장에서 줄지어 내려오는 놋쇠 고리 등 ───────── */

const LAMP_RING_Y = 6.3;
const LAMP_RING_R = 0.75;
const CANDLES_PER_LAMP = 8;
/** [x, z] — 통로 양옆 두 줄 + 가운데 한 줄 */
const LAMP_PITCH = 5.5;
const lampRow = (front: number) =>
  Array.from(
    { length: Math.floor((front - (ROOM.minZ + 3)) / LAMP_PITCH) + 1 },
    (_, i) => front - i * LAMP_PITCH,
  );
const LAMP_SPOTS: [number, number][] = [
  ...lampRow(12.5).flatMap(
    (z) =>
      [
        [-4.4, z],
        [4.4, z],
      ] as [number, number][],
  ),
  ...lampRow(10).map((z) => [0, z] as [number, number]),
];

function HangingLamps({ colors }: { colors: SceneColors }) {
  const chains = useRef<InstancedMesh>(null);
  const rings = useRef<InstancedMesh>(null);
  const candles = useRef<InstancedMesh>(null);
  const top = HALL.wallH - 0.3;

  const glow = useMemo(() => {
    const arr = new Float32Array(LAMP_SPOTS.length * 3);
    LAMP_SPOTS.forEach(([x, z], i) =>
      arr.set([x, LAMP_RING_Y + 0.2, z], i * 3),
    );
    return arr;
  }, []);

  useLayoutEffect(() => {
    const chainBoxes: Box[] = LAMP_SPOTS.map(([x, z]) => ({
      p: [x, (top + LAMP_RING_Y) / 2, z],
      s: [0.03, top - LAMP_RING_Y, 0.03],
    }));
    fillBoxes(chains.current, chainBoxes);

    const o = new Object3D();
    LAMP_SPOTS.forEach(([x, z], i) => {
      o.position.set(x, LAMP_RING_Y, z);
      o.rotation.set(Math.PI / 2, 0, 0);
      o.scale.set(LAMP_RING_R, LAMP_RING_R, LAMP_RING_R);
      o.updateMatrix();
      rings.current?.setMatrixAt(i, o.matrix);
    });
    if (rings.current) rings.current.instanceMatrix.needsUpdate = true;

    let k = 0;
    for (const [x, z] of LAMP_SPOTS)
      for (let c = 0; c < CANDLES_PER_LAMP; c++) {
        const a = (c / CANDLES_PER_LAMP) * Math.PI * 2;
        o.position.set(
          x + Math.cos(a) * LAMP_RING_R,
          LAMP_RING_Y + 0.12,
          z + Math.sin(a) * LAMP_RING_R,
        );
        o.rotation.set(0, 0, 0);
        o.scale.set(0.1, 0.1, 0.1);
        o.updateMatrix();
        candles.current?.setMatrixAt(k++, o.matrix);
      }
    if (candles.current) candles.current.instanceMatrix.needsUpdate = true;
  }, [top]);

  const brass = colors["--color-scene-brass"];
  const flame = colors["--color-scene-flame"];
  return (
    <group>
      <instancedMesh
        ref={chains}
        args={[undefined, undefined, LAMP_SPOTS.length]}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={colors["--color-scene-wood-dark"]} />
      </instancedMesh>
      <instancedMesh
        ref={rings}
        args={[undefined, undefined, LAMP_SPOTS.length]}
      >
        <torusGeometry args={[1, 0.05, 6, 28]} />
        <meshStandardMaterial
          color={brass}
          emissive={brass}
          emissiveIntensity={0.3}
          metalness={0.6}
          roughness={0.4}
        />
      </instancedMesh>
      <instancedMesh
        ref={candles}
        args={[undefined, undefined, LAMP_SPOTS.length * CANDLES_PER_LAMP]}
      >
        <sphereGeometry args={[0.5, 8, 8]} />
        <meshBasicMaterial color={flame} toneMapped={false} />
      </instancedMesh>
      {/* 불빛 번짐 */}
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[glow, 3]} />
        </bufferGeometry>
        <pointsMaterial
          onBeforeCompile={roundGlowShader}
          customProgramCacheKey={roundGlowKey}
          color={flame}
          size={2.6}
          sizeAttenuation
          transparent
          opacity={0.4}
          depthWrite={false}
          toneMapped={false}
        />
      </points>
    </group>
  );
}

/* ── 달빛 줄기: 옆벽 살창에서 바닥으로 비스듬히 쏟아지는 빛 ─────── */

const SHAFT_DROP_X = 6;
const SHAFT_TOP_Y = 8.3;
const SHAFT_WIDTH = 1.8;

const SHAFT_VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 p = vec4(position, 1.0);
  #ifdef USE_INSTANCING
  p = instanceMatrix * p;
  #endif
  gl_Position = projectionMatrix * modelViewMatrix * p;
}`;
const SHAFT_FRAG = `
uniform vec3 uColor;
uniform float uOpacity;
varying vec2 vUv;
void main() {
  // uv.y = 0이 창 쪽 — 밝게 시작해 바닥 쪽으로 사라지고, 양옆도 부드럽게 흐려진다
  float along = 1.0 - vUv.y;
  float edge = smoothstep(0.0, 0.3, min(vUv.x, 1.0 - vUv.x));
  gl_FragColor = vec4(uColor, uOpacity * along * edge);
  #include <colorspace_fragment>
}`;

function MoonShafts({ colors }: { colors: SceneColors }) {
  const ref = useRef<InstancedMesh>(null);
  const moon = colors["--color-scene-moonlight"];

  // 텍스처 없이 셰이더로 그라데이션 — 창 쪽이 밝고 바닥 쪽·양옆으로 부드럽게 사라진다
  const uniforms = useMemo(
    () => ({
      uColor: { value: new Color(moon) },
      uOpacity: { value: 0.2 },
    }),
    [moon],
  );

  const count = SIDE_SHELF_Z.length * 2;
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const o = new Object3D();
    const dy = SHAFT_TOP_Y - 0.05;
    const len = Math.hypot(SHAFT_DROP_X, dy);
    let i = 0;
    for (const z of SIDE_SHELF_Z)
      for (const side of [-1, 1]) {
        // plane의 +y가 창에서 바닥(안쪽 아래)을 향하도록 z축 회전
        o.position.set(
          side * (WALL_X - 0.1 - SHAFT_DROP_X / 2),
          SHAFT_TOP_Y - dy / 2,
          z,
        );
        o.rotation.set(0, 0, Math.atan2(side * SHAFT_DROP_X, -dy));
        o.scale.set(SHAFT_WIDTH, len, 1);
        o.updateMatrix();
        mesh.setMatrixAt(i++, o.matrix);
      }
    mesh.instanceMatrix.needsUpdate = true;
  }, []);

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, count]}
      frustumCulled={false}
    >
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={SHAFT_VERT}
        fragmentShader={SHAFT_FRAG}
        transparent
        blending={AdditiveBlending}
        side={DoubleSide}
        depthWrite={false}
      />
    </instancedMesh>
  );
}

export function Atmosphere({ colors }: { colors: SceneColors }) {
  return (
    <group>
      {/* 창으로 들어오는 푸른 달빛 — 촛불의 따뜻한 색과 대비 */}
      <directionalLight
        position={[6, 9, -4]}
        intensity={0.85}
        color={colors["--color-scene-moonlight"]}
      />
      <Lanterns colors={colors} />
      <HangingLamps colors={colors} />
      <MoonShafts colors={colors} />
      <Windows colors={colors} />
      <DancheongBand colors={colors} />
      <HouseBanners colors={colors} />
      <Sparkles colors={colors} />
      <Scrolls colors={colors} />
    </group>
  );
}
