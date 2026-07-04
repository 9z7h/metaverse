import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "@storybook/test";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { HomeDesign } from "./HomeDesign";

const meta = {
  title: "Pages/HomeDesign",
  component: HomeDesign,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={["/home-design"]}>
        <Routes>
          <Route path="/home-design" element={<Story />} />
        </Routes>
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof HomeDesign>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 디자인 팁 홈 베리에이션 — 네비게이션 + 필터 헤더 + 게시글 3개 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // 네비게이션
    await expect(
      canvas.getByRole("navigation", { name: "주요 메뉴" }),
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole("button", { name: "로그아웃" }),
    ).toBeInTheDocument();

    // 필터 헤더
    await expect(
      canvas.getByRole("heading", { name: "실시간 게시글" }),
    ).toBeInTheDocument();

    // 게시글 3개 제목
    await expect(
      canvas.getByText("Auto Layout 완벽 가이드"),
    ).toBeInTheDocument();
    await expect(
      canvas.getByText("디자인 토큰, 왜 써야 할까?"),
    ).toBeInTheDocument();
    await expect(
      canvas.getByText("Figma Variables로 다크모드 만들기"),
    ).toBeInTheDocument();

    // 칩
    await expect(canvas.getAllByText("튜토리얼").length).toBe(2);
    await expect(canvas.getAllByText("리소스").length).toBe(1);
    await expect(canvas.getAllByText("AI").length).toBe(1);

    // 구분선: 헤더 뒤 1개 + 카드마다 1개(3개) = 4개
    const dividers = canvas.getAllByRole("separator");
    await expect(dividers).toHaveLength(4);
  },
};
