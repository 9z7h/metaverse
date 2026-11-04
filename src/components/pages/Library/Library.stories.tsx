import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "@storybook/test";
import { Library } from "./Library";

const meta = {
  title: "Pages/Library",
  component: Library,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    viewport: { defaultViewport: "mobile1" },
    // Figma 프레임 없음 — 시안 확정 시 parameters.design.url 연결
  },
} satisfies Meta<typeof Library>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 입장 화면 — 접속자 시뮬레이션 동작 (몇 초 지켜보면 인원/집중 상태가 바뀜) */
export const Entrance: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { level: 1 })).toHaveTextContent(
      "대도서관에촛불이 켜졌어요",
    );
    await expect(canvas.getByText(/공부 중/)).toBeInTheDocument();
  },
};

/** 과목 입력 → 입장 → 빈 자리 착석 → 집중 시작까지 전체 흐름 */
export const FullFlow: Story = {
  args: { presenceOptions: { simulate: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByLabelText("오늘 공부할 과목"),
      "UX 리서치",
    );
    await userEvent.click(canvas.getByRole("button", { name: "도서관 입장" }));

    await expect(
      canvas.getByRole("heading", { name: "자리를 골라주세요" }),
    ).toBeInTheDocument();
    // 6석 중 3석 사용 중 → 빈 자리 버튼 3개
    const sitButtons = canvas.getAllByRole("button", { name: "여기 앉기" });
    await expect(sitButtons).toHaveLength(3);
    await userEvent.click(sitButtons[0]);

    await expect(
      canvas.getByRole("heading", { name: "B-1 자리" }),
    ).toBeInTheDocument();
    await expect(canvas.getByText("마법 수학")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "집중 시작" }));
    await expect(
      canvas.getByRole("button", { name: "일시정지" }),
    ).toBeInTheDocument();
  },
};

/** 짧은 세션(2초)으로 세션 완료 → 오늘의 기록 반영 확인 */
export const SessionComplete: Story = {
  args: { sessionSeconds: 2, presenceOptions: { simulate: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "도서관 입장" }));
    await userEvent.click(
      canvas.getAllByRole("button", { name: "여기 앉기" })[0],
    );
    await userEvent.click(canvas.getByRole("button", { name: "집중 시작" }));
    await waitFor(() => expect(canvas.getByText("1회")).toBeInTheDocument(), {
      timeout: 4000,
    });
  },
};

/** 자리 비우기 → 좌석 선택 화면으로 복귀, 내 자리는 다시 빈 자리 */
export const LeaveSeat: Story = {
  args: { presenceOptions: { simulate: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "도서관 입장" }));
    await userEvent.click(
      canvas.getAllByRole("button", { name: "여기 앉기" })[0],
    );
    await userEvent.click(canvas.getByRole("button", { name: "자리 비우기" }));
    await expect(
      canvas.getAllByRole("button", { name: "여기 앉기" }),
    ).toHaveLength(3);
  },
};
