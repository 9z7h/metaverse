import type { CSSProperties, MouseEventHandler } from "react";
import { ButtonSmall } from "../Button";
import { Chip } from "../Chip";
import { Icon } from "../Icon";

/** Seat state. `empty` = 빈 자리, `occupied` = 다른 학생, `mine` = 내 자리. */
export type StudySeatState = "empty" | "occupied" | "mine";

export interface StudySeatProps {
  /** Seat state. Defaults to `empty`. */
  state?: StudySeatState;
  /** Seat label shown on every state, e.g. `A-3`. */
  seatLabel: string;
  /** Student name (occupied / mine). */
  name?: string;
  /** Subject the student is studying (occupied / mine). */
  subject?: string;
  /** Accumulated focus time today, in minutes (occupied / mine). */
  focusMinutes?: number;
  /** Whether the student is currently in a focus session. Shows a live indicator. */
  focusing?: boolean;
  /** Called when the user picks this seat. Only rendered for `empty`. */
  onSelect?: MouseEventHandler<HTMLButtonElement>;
  /** Extra class forwarded to the root element. */
  className?: string;
}

/** Formats minutes as `1시간 5분` / `25분`. */
export function formatFocusMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}분`;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

const rootBase: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--spacing-12)",
  minWidth: 0,
  padding: "var(--spacing-16)",
  borderRadius: "var(--radius-lg)",
  borderWidth: "1px",
  borderStyle: "solid",
  boxSizing: "border-box",
};

const STATE_STYLE: Record<StudySeatState, CSSProperties> = {
  empty: {
    background: "transparent",
    borderColor: "var(--color-border-default)",
    borderStyle: "dashed",
  },
  occupied: {
    background: "var(--color-background-Subtle)",
    borderColor: "transparent",
  },
  mine: {
    background: "var(--color-background-brandsubtle)",
    borderColor: "var(--color-border-brand)",
  },
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "var(--spacing-8)",
};

const seatLabelStyle: CSSProperties = {
  font: "var(--text-caption-lg-medium)",
  color: "var(--color-text-tertiary)",
};

const avatarStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  width: "var(--spacing-40)",
  height: "var(--spacing-40)",
  borderRadius: "var(--radius-circle)",
  background: "var(--color-background-muted)",
  color: "var(--color-content-strong)",
  font: "var(--text-body-sm-bold)",
};

const nameStyle: CSSProperties = {
  font: "var(--text-body-sm-bold)",
  color: "var(--color-text-primary)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const metaStyle: CSSProperties = {
  font: "var(--text-caption-lg-medium)",
  color: "var(--color-text-secondary)",
};

const liveDotStyle: CSSProperties = {
  width: "var(--spacing-8)",
  height: "var(--spacing-8)",
  borderRadius: "var(--radius-circle)",
  background: "var(--color-interactive-primary)",
};

/**
 * A seat in the study hall. Shows who is sitting there, what they study and
 * how long they've focused today. Empty seats expose a `ButtonSmall` to sit.
 * The card itself is non-interactive — the only action is the explicit button.
 */
export function StudySeat({
  state = "empty",
  seatLabel,
  name,
  subject,
  focusMinutes = 0,
  focusing = false,
  onSelect,
  className,
}: StudySeatProps) {
  const isEmpty = state === "empty";
  const displayName = state === "mine" ? (name ? `${name} (나)` : "나") : name;

  return (
    <div
      className={className}
      style={{ ...rootBase, ...STATE_STYLE[state] }}
      data-state={state}
      aria-label={
        isEmpty
          ? `${seatLabel} 빈 자리`
          : `${seatLabel} ${displayName}, ${subject ?? ""} ${focusing ? "집중 중" : "휴식 중"}`
      }
      role="group"
    >
      <div style={headerStyle}>
        <span style={seatLabelStyle}>{seatLabel}</span>
        {!isEmpty && focusing ? (
          <span style={liveDotStyle} data-testid="focus-indicator" />
        ) : null}
      </div>

      {isEmpty ? (
        <>
          <span style={metaStyle}>빈 자리</span>
          <ButtonSmall style="corelight" onClick={onSelect}>
            여기 앉기
          </ButtonSmall>
        </>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--spacing-8)",
              minWidth: 0,
            }}
          >
            <span style={avatarStyle} aria-hidden>
              {name ? name.slice(0, 1) : <Icon name="user" size={20} />}
            </span>
            <span style={nameStyle}>{displayName}</span>
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "var(--spacing-8)",
            }}
          >
            {subject ? <Chip>{subject}</Chip> : null}
            <span style={metaStyle}>{formatFocusMinutes(focusMinutes)}</span>
          </div>
        </>
      )}
    </div>
  );
}
