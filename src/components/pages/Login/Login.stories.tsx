import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "@storybook/test";
import { Login } from "./Login";

const meta = {
  title: "Pages/Login",
  component: Login,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Bk8GPQ5r1K1A4XvKRBEUKS/?node-id=781-4699",
    },
  },
} satisfies Meta<typeof Login>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 커뮤니티 로그인 — 로고 + 이메일/비밀번호 입력 + 로그인 버튼 + 구글 로그인 + 하단 안내 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.getByRole("img", { name: "FigmaPedia" }),
    ).toBeInTheDocument();

    await expect(canvas.getByText("이메일")).toBeInTheDocument();
    await expect(canvas.getByText("비밀번호")).toBeInTheDocument();

    await expect(
      canvas.getByRole("button", { name: "로그인" }),
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole("button", { name: "구글로 로그인 하기" }),
    ).toBeInTheDocument();

    await expect(canvas.getByText("로그인 유지")).toBeInTheDocument();
    await expect(
      canvas.getByRole("button", { name: "비밀번호 찾기" }),
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole("button", { name: "회원가입" }),
    ).toBeInTheDocument();
  },
};
