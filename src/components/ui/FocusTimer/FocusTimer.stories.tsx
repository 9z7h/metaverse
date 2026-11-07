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
    elapsedSeconds: { control: { type: "number", min: 0, step: 60 } },
  },
  args: {
    elapsedSeconds: 0,
    label: "알고리즘",
    onStart: fn(),
    onPause: fn(),
  },
} satisfies Meta<typeof FocusTimer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 오늘 첫 집중 전 — "집중 시작" 클릭 시 onStart */
export const Idle: Story = {
  args: { status: "idle", elapsedSeconds: 0 },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("timer")).toHaveTextContent("00:00");
    await expect(canvas.queryByRole("button", { name: "초기화" })).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "집중 시작" }));
    await expect(args.onStart).toHaveBeenCalledTimes(1);
  },
};

/** 집중 중 (17분 3초 누적) — "일시정지" 클릭 시 onPause */
export const Running: Story = {
  args: { status: "running", elapsedSeconds: 1023 },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("timer")).toHaveTextContent("17:03");
    await userEvent.click(canvas.getByRole("button", { name: "일시정지" }));
    await expect(args.onPause).toHaveBeenCalledTimes(1);
  },
};

/** 잠시 멈춤 — "계속하기"로 이어서 누적 */
export const Paused: Story = {
  args: { status: "paused", elapsedSeconds: 600 },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "계속하기" }));
    await expect(args.onStart).toHaveBeenCalledTimes(1);
  },
};

/** 1시간 넘게 누적 — H:MM:SS 표시, 링은 두 바퀴째 (25% 지점) */
export const OverAnHour: Story = {
  args: { status: "running", elapsedSeconds: 3600 + 900 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("timer")).toHaveTextContent("1:15:00");
  },
};
