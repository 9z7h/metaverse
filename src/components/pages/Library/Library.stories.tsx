import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "@storybook/test";
import { Library } from "./Library";
import { clearHouse, clearRerollDay, saveHouse } from "./houses";

const meta = {
  title: "Pages/Library",
  component: Library,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    viewport: { defaultViewport: "mobile1" },
    // Figma 프레임 없음 — 시안 확정 시 parameters.design.url 연결
  },
  // 기숙사·오늘 누적 기록은 localStorage에 유지되므로 스토리마다 초기화 → 항상 첫 입장 상태에서 시작
  beforeEach: () => {
    clearHouse();
    clearRerollDay();
    try {
      window.localStorage.removeItem("hanul-academy:focus");
    } catch {
      /* noop */
    }
  },
  args: { sortingDurationMs: 0 },
} satisfies Meta<typeof Library>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 입장 화면 — 접속자 시뮬레이션 동작 (몇 초 지켜보면 인원/집중 상태가 바뀜) */
export const Entrance: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { level: 1 })).toHaveTextContent(
      "청사초롱 아래서함께 공부해요",
    );
    await expect(
      canvas.getByText("사신학당 · 밤의 장서각"),
    ).toBeInTheDocument();
    await expect(canvas.getByText(/사신등 의식/)).toBeInTheDocument();
    // 간편 모드 제거 — 입장 버튼은 하나
    await expect(
      canvas.queryByRole("button", { name: "간편 모드로 입장" }),
    ).toBeNull();
  },
};

/** 첫 입장 — 사신등 의식(기숙사 배정) 연출 (실제 길이 1.8초) */
export const HouseSorting: Story = {
  args: { sortingDurationMs: 1800, presenceOptions: { simulate: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "도서관 입장" }));
    await expect(
      canvas.getByText("사신등의 빛이 정해지는 중…"),
    ).toBeInTheDocument();
    await waitFor(
      () =>
        expect(
          canvas.getByRole("heading", {
            name: /^(백호관|주작관|현무관|청룡관)$/,
          }),
        ).toBeInTheDocument(),
      { timeout: 4000 },
    );
    await expect(canvas.getByText(/가 묻습니다/)).toBeInTheDocument();
  },
};

/** 재방문 — 배정된 기숙사(현무관)가 입장 화면에 표시되고 사신등 의식은 건너뜀 */
export const ReturningStudent: Story = {
  beforeEach: () => {
    saveHouse("hyeonmu");
  },
  args: { presenceOptions: { simulate: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("현무관 수련생")).toBeInTheDocument();
    await expect(canvas.getByText("지혜 · 탐구 · 신중함")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "도서관 입장" }));
    await expect(canvas.queryByText("사신등의 빛이 정해지는 중…")).toBeNull();
    await expect(canvas.queryByRole("dialog")).toBeNull();
  },
};

/**
 * 다시 배정 — 확인을 거쳐 다른 기숙사로 바뀌고, 하루 1번뿐.
 * (이후 입장 화면 복귀 후 비활성화는 Library.reroll.test.tsx에서 확인 — 여기서는 3D 로딩을 피한다)
 */
export const RerollOncePerDay: Story = {
  beforeEach: () => {
    saveHouse("hyeonmu");
  },
  args: { presenceOptions: { simulate: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("하루 1번 가능해요")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "다시 배정" }));
    await expect(canvas.getByRole("alert")).toHaveTextContent("하루에 한 번만");
    await userEvent.click(
      canvas.getByRole("button", { name: "다시 배정하기" }),
    );
    // 항상 지금(현무관)과 다른 기숙사
    await expect(
      canvas.getByRole("heading", { name: /^(백호관|주작관|청룡관)$/ }),
    ).toBeInTheDocument();
  },
};

/** [3D] 입장 → 배정 → 3D 장서각 로드, 기숙사 배지·탭 이동 안내 노출 */
export const World3D: Story = {
  args: { presenceOptions: { simulate: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "도서관 입장" }));
    await userEvent.click(
      canvas.getByRole("button", { name: "장서각 입장하기" }),
    );
    await waitFor(
      () =>
        expect(
          canvas.getByText("바닥을 탭하면 이동, 빈 책상을 탭하면 앉아요"),
        ).toBeInTheDocument(),
      { timeout: 10000 },
    );
    await expect(canvas.getByText(/관 수련생$/)).toBeInTheDocument();
    await expect(
      canvas.queryByRole("button", { name: "간편 모드" }),
    ).toBeNull();
  },
};
