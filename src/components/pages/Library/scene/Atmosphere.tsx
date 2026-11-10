/**
 * 사신학당 먹빛각 분위기 요소 — 청사초롱, 창호 달빛, 단청 띠, 기숙사 깃발, 반딧불 파티클.
 * 모바일 성능을 위해 반복 요소는 InstancedMesh/Points 한 덩어리로 그린다.
 */
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { windowLandscapeCrop } from "./windowLandscape";
import { windowWindKey, windowWindShader } from "./windowWind";
import type { WindowWindUniforms } from "./windowWind";
import {
  AdditiveBlending,
  BufferAttribute,
  CanvasTexture,
  Color,
  DoubleSide,
  Object3D,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
} from "three";
import type { InstancedMesh, Points, Texture } from "three";
import { houseCrestUrl } from "../HouseCrest";
import { HOUSE_IDS, houseToken } from "../houses";
import type { HouseId } from "../houses";
import {
  FRONT_WALL_Z,
  HALL,
  HALL_WINDOW,
  ROOM,
  SIDE_SHELF_Z,
} from "./sceneLayout";
import { useSurfaceTexture } from "./surfaceTexture";
import { roundGlowKey, roundGlowShader } from "./MagicEffect";
import type { SceneColors } from "./sceneLayout";
import { drawSilk } from "./RankingBoard";

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

function WindowView({
  spec,
  landscape,
  wind,
}: {
  spec: WindowSpec;
  landscape: Texture;
  wind: WindowWindUniforms;
}) {
  const geometry = useMemo(() => {
    const plane = new PlaneGeometry(spec.w, spec.h);
    const image = landscape.image as { width: number; height: number };
    // 각 창은 풍경의 서로 다른 부분을 본다. 큰 뒷창은 골짜기 중앙을 향한다.
    const pan =
      spec.x === 0
        ? 0.5
        : 0.2 + ((Math.abs(spec.z) * 0.073 + (spec.x > 0 ? 0.35 : 0)) % 0.6);
    const crop = windowLandscapeCrop(
      spec.w,
      spec.h,
      image.width,
      image.height,
      pan,
    );
    const uv = plane.getAttribute("uv");
    for (let i = 0; i < uv.count; i++)
      uv.setXY(
        i,
        uv.getX(i) * crop.scaleX + crop.offsetX,
        uv.getY(i) * crop.scaleY + crop.offsetY,
      );
    uv.needsUpdate = true;
    return plane;
  }, [spec, landscape]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh
      geometry={geometry}
      position={[spec.x, spec.y, spec.z]}
      rotation={[0, spec.ry, 0]}
    >
      <meshBasicMaterial
        map={landscape}
        toneMapped={false}
        fog={false}
        onBeforeCompile={(shader) => windowWindShader(shader, wind)}
        customProgramCacheKey={windowWindKey}
      />
    </mesh>
  );
}

function Windows({ colors }: { colors: SceneColors }) {
  const wind = useMemo<WindowWindUniforms>(
    () => ({
      uForestTime: { value: 0 },
      uForestMotion: { value: 1 },
      uForestMoon: { value: new Color(colors["--color-scene-moonlight"]) },
      uForestWarm: { value: new Color(colors["--color-scene-flame"]) },
    }),
    [colors],
  );
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!media) return;
    const update = () => {
      wind.uForestMotion.value = media.matches ? 0 : 1;
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [wind]);
  useFrame(({ clock }) => {
    wind.uForestTime.value = clock.elapsedTime;
  });
  const landscape = useTexture(
    `${import.meta.env.BASE_URL}textures/hidden-valley-night.jpg`,
    (texture) => {
      texture.colorSpace = SRGBColorSpace;
      texture.anisotropy = 4;
    },
  );
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
        y: HALL_WINDOW.y,
        z: FRONT_WALL_Z - 0.02,
        ry: Math.PI,
        w: 2.2,
        h: HALL_WINDOW.h,
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
        <WindowView
          key={`${w.x}:${w.z}`}
          spec={w}
          landscape={landscape}
          wind={wind}
        />
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
  const crest = useTexture(houseCrestUrl(house));
  const fabric = useTexture(`${import.meta.env.BASE_URL}textures/scroll-silk.jpg`);
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 768;
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
      const W = 256;
      const H = 768;
      drawSilk(ctx, colors, house, fabric);
      // 비단 깃발의 아래쪽을 삼각형으로 마무리한다.
      ctx.globalCompositeOperation = "destination-in";
      ctx.fillStyle = colors["--color-scene-collar"];
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(W, 0);
      ctx.lineTo(W, H - 100);
      ctx.lineTo(W / 2, H);
      ctx.lineTo(0, H - 100);
      ctx.closePath();
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = colors["--color-scene-brass"];
      ctx.lineWidth = 8;
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(6, 6);
      ctx.lineTo(W - 6, 6);
      ctx.lineTo(W - 6, H - 103);
      ctx.lineTo(W / 2, H - 8);
      ctx.lineTo(6, H - 103);
      ctx.closePath();
      ctx.stroke();
      ctx.drawImage(
        crest.image as CanvasImageSource,
        W / 2 - 110,
        55,
        220,
        220,
      );
      texture.needsUpdate = true;
    };
    draw();
    return () => {
      cancelled = true;
    };
  }, [house, colors, texture, crest, fabric]);

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
  const bump = useTexture(`${import.meta.env.BASE_URL}textures/scroll-silk-bump.jpg`, (texture) => {
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.repeat.set(5, 14);
    texture.anisotropy = 4;
  });
  return (
    <mesh position={[x, HALL.wallH - 2.45, BACK_Z + 0.14]}>
      <planeGeometry args={[1.55, 4]} />
      <meshPhysicalMaterial
        map={map}
        bumpMap={bump}
        bumpScale={1.4}
        roughness={0.52}
        sheen={1}
        sheenRoughness={0.4}
        sheenColor={colors[houseToken(house, "accent")]}
        transparent
        emissiveMap={map}
        emissive="white"
        emissiveIntensity={0.34}
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

/* ── 천장 아래 떠 있는 촛불 ───────────────────────────── */

const CANDLE_LIGHT_Y = 8.8;
const CANDLES_PER_CLUSTER = 22;
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
  const bodies = useRef<InstancedMesh>(null);
  const flames = useRef<InstancedMesh>(null);
  const wicks = useRef<InstancedMesh>(null);
  const glowRef = useRef<Points>(null);
  const object = useMemo(() => new Object3D(), []);
  const candles = useMemo(() => {
    const rand = seeded(287);
    return LAMP_SPOTS.flatMap(([x, z]) =>
      Array.from({ length: CANDLES_PER_CLUSTER }, () => ({
        x: Math.max(ROOM.minX + 0.4, Math.min(ROOM.maxX - 0.4, x + (rand() - 0.5) * 3.8)),
        y: HALL.wallH - 1.8 - rand() * 2.8,
        z: Math.max(ROOM.minZ + 0.4, Math.min(FRONT_WALL_Z - 0.4, z + (rand() - 0.5) * 5)),
        length: 0.28 + rand() * 0.28,
        phase: rand() * Math.PI * 2,
      })),
    );
  }, []);
  const glow = useMemo(() => new Float32Array(candles.length * 3), [candles]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    candles.forEach((c, i) => {
      const y = c.y + Math.sin(t * 0.65 + c.phase) * 0.045;
      object.position.set(c.x, y, c.z);
      object.rotation.set(0, 0, Math.sin(t * 0.5 + c.phase) * 0.025);
      object.scale.set(1, c.length, 1);
      object.updateMatrix();
      bodies.current?.setMatrixAt(i, object.matrix);
      object.position.set(c.x, y + c.length / 2 + 0.018, c.z);
      object.rotation.set(0, 0, 0);
      object.scale.set(1, 1, 1);
      object.updateMatrix();
      wicks.current?.setMatrixAt(i, object.matrix);
      object.position.set(c.x, y + c.length / 2 + 0.055, c.z);
      object.rotation.set(0, 0, 0);
      const flicker = 0.9 + Math.sin(t * 7 + c.phase) * 0.1;
      object.scale.set(0.075, 0.14 * flicker, 0.075);
      object.updateMatrix();
      flames.current?.setMatrixAt(i, object.matrix);
      glow.set([c.x, y + c.length / 2 + 0.055, c.z], i * 3);
    });
    if (bodies.current) bodies.current.instanceMatrix.needsUpdate = true;
    if (wicks.current) wicks.current.instanceMatrix.needsUpdate = true;
    if (flames.current) flames.current.instanceMatrix.needsUpdate = true;
    const positions = glowRef.current?.geometry.getAttribute("position");
    if (positions) positions.needsUpdate = true;
  });

  const flame = useMemo(
    () => new Color(colors["--color-scene-flame"]).lerp(new Color(colors["--color-scene-spell-ember"]), 0.22),
    [colors],
  );
  return (
    <group>
      <instancedMesh ref={bodies} args={[undefined, undefined, candles.length]} frustumCulled={false}>
        <cylinderGeometry args={[0.06, 0.065, 1, 12]} />
        <meshStandardMaterial color={colors["--color-scene-collar"]} emissive={flame} emissiveIntensity={0.22} roughness={0.82} />
      </instancedMesh>
      <instancedMesh ref={wicks} args={[undefined, undefined, candles.length]} frustumCulled={false}>
        <cylinderGeometry args={[0.011, 0.011, 0.045, 8]} />
        <meshBasicMaterial color={colors["--color-scene-wood-dark"]} />
      </instancedMesh>
      <instancedMesh ref={flames} args={[undefined, undefined, candles.length]} frustumCulled={false}>
        <sphereGeometry args={[0.5, 8, 8]} />
        <meshBasicMaterial color={new Color(flame).multiplyScalar(1.35)} toneMapped={false} />
      </instancedMesh>
      {LAMP_SPOTS.filter((_, i) => i % 3 === 1).map(([x, z], i) => (
        <pointLight key={`ceiling-light-${i}`} position={[x, CANDLE_LIGHT_Y, z]} color={flame} intensity={20} distance={11} decay={1.6} />
      ))}
      <points ref={glowRef} frustumCulled={false}>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[glow, 3]} /></bufferGeometry>
        <pointsMaterial onBeforeCompile={roundGlowShader} customProgramCacheKey={roundGlowKey} color={flame} size={0.9} sizeAttenuation transparent opacity={0.7} depthWrite={false} toneMapped={false} />
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

export function Atmosphere({ colors, daylight = 1 }: { colors: SceneColors; daylight?: number }) {
  return (
    <group>
      {/* 창으로 들어오는 푸른 달빛 — 촛불의 따뜻한 색과 대비 */}
      <directionalLight
        position={[6, 9, -4]}
        intensity={0.22 + daylight * 0.2}
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
