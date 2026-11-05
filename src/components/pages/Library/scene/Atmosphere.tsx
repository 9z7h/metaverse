/**
 * 사신학당 먹빛각 분위기 요소 — 청사초롱, 창호 달빛, 단청 띠, 기숙사 깃발, 반딧불 파티클.
 * 모바일 성능을 위해 반복 요소는 InstancedMesh/Points 한 덩어리로 그린다.
 */
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BufferAttribute,
  CanvasTexture,
  Color,
  Object3D,
  SRGBColorSpace,
} from "three";
import type { InstancedMesh, Points } from "three";
import { CREST_SHAPES } from "../HouseCrest";
import { HOUSES, HOUSE_IDS, houseToken } from "../houses";
import type { HouseId } from "../houses";
import { FRONT_WALL_Z, ROOM } from "./sceneLayout";
import { getGlowTexture } from "./MagicEffect";
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

const LANTERN_COUNT = 28;

function Lanterns({ colors }: { colors: SceneColors }) {
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
        {/* 조명과 무관하게 비단 본연의 색으로 은은히 빛남 (빨강·파랑이 노란 빛과 섞여 탁해지지 않도록) */}
        <meshBasicMaterial toneMapped={false} />
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

/* ── 창호: 문살 격자 사이로 달빛 ─────────────────────────────── */

interface WindowSpec {
  x: number;
  z: number;
  ry: number;
}

const WIN_W = 1.6;
const WIN_H = 1.4;
const WIN_Y = 4.5;
const BARS_PER_WINDOW = 4 + 3 + 2; // 테두리 4 + 세로 3 + 가로 2

function Windows({ colors }: { colors: SceneColors }) {
  const bars = useRef<InstancedMesh>(null);
  const windows = useMemo<WindowSpec[]>(
    () => [
      ...[-4, 0, 4].map((x) => ({ x, z: BACK_Z + 0.02, ry: 0 })),
      ...[-4.5, -1, 2.5].flatMap((z) => [
        { x: -WALL_X + 0.02, z, ry: Math.PI / 2 },
        { x: WALL_X - 0.02, z, ry: -Math.PI / 2 },
      ]),
    ],
    [],
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
      parent.position.set(w.x, WIN_Y, w.z);
      parent.rotation.set(0, w.ry, 0);
      parent.updateMatrix();
      // 테두리
      put(0, WIN_H / 2, WIN_W + 0.12, 0.1);
      put(0, -WIN_H / 2, WIN_W + 0.12, 0.1);
      put(-WIN_W / 2, 0, 0.1, WIN_H);
      put(WIN_W / 2, 0, 0.1, WIN_H);
      // 세로 문살 3
      [-0.4, 0, 0.4].forEach((x) => put(x, 0, 0.035, WIN_H));
      // 가로 문살 2
      [-0.23, 0.23].forEach((y) => put(0, y, WIN_W, 0.035));
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [windows]);

  return (
    <group>
      {windows.map((w) => (
        <mesh
          key={`${w.x}${w.z}`}
          position={[w.x, WIN_Y, w.z]}
          rotation={[0, w.ry, 0]}
        >
          <planeGeometry args={[WIN_W, WIN_H]} />
          {/* 창호지 너머 달빛 — 약하게 발광 */}
          <meshBasicMaterial
            color={colors["--color-scene-moonlight"]}
            toneMapped={false}
          />
        </mesh>
      ))}
      <instancedMesh
        ref={bars}
        args={[undefined, undefined, windows.length * BARS_PER_WINDOW]}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={colors["--color-scene-wood-dark"]} />
      </instancedMesh>
    </group>
  );
}

/* ── 단청 띠: 책장 위로 벽을 두르는 오방색 띠 ─────────────────── */

function DancheongBand({ colors }: { colors: SceneColors }) {
  const y = 3.45;
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
    <mesh position={[x, 4.6, BACK_Z + 0.14]}>
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
  const xs = [-5.6, -2, 2, 5.6];
  return (
    <group>
      {HOUSE_IDS.map((h, i) => (
        <Banner key={h} house={h} colors={colors} x={xs[i]} />
      ))}
    </group>
  );
}

/* ── 반딧불 파티클 ───────────────────────────────────────── */

const SPARK_COUNT = 140;

function Sparkles({ colors }: { colors: SceneColors }) {
  const ref = useRef<Points>(null);
  const seeds = useMemo(() => {
    const rand = seeded(99);
    return Array.from({ length: SPARK_COUNT }, () => ({
      x: ROOM.minX + rand() * (ROOM.maxX - ROOM.minX),
      z: ROOM.minZ + rand() * (ROOM.maxZ - ROOM.minZ),
      y: rand() * 5,
      speed: 0.08 + rand() * 0.12,
      phase: rand() * Math.PI * 2,
    }));
  }, []);
  const positions = useMemo(() => new Float32Array(SPARK_COUNT * 3), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    seeds.forEach((s, i) => {
      positions[i * 3] = s.x + Math.sin(t * 0.5 + s.phase) * 0.3;
      positions[i * 3 + 1] = (s.y + t * s.speed) % 5.2;
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
        map={getGlowTexture()}
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
    () => [
      { x: 0.9, y: 2.7, z: -3.4 },
      { x: -2.4, y: 3.0, z: 0.9 },
      { x: 3.6, y: 2.6, z: 4.6 },
    ],
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

export function Atmosphere({ colors }: { colors: SceneColors }) {
  return (
    <group>
      {/* 창으로 들어오는 푸른 달빛 — 촛불의 따뜻한 색과 대비 */}
      <directionalLight
        position={[6, 9, -4]}
        intensity={0.45}
        color={colors["--color-scene-moonlight"]}
      />
      <Lanterns colors={colors} />
      <Windows colors={colors} />
      <DancheongBand colors={colors} />
      <HouseBanners colors={colors} />
      <Sparkles colors={colors} />
      <Scrolls colors={colors} />
    </group>
  );
}
