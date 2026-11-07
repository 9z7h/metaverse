/**
 * 혼천의 — 하늘의 움직임을 재던 한국의 옛 천문 기구를 본뜬 장식.
 * 먹빛각 뒷벽 모서리에 놓이며, 천천히 돈다. 자리는 sceneLayout의 OBSTACLES[0]과 같다
 * (눈에 보이는 곳과 막히는 곳이 어긋나지 않게).
 */
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { OBSTACLES } from "./sceneLayout";
import type { SceneColors } from "./sceneLayout";

const SPHERE_Y = 1.9;

export function Armillary({ colors }: { colors: SceneColors }) {
  const spin = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (spin.current) spin.current.rotation.y = clock.elapsedTime * 0.25;
  });

  const at = OBSTACLES[0];
  const brass = colors["--color-scene-brass"];
  const wood = colors["--color-scene-wood"];
  const dark = colors["--color-scene-wood-dark"];
  const ring = (
    <meshStandardMaterial
      color={brass}
      emissive={brass}
      emissiveIntensity={0.25}
      metalness={0.7}
      roughness={0.35}
    />
  );

  return (
    <group position={[at.x, 0, at.z]}>
      {/* 받침대 */}
      <mesh position={[0, 0.45, 0]}>
        <cylinderGeometry args={[0.35, 0.55, 0.9, 14]} />
        <meshStandardMaterial color={dark} />
      </mesh>
      <mesh position={[0, 0.95, 0]}>
        <cylinderGeometry args={[0.62, 0.62, 0.1, 18]} />
        <meshStandardMaterial color={wood} />
      </mesh>
      <mesh position={[0, 1.3, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.6, 8]} />
        {ring}
      </mesh>

      {/* 도는 고리들: 적도환 · 자오환 · 기울어진 황도환 + 가운데 지구 */}
      <group position={[0, SPHERE_Y, 0]} ref={spin}>
        <mesh>
          <sphereGeometry args={[0.13, 14, 14]} />
          {ring}
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.62, 0.025, 8, 40]} />
          {ring}
        </mesh>
        <mesh>
          <torusGeometry args={[0.62, 0.025, 8, 40]} />
          {ring}
        </mesh>
        <mesh rotation={[Math.PI / 2 - 0.41, 0, 0]}>
          <torusGeometry args={[0.52, 0.02, 8, 40]} />
          {ring}
        </mesh>
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.45, 0.02, 8, 40]} />
          {ring}
        </mesh>
      </group>
    </group>
  );
}
