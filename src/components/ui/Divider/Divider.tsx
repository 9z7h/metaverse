/**
 * Divider — 가로 구분선
 * Figma node-id: 781-5293 (component 137:1362)
 *
 * 색상: --color-background-muted (#f5f7fa)
 * 상하 여백: --spacing-12 (12px)
 */

interface DividerProps {
  /** 추가 클래스명 (레이아웃 조정용) */
  className?: string;
}

export function Divider({ className }: DividerProps) {
  return (
    <hr
      role="separator"
      aria-orientation="horizontal"
      className={className}
      style={{
        width: "100%",
        height: 0,
        border: "none",
        borderTop: "1px solid var(--color-background-muted)",
        marginBlock: "var(--spacing-12)",
      }}
    />
  );
}
