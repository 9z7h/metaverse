import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "@storybook/test";
import { SpaceSelect } from "./SpaceSelect";
import type { LibrarySpace } from "./SpaceSelect";

function Preview({ current: initial }: { current: LibrarySpace }) {
  const [current, setCurrent] = useState(initial);
  return (
    <div data-theme="library">
      <SpaceSelect current={current} onChange={setCurrent} />
    </div>
  );
}

const meta = {
  title: "Pages/Library/SpaceSelect",
  component: Preview,
  tags: ["autodocs"],
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Garden: Story = {
  args: { current: "garden" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText("숨돌림 뜰 · 쉬어 가는 중"));
    await userEvent.click(
      canvas.getByRole("button", { name: "먹빛각 · 서고 이동" }),
    );
    await expect(canvas.getByText("먹빛각 · 서고")).toBeInTheDocument();
  },
};
export const Library: Story = { args: { current: "library" } };
