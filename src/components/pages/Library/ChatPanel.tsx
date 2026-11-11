import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { ButtonSmall } from "../../ui/Button";
import { Input } from "../../ui/Input";
import { CHAT_MAX_LEN, normalizeChatText } from "./chat";
import type { ChatMessage } from "./chat";
import { houseVar } from "./houses";

export interface ChatPanelProps {
  /** 최근 대화 (오래된 것 → 최근) */
  messages: ChatMessage[];
  /** 내 글을 보낸다. 보냈으면 true, 막혔으면(너무 빠름·연결 전) false */
  onSend: (text: string) => boolean;
  /** 다른 학생의 말풍선과 대화를 보는지 */
  enabled: boolean;
  onToggleEnabled: () => void;
  onClose: () => void;
  /**
   * 입력창에 포커스가 들어오고 나갈 때 — 3D 장면의 이동 키(WASD·E)가
   * 글자 입력과 섞이지 않게 부모가 키 상태를 정리하는 데 쓴다.
   */
  onFocusChange?: (focused: boolean) => void;
}

const panelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--spacing-8)",
  width: "100%",
  maxWidth: "calc(var(--spacing-48) * 11)",
  maxHeight: "min(60dvh, calc(var(--spacing-64) * 6))",
  boxSizing: "border-box",
  padding: "var(--spacing-12)",
  borderRadius: "var(--radius-xl)",
  background: "var(--color-background-Subtle)",
  border: "1px solid var(--color-background-muted)",
  color: "var(--color-text-primary)",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "var(--spacing-8)",
};

const logStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--spacing-6)",
  minHeight: "var(--spacing-64)",
  maxHeight: "calc(var(--spacing-48) * 5)",
  overflowY: "auto",
  margin: 0,
  padding: 0,
  listStyle: "none",
};

const captionStyle: CSSProperties = {
  margin: 0,
  font: "var(--text-caption-lg-medium)",
  color: "var(--color-text-tertiary)",
};

/**
 * 서고의 속삭임 — 최근 대화 목록과 입력창.
 * 글은 항상 텍스트로만 그린다 (다른 학생이 보낸 값이므로 HTML로 해석하지 않는다).
 */
export function ChatPanel({
  messages,
  onSend,
  enabled,
  onToggleEnabled,
  onClose,
  onFocusChange,
}: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const logRef = useRef<HTMLUListElement>(null);

  // 새 글이 오면 맨 아래로
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, enabled]);

  const submit = () => {
    if (!enabled) return;
    if (!normalizeChatText(draft)) {
      setDraft("");
      return;
    }
    if (onSend(draft)) {
      setDraft("");
      setNotice(null);
    } else {
      setNotice("조금 천천히 말해 주세요");
    }
  };

  return (
    <section aria-label="서고의 속삭임" style={panelStyle}>
      <div style={headerStyle}>
        <strong style={{ font: "var(--text-body-sm-bold)" }}>
          서고의 속삭임
        </strong>
        <div style={{ display: "flex", gap: "var(--spacing-4)" }}>
          <ButtonSmall style="monolight" onClick={onToggleEnabled}>
            {enabled ? "채팅 끄기" : "채팅 켜기"}
          </ButtonSmall>
          <ButtonSmall style="monolight" onClick={onClose}>
            닫기
          </ButtonSmall>
        </div>
      </div>

      {enabled ? (
        <ul
          ref={logRef}
          role="log"
          aria-live="polite"
          aria-label="최근 대화"
          style={logStyle}
        >
          {messages.length === 0 ? (
            <li style={captionStyle}>
              아직 아무 말도 없어요. 작은 소리로 먼저 말을 걸어 보세요.
            </li>
          ) : (
            messages.map((m) => (
              <li
                key={m.id}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: "var(--spacing-6)",
                  font: "var(--text-body-sm-regular)",
                  wordBreak: "keep-all",
                  overflowWrap: "anywhere",
                }}
              >
                {m.house ? (
                  <span
                    aria-hidden
                    style={{
                      flexShrink: 0,
                      width: "var(--spacing-8)",
                      height: "var(--spacing-8)",
                      borderRadius: "var(--radius-circle)",
                      background: houseVar(m.house, "accent"),
                    }}
                  />
                ) : null}
                <strong
                  style={{
                    flexShrink: 0,
                    font: "var(--text-body-sm-bold)",
                    color: m.mine
                      ? "var(--color-interactive-primary)"
                      : "var(--color-text-primary)",
                  }}
                >
                  {m.mine ? "나" : m.name}
                </strong>
                {/* 글은 항상 텍스트 노드로만 — HTML로 해석되지 않는다 */}
                <span>{m.text}</span>
              </li>
            ))
          )}
        </ul>
      ) : (
        <p style={captionStyle}>
          채팅이 꺼져 있어요. 다른 학생의 말풍선과 대화가 보이지 않아요.
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "var(--spacing-8)",
        }}
      >
        <Input
          aria-label="속삭일 말"
          placeholder="작은 목소리로 말하기"
          value={draft}
          maxLength={CHAT_MAX_LEN}
          disabled={!enabled}
          error={notice ?? undefined}
          autoComplete="off"
          enterKeyHint="send"
          onChange={(e) => {
            setDraft(e.target.value);
            if (notice) setNotice(null);
          }}
          onFocus={() => onFocusChange?.(true)}
          onBlur={() => onFocusChange?.(false)}
          // minWidth: 0 — 안 두면 입력칸의 기본 폭(한글 글꼴에서 약 340px)이 패널보다 넓어져
          // '보내기'를 밀어낸다
          style={{ flex: 1, minWidth: 0 }}
        />
        <ButtonSmall
          style="core"
          onClick={submit}
          disabled={!enabled || !normalizeChatText(draft)}
        >
          보내기
        </ButtonSmall>
      </form>
    </section>
  );
}
