import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "@storybook/test";
import { Checkbox, type CheckboxState } from "./Checkbox";

const ALL_STATES: CheckboxState[] = ["on", "off", "state3"];

const meta = {
  title: "UI/Checkbox",
  component: Checkbox,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  argTypes: {
    state: { control: "select", options: ALL_STATES },
    className: { control: false },
  },
  args: {
    state: "on",
  },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 기본 렌더링 — Controls로 state 변경 가능 */
export const Playground: Story = {
  play: async ({ canvasElement }) => {
    const svg = canvasElement.querySelector("svg");
    await expect(svg).toBeInTheDocument();
  },
};

/** state="on" — 브랜드 배경 + 체크 */
export const On: Story = { args: { state: "on" } };

/** state="off" — 비활성 배경 + 체크 */
export const Off: Story = { args: { state: "off" } };

/** state="state3" — on과 시각적으로 동일한 세 번째 상태 */
export const State3: Story = { args: { state: "state3" } };

/** 세 가지 state를 한눈에 비교 */
export const Gallery: Story = {
  render: () => (
    <div
      style={{
        display: "flex",
        gap: "var(--spacing-24)",
        alignItems: "center",
      }}
    >
      {ALL_STATES.map((state) => (
        <div
          key={state}
          data-testid={`checkbox-${state}`}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "var(--spacing-8)",
          }}
        >
          <Checkbox state={state} />
          <span
            style={{
              font: "var(--text-caption-lg-medium)",
              color: "var(--color-text-secondary)",
            }}
          >
            {state}
          </span>
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const state of ALL_STATES) {
      const item = canvas.getByTestId(`checkbox-${state}`);
      await expect(item).toBeInTheDocument();
      await expect(item.querySelector("svg")).toBeInTheDocument();
    }
  },
};
