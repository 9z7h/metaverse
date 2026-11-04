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
  robe: string;
  /** 모자 띠 색 (기숙사 accent) */
  band?: string;
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
 * 저폴리곤 마법사 아바타 (로브 + 머리 + 고깔모자). 위치/회전은 부모가 ref로 제어하고,
 * 여기서는 포즈별 미세 애니메이션(걷기 흔들림, 집중 끄덕임)만 처리한다.
 */
export const Avatar = forwardRef<Group, AvatarProps>(function Avatar(
  {
    robe,
    band,
    houseDot,
    skin,
    hat,
    pose,
    focusing = false,
    name,
    subject,
    highlight = false,
    showLabel = true,
  },
  ref,
) {
  const body = useRef<Group>(null);
  const head = useRef<Group>(null);
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
    } else {
      body.current.position.y = Math.sin(t * 2) * 0.01;
      body.current.rotation.set(0, 0, 0);
      head.current.rotation.x = 0;
    }
  });

  return (
    <group ref={ref}>
      <group ref={body}>
        {/* 로브 */}
        <mesh position={[0, 0.55, 0]}>
          <capsuleGeometry args={[0.28, 0.5, 4, 12]} />
          <meshStandardMaterial color={robe} roughness={0.9} />
        </mesh>
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
          {/* 모자 챙 + 고깔 */}
          <mesh position={[0, 0.3, 0]}>
            <cylinderGeometry args={[0.36, 0.36, 0.03, 20]} />
            <meshStandardMaterial color={hat} roughness={0.7} />
          </mesh>
          {band ? (
            <mesh position={[0, 0.37, -0.01]} rotation={[-0.18, 0, 0]}>
              <cylinderGeometry args={[0.205, 0.215, 0.07, 16]} />
              <meshStandardMaterial color={band} roughness={0.6} />
            </mesh>
          ) : null}
          <mesh position={[0, 0.56, -0.03]} rotation={[-0.18, 0, 0]}>
            <coneGeometry args={[0.22, 0.52, 16]} />
            <meshStandardMaterial color={hat} roughness={0.7} />
          </mesh>
        </group>
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
                {pose === "sit" ? (focusing ? " · 집중 중" : " · 휴식") : ""}
              </span>
            ) : null}
          </div>
        </Html>
      ) : null}
    </group>
  );
});
