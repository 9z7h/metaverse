import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, within } from "@storybook/test";
import { PostCard, type PostCardChip } from "./PostCard";
import type { PostCardImageType } from "../PostCardImage";

const ALL_THUMBNAIL_TYPES: PostCardImageType[] = [1, 2, 3, 4, 5, 6];

const SINGLE_CHIP: PostCardChip[] = [
  { label: "디자인", variant: "category", icon: "design" },
];

const meta = {
  title: "UI/PostCard",
  component: PostCard,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    title: { control: "text" },
    preview: { control: "text" },
    timeAgo: { control: "text" },
    showThumbnail: { control: "boolean" },
    thumbnailType: { control: "select", options: ALL_THUMBNAIL_TYPES },
    thumbnailAlt: { control: "text" },
    viewCount: { control: "text" },
    likeCount: { control: "text" },
  },
  args: {
    showThumbnail: true,
    thumbnailType: 1,
    viewCount: "128",
    likeCount: "42",
  },
} satisfies Meta<typeof PostCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 기본 상태 — 공지사항+디자인 칩, 썸네일, 통계, 상대 시간 모두 표시 */
export const Default: Story = {
  render: (args) => (
    <div style={{ width: "840px" }}>
      <PostCard {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText("디자인 시스템 토큰 설계 가이드"),
    ).toBeInTheDocument();
    await expect(canvas.getByText("공지사항")).toBeInTheDocument();
    await expect(canvas.getByText("디자인")).toBeInTheDocument();
    await expect(canvas.getByText("3시간 전")).toBeInTheDocument();
    await expect(canvasElement.querySelector("img")).toBeInTheDocument();
  },
};

/** 썸네일 없이 텍스트만 표시 (showThumbnail=false) */
export const WithoutThumbnail: Story = {
  args: { showThumbnail: false },
  render: (args) => (
    <div style={{ width: "840px" }}>
      <PostCard {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("img")).not.toBeInTheDocument();
  },
};

/** 칩이 하나만 있는 경우 (category 단독) */
export const SingleChip: Story = {
  args: { chips: SINGLE_CHIP },
  render: (args) => (
    <div style={{ width: "840px" }}>
      <PostCard {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("디자인")).toBeInTheDocument();
    await expect(canvas.queryByText("공지사항")).not.toBeInTheDocument();
  },
};

/** 칩 영역 자체를 숨김 (chips=[]) */
export const NoChips: Story = {
  args: { chips: [] },
  render: (args) => (
    <div style={{ width: "840px" }}>
      <PostCard {...args} />
    </div>
  ),
};

/** onClick이 있으면 카드 전체가 링크처럼 동작(포인터 커서, 키보드 포커스, Enter로 활성화) */
export const Interactive: Story = {
  args: { onClick: fn() },
  render: (args) => (
    <div style={{ width: "840px" }}>
      <PostCard {...args} />
    </div>
  ),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const link = canvas.getByRole("link");
    await expect(link).toBeInTheDocument();
    await expect(link).toHaveAttribute("tabindex", "0");
    link.click();
    await expect(args.onClick).toHaveBeenCalledTimes(1);
  },
};

/** 조회수/좋아요 카운트가 채워진 상태 */
export const WithStats: Story = {
  args: { viewCount: "1.2k", likeCount: "356" },
  render: (args) => (
    <div style={{ width: "840px" }}>
      <PostCard {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("1.2k")).toBeInTheDocument();
    await expect(canvas.getByText("356")).toBeInTheDocument();
  },
};

/** thumbnailType 1~6 전체 갤러리 */
export const ThumbnailGallery: Story = {
  render: (args) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--spacing-24)",
      }}
    >
      {ALL_THUMBNAIL_TYPES.map((type) => (
        <div key={type} style={{ width: "840px" }}>
          <PostCard
            {...args}
            thumbnailType={type}
            title={`썸네일 타입 ${type}`}
          />
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const images = canvasElement.querySelectorAll("img");
    await expect(images).toHaveLength(6);
  },
};
