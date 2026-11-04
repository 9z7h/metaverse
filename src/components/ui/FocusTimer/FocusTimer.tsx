import type { CSSProperties } from "react";
import { ButtonLarge } from "../Button";

/** Timer status. `idle` = 시작 전, `running` = 집중 중, `paused` = 일시정지. */
export type FocusTimerStatus = "idle" | "running" | "paused";

export interface FocusTimerProps {
  /** Session length in seconds (e.g. 25분 = 1500). */
  totalSeconds: number;
  /** Seconds left in the current session. */
  remainingSeconds: number;
  /** Current status. Defaults to `idle`. */
  status?: FocusTimerStatus;
  /** Caption above the clock, e.g. the subject. */
  label?: string;
  /** Start or resume. */
  onStart?: () => void;
  /** Pause a running session. */
  onPause?: () => void;
  /** Reset to `totalSeconds`. */
  onReset?: () => void;
  /** Extra class forwarded to the root element. */
  className?: string;
}

/** Formats seconds as `MM:SS`. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
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

const actionsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: "var(--spacing-8)",
  width: "100%",
};

const PRIMARY_LABEL: Record<FocusTimerStatus, string> = {
  idle: "집중 시작",
  running: "일시정지",
  paused: "계속하기",
};

/**
 * Circular focus (pomodoro) timer. Controlled: the parent owns the clock and
 * passes `remainingSeconds` / `status`; this component only renders progress
 * and exposes start/pause/reset through the design-system `ButtonLarge`.
 */
export function FocusTimer({
  totalSeconds,
  remainingSeconds,
  status = "idle",
  label,
  onStart,
  onPause,
  onReset,
  className,
}: FocusTimerProps) {
  const progress =
    totalSeconds > 0
      ? Math.min(1, Math.max(0, 1 - remainingSeconds / totalSeconds))
      : 0;
  const clock = formatClock(remainingSeconds);
  const isPristine = status === "idle" && remainingSeconds === totalSeconds;

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
            style={{ transition: "stroke-dashoffset 1s linear" }}
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
            aria-label={`남은 시간 ${clock}`}
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
            {status === "running"
              ? "집중 중"
              : status === "paused"
                ? "잠시 멈춤"
                : "준비"}
          </span>
        </div>
      </div>

      <div style={actionsStyle}>
        <ButtonLarge
          style={status === "running" ? "monolight" : "core"}
          onClick={status === "running" ? onPause : onStart}
        >
          {PRIMARY_LABEL[status]}
        </ButtonLarge>
        <ButtonLarge style="outline" onClick={onReset} disabled={isPristine}>
          초기화
        </ButtonLarge>
      </div>
    </div>
  );
}
