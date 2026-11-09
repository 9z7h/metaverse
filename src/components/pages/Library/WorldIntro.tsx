import { useState } from "react";
import type { CSSProperties } from "react";
import { ButtonSmall } from "../../ui/Button";
import { HouseCrest } from "./HouseCrest";
import { HOUSES, HOUSE_IDS } from "./houses";

/**
 * 입구의 세계관 소개 — 사신학당이 어떤 곳인지 세 장으로 알려 준다.
 * 문구는 `docs/world.md`의 설정만 쓴다.
 */
interface IntroCard {
  title: string;
  body: string;
  /** 네 기숙사 문장을 함께 보여 줄지 */
  crests?: boolean;
}

export const INTRO_CARDS: readonly IntroCard[] = [
  {
    title: "숨은골의 사신학당",
    body: "사람과 신령, 땅 사이의 약속을 배우는 한국의 마법학교예요. 세계의 열두 공인 학교 중 열두 번째로, 붓으로 조건을 남기는 기록술을 익혀요.",
  },
  {
    title: "네 개의 사방재",
    body: "수련생은 네 기숙사 중 한 곳에서 지내요. 재능이나 혈통이 아니라, 마법의 힘으로 무엇을 지키려 하는가로 나뉘어요.",
    crests: true,
  },
  {
    title: "먹빛각에서 함께 수련",
    body: "달빛이 드는 긴 서고에서 수련생들과 나란히 앉아 집중해요. 쌓인 수련 시간은 벽의 두루마리에 기숙사별로 걸려요.",
  },
];

export interface WorldIntroProps {
  /** 처음 열릴 때 펼쳐 둘지 (첫 입장이면 true) */
  initialOpen?: boolean;
}

const captionStyle: CSSProperties = {
  margin: 0,
  font: "var(--text-caption-lg-medium)",
  color: "var(--color-text-secondary)",
};

export function WorldIntro({ initialOpen = false }: WorldIntroProps) {
  const [open, setOpen] = useState(initialOpen);
  const [index, setIndex] = useState(0);

  if (!open) {
    return (
      <div style={{ alignSelf: "flex-start" }}>
        <ButtonSmall
          style="monolight"
          aria-expanded={false}
          onClick={() => {
            setIndex(0);
            setOpen(true);
          }}
        >
          학당 소개 보기
        </ButtonSmall>
      </div>
    );
  }

  const card = INTRO_CARDS[index];
  const last = index === INTRO_CARDS.length - 1;

  return (
    <section
      aria-label="학당 소개"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--spacing-12)",
        padding: "var(--spacing-16)",
        borderRadius: "var(--radius-lg)",
        background: "var(--color-background-Subtle)",
        border: "1px solid var(--color-border-default)",
      }}
    >
      <p style={captionStyle} aria-live="polite">
        학당 소개 {index + 1} / {INTRO_CARDS.length}
      </p>
      {card.crests ? (
        <div style={{ display: "flex", gap: "var(--spacing-12)" }}>
          {HOUSE_IDS.map((id) => (
            <div
              key={id}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "var(--spacing-4)",
              }}
            >
              <HouseCrest house={id} size={44} aria-hidden />
              <span style={captionStyle}>{HOUSES[id].name}</span>
            </div>
          ))}
        </div>
      ) : null}
      <h2
        style={{
          margin: 0,
          font: "var(--text-body-lg-bold)",
          color: "var(--color-text-primary)",
        }}
      >
        {card.title}
      </h2>
      <p
        style={{
          margin: 0,
          font: "var(--text-body-sm-regular)",
          color: "var(--color-text-secondary)",
        }}
      >
        {card.body}
      </p>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--spacing-8)",
        }}
      >
        <ButtonSmall style="monolight" onClick={() => setOpen(false)}>
          접기
        </ButtonSmall>
        <div style={{ display: "flex", gap: "var(--spacing-8)" }}>
          <ButtonSmall
            style="monolight"
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
          >
            이전
          </ButtonSmall>
          <ButtonSmall
            onClick={() => (last ? setOpen(false) : setIndex((i) => i + 1))}
          >
            {last ? "알겠어요" : "다음"}
          </ButtonSmall>
        </div>
      </div>
    </section>
  );
}
