import { useLayoutEffect } from "react";
import type { CSSProperties, RefObject } from "react";

const OFFSET = { x: 16, y: 20 } as const;

const labelStyle: CSSProperties = {
  position: "fixed",
  left: 0,
  top: 0,
  zIndex: 5,
  padding: "var(--spacing-6) var(--spacing-12)",
  borderRadius: "var(--radius-circle)",
  background: "var(--color-background-Subtle)",
  font: "var(--text-caption-lg-medium)",
  color: "var(--color-text-primary)",
  whiteSpace: "nowrap",
  pointerEvents: "none",
};

/** 마우스 위치(화면 좌표) 곁으로 라벨을 옮긴다. 매 움직임마다 다시 그리지 않으려고 DOM을 직접 만진다 */
export function moveDoorLabel(
  el: HTMLElement | null,
  clientX: number,
  clientY: number,
) {
  if (el)
    el.style.transform = `translate(${clientX + OFFSET.x}px, ${clientY + OFFSET.y}px)`;
}

export interface DoorHoverLabelProps {
  /** 문 위에서 보여 줄 글 — 예: "정원으로 나가기" */
  label: string;
  /** 라벨 요소 — 마우스가 움직일 때 `moveDoorLabel`로 옮긴다 */
  labelRef: RefObject<HTMLDivElement | null>;
  /** 라벨이 처음 나타날 때의 마우스 위치 */
  at: { x: number; y: number };
}

/** 문에 마우스를 올렸을 때 커서를 따라다니는 안내. 클릭은 가로채지 않는다 */
export function DoorHoverLabel({ label, labelRef, at }: DoorHoverLabelProps) {
  useLayoutEffect(() => {
    moveDoorLabel(labelRef.current, at.x, at.y);
    // 나타나는 순간 한 번만 제자리를 잡는다
  }, []);
  return (
    <div ref={labelRef} aria-hidden="true" style={labelStyle}>
      {label}
    </div>
  );
}
