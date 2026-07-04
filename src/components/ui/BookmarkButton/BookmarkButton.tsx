import type { CSSProperties, MouseEventHandler } from "react";
import { Icon } from "../Icon";

/** 북마크 상태. `filled`면 채워진 아이콘 + 강조 색상. */
export type BookmarkButtonState = "default" | "filled";

export interface BookmarkButtonProps {
  /** 북마크 상태. 기본 `default`. */
  state?: BookmarkButtonState;
  /** 클릭(토글) 핸들러. */
  onClick?: MouseEventHandler<HTMLButtonElement>;
  /** 접근성 라벨. 기본 "북마크". */
  "aria-label"?: string;
  /** 추가 클래스명. */
  className?: string;
}

const rootStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "none",
  border: "none",
  padding: 0,
  cursor: "pointer",
  appearance: "none",
  WebkitAppearance: "none",
};

/**
 * 게시글 북마크 토글 버튼. `PostCardStats`의 조회수/좋아요 영역과 같은 16px
 * {@link Icon} 아이콘을 사용하며, `default`(outline)/`filled`(강조색 채움) 두
 * 상태를 지원한다.
 */
export function BookmarkButton({
  state = "default",
  onClick,
  "aria-label": ariaLabel = "북마크",
  className,
}: BookmarkButtonProps) {
  const isFilled = state === "filled";

  return (
    <button
      type="button"
      aria-pressed={isFilled}
      aria-label={ariaLabel}
      onClick={onClick}
      className={className}
      style={{
        ...rootStyle,
        color: isFilled
          ? "var(--color-interactive-primary)"
          : "var(--color-text-tertiary)",
      }}
    >
      <Icon name={isFilled ? "bookmark_fill" : "bookmark_empty"} size={16} />
    </button>
  );
}
