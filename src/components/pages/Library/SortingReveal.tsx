import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { ButtonLarge, ButtonMedium } from "../../ui/Button";
import { HouseCrest } from "./HouseCrest";
import { MagicGat } from "./MagicGat";
import { HOUSES, houseVar } from "./houses";
import type { HouseId } from "./houses";

export interface SortingRevealProps {
  /** 이미 정해진 결과 — 사신갓은 이 기숙사를 외친다 */
  house: HouseId;
  onEnter: () => void;
  /** 갓이 내려와 외치기까지의 길이(ms). 기본 9000. 0이거나 모션 줄이기 설정이면 바로 결과 */
  durationMs?: number;
}

/** 갓이 내려와 외치기까지의 기본 길이 — 두 줄을 여유 있게 읽을 수 있게 */
const DEFAULT_DURATION_MS = 9000;
/** 첫째 줄(갓이 다 내려온 뒤 1초)·둘째 줄(첫째 줄을 3.5초 읽은 뒤)이 나타나는 시점 (전체 길이에 대한 비율) */
const FIRST_LINE_AT = 1000 / DEFAULT_DURATION_MS;
const SECOND_LINE_AT = 4500 / DEFAULT_DURATION_MS;

function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * 기숙사 배정 연출 — 사신갓 의식.
 * 갓이 내려와 학생을 읽어 주는 두 줄을 말하고, 마지막에 기숙사 이름과 가치를 외친다.
 * 결과는 부모가 미리 정해서 넘긴다 (연출과 로직 분리 → 테스트·실시간 연동이 쉬움).
 */
export function SortingReveal({
  house,
  onEnter,
  durationMs = DEFAULT_DURATION_MS,
}: SortingRevealProps) {
  const instant = durationMs <= 0 || prefersReducedMotion();
  /** 말한 줄 수 (0~2). 외침(done)은 따로 */
  const [lines, setLines] = useState(instant ? 2 : 0);
  const [done, setDone] = useState(instant);

  useEffect(() => {
    if (instant) return;
    const timers = [
      window.setTimeout(() => setLines(1), durationMs * FIRST_LINE_AT),
      window.setTimeout(() => setLines(2), durationMs * SECOND_LINE_AT),
      window.setTimeout(() => setDone(true), durationMs),
    ];
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [house, durationMs, instant]);

  const skip = () => {
    setLines(2);
    setDone(true);
  };

  const h = HOUSES[house];

  const rootStyle: CSSProperties = {
    position: "fixed",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "var(--spacing-24)",
    padding: "var(--spacing-24) var(--spacing-20)",
    boxSizing: "border-box",
    textAlign: "center",
    // 외치는 순간 기숙사 색이 번진다 (토큰끼리의 그라데이션)
    background: done
      ? `radial-gradient(circle at 50% 38%, ${houseVar(house, "subtle")} 0%, var(--color-background-default) 62%)`
      : "var(--color-background-default)",
    transition: "background 500ms ease-out",
  };

  const lineStyle = (visible: boolean): CSSProperties => ({
    margin: 0,
    font: "var(--text-body-lg-regular)",
    color: "var(--color-text-primary)",
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(8px)",
    transition: "opacity 400ms ease-out, transform 400ms ease-out",
    wordBreak: "keep-all",
  });

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label="기숙사 배정"
      style={rootStyle}
    >
      <p
        style={{
          margin: 0,
          font: "var(--text-body-sm-bold)",
          color: "var(--color-text-tertiary)",
        }}
      >
        사신학당 입학을 축하합니다
      </p>

      {/* 갓은 내려와 말하다가, 외친 뒤에는 기숙사 문장으로 바뀐다 */}
      <div
        style={{
          position: "relative",
          width: "calc(var(--spacing-48) * 4)",
          height: "calc(var(--spacing-48) * 3.2)",
          display: "grid",
          placeItems: "center",
        }}
      >
        <div
          style={{
            position: "absolute",
            opacity: done ? 0 : 1,
            transform: done ? "translateY(-16px)" : "none",
            transition: "opacity 300ms ease-out, transform 300ms ease-out",
          }}
        >
          <MagicGat
            size={192}
            talking={!done && lines > 0}
            glow="var(--color-scene-flame)"
          />
        </div>
        <div
          style={{
            position: "absolute",
            opacity: done ? 1 : 0,
            transform: done ? "scale(1)" : "scale(0.8)",
            transition: "opacity 400ms ease-out, transform 400ms ease-out",
          }}
        >
          <HouseCrest house={house} size={160} />
        </div>
      </div>

      <div
        aria-live="polite"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--spacing-8)",
          maxWidth: "calc(var(--spacing-48) * 7)",
          minHeight: "calc(var(--spacing-48) * 3)",
          justifyContent: "flex-start",
        }}
      >
        {done ? (
          <>
            {/* "!"는 제목에 넣지 않는다 — 스크린리더와 테스트에서는 이름만 읽힌다 */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "baseline",
                font: "var(--text-display-lg-bold)",
                color: houseVar(house, "accent"),
              }}
            >
              <h1 style={{ margin: 0, font: "inherit", color: "inherit" }}>
                {h.name}
              </h1>
              <span aria-hidden>!</span>
            </div>
            <p
              style={{
                margin: 0,
                font: "var(--text-title-sm-bold)",
                color: houseVar(house, "accent"),
              }}
            >
              ({h.values})
            </p>
            <p
              style={{
                margin: 0,
                marginTop: "var(--spacing-8)",
                font: "var(--text-body-sm-bold)",
                color: "var(--color-text-secondary)",
              }}
            >
              “{h.motto}”
            </p>
          </>
        ) : (
          <>
            <p style={lineStyle(lines >= 1)}>{h.gatLines[0]}</p>
            <p style={lineStyle(lines >= 2)}>{h.gatLines[1]}</p>
          </>
        )}
      </div>

      <div
        style={{
          display: "grid",
          width: "100%",
          maxWidth: "calc(var(--spacing-48) * 8)",
          gap: "var(--spacing-8)",
        }}
      >
        {done ? (
          <ButtonLarge onClick={onEnter}>먹빛각 입장하기</ButtonLarge>
        ) : (
          <ButtonMedium style="monolight" onClick={skip}>
            건너뛰기
          </ButtonMedium>
        )}
      </div>
    </section>
  );
}
