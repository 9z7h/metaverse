import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, PointLight } from "three";
import { getAudioContext } from "./Avatar";
import { getEffectsBus } from "../soundSettings";
import { ROOM } from "./sceneLayout";
import type { SceneColors } from "./sceneLayout";
import { useSurfaceTexture } from "./surfaceTexture";

/** 오디오 파일 없이 불길과 장작이 타닥거리는 소리를 합성한다. */
function FireplaceSound() {
  useEffect(() => {
    let source: AudioBufferSourceNode | null = null;
    let gain: GainNode | null = null;
    const start = () => {
      if (source) return;
      const ctx = getAudioContext();
      if (!ctx) return;
      try {
        const buffer = ctx.createBuffer(1, ctx.sampleRate * 8, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let rumble = 0;
        for (let i = 0; i < data.length; i++) {
          rumble = rumble * 0.96 + (Math.random() * 2 - 1) * 0.04;
          data[i] = rumble * 0.6;
        }
        for (let i = 0; i < 36; i++) {
          const offset = Math.floor(Math.random() * (data.length - 2000));
          const length = Math.floor(
            ctx.sampleRate * (0.004 + Math.random() * 0.025),
          );
          const strength = 0.25 + Math.random() * 0.5;
          for (let j = 0; j < length && offset + j < data.length; j++) {
            data[offset + j] +=
              (Math.random() * 2 - 1) *
              strength *
              Math.exp(-j / (length * 0.2));
          }
        }
        const next = ctx.createBufferSource();
        const volume = ctx.createGain();
        volume.gain.value = 0.18;
        next.buffer = buffer;
        next.loop = true;
        next.connect(volume).connect(getEffectsBus(ctx));
        next.start();
        source = next;
        gain = volume;
      } catch {
        // 오디오를 사용할 수 없으면 벽난로만 표시한다.
      }
    };
    document.addEventListener("pointerdown", start);
    document.addEventListener("keydown", start);
    return () => {
      document.removeEventListener("pointerdown", start);
      document.removeEventListener("keydown", start);
      source?.stop();
      source?.disconnect();
      gain?.disconnect();
    };
  }, []);
  return null;
}

export function Fireplace({ colors }: { colors: SceneColors }) {
  const fire = useRef<Group>(null);
  const light = useRef<PointLight>(null);
  const stone = useSurfaceTexture("stone", 3, 2);
  const masonry = colors["--color-scene-stone"];
  const dark = colors["--color-scene-wood-dark"];
  const flame = colors["--color-scene-flame"];
  const ember = colors["--color-scene-spell-ember"];
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (fire.current) fire.current.scale.y = 0.94 + Math.sin(t * 5) * 0.06;
    if (light.current)
      light.current.intensity =
        4.2 + Math.sin(t * 7) * 0.25 + Math.sin(t * 3) * 0.2;
  });
  return (
    <group position={[0, 0, ROOM.minZ - 0.58]}>
      <FireplaceSound />
      <mesh position={[0, 1.8, 0.06]}>
        <boxGeometry args={[4.5, 3.6, 0.2]} />
        <meshStandardMaterial color={masonry} map={stone} roughness={0.95} />
      </mesh>
      <mesh position={[0, 1.4, 0.2]}>
        <boxGeometry args={[2.9, 2.45, 0.14]} />
        <meshStandardMaterial color={dark} roughness={1} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 1.85, 1.6, 0.45]}>
          <boxGeometry args={[0.65, 3.2, 0.9]} />
          <meshStandardMaterial color={masonry} map={stone} roughness={0.95} />
        </mesh>
      ))}
      <mesh position={[0, 3.2, 0.45]}>
        <boxGeometry args={[4.4, 0.45, 0.9]} />
        <meshStandardMaterial color={masonry} map={stone} roughness={0.95} />
      </mesh>
      <mesh position={[0, 3.5, 0.48]}>
        <boxGeometry args={[4.8, 0.2, 1.1]} />
        <meshStandardMaterial color={masonry} map={stone} roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.1, 0.75]}>
        <boxGeometry args={[4.5, 0.2, 1.5]} />
        <meshStandardMaterial color={masonry} map={stone} roughness={0.95} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * 0.35, 0.3, 0.62]}
          rotation={[0, side * 0.45, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.13, 0.16, 1.3, 8]} />
          <meshStandardMaterial
            color={colors["--color-scene-wood"]}
            roughness={1}
          />
        </mesh>
      ))}
      <group ref={fire} position={[0, 0.3, 0.6]}>
        {[-1, 0, 1].map((side) => (
          <mesh
            key={side}
            position={[side * 0.34, 0.38, side === 0 ? 0.1 : 0]}
            rotation={[0, 0, side * -0.15]}
          >
            <coneGeometry args={[0.27, side === 0 ? 1.05 : 0.75, 7]} />
            <meshStandardMaterial
              color={side === 0 ? flame : ember}
              emissive={side === 0 ? flame : ember}
              emissiveIntensity={1.8}
            />
          </mesh>
        ))}
      </group>
      <pointLight
        ref={light}
        position={[0, 1, 1.1]}
        color={flame}
        intensity={4.2}
        distance={8}
        decay={2}
      />
    </group>
  );
}
