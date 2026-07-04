import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "@storybook/test";
import { LoginBottom } from "./LoginBottom";

const meta = {
  title: "UI/LoginBottom",
  component: LoginBottom,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    width: { control: "text" },
    keepLoginLabel: { control: "text" },
    checkboxState: {
      control: "select",
      options: ["on", "off", "state3"],
    },
    findPasswordText: { control: "text" },
    signText: { control: "text" },
    signUpText: { control: "text" },
    className: { control: false },
  },
  args: {
    width: "320px",
    onFindPassword: fn(),
    onSignUp: fn(),
  },
} satisfies Meta<typeof LoginBottom>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 기본 상태 — 로그인 유지 체크박스 on + 기본 문구 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("로그인 유지")).toBeInTheDocument();
    await expect(
      canvas.getByRole("button", { name: "비밀번호 찾기" }),
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole("button", { name: "회원가입" }),
    ).toBeInTheDocument();
  },
};

/** 체크박스 off 상태 */
export const CheckboxOff: Story = {
  args: { checkboxState: "off" },
};

/** 체크박스 state3 상태 */
export const CheckboxState3: Story = {
  args: { checkboxState: "state3" },
};

/** 커스텀 텍스트 전달 */
export const CustomText: Story = {
  args: {
    keepLoginLabel: "로그인 상태 유지",
    findPasswordText: "PW 찾기",
    signText: "아직 계정이 없으신가요?",
    signUpText: "가입하기",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("로그인 상태 유지")).toBeInTheDocument();
    await expect(
      canvas.getByRole("button", { name: "PW 찾기" }),
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole("button", { name: "가입하기" }),
    ).toBeInTheDocument();
  },
};

/** 버튼 클릭 시 각 핸들러가 호출되는지 검증 */
export const InteractionTest: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "비밀번호 찾기" }),
    );
    await expect(args.onFindPassword).toHaveBeenCalledTimes(1);
    await userEvent.click(canvas.getByRole("button", { name: "회원가입" }));
    await expect(args.onSignUp).toHaveBeenCalledTimes(1);
  },
};

/** 100% 너비 (기본값) */
export const FullWidth: Story = {
  args: { width: "100%" },
  render: (args) => (
    <div style={{ width: "480px" }}>
      <LoginBottom {...args} />
    </div>
  ),
};
