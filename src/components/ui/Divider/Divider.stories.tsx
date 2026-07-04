import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "@storybook/test";
import { Divider } from "./Divider";

const meta = {
  title: "UI/Divider",
  component: Divider,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Bk8GPQ5r1K1A4XvKRBEUKS/?node-id=781-5293",
    },
  },
} satisfies Meta<typeof Divider>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 기본 가로 구분선 */
export const Default: Story = {
  render: (args) => (
    <div style={{ width: 840 }}>
      <Divider {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const separator = canvas.getByRole("separator");
    await expect(separator).toBeInTheDocument();
    await expect(separator).toHaveAttribute("aria-orientation", "horizontal");
  },
};

/** 콘텐츠 사이에 놓인 구분선 */
export const BetweenContent: Story = {
  render: (args) => (
    <div style={{ width: 840 }}>
      <p style={{ color: "var(--color-text-primary)" }}>위쪽 콘텐츠</p>
      <Divider {...args} />
      <p style={{ color: "var(--color-text-primary)" }}>아래쪽 콘텐츠</p>
    </div>
  ),
};
