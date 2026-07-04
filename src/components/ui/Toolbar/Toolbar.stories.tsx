import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "@storybook/test";
import { Toolbar } from "./Toolbar";

const sortOptions = [
  { value: "latest", label: "최신순" },
  { value: "popular", label: "인기순" },
  { value: "oldest", label: "오래된순" },
];

const meta = {
  title: "UI/Toolbar",
  component: Toolbar,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    sortValue: {
      control: "select",
      options: sortOptions.map((option) => option.value),
    },
    searchValue: { control: "text" },
    searchPlaceholder: { control: "text" },
    searchDisabled: { control: "boolean" },
    width: { control: "text" },
  },
  args: {
    sortOptions,
    sortValue: "latest",
    onSortChange: fn(),
    searchValue: "",
    onSearchChange: fn(),
    searchDisabled: false,
    width: "840px",
  },
} satisfies Meta<typeof Toolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 기본 상태 — 첫 번째 정렬 옵션 선택 + 검색창 활성 */
export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const latestTab = canvas.getByRole("button", { name: "최신순" });
    await expect(latestTab).toHaveAttribute("aria-pressed", "true");
    const popularTab = canvas.getByRole("button", { name: "인기순" });
    await expect(popularTab).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(popularTab);
    await expect(args.onSortChange).toHaveBeenCalledWith("popular");
  },
};

/** 다른 정렬 옵션이 선택된 상태 */
export const PopularSelected: Story = {
  args: { sortValue: "popular" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const popularTab = canvas.getByRole("button", { name: "인기순" });
    await expect(popularTab).toHaveAttribute("aria-pressed", "true");
  },
};

/** 검색 필드에 커스텀 placeholder 적용 */
export const CustomSearchPlaceholder: Story = {
  args: { searchPlaceholder: "영상 검색" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByPlaceholderText("영상 검색")).toBeInTheDocument();
  },
};

/** 검색 필드 비활성화 */
export const SearchDisabled: Story = {
  args: { searchDisabled: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const search = canvas.getByPlaceholderText("제목, 내용, 작성자");
    await expect(search).toBeDisabled();
  },
};

/** 검색 필드에 값이 채워진 상태 */
export const WithSearchValue: Story = {
  args: { searchValue: "패스트캠퍼스" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByDisplayValue("패스트캠퍼스")).toBeInTheDocument();
  },
};

/** 컨테이너 너비를 100%로 확장 */
export const FullWidth: Story = {
  args: { width: "100%" },
  render: (args) => (
    <div style={{ width: "100%", maxWidth: "1024px" }}>
      <Toolbar {...args} />
    </div>
  ),
};
