import { describe, expect, it } from "vitest";
import {
  BUBBLE_MS,
  CHAT_LOG_MAX,
  CHAT_MAX_LEN,
  CHAT_RECEIVE_BURST,
  CHAT_RECEIVE_PER_SENDER_MS,
  CHAT_SEND_INTERVAL_MS,
  ME_BUBBLE_KEY,
  acceptIncoming,
  activeBubbles,
  appendChat,
  canSendChat,
  createReceiveLimiter,
  isTypingTarget,
  makeChatMessage,
  normalizeChatText,
  parseIncomingChat,
} from "./chat";
import type { ChatMessage } from "./chat";

const msg = (over: Partial<ChatMessage> = {}): ChatMessage => ({
  id: "m",
  senderId: "u1",
  name: "하린",
  house: "jujak",
  text: "안녕",
  at: 1000,
  mine: false,
  ...over,
});

describe("normalizeChatText — 보내는 글 정리", () => {
  it("앞뒤 공백을 지우고 안의 공백·줄바꿈은 한 칸으로", () => {
    expect(normalizeChatText("  안녕   하세요\n\t반가워  ")).toBe(
      "안녕 하세요 반가워",
    );
  });

  it("비었거나 공백뿐이거나 문자열이 아니면 null", () => {
    expect(normalizeChatText("")).toBeNull();
    expect(normalizeChatText("   \n ")).toBeNull();
    expect(normalizeChatText(123)).toBeNull();
    expect(normalizeChatText(null)).toBeNull();
    expect(normalizeChatText({ a: 1 })).toBeNull();
  });

  it(`${CHAT_MAX_LEN}자까지만 남긴다`, () => {
    const out = normalizeChatText("가".repeat(200));
    expect(out).toHaveLength(CHAT_MAX_LEN);
  });

  it("이모지를 반으로 쪼개지 않는다 (코드 포인트 기준)", () => {
    const out = normalizeChatText("😀".repeat(100)) as string;
    expect([...out]).toHaveLength(CHAT_MAX_LEN);
    expect(out.endsWith("😀")).toBe(true);
  });

  it("제로폭·방향 제어 같은 보이지 않는 글자와 제어 문자를 지운다", () => {
    expect(normalizeChatText("안​녕‮하\u0007세요")).toBe("안 녕 하 세요");
    expect(normalizeChatText("​‏⁦")).toBeNull();
  });

  it("HTML처럼 보여도 그대로 글자로 둔다 (그리는 쪽이 텍스트로만 그린다)", () => {
    expect(normalizeChatText("<img src=x onerror=alert(1)>")).toBe(
      "<img src=x onerror=alert(1)>",
    );
  });
});

describe("canSendChat — 연달아 보내기 제한", () => {
  it("처음이면 보낼 수 있다", () => {
    expect(canSendChat(null, 5)).toBe(true);
  });
  it("간격이 지나기 전에는 막고, 지나면 보낼 수 있다", () => {
    expect(canSendChat(1000, 1000 + CHAT_SEND_INTERVAL_MS - 1)).toBe(false);
    expect(canSendChat(1000, 1000 + CHAT_SEND_INTERVAL_MS)).toBe(true);
  });
});

describe("parseIncomingChat — 받은 값은 믿지 않는다", () => {
  const ok = { id: "u1", name: "하린", house: "jujak", text: "안녕" };

  it("정상 값", () => {
    expect(parseIncomingChat(ok)).toEqual({
      senderId: "u1",
      name: "하린",
      house: "jujak",
      text: "안녕",
    });
  });

  it.each([
    ["객체 아님", "hello"],
    ["null", null],
    ["id 없음", { ...ok, id: undefined }],
    ["id가 빔", { ...ok, id: "   " }],
    ["id가 너무 김", { ...ok, id: "x".repeat(65) }],
    ["글이 빔", { ...ok, text: "  " }],
    ["글이 문자열 아님", { ...ok, text: 5 }],
  ])("버린다 — %s", (_label, raw) => {
    expect(parseIncomingChat(raw)).toBeNull();
  });

  it("이상한 기숙사는 null로, 이름이 없거나 길면 정리", () => {
    expect(parseIncomingChat({ ...ok, house: "nope" })?.house).toBeNull();
    expect(parseIncomingChat({ ...ok, name: "" })?.name).toBe("수련생");
    expect(
      parseIncomingChat({ ...ok, name: "가".repeat(40) })?.name,
    ).toHaveLength(12);
    expect(parseIncomingChat({ ...ok, name: 7 })?.name).toBe("수련생");
  });

  it("글은 길이 제한과 정리가 적용된다", () => {
    const out = parseIncomingChat({ ...ok, text: `  ${"가".repeat(200)}  ` });
    expect(out?.text).toHaveLength(CHAT_MAX_LEN);
  });
});

describe("acceptIncoming — 받는 쪽 속도 제한", () => {
  it("같은 사람이 너무 빨리 보내면 버리고, 간격이 지나면 받는다", () => {
    const l = createReceiveLimiter();
    expect(acceptIncoming(l, "a", 0)).toBe(true);
    expect(acceptIncoming(l, "a", CHAT_RECEIVE_PER_SENDER_MS - 1)).toBe(false);
    expect(acceptIncoming(l, "a", CHAT_RECEIVE_PER_SENDER_MS)).toBe(true);
  });

  it("다른 사람의 글은 서로 영향을 주지 않는다", () => {
    const l = createReceiveLimiter();
    expect(acceptIncoming(l, "a", 0)).toBe(true);
    expect(acceptIncoming(l, "b", 1)).toBe(true);
  });

  it("보낸 사람을 바꿔 가며 쏟아내도 짧은 시간에 받는 개수에 상한이 있다", () => {
    const l = createReceiveLimiter();
    let accepted = 0;
    for (let i = 0; i < 50; i++) {
      if (acceptIncoming(l, `spam-${i}`, i)) accepted++;
    }
    expect(accepted).toBe(CHAT_RECEIVE_BURST.max);
  });

  it("시간이 지나면 다시 받는다", () => {
    const l = createReceiveLimiter();
    for (let i = 0; i < CHAT_RECEIVE_BURST.max; i++)
      acceptIncoming(l, `s${i}`, i);
    expect(acceptIncoming(l, "late", 10)).toBe(false);
    expect(acceptIncoming(l, "late", CHAT_RECEIVE_BURST.windowMs + 100)).toBe(
      true,
    );
  });

  it("보낸 사람 기록이 끝없이 늘지 않는다", () => {
    const l = createReceiveLimiter();
    for (let i = 0; i < 400; i++) {
      // 속도 제한에 걸리지 않게 시간을 충분히 벌려 가며
      acceptIncoming(l, `u${i}`, i * 5000);
    }
    expect(l.lastBySender.size).toBeLessThanOrEqual(220);
  });
});

describe("appendChat — 대화창 로그", () => {
  it(`최근 ${CHAT_LOG_MAX}개만 남기고 오래된 것부터 버린다`, () => {
    let log: ChatMessage[] = [];
    for (let i = 0; i < CHAT_LOG_MAX + 10; i++) {
      log = appendChat(log, msg({ id: `m${i}`, text: `글${i}` }));
    }
    expect(log).toHaveLength(CHAT_LOG_MAX);
    expect(log[0].id).toBe("m10");
    expect(log.at(-1)?.id).toBe(`m${CHAT_LOG_MAX + 9}`);
  });

  it("원본 배열을 바꾸지 않는다", () => {
    const log: ChatMessage[] = [];
    appendChat(log, msg());
    expect(log).toHaveLength(0);
  });
});

describe("makeChatMessage", () => {
  it("글마다 고유한 id", () => {
    const a = makeChatMessage({
      senderId: "u",
      name: "n",
      house: null,
      text: "t",
      at: 1,
      mine: false,
    });
    const b = makeChatMessage({
      senderId: "u",
      name: "n",
      house: null,
      text: "t",
      at: 1,
      mine: false,
    });
    expect(a.id).not.toBe(b.id);
  });
});

describe("activeBubbles — 머리 위 말풍선", () => {
  it("보낸 사람마다 가장 최근 글 하나만, 시간 안의 것만", () => {
    const log = [
      msg({ id: "1", senderId: "a", text: "첫째", at: 100 }),
      msg({ id: "2", senderId: "a", text: "둘째", at: 200 }),
      msg({ id: "3", senderId: "b", text: "비", at: 300 }),
    ];
    const out = activeBubbles(log, 400);
    expect(out.get("a")?.text).toBe("둘째");
    expect(out.get("b")?.text).toBe("비");
    expect(out.size).toBe(2);
  });

  it(`${BUBBLE_MS / 1000}초가 지나면 사라진다`, () => {
    const log = [msg({ at: 1000 })];
    expect(activeBubbles(log, 1000 + BUBBLE_MS - 1).size).toBe(1);
    expect(activeBubbles(log, 1000 + BUBBLE_MS).size).toBe(0);
  });

  it("내가 보낸 글은 접속자 id가 없어도 ME 키로 찾는다", () => {
    const out = activeBubbles([msg({ mine: true, senderId: "x", at: 10 })], 20);
    expect(out.get(ME_BUBBLE_KEY)?.mine).toBe(true);
    expect(out.has("x")).toBe(false);
  });

  it("빈 로그는 빈 결과", () => {
    expect(activeBubbles([], 5).size).toBe(0);
  });
});

describe("isTypingTarget — 글자 입력 중에는 이동 키를 가로채지 않는다", () => {
  const make = (html: string) => {
    const host = document.createElement("div");
    host.innerHTML = html;
    document.body.appendChild(host);
    return host;
  };

  it("입력창·글상자·선택 상자·편집 가능 요소는 true", () => {
    const host = make(
      '<input id="a"><textarea id="b"></textarea><select id="c"></select><div id="d" contenteditable="true"><span id="e">x</span></div>',
    );
    for (const id of ["a", "b", "c", "d", "e"]) {
      expect(isTypingTarget(host.querySelector(`#${id}`))).toBe(true);
    }
    host.remove();
  });

  it("입력창 안쪽 요소(예: 입력창을 감싼 칸의 자식)도 true", () => {
    const host = make('<label><input id="a"><span id="s">라벨</span></label>');
    expect(isTypingTarget(host.querySelector("#a"))).toBe(true);
    host.remove();
  });

  it("일반 요소·버튼·document·null은 false", () => {
    const host = make('<div id="a"></div><button id="b">x</button>');
    expect(isTypingTarget(host.querySelector("#a"))).toBe(false);
    expect(isTypingTarget(host.querySelector("#b"))).toBe(false);
    expect(isTypingTarget(document)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
    host.remove();
  });
});
