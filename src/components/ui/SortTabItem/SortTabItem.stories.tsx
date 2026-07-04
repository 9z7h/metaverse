import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, within } from "@storybook/test";
import { SortTabItem } from "./SortTabItem";

const meta = {
  title: "UI/SortTabItem",
  component: SortTabItem,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  argTypes: {
    state: { control: "radio", options: ["default", "selected"] },
    text: { control: "text" },
  },
  args: {
    state: "default",
    text: "Label",
    onClick: fn(),
  },
} satisfies Meta<typeof SortTabItem>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 기본 상태 — 아이콘 없음, `--color-text-secondary` 텍스트 */
export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "Label" });
    await expect(button).toBeInTheDocument();
    await expect(button).toHaveAttribute("aria-pressed", "false");
    button.click();
    await expect(args.onClick).toHaveBeenCalledTimes(1);
  },
};

/** 선택 상태 — check 아이콘 + `--spacing-4` 간격 + bold `--color-text-primary` 텍스트 */
export const Selected: Story = {
  args: { state: "selected" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "Label" });
    await expect(button).toHaveAttribute("aria-pressed", "true");
  },
};

/** 커스텀 라벨 텍스트 */
export const CustomText: Story = {
  args: { text: "최신순", state: "selected" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("최신순")).toBeInTheDocument();
  },
};
