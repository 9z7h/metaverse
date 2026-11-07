import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "@storybook/test";
import { WorldIntro } from "./WorldIntro";

const meta = {
  title: "Pages/Library/WorldIntro",
  component: WorldIntro,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    viewport: { defaultViewport: "mobile1" },
    // Figma 프레임 없음 — 시안 확정 시 parameters.design.url 연결
  },
  decorators: [
    (Story) => (
      <div data-theme="library" style={{ padding: "var(--spacing-16)" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof WorldIntro>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 첫 입장 — 펼쳐진 상태에서 세 장을 넘겨 본다 */
export const FirstVisit: Story = {
  args: { initialOpen: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("숨은골의 사신학당")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "다음" }));
    await expect(canvas.getByText("네 개의 사방재")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "다음" }));
    await expect(canvas.getByText("먹빛각에서 함께 수련")).toBeInTheDocument();
  },
};

/** 재방문 — 접혀 있고 버튼으로 다시 볼 수 있다 */
export const Collapsed: Story = {
  args: { initialOpen: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "학당 소개 보기" }),
    );
    await expect(canvas.getByText("숨은골의 사신학당")).toBeInTheDocument();
  },
};
