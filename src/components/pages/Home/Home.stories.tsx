import type { Meta, StoryObj } from "@storybook/react";
import { expect, within, userEvent } from "@storybook/test";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { Home } from "./Home";

const TITLE = "피그마 커뮤니티는 역시 피그마피디아";

const meta = {
  title: "Pages/Home",
  component: Home,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Bk8GPQ5r1K1A4XvKRBEUKS/?node-id=2098-567",
    },
  },
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<Story />} />
          <Route path="/view/:id" element={<div>View 페이지</div>} />
          <Route path="/write" element={<div>Write 페이지</div>} />
        </Routes>
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof Home>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 커뮤니티 홈 — 네비게이션 + 필터 헤더 + 게시글 6개 */
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
      canvas.getByRole("heading", { name: "전체 게시글" }),
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole("button", { name: "글쓰기" }),
    ).toBeInTheDocument();

    // 게시글 6개
    const titles = canvas.getAllByText("피그마 커뮤니티는 역시 피그마피디아");
    await expect(titles).toHaveLength(6);

    // 공지사항/디자인 칩
    await expect(canvas.getAllByText("공지사항").length).toBeGreaterThan(0);
    await expect(canvas.getAllByText("디자인").length).toBeGreaterThan(0);

    // 구분선: 헤더 뒤 1개 + 카드마다 1개(6개) = 7개 (Figma 원본 기준)
    const dividers = canvas.getAllByRole("separator");
    await expect(dividers).toHaveLength(7);

    // 첫 번째 게시글만 클릭 가능한 링크여야 함
    const links = canvas.getAllByRole("link");
    await expect(links).toHaveLength(1);
    await expect(links[0]).toHaveAccessibleName(TITLE);
  },
};

/** 첫 번째 게시글 클릭 시 /view/:id 로 이동 */
export const NavigateToView: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const firstPostLink = canvas.getAllByRole("link")[0];
    await userEvent.click(firstPostLink);
    await expect(canvas.getByText("View 페이지")).toBeInTheDocument();
  },
};

/** "글쓰기" 버튼 클릭 시 /write 로 이동 */
export const NavigateToWrite: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "글쓰기" }));
    await expect(canvas.getByText("Write 페이지")).toBeInTheDocument();
  },
};
