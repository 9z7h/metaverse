import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "@storybook/test";
import { PostImage, type PostImageType } from "./PostImage";

const allTypes: PostImageType[] = [1, 2, 3, 4, 5, 6];

const meta = {
  title: "UI/PostImage",
  component: PostImage,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    type: { control: "select", options: allTypes },
    alt: { control: "text" },
    width: { control: { type: "number", min: 100, max: 500, step: 10 } },
    className: { control: false },
  },
  args: {
    type: 1,
    alt: "게시글 이미지",
  },
} satisfies Meta<typeof PostImage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 기본 이미지 (Controls로 type/alt/width 변경) */
export const Playground: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const img = canvas.getByRole("img", { name: args.alt });
    await expect(img).toBeInTheDocument();
    await expect(img).toHaveAttribute("width", String(args.width ?? 500));
  },
};

/** 테마 1 */
export const Type1: Story = { args: { type: 1, alt: "테마 1 이미지" } };
/** 테마 2 */
export const Type2: Story = { args: { type: 2, alt: "테마 2 이미지" } };
/** 테마 3 */
export const Type3: Story = { args: { type: 3, alt: "테마 3 이미지" } };
/** 테마 4 */
export const Type4: Story = { args: { type: 4, alt: "테마 4 이미지" } };
/** 테마 5 */
export const Type5: Story = { args: { type: 5, alt: "테마 5 이미지" } };
/** 테마 6 */
export const Type6: Story = { args: { type: 6, alt: "테마 6 이미지" } };

/** width prop으로 렌더 크기 조절 (원본 500:319 비율 유지) */
export const CustomWidth: Story = {
  args: { type: 1, alt: "작은 크기 이미지", width: 240 },
};

/** 데코레이티브 용도: alt=""로 스크린리더에서 숨김 */
export const Decorative: Story = {
  args: { type: 2, alt: "" },
  play: async ({ canvasElement }) => {
    const img = canvasElement.querySelector("img");
    await expect(img).toBeInTheDocument();
    await expect(img).toHaveAttribute("alt", "");
  },
};

/** 6개 테마 전체 한눈에 보기 */
export const Gallery: Story = {
  render: () => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: "var(--spacing-16)",
      }}
    >
      {allTypes.map((type) => (
        <PostImage
          key={type}
          type={type}
          alt={`테마 ${type} 이미지`}
          width={240}
        />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const images = canvas.getAllByRole("img");
    await expect(images).toHaveLength(allTypes.length);
  },
};
