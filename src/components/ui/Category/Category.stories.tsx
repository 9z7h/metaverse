import { Fragment } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "@storybook/test";
import { Category } from "./Category";
import type { CategoryState } from "./Category";

const allStates: CategoryState[] = ["default", "selected"];

const meta = {
  title: "UI/Category",
  component: Category,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  argTypes: {
    state: { control: "select", options: allStates },
    children: { control: "text" },
  },
  args: {
    state: "default",
    children: "카테고리",
  },
} satisfies Meta<typeof Category>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 컨트롤로 state/children을 자유롭게 조합해보는 기본 story */
export const Playground: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "카테고리" });
    await expect(button).toBeInTheDocument();
    await expect(button).toHaveAttribute("aria-pressed", "false");
  },
};

/** state="default" — 비활성 텍스트 색, 밑줄 없음 */
export const Default: Story = {
  args: { state: "default", children: "인기" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "인기" });
    await expect(button).toHaveAttribute("aria-pressed", "false");
  },
};

/** state="selected" — primary 텍스트 색 + 밑줄(box-shadow) */
export const Selected: Story = {
  args: { state: "selected", children: "최신" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "최신" });
    await expect(button).toHaveAttribute("aria-pressed", "true");
  },
};

/** 여러 개의 Category를 나열해 탭처럼 쓰는 실사용 예시 */
export const TabRow: Story = {
  render: () => (
    <div style={{ display: "flex", gap: "var(--spacing-16)" }}>
      <Category state="selected">인기</Category>
      <Category state="default">최신</Category>
      <Category state="default">추천</Category>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const selected = canvas.getByRole("button", { name: "인기" });
    const unselected = canvas.getByRole("button", { name: "최신" });
    await expect(selected).toHaveAttribute("aria-pressed", "true");
    await expect(unselected).toHaveAttribute("aria-pressed", "false");
  },
};

/** default / selected 두 상태 한눈에 보기 */
export const Gallery: Story = {
  render: () => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "var(--spacing-24) auto",
        gap: "var(--spacing-16)",
        alignItems: "center",
        color: "var(--color-text-primary)",
      }}
    >
      {allStates.map((state) => (
        <Fragment key={state}>
          <span style={{ justifySelf: "start" }}>{state}</span>
          <Category state={state}>카테고리</Category>
        </Fragment>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const buttons = canvas.getAllByRole("button", { name: "카테고리" });
    await expect(buttons).toHaveLength(2);
    await expect(buttons[0]).toHaveAttribute("aria-pressed", "false");
    await expect(buttons[1]).toHaveAttribute("aria-pressed", "true");
  },
};
