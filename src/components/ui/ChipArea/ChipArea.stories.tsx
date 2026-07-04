import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "@storybook/test";
import { ChipArea, type ChipAreaOption, type ChipAreaProps } from "./ChipArea";

const SAMPLE_OPTIONS: ChipAreaOption[] = [
  { value: "food", label: "맛집" },
  { value: "travel", label: "여행" },
  { value: "daily", label: "일상" },
  { value: "study", label: "스터디" },
];

/** Storybook에서 실제 선택 동작을 보여주기 위한 controlled 래퍼. */
function ControlledChipArea({
  initialSelected = [],
  ...rest
}: Omit<ChipAreaProps, "selectedValues" | "onChange"> & {
  initialSelected?: string[];
}) {
  const [selected, setSelected] = useState<string[]>(initialSelected);
  return (
    <ChipArea {...rest} selectedValues={selected} onChange={setSelected} />
  );
}

const meta = {
  title: "UI/ChipArea",
  component: ChipArea,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    singleSelect: { control: "boolean" },
    options: { control: false },
    selectedValues: { control: false },
    onChange: { control: false },
  },
  args: {
    options: SAMPLE_OPTIONS,
    singleSelect: false,
  },
} satisfies Meta<typeof ChipArea>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 정적 예시 — 아무 것도 선택되지 않은 초기 상태 */
export const Empty: Story = {
  args: { selectedValues: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const options = canvas.getAllByRole("option");
    await expect(options).toHaveLength(SAMPLE_OPTIONS.length);
    for (const option of options) {
      await expect(option).toHaveAttribute("aria-selected", "false");
    }
  },
};

/** 정적 예시 — 일부 값이 미리 선택된 상태 (controlled) */
export const PreSelected: Story = {
  args: { selectedValues: ["travel", "study"] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const travel = canvas.getByRole("option", { name: "여행" });
    const food = canvas.getByRole("option", { name: "맛집" });
    await expect(travel).toHaveAttribute("aria-selected", "true");
    await expect(food).toHaveAttribute("aria-selected", "false");
  },
};

/** 다중 선택(singleSelect=false) — 클릭할 때마다 선택 값이 토글되고 누적된다 */
export const MultiSelectInteractive: Story = {
  render: (args) => <ControlledChipArea {...args} />,
  args: { singleSelect: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const food = canvas.getByRole("option", { name: "맛집" });
    const travel = canvas.getByRole("option", { name: "여행" });

    await expect(food).toHaveAttribute("aria-selected", "false");

    await userEvent.click(food);
    await expect(food).toHaveAttribute("aria-selected", "true");

    await userEvent.click(travel);
    await expect(travel).toHaveAttribute("aria-selected", "true");
    // 다중 선택이므로 이전 선택도 그대로 유지된다
    await expect(food).toHaveAttribute("aria-selected", "true");

    await userEvent.click(food);
    await expect(food).toHaveAttribute("aria-selected", "false");
  },
};

/** 단일 선택(singleSelect=true) — 한 번에 하나만 선택되고, 다시 클릭하면 해제된다 */
export const SingleSelectInteractive: Story = {
  render: (args) => <ControlledChipArea {...args} />,
  args: { singleSelect: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const food = canvas.getByRole("option", { name: "맛집" });
    const travel = canvas.getByRole("option", { name: "여행" });

    await userEvent.click(food);
    await expect(food).toHaveAttribute("aria-selected", "true");

    await userEvent.click(travel);
    await expect(travel).toHaveAttribute("aria-selected", "true");
    // 단일 선택이므로 이전 선택은 자동 해제된다
    await expect(food).toHaveAttribute("aria-selected", "false");

    await userEvent.click(travel);
    await expect(travel).toHaveAttribute("aria-selected", "false");
  },
};

/** listbox의 aria-multiselectable이 singleSelect 값에 맞게 반영되는지 확인 */
export const AriaMultiselectable: Story = {
  args: { singleSelect: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const listbox = canvas.getByRole("listbox");
    await expect(listbox).toHaveAttribute("aria-multiselectable", "false");
  },
};
