import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "@storybook/test";
import { Input } from "./Input";
import { Icon } from "../Icon";

const meta = {
  title: "UI/Input",
  component: Input,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    label: { control: "text" },
    error: { control: "text" },
    disabled: { control: "boolean" },
    placeholder: { control: "text" },
    leadingIcon: { control: false },
    trailingIcon: { control: false },
    className: { control: false },
    style: { control: false },
  },
  args: {
    label: "이메일",
    placeholder: "이메일을 입력하세요",
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 레이블만 있는 기본 상태 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByPlaceholderText("이메일을 입력하세요");
    await expect(input).toBeInTheDocument();
    await expect(input).not.toBeDisabled();
    await userEvent.type(input, "user@example.com");
    await expect(input).toHaveValue("user@example.com");
  },
};

/** 레이블 없는 입력 필드 */
export const NoLabel: Story = {
  args: { label: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText("이메일")).not.toBeInTheDocument();
  },
};

/** focus 시 브랜드 컬러 테두리로 전환 (onFocus/onBlur 인라인 스타일) */
export const Focused: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByPlaceholderText("이메일을 입력하세요");
    await userEvent.click(input);
    await expect(input).toHaveFocus();
  },
};

/** 에러 상태 — 테두리/메시지가 danger 토큰으로 표시 */
export const ErrorState: Story = {
  args: {
    error: "올바른 이메일 형식이 아닙니다.",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByPlaceholderText("이메일을 입력하세요");
    await expect(input).toHaveAttribute("aria-invalid", "true");
    const message = canvas.getByRole("alert");
    await expect(message).toHaveTextContent("올바른 이메일 형식이 아닙니다.");
  },
};

/** 왼쪽 아이콘 포함 */
export const WithLeadingIcon: Story = {
  args: {
    leadingIcon: <Icon name="search" size={20} />,
    label: "검색",
    placeholder: "검색어를 입력하세요",
  },
};

/** 오른쪽 아이콘 포함 */
export const WithTrailingIcon: Story = {
  args: {
    trailingIcon: <Icon name="close" size={20} />,
  },
};

/** 양쪽 아이콘 + 에러 상태 조합 */
export const IconsWithError: Story = {
  args: {
    leadingIcon: <Icon name="search" size={20} />,
    trailingIcon: <Icon name="close" size={20} />,
    error: "올바른 이메일 형식이 아닙니다.",
  },
};

/** 비활성화 상태 */
export const Disabled: Story = {
  args: {
    disabled: true,
    value: "user@example.com",
    leadingIcon: <Icon name="search" size={20} />,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByPlaceholderText("이메일을 입력하세요");
    await expect(input).toBeDisabled();
  },
};

/** 모든 상태를 한눈에 비교 */
export const AllStates: Story = {
  render: () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--spacing-24)",
        maxWidth: "360px",
      }}
    >
      <Input label="기본" placeholder="기본 상태" />
      <Input
        label="아이콘"
        placeholder="아이콘 포함"
        leadingIcon={<Icon name="search" size={20} />}
        trailingIcon={<Icon name="close" size={20} />}
      />
      <Input
        label="에러"
        placeholder="에러 상태"
        error="올바른 이메일 형식이 아닙니다."
      />
      <Input
        label="비활성화"
        placeholder="비활성화 상태"
        disabled
        value="user@example.com"
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("기본")).toBeInTheDocument();
    await expect(canvas.getByRole("alert")).toBeInTheDocument();
    await expect(canvas.getByPlaceholderText("비활성화 상태")).toBeDisabled();
  },
};
