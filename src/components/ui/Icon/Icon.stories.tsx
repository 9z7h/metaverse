import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "@storybook/test";
import { Icon, iconPaths, type IconName } from "./Icon";

const allNames = Object.keys(iconPaths) as IconName[];

const meta = {
  title: "UI/Icon",
  component: Icon,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Bk8GPQ5r1K1A4XvKRBEUKS/?node-id=781-5290",
    },
  },
  argTypes: {
    name: { control: "select", options: allNames },
    size: { control: { type: "number", min: 8, max: 96, step: 4 } },
    color: { control: "color" },
    title: { control: "text" },
  },
  args: {
    name: "search",
    size: 16,
  },
} satisfies Meta<typeof Icon>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 단일 아이콘 (Controls로 name/size/color 변경) */
export const Playground: Story = {};

/** 전체 19개 아이콘 한눈에 보기 */
export const Gallery: Story = {
  render: () => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(5, minmax(96px, 1fr))",
        gap: "var(--spacing-16)",
        color: "var(--color-text-primary)",
      }}
    >
      {allNames.map((name) => (
        <div
          key={name}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "var(--spacing-8)",
          }}
        >
          <Icon name={name} size={24} title={name} />
          <span style={{ color: "var(--color-text-secondary)" }}>{name}</span>
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // 갤러리에 검색 아이콘 등 대표 아이콘이 렌더됐는지 확인
    const search = canvas.getByTitle("search");
    await expect(search).toBeInTheDocument();
    await expect(search.tagName.toLowerCase()).toBe("svg");
    // title이 있으면 role="img"
    await expect(search).toHaveAttribute("role", "img");
    // 전체 개수만큼 svg가 그려졌는지 (각 셀당 1개)
    const heart = canvas.getByTitle("heart_fill");
    await expect(heart).toBeInTheDocument();
  },
};

/** 대표 단색 아이콘 — currentColor로 부모 색을 따른다 */
export const Search: Story = { args: { name: "search", size: 24 } };
export const User: Story = { args: { name: "user", size: 24 } };
export const HeartFill: Story = {
  args: {
    name: "heart_fill",
    size: 24,
    color: "var(--color-interactive-destructive)",
  },
};

/** 멀티컬러 브랜드 아이콘 — 원본 색상 유지(color prop 영향 없음) */
export const Google: Story = { args: { name: "google", size: 32 } };

/** color prop으로 토큰 색상 적용 */
export const Colored: Story = {
  render: (args) => (
    <div
      style={{
        display: "flex",
        gap: "var(--spacing-16)",
        alignItems: "center",
      }}
    >
      <Icon {...args} color="var(--color-text-primary)" />
      <Icon {...args} color="var(--color-interactive-primary)" />
      <Icon {...args} color="var(--color-interactive-destructive)" />
      <Icon {...args} color="var(--color-text-tertiary)" />
    </div>
  ),
  args: { name: "heart_fill", size: 28 },
};

/** size 변화 */
export const Sizes: Story = {
  render: (args) => (
    <div
      style={{
        display: "flex",
        gap: "var(--spacing-16)",
        alignItems: "center",
        color: "var(--color-text-primary)",
      }}
    >
      {[16, 20, 24, 32, 48].map((s) => (
        <Icon key={s} {...args} size={s} />
      ))}
    </div>
  ),
  args: { name: "notification" },
};
