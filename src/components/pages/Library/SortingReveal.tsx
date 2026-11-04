import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { ButtonLarge } from "../../ui/Button";
import { HouseCrest } from "./HouseCrest";
import { HOUSES, HOUSE_IDS, houseVar } from "./houses";
import type { HouseId } from "./houses";

export interface SortingRevealProps {
  /** 이미 정해진 결과 — 연출은 이 기숙사에서 멈춘다 */
  house: HouseId;
  onEnter: () => void;
  /** 연출 길이(ms). 기본 1800. 모션 줄이기 설정이면 0으로 처리 */
  durationMs?: number;
}

function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * 기숙사 배정 연출. 네 기숙사 문장이 점점 느려지며 번갈아 보이다가 결과에서 멈춘다.
 * 결과는 부모가 미리 정해서 넘긴다 (연출과 로직 분리 → 테스트·실시간 연동이 쉬움).
 */
export function SortingReveal({
  house,
  onEnter,
  durationMs = 1800,
}: SortingRevealProps) {
  const instant = durationMs <= 0 || prefersReducedMotion();
  const [shown, setShown] = useState<HouseId>(instant ? house : HOUSE_IDS[0]);
  const [done, setDone] = useState(instant);

  useEffect(() => {
    if (instant) return;
    // 감속: 간격이 70ms → 약 300ms로 늘어남
    const timers: number[] = [];
    let t = 0;
    let i = 0;
    while (t < durationMs) {
      const delay = 70 + (t / durationMs) ** 2 * 230;
      t += delay;
      const idx = i++;
      timers.push(
        window.setTimeout(() => setShown(HOUSE_IDS[idx % HOUSE_IDS.length]), t),
      );
    }
    timers.push(
      window.setTimeout(() => {
        setShown(house);
        setDone(true);
      }, t + 120),
    );
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [house, durationMs, instant]);

  const h = HOUSES[shown];

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
    // 기숙사 색이 은은하게 번지는 배경 (토큰끼리의 그라데이션)
    background: `radial-gradient(circle at 50% 38%, ${houseVar(shown, "subtle")} 0%, var(--color-background-default) 62%)`,
    transition: "background 200ms linear",
  };

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
        한울 마법학당 입학을 축하합니다
      </p>

      <HouseCrest
        house={shown}
        size={160}
        style={{
          transform: done ? "scale(1)" : "scale(0.9)",
          transition: "transform 300ms ease-out",
        }}
      />

      <div
        aria-live="polite"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--spacing-8)",
        }}
      >
        {done ? (
          <>
            <p
              style={{
                margin: 0,
                font: "var(--text-body-lg-regular)",
                color: "var(--color-text-secondary)",
              }}
            >
              당신의 기숙사는
            </p>
            <h1
              style={{
                margin: 0,
                font: "var(--text-display-lg-bold)",
                color: houseVar(house, "accent"),
              }}
            >
              {h.name}
            </h1>
            <p
              style={{
                margin: 0,
                font: "var(--text-body-sm-bold)",
                color: houseVar(house, "accent"),
              }}
            >
              {h.creature} · {h.trait}
            </p>
            <p
              style={{
                margin: 0,
                font: "var(--text-body-sm-regular)",
                color: "var(--color-text-secondary)",
              }}
            >
              {h.welcome}
            </p>
          </>
        ) : (
          <p
            style={{
              margin: 0,
              font: "var(--text-title-sm-bold)",
              color: "var(--color-text-primary)",
            }}
          >
            기숙사를 정하는 중…
          </p>
        )}
      </div>

      <div
        style={{
          display: "grid",
          width: "100%",
          maxWidth: "calc(var(--spacing-48) * 8)",
          visibility: done ? "visible" : "hidden",
        }}
      >
        <ButtonLarge onClick={onEnter} disabled={!done}>
          장서각 입장하기
        </ButtonLarge>
      </div>
    </section>
  );
}
