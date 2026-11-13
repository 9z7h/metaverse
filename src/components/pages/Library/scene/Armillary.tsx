/**
 * 혼천의에서 착안한 먹빛각의 창작 천문 장식. 실제 유물의 정밀 복제품은 아니다.
 * 자리는 sceneLayout의 OBSTACLES[0]과 같고, 안쪽 관측 고리만 천천히 회전한다.
 */
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import {
  CanvasTexture,
  Color,
  Object3D,
  Path,
  Shape,
  SRGBColorSpace,
} from "three";
import type { Group, InstancedMesh, Texture } from "three";
import { OBSTACLES } from "./sceneLayout";
import type { SceneColors } from "./sceneLayout";
import { useSurfaceTexture } from "./surfaceTexture";
import { useReducedMotion } from "./useReducedMotion";

const SPHERE_Y = 1.81;
const BRASS_GAIN = new Color().setScalar(1.5);
const WOOD_GAIN = new Color().setScalar(1.8);
const BRASS_URL = `${import.meta.env.BASE_URL}textures/antique-brass.jpg`;

/** 두께가 있는 납작한 환과 음각 느낌의 눈금. 반복 눈금은 한 번에 그린다. */
function GraduatedRing({
  radius,
  atlas,
  grain,
  ink,
}: {
  radius: number;
  atlas: Texture;
  grain: Texture;
  ink: Color;
}) {
  const ticks = useRef<InstancedMesh>(null);
  const shape = useMemo(() => {
    const outline = new Shape();
    outline.absarc(0, 0, radius + 0.027, 0, Math.PI * 2, false);
    const hole = new Path();
    hole.absarc(0, 0, radius - 0.027, 0, Math.PI * 2, true);
    outline.holes.push(hole);
    return outline;
  }, [radius]);
  useLayoutEffect(() => {
    if (!ticks.current) return;
    const transform = new Object3D();
    // 양면에 눈금을 넣어 위·아래 어느 쪽에서도 보이게 한다.
    for (let side = 0; side < 2; side++) {
      for (let i = 0; i < 120; i++) {
        const angle = (i / 120) * Math.PI * 2;
        const major = i % 10 === 0;
        const length = major ? 0.039 : i % 5 === 0 ? 0.027 : 0.016;
        const r = radius + 0.02 - length / 2;
        transform.position.set(
          Math.cos(angle) * r,
          Math.sin(angle) * r,
          side ? 0.016 : -0.004,
        );
        transform.rotation.set(0, 0, angle - Math.PI / 2);
        transform.scale.set(major ? 0.003 : 0.0015, length, 0.0015);
        transform.updateMatrix();
        ticks.current.setMatrixAt(side * 120 + i, transform.matrix);
      }
    }
    ticks.current.instanceMatrix.needsUpdate = true;
  }, [radius]);
  return (
    <group>
      <mesh>
        <extrudeGeometry
          args={[
            shape,
            {
              depth: 0.012,
              bevelEnabled: true,
              bevelThickness: 0.002,
              bevelSize: 0.002,
              bevelSegments: 1,
              steps: 1,
              curveSegments: 96,
            },
          ]}
        />
        <meshStandardMaterial
          map={atlas}
          color={BRASS_GAIN}
          bumpMap={grain}
          bumpScale={0.002}
          metalness={0.34}
          roughness={0.42}
        />
      </mesh>
      <instancedMesh ref={ticks} args={[undefined, undefined, 240]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={ink} metalness={0.3} roughness={0.8} />
      </instancedMesh>
    </group>
  );
}

export function Armillary({ colors }: { colors: SceneColors }) {
  const spin = useRef<Group>(null);
  const reduced = useReducedMotion();
  useFrame(({ clock }) => {
    if (spin.current && !reduced)
      spin.current.rotation.y = clock.elapsedTime * 0.075;
  });
  const brass = useTexture(BRASS_URL, (texture) => {
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 4;
  });
  const woodgrain = useTexture(
    `${import.meta.env.BASE_URL}textures/antique-walnut.jpg`,
    (texture) => {
      texture.colorSpace = SRGBColorSpace;
      texture.anisotropy = 4;
    },
  );
  const metalgrain = useSurfaceTexture("plaster", 4, 4);
  const at = OBSTACLES[0];
  const dark = colors["--color-scene-wood-dark"];
  const nameplate = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 384;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = colors["--color-scene-wood-dark"];
      ctx.font = "600 54px Pretendard";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("혼천의", 192, 65);
      ctx.strokeStyle = colors["--color-scene-wood-dark"];
      ctx.lineWidth = 2;
      ctx.strokeRect(10, 10, 364, 108);
    }
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
  }, [colors]);
  useEffect(() => () => nameplate.dispose(), [nameplate]);
  const ink = useMemo(
    () => new Color(colors["--color-scene-brass"]).lerp(new Color(dark), 0.7),
    [colors, dark],
  );
  const metal = (
    <meshStandardMaterial
      map={brass}
      color={BRASS_GAIN}
      bumpMap={metalgrain}
      bumpScale={0.002}
      metalness={0.34}
      roughness={0.42}
    />
  );
  const timber = (
    <meshStandardMaterial
      map={woodgrain}
      color={WOOD_GAIN}
      bumpMap={woodgrain}
      bumpScale={0.004}
      roughness={0.66}
    />
  );
  const graduated = (radius: number) => (
    <GraduatedRing radius={radius} atlas={brass} grain={metalgrain} ink={ink} />
  );

  return (
    <group position={[at.x, 0, at.z]}>
      {/* 목제 기단과 네 다리, 아래쪽 연결대 */}
      <mesh position={[0, 0.07, 0]}>
        <boxGeometry args={[0.9, 0.12, 0.9]} />
        {timber}
      </mesh>
      {[-1, 1].flatMap((x) =>
        [-1, 1].map((z) => (
          <group key={`${x}${z}`} position={[x * 0.32, 0, z * 0.32]}>
            <mesh position={[0, 0.49, 0]}>
              <boxGeometry args={[0.105, 0.74, 0.105]} />
              {timber}
            </mesh>
            <mesh position={[0, 0.17, 0]}>
              <boxGeometry args={[0.14, 0.055, 0.14]} />
              {timber}
            </mesh>
            <mesh position={[0, 0.77, 0]}>
              <boxGeometry args={[0.15, 0.09, 0.15]} />
              {timber}
            </mesh>
          </group>
        )),
      )}
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[0, 0.31, side * 0.32]}>
            <boxGeometry args={[0.64, 0.055, 0.055]} />
            {timber}
          </mesh>
          <mesh position={[side * 0.32, 0.31, 0]}>
            <boxGeometry args={[0.055, 0.055, 0.64]} />
            {timber}
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.86, 0]}>
        <boxGeometry args={[0.85, 0.08, 0.85]} />
        {timber}
      </mesh>
      <mesh position={[0, 0.94, 0]}>
        <boxGeometry args={[0.96, 0.1, 0.96]} />
        <meshStandardMaterial
          map={woodgrain}
          color={WOOD_GAIN}
          bumpMap={woodgrain}
          bumpScale={0.004}
          roughness={0.55}
        />
      </mesh>
      <mesh position={[0, 0.94, 0.487]}>
        <boxGeometry args={[0.3, 0.085, 0.012]} />
        {metal}
      </mesh>
      <mesh position={[0, 0.94, 0.494]}>
        <planeGeometry args={[0.29, 0.08]} />
        <meshBasicMaterial map={nameplate} transparent depthWrite={false} />
      </mesh>
      {/* 축을 받치는 놋쇠 기둥과 고정 나사 */}
      {[-1, 1].map((side) => (
        <group key={`support${side}`} position={[side * 0.53, 0, 0]}>
          <mesh position={[0, 1.36, 0]} rotation={[0, 0, side * -0.23]}>
            <cylinderGeometry args={[0.018, 0.031, 0.78, 12]} />
            {metal}
          </mesh>
          <mesh
            position={[side * 0.09, 1.76, 0]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.047, 0.047, 0.065, 16]} />
            {metal}
          </mesh>
        </group>
      ))}
      {/* 지평환과 자오환은 고정하고 안쪽 고리만 기울어진 축을 따라 회전한다. */}
      <group position={[0, SPHERE_Y, 0]}>
        <group rotation={[-Math.PI / 2, 0, 0]}>{graduated(0.64)}</group>
        <group rotation={[0, 0.15, 0]}>{graduated(0.585)}</group>
        <group rotation={[0.62, 0, 0]}>
          <mesh>
            <cylinderGeometry args={[0.012, 0.012, 1.16, 12]} />
            {metal}
          </mesh>
          {[-1, 1].map((side) => (
            <mesh key={`pin${side}`} position={[0, side * 0.58, 0]}>
              <sphereGeometry args={[0.035, 12, 10]} />
              {metal}
            </mesh>
          ))}
          <group ref={spin}>
            <group rotation={[Math.PI / 2, 0, 0]}>{graduated(0.49)}</group>
            <group rotation={[Math.PI / 2 - 0.41, 0, 0]}>
              {graduated(0.43)}
            </group>
            {/* 가운데의 작은 구와 별을 겨누는 조준 막대 */}
            <mesh>
              <sphereGeometry args={[0.075, 20, 16]} />
              {metal}
            </mesh>
            <group rotation={[0, 0, -0.38]}>
              <mesh rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.012, 0.012, 0.75, 10]} />
                {metal}
              </mesh>
              {[-1, 1].map((side) => (
                <mesh key={`sight${side}`} position={[side * 0.34, 0.04, 0]}>
                  <boxGeometry args={[0.015, 0.075, 0.045]} />
                  {metal}
                </mesh>
              ))}
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
