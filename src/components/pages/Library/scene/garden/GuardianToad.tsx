import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  Color,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
} from "three";
import type { Group } from "three";
import type { SceneColors } from "../sceneLayout";
import { POND } from "./gardenLayout";

/** 몸 전체를 줄이는 배율 */
const SIZE = 0.45;

/** 조각이 같은 구를 늘려 쓰도록 한 번만 만든다. 큰 조각은 매끈하게, 눈·점 같은 작은 조각은 가볍게 */
const SPHERE_HI = new SphereGeometry(1, 32, 24);
const SPHERE_LO = new SphereGeometry(1, 16, 12);
/** 가장 긴 반지름이 이 값 이상이면 고해상도 구를 쓴다 */
const HI_RES_FROM = 0.1;
const sphereFor = (scale: readonly [number, number, number]) =>
  Math.max(...scale) >= HI_RES_FROM ? SPHERE_HI : SPHERE_LO;

type Vec3 = [number, number, number];

/** 등의 돌기 — 몸 위쪽에 흩어진 작은 사마귀 (x, z, 크기) */
const WARTS: ReadonlyArray<[number, number, number]> = [
  [-0.15, -0.14, 1],
  [0.04, -0.2, 0.8],
  [0.17, -0.08, 1.1],
  [-0.05, 0, 0.9],
  [-0.2, 0.04, 0.7],
  [0.1, 0.06, 0.8],
];

/** 집을 지키는 업을 닮은 두꺼비 한 마리. 앞(눈)이 +z. */
export function GuardianToad({ colors }: { colors: SceneColors }) {
  const body = useRef<Group>(null);
  const m = useMemo(() => {
    // 밤 뜰에서 검게 죽지 않도록 잎색에 금빛을 조금 섞은 올리브 녹색
    const green = new Color(colors["--color-scene-leaf"]).lerp(
      new Color(colors["--color-scene-flame"]),
      0.25,
    );
    return {
      green: new MeshStandardMaterial({ color: green, roughness: 0.95 }),
      wart: new MeshStandardMaterial({
        color: green
          .clone()
          .lerp(new Color(colors["--color-scene-stone"]), 0.35),
        roughness: 1,
      }),
      belly: new MeshStandardMaterial({
        color: colors["--color-scene-stone"],
        roughness: 0.95,
      }),
      dark: new MeshStandardMaterial({
        color: colors["--color-scene-wood-dark"],
        roughness: 0.6,
      }),
      iris: new MeshStandardMaterial({
        color: colors["--color-scene-brass"],
        emissive: colors["--color-scene-brass"],
        emissiveIntensity: 0.25,
        roughness: 0.4,
      }),
      shine: new MeshBasicMaterial({ color: colors["--color-scene-collar"] }),
    };
  }, [colors]);
  useFrame(({ clock }) => {
    if (body.current)
      body.current.scale.y = 1 + Math.sin(clock.elapsedTime * 1.4) * 0.025;
  });
  const part = (
    key: string,
    material: keyof typeof m,
    at: Vec3,
    scale: Vec3,
  ) => (
    <mesh
      key={key}
      geometry={sphereFor(scale)}
      material={m[material]}
      position={at}
      scale={scale}
    />
  );
  return (
    <group
      position={[POND.x - POND.r - 0.9, 0, POND.z - 1]}
      rotation={[0, -0.8, 0]}
    >
      <group scale={SIZE}>
        <group ref={body}>
          {/* 몸: 통통한 몸통 위에 둥근 등이 솟고, 배는 밝다 */}
          {part("body", "green", [0, 0.22, 0], [0.34, 0.22, 0.4])}
          {part("back", "green", [0, 0.33, -0.06], [0.3, 0.14, 0.3])}
          {part("belly", "belly", [0, 0.1, 0.04], [0.3, 0.1, 0.34])}
          {part("head", "green", [0, 0.24, 0.26], [0.26, 0.14, 0.2])}
          {/* 넓은 입선과 콧구멍 */}
          {part("mouth", "dark", [0, 0.205, 0.41], [0.2, 0.012, 0.05])}
          {[-1, 1].map((side) => (
            <group key={side}>
              {part(
                `nostril${side}`,
                "dark",
                [side * 0.04, 0.285, 0.45],
                [0.012, 0.012, 0.012],
              )}
              {/* 눈: 위로 불룩 솟은 눈두덩에 금빛 홍채, 가로 동공 */}
              {part(
                `lid${side}`,
                "green",
                [side * 0.15, 0.37, 0.24],
                [0.075, 0.075, 0.075],
              )}
              {part(
                `iris${side}`,
                "iris",
                [side * 0.16, 0.385, 0.29],
                [0.05, 0.05, 0.03],
              )}
              {part(
                `pupil${side}`,
                "dark",
                [side * 0.165, 0.387, 0.318],
                [0.04, 0.016, 0.01],
              )}
              {part(
                `shine${side}`,
                "shine",
                [side * 0.15, 0.412, 0.322],
                [0.01, 0.01, 0.01],
              )}
              {/* 눈 뒤의 볼록한 귀샘 */}
              {part(
                `gland${side}`,
                "wart",
                [side * 0.2, 0.35, -0.04],
                [0.1, 0.06, 0.13],
              )}
              {/* 앞다리 */}
              {part(
                `front${side}`,
                "green",
                [side * 0.2, 0.09, 0.32],
                [0.065, 0.075, 0.11],
              )}
              {/* 접힌 뒷다리와 넓은 발 */}
              {part(
                `thigh${side}`,
                "green",
                [side * 0.26, 0.14, -0.16],
                [0.16, 0.11, 0.2],
              )}
              {part(
                `foot${side}`,
                "green",
                [side * 0.28, 0.03, 0.0],
                [0.12, 0.03, 0.17],
              )}
            </group>
          ))}
          {WARTS.map(([x, z, size], i) =>
            part(
              `wart${i}`,
              "wart",
              [x, 0.39 - Math.abs(x) * 0.15, z],
              [0.05 * size, 0.025 * size, 0.05 * size],
            ),
          )}
        </group>
      </group>
    </group>
  );
}
