import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "@storybook/test";
import { TitleInput } from "./TitleInput";
import { iconPaths, type IconName } from "../Icon";

const allIconNames = Object.keys(iconPaths) as IconName[];

const meta = {
  title: "UI/TitleInput",
  component: TitleInput,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    type: {
      control: "radio",
      options: ["default", "focus", "error", "disabled"],
    },
    label: { control: "text" },
    headline: { control: "text" },
    helptext: { control: "boolean" },
    icon: { control: "boolean" },
    iconName: { control: "select", options: allIconNames },
    width: { control: "text" },
  },
  args: {
    label: "label",
    headline: "placeholder",
    helptext: true,
    icon: true,
    iconName: "search",
    type: "default",
    width: "345px",
  },
} satisfies Meta<typeof TitleInput>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 기본 상태 — `--color-text-disabled` 테두리, 라벨/입력/헬프텍스트 모두 표시 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("label")).toBeInTheDocument();
    const placeholders = canvas.getAllByText("placeholder");
    await expect(placeholders.length).toBe(2);
  },
};

/** 포커스 상태 — `--color-interactive-primaryhover` 테두리/헬프텍스트 색 */
export const Focus: Story = {
  args: { type: "focus" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("label")).toBeInTheDocument();
  },
};

/** 에러 상태 — `--color-interactive-destructivehover` 테두리/헬프텍스트 색 */
export const Error: Story = {
  args: { type: "error" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("label")).toBeInTheDocument();
  },
};

/** 비활성 상태 — `--color-text-tertiary` 입력 텍스트 */
export const Disabled: Story = {
  args: { type: "disabled" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("label")).toBeInTheDocument();
  },
};

/** 헬프텍스트 라인 숨김 */
export const WithoutHelptext: Story = {
  args: { helptext: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const placeholders = canvas.getAllByText("placeholder");
    await expect(placeholders.length).toBe(1);
  },
};

/** 트레일링 아이콘 숨김 */
export const WithoutIcon: Story = {
  args: { icon: false },
};

/** iconName 커스텀 지정 */
export const CustomIcon: Story = {
  args: { iconName: "heart_fill" },
};
