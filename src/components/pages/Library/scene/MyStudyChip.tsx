import type { CSSProperties } from "react";
import { formatClock } from "../../../ui/FocusTimer";

const chipStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--spacing-8)",
  padding: "var(--spacing-6) var(--spacing-12)",
  borderRadius: "var(--radius-circle)",
  background: "var(--color-background-Subtle)",
  font: "var(--text-caption-lg-medium)",
  color: "var(--color-text-secondary)",
  whiteSpace: "nowrap",
};

const clockStyle: CSSProperties = {
  color: "var(--color-text-primary)",
  fontVariantNumeric: "tabular-nums",
};

export interface MyStudyChipProps {
  /** 오늘 누적 수련 시간(초) */
  todaySeconds: number;
}

/** 나만 보는 오늘 누적 수련 시간 칩. 앉아 있어도 오늘 누적이고, 다른 사람에게는 보내지 않는다. */
export function MyStudyChip({ todaySeconds }: MyStudyChipProps) {
  const clock = formatClock(todaySeconds);
  return (
    <span
      style={chipStyle}
      role="status"
      aria-label={`오늘 수련 시간 ${clock}`}
    >
      오늘 수련 시간
      <span style={clockStyle}>{clock}</span>
    </span>
  );
}
