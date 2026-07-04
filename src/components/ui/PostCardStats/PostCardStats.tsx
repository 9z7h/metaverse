import type { CSSProperties, MouseEventHandler } from "react";
import { Icon } from "../Icon";
import { BookmarkButton } from "../BookmarkButton";

export interface PostCardStatsProps {
  /** View count value. Defaults to `"0"`. */
  viewCount?: string;
  /** Like count value. Defaults to `"0"`. */
  likeCount?: string;
  /** 좋아요 활성화 여부. true면 채워진 빨간 하트. 기본 `false`. */
  liked?: boolean;
  /**
   * 좋아요 클릭(토글) 핸들러. 전달하면 좋아요 영역이 클릭 가능한 `<button>`이
   * 되고, 전달하지 않으면 기존처럼 표시 전용 영역으로 렌더된다(하위 호환).
   */
  onLikeClick?: MouseEventHandler<HTMLButtonElement>;
  /**
   * 북마크 버튼 표시 여부. 기본 `false`(기존 조회수+좋아요 2개만 렌더,
   * 하위 호환 유지). `true`면 세 번째 항목으로 {@link BookmarkButton}을 추가.
   */
  showBookmark?: boolean;
  /** 북마크 활성화 여부. `showBookmark`가 `true`일 때만 의미 있음. 기본 `false`. */
  bookmarked?: boolean;
  /** 북마크 클릭(토글) 핸들러. */
  onBookmarkClick?: MouseEventHandler<HTMLButtonElement>;
  /** Extra class forwarded to the root element. */
  className?: string;
}

// ⚠️ 토큰 외 값(6px): Figma `gap` 6px에 대응하는 spacing 토큰이 없음
// (spacing 스케일이 --spacing-4 → --spacing-8로 건너뜀). Category 컴포넌트의
// 6px 처리 선례를 따라 Figma 원본과 1:1 일치를 위해 직접 지정.
const ICON_TEXT_GAP = "6px";

const rootStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--spacing-24)",
};

const areaStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: ICON_TEXT_GAP,
};

// 좋아요 영역이 클릭 가능한 <button>일 때: areaStyle에 버튼 기본 스타일 리셋을 더한다.
const buttonAreaStyle: CSSProperties = {
  ...areaStyle,
  background: "none",
  border: "none",
  padding: 0,
  cursor: "pointer",
  appearance: "none",
  WebkitAppearance: "none",
};

const textStyle: CSSProperties = {
  font: "var(--text-caption-lg-medium)",
  color: "var(--color-text-tertiary)",
};

/**
 * Compact stats row for a post card: a view-count area (eye icon + count), a
 * like-count area (heart icon + count), and an optional {@link BookmarkButton}
 * as a third item — separated by a `--spacing-24` gap.
 *
 * Icons reuse the shared {@link Icon} component at 16px; text uses the
 * `--caption-lg-medium` typography token in `--color-text-tertiary`.
 * Passing `onLikeClick` turns the like area into a clickable toggle button
 * (filled red heart when `liked`); omitting it keeps the area display-only.
 * `showBookmark` defaults to `false` so existing callers keep rendering just
 * the two stat areas.
 */
export function PostCardStats({
  viewCount = "0",
  likeCount = "0",
  liked = false,
  onLikeClick,
  showBookmark = false,
  bookmarked = false,
  onBookmarkClick,
  className,
}: PostCardStatsProps) {
  const likeInteractive = typeof onLikeClick === "function";

  // 클릭 가능한 <button>일 때는 버튼 자체 aria-label로 이름을 제공하므로
  // 내부 아이콘은 장식용(title 없음)으로 둔다.
  const likeIcon = (
    <Icon
      name={liked ? "heart_fill" : "heart_empty"}
      size={16}
      color={liked ? "var(--color-text-Danger)" : undefined}
      title={likeInteractive ? undefined : "좋아요"}
    />
  );
  const likeCountText = <span style={textStyle}>{likeCount}</span>;

  return (
    <div className={className} style={rootStyle}>
      <div style={areaStyle}>
        <Icon name="eye-on" size={16} title="조회수" />
        <span style={textStyle}>{viewCount}</span>
      </div>

      {likeInteractive ? (
        <button
          type="button"
          aria-pressed={liked}
          aria-label="좋아요"
          onClick={onLikeClick}
          style={buttonAreaStyle}
        >
          {likeIcon}
          {likeCountText}
        </button>
      ) : (
        <div style={areaStyle}>
          {likeIcon}
          {likeCountText}
        </div>
      )}

      {showBookmark ? (
        <BookmarkButton
          state={bookmarked ? "filled" : "default"}
          onClick={onBookmarkClick}
        />
      ) : null}
    </div>
  );
}
