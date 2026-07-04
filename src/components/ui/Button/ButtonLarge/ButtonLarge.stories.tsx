import { Fragment } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "@storybook/test";
import { ButtonLarge } from "./ButtonLarge";
import type { ButtonStyle, ButtonType } from "../buttonStyle";

const allStyles: ButtonStyle[] = [
  "core",
  "corelight",
  "mono",
  "monolight",
  "warning",
  "warninglight",
  "outline",
];
const allTypes: ButtonType[] = ["label", "icon"];

const meta = {
  title: "UI/Button/Large",
  component: ButtonLarge,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  argTypes: {
    style: { control: "select", options: allStyles },
    type: { control: "select", options: allTypes },
    disabled: { control: "boolean" },
    icon: {
      control: "select",
      options: [undefined, "search", "heart_fill", "check", "close"],
    },
    children: { control: "text" },
  },
  args: {
    style: "core",
    type: "label",
    disabled: false,
    children: "버튼",
  },
} satisfies Meta<typeof ButtonLarge>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 컨트롤로 style/type/disabled/icon을 자유롭게 조합해보는 기본 story */
export const Playground: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "버튼" });
    await expect(button).toBeInTheDocument();
    await expect(button).not.toBeDisabled();
  },
};

/** style="core" — 브랜드 배경 + onbrand 텍스트 */
export const Core: Story = { args: { style: "core", children: "Core" } };

/** style="corelight" — 브랜드 서브틀 배경 */
export const CoreLight: Story = {
  args: { style: "corelight", children: "Core Light" },
};

/** style="mono" — 짙은 단색 배경 */
export const Mono: Story = { args: { style: "mono", children: "Mono" } };

/** style="monolight" — 무채색 서브틀 배경 */
export const MonoLight: Story = {
  args: { style: "monolight", children: "Mono Light" },
};

/** style="warning" — 위험 배경 */
export const Warning: Story = {
  args: { style: "warning", children: "Warning" },
};

/** style="warninglight" — 위험 서브틀 배경 */
export const WarningLight: Story = {
  args: { style: "warninglight", children: "Warning Light" },
};

/** style="outline" — 테두리만 있는 버튼 */
export const Outline: Story = {
  args: { style: "outline", children: "Outline" },
};

/** type="label" + 앞쪽 아이콘 */
export const WithLeadingIcon: Story = {
  args: {
    style: "core",
    type: "label",
    icon: "heart_fill",
    children: "찜하기",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "찜하기" });
    await expect(button).toBeInTheDocument();
    await expect(button.querySelector("svg")).toBeInTheDocument();
  },
};

/** type="icon" — 아이콘만 있는 정사각형 버튼 (접근성을 위해 aria-label 필수) */
export const IconOnly: Story = {
  args: {
    style: "core",
    type: "icon",
    icon: "search",
    children: undefined,
    "aria-label": "검색",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "검색" });
    await expect(button).toBeInTheDocument();
    await expect(button).toHaveAttribute("aria-label", "검색");
  },
};

/** disabled — 상호작용 차단 + 30% 불투명도 */
export const Disabled: Story = {
  args: { style: "core", children: "Disabled", disabled: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "Disabled" });
    await expect(button).toBeDisabled();
  },
};

/** style × type × disabled 전체 조합 한눈에 보기 */
export const Gallery: Story = {
  render: () => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "var(--spacing-24) repeat(4, auto)",
        gap: "var(--spacing-16)",
        alignItems: "center",
        color: "var(--color-text-primary)",
      }}
    >
      <span />
      <span>label</span>
      <span>label disabled</span>
      <span>icon</span>
      <span>icon disabled</span>
      {allStyles.map((style) => (
        <Fragment key={style}>
          <span style={{ justifySelf: "start" }}>{style}</span>
          <ButtonLarge style={style} type="label">
            버튼
          </ButtonLarge>
          <ButtonLarge style={style} type="label" disabled>
            버튼
          </ButtonLarge>
          <ButtonLarge
            style={style}
            type="icon"
            icon="search"
            aria-label={`${style} 검색`}
          />
          <ButtonLarge
            style={style}
            type="icon"
            icon="search"
            aria-label={`${style} 검색 비활성`}
            disabled
          />
        </Fragment>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // 7 styles x 2 types x 2 disabled states = 28 buttons rendered
    const buttons = canvas.getAllByRole("button");
    await expect(buttons).toHaveLength(28);
    const coreIcon = canvas.getByRole("button", { name: "core 검색" });
    await expect(coreIcon).toBeInTheDocument();
    const outlineDisabled = canvas.getByRole("button", {
      name: "outline 검색 비활성",
    });
    await expect(outlineDisabled).toBeDisabled();
  },
};
