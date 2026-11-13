import type { CSSProperties } from "react";
import { ButtonSmall } from "../../../ui/Button";
import {
  SPELLS,
  SPELL_ORDER,
  formatRemaining,
  isUnlocked,
  secondsToUnlock,
} from "./spellLogic";
import type { SpellId } from "./spellLogic";

const barStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "center",
  gap: "var(--spacing-8)",
  pointerEvents: "auto",
};

export interface SpellBarProps {
  onCast: (spell: SpellId) => void;
  /** 쿨다운 등으로 잠깐 쓸 수 없을 때 */
  disabled?: boolean;
  lightOn?: boolean;
  cooldowns?: Partial<Record<SpellId, number>>;
  /** 누적 수련 시간(초). 모자라는 주문은 잠긴 칩으로 보인다 */
  totalSeconds?: number;
}

/** 명경과 묵령은 하나의 불빛 토글로 표시한다. */
export function SpellBar({
  onCast,
  disabled = false,
  lightOn = false,
  cooldowns = {},
  totalSeconds = 0,
}: SpellBarProps) {
  return (
    <div role="group" aria-label="주문" style={barStyle}>
      {SPELL_ORDER.filter((id) => id !== "mukryeong").map((id) => {
        const remaining = cooldowns[id] ?? 0;
        const waiting = remaining > 0;
        const label =
          id === "myeonggyeong"
            ? lightOn
              ? "묵령 · 끄기"
              : "명경 · 켜기"
            : SPELLS[id].name;
        const seconds = Math.ceil(remaining / 1000);
        if (!isUnlocked(id, totalSeconds)) {
          return (
            <ButtonSmall
              key={id}
              style="monolight"
              disabled
              aria-label={`${SPELLS[id].name}, ${SPELLS[id].hint}, 수련 시간 ${formatRemaining(secondsToUnlock(id, totalSeconds))}을 더 채우면 풀립니다`}
            >
              {`${SPELLS[id].name} · 잠김`}
            </ButtonSmall>
          );
        }
        return (
          <ButtonSmall
            key={id}
            style="monolight"
            disabled={disabled || waiting}
            aria-label={`${id === "myeonggyeong" ? (lightOn ? "지팡이 불빛 끄기, 묵령, 단축키 1 또는 2" : "지팡이 불빛 켜기, 명경, 단축키 1 또는 2") : `${SPELLS[id].name}, ${SPELLS[id].hint}, 단축키 ${SPELL_ORDER.indexOf(id) + 1}`}${waiting ? `, ${seconds}초 후 사용 가능` : ""}`}
            aria-pressed={id === "myeonggyeong" ? lightOn : undefined}
            onClick={() => onCast(id)}
          >
            {waiting && id !== "myeonggyeong"
              ? `${label} · ${seconds}초`
              : label}
          </ButtonSmall>
        );
      })}
    </div>
  );
}
