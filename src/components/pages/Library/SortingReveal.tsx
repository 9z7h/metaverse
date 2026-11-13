import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { ButtonLarge, ButtonMedium } from "../../ui/Button";
import { HouseCrest } from "./HouseCrest";
import { MagicGat } from "./MagicGat";
import { HOUSES, houseVar } from "./houses";
import type { HouseId } from "./houses";
import { prefersReducedMotion } from "./scene/useReducedMotion";

export interface SortingRevealProps {
  /** 이미 정해진 결과 — 사신갓은 이 기숙사를 외친다 */
  house: HouseId;
  onEnter: () => void;
  /** 갓이 내려와 외치기까지의 길이(ms). 기본 9500. 0이거나 모션 줄이기 설정이면 바로 결과 */
  durationMs?: number;
}

/** 갓이 내려와 외치기까지의 기본 길이 — 두 줄을 여유 있게 읽을 수 있게 */
const DEFAULT_DURATION_MS = 9500;
/** 첫째 줄(갓이 다 내려온 뒤 1초)·둘째 줄(첫째 줄을 3.2초 읽은 뒤)이 나타나는 시점 (전체 길이에 대한 비율) */
const FIRST_LINE_AT = 1000 / DEFAULT_DURATION_MS;
const SECOND_LINE_AT = 4200 / DEFAULT_DURATION_MS;

/** 외치는 순간의 이펙트 키프레임. 색은 `--fx`(기숙사 포인트색 토큰)에서 온다 */
const FX_CSS = `
@keyframes fx-flash { 0% { opacity: 0.9; } 100% { opacity: 0; } }
@keyframes fx-shake {
  0%, 100% { transform: translate(0, 0); }
  15% { transform: translate(-7px, 3px); }
  30% { transform: translate(6px, -4px); }
  45% { transform: translate(-5px, -2px); }
  60% { transform: translate(4px, 3px); }
  80% { transform: translate(-2px, 1px); }
}
@keyframes fx-ring {
  from { transform: scale(0.3); opacity: 0.95; }
  to { transform: scale(3.4); opacity: 0; }
}
@keyframes fx-burst {
  from { transform: rotate(var(--a)) translateX(0) scale(1); opacity: 1; }
  to { transform: rotate(var(--a)) translateX(var(--d)) scale(0.2); opacity: 0; }
}
@keyframes fx-crest {
  0% { transform: scale(0) rotate(-20deg); opacity: 0; }
  55% { transform: scale(1.35) rotate(6deg); opacity: 1; }
  100% { transform: scale(1) rotate(0); opacity: 1; }
}
@keyframes fx-slam {
  0% { transform: scale(2.4); opacity: 0; filter: blur(8px); }
  60% { transform: scale(0.92); opacity: 1; filter: blur(0); }
  80% { transform: scale(1.06); }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes fx-rise {
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: none; }
}
@keyframes fx-drop {
  from { opacity: 0; transform: translateY(-14px); }
  to { opacity: 1; transform: none; }
}
@keyframes fx-gat-out {
  0% { transform: scale(1); opacity: 1; }
  40% { transform: scale(1.5); opacity: 1; }
  100% { transform: scale(1.9); opacity: 0; }
}
.fx-flash { animation: fx-flash 700ms ease-out both; }
.fx-shake { animation: fx-shake 450ms ease-out both; }
.fx-ring { animation: fx-ring 900ms ease-out both; }
.fx-burst { animation: fx-burst 800ms cubic-bezier(0.1, 0.8, 0.3, 1) both; }
.fx-crest { animation: fx-crest 650ms cubic-bezier(0.2, 0.9, 0.3, 1.2) 120ms both; }
.fx-slam { animation: fx-slam 520ms cubic-bezier(0.2, 0.9, 0.3, 1.2) 250ms both; }
.fx-rise { animation: fx-rise 400ms ease-out both; }
.fx-drop { animation: fx-drop 400ms ease-out 150ms both; }
.fx-gat-out { animation: fx-gat-out 380ms ease-out both; }
@media (prefers-reduced-motion: reduce) {
  .fx-flash, .fx-shake, .fx-ring, .fx-burst, .fx-crest, .fx-slam,
  .fx-rise, .fx-drop, .fx-gat-out { animation: none; }
}
`;

/** 튀어 나가는 파편 — 각도와 거리를 미리 정해 항상 같은 모양으로 퍼진다 */
const BURST_DOTS = Array.from({ length: 16 }, (_, i) => ({
  angle: i * (360 / 16) + (i % 2 ? 8 : -8),
  distance: 90 + (i % 3) * 36,
}));

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

  const rootStyle = {
    position: "fixed",
    inset: 0,
    overflow: "hidden",
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
    // 이펙트 색 — CSS 키프레임이 읽는다
    "--fx": houseVar(house, "accent"),
  } as CSSProperties;

  const lineStyle = (visible: boolean): CSSProperties => ({
    margin: 0,
    font: "var(--text-body-lg-regular)",
    color: "var(--color-text-primary)",
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(8px)",
    transition: "opacity 400ms ease-out, transform 400ms ease-out",
    wordBreak: "keep-all",
  });

  const ringStyle = (delay: number): CSSProperties => ({
    position: "absolute",
    width: "calc(var(--spacing-48) * 3.3)",
    height: "calc(var(--spacing-48) * 3.3)",
    borderRadius: "var(--radius-circle)",
    border: "var(--spacing-4) solid var(--fx)",
    boxSizing: "border-box",
    animationDelay: `${delay}ms`,
    pointerEvents: "none",
  });

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label="기숙사 배정"
      className={done && !instant ? "fx-shake" : undefined}
      style={rootStyle}
    >
      <style>{FX_CSS}</style>
      {/* 외치는 순간 기숙사 색 섬광 */}
      {done && !instant ? (
        <div
          aria-hidden
          className="fx-flash"
          style={{
            position: "absolute",
            inset: 0,
            background: "var(--fx)",
            pointerEvents: "none",
          }}
        />
      ) : null}

      {/* 축하는 기숙사가 정해졌을 때 — 자리는 미리 잡아 두어 화면이 밀리지 않게 한다 */}
      <p
        aria-hidden={!done}
        className={done ? "fx-drop" : undefined}
        style={{
          margin: 0,
          font: "var(--text-body-sm-bold)",
          color: "var(--color-text-secondary)",
          opacity: done ? 1 : 0,
        }}
      >
        입학을 축하합니다!
      </p>

      {/* 갓은 내려와 말하다가, 외친 뒤에는 기숙사 문장이 터져 나온다 */}
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
          className={done ? "fx-gat-out" : undefined}
          style={{
            position: "absolute",
            opacity: done ? 0 : 1,
          }}
        >
          <MagicGat
            size={192}
            talking={!done && lines > 0}
            shout={done}
            glow="var(--color-scene-flame)"
          />
        </div>

        {done && !instant ? (
          <div aria-hidden style={{ position: "absolute" }}>
            {[0, 140, 280].map((delay) => (
              <span
                key={delay}
                className="fx-ring"
                style={{
                  ...ringStyle(delay),
                  top: "50%",
                  left: "50%",
                  marginTop: "calc(var(--spacing-48) * -1.65)",
                  marginLeft: "calc(var(--spacing-48) * -1.65)",
                }}
              />
            ))}
            {BURST_DOTS.map((dot) => (
              <span
                key={dot.angle}
                className="fx-burst"
                style={
                  {
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "var(--spacing-8)",
                    height: "var(--spacing-8)",
                    marginTop: "calc(var(--spacing-4) * -1)",
                    marginLeft: "calc(var(--spacing-4) * -1)",
                    borderRadius: "var(--radius-circle)",
                    background: "var(--fx)",
                    "--a": `${dot.angle}deg`,
                    "--d": `${dot.distance}px`,
                  } as CSSProperties
                }
              />
            ))}
          </div>
        ) : null}

        <div
          className={done ? "fx-crest" : undefined}
          style={{
            position: "absolute",
            opacity: done ? 1 : 0,
          }}
        >
          <HouseCrest house={house} size={176} />
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
              className="fx-slam"
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
              className="fx-rise"
              style={{
                margin: 0,
                font: "var(--text-title-sm-bold)",
                color: houseVar(house, "accent"),
                animationDelay: "550ms",
              }}
            >
              ({h.values})
            </p>
            <p
              className="fx-rise"
              style={{
                margin: 0,
                marginTop: "var(--spacing-8)",
                font: "var(--text-body-sm-bold)",
                color: "var(--color-text-secondary)",
                animationDelay: "800ms",
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
          <div
            className="fx-rise"
            style={{ display: "grid", animationDelay: "1000ms" }}
          >
            <ButtonLarge onClick={onEnter}>먹빛각 입장하기</ButtonLarge>
          </div>
        ) : (
          <ButtonMedium style="monolight" onClick={skip}>
            건너뛰기
          </ButtonMedium>
        )}
      </div>
    </section>
  );
}
