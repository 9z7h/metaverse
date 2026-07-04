import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "@storybook/test";
import { Chip, type ChipVariant } from "./Chip";

const ALL_VARIANTS: ChipVariant[] = ["category", "notice"];

const meta = {
  title: "UI/Chip",
  component: Chip,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  argTypes: {
    variant: { control: "select", options: ALL_VARIANTS },
    icon: { control: false },
    children: { control: "text" },
  },
  args: {
    variant: "category",
    children: "카테고리",
  },
} satisfies Meta<typeof Chip>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 기본 렌더링 — Controls로 variant/children 변경 가능 */
export const Playground: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chip = canvas.getByText("카테고리");
    await expect(chip).toBeInTheDocument();
  },
};

/** variant="category" — 아이콘 없음 */
export const Category: Story = {
  args: { variant: "category", children: "카테고리" },
};

/** variant="category" + 아이콘 */
export const CategoryWithIcon: Story = {
  args: { variant: "category", icon: "design", children: "디자인" },
};

/** variant="notice" — 아이콘 없음 */
export const Notice: Story = {
  args: { variant: "notice", children: "공지" },
};

/** variant="notice" + 아이콘 */
export const NoticeWithIcon: Story = {
  args: { variant: "notice", icon: "heart_fill", children: "찜" },
};

/** variant × icon 유무 4가지 조합을 한눈에 비교 */
export const Gallery: Story = {
  render: () => (
    <div
      style={{ display: "flex", gap: "var(--spacing-16)", flexWrap: "wrap" }}
    >
      <Chip variant="category">카테고리</Chip>
      <Chip variant="category" icon="design">
        디자인
      </Chip>
      <Chip variant="notice">공지</Chip>
      <Chip variant="notice" icon="heart_fill">
        찜
      </Chip>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("카테고리")).toBeInTheDocument();
    await expect(canvas.getByText("디자인")).toBeInTheDocument();
    await expect(canvas.getByText("공지")).toBeInTheDocument();
    await expect(canvas.getByText("찜")).toBeInTheDocument();
  },
};
