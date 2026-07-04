import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "@storybook/test";
import { PostFilterHeader } from "./PostFilterHeader";
import type { SortTabOption } from "../SortTab";

const SORT_OPTIONS: SortTabOption[] = [
  { value: "latest", label: "최신순" },
  { value: "popular", label: "인기순" },
  { value: "comments", label: "댓글순" },
];

const meta = {
  title: "UI/PostFilterHeader",
  component: PostFilterHeader,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    title: { control: "text" },
    buttonLabel: { control: "text" },
    sortValue: { control: "text" },
    searchValue: { control: "text" },
    searchPlaceholder: { control: "text" },
    searchDisabled: { control: "boolean" },
    width: { control: "text" },
  },
  args: {
    title: "전체 게시글",
    buttonLabel: "글쓰기",
    sortOptions: SORT_OPTIONS,
    sortValue: "latest",
    width: "840px",
    onButtonClick: fn(),
  },
} satisfies Meta<typeof PostFilterHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 기본 상태 — 제목 + 글쓰기 버튼 + 정렬 탭(최신순 선택) + 검색창 */
export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("전체 게시글")).toBeInTheDocument();
    const button = canvas.getByRole("button", { name: "글쓰기" });
    await expect(button).toBeInTheDocument();
    await userEvent.click(button);
    await expect(args.onButtonClick).toHaveBeenCalledTimes(1);
  },
};

/** 커스텀 제목/버튼 라벨 */
export const CustomLabels: Story = {
  args: { title: "내가 쓴 글", buttonLabel: "새 글 등록" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("내가 쓴 글")).toBeInTheDocument();
    await expect(
      canvas.getByRole("button", { name: "새 글 등록" }),
    ).toBeInTheDocument();
  },
};

/** 검색창에 값이 채워진 상태 (searchValue 제어) */
export const WithSearchValue: Story = {
  args: { searchValue: "토큰" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("searchbox");
    await expect(input).toHaveValue("토큰");
  },
};

/** 검색창 비활성화 */
export const SearchDisabled: Story = {
  args: { searchDisabled: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("searchbox");
    await expect(input).toBeDisabled();
  },
};

/** 정렬 탭 변경 시 다른 옵션이 선택된 상태 */
export const PopularSortSelected: Story = {
  args: { sortValue: "popular" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("인기순")).toBeInTheDocument();
  },
};

/** 정렬 탭 클릭 시 onSortChange로 실제 선택값이 바뀌는 인터랙티브 예시 */
export const InteractiveSort: Story = {
  render: (args) => {
    function Controlled() {
      const [sortValue, setSortValue] = useState(args.sortValue);
      return (
        <PostFilterHeader
          {...args}
          sortValue={sortValue}
          onSortChange={setSortValue}
        />
      );
    }
    return <Controlled />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const popularTab = canvas.getByText("인기순");
    await userEvent.click(popularTab);
    await expect(popularTab).toBeInTheDocument();
  },
};

/** Figma 고정 폭(840px) 대신 컨테이너에 맞춰 100% 너비로 확장 */
export const FluidWidth: Story = {
  args: { width: "100%" },
};
