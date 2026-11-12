import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  Object3D,
  ShaderMaterial,
} from "three";
import type { InstancedMesh, PointLight, Texture } from "three";
import { getAudioContext } from "./Avatar";
import { getEffectsBus } from "../soundSettings";
import { FIREPLACE, ROOM, fireplaceLayout } from "./sceneLayout";
import type { FireplacePart, SceneColors } from "./sceneLayout";
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

/** 같은 모양 조각 여러 개를 InstancedMesh 하나로 — 조각마다 tint(0~1)만큼 두 색 사이로 칠한다 */
function Parts({
  parts,
  from,
  to,
  roughness = 0.9,
  map,
  children,
}: {
  parts: ReadonlyArray<FireplacePart>;
  from: Color;
  to: Color;
  roughness?: number;
  map?: Texture;
  children?: ReactNode;
}) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const o = new Object3D();
    const c = new Color();
    parts.forEach((q, i) => {
      o.position.set(...q.p);
      o.rotation.set(0, 0, q.rz ?? 0);
      o.scale.set(...q.s);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
      mesh.setColorAt(i, c.copy(from).lerp(to, q.tint));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [parts, from, to]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, parts.length]}>
      {children ?? <boxGeometry args={[1, 1, 1]} />}
      <meshStandardMaterial roughness={roughness} map={map} />
    </instancedMesh>
  );
}

const part = (
  p: FireplacePart["p"],
  s: FireplacePart["s"],
  tint = 0.5,
): FireplacePart => ({ p, s, tint });

/** 쇠살대 — 앞뒤 가로대, 양옆 세로대, 장작받이, 네 다리 */
const GRATE: ReadonlyArray<FireplacePart> = [
  part([0, 0.42, 1.0], [1.5, 0.04, 0.04]),
  part([0, 0.42, 0.3], [1.5, 0.04, 0.04]),
  ...[-0.75, 0.75].map((x) => part([x, 0.42, 0.65], [0.04, 0.04, 0.74])),
  ...[-0.4, 0, 0.4].map((x) => part([x, 0.36, 0.65], [0.035, 0.03, 0.7])),
  ...[-0.75, 0.75].flatMap((x) =>
    [0.3, 1.0].map((z) => part([x, 0.35, z], [0.04, 0.14, 0.04])),
  ),
  // 앞 가로대 양끝의 둥근 마감
  ...[-0.75, 0.75].map((x) => part([x, 0.47, 1.0], [0.07, 0.07, 0.07])),
];

/** 장작 — 아래 두 개는 가로로 놓고 위에 한 개를 앞뒤로 걸친다 */
const LOGS: ReadonlyArray<{
  at: [number, number, number];
  rot: [number, number, number];
  len: number;
  r: number;
}> = [
  { at: [0.02, 0.5, 0.45], rot: [0, 0.05, Math.PI / 2], len: 1.0, r: 0.095 },
  { at: [-0.04, 0.5, 0.82], rot: [0, -0.08, Math.PI / 2], len: 0.95, r: 0.09 },
  { at: [0.1, 0.68, 0.62], rot: [Math.PI / 2, 0.1, 0.05], len: 0.85, r: 0.085 },
];

/** 투명한 불꽃을 여러 겹으로 겹쳐 장작 사이에서 일렁이게 한다. */
function LivingFlame({ flame, ember }: { flame: string; ember: string }) {
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uGold: { value: new Color(flame) },
          uEmber: { value: new Color(ember) },
        },
        vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `
      uniform float uTime; uniform vec3 uGold; uniform vec3 uEmber; varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y); }
      void main() {
        float y = vUv.y;
        float drift = (noise(vec2(y*3.0, uTime*0.7))-0.5)*0.24*y;
        float x = (vUv.x-0.5) * 2.0 + drift;
        float n = noise(vec2(vUv.x*5.0, y*5.0-uTime*1.8));
        n += 0.5 * noise(vec2(vUv.x*11.0+2.0, y*10.0-uTime*3.2));
        float shape = (1.0-abs(x)*1.15)*(1.0-y) + n*0.35 - 0.30;
        float alpha = smoothstep(0.0, 0.18, shape) * smoothstep(0.0, 0.08, y) * (1.0-smoothstep(0.72, 1.0, y));
        float core = smoothstep(0.06,0.4,shape) * (1.0-smoothstep(0.12,0.75,y));
        vec3 color = mix(uEmber, uGold * 1.6, core);
        gl_FragColor = vec4(color, alpha * 0.65);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        blending: AdditiveBlending,
      }),
    [flame, ember],
  );
  useEffect(() => () => material.dispose(), [material]);
  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime;
  });
  return (
    <group position={[0, 0.38, 0.65]}>
      {[0, Math.PI / 2, Math.PI / 4].map((angle) => (
        <mesh key={angle} position={[0, 0.68, 0]} rotation={[0, angle, 0]}>
          <planeGeometry args={[1.8, 1.36]} />
          <primitive object={material} attach="material" />
        </mesh>
      ))}
    </group>
  );
}

export function Fireplace({ colors }: { colors: SceneColors }) {
  const light = useRef<PointLight>(null);
  const stone = useSurfaceTexture("stone", 3, 2);
  const flame = colors["--color-scene-flame"];
  const ember = colors["--color-scene-spell-ember"];
  const layout = useMemo(() => fireplaceLayout(), []);
  const c = useMemo(() => {
    const brick = new Color(colors["--color-scene-brick"]);
    const sand = brick
      .clone()
      .lerp(new Color(colors["--color-scene-collar"]), 0.4);
    const rock = new Color(colors["--color-scene-stone"]);
    const iron = new Color(colors["--color-scene-wood-dark"]).multiplyScalar(
      0.5,
    );
    return {
      brickDark: brick.clone().multiplyScalar(0.78),
      brickLight: brick.clone().multiplyScalar(1.12),
      mortar: brick.clone().multiplyScalar(0.3),
      backDark: brick.clone().multiplyScalar(0.2),
      backLight: brick.clone().multiplyScalar(0.34),
      sandDark: sand.clone().multiplyScalar(0.86),
      sand,
      rockDark: rock.clone().multiplyScalar(0.78),
      rockLight: rock.clone().multiplyScalar(1.08),
      iron,
      char: new Color(colors["--color-scene-wood-dark"]),
    };
  }, [colors]);
  const hearth = useMemo<FireplacePart[]>(() => {
    // 두 줄 석판 — 뒷줄은 여섯 장, 앞줄은 이음새가 엇갈리게 다섯 장
    const row = (n: number, z: number, depth: number, seed: number) =>
      Array.from({ length: n }, (_, i) => {
        const w = 4.8 / n;
        return {
          p: [-2.4 + w * (i + 0.5), 0.23, z] as [number, number, number],
          s: [w - 0.03, 0.1, depth - 0.03] as [number, number, number],
          tint: ((i * 37 + seed * 11) % 10) / 10,
        };
      });
    return [...row(6, 0.55, 1.1, 1), ...row(5, 1.2, 0.5, 2)];
  }, []);
  const base = useMemo<FireplacePart[]>(
    () =>
      // 석판 아래 벽돌 띠 (앞면)
      Array.from({ length: 14 }, (_, i) => ({
        p: [-2.4 + 0.343 * (i + 0.5), 0.09, 1.38] as [number, number, number],
        s: [0.32, 0.16, 0.24] as [number, number, number],
        tint: ((i * 53) % 10) / 10,
      })),
    [],
  );
  const mantel = useMemo<FireplacePart[]>(
    () =>
      [0.95, 0.97, 0.96, 0.97, 0.95].map((w, i, all) => {
        const before = all.slice(0, i).reduce((a, b) => a + b, 0);
        return {
          p: [-2.4 + before + w / 2, 3.5, 0.45] as [number, number, number],
          s: [w - 0.03, 0.2, 0.95] as [number, number, number],
          tint: ((i * 29) % 10) / 10,
        };
      }),
    [],
  );
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (light.current)
      light.current.intensity =
        4.2 + Math.sin(t * 7) * 0.25 + Math.sin(t * 3) * 0.2;
  });
  const { spring, openingR, ringW, floor, wallTop, wallDepth } = FIREPLACE;
  const crown = spring + openingR + ringW;
  return (
    <group position={[0, 0, ROOM.minZ - 0.58]}>
      <FireplaceSound />
      {/* 줄눈 — 벽돌 뒤에 어두운 벽을 깔아 틈이 줄눈처럼 보인다 */}
      <mesh position={[0, (wallTop + floor) / 2, wallDepth * 0.4]}>
        <boxGeometry
          args={[FIREPLACE.halfWidth * 2, wallTop - floor, wallDepth * 0.8]}
        />
        <meshStandardMaterial color={c.mortar} roughness={1} />
      </mesh>
      <Parts parts={layout.wall} from={c.brickDark} to={c.brickLight} />
      {/* 불 칸: 어두운 벽돌 안벽과 천장 */}
      <mesh position={[0, floor + (spring - floor) / 2, 0.08]}>
        <boxGeometry args={[openingR * 2, spring - floor, 0.1]} />
        <meshStandardMaterial color={c.backDark} roughness={1} />
      </mesh>
      <Parts
        parts={layout.back}
        from={c.backDark}
        to={c.backLight}
        roughness={1}
      />
      {/* 아치(쐐기돌)와 양쪽 기둥 돌, 꼭대기 쐐기 */}
      <Parts parts={layout.arch} from={c.sandDark} to={c.sand} map={stone} />
      <Parts parts={layout.jambs} from={c.sandDark} to={c.sand} map={stone} />
      <mesh position={[0, crown + 0.2, 0.4]} rotation={[0, Math.PI / 4, 0]}>
        <cylinderGeometry args={[0.28, 0.17, 0.8, 4]} />
        <meshStandardMaterial color={c.sand} map={stone} roughness={0.9} />
      </mesh>
      {/* 선반: 널빤지 이음이 보이는 두툼한 판 + 그 아래 한 단 처마 */}
      <Parts parts={mantel} from={c.sandDark} to={c.sand} map={stone} />
      <mesh position={[0, 3.33, 0.42]}>
        <boxGeometry args={[4.6, 0.14, 0.78]} />
        <meshStandardMaterial color={c.sandDark} map={stone} roughness={0.9} />
      </mesh>
      {/* 바닥 단: 석판 두 줄과 아래 벽돌 띠 */}
      <Parts parts={hearth} from={c.rockDark} to={c.rockLight} map={stone} />
      <Parts parts={base} from={c.brickDark} to={c.brickLight} />
      <mesh position={[0, 0.09, 0.72]}>
        <boxGeometry args={[4.8, 0.18, 1.4]} />
        <meshStandardMaterial color={c.mortar} roughness={1} />
      </mesh>
      {/* 쇠살대와 장작 */}
      <Parts parts={GRATE} from={c.iron} to={c.iron} roughness={0.5} />
      {LOGS.map((l, i) => (
        <group key={i} position={l.at} rotation={l.rot}>
          <mesh>
            <capsuleGeometry args={[l.r, l.len, 6, 14]} />
            <meshStandardMaterial
              color={c.char}
              emissive={ember}
              emissiveIntensity={0.18}
              roughness={1}
            />
          </mesh>
          {/* 잉걸이 비치는 끝단 */}
          {[-1, 1].map((end) => (
            <mesh key={end} position={[0, end * (l.len / 2 + l.r * 0.6), 0]}>
              <sphereGeometry args={[l.r * 0.78, 12, 10]} />
              <meshStandardMaterial
                color={ember}
                emissive={ember}
                emissiveIntensity={1.2}
              />
            </mesh>
          ))}
        </group>
      ))}
      <LivingFlame flame={flame} ember={ember} />
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
