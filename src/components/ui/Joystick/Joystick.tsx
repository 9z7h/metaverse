import { useRef, useState } from "react";
import type { CSSProperties, PointerEvent } from "react";

export interface JoystickVector {
  /** -1(왼쪽) ~ 1(오른쪽) */
  x: number;
  /** -1(위) ~ 1(아래) — 화면 좌표 기준 */
  y: number;
}

export interface JoystickProps {
  /** 드래그 중 매 이동마다 호출. 길이는 0~1로 정규화된다. */
  onMove?: (vector: JoystickVector) => void;
  /** 손을 떼면 호출 (벡터는 0,0으로 돌아간다). */
  onEnd?: () => void;
  /** 스크린리더용 이름. */
  "aria-label"?: string;
  /** Extra class forwarded to the root element. */
  className?: string;
}

const ZERO: JoystickVector = { x: 0, y: 0 };
/** 레이아웃 측정이 불가능한 환경(jsdom 등)에서 쓰는 기본 반지름(px) — base 지름 112px의 절반 */
const FALLBACK_RADIUS = 56;

/** 중심 기준 오프셋을 반지름으로 나눠 길이 ≤ 1 벡터로 만든다. */
export function toJoystickVector(
  dx: number,
  dy: number,
  radius: number,
): JoystickVector {
  if (!(radius > 0) || !Number.isFinite(dx) || !Number.isFinite(dy))
    return ZERO;
  const x = dx / radius;
  const y = dy / radius;
  const len = Math.hypot(x, y);
  return len > 1 ? { x: x / len, y: y / len } : { x, y };
}

const baseStyle: CSSProperties = {
  position: "relative",
  width: "calc(var(--spacing-64) + var(--spacing-48))",
  height: "calc(var(--spacing-64) + var(--spacing-48))",
  borderRadius: "var(--radius-circle)",
  background: "var(--color-background-Subtle)",
  border: "1px solid var(--color-border-default)",
  touchAction: "none",
  userSelect: "none",
  opacity: 0.9,
};

const knobBase: CSSProperties = {
  position: "absolute",
  top: "50%",
  left: "50%",
  width: "var(--spacing-48)",
  height: "var(--spacing-48)",
  marginTop: "calc(var(--spacing-24) * -1)",
  marginLeft: "calc(var(--spacing-24) * -1)",
  borderRadius: "var(--radius-circle)",
  background: "var(--color-interactive-primary)",
  pointerEvents: "none",
};

/**
 * 모바일 가상 조이스틱. 터치/마우스 공통(Pointer Events)이며 화면 좌표 기준
 * 정규화 벡터를 내보낸다. 키보드 사용자를 위한 대체 입력(WASD/방향키)은
 * 조이스틱을 쓰는 화면에서 따로 제공해야 한다.
 */
export function Joystick({
  onMove,
  onEnd,
  "aria-label": ariaLabel = "이동 조이스틱",
  className,
}: JoystickProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState<JoystickVector>(ZERO);
  const activePointer = useRef<number | null>(null);

  const update = (e: PointerEvent<HTMLDivElement>) => {
    const rect = rootRef.current?.getBoundingClientRect();
    const radius = rect && rect.width > 0 ? rect.width / 2 : FALLBACK_RADIUS;
    const cx = rect && rect.width > 0 ? rect.left + radius : 0;
    const cy = rect && rect.height > 0 ? rect.top + radius : 0;
    const v = toJoystickVector(e.clientX - cx, e.clientY - cy, radius);
    setKnob(v);
    onMove?.(v);
  };

  const end = () => {
    activePointer.current = null;
    setKnob(ZERO);
    onEnd?.();
  };

  return (
    <div
      ref={rootRef}
      className={className}
      style={baseStyle}
      role="application"
      aria-label={ariaLabel}
      data-testid="joystick"
      onPointerDown={(e) => {
        activePointer.current = e.pointerId;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        update(e);
      }}
      onPointerMove={(e) => {
        if (activePointer.current === e.pointerId) update(e);
      }}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <span
        data-testid="joystick-knob"
        style={{
          ...knobBase,
          // 노브 이동 거리 = 반지름 - 노브 반지름 (56 - 24 = 32px = spacing-32)
          transform: `translate(calc(var(--spacing-32) * ${knob.x}), calc(var(--spacing-32) * ${knob.y}))`,
        }}
      />
    </div>
  );
}
