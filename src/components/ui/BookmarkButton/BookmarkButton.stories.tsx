import type { Meta, StoryObj } from "@storybook/react";
import { expect, within, userEvent, fn } from "@storybook/test";
import { BookmarkButton } from "./BookmarkButton";

const meta = {
  title: "UI/BookmarkButton",
  component: BookmarkButton,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  argTypes: {
    state: { control: "select", options: ["default", "filled"] },
  },
  args: {
    state: "default",
  },
} satisfies Meta<typeof BookmarkButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Controls로 state 변경 (default/filled) */
export const Playground: Story = {};

/** 기본 상태 — 빈 북마크 아이콘, `--color-text-tertiary` */
export const Default: Story = {
  args: { state: "default" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "북마크" });
    await expect(button).toHaveAttribute("aria-pressed", "false");
  },
};

/** 채워진 상태 — 채워진 북마크 아이콘, `--color-interactive-primary` */
export const Filled: Story = {
  args: { state: "filled" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "북마크" });
    await expect(button).toHaveAttribute("aria-pressed", "true");
  },
};

/** 두 상태를 나란히 비교 */
export const Gallery: Story = {
  render: () => (
    <div style={{ display: "flex", gap: "var(--spacing-24)" }}>
      <BookmarkButton state="default" />
      <BookmarkButton state="filled" />
    </div>
  ),
};

/** 클릭 시 onClick 호출 검증 */
export const ClickInteraction: Story = {
  args: { onClick: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "북마크" });
    await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalledTimes(1);
  },
};

/** aria-label 커스터마이즈 */
export const CustomAriaLabel: Story = {
  args: { "aria-label": "게시글 저장" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("button", { name: "게시글 저장" }),
    ).toBeInTheDocument();
  },
};
