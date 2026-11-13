import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { ButtonMedium, ButtonSmall } from "../../../ui/Button";
import {
  SPELLS,
  SPELL_ORDER,
  formatRemaining,
  isUnlocked,
  secondsToUnlock,
} from "./spellLogic";
import type { SpellId } from "./spellLogic";

/** 터치로 연 말풍선이 저절로 닫히는 시간 */
const TIP_TOUCH_MS = 4000;

/** 음악 버튼처럼 동그란 토글 하나만 화면 오른쪽 아래에 두고, 누르면 칩이 위로 세로로 펼쳐진다. */
const dockStyle: CSSProperties = {
  position: "fixed",
  right: "max(var(--spacing-16), env(safe-area-inset-right))",
  bottom: "max(var(--spacing-16), env(safe-area-inset-bottom))",
  zIndex: 5,
  display: "flex",
  flexDirection: "column-reverse",
  alignItems: "flex-end",
  gap: "var(--spacing-8)",
  pointerEvents: "auto",
};

const listStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: "var(--spacing-8)",
};

const chipWrapStyle: CSSProperties = {
  position: "relative",
  display: "inline-flex",
};

const coverStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  cursor: "help",
  pointerEvents: "auto",
};

const tipStyle: CSSProperties = {
  position: "absolute",
  bottom: "100%",
  right: 0,
  marginBottom: "var(--spacing-8)",
  width: "max-content",
  maxWidth: "min(calc(var(--spacing-48) * 6), calc(100vw - var(--spacing-32)))",
  padding: "var(--spacing-8) var(--spacing-12)",
  borderRadius: "var(--radius-lg)",
  background: "var(--color-background-Subtle)",
  color: "var(--color-text-secondary)",
  font: "var(--text-caption-lg-medium)",
  textAlign: "left",
  pointerEvents: "none",
  zIndex: 1,
};

const tipTitleStyle: CSSProperties = {
  color: "var(--color-text-primary)",
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
  const tipId = useId();
  const [open, setOpen] = useState(false);
  const [tip, setTip] = useState<SpellId | null>(null);
  /** 마지막 입력이 마우스면 호버로, 아니면 탭으로 말풍선을 연다 */
  const pointerKind = useRef("mouse");
  const [byTouch, setByTouch] = useState(false);

  useEffect(() => {
    if (tip === null || !byTouch) return;
    const timer = window.setTimeout(() => setTip(null), TIP_TOUCH_MS);
    const closeOutside = (e: PointerEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      if (!target?.closest("[data-spell-tip]")) setTip(null);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("pointerdown", closeOutside);
    };
  }, [tip, byTouch]);

  /** 마우스를 올리면 뜨고 벗어나면 사라진다. 터치는 칩이 눌리는 칩에서는 쓰지 않는다. */
  const hoverProps = (id: SpellId) => ({
    onPointerEnter: (e: ReactPointerEvent<HTMLElement>) => {
      if (e.pointerType !== "mouse") return;
      setByTouch(false);
      setTip(id);
    },
    onPointerLeave: (e: ReactPointerEvent<HTMLElement>) => {
      if (e.pointerType === "mouse") setTip(null);
    },
  });

  const tipLocked = tip !== null && !isUnlocked(tip, totalSeconds);
  /** 명경 칩은 켜져 있으면 묵령(끄기)으로 바뀐다 */
  const tipSpell =
    tip === null
      ? null
      : tip === "myeonggyeong" && lightOn
        ? SPELLS.mukryeong
        : SPELLS[tip];

  return (
    <div role="group" aria-label="주문" style={dockStyle}>
      {tipSpell && tip && (
        <div id={tipId} role="tooltip" style={tipStyle}>
          <div style={tipTitleStyle}>{tipSpell.name}</div>
          <div>{tipSpell.detail}</div>
          <div>
            {tipLocked
              ? `누적 수련 ${formatRemaining(tipSpell.unlockSeconds)} 필요 · 지금 ${formatRemaining(Math.floor(totalSeconds / 60) * 60)} · ${formatRemaining(secondsToUnlock(tip, totalSeconds))} 남음`
              : `단축키 ${tip === "myeonggyeong" ? "1 또는 2" : SPELL_ORDER.indexOf(tip) + 1}`}
          </div>
        </div>
      )}
      <ButtonMedium
        type="icon"
        icon="sparkle"
        style="monolight"
        radius="var(--radius-circle)"
        aria-label="주문 목록"
        aria-pressed={open}
        onClick={() => {
          setOpen((v) => !v);
          setTip(null);
        }}
      />
      {open ? (
        <div style={listStyle}>
          {SPELL_ORDER.filter((id) => id !== "mukryeong").map((id) => {
            const remaining = cooldowns[id] ?? 0;
            const waiting = remaining > 0;
            const locked = !isUnlocked(id, totalSeconds);
            /** 비활성 버튼은 브라우저가 호버·탭을 막으므로, 투명한 덮개가 대신 받는다 */
            const blocked = locked || disabled || waiting;
            const label =
              id === "myeonggyeong"
                ? lightOn
                  ? "묵령 · 끄기"
                  : "명경 · 켜기"
                : SPELLS[id].name;
            const seconds = Math.ceil(remaining / 1000);
            return (
              <span
                key={id}
                data-spell-tip
                style={chipWrapStyle}
                {...(blocked ? {} : hoverProps(id))}
              >
                {locked ? (
                  <ButtonSmall
                    style="monolight"
                    disabled
                    aria-label={`${SPELLS[id].name}, ${SPELLS[id].hint}, 수련 시간 ${formatRemaining(secondsToUnlock(id, totalSeconds))}을 더 채우면 풀립니다`}
                  >
                    {`${SPELLS[id].name} · 잠김`}
                  </ButtonSmall>
                ) : (
                  <ButtonSmall
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
                )}
                {blocked ? (
                  <span
                    aria-hidden="true"
                    data-spell-lock={locked ? true : undefined}
                    style={coverStyle}
                    {...hoverProps(id)}
                    onPointerDown={(e) => {
                      pointerKind.current = e.pointerType;
                    }}
                    onClick={() => {
                      if (pointerKind.current === "mouse" && tip === id) return;
                      const touch = pointerKind.current !== "mouse";
                      setByTouch(touch);
                      setTip((now) => (now === id && touch ? null : id));
                    }}
                  />
                ) : null}
              </span>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
