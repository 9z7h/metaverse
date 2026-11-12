import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color } from "three";
import type { Group } from "three";
import type { SceneColors } from "../sceneLayout";
import { resolveWalk } from "./gardenLayout";

/** 몸 전체를 줄이는 배율 (아바타보다 작게) */
const SIZE = 0.6;

/** 뜰을 천천히 거니는 작은 도깨비불 여우. 앞(코끝)이 +z. */
export function MysticFox({ colors }: { colors: SceneColors }) {
  const root = useRef<Group>(null);
  const tail = useRef<Group>(null);
  const legs = useRef<Array<Group | null>>([]);
  const elapsed = useRef(0);
  const previous = useRef<{ x: number; z: number } | null>(null);

  useFrame((_, rawDelta) => {
    if (!root.current) return;
    const dt = Math.min(rawDelta, 0.1);
    elapsed.current += dt;
    const t = elapsed.current;
    // 느린 타원형 산책로를 장애물 밖으로 보정한다.
    const at = resolveWalk({
      x: -4 + Math.cos(t * 0.12) * 3,
      z: -14 + Math.sin(t * 0.12) * 3,
    });
    const prev = previous.current;
    if (prev && Math.hypot(at.x - prev.x, at.z - prev.z) > 0.0001) {
      const target = Math.atan2(at.x - prev.x, at.z - prev.z);
      const delta = Math.atan2(
        Math.sin(target - root.current.rotation.y),
        Math.cos(target - root.current.rotation.y),
      );
      root.current.rotation.y += delta * Math.min(1, dt * 4);
    }
    previous.current = at;
    root.current.position.set(at.x, Math.sin(t * 6) * 0.015, at.z);
    if (tail.current) tail.current.rotation.z = Math.sin(t * 2) * 0.13;
    legs.current.forEach((leg, i) => {
      if (leg)
        leg.rotation.x =
          Math.sin(t * 6 + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.28;
    });
  });

  // 털은 불꽃 주문색에 금빛을 섞어 밝은 주황으로 — 밤 뜰에서도 짙은 적갈색으로 죽지 않게
  const fur = useMemo(
    () =>
      new Color(colors["--color-scene-spell-ember"]).lerp(
        new Color(colors["--color-scene-flame"]),
        0.4,
      ),
    [colors],
  );
  const light = colors["--color-scene-collar"];
  const dark = colors["--color-scene-wood-dark"];
  const magic = colors["--color-scene-spell-jade"];
  const earSide = [-1, 1] as const;
  return (
    <group ref={root} position={[-1, 0, -14]}>
      <group scale={SIZE}>
        {/* 몸통: 가슴은 두툼하고 엉덩이로 갈수록 가늘다. 배는 흰 털 */}
        <mesh position={[0, 0.43, 0.2]} scale={[0.2, 0.21, 0.23]}>
          <sphereGeometry args={[1, 32, 24]} />
          <meshStandardMaterial color={fur} roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.42, -0.05]} scale={[0.18, 0.18, 0.3]}>
          <sphereGeometry args={[1, 32, 24]} />
          <meshStandardMaterial color={fur} roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.41, -0.26]} scale={[0.16, 0.16, 0.2]}>
          <sphereGeometry args={[1, 32, 24]} />
          <meshStandardMaterial color={fur} roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.33, 0.12]} scale={[0.13, 0.1, 0.3]}>
          <sphereGeometry args={[1, 24, 16]} />
          <meshStandardMaterial color={light} roughness={0.95} />
        </mesh>
        <mesh position={[0, 0.5, 0.36]} scale={[0.14, 0.16, 0.14]}>
          <sphereGeometry args={[1, 24, 16]} />
          <meshStandardMaterial color={light} roughness={0.95} />
        </mesh>

        {/* 머리: 둥근 두개골 + 흰 볼 + 뾰족한 주둥이 */}
        <mesh position={[0, 0.64, 0.42]} scale={[0.19, 0.17, 0.2]}>
          <sphereGeometry args={[1, 32, 24]} />
          <meshStandardMaterial color={fur} roughness={0.9} />
        </mesh>
        {earSide.map((side) => (
          <mesh
            key={`cheek${side}`}
            position={[side * 0.11, 0.58, 0.5]}
            scale={[0.09, 0.09, 0.13]}
          >
            <sphereGeometry args={[1, 24, 16]} />
            <meshStandardMaterial color={light} roughness={0.95} />
          </mesh>
        ))}
        <mesh position={[0, 0.595, 0.65]} scale={[0.085, 0.075, 0.15]}>
          <sphereGeometry args={[1, 32, 24]} />
          <meshStandardMaterial color={fur} roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.565, 0.62]} scale={[0.07, 0.05, 0.12]}>
          <sphereGeometry args={[1, 20, 12]} />
          <meshStandardMaterial color={light} roughness={0.95} />
        </mesh>
        <mesh position={[0, 0.6, 0.78]}>
          <sphereGeometry args={[0.032, 16, 12]} />
          <meshStandardMaterial color={dark} roughness={0.4} />
        </mesh>
        {earSide.map((side) => (
          <group key={`face${side}`}>
            {/* 눈: 살짝 치켜올라간 검은 눈에 도깨비불 빛이 하나 */}
            <mesh
              position={[side * 0.088, 0.665, 0.575]}
              rotation={[0, 0, side * -0.35]}
              scale={[1.2, 1, 0.7]}
            >
              <sphereGeometry args={[0.046, 20, 14]} />
              <meshStandardMaterial color={dark} roughness={0.3} />
            </mesh>
            {/* 눈의 흰 하이라이트 점 */}
            <mesh position={[side * 0.1, 0.682, 0.603]}>
              <sphereGeometry args={[0.012, 10, 8]} />
              <meshBasicMaterial color={light} />
            </mesh>
            {/* 귀: 크고 뾰족하게, 안쪽은 어둡게 */}
            <group
              position={[side * 0.1, 0.77, 0.38]}
              rotation={[-0.2, 0, side * -0.28]}
            >
              <mesh position={[0, 0.1, 0]} scale={[0.078, 0.155, 0.05]}>
                <sphereGeometry args={[1, 32, 24]} />
                <meshStandardMaterial color={fur} roughness={0.9} />
              </mesh>
              <mesh position={[0, 0.095, 0.024]} scale={[0.046, 0.115, 0.03]}>
                <sphereGeometry args={[1, 24, 16]} />
                <meshStandardMaterial color={dark} roughness={0.95} />
              </mesh>
            </group>
          </group>
        ))}

        {/* 다리: 가는 다리 윗부분은 털색, 아랫부분은 어두운 양말 */}
        {[-1, 1].flatMap((side) =>
          [-1, 1].map((front) => (
            <group
              key={`${side}-${front}`}
              position={[side * 0.11, 0.34, front * 0.26]}
              ref={(el) => {
                legs.current[(side === -1 ? 0 : 2) + (front === -1 ? 0 : 1)] =
                  el;
              }}
            >
              <mesh position={[0, -0.1, 0]}>
                <capsuleGeometry args={[0.048, 0.13, 8, 24]} />
                <meshStandardMaterial color={fur} roughness={0.9} />
              </mesh>
              <mesh position={[0, -0.26, 0.005]}>
                <capsuleGeometry args={[0.04, 0.1, 8, 24]} />
                <meshStandardMaterial color={dark} roughness={0.9} />
              </mesh>
            </group>
          )),
        )}

        {/* 꼬리: 굵고 풍성하며 끝은 흰색, 끝에서 도깨비불이 인다 */}
        <group ref={tail} position={[0, 0.45, -0.4]} rotation={[-0.5, 0, 0]}>
          <mesh position={[0, 0, -0.28]} scale={[0.15, 0.15, 0.36]}>
            <sphereGeometry args={[1, 32, 24]} />
            <meshStandardMaterial color={fur} roughness={0.95} />
          </mesh>
          <mesh position={[0, 0, -0.6]} scale={[0.11, 0.11, 0.15]}>
            <sphereGeometry args={[1, 24, 16]} />
            <meshStandardMaterial
              color={light}
              emissive={magic}
              emissiveIntensity={0.3}
              roughness={0.95}
            />
          </mesh>
          <mesh position={[0, 0.07, -0.66]} scale={[0.08, 0.13, 0.08]}>
            <sphereGeometry args={[1, 16, 12]} />
            <meshBasicMaterial
              color={magic}
              transparent
              opacity={0.7}
              depthWrite={false}
            />
          </mesh>
        </group>
      </group>
    </group>
  );
}
