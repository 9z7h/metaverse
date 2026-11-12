import { Fragment, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BackSide,
  Color,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
} from "three";
import type { Group } from "three";
import type { SceneColors } from "../sceneLayout";
import { HAETAE_PATROL } from "./gardenLayout";

/** 조각이 같은 구를 늘려 쓰도록 한 번만 만든다. 큰 조각은 매끈하게, 눈·점 같은 작은 조각은 가볍게 */
const SPHERE_HI = new SphereGeometry(1, 32, 24);
const SPHERE_LO = new SphereGeometry(1, 16, 12);
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

/** 큰 덩어리의 검은 외곽선 — 같은 모양을 조금 키워 뒷면만 칠한다 */
const OUTLINE = 1.07;

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
    // 푸른 몸(현무관 남색을 밝혀서)과 붉은 불꽃 — 밤 뜰에서도 형태가 읽힌다
    const blue = new Color(colors["--color-house-hyeonmu-primary"]).lerp(
      new Color(colors["--color-scene-collar"]),
      0.2,
    );
    const red = new Color(colors["--color-scene-spell-ember"]).lerp(
      new Color(colors["--color-scene-collar"]),
      0.1,
    );
    const ink = new Color(colors["--color-scene-wood-dark"]).multiplyScalar(
      0.4,
    );
    return {
      blue: new MeshStandardMaterial({ color: blue, roughness: 0.9 }),
      red: new MeshStandardMaterial({ color: red, roughness: 0.8 }),
      dark: new MeshBasicMaterial({ color: ink }),
      line: new MeshBasicMaterial({ color: ink, side: BackSide }),
      cream: new MeshStandardMaterial({
        color: colors["--color-scene-collar"],
        roughness: 0.9,
      }),
      brass: new MeshStandardMaterial({
        color: colors["--color-scene-brass"],
        metalness: 0.5,
        roughness: 0.4,
      }),
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

  /** 구 하나. outlined면 검은 외곽선을 함께 그린다 */
  const part = (
    key: string,
    material: keyof typeof m,
    at: Vec3,
    scale: Vec3,
    rotation?: Vec3,
    outlined = false,
  ) => (
    <Fragment key={key}>
      <mesh
        geometry={sphereFor(scale)}
        material={m[material]}
        position={at}
        scale={scale}
        rotation={rotation}
      />
      {outlined ? (
        <mesh
          geometry={sphereFor(scale)}
          material={m.line}
          position={at}
          scale={[scale[0] * OUTLINE, scale[1] * OUTLINE, scale[2] * OUTLINE]}
          rotation={rotation}
        />
      ) : null}
    </Fragment>
  );

  return (
    <group
      ref={root}
      position={[walk.current.x, HAETAE_PATROL.y, HAETAE_PATROL.z]}
      scale={SIZE}
    >
      <group ref={body}>
        {/* 몸과 머리: 한 덩어리처럼 이어진 둥근 2등신 */}
        {part(
          "body",
          "blue",
          [0, 0.34, -0.06],
          [0.36, 0.3, 0.4],
          undefined,
          true,
        )}
        {part(
          "head",
          "blue",
          [0, 0.62, 0.2],
          [0.36, 0.3, 0.31],
          undefined,
          true,
        )}
        {[-1, 1].map((side) => (
          <group key={`face${side}`}>
            {part(
              `ear${side}`,
              "blue",
              [side * 0.22, 0.87, 0.12],
              [0.08, 0.08, 0.05],
              undefined,
              true,
            )}
            {/* 눈: 작은 점에 붉은 테, 위에 눈썹 선 두 줄 */}
            {part(
              `rim${side}`,
              "red",
              [side * 0.14, 0.688, 0.472],
              [0.05, 0.056, 0.015],
            )}
            {part(
              `eye${side}`,
              "dark",
              [side * 0.14, 0.69, 0.482],
              [0.036, 0.044, 0.02],
            )}
            {part(
              `brow${side}a`,
              "dark",
              [side * 0.13, 0.745, 0.465],
              [0.05, 0.009, 0.012],
              [0, 0, side * 0.3],
            )}
            {part(
              `brow${side}b`,
              "dark",
              [side * 0.135, 0.777, 0.447],
              [0.04, 0.009, 0.012],
              [0, 0, side * 0.3],
            )}
            {/* 입가 */}
            {part(
              `mouth${side}`,
              "dark",
              [side * 0.026, 0.55, 0.497],
              [0.022, 0.008, 0.01],
              [0, 0, side * -0.4],
            )}
          </group>
        ))}
        {/* 곰 같은 코와 짧은 입선 */}
        {part("nose", "dark", [0, 0.62, 0.505], [0.045, 0.032, 0.025])}
        {part("philtrum", "dark", [0, 0.575, 0.5], [0.007, 0.03, 0.007])}
        {part("bell", "brass", [0, 0.42, 0.42], [0.045, 0.045, 0.045])}
        {/* 옆구리의 줄무늬 세 줄 */}
        {[-1, 1].flatMap((side) =>
          [-0.1, 0, 0.1].map((z) =>
            part(
              `stripe${side}${z}`,
              "dark",
              [side * 0.356, 0.3, z],
              [0.012, 0.07, 0.014],
            ),
          ),
        )}
        {/* 머리 뒤에 솟은 붉은 불꽃 뿔 한 쌍 */}
        <group ref={mane}>
          {[-1, 1].map((side) => (
            <group key={`horn${side}`} position={[side * 0.13, 0.88, 0.1]}>
              {part(
                "h1",
                "red",
                [0, 0.05, 0],
                [0.05, 0.11, 0.045],
                [0, 0, side * -0.3],
              )}
              {part(
                "h2",
                "red",
                [side * 0.04, 0.15, 0],
                [0.045, 0.1, 0.04],
                [0, 0, side * -0.7],
              )}
              {part(
                "h3",
                "red",
                [side * 0.1, 0.2, 0],
                [0.035, 0.07, 0.03],
                [0, 0, side * -1.1],
              )}
            </group>
          ))}
        </group>

        {/* 다리: 짧고 통통하게 — 뒤쪽에 붉은 불꽃 술. 앞뒤 대각선이 함께 움직인다 */}
        {[-1, 1].flatMap((side) =>
          [-1, 1].map((front) => (
            <group
              key={`${side}-${front}`}
              position={[side * 0.17, 0.2, front === 1 ? 0.16 : -0.22]}
              ref={(el) => {
                legs.current[(side === -1 ? 0 : 2) + (front === -1 ? 0 : 1)] =
                  el;
              }}
            >
              {part(
                "leg",
                "blue",
                [0, -0.07, 0],
                [0.1, 0.14, 0.1],
                undefined,
                true,
              )}
              {part(
                "fin",
                "red",
                [side * 0.05, 0, -0.09],
                [0.03, 0.09, 0.025],
                [0.7, 0, side * 0.3],
              )}
            </group>
          )),
        )}

        {/* 꼬리: 위로 솟고 끝은 붉은 물방울, 그 위에 점 하나 */}
        <group ref={tail} position={[0, 0.38, -0.38]}>
          {part(
            "tail1",
            "blue",
            [0, 0.07, -0.06],
            [0.08, 0.08, 0.08],
            undefined,
            true,
          )}
          {part(
            "tail2",
            "blue",
            [0, 0.2, -0.1],
            [0.07, 0.12, 0.07],
            [0.2, 0, 0],
            true,
          )}
          {part("drop", "red", [0, 0.36, -0.08], [0.075, 0.11, 0.075])}
          {part("dot", "red", [0.05, 0.52, -0.06], [0.025, 0.025, 0.025])}
        </group>
      </group>
    </group>
  );
}
