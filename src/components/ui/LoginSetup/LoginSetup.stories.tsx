import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, within } from "@storybook/test";
import { LoginSetup } from "./LoginSetup";

const meta = {
  title: "UI/LoginSetup",
  component: LoginSetup,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    label: { control: "text" },
    buttonText: { control: "text" },
    width: { control: "text" },
    checkboxState: {
      control: "select",
      options: ["on", "off", "state3"],
    },
  },
  args: {
    label: "로그인 유지",
    buttonText: "비밀번호 찾기",
    width: "100%",
    checkboxState: "on",
    onButtonClick: fn(),
  },
} satisfies Meta<typeof LoginSetup>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 기본 상태 — 체크박스 on + outline 스타일 버튼 */
export const Default: Story = {
  render: (args) => (
    <div style={{ width: "297px" }}>
      <LoginSetup {...args} />
    </div>
  ),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("로그인 유지")).toBeInTheDocument();
    const button = canvas.getByRole("button", { name: "비밀번호 찾기" });
    await expect(button).toBeInTheDocument();
    button.click();
    await expect(args.onButtonClick).toHaveBeenCalledTimes(1);
  },
};

/** checkboxState="off" — 비활성 배경의 체크박스 */
export const CheckboxOff: Story = {
  args: { checkboxState: "off" },
  render: (args) => (
    <div style={{ width: "297px" }}>
      <LoginSetup {...args} />
    </div>
  ),
};

/** checkboxState="state3" — on과 시각적으로 동일한 보조 상태 */
export const CheckboxState3: Story = {
  args: { checkboxState: "state3" },
  render: (args) => (
    <div style={{ width: "297px" }}>
      <LoginSetup {...args} />
    </div>
  ),
};

/** Figma 원본 프레임 너비(297px)로 고정 */
export const FixedWidth: Story = {
  args: { width: "297px" },
  render: (args) => <LoginSetup {...args} />,
};

/** 커스텀 라벨/버튼 텍스트 */
export const CustomText: Story = {
  args: { label: "자동 로그인", buttonText: "아이디 찾기" },
  render: (args) => (
    <div style={{ width: "297px" }}>
      <LoginSetup {...args} />
    </div>
  ),
};
