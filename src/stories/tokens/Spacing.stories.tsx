import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "@storybook/test";

const SPACING_TOKENS = [
  "--spacing-0",
  "--spacing-2",
  "--spacing-4",
  "--spacing-6",
  "--spacing-8",
  "--spacing-12",
  "--spacing-16",
  "--spacing-20",
  "--spacing-24",
  "--spacing-32",
  "--spacing-40",
  "--spacing-48",
  "--spacing-64",
];

function readTokenValue(varName: string) {
  if (typeof document === "undefined") return "";
  return getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
}

function SpacingRow({ varName }: { varName: string }) {
  const value = readTokenValue(varName);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--spacing-16)",
      }}
    >
      <span
        style={{
          width: "160px",
          font: "var(--text-caption-lg-medium)",
          color: "var(--color-text-primary)",
        }}
      >
        {varName}
      </span>
      <div
        style={{
          width: "var(--spacing-64)",
          height: "var(--spacing-24)",
          border: "1px dashed var(--color-border-default)",
          display: "flex",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <div
          role="img"
          aria-label={`${varName} box`}
          data-token={varName}
          style={{
            width: `var(${varName})`,
            height: "100%",
            background: "var(--color-interactive-primary)",
          }}
        />
      </div>
      <span
        style={{
          font: "var(--text-caption-lg-medium)",
          color: "var(--color-text-secondary)",
        }}
      >
        {value || "—"}
      </span>
    </div>
  );
}

function SpacingScale({ tokens }: { tokens: string[] }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--spacing-12)",
        background: "var(--color-background-default)",
      }}
    >
      {tokens.map((varName) => (
        <SpacingRow key={varName} varName={varName} />
      ))}
    </div>
  );
}

const meta = {
  title: "Foundation/Spacing",
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Bk8GPQ5r1K1A4XvKRBEUKS/?node-id=4035-1488",
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** spacing/0 ~ spacing/64 전체 스케일 — 변수명 + 박스 + px 값 */
export const AllSpacing: Story = {
  render: () => <SpacingScale tokens={SPACING_TOKENS} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const box = canvas.getByLabelText("--spacing-24 box");
    await expect(box).toBeInTheDocument();
    await expect(box).toHaveAttribute("data-token", "--spacing-24");
    await expect(canvas.getByText("--spacing-24")).toBeInTheDocument();
  },
};
