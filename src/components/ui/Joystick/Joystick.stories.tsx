import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, fireEvent, within } from "@storybook/test";
import { Joystick } from "./Joystick";

const meta = {
  title: "UI/Joystick",
  component: Joystick,
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
          padding: "var(--spacing-32)",
          background: "var(--color-background-default)",
        }}
      >
        <Story />
      </div>
    ),
  ],
  args: { onMove: fn(), onEnd: fn() },
} satisfies Meta<typeof Joystick>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 기본 — 드래그하면 노브가 따라오고 onMove가 정규화 벡터를 내보냄 */
export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const pad = canvas.getByRole("application", { name: "이동 조이스틱" });
    const r = pad.getBoundingClientRect();
    // 오른쪽 끝을 넘어서 드래그 → x = 1, y = 0 으로 클램프
    fireEvent.pointerDown(pad, {
      pointerId: 1,
      clientX: r.right + 40,
      clientY: r.top + r.height / 2,
    });
    await expect(args.onMove).toHaveBeenLastCalledWith({ x: 1, y: 0 });
    fireEvent.pointerUp(pad, { pointerId: 1 });
    await expect(args.onEnd).toHaveBeenCalledTimes(1);
  },
};
