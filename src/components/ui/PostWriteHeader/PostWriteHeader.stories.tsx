import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "@storybook/test";
import { PostWriteHeader } from "./PostWriteHeader";

const meta = {
  title: "UI/PostWriteHeader",
  component: PostWriteHeader,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    title: { control: "text" },
    subtitle: { control: "text" },
    width: { control: "text" },
    className: { control: false },
  },
} satisfies Meta<typeof PostWriteHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 기본 헤더 (Figma 기본 카피) */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const heading = canvas.getByRole("heading", {
      level: 1,
      name: "게시글 쓰기",
    });
    await expect(heading).toBeInTheDocument();
    await expect(
      canvas.getByText("건전한 커뮤니티를 위해 바른말 고운말을 씁시다."),
    ).toBeInTheDocument();
  },
};

/** 커스텀 title/subtitle */
export const CustomCopy: Story = {
  args: {
    title: "커뮤니티 이용 규칙",
    subtitle: "모두가 함께 만드는 공간입니다.",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("heading", { level: 1, name: "커뮤니티 이용 규칙" }),
    ).toBeInTheDocument();
  },
};

/** Figma 고정 프레임 너비(840px) 재현 */
export const FixedWidth: Story = {
  args: { width: "840px" },
};
