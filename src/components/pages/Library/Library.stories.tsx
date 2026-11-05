import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "@storybook/test";
import { useState } from "react";
import { Library } from "./Library";
import { ChatPanel } from "./ChatPanel";
import { makeChatMessage, normalizeChatText } from "./chat";
import type { ChatMessage } from "./chat";
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
      canvas.getByText("사신학당 · 숨은골의 먹빛각"),
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

/** [3D] 입장 → 배정 → 3D 먹빛각 로드, 기숙사 배지·탭 이동 안내 노출 */
export const World3D: Story = {
  args: { presenceOptions: { simulate: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "도서관 입장" }));
    await userEvent.click(
      canvas.getByRole("button", { name: "먹빛각 입장하기" }),
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

/** 대화창 단독 — 글을 쓰면 목록에 쌓이고, 채팅을 끄면 대화와 입력이 막힌다 */
function ChatPanelDemo() {
  const [enabled, setEnabled] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([
    makeChatMessage({
      senderId: "s1",
      name: "하린",
      house: "jujak",
      text: "오늘은 집중이 잘 되네요",
      at: Date.now(),
      mine: false,
    }),
  ]);
  return (
    <div
      data-theme="library"
      style={{
        padding: "var(--spacing-16)",
        background: "var(--color-background-default)",
        minHeight: "100vh",
      }}
    >
      <ChatPanel
        messages={enabled ? messages : []}
        enabled={enabled}
        onToggleEnabled={() => setEnabled((v) => !v)}
        onClose={() => undefined}
        onSend={(text) => {
          const clean = normalizeChatText(text);
          if (!clean) return false;
          setMessages((list) => [
            ...list,
            makeChatMessage({
              senderId: "me",
              name: "수련생",
              house: "hyeonmu",
              text: clean,
              at: Date.now(),
              mine: true,
            }),
          ]);
          return true;
        }}
      />
    </div>
  );
}

export const ChatPanelOnly: Story = {
  render: () => <ChatPanelDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText("오늘은 집중이 잘 되네요"),
    ).toBeInTheDocument();
    // W·A·S·D·E도 글자로 들어간다 (3D 이동 키로 가로채이지 않음)
    const input = canvas.getByRole("textbox", { name: "속삭일 말" });
    await userEvent.type(input, "wasde");
    await expect(input).toHaveValue("wasde");
    await userEvent.clear(input);
    await userEvent.type(input, "같이 공부해요{Enter}");
    await expect(canvas.getByText("같이 공부해요")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "채팅 끄기" }));
    await expect(canvas.getByText(/채팅이 꺼져 있어요/)).toBeInTheDocument();
    await expect(input).toBeDisabled();
  },
};

/** [3D] 먹빛각에서 '대화' 버튼으로 대화창을 열고 글을 보낸다 */
export const World3DChat: Story = {
  args: { presenceOptions: { simulate: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "도서관 입장" }));
    await userEvent.click(
      canvas.getByRole("button", { name: "먹빛각 입장하기" }),
    );
    await waitFor(
      () =>
        expect(
          canvas.getByRole("button", { name: "대화" }),
        ).toBeInTheDocument(),
      { timeout: 10000 },
    );
    await userEvent.click(canvas.getByRole("button", { name: "대화" }));
    const input = canvas.getByRole("textbox", { name: "속삭일 말" });
    await userEvent.type(input, "안녕하세요{Enter}");
    await expect(
      canvas.getByRole("log", { name: "최근 대화" }),
    ).toHaveTextContent("안녕하세요");
  },
};
