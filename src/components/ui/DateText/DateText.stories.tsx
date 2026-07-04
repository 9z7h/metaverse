import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "@storybook/test";
import { DateText } from "./DateText";

const meta = {
  title: "UI/DateText",
  component: DateText,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  argTypes: {
    value: { control: "text" },
    className: { control: false },
  },
  args: {
    value: "26.05.06",
  },
} satisfies Meta<typeof DateText>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 기본 날짜 라벨 (`body/sm/regular`, tertiary 텍스트) */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const label = canvas.getByText("26.05.06");
    await expect(label).toBeInTheDocument();
    await expect(label.tagName.toLowerCase()).toBe("span");
  },
};

/** 다른 날짜 문자열도 그대로 렌더 */
export const AnotherDate: Story = {
  args: { value: "25.12.31" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("25.12.31")).toBeInTheDocument();
  },
};

/** 여러 날짜를 한눈에 비교 */
export const Gallery: Story = {
  render: () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--spacing-8)",
      }}
    >
      <DateText value="26.05.06" />
      <DateText value="26.01.01" />
      <DateText value="25.12.31" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("26.05.06")).toBeInTheDocument();
    await expect(canvas.getByText("26.01.01")).toBeInTheDocument();
    await expect(canvas.getByText("25.12.31")).toBeInTheDocument();
  },
};
