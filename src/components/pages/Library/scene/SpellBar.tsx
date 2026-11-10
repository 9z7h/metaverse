import type { CSSProperties } from "react";
import { ButtonSmall } from "../../../ui/Button";
import { SPELLS, SPELL_ORDER } from "./spellLogic";
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
}

/** 주문 칩 네 개. 숫자키 1~4와 같은 순서다 */
export function SpellBar({ onCast, disabled = false }: SpellBarProps) {
  return (
    <div role="group" aria-label="주문" style={barStyle}>
      {SPELL_ORDER.map((id, i) => (
        <ButtonSmall
          key={id}
          style="monolight"
          disabled={disabled}
          aria-label={`${SPELLS[id].name}, ${SPELLS[id].hint}, 단축키 ${i + 1}`}
          onClick={() => onCast(id)}
        >
          {SPELLS[id].name}
        </ButtonSmall>
      ))}
    </div>
  );
}
