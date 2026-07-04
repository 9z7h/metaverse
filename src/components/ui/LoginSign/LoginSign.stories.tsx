import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, within } from "@storybook/test";
import { LoginSign } from "./LoginSign";

const meta = {
  title: "UI/LoginSign",
  component: LoginSign,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    text: { control: "text" },
    buttonText: { control: "text" },
    width: { control: "text" },
  },
  args: {
    text: "아직 피그마피디아 회원이 아니세요?",
    buttonText: "회원가입",
    width: "100%",
    onSignUp: fn(),
  },
} satisfies Meta<typeof LoginSign>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 기본 상태 — 안내 문구 + monolight 스타일 회원가입 버튼 */
export const Default: Story = {
  render: (args) => (
    <div style={{ width: "185px" }}>
      <LoginSign {...args} />
    </div>
  ),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText("아직 피그마피디아 회원이 아니세요?"),
    ).toBeInTheDocument();
    const button = canvas.getByRole("button", { name: "회원가입" });
    await expect(button).toBeInTheDocument();
    button.click();
    await expect(args.onSignUp).toHaveBeenCalledTimes(1);
  },
};

/** Figma 원본 프레임 너비(185px)로 고정 */
export const FixedWidth: Story = {
  args: { width: "185px" },
  render: (args) => <LoginSign {...args} />,
};

/** 커스텀 안내 문구/버튼 텍스트 */
export const CustomText: Story = {
  args: { text: "이미 계정이 있으신가요?", buttonText: "로그인 하기" },
  render: (args) => (
    <div style={{ width: "185px" }}>
      <LoginSign {...args} />
    </div>
  ),
};
