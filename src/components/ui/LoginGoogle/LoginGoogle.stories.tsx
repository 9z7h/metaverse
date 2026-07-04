import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "@storybook/test";
import { LoginGoogle } from "./LoginGoogle";

const meta = {
  title: "UI/LoginGoogle",
  component: LoginGoogle,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    text: { control: "text" },
    width: { control: "text" },
    className: { control: false },
  },
  args: {
    width: "345px",
    onClick: fn(),
  },
} satisfies Meta<typeof LoginGoogle>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 기본 문구("구글로 로그인 하기") */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "구글로 로그인 하기" });
    await expect(button).toBeInTheDocument();
  },
};

/** 커스텀 문구 */
export const CustomText: Story = {
  args: { text: "Google 계정으로 계속하기" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("button", { name: "Google 계정으로 계속하기" }),
    ).toBeInTheDocument();
  },
};

/** 클릭 시 onClick 핸들러 호출 검증 */
export const InteractionTest: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "구글로 로그인 하기" });
    await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalledTimes(1);
  },
};

/** 컨테이너 너비에 맞춰 늘어나는 100% 너비(기본값) */
export const FullWidth: Story = {
  args: { width: "100%" },
  render: (args) => (
    <div style={{ width: "480px" }}>
      <LoginGoogle {...args} />
    </div>
  ),
};
