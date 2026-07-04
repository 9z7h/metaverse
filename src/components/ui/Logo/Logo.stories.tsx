import type { CSSProperties } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "@storybook/test";
import { Logo } from "./Logo";

/** `--logo-color` is a custom property, not part of the `CSSProperties` type. */
interface DarkSurfaceStyle extends CSSProperties {
  "--logo-color"?: string;
}

const meta = {
  title: "UI/Logo",
  component: Logo,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  argTypes: {
    width: { control: { type: "number", min: 40, max: 400, step: 2 } },
    title: { control: "text" },
  },
  args: {
    width: 186,
  },
} satisfies Meta<typeof Logo>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 기본 크기(186px), title 미지정 시 aria-hidden 처리 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const svg = canvasElement.querySelector("svg");
    await expect(svg).toBeInTheDocument();
    await expect(svg).toHaveAttribute("aria-hidden", "true");
    await expect(svg).not.toHaveAttribute("role");
    await expect(svg).toHaveAttribute("width", "186");
  },
};

/** title 지정 시 role="img" + 접근 가능한 이름 노출 */
export const WithTitle: Story = {
  args: { title: "FigmaPedia" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const svg = canvas.getByRole("img", { name: "FigmaPedia" });
    await expect(svg).toBeInTheDocument();
    await expect(svg).not.toHaveAttribute("aria-hidden");
  },
};

/** 작은 크기 — 원본 비율(186:38) 유지 */
export const Small: Story = {
  args: { width: 96 },
};

/** 큰 크기 — 원본 비율(186:38) 유지 */
export const Large: Story = {
  args: { width: 320 },
};

/** 어두운 배경 위 — --logo-color를 --color-text-onbrand로 오버라이드 */
export const OnDarkSurface: Story = {
  render: (args) => (
    <div
      style={
        {
          padding: "var(--spacing-24)",
          background: "var(--color-content-strong)",
          borderRadius: "var(--radius-md)",
          "--logo-color": "var(--color-text-onbrand)",
        } as DarkSurfaceStyle
      }
    >
      <Logo {...args} />
    </div>
  ),
};
