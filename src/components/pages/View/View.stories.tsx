import type { Meta, StoryObj } from "@storybook/react";
import { expect, within, userEvent } from "@storybook/test";
import { MemoryRouter } from "react-router-dom";
import { View } from "./View";

const meta = {
  title: "Pages/View",
  component: View,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Bk8GPQ5r1K1A4XvKRBEUKS/?node-id=783-3370",
    },
  },
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={["/view/1"]}>
        <Story />
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof View>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 게시글 상세 — 네비게이션 + 뒤로가기 + 제목/날짜 + 본문 + 통계 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.getByRole("navigation", { name: "주요 메뉴" }),
    ).toBeInTheDocument();

    await expect(
      canvas.getByRole("button", { name: "뒤로가기" }),
    ).toBeInTheDocument();

    await expect(
      canvas.getByRole("heading", { name: "피그마피디아 짱짱" }),
    ).toBeInTheDocument();
    await expect(canvas.getByText("피튜")).toBeInTheDocument();
    await expect(canvas.getByText("26.05.06")).toBeInTheDocument();

    await expect(canvas.getByText("56,654")).toBeInTheDocument();
    await expect(canvas.getByText("99,999")).toBeInTheDocument();

    await expect(canvas.getAllByRole("separator").length).toBeGreaterThan(0);
  },
};

/** 좋아요 하트 클릭 시 empty ↔ fill 토글 */
export const LikeToggle: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const likeButton = canvas.getByRole("button", { name: "좋아요" });

    await expect(likeButton).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(likeButton);
    await expect(likeButton).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(likeButton);
    await expect(likeButton).toHaveAttribute("aria-pressed", "false");
  },
};

/** 북마크 버튼 클릭 시 default ↔ filled 토글 */
export const BookmarkToggle: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const bookmarkButton = canvas.getByRole("button", { name: "북마크" });

    await expect(bookmarkButton).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(bookmarkButton);
    await expect(bookmarkButton).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(bookmarkButton);
    await expect(bookmarkButton).toHaveAttribute("aria-pressed", "false");
  },
};
