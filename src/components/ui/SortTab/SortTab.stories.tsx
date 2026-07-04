import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "@storybook/test";
import { SortTab, type SortTabOption } from "./SortTab";

const options: SortTabOption[] = [
  { value: "popular", label: "인기순" },
  { value: "recent", label: "최신순" },
  { value: "views", label: "조회순" },
];

const meta = {
  title: "UI/SortTab",
  component: SortTab,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    options: { control: "object" },
    value: { control: "select", options: options.map((o) => o.value) },
    onChange: { action: "change" },
    className: { control: false },
  },
  args: {
    options,
    value: "popular",
    onChange: fn(),
  },
} satisfies Meta<typeof SortTab>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 기본 상태: 첫 번째 옵션("인기순") 선택 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const selected = canvas.getByRole("button", { name: "인기순" });
    await expect(selected).toHaveAttribute("aria-pressed", "true");
    const unselected = canvas.getByRole("button", { name: "최신순" });
    await expect(unselected).toHaveAttribute("aria-pressed", "false");
  },
};

/** 두 번째 옵션("최신순")이 선택된 상태 */
export const RecentSelected: Story = {
  args: { value: "recent" },
};

/** 옵션 2개만 있는 경우 (구분선 1개) */
export const TwoOptions: Story = {
  args: {
    options: options.slice(0, 2),
    value: "popular",
  },
};

/** 탭 클릭 시 onChange가 선택한 value와 함께 호출되는지 검증 */
export const ClickInteraction: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const recentTab = canvas.getByRole("button", { name: "최신순" });
    await userEvent.click(recentTab);
    await expect(args.onChange).toHaveBeenCalledWith("recent");
  },
};

/** 선택 상태를 컴포넌트 외부에서 직접 관리하는 controlled 예시 */
export const Controlled: Story = {
  render: () => {
    function ControlledSortTab() {
      const [value, setValue] = useState<string>(options[0].value);
      return <SortTab options={options} value={value} onChange={setValue} />;
    }
    return <ControlledSortTab />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const viewsTab = canvas.getByRole("button", { name: "조회순" });
    await userEvent.click(viewsTab);
    await expect(viewsTab).toHaveAttribute("aria-pressed", "true");
    const popularTab = canvas.getByRole("button", { name: "인기순" });
    await expect(popularTab).toHaveAttribute("aria-pressed", "false");
  },
};
