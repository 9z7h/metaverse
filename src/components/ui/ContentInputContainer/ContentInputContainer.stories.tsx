import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "@storybook/test";
import { ContentInputContainer } from "./ContentInputContainer";
import type { PostImageType } from "../PostImage";

const ALL_IMAGE_TYPES: PostImageType[] = [1, 2, 3, 4, 5, 6];

const meta = {
  title: "UI/ContentInputContainer",
  component: ContentInputContainer,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    state: { control: "select", options: ["empty", "filled"] },
    imageType: { control: "select", options: ALL_IMAGE_TYPES },
    placeholder: { control: "text" },
    value: { control: "text" },
    imageAlt: { control: "text" },
  },
  args: {
    state: "empty",
  },
} satisfies Meta<typeof ContentInputContainer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** state="empty" — 기본 placeholder */
export const Empty: Story = {
  args: { state: "empty" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText("게시글 내용을 입력해주세요."),
    ).toBeInTheDocument();
  },
};

/** state="empty" — 커스텀 placeholder */
export const EmptyWithCustomPlaceholder: Story = {
  args: { state: "empty", placeholder: "오늘의 이야기를 들려주세요." },
};

/** state="filled" — imageType 1 + 본문 텍스트 */
export const Filled: Story = {
  args: {
    state: "filled",
    imageType: 1,
    value: "오늘은 날씨가 정말 좋아서 산책을 다녀왔어요.",
    imageAlt: "산책 사진",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const img = canvas.getByRole("img", { name: "산책 사진" });
    await expect(img).toBeInTheDocument();
    await expect(canvas.getByText(/산책을 다녀왔어요/)).toBeInTheDocument();
  },
};

/** state="filled" × imageType 1~6 전체 조합 한눈에 보기 */
export const FilledImageTypeGallery: Story = {
  render: () => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: "var(--spacing-24)",
      }}
    >
      {ALL_IMAGE_TYPES.map((imageType) => (
        <div
          key={imageType}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--spacing-8)",
          }}
        >
          <span
            style={{
              font: "var(--text-caption-lg-medium)",
              color: "var(--color-text-secondary)",
            }}
          >
            imageType {imageType}
          </span>
          <ContentInputContainer
            state="filled"
            imageType={imageType}
            imageAlt={`샘플 이미지 ${imageType}`}
            value={`샘플 본문 텍스트 ${imageType}`}
          />
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const imageType of ALL_IMAGE_TYPES) {
      await expect(
        canvas.getByRole("img", { name: `샘플 이미지 ${imageType}` }),
      ).toBeInTheDocument();
    }
  },
};
