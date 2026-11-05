import { createContext, forwardRef, useContext, useRef } from "react";
import type { RefObject } from "react";
import type { CSSProperties } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { Group } from "three";

export type AvatarPose = "stand" | "walk" | "sit";

/**
 * 이름표(Html)를 붙일 DOM 컨테이너. 기본값(R3F 내부 노드)에 붙이면 Canvas 언마운트 시
 * R3F가 그 노드를 먼저 지워서 이름표 정리 단계에서 removeChild 에러가 난다.
 * → LibraryWorld가 소유한 div에 붙인다.
 */
export const LabelPortalContext =
  createContext<RefObject<HTMLElement | null> | null>(null);

export interface AvatarProps {
  /** 도포 색 (기숙사 primary) */
  robe: string;
  /** 갓끈·고름·세조대 색 (기숙사 accent) */
  band?: string;
  /** 깃의 흰 동정 */
  collar: string;
  /** 이름표 앞 기숙사 점 색 */
  houseDot?: string;
  skin: string;
  hat: string;
  pose: AvatarPose;
  /** 앉아서 집중 중이면 고개를 숙이고 끄덕임, 아니면 등을 젖히고 흔들림 */
  focusing?: boolean;
  /** 머리 위 이름표 */
  name: string;
  subject?: string;
  /** 내 아바타 — 이름표 강조 */
  highlight?: boolean;
  /** 이름표 표시 여부. 기본 true */
  showLabel?: boolean;
  /** 실습(마법) 중 — 지팡이를 들고 휘두르며, 이름표에 "실습 중" 표시 */
  practicing?: boolean;
  /** 지팡이 색 (나무) / 지팡이 끝 빛 — practicing일 때만 사용 */
  wand?: { wood: string; glow: string };
}

const tagStyle = (highlight: boolean): CSSProperties => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "var(--spacing-2)",
  padding: "var(--spacing-4) var(--spacing-8)",
  borderRadius: "var(--radius-md)",
  background: highlight
    ? "var(--color-background-brand)"
    : "var(--color-background-Subtle)",
  color: highlight ? "var(--color-text-onbrand)" : "var(--color-text-primary)",
  font: "var(--text-caption-lg-bold)",
  whiteSpace: "nowrap",
  pointerEvents: "none",
  userSelect: "none",
});

/**
 * 저폴리곤 사신학당 학생 아바타 — 도포(흰 동정·고름·세조대) + 갓(갓끈).
 * 기숙사 색은 도포(primary)와 갓끈·고름·세조대(accent)로 드러난다. 위치/회전은 부모가 ref로 제어하고,
 * 여기서는 포즈별 미세 애니메이션(걷기 흔들림, 집중 끄덕임)만 처리한다.
 */
export const Avatar = forwardRef<Group, AvatarProps>(function Avatar(
  {
    robe,
    band,
    collar,
    houseDot,
    skin,
    hat,
    pose,
    focusing = false,
    name,
    subject,
    highlight = false,
    showLabel = true,
    practicing = false,
    wand,
  },
  ref,
) {
  const body = useRef<Group>(null);
  const head = useRef<Group>(null);
  const arm = useRef<Group>(null);
  const portal = useContext(LabelPortalContext);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (!body.current || !head.current) return;
    if (pose === "walk") {
      body.current.position.y = Math.abs(Math.sin(t * 9)) * 0.06;
      body.current.rotation.z = Math.sin(t * 9) * 0.05;
      head.current.rotation.x = 0;
    } else if (pose === "sit") {
      body.current.position.y = -0.22;
      body.current.rotation.z = 0;
      head.current.rotation.x = focusing
        ? 0.35 + Math.sin(t * 1.4) * 0.05 // 책을 내려다보며 살짝 끄덕
        : -0.15 + Math.sin(t * 0.6) * 0.04; // 기지개 펴듯 젖힘
      body.current.rotation.x = focusing ? 0.12 : -0.08;
      if (practicing) {
        // 실습 중엔 책 대신 회오리를 올려다봄
        head.current.rotation.x = -0.2 + Math.sin(t * 1.2) * 0.04;
        body.current.rotation.x = 0;
      }
    } else {
      body.current.position.y = Math.sin(t * 2) * 0.01;
      body.current.rotation.set(0, 0, 0);
      head.current.rotation.x = 0;
    }
    // 지팡이 휘두르기: 앞으로 든 팔이 작은 원을 그림
    if (arm.current) {
      arm.current.rotation.x = 1.15 + Math.sin(t * 4) * 0.12;
      arm.current.rotation.z = -0.25 + Math.cos(t * 4) * 0.15;
    }
  });

  return (
    <group ref={ref}>
      <group ref={body}>
        {/* 도포: 상체 + 아래로 퍼지는 자락 */}
        <mesh position={[0, 0.78, 0]}>
          <capsuleGeometry args={[0.23, 0.32, 4, 14]} />
          <meshStandardMaterial color={robe} roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.31, 0]}>
          <cylinderGeometry args={[0.25, 0.38, 0.62, 18]} />
          <meshStandardMaterial color={robe} roughness={0.9} />
        </mesh>
        {/* 깃 + 흰 동정 (V자로 여밈) */}
        <mesh position={[-0.03, 0.85, 0.232]} rotation={[0, 0, 0.49]}>
          <boxGeometry args={[0.045, 0.3, 0.02]} />
          <meshStandardMaterial color={collar} roughness={0.7} />
        </mesh>
        <mesh position={[0.05, 0.88, 0.226]} rotation={[0, 0, -0.46]}>
          <boxGeometry args={[0.045, 0.22, 0.02]} />
          <meshStandardMaterial color={collar} roughness={0.7} />
        </mesh>
        {band ? (
          <>
            {/* 고름: 가슴의 매듭 + 늘어진 두 가닥 */}
            <mesh position={[0.07, 0.74, 0.232]}>
              <sphereGeometry args={[0.028, 10, 8]} />
              <meshStandardMaterial color={band} roughness={0.6} />
            </mesh>
            {[-0.18, 0.12].map((rz) => (
              <mesh
                key={rz}
                position={[0.07 + rz * 0.15, 0.64, 0.236]}
                rotation={[0, 0, rz]}
              >
                <boxGeometry args={[0.032, 0.2, 0.01]} />
                <meshStandardMaterial color={band} roughness={0.6} />
              </mesh>
            ))}
            {/* 세조대: 허리를 두른 가는 띠 */}
            <mesh position={[0, 0.6, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.25, 0.016, 6, 24]} />
              <meshStandardMaterial color={band} roughness={0.6} />
            </mesh>
          </>
        ) : null}
        <group ref={head} position={[0, 1.02, 0]}>
          {/* 머리 */}
          <mesh position={[0, 0.12, 0]}>
            <sphereGeometry args={[0.26, 20, 16]} />
            <meshStandardMaterial color={skin} roughness={0.8} />
          </mesh>
          {/* 눈 */}
          {[-0.09, 0.09].map((x) => (
            <mesh key={x} position={[x, 0.15, 0.235]}>
              <sphereGeometry args={[0.03, 8, 8]} />
              <meshBasicMaterial color={hat} />
            </mesh>
          ))}
          {/* 갓: 넓고 얇은 챙(말총이라 살짝 비침) + 원통형 모자 */}
          <mesh position={[0, 0.36, 0]}>
            {/* 챙을 너무 넓히면 앉았을 때 뒤에서 보는 내 화면에서 책상·회오리를 가림 */}
            <cylinderGeometry args={[0.38, 0.38, 0.012, 28]} />
            <meshStandardMaterial
              color={hat}
              roughness={0.5}
              transparent
              opacity={0.88}
            />
          </mesh>
          <mesh position={[0, 0.46, 0]}>
            <cylinderGeometry args={[0.12, 0.14, 0.2, 18]} />
            <meshStandardMaterial color={hat} roughness={0.5} />
          </mesh>
          {/* 갓끈: 챙 양옆에서 턱 아래로 (기숙사 색) */}
          {band
            ? [-1, 1].map((s) => (
                <mesh
                  key={s}
                  position={[s * 0.13, 0.11, 0.12]}
                  rotation={[0, 0, -s * 0.296]}
                >
                  <cylinderGeometry args={[0.009, 0.009, 0.48, 6]} />
                  <meshStandardMaterial color={band} roughness={0.6} />
                </mesh>
              ))
            : null}
        </group>
        {/* 실습 중: 오른팔을 앞으로 들어 지팡이를 휘두름 (뒤에서 보는 내 시점에서도 보이도록 어깨 바깥쪽) */}
        {practicing && wand ? (
          <group ref={arm} position={[0.26, 0.82, 0.02]}>
            {/* 도포의 넓은 소매 — 손 쪽으로 갈수록 넓어짐 */}
            <mesh position={[0, 0.15, 0]}>
              <cylinderGeometry args={[0.12, 0.07, 0.3, 12]} />
              <meshStandardMaterial color={robe} roughness={0.9} />
            </mesh>
            {/* 손 */}
            <mesh position={[0, 0.34, 0]}>
              <sphereGeometry args={[0.07, 10, 8]} />
              <meshStandardMaterial color={skin} roughness={0.8} />
            </mesh>
            {/* 지팡이 + 빛나는 끝 */}
            <mesh position={[0, 0.52, 0]}>
              <cylinderGeometry args={[0.015, 0.022, 0.36, 8]} />
              <meshStandardMaterial color={wand.wood} roughness={0.6} />
            </mesh>
            <mesh position={[0, 0.71, 0]}>
              <sphereGeometry args={[0.035, 10, 8]} />
              <meshBasicMaterial color={wand.glow} toneMapped={false} />
            </mesh>
          </group>
        ) : null}
      </group>

      {showLabel ? (
        <Html
          position={[0, 2.05, 0]}
          center
          distanceFactor={7}
          zIndexRange={[10, 0]}
          // drei 타입은 non-null ref를 요구하지만 마운트 전 null은 drei 내부에서 처리된다
          portal={(portal ?? undefined) as RefObject<HTMLElement> | undefined}
        >
          <div style={tagStyle(highlight)} aria-hidden>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--spacing-4)",
              }}
            >
              {houseDot ? (
                <span
                  style={{
                    width: "var(--spacing-8)",
                    height: "var(--spacing-8)",
                    borderRadius: "var(--radius-circle)",
                    background: houseDot,
                  }}
                />
              ) : null}
              {name}
            </span>
            {subject ? (
              <span style={{ font: "var(--text-caption-lg-medium)" }}>
                {subject}
                {pose === "sit"
                  ? practicing
                    ? " · 실습 중"
                    : focusing
                      ? " · 집중 중"
                      : " · 휴식"
                  : ""}
              </span>
            ) : null}
          </div>
        </Html>
      ) : null}
    </group>
  );
});
