import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "@storybook/test";
import { PostCardImage, type PostCardImageType } from "./PostCardImage";

const ALL_TYPES: PostCardImageType[] = [1, 2, 3, 4, 5, 6];

const meta = {
  title: "UI/PostCardImage",
  component: PostCardImage,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    type: { control: "select", options: ALL_TYPES },
    alt: { control: "text" },
    width: { control: { type: "number", min: 40, max: 320, step: 8 } },
  },
  args: {
    type: 1,
    alt: "",
  },
} satisfies Meta<typeof PostCardImage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 기본 썸네일 (type=1, 160×102) */
export const Playground: Story = {
  play: async ({ canvasElement }) => {
    // 장식용(alt="") 이미지는 접근성 role이 없으므로 태그로 직접 확인
    const el = canvasElement.querySelector("img");
    await expect(el).toBeInTheDocument();
    await expect(el).toHaveAttribute("width", "160");
    await expect(el).toHaveAttribute("height", "102");
  },
};

/** 접근성 alt 텍스트가 있는 썸네일 */
export const WithAlt: Story = {
  args: { alt: "디자인 시스템 토큰 가이드 썸네일" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const img = canvas.getByAltText("디자인 시스템 토큰 가이드 썸네일");
    await expect(img).toBeInTheDocument();
  },
};

/** width prop으로 렌더 크기 조절 (160:102 비율 유지) */
export const CustomWidth: Story = {
  args: { width: 240 },
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector("img");
    await expect(el).toHaveAttribute("width", "240");
    await expect(el).toHaveAttribute("height", "153");
  },
};

/** 6가지 썸네일 테마(type 1~6) 전체 갤러리 */
export const Gallery: Story = {
  render: () => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, auto)",
        gap: "var(--spacing-16)",
      }}
    >
      {ALL_TYPES.map((type) => (
        <div
          key={type}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "var(--spacing-8)",
          }}
        >
          <PostCardImage type={type} alt={`썸네일 테마 ${type}`} />
          <span style={{ color: "var(--color-text-secondary)" }}>
            type={type}
          </span>
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const images = canvasElement.querySelectorAll("img");
    await expect(images).toHaveLength(6);
  },
};
