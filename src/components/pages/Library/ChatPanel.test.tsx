import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatPanel } from "./ChatPanel";
import type { ChatPanelProps } from "./ChatPanel";
import type { ChatMessage } from "./chat";

afterEach(() => cleanup());

const message = (over: Partial<ChatMessage> = {}): ChatMessage => ({
  id: "m1",
  senderId: "u1",
  name: "하린",
  house: "jujak",
  text: "안녕하세요",
  at: 1000,
  mine: false,
  ...over,
});

function setup(over: Partial<ChatPanelProps> = {}) {
  const props: ChatPanelProps = {
    messages: [],
    onSend: vi.fn(() => true),
    enabled: true,
    onToggleEnabled: vi.fn(),
    onClose: vi.fn(),
    onFocusChange: vi.fn(),
    ...over,
  };
  render(<ChatPanel {...props} />);
  return props;
}

const input = () => screen.getByRole("textbox", { name: "속삭일 말" });
const sendButton = () => screen.getByRole("button", { name: "보내기" });

describe("ChatPanel — 대화 목록", () => {
  it("글이 없으면 먼저 말을 걸어 보라는 안내", () => {
    setup();
    expect(screen.getByText(/아직 아무 말도 없어요/)).toBeInTheDocument();
  });

  it("보낸 사람 이름과 글을 보여 주고, 내 글은 '나'로 표시한다", () => {
    setup({
      messages: [
        message({ id: "a", name: "하린", text: "안녕하세요" }),
        message({ id: "b", name: "수련생042", text: "반가워요", mine: true }),
      ],
    });
    const log = screen.getByRole("log", { name: "최근 대화" });
    expect(log).toHaveTextContent("하린");
    expect(log).toHaveTextContent("안녕하세요");
    expect(log).toHaveTextContent("나");
    expect(log).toHaveTextContent("반가워요");
    expect(log).not.toHaveTextContent("수련생042");
  });

  it("글에 HTML이 들어 있어도 해석하지 않고 글자 그대로 보여 준다", () => {
    setup({
      messages: [message({ text: "<img src=x onerror=alert(1)><b>굵게</b>" })],
    });
    const log = screen.getByRole("log", { name: "최근 대화" });
    expect(log.querySelector("img")).toBeNull();
    expect(log.querySelector("b")).toBeNull();
    expect(log).toHaveTextContent("<img src=x onerror=alert(1)><b>굵게</b>");
  });
});

describe("ChatPanel — 보내기", () => {
  it("글을 쓰고 '보내기'를 누르면 보내고 입력창을 비운다", async () => {
    const props = setup();
    await userEvent.type(input(), "안녕하세요");
    await userEvent.click(sendButton());
    expect(props.onSend).toHaveBeenCalledWith("안녕하세요");
    expect(input()).toHaveValue("");
  });

  it("Enter 키로도 보낸다 (한 번만)", async () => {
    const props = setup();
    await userEvent.type(input(), "엔터로{Enter}");
    expect(props.onSend).toHaveBeenCalledTimes(1);
    expect(props.onSend).toHaveBeenCalledWith("엔터로");
  });

  it("비었거나 공백뿐이면 '보내기'가 막혀 있고 보내지 않는다", async () => {
    const props = setup();
    expect(sendButton()).toBeDisabled();
    await userEvent.type(input(), "   {Enter}");
    expect(props.onSend).not.toHaveBeenCalled();
    expect(input()).toHaveValue("");
  });

  it("너무 빨라서 막히면 안내하고 글은 그대로 두며, 다시 입력하면 안내가 사라진다", async () => {
    const props = setup({ onSend: vi.fn(() => false) });
    await userEvent.type(input(), "빨리{Enter}");
    expect(props.onSend).toHaveBeenCalledTimes(1);
    expect(screen.getByText("조금 천천히 말해 주세요")).toBeInTheDocument();
    expect(input()).toHaveValue("빨리");
    await userEvent.type(input(), "요");
    expect(screen.queryByText("조금 천천히 말해 주세요")).toBeNull();
  });

  it("입력창은 60자까지만 받는다", () => {
    setup();
    expect(input()).toHaveAttribute("maxlength", "60");
  });
});

describe("ChatPanel — 끄기·닫기·포커스", () => {
  it("채팅 끄기/켜기·닫기 버튼이 부모에 알린다", async () => {
    const props = setup();
    await userEvent.click(screen.getByRole("button", { name: "채팅 끄기" }));
    expect(props.onToggleEnabled).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("채팅이 꺼져 있으면 대화를 숨기고 입력도 막고 안내한다", () => {
    setup({ enabled: false, messages: [message()] });
    expect(screen.getByText(/채팅이 꺼져 있어요/)).toBeInTheDocument();
    expect(screen.queryByRole("log")).toBeNull();
    expect(input()).toBeDisabled();
    expect(sendButton()).toBeDisabled();
    expect(screen.getByRole("button", { name: "채팅 켜기" })).toBeEnabled();
  });

  it("입력창 포커스가 들어오고 나갈 때 부모에 알린다 (이동 키 정리용)", async () => {
    const props = setup();
    await userEvent.click(input());
    expect(props.onFocusChange).toHaveBeenLastCalledWith(true);
    await userEvent.tab();
    expect(props.onFocusChange).toHaveBeenLastCalledWith(false);
  });

  it("입력창에서 W·A·S·D·E를 쳐도 글자로 들어간다 (이동 키로 가로채이지 않음)", async () => {
    setup();
    await userEvent.type(input(), "wasde");
    expect(input()).toHaveValue("wasde");
  });
});
