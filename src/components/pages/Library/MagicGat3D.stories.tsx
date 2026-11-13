import type { Meta, StoryObj } from "@storybook/react";
import { expect, waitFor } from "@storybook/test";
import { MagicGat3D } from "./MagicGat3D";

const meta = {
  title: "Pages/Library/MagicGat3D",
  component: MagicGat3D,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    // Figma 프레임 없음 — 시안 확정 시 parameters.design.url 연결
  },
  args: { size: 320 },
  decorators: [
    (Story) => (
      <div
        data-theme="library"
        style={{
          padding: "var(--spacing-48)",
          background: "var(--color-background-default)",
        }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MagicGat3D>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 내려와 자리 잡고 둘러보는 중 */
export const Idle: Story = {
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(canvasElement.querySelector("canvas")).not.toBeNull(),
    );
  },
};

/** 학생을 읽어 주며 말하는 중 — 입이 달싹이고 고개를 까딱인다 */
export const Talking: Story = { args: { talking: true } };

/** 기숙사를 외치는 순간 — 크게 부풀며 빛이 번진다 */
export const Shout: Story = { args: { shout: true } };
