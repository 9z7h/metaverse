import type { CSSProperties } from "react";
import { HouseCrest } from "./HouseCrest";
import { HOUSES, houseVar } from "./houses";
import type { HouseId } from "./houses";
import { formatTotal } from "./houseRanking";
import type { RankEntry } from "./houseRanking";

export interface HouseRankingProps {
  /** 순위 순서로 정렬된 기숙사별 합계 (`rankHouses` 결과) */
  entries: RankEntry[];
  /** 내 기숙사 — 강조하고 "내 기숙사" 표시 */
  myHouse: HouseId | null;
  /** 있으면 제목(h2)을 보여줌 */
  title?: string;
  /** 제목 아래 설명 */
  caption?: string;
  /** 접근성 이름 (제목이 없을 때) */
  "aria-label"?: string;
}

const listStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--spacing-8)",
  listStyle: "none",
  margin: 0,
  padding: 0,
};

/**
 * 사신제 — 기숙사별 오늘 집중 시간 합계 순위.
 * 막대 길이는 1위 대비 비율이고, 막대는 장식(aria-hidden)이라
 * 스크린리더는 "1위 청룡관 3시간 20분, 내 기숙사"처럼 한 줄로 읽는다.
 */
export function HouseRanking({
  entries,
  myHouse,
  title,
  caption,
  "aria-label": ariaLabel,
}: HouseRankingProps) {
  const max = Math.max(1, ...entries.map((e) => e.seconds));

  return (
    <section
      aria-labelledby={title ? "house-ranking-title" : undefined}
      aria-label={title ? undefined : (ariaLabel ?? "기숙사 순위")}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--spacing-12)",
      }}
    >
      {title ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--spacing-2)",
          }}
        >
          <h2
            id="house-ranking-title"
            style={{
              margin: 0,
              font: "var(--text-title-sm-bold)",
              color: "var(--color-text-primary)",
            }}
          >
            {title}
          </h2>
          {caption ? (
            <p
              style={{
                margin: 0,
                font: "var(--text-caption-lg-medium)",
                color: "var(--color-text-tertiary)",
              }}
            >
              {caption}
            </p>
          ) : null}
        </div>
      ) : null}

      <ol style={listStyle}>
        {entries.map((e) => {
          const mine = e.house === myHouse;
          const name = HOUSES[e.house].name;
          return (
            <li
              key={e.house}
              aria-label={`${e.rank}위 ${name} ${formatTotal(e.seconds)}${mine ? ", 내 기숙사" : ""}`}
              style={{
                display: "grid",
                gridTemplateColumns:
                  "var(--spacing-24) var(--spacing-32) minmax(0, 1fr)",
                alignItems: "center",
                columnGap: "var(--spacing-8)",
                padding: "var(--spacing-8) var(--spacing-12)",
                borderRadius: "var(--radius-lg)",
                background: mine
                  ? houseVar(e.house, "subtle")
                  : "var(--color-background-Subtle)",
                border: mine
                  ? `1px solid ${houseVar(e.house, "accent")}`
                  : "1px solid transparent",
              }}
            >
              <span
                aria-hidden
                style={{
                  font: "var(--text-body-sm-bold)",
                  color: "var(--color-text-secondary)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {e.rank}
              </span>
              <HouseCrest house={e.house} size={32} aria-hidden />
              <div
                aria-hidden
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--spacing-4)",
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "var(--spacing-8)",
                    font: "var(--text-caption-lg-bold)",
                    color: houseVar(e.house, "accent"),
                  }}
                >
                  <span>
                    {name}
                    {mine ? " · 내 기숙사" : ""}
                  </span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    {formatTotal(e.seconds)}
                  </span>
                </div>
                <div
                  style={{
                    height: "var(--spacing-6)",
                    borderRadius: "var(--radius-circle)",
                    background: "var(--color-background-muted)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${(e.seconds / max) * 100}%`,
                      background: houseVar(e.house, "primary"),
                      transition: "width 1s linear",
                    }}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
