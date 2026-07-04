import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "@storybook/test";
import { SearchBar } from "./SearchBar";

const meta = {
  title: "UI/SearchBar",
  component: SearchBar,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    value: { control: "text" },
    placeholder: { control: "text" },
    disabled: { control: "boolean" },
    name: { control: "text" },
    width: { control: "text" },
    onChange: { action: "change" },
    className: { control: false },
  },
  args: {
    placeholder: "제목, 내용, 작성자",
    disabled: false,
    onChange: fn(),
  },
} satisfies Meta<typeof SearchBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 기본 검색창 (Controls로 placeholder/disabled 등 변경) */
export const Playground: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("searchbox", { name: "검색" });
    await expect(input).toBeInTheDocument();
    await expect(input).toHaveAttribute("placeholder", "제목, 내용, 작성자");
  },
};

/** 입력값이 있는 controlled 상태 */
export const WithValue: Story = {
  args: { value: "리액트" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("searchbox", { name: "검색" });
    await expect(input).toHaveValue("리액트");
  },
};

/** 비활성화 상태 */
export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("searchbox", { name: "검색" });
    await expect(input).toBeDisabled();
  },
};

/** placeholder 커스터마이즈 */
export const CustomPlaceholder: Story = {
  args: { placeholder: "닉네임으로 검색" },
};

/** 컨테이너 너비를 확장 (기본 240px 대신 100%) */
export const FullWidth: Story = {
  args: { width: "100%" },
  decorators: [
    (StoryComponent) => (
      <div style={{ width: "400px" }}>
        <StoryComponent />
      </div>
    ),
  ],
};

/** 실제 타이핑 상호작용 검증 (controlled value/onChange) */
export const Typing: Story = {
  render: (args) => {
    function Controlled() {
      const [value, setValue] = useState("");
      return (
        <SearchBar
          {...args}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            args.onChange?.(e);
          }}
        />
      );
    }
    return <Controlled />;
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("searchbox", { name: "검색" });
    await userEvent.type(input, "디자인 시스템");
    await expect(input).toHaveValue("디자인 시스템");
    await expect(args.onChange).toHaveBeenCalled();
  },
};
