import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import type { RefObject } from "react";
import type { CSSProperties } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import {
  Color,
  Float32BufferAttribute,
  QuadraticBezierCurve3,
  SphereGeometry,
  Vector3,
} from "three";
import type { Group } from "three";
import { formatClock } from "../../../ui/FocusTimer";

const mouthCurve = new QuadraticBezierCurve3(
  new Vector3(-0.028, 0.002, 0),
  new Vector3(0, -0.012, 0.005),
  new Vector3(0.028, 0.002, 0),
);

export type AvatarPose = "stand" | "walk" | "sit";

/**
 * 이름표(Html)를 붙일 DOM 컨테이너. 기본값(R3F 내부 노드)에 붙이면 Canvas 언마운트 시
 * R3F가 그 노드를 먼저 지워서 이름표 정리 단계에서 removeChild 에러가 난다.
 * → LibraryWorld가 소유한 div에 붙인다.
 */
export const LabelPortalContext =
  createContext<RefObject<HTMLElement | null> | null>(null);

export interface AvatarProps {
  /** 깃 안감·매듭의 기숙사 primary */
  robe: string;
  /** 고름·세조대 색 (기숙사 accent) */
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
  /** 오늘 누적 공부시간(초) — 있으면 이름표에 시계로 보인다 */
  focusSeconds?: number;
  /** 내 아바타 — 이름표 강조 */
  highlight?: boolean;
  /** 이름표 표시 여부. 기본 true */
  showLabel?: boolean;
  /** 실습(마법) 중 — 지팡이를 들고 휘두르며, 이름표에 "실습 중" 표시 */
  practicing?: boolean;
  /** 지팡이 색 (나무) / 지팡이 끝 빛 — practicing일 때만 사용 */
  wand?: { wood: string; glow: string };
  /** 머리 위 말풍선 (서고의 속삭임). 없으면 그리지 않는다 — 글은 항상 텍스트로만 그린다 */
  bubble?: string;
}

/**
 * 말풍선 모양. 폭은 `max-content`(글 길이만큼)로 두고 `maxWidth`에서만 줄바꿈한다.
 * 주의: `overflow-wrap: anywhere`는 글상자의 "최소 너비"를 글자 하나로 만들어,
 * 자동 너비로 놓이는 이 상자가 한 글자 폭의 세로 줄이 된다 → `break-word`를 쓴다.
 */
export const bubbleStyle: CSSProperties = {
  width: "max-content",
  maxWidth: "calc(var(--spacing-48) * 3)",
  padding: "var(--spacing-8) var(--spacing-12)",
  borderRadius: "var(--radius-xl)",
  background: "var(--color-background-default)",
  color: "var(--color-text-primary)",
  font: "var(--text-body-sm-regular)",
  textAlign: "center",
  whiteSpace: "normal",
  // 한글은 단어 단위로 줄바꿈하되, 띄어쓰기 없는 긴 글도 넘치지 않게
  wordBreak: "keep-all",
  overflowWrap: "break-word",
  pointerEvents: "none",
  userSelect: "none",
};

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
 * 저폴리곤 사신학당 학생 아바타 — 도포(흰 동정·고름·세조대) + 갓.
 * 먹색 겉도포에 기숙사색 깃 안감과 매듭을 더한다. 위치/회전은 부모가 ref로 제어하고,
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
    focusSeconds,
    highlight = false,
    showLabel = true,
    practicing = false,
    wand,
    bubble,
  },
  ref,
) {
  const body = useRef<Group>(null);
  const head = useRef<Group>(null);
  const arm = useRef<Group>(null);
  const leftArm = useRef<Group>(null);
  const coat = useMemo(
    () => new Color(hat).lerp(new Color(robe), 0.16),
    [hat, robe],
  );
  // 흰 동정을 많이 섞으면 창백해진다 — 살구빛이 남도록 살짝만 섞는다
  const face = useMemo(
    () => new Color(skin).lerp(new Color(collar), 0.1),
    [skin, collar],
  );
  // 볼·입·코는 피부색에서 붉게/짙게 비껴 만든다 (색을 따로 쓰지 않고 같은 토큰에서 파생)
  const cheek = useMemo(
    () => new Color(skin).offsetHSL(-0.025, 0.28, -0.06),
    [skin],
  );
  const lip = useMemo(
    () => new Color(skin).offsetHSL(-0.04, 0.3, -0.22),
    [skin],
  );
  const noseTone = useMemo(
    () => new Color(face).offsetHSL(-0.01, 0.06, -0.06),
    [face],
  );
  const eyelidTone = useMemo(
    () => new Color(face).lerp(new Color(lip), 0.24),
    [face, lip],
  );
  // 피부 자체에 홍조를 섞어 별도의 원판 테두리가 드러나지 않게 한다.
  const faceGeometry = useMemo(() => {
    const geometry = new SphereGeometry(0.295, 40, 28);
    const positions = geometry.getAttribute("position");
    const vertexColors = new Float32Array(positions.count * 3);
    const shade = new Color();
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);
      const jaw = Math.max(0, Math.min(1, (-y - 0.06) / 0.23));
      positions.setX(i, x * (1 - jaw * 0.1));
      const cheekDistance =
        ((Math.abs(x) - 0.165) / 0.065) ** 2 + ((y + 0.075) / 0.05) ** 2;
      const blush =
        Math.exp(-cheekDistance * 1.8) * Math.max(0, z / 0.295) * 0.45;
      shade.copy(face).lerp(cheek, blush);
      shade.toArray(vertexColors, i * 3);
    }
    positions.needsUpdate = true;
    geometry.setAttribute("color", new Float32BufferAttribute(vertexColors, 3));
    geometry.computeVertexNormals();
    return geometry;
  }, [face, cheek]);
  useEffect(() => () => faceGeometry.dispose(), [faceGeometry]);
  const trim = band ?? robe;
  const portal = useContext(LabelPortalContext);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (!body.current || !head.current) return;
    if (pose === "walk") {
      body.current.position.y = Math.abs(Math.sin(t * 9)) * 0.06;
      body.current.rotation.z = Math.sin(t * 9) * 0.05;
      body.current.rotation.x = 0;
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
      arm.current.rotation.x = practicing
        ? -1.15 + Math.sin(t * 4) * 0.12
        : pose === "walk"
          ? Math.sin(t * 9) * 0.18
          : pose === "sit"
            ? -0.35
            : 0;
      arm.current.rotation.z = practicing ? -0.25 + Math.cos(t * 4) * 0.15 : 0;
    }
    if (leftArm.current) {
      leftArm.current.rotation.x =
        pose === "walk" ? -Math.sin(t * 9) * 0.18 : pose === "sit" ? -0.35 : 0;
    }
  });

  return (
    <group ref={ref}>
      <group ref={body}>
        {/* 겉도포와 안쪽 저고리. 기숙사색은 안감과 작은 매듭에 쓴다. */}
        <mesh position={[0, 0.79, 0]}>
          <capsuleGeometry args={[0.23, 0.29, 4, 16]} />
          <meshStandardMaterial color={coat} roughness={0.88} />
        </mesh>
        <mesh position={[0, 0.42, 0]}>
          <cylinderGeometry args={[0.235, 0.35, 0.62, 24]} />
          <meshStandardMaterial color={coat} roughness={0.9} />
        </mesh>
        {/* 앞섶의 겹침과 자락 끝의 가는 선 */}
        <mesh position={[0.045, 0.46, 0.275]} rotation={[-0.16, 0, -0.06]}>
          <boxGeometry args={[0.11, 0.55, 0.018]} />
          <meshStandardMaterial
            color={coat.clone().multiplyScalar(1.12)}
            roughness={0.9}
          />
        </mesh>
        <mesh position={[0, 0.119, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.346, 0.008, 4, 32]} />
          <meshStandardMaterial color={trim} roughness={0.85} />
        </mesh>
        {/* 등 쪽 맞주름: 뒤에서 보는 내 캐릭터에도 옷의 구조가 보인다. */}
        {[-1, 1].map((side) => (
          <mesh
            key={`pleat${side}`}
            position={[side * 0.12, 0.43, -0.279]}
            rotation={[0.13, 0, side * 0.1]}
          >
            <boxGeometry args={[0.012, 0.54, 0.014]} />
            <meshStandardMaterial
              color={coat.clone().multiplyScalar(0.65)}
              roughness={1}
            />
          </mesh>
        ))}
        {/* 저고리의 안깃과 그 위에 겹쳐지는 흰 동정 */}
        {[-1, 1].map((side) => (
          <group
            key={`collar${side}`}
            position={[side * 0.062, 0.895, 0.211]}
            rotation={[0, 0, side * -0.46]}
          >
            <mesh>
              <boxGeometry args={[0.088, 0.29, 0.025]} />
              <meshStandardMaterial color={robe} roughness={0.85} />
            </mesh>
            <mesh position={[side * -0.012, 0, 0.016]}>
              <boxGeometry args={[0.034, 0.29, 0.012]} />
              <meshStandardMaterial color={collar} roughness={0.95} />
            </mesh>
          </group>
        ))}
        {/* 고름: 납작한 매듭과 길이가 다른 두 가닥 */}
        <mesh position={[0.105, 0.76, 0.252]}>
          <sphereGeometry args={[0.026, 8, 6]} />
          <meshStandardMaterial color={trim} roughness={0.75} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh
            key={`ribbon${side}`}
            position={[0.105 + side * 0.026, 0.66, 0.26]}
            rotation={[0, 0, side * 0.2]}
          >
            <boxGeometry args={[0.025, side === 1 ? 0.21 : 0.16, 0.012]} />
            <meshStandardMaterial color={trim} roughness={0.85} />
          </mesh>
        ))}
        {/* 세조대와 허리의 작은 매듭 표식 */}
        <mesh position={[0, 0.665, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.24, 0.012, 6, 24]} />
          <meshStandardMaterial color={trim} roughness={0.8} />
        </mesh>
        <group position={[-0.18, 0.58, 0.215]}>
          <mesh rotation={[0, 0, Math.PI / 4]}>
            <torusGeometry args={[0.034, 0.01, 4, 4]} />
            <meshStandardMaterial color={robe} roughness={0.8} />
          </mesh>
          <mesh position={[0, -0.08, 0]}>
            <cylinderGeometry args={[0.012, 0.024, 0.09, 8]} />
            <meshStandardMaterial color={trim} roughness={0.85} />
          </mesh>
        </group>
        {/* 버선과 검은 신발 */}
        {[-1, 1].map((side) => (
          <group key={`shoe${side}`} position={[side * 0.125, 0.065, 0.045]}>
            <mesh position={[0, 0.035, -0.02]}>
              <cylinderGeometry args={[0.06, 0.06, 0.09, 10]} />
              <meshStandardMaterial color={collar} roughness={1} />
            </mesh>
            <mesh scale={[1, 0.5, 1.65]}>
              <sphereGeometry args={[0.085, 12, 8]} />
              <meshStandardMaterial color={hat} roughness={0.75} />
            </mesh>
          </group>
        ))}
        {/* 양팔과 넓은 소매. 실습하는 오른팔은 기존 동작을 유지한다. */}
        {[-1, 1].map((side) => (
          <group
            key={`arm${side}`}
            ref={side === 1 ? arm : leftArm}
            position={[side * 0.255, 0.91, 0]}
          >
            <group rotation={[0, 0, side * 0.17]}>
              <mesh position={[side * 0.034, -0.18, 0]}>
                <cylinderGeometry args={[0.09, 0.132, 0.39, 12]} />
                <meshStandardMaterial color={coat} roughness={0.9} />
              </mesh>
              <mesh position={[side * 0.034, -0.365, 0]}>
                <cylinderGeometry args={[0.134, 0.134, 0.038, 12]} />
                <meshStandardMaterial color={robe} roughness={0.85} />
              </mesh>
              <mesh
                position={[side * 0.034, -0.408, 0.005]}
                scale={[0.8, 1.1, 0.8]}
              >
                <sphereGeometry args={[0.059, 10, 8]} />
                <meshStandardMaterial color={face} roughness={0.85} />
              </mesh>
              {side === 1 && practicing && wand ? (
                <group
                  position={[0.034, -0.42, 0.09]}
                  rotation={[Math.PI / 2, 0, 0]}
                >
                  <mesh position={[0, 0.12, 0]}>
                    <cylinderGeometry args={[0.013, 0.02, 0.36, 8]} />
                    <meshStandardMaterial color={wand.wood} roughness={0.7} />
                  </mesh>
                  <mesh position={[0, 0.31, 0]}>
                    <sphereGeometry args={[0.03, 8, 8]} />
                    <meshBasicMaterial color={wand.glow} toneMapped={false} />
                  </mesh>
                </group>
              ) : null}
            </group>
          </group>
        ))}
        <group ref={head} position={[0, 1.1, 0]}>
          {/* 둥근 얼굴과 머리카락, 귀 */}
          <mesh
            geometry={faceGeometry}
            position={[0, 0.17, 0.012]}
            scale={[1, 0.98, 0.94]}
          >
            <meshStandardMaterial vertexColors roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.195, -0.008]}>
            <sphereGeometry
              args={[0.302, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.46]}
            />
            <meshStandardMaterial color={hat} roughness={0.95} />
          </mesh>
          {[-1, 1].map((side) => (
            <group key={`face${side}`}>
              <mesh position={[side * 0.285, 0.16, 0]} scale={[0.55, 1, 0.7]}>
                <sphereGeometry args={[0.064, 10, 8]} />
                <meshStandardMaterial color={face} roughness={0.9} />
              </mesh>
              <mesh
                position={[side * 0.255, 0.24, 0.07]}
                scale={[0.48, 1, 0.6]}
              >
                <sphereGeometry args={[0.086, 10, 8]} />
                <meshStandardMaterial color={hat} roughness={0.95} />
              </mesh>
              {/* 검정 동그라미 눈과 작은 흰색 하이라이트 */}
              <group
                position={[side * 0.105, 0.162, 0.274]}
                rotation={[0, side * 0.36, side * 0.025]}
              >
                <mesh>
                  <circleGeometry args={[0.029, 24]} />
                  <meshBasicMaterial color={hat} />
                </mesh>
                <mesh position={[-0.008, 0.01, 0.002]}>
                  <circleGeometry args={[0.007, 16]} />
                  <meshBasicMaterial color={collar} toneMapped={false} />
                </mesh>
              </group>
              {/* 귓바퀴 안쪽의 오목한 색면 */}
              <mesh
                position={[side * 0.3, 0.155, 0.034]}
                rotation={[0, side * 0.75, 0]}
                scale={[0.55, 1, 0.2]}
              >
                <sphereGeometry args={[0.034, 12, 10]} />
                <meshStandardMaterial color={eyelidTone} roughness={1} />
              </mesh>
            </group>
          ))}
          {/* 콧대와 코끝, 아랫입술의 볼륨 */}
          <mesh position={[0, 0.113, 0.285]} scale={[0.65, 1.65, 0.45]}>
            <sphereGeometry args={[0.024, 12, 12]} />
            <meshStandardMaterial color={face} roughness={0.95} />
          </mesh>
          <mesh position={[0, 0.082, 0.298]} scale={[0.95, 0.7, 0.75]}>
            <sphereGeometry args={[0.022, 14, 12]} />
            <meshStandardMaterial color={noseTone} roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.027, 0.258]} scale={[1.3, 0.4, 0.25]}>
            <sphereGeometry args={[0.022, 12, 8]} />
            <meshStandardMaterial color={eyelidTone} roughness={1} />
          </mesh>
          <mesh position={[0, 0.038, 0.266]}>
            <tubeGeometry args={[mouthCurve, 14, 0.003, 5, false]} />
            <meshStandardMaterial color={lip} roughness={1} />
          </mesh>
          {/* 갓의 얇은 챙, 원통형 대우와 가는 갓끈 */}
          <mesh position={[0, 0.425, 0]}>
            <cylinderGeometry args={[0.375, 0.385, 0.016, 32]} />
            <meshStandardMaterial color={hat} roughness={0.72} />
          </mesh>
          <mesh position={[0, 0.55, 0]}>
            <cylinderGeometry args={[0.133, 0.153, 0.24, 24]} />
            <meshStandardMaterial color={hat} roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.438, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.153, 0.008, 4, 24]} />
            <meshStandardMaterial color={trim} roughness={0.8} />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh
              key={`gat-string${side}`}
              position={[side * 0.279, 0.16, 0.035]}
              rotation={[0, 0, side * -0.08]}
            >
              <cylinderGeometry args={[0.005, 0.005, 0.48, 6]} />
              <meshStandardMaterial color={hat} roughness={1} />
            </mesh>
          ))}
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
                {pose === "sit"
                  ? practicing
                    ? " · 실습 중"
                    : focusing
                      ? ""
                      : " · 휴식"
                  : ""}
              </span>
            ) : null}
            {focusSeconds !== undefined ? (
              <span
                style={{
                  font: "var(--text-caption-lg-medium)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {formatClock(focusSeconds)}
              </span>
            ) : null}
          </div>
        </Html>
      ) : null}

      {/* 서고의 속삭임: 이름표 위에 잠깐 떠오르는 말풍선 */}
      {bubble ? (
        <Html
          position={[0, 2.75, 0]}
          center
          distanceFactor={7}
          zIndexRange={[11, 1]}
          portal={(portal ?? undefined) as RefObject<HTMLElement> | undefined}
        >
          <div style={bubbleStyle} aria-hidden>
            {bubble}
          </div>
        </Html>
      ) : null}
    </group>
  );
});
