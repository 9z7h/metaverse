import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "@storybook/test";

interface ColorGroupData {
  title: string;
  tokens: string[];
}

const COLOR_GROUPS: ColorGroupData[] = [
  {
    title: "Primitive / Gray",
    tokens: [
      "--color-gray-100",
      "--color-Gray-100",
      "--color-Gray-200",
      "--color-gray-300",
      "--color-gray-305",
      "--color-gray-340",
      "--color-gray-360",
      "--color-gray-400",
      "--color-gray-490",
      "--color-gray-500",
      "--color-gray-540",
      "--color-gray-600",
      "--color-gray-610",
      "--color-gray-700",
      "--color-gray-800",
      "--color-gray-850",
      "--color-gray-900",
      "--color-gray-1000",
      "--color-gray-1050",
    ],
  },
  {
    title: "Primitive / Blue",
    tokens: [
      "--color-blue-20",
      "--color-blue-50",
      "--color-blue-100",
      "--color-blue-120",
      "--color-blue-200",
      "--color-blue-280",
      "--color-blue-300",
      "--color-blue-400",
      "--color-blue-440",
      "--color-blue-500",
      "--color-blue-540",
      "--color-blue-600",
      "--color-blue-680",
      "--color-blue-700",
      "--color-blue-800",
      "--color-blue-900",
      "--color-blue-1000",
    ],
  },
  {
    title: "Primitive / Red",
    tokens: [
      "--color-red-100",
      "--color-red-200",
      "--color-red-300",
      "--color-red-400",
      "--color-red-500",
      "--color-red-600",
      "--color-red-700",
      "--color-red-800",
      "--color-red-900",
      "--color-red-1000",
    ],
  },
  {
    title: "Semantic / Text",
    tokens: [
      "--color-text-primary",
      "--color-text-secondary",
      "--color-text-tertiary",
      "--color-text-disabled",
      "--color-text-onbrand",
      "--color-text-Danger",
    ],
  },
  {
    title: "Semantic / Background",
    tokens: [
      "--color-background-default",
      "--color-background-Subtle",
      "--color-background-muted",
      "--color-background-brand",
      "--color-background-brandsubtle",
      "--color-background-danger",
      "--color-background-dangersubtle",
    ],
  },
  {
    title: "Semantic / Border",
    tokens: [
      "--color-border-default",
      "--color-border-strong",
      "--color-border-brand",
      "--color-border-danger",
    ],
  },
  {
    title: "Semantic / Interactive",
    tokens: [
      "--color-interactive-primary",
      "--color-interactive-primaryhover",
      "--color-interactive-destructive",
      "--color-interactive-destructivehover",
    ],
  },
  {
    title: "Semantic / Content",
    tokens: [
      "--color-content-strong",
      "--color-content-default",
      "--color-content-muted",
    ],
  },
  {
    title: "Brand / Google",
    tokens: [
      "--color-brand-google-red",
      "--color-brand-google-yellow",
      "--color-brand-google-blue",
      "--color-brand-google-green",
    ],
  },
  {
    title: "기타",
    tokens: ["--sds-color-background-neutral-default"],
  },
];

function readTokenValue(varName: string) {
  if (typeof document === "undefined") return "";
  return getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
}

function Swatch({ varName }: { varName: string }) {
  const value = readTokenValue(varName);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--spacing-8)",
        width: "160px",
      }}
    >
      <div
        role="img"
        aria-label={`${varName} swatch`}
        data-token={varName}
        style={{
          height: "64px",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--color-border-default)",
          background: `var(${varName})`,
        }}
      />
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span
          style={{
            font: "var(--text-caption-lg-medium)",
            color: "var(--color-text-primary)",
            wordBreak: "break-all",
          }}
        >
          {varName}
        </span>
        <span
          style={{
            font: "var(--text-caption-lg-medium)",
            color: "var(--color-text-secondary)",
          }}
        >
          {value || "—"}
        </span>
      </div>
    </div>
  );
}

function ColorGroup({ title, tokens }: ColorGroupData) {
  return (
    <section style={{ marginBottom: "var(--spacing-32)" }}>
      <h3
        style={{
          font: "var(--text-title-sm-bold)",
          color: "var(--color-content-strong)",
          marginBottom: "var(--spacing-16)",
        }}
      >
        {title}
      </h3>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--spacing-16)",
        }}
      >
        {tokens.map((varName) => (
          <Swatch key={varName} varName={varName} />
        ))}
      </div>
    </section>
  );
}

function ColorPalette({ groups }: { groups: ColorGroupData[] }) {
  return (
    <div style={{ background: "var(--color-background-default)" }}>
      {groups.map((group) => (
        <ColorGroup key={group.title} {...group} />
      ))}
    </div>
  );
}

const meta = {
  title: "Foundation/Colors",
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

/** 전체 색상 토큰 (Primitive + Semantic + Brand) 한눈에 보기 */
export const AllColors: Story = {
  render: () => <ColorPalette groups={COLOR_GROUPS} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const primaryTextSwatch = canvas.getByLabelText(
      "--color-text-primary swatch",
    );
    await expect(primaryTextSwatch).toBeInTheDocument();
    await expect(primaryTextSwatch).toHaveAttribute(
      "data-token",
      "--color-text-primary",
    );
    await expect(canvas.getByText("--color-text-primary")).toBeInTheDocument();
  },
};

export const PrimitiveGray: Story = {
  render: () => <ColorPalette groups={[COLOR_GROUPS[0]]} />,
};

export const PrimitiveBlue: Story = {
  render: () => <ColorPalette groups={[COLOR_GROUPS[1]]} />,
};

export const PrimitiveRed: Story = {
  render: () => <ColorPalette groups={[COLOR_GROUPS[2]]} />,
};

export const SemanticText: Story = {
  render: () => <ColorPalette groups={[COLOR_GROUPS[3]]} />,
};

export const SemanticBackground: Story = {
  render: () => <ColorPalette groups={[COLOR_GROUPS[4]]} />,
};

export const SemanticBorder: Story = {
  render: () => <ColorPalette groups={[COLOR_GROUPS[5]]} />,
};

export const SemanticInteractive: Story = {
  render: () => <ColorPalette groups={[COLOR_GROUPS[6]]} />,
};

export const SemanticContent: Story = {
  render: () => <ColorPalette groups={[COLOR_GROUPS[7]]} />,
};

export const BrandGoogle: Story = {
  render: () => <ColorPalette groups={[COLOR_GROUPS[8]]} />,
};
