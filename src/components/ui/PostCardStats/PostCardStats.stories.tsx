import type { Meta, StoryObj } from "@storybook/react";
import { expect, within, userEvent, fn } from "@storybook/test";
import { PostCardStats } from "./PostCardStats";

const meta = {
  title: "UI/PostCardStats",
  component: PostCardStats,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    viewCount: { control: "text" },
    likeCount: { control: "text" },
    liked: { control: "boolean" },
    showBookmark: { control: "boolean" },
    bookmarked: { control: "boolean" },
  },
  args: {
    viewCount: "0",
    likeCount: "0",
    liked: false,
    showBookmark: false,
    bookmarked: false,
  },
} satisfies Meta<typeof PostCardStats>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 기본 상태 — 조회수/좋아요 모두 "0", 좋아요 비활성(빈 하트) */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const zeros = canvas.getAllByText("0");
    await expect(zeros).toHaveLength(2);
  },
};

/** 실제 카운트 값이 채워진 상태 */
export const WithCounts: Story = {
  args: { viewCount: "128", likeCount: "42" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("128")).toBeInTheDocument();
    await expect(canvas.getByText("42")).toBeInTheDocument();
  },
};

/** liked=true — 채워진 빨간 하트(--color-text-danger) */
export const Liked: Story = {
  args: { viewCount: "128", likeCount: "43", liked: true },
};

/** liked=false — 빈 하트 아이콘 */
export const Unliked: Story = {
  args: { viewCount: "128", likeCount: "42", liked: false },
};

/** onLikeClick 전달 시 좋아요 영역이 클릭 가능한 버튼이 되고 클릭 시 콜백 호출 */
export const LikeInteraction: Story = {
  args: {
    viewCount: "128",
    likeCount: "42",
    liked: false,
    onLikeClick: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const likeButton = canvas.getByRole("button", { name: "좋아요" });
    await expect(likeButton).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(likeButton);
    await expect(args.onLikeClick).toHaveBeenCalledTimes(1);
  },
};

/** showBookmark=true — 세 번째 항목으로 북마크 버튼(default) 추가 */
export const WithBookmark: Story = {
  args: { viewCount: "128", likeCount: "42", showBookmark: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const bookmarkButton = canvas.getByRole("button", { name: "북마크" });
    await expect(bookmarkButton).toBeInTheDocument();
    await expect(bookmarkButton).toHaveAttribute("aria-pressed", "false");
  },
};

/** showBookmark=true + bookmarked=true — 채워진 북마크 */
export const BookmarkFilled: Story = {
  args: {
    viewCount: "128",
    likeCount: "42",
    showBookmark: true,
    bookmarked: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("button", { name: "북마크" }),
    ).toHaveAttribute("aria-pressed", "true");
  },
};

/** 북마크 클릭 시 onBookmarkClick 호출 검증 */
export const BookmarkInteraction: Story = {
  args: {
    viewCount: "128",
    likeCount: "42",
    showBookmark: true,
    onBookmarkClick: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const bookmarkButton = canvas.getByRole("button", { name: "북마크" });
    await userEvent.click(bookmarkButton);
    await expect(args.onBookmarkClick).toHaveBeenCalledTimes(1);
  },
};
