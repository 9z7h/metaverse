import type { Meta, StoryObj } from "@storybook/react";
import { expect, within, userEvent } from "@storybook/test";
import { MemoryRouter } from "react-router-dom";
import { Write } from "./Write";

const meta = {
  title: "Pages/Write",
  component: Write,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Bk8GPQ5r1K1A4XvKRBEUKS/?node-id=764-2245",
    },
  },
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={["/write"]}>
        <Story />
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof Write>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 게시글 쓰기 — 네비게이션 + 뒤로가기 + 헤더 + 제목/본문 입력 + 등록하기 */
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
      canvas.getByRole("heading", { name: "게시글 쓰기" }),
    ).toBeInTheDocument();

    await expect(
      canvas.getByPlaceholderText("제목을 입력해주세요."),
    ).toBeInTheDocument();
    await expect(
      canvas.getByText("게시글 내용을 입력해주세요."),
    ).toBeInTheDocument();

    await expect(
      canvas.getByRole("button", { name: "등록하기" }),
    ).toBeInTheDocument();
  },
};

/** 제목 입력 필드에 타이핑 */
export const TypingTitle: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const titleInput = canvas.getByPlaceholderText("제목을 입력해주세요.");
    await userEvent.type(titleInput, "첫 게시글입니다");
    await expect(titleInput).toHaveValue("첫 게시글입니다");
  },
};
