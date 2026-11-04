import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "@storybook/test";
import { StudySeat } from "./StudySeat";

const meta = {
  title: "UI/StudySeat",
  component: StudySeat,
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
          width: "calc(var(--spacing-64) * 3)",
          padding: "var(--spacing-16)",
          background: "var(--color-background-default)",
        }}
      >
        <Story />
      </div>
    ),
  ],
  argTypes: {
    state: { control: "select", options: ["empty", "occupied", "mine"] },
  },
  args: {
    seatLabel: "A-1",
    onSelect: fn(),
  },
} satisfies Meta<typeof StudySeat>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 빈 자리 — "여기 앉기" 버튼 클릭 시 onSelect 호출 */
export const Empty: Story = {
  args: { state: "empty" },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("빈 자리")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "여기 앉기" }));
    await expect(args.onSelect).toHaveBeenCalledTimes(1);
  },
};

/** 다른 학생이 집중 중인 자리 */
export const Occupied: Story = {
  args: {
    state: "occupied",
    name: "하린",
    subject: "알고리즘",
    focusMinutes: 95,
    focusing: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("1시간 35분")).toBeInTheDocument();
    await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
    await expect(canvas.getByTestId("focus-indicator")).toBeInTheDocument();
  },
};

/** 다른 학생이 휴식 중인 자리 — 집중 표시 없음 */
export const OccupiedResting: Story = {
  args: {
    state: "occupied",
    name: "도윤",
    subject: "토익",
    focusMinutes: 40,
    focusing: false,
  },
};

/** 내 자리 — 촛불색 테두리로 강조 */
export const Mine: Story = {
  args: {
    state: "mine",
    name: "수련생",
    subject: "UX 리서치",
    focusMinutes: 25,
    focusing: true,
  },
};
