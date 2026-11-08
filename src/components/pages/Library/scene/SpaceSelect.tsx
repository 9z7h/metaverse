import { useEffect, useRef } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import { ButtonSmall } from "../../../ui/Button";

export type LibrarySpace = "library" | "garden";
interface SpaceSelectProps {
  current: LibrarySpace;
  onChange: (space: LibrarySpace) => void;
}
const spaces: { id: LibrarySpace; label: string }[] = [
  { id: "library", label: "먹빛각 · 서고" },
  { id: "garden", label: "숨돌림 뜰 · 쉬어 가는 중" },
];
const triggerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--spacing-8)",
  padding: "var(--spacing-6) var(--spacing-12)",
  borderRadius: "var(--radius-circle)",
  background: "var(--color-background-Subtle)",
  color: "var(--color-text-secondary)",
  font: "var(--text-caption-lg-medium)",
  cursor: "pointer",
  listStyle: "none",
};

/** 현재 공간에서 다른 공간으로 이동하는 메뉴. */
export function SpaceSelect({ current, onChange }: SpaceSelectProps) {
  const details = useRef<HTMLDetailsElement>(null);
  const trigger = useRef<HTMLElement>(null);
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (details.current && !details.current.contains(event.target as Node))
        details.current.open = false;
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);
  function handleKeyDown(event: KeyboardEvent<HTMLDetailsElement>) {
    event.stopPropagation();
    if (event.key === "Escape" && details.current?.open) {
      event.preventDefault();
      details.current.open = false;
      trigger.current?.focus();
    }
  }
  return (
    <details
      ref={details}
      onKeyDown={handleKeyDown}
      style={{ position: "relative", minWidth: 0, pointerEvents: "auto" }}
    >
      <summary
        ref={trigger}
        aria-label={
          "공간 이동, 현재 " +
          spaces.find((space) => space.id === current)?.label
        }
        style={triggerStyle}
      >
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {spaces.find((space) => space.id === current)?.label}
        </span>
        <span aria-hidden="true">⌄</span>
      </summary>
      <div
        aria-label="이동할 공간"
        style={{
          position: "absolute",
          top: "100%",
          left: 0,
          marginTop: "var(--spacing-8)",
          padding: "var(--spacing-8)",
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          gap: "var(--spacing-4)",
          minWidth: "max-content",
          maxWidth: "calc(100vw - var(--spacing-32))",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--color-border-default)",
          background: "var(--color-background-Subtle)",
          zIndex: 20,
        }}
      >
        {spaces.map((space) => (
          <ButtonSmall
            key={space.id}
            style={space.id === current ? "core" : "monolight"}
            aria-label={
              space.label + (space.id === current ? ", 현재 공간" : " 이동")
            }
            onClick={() => {
              if (details.current) details.current.open = false;
              if (space.id !== current) onChange(space.id);
            }}
          >
            {space.id === current ? "✓ " + space.label : space.label}
          </ButtonSmall>
        ))}
      </div>
    </details>
  );
}
