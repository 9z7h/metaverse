import { useLayoutEffect, useMemo, useRef } from "react";
import { useTexture } from "@react-three/drei";
import { Color, Object3D, SRGBColorSpace } from "three";
import type { InstancedMesh, Texture } from "three";
import type { SceneColors } from "./sceneLayout";
import { useSurfaceTexture } from "./surfaceTexture";

interface DoorMember {
  p: [number, number, number];
  s: [number, number, number];
}

function TimberMembers({
  members,
  timber,
  gain,
}: {
  members: DoorMember[];
  timber: Texture;
  gain: number;
}) {
  const mesh = useRef<InstancedMesh>(null);
  const tone = useMemo(() => new Color().setScalar(gain), [gain]);
  useLayoutEffect(() => {
    if (!mesh.current) return;
    const transform = new Object3D();
    members.forEach((member, i) => {
      transform.position.set(...member.p);
      transform.scale.set(...member.s);
      transform.updateMatrix();
      mesh.current!.setMatrixAt(i, transform.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  }, [members]);
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, members.length]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        map={timber}
        color={tone}
        bumpMap={timber}
        bumpScale={0.003}
        roughness={0.62}
      />
    </instancedMesh>
  );
}

export interface HanokDoorProps {
  colors: SceneColors;
  width?: number;
  height?: number;
  warmInside?: boolean;
}

/** 서고 안팎에서 공유하는 목제 쌍여닫이문. 정면은 로컬 +z 방향이다. */
export function HanokDoor({
  colors,
  width = 1.92,
  height = 2.6,
  warmInside = false,
}: HanokDoorProps) {
  const timber = useTexture(
    `${import.meta.env.BASE_URL}textures/antique-walnut.jpg`,
    (texture) => {
      texture.colorSpace = SRGBColorSpace;
      texture.anisotropy = 4;
    },
  );
  const brass = useTexture(
    `${import.meta.env.BASE_URL}textures/antique-brass.jpg`,
    (texture) => {
      texture.colorSpace = SRGBColorSpace;
      texture.anisotropy = 4;
    },
  );
  const hanji = useSurfaceTexture("plaster", 2, 3);
  const leafWidth = (width - 0.025) / 2;
  const paneWidth = leafWidth - 0.15;
  const paneBottom = height * 0.42;
  const paneTop = height - 0.17;
  const paneHeight = paneTop - paneBottom;
  const frame = useMemo<DoorMember[]>(
    () => [
      {
        p: [-width / 2 - 0.085, (height + 0.2) / 2, 0],
        s: [0.17, height + 0.2, 0.24],
      },
      {
        p: [width / 2 + 0.085, (height + 0.2) / 2, 0],
        s: [0.17, height + 0.2, 0.24],
      },
      { p: [0, height + 0.28, 0], s: [width + 0.5, 0.24, 0.28] },
      { p: [0, height + 0.08, -0.015], s: [width + 0.17, 0.16, 0.16] },
      { p: [0, height + 0.12, 0.025], s: [width + 0.23, 0.065, 0.22] },
      { p: [0, 0.045, 0], s: [width + 0.16, 0.09, 0.3] },
    ],
    [width, height],
  );
  const leaves = useMemo<DoorMember[]>(() => {
    const out: DoorMember[] = [];
    for (const side of [-1, 1]) {
      const center = side * (leafWidth / 2 + 0.0125);
      out.push({ p: [center, height / 2, 0], s: [leafWidth, height, 0.065] });
      for (const edge of [-1, 1])
        out.push({
          p: [center + edge * (leafWidth / 2 - 0.035), height / 2, 0.048],
          s: [0.07, height, 0.045],
        });
      // 판문 위아래의 가로 부재와 안쪽으로 들어간 두 겹의 아래 판.
      for (const y of [0.13, paneBottom - 0.06, height - 0.11])
        out.push({ p: [center, y, 0.055], s: [leafWidth - 0.08, 0.09, 0.055] });
      out.push({
        p: [center, paneBottom / 2, 0.041],
        s: [paneWidth - 0.05, paneBottom - 0.31, 0.025],
      });
      // 격자 살창은 한지보다 조금 앞으로 나와 깊이와 그림자가 생긴다.
      for (let column = 1; column < 4; column++)
        out.push({
          p: [
            center - paneWidth / 2 + (column * paneWidth) / 4,
            (paneBottom + paneTop) / 2,
            0.069,
          ],
          s: [0.021, paneHeight, 0.025],
        });
      for (let row = 1; row < 7; row++)
        out.push({
          p: [center, paneBottom + (row * paneHeight) / 7, 0.069],
          s: [paneWidth, 0.02, 0.025],
        });
    }
    return out;
  }, [leafWidth, paneWidth, paneBottom, paneTop, paneHeight, height]);
  const metal = (
    <meshStandardMaterial
      map={brass}
      color={new Color().setScalar(1.4)}
      metalness={0.38}
      roughness={0.46}
    />
  );

  return (
    <group>
      <TimberMembers members={frame} timber={timber} gain={1.15} />
      <TimberMembers members={leaves} timber={timber} gain={1.7} />
      {[-1, 1].map((side) => {
        const center = side * (leafWidth / 2 + 0.0125);
        const handleX = side * 0.13;
        const handleY = height * 0.36;
        return (
          <group key={side}>
            <mesh position={[center, (paneBottom + paneTop) / 2, 0.038]}>
              <planeGeometry args={[paneWidth, paneHeight]} />
              <meshStandardMaterial
                map={hanji}
                color={colors["--color-scene-collar"]}
                roughness={0.96}
                emissive={colors["--color-scene-flame"]}
                emissiveIntensity={warmInside ? 0.14 : 0.02}
              />
            </mesh>
            {/* 손잡이의 금속 받침과 고리, 작은 고정 못 */}
            <mesh position={[handleX, handleY, 0.082]}>
              <boxGeometry args={[0.074, 0.12, 0.015]} />
              {metal}
            </mesh>
            <mesh position={[handleX, handleY - 0.04, 0.115]}>
              <torusGeometry args={[0.049, 0.008, 8, 24]} />
              {metal}
            </mesh>
            {[-1, 1].map((end) => (
              <mesh
                key={`rivet${end}`}
                position={[handleX, handleY + end * 0.044, 0.096]}
              >
                <sphereGeometry args={[0.008, 8, 6]} />
                {metal}
              </mesh>
            ))}
            {/* 문틀 쪽 경첩과 회전축 */}
            {[height * 0.2, height * 0.78].map((y) => (
              <group key={y}>
                <mesh position={[side * (width / 2 - 0.065), y, 0.135]}>
                  <boxGeometry args={[0.14, 0.04, 0.012]} />
                  {metal}
                </mesh>
                <mesh position={[side * (width / 2 + 0.005), y, 0.142]}>
                  <cylinderGeometry args={[0.012, 0.012, 0.13, 10]} />
                  {metal}
                </mesh>
              </group>
            ))}
          </group>
        );
      })}
    </group>
  );
}
