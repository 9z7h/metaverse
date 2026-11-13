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
import { HAETAE_PATROL } from "./gardenLayout";

/** 조각이 같은 구를 늘려 쓰도록 한 번만 만든다. 큰 조각은 매끈하게, 눈·점 같은 작은 조각은 가볍게 */
const SPHERE_HI = new SphereGeometry(1, 48, 32);
const SPHERE_LO = new SphereGeometry(1, 24, 16);
/** 가장 긴 반지름이 이 값 이상이면 고해상도 구를 쓴다 */
const HI_RES_FROM = 0.1;
const sphereFor = (scale: readonly [number, number, number]) =>
  Math.max(...scale) >= HI_RES_FROM ? SPHERE_HI : SPHERE_LO;

type Vec3 = [number, number, number];

/** 몸 전체 배율 */
const SIZE = 0.65;

/** 걷는 속도(m/s)와 구간 끝에서 쉬는 시간(초) */
const WALK_SPEED = 0.5;
const REST_SECONDS = 6;
/** 다리를 흔드는 폭(rad)과 걸음 속도 */
const STRIDE = 0.35;
const STEP_RATE = 5;

function shortestAngle(from: number, to: number) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

/**
 * 서고 대문 앞 기단을 천천히 오가며 문을 지키는 해태 한 마리.
 * 걸을 때는 가는 방향을 보고, 순찰길 끝에서는 뜰(+z)을 바라보며 숨을 쉬다가 돌아서 걷는다.
 * 모델은 원점이 발밑이고 정면(코끝)이 +z다.
 */
export function Haetae({ colors }: { colors: SceneColors }) {
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const tail = useRef<Group>(null);
  const mane = useRef<Group>(null);
  const legs = useRef<Array<Group | null>>([]);
  const walk = useRef({
    x: 3,
    dir: -1,
    walking: false,
    rest: 2,
    heading: 0,
    stride: 0,
    elapsed: 0,
  });

  const m = useMemo(() => {
    // 여우·두꺼비처럼 부드럽고 차분한 색 — 돌에 달빛과 현무관 남색을 섞은 청회색 몸, 금빛 갈기·뿔
    const steel = new Color(colors["--color-scene-stone"])
      .lerp(new Color(colors["--color-scene-moonlight"]), 0.3)
      .lerp(new Color(colors["--color-house-hyeonmu-primary"]), 0.22);
    const gold = new Color(colors["--color-scene-brass"]).lerp(
      new Color(colors["--color-scene-collar"]),
      0.15,
    );
    return {
      steel: new MeshStandardMaterial({ color: steel, roughness: 0.9 }),
      gold: new MeshStandardMaterial({
        color: gold,
        emissive: gold,
        emissiveIntensity: 0.08,
        roughness: 0.6,
      }),
      cream: new MeshStandardMaterial({
        color: colors["--color-scene-collar"],
        roughness: 0.95,
      }),
      dark: new MeshStandardMaterial({
        color: colors["--color-scene-wood-dark"],
        roughness: 0.4,
      }),
      shine: new MeshBasicMaterial({ color: colors["--color-scene-collar"] }),
    };
  }, [colors]);

  useFrame((_, rawDelta) => {
    const g = root.current;
    if (!g) return;
    const dt = Math.min(rawDelta, 0.1);
    const s = walk.current;
    s.elapsed += dt;
    if (s.walking) {
      s.x += s.dir * WALK_SPEED * dt;
      if (s.dir * s.x >= HAETAE_PATROL.halfRange) {
        s.x = s.dir * HAETAE_PATROL.halfRange;
        s.walking = false;
        s.rest = REST_SECONDS;
      }
    } else {
      s.rest -= dt;
      if (s.rest <= 0) {
        s.dir = -s.dir;
        s.walking = true;
      }
    }
    // 걸을 때는 가는 쪽, 쉴 때는 뜰 쪽을 본다
    const target = s.walking ? s.dir * (Math.PI / 2) : 0;
    s.heading += shortestAngle(s.heading, target) * Math.min(1, dt * 3);
    s.stride += ((s.walking ? 1 : 0) - s.stride) * Math.min(1, dt * 4);
    g.position.set(
      s.x,
      HAETAE_PATROL.y +
        Math.abs(Math.sin(s.elapsed * STEP_RATE)) * 0.012 * s.stride,
      HAETAE_PATROL.z,
    );
    g.rotation.y = s.heading;
    legs.current.forEach((leg, i) => {
      if (leg)
        leg.rotation.x =
          Math.sin(s.elapsed * STEP_RATE + (i === 0 || i === 3 ? 0 : Math.PI)) *
          STRIDE *
          s.stride;
    });
    if (body.current)
      body.current.scale.y = 1 + Math.sin(s.elapsed * 1.6) * 0.02;
    if (tail.current)
      tail.current.rotation.z = Math.sin(s.elapsed * 1.8) * 0.25;
    if (mane.current)
      mane.current.rotation.z = Math.sin(s.elapsed * 2.2) * 0.04;
  });

  /** 구 하나 */
  const part = (
    key: string,
    material: keyof typeof m,
    at: Vec3,
    scale: Vec3,
    rotation?: Vec3,
  ) => (
    <mesh
      key={key}
      geometry={sphereFor(scale)}
      material={m[material]}
      position={at}
      scale={scale}
      rotation={rotation}
    />
  );

  return (
    <group
      ref={root}
      position={[walk.current.x, HAETAE_PATROL.y, HAETAE_PATROL.z]}
      scale={SIZE}
    >
      <group ref={body}>
        {/* 몸통: 가슴이 두툼하고 엉덩이로 갈수록 가늘다. 배는 밝은 털 */}
        {part("body", "steel", [0, 0.44, -0.04], [0.25, 0.24, 0.45])}
        {part("belly", "cream", [0, 0.33, 0.1], [0.15, 0.1, 0.32])}

        {/* 머리: 둥근 두개골과 넓고 뭉툭한 주둥이, 밝은 볼 */}
        {part("skull", "steel", [0, 0.67, 0.44], [0.23, 0.22, 0.23])}
        {part("muzzle", "steel", [0, 0.61, 0.64], [0.12, 0.1, 0.14])}
        {part("chin", "cream", [0, 0.57, 0.62], [0.09, 0.05, 0.12])}
        {part("nose", "dark", [0, 0.64, 0.77], [0.04, 0.03, 0.03])}
        {/* 이마의 짧고 둥근 외뿔 */}
        {part(
          "horn",
          "gold",
          [0, 0.9, 0.48],
          [0.047, 0.11, 0.045],
          [-0.3, 0, 0],
        )}
        {[-1, 1].map((side) => (
          <group key={`face${side}`}>
            {part(
              `cheek${side}`,
              "cream",
              [side * 0.13, 0.6, 0.52],
              [0.09, 0.09, 0.12],
            )}
            {/* 눈: 살짝 치켜올라간 검은 눈에 흰 하이라이트 점 하나 */}
            {part(
              `eye${side}`,
              "dark",
              [side * 0.1, 0.7, 0.62],
              [0.052, 0.052, 0.03],
              [0, 0, side * -0.3],
            )}
            {part(
              `light${side}`,
              "shine",
              [side * 0.113, 0.717, 0.642],
              [0.013, 0.013, 0.013],
            )}
            {/* 눈 위의 금빛 눈썹 털 */}
            {part(
              `brow${side}`,
              "gold",
              [side * 0.1, 0.77, 0.6],
              [0.045, 0.018, 0.03],
              [0, 0, side * 0.35],
            )}
            {/* 귀: 둥글게 접힌 작은 귀 */}
            {part(
              `ear${side}`,
              "steel",
              [side * 0.16, 0.82, 0.4],
              [0.07, 0.09, 0.05],
              [-0.2, 0, side * -0.3],
            )}
            {part(
              `inner${side}`,
              "dark",
              [side * 0.16, 0.815, 0.425],
              [0.04, 0.06, 0.03],
              [-0.2, 0, side * -0.3],
            )}
            {/* 목 옆의 금빛 갈기 뭉치 */}
            {part(
              `ruff${side}`,
              "gold",
              [side * 0.17, 0.62, 0.3],
              [0.1, 0.11, 0.1],
            )}
            {part(
              `ruffb${side}`,
              "gold",
              [side * 0.2, 0.52, 0.22],
              [0.08, 0.09, 0.09],
            )}
          </group>
        ))}

        {/* 목 뒤에서 등줄기를 따라 이어지는 갈기 뭉치 */}
        <group ref={mane}>
          {[0, 1, 2, 3].map((i) =>
            part(
              `mane${i}`,
              "gold",
              [0, 0.78 - i * 0.04, 0.26 - i * 0.16],
              [0.09 - i * 0.012, 0.09 - i * 0.012, 0.1 - i * 0.01],
            ),
          )}
        </group>

        {/* 다리: 짧고 단단하게. 뒷다리에는 금빛 털 뭉치. 앞뒤 대각선이 함께 움직인다 */}
        {[-1, 1].flatMap((side) =>
          [-1, 1].map((front) => (
            <group
              key={`${side}-${front}`}
              position={[side * 0.17, 0.3, front === 1 ? 0.22 : -0.28]}
              ref={(el) => {
                legs.current[(side === -1 ? 0 : 2) + (front === -1 ? 0 : 1)] =
                  el;
              }}
            >
              {part("leg", "steel", [0, -0.12, 0], [0.085, 0.16, 0.09])}
              {part("paw", "cream", [0, -0.27, 0.025], [0.09, 0.045, 0.12])}
              {front === -1
                ? part(
                    "tuft",
                    "gold",
                    [side * 0.05, -0.04, -0.07],
                    [0.04, 0.07, 0.05],
                  )
                : null}
            </group>
          )),
        )}

        {/* 꼬리: 복슬복슬한 금빛 불꽃 꼬리가 위로 말려 올라간다 */}
        <group ref={tail} position={[0, 0.46, -0.4]}>
          {part(
            "tail",
            "gold",
            [0, 0.25, -0.12],
            [0.09, 0.31, 0.09],
            [-0.12, 0, 0],
          )}
        </group>
      </group>
    </group>
  );
}
