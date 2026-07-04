import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, within } from "@storybook/test";
import { NavigationBar } from "./NavigationBar";

const meta = {
  title: "UI/NavigationBar",
  component: NavigationBar,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
  argTypes: {
    state: {
      control: "select",
      options: ["login", "logout"],
    },
    category: { control: "text" },
  },
  args: {
    state: "login",
    category: "커뮤니티",
    onCategoryClick: fn(),
    onAuthClick: fn(),
  },
} satisfies Meta<typeof NavigationBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 기본 상태 — state="login" → 우측 버튼 "로그인" */
export const Login: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const nav = canvas.getByRole("navigation", { name: "주요 메뉴" });
    await expect(nav).toBeInTheDocument();
    const category = canvas.getByRole("button", { name: "커뮤니티" });
    await expect(category).toBeInTheDocument();
    const authButton = canvas.getByRole("button", { name: "로그인" });
    await expect(authButton).toBeInTheDocument();
    authButton.click();
    await expect(args.onAuthClick).toHaveBeenCalledTimes(1);
    category.click();
    await expect(args.onCategoryClick).toHaveBeenCalledTimes(1);
  },
};

/** state="logout" → 우측 버튼 "로그아웃" */
export const Logout: Story = {
  args: { state: "logout" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const authButton = canvas.getByRole("button", { name: "로그아웃" });
    await expect(authButton).toBeInTheDocument();
  },
};

/** 커스텀 카테고리 라벨 */
export const CustomCategory: Story = {
  args: { category: "인기 게시글" },
};
