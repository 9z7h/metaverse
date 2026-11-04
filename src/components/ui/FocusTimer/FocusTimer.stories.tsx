import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "@storybook/test";
import { FocusTimer } from "./FocusTimer";

const meta = {
  title: "UI/FocusTimer",
  component: FocusTimer,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    // Figma 프레임 없음 — 시안 확정 시 parameters.design.url 연결
  },
  decorators: [
    (Story) => (
      <div
        data-theme="library"
        style={{
          width: "calc(var(--spacing-64) * 5)",
          padding: "var(--spacing-24)",
          background: "var(--color-background-default)",
        }}
      >
        <Story />
      </div>
    ),
  ],
  argTypes: {
    status: { control: "select", options: ["idle", "running", "paused"] },
  },
  args: {
    totalSeconds: 1500,
    remainingSeconds: 1500,
    label: "알고리즘",
    onStart: fn(),
    onPause: fn(),
    onReset: fn(),
  },
} satisfies Meta<typeof FocusTimer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 시작 전 — 초기화 비활성, "집중 시작" 클릭 시 onStart */
export const Idle: Story = {
  args: { status: "idle" },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("timer")).toHaveTextContent("25:00");
    await expect(canvas.getByRole("button", { name: "초기화" })).toBeDisabled();
    await userEvent.click(canvas.getByRole("button", { name: "집중 시작" }));
    await expect(args.onStart).toHaveBeenCalledTimes(1);
  },
};

/** 집중 중 — "일시정지" 클릭 시 onPause */
export const Running: Story = {
  args: { status: "running", remainingSeconds: 1023 },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("timer")).toHaveTextContent("17:03");
    await userEvent.click(canvas.getByRole("button", { name: "일시정지" }));
    await expect(args.onPause).toHaveBeenCalledTimes(1);
  },
};

/** 일시정지 — "계속하기" / "초기화" 활성 */
export const Paused: Story = {
  args: { status: "paused", remainingSeconds: 600 },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "초기화" }));
    await expect(args.onReset).toHaveBeenCalledTimes(1);
  },
};
