import type { CSSProperties } from "react";
import { ButtonLarge } from "../Button";

/** Timer status. `idle` = 오늘 아직 시작 전, `running` = 집중 중, `paused` = 잠시 멈춤. */
export type FocusTimerStatus = "idle" | "running" | "paused";

export interface FocusTimerProps {
  /** 누적 집중 시간(초). 멈췄다 다시 시작해도 이어서 쌓인다. */
  elapsedSeconds: number;
  /** Current status. Defaults to `idle`. */
  status?: FocusTimerStatus;
  /** Caption above the clock, e.g. the subject. */
  label?: string;
  /** Start or resume. */
  onStart?: () => void;
  /** Pause a running session. */
  onPause?: () => void;
  /** Extra class forwarded to the root element. */
  className?: string;
}

/** 초 → `MM:SS`, 1시간 이상이면 `H:MM:SS`. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** 링 진행률 — 1시간마다 한 바퀴 (0~1) */
export function hourProgress(seconds: number): number {
  return (Math.max(0, seconds) % 3600) / 3600;
}

// SVG 좌표계(viewBox 0 0 120 120) 안의 값 — 렌더 크기는 CSS로 조절된다.
const VIEWBOX = 120;
const STROKE = 6;
const RADIUS = (VIEWBOX - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const rootStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "var(--spacing-24)",
  width: "100%",
};

const dialStyle: CSSProperties = {
  position: "relative",
  width: "100%",
  maxWidth: "calc(var(--spacing-64) * 4)",
  aspectRatio: "1 / 1",
};

const centerStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "var(--spacing-4)",
};

export const PRIMARY_LABEL: Record<FocusTimerStatus, string> = {
  idle: "집중 시작",
  running: "일시정지",
  paused: "계속하기",
};

const STATUS_LABEL: Record<FocusTimerStatus, string> = {
  idle: "오늘의 첫 집중",
  running: "집중 중",
  paused: "잠시 멈춤",
};

/**
 * 누적 집중 스톱워치. Controlled: 부모가 `elapsedSeconds`와 `status`를 넘기고,
 * 이 컴포넌트는 표시와 시작/일시정지 버튼(디자인 시스템 `ButtonLarge`)만 담당한다.
 * 링은 1시간마다 한 바퀴 채워진다.
 */
export function FocusTimer({
  elapsedSeconds,
  status = "idle",
  label,
  onStart,
  onPause,
  className,
}: FocusTimerProps) {
  const progress = hourProgress(elapsedSeconds);
  const clock = formatClock(elapsedSeconds);

  return (
    <div className={className} style={rootStyle}>
      <div style={dialStyle}>
        <svg
          viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
          width="100%"
          height="100%"
          aria-hidden
          style={{ transform: "rotate(-90deg)" }}
        >
          <circle
            cx={VIEWBOX / 2}
            cy={VIEWBOX / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--color-background-muted)"
            strokeWidth={STROKE}
          />
          <circle
            data-testid="focus-timer-progress"
            cx={VIEWBOX / 2}
            cy={VIEWBOX / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--color-interactive-primary)"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
          />
        </svg>
        <div style={centerStyle}>
          {label ? (
            <span
              style={{
                font: "var(--text-body-sm-regular)",
                color: "var(--color-text-secondary)",
              }}
            >
              {label}
            </span>
          ) : null}
          <span
            role="timer"
            aria-label={`오늘 누적 집중 ${clock}`}
            style={{
              font: "var(--text-display-lg-bold)",
              color: "var(--color-text-primary)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {clock}
          </span>
          <span
            style={{
              font: "var(--text-caption-lg-medium)",
              color: "var(--color-text-tertiary)",
            }}
          >
            {STATUS_LABEL[status]}
          </span>
        </div>
      </div>

      <div style={{ display: "grid", width: "100%" }}>
        <ButtonLarge
          style={status === "running" ? "monolight" : "core"}
          onClick={status === "running" ? onPause : onStart}
        >
          {PRIMARY_LABEL[status]}
        </ButtonLarge>
      </div>
    </div>
  );
}
