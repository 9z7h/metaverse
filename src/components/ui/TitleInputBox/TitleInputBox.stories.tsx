import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "@storybook/test";
import { TitleInputBox } from "./TitleInputBox";

const meta = {
  title: "UI/TitleInputBox",
  component: TitleInputBox,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    value: { control: "text" },
    placeholder: { control: "text" },
    disabled: { control: "boolean" },
    width: { control: "text" },
  },
  args: {
    placeholder: "제목을 입력해주세요.",
    disabled: false,
    width: "100%",
    onChange: fn(),
  },
} satisfies Meta<typeof TitleInputBox>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 기본 상태 — 값 없음, placeholder 노출 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByPlaceholderText("제목을 입력해주세요.");
    await expect(input).toBeInTheDocument();
    await expect(input).not.toBeDisabled();
  },
};

/** 값이 채워진 상태 */
export const WithValue: Story = {
  args: { value: "패스트캠퍼스 강의 후기" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByDisplayValue("패스트캠퍼스 강의 후기");
    await expect(input).toBeInTheDocument();
  },
};

/** 커스텀 placeholder */
export const CustomPlaceholder: Story = {
  args: { placeholder: "영상 제목을 입력하세요" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByPlaceholderText("영상 제목을 입력하세요"),
    ).toBeInTheDocument();
  },
};

/** 비활성 상태 */
export const Disabled: Story = {
  args: { disabled: true, value: "수정할 수 없는 제목" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByDisplayValue("수정할 수 없는 제목");
    await expect(input).toBeDisabled();
  },
};

/** Figma 프레임 최대 너비(840px)로 고정 */
export const FixedWidth: Story = {
  args: { width: "840px" },
};

/** 사용자 입력 시 onChange 호출 확인 */
export const TypingCallsOnChange: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByPlaceholderText("제목을 입력해주세요.");
    await userEvent.type(input, "안녕");
    await expect(args.onChange).toHaveBeenCalled();
  },
};
