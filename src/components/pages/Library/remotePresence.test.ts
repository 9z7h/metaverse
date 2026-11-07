import { act, renderHook } from "@testing-library/react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { zeroHouseSeconds } from "./houseRankingLogic";
import type { AcademyApi } from "./academyApi";
import { describe, expect, it, vi } from "vitest";
import {
  countConnected,
  parseMember,
  parseMove,
  parseOthers,
  parseWalkers,
  parsePayload,
  useRemotePresence,
} from "./remotePresence";

const base = {
  name: "하린",
  subject: "알고리즘",
  seatId: "L1",
  focusing: true,
  focusSeconds: 600,
  house: "jujak",
  mode: "practice",
};

describe("parsePayload — 다른 클라이언트가 보낸 값은 믿지 않는다", () => {
  it("정상 payload", () => {
    expect(parsePayload("u1", base)).toEqual({ id: "u1", ...base });
  });

  it.each([
    ["없는 좌석", { ...base, seatId: "Z9" }],
    ["없는 기숙사", { ...base, house: "no-such-house" }],
    ["없는 모드", { ...base, mode: "cheat" }],
    ["객체 아님", "hello"],
    ["null", null],
  ])("버린다 — %s", (_name, raw) => {
    expect(parsePayload("u1", raw)).toBeNull();
  });

  it("집중 시간은 0~하루 사이로, 이름·과목은 길이 제한", () => {
    expect(
      parsePayload("u1", { ...base, focusSeconds: 9e9 })?.focusSeconds,
    ).toBe(86400);
    expect(
      parsePayload("u1", { ...base, focusSeconds: -3 })?.focusSeconds,
    ).toBe(0);
    expect(
      parsePayload("u1", { ...base, focusSeconds: "NaN" })?.focusSeconds,
    ).toBe(0);
    const long = parsePayload("u1", {
      ...base,
      name: "가".repeat(50),
      subject: "나".repeat(50),
    });
    expect(long?.name).toHaveLength(12);
    expect(long?.subject).toHaveLength(20);
  });

  it("focusing은 true일 때만 집중 중", () => {
    expect(parsePayload("u1", { ...base, focusing: "true" })?.focusing).toBe(
      false,
    );
  });
});

describe("countConnected — 앉지 않아도 접속자로 센다", () => {
  it("나 혼자면 1명 (아직 sync 전이어도)", () => {
    expect(countConnected({}, "me")).toBe(1);
  });

  it("다른 접속자를 더하고, 같은 사용자의 여러 탭은 한 명", () => {
    const state = { me: [{}], a: [{}, {}], b: [{}] };
    expect(countConnected(state, "me")).toBe(3);
  });

  it("빈 메타는 떠난 사람이므로 세지 않는다", () => {
    expect(countConnected({ a: [] }, "me")).toBe(1);
  });
});

describe("parseMove — 방송된 위치는 믿지 않는다", () => {
  const ok = { id: "u1", x: 1.5, z: 4, ry: 0.5, moving: true };

  it("정상 위치", () => {
    expect(parseMove(ok)).toEqual({
      senderId: "u1",
      x: 1.5,
      z: 4,
      ry: 0.5,
      moving: true,
    });
  });

  it("서고 밖 좌표는 서고 안으로 붙인다", () => {
    const m = parseMove({ ...ok, x: 9999, z: -9999 });
    expect(m?.x).toBe(8);
    expect(m?.z).toBe(-30);
  });

  it.each([
    ["숫자가 아닌 좌표", { ...ok, x: "abc" }],
    ["NaN", { ...ok, z: NaN }],
    ["id 없음", { ...ok, id: undefined }],
    ["빈 id", { ...ok, id: "" }],
    ["객체가 아님", "move"],
    ["null", null],
  ])("%s는 버린다", (_label, raw) => {
    expect(parseMove(raw)).toBeNull();
  });

  it("moving은 true일 때만 걷는 것으로", () => {
    expect(parseMove({ ...ok, moving: "yes" })?.moving).toBe(false);
  });
});

describe("parseMember / parseWalkers — 앉지 않은 접속자", () => {
  it("이름은 다듬고, 기숙사가 없으면 버린다", () => {
    expect(parseMember({ name: "  하린  ", house: "jujak" })).toEqual({
      name: "하린",
      house: "jujak",
    });
    expect(parseMember({ name: "하린", house: null })).toBeNull();
    expect(parseMember({ name: "하린", house: "nope" })).toBeNull();
  });

  it("나와 이미 앉은 사람은 걷는 사람이 아니다", () => {
    const state = {
      me: [{ name: "나", house: "jujak" }],
      seated: [{ name: "앉음", house: "baekho" }],
      walker: [{ name: "걷는이", house: "hyeonmu" }],
      noHouse: [{ name: "배정전", house: null }],
      left: [],
    };
    expect(parseWalkers(state, "me", new Set(["seated"]))).toEqual([
      { id: "walker", name: "걷는이", house: "hyeonmu" },
    ]);
  });
});

describe("parseOthers", () => {
  it("나는 제외하고 다른 학생만", () => {
    const others = parseOthers(
      { me: [base], u2: [{ ...base, seatId: "L2", name: "도윤" }] },
      "me",
    );
    expect(others.map((s) => s.id)).toEqual(["u2"]);
  });

  it("탭을 여러 개 연 사용자는 가장 최근 상태를 쓴다", () => {
    const [s] = parseOthers(
      {
        u2: [
          { ...base, focusing: false },
          { ...base, focusing: true },
        ],
      },
      null,
    );
    expect(s.focusing).toBe(true);
  });

  it("같은 좌석을 둘이 주장하면 먼저 온 쪽만 보인다", () => {
    const others = parseOthers({ u1: [base], u2: [base] }, null);
    expect(others.map((s) => s.id)).toEqual(["u1"]);
  });

  it("잘못된 payload를 보낸 사용자는 건너뛴다", () => {
    const others = parseOthers(
      { bad: [{ ...base, seatId: "??" }], u2: [{ ...base, seatId: "L3" }] },
      null,
    );
    expect(others.map((s) => s.id)).toEqual(["u2"]);
  });

  it("빈 상태", () => {
    expect(parseOthers({}, "me")).toEqual([]);
  });
});

/* ── 서고의 속삭임(채팅): 가짜 Realtime 채널로 송수신을 확인 ─────────── */

function fakeRemote(options: { subscribed?: boolean } = {}) {
  const handlers: Record<string, (arg: { payload: unknown }) => void> = {};
  const channel = {
    on: vi.fn(
      (
        type: string,
        filter: { event: string },
        cb: (arg: { payload: unknown }) => void,
      ) => {
        handlers[`${type}:${filter.event}`] = cb;
        return channel;
      },
    ),
    subscribe: vi.fn((cb: (status: string) => void) => {
      if (options.subscribed !== false) cb("SUBSCRIBED");
      return channel;
    }),
    track: vi.fn(),
    untrack: vi.fn(),
    send: vi.fn(async () => "ok"),
    presenceState: vi.fn(() => ({})),
  };
  const client = {
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(),
  } as unknown as SupabaseClient;
  const api = {
    userId: "me-id",
    houseTotals: vi.fn(async () => zeroHouseSeconds()),
  } as unknown as AcademyApi;
  const hook = renderHook(() =>
    useRemotePresence({ client, api, nickname: "수련생007" }),
  );
  const receive = (payload: unknown) =>
    act(() => handlers["broadcast:chat"]({ payload }));
  return { channel, hook, receive };
}

describe("서버 모드 채팅 — 받기", () => {
  it("다른 학생이 보낸 글이 대화 목록에 들어온다", () => {
    const { hook, receive } = fakeRemote();
    receive({ id: "u2", name: "하린", house: "jujak", text: "안녕하세요" });
    const [m] = hook.result.current.chat.messages;
    expect(m).toMatchObject({
      senderId: "u2",
      name: "하린",
      house: "jujak",
      text: "안녕하세요",
      mine: false,
    });
  });

  it("내 id로 온 글은 무시한다 (내 글은 보내는 쪽에서 이미 더했다)", () => {
    const { hook, receive } = fakeRemote();
    receive({ id: "me-id", name: "나", house: "jujak", text: "에코" });
    expect(hook.result.current.chat.messages).toHaveLength(0);
  });

  it("모양이 이상한 값은 버린다", () => {
    const { hook, receive } = fakeRemote();
    receive(null);
    receive("hello");
    receive({ id: "", text: "x" });
    receive({ id: "u2", text: "   " });
    expect(hook.result.current.chat.messages).toHaveLength(0);
  });

  it("같은 사람이 너무 빨리 보낸 두 번째 글은 버린다", () => {
    const { hook, receive } = fakeRemote();
    receive({ id: "u2", name: "하린", house: "jujak", text: "첫째" });
    receive({ id: "u2", name: "하린", house: "jujak", text: "둘째" });
    const texts = hook.result.current.chat.messages.map((m) => m.text);
    expect(texts).toEqual(["첫째"]);
  });

  it("글은 정리·길이 제한이 적용된다", () => {
    const { hook, receive } = fakeRemote();
    receive({
      id: "u2",
      name: "하린",
      house: "jujak",
      text: `  ${"가".repeat(200)}  `,
    });
    expect(hook.result.current.chat.messages[0].text).toHaveLength(60);
  });
});

describe("서버 모드 채팅 — 보내기", () => {
  it("방송으로 보내고, 내 대화창에는 바로 내 글로 더한다", () => {
    const { channel, hook } = fakeRemote();
    let ok = false;
    act(() => {
      ok = hook.result.current.chat.send("  안녕하세요  ", "hyeonmu");
    });
    expect(ok).toBe(true);
    expect(channel.send).toHaveBeenCalledWith({
      type: "broadcast",
      event: "chat",
      payload: {
        id: "me-id",
        name: "수련생007",
        house: "hyeonmu",
        text: "안녕하세요",
      },
    });
    expect(hook.result.current.chat.messages[0]).toMatchObject({
      text: "안녕하세요",
      mine: true,
      senderId: "me-id",
    });
  });

  it("연달아 빠르게 보내면 두 번째는 막힌다", () => {
    const { channel, hook } = fakeRemote();
    let second = true;
    act(() => {
      hook.result.current.chat.send("하나", "hyeonmu");
    });
    act(() => {
      second = hook.result.current.chat.send("둘", "hyeonmu");
    });
    expect(second).toBe(false);
    expect(channel.send).toHaveBeenCalledTimes(1);
    expect(hook.result.current.chat.messages).toHaveLength(1);
  });

  it("빈 글은 보내지 않는다", () => {
    const { channel, hook } = fakeRemote();
    let ok = true;
    act(() => {
      ok = hook.result.current.chat.send("   ", "hyeonmu");
    });
    expect(ok).toBe(false);
    expect(channel.send).not.toHaveBeenCalled();
  });

  it("채널이 아직 연결되지 않았으면 보내지 않는다", () => {
    const { channel, hook } = fakeRemote({ subscribed: false });
    let ok = true;
    act(() => {
      ok = hook.result.current.chat.send("안녕", "hyeonmu");
    });
    expect(ok).toBe(false);
    expect(channel.send).not.toHaveBeenCalled();
  });
});
