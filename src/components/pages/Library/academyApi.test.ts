import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AlreadyRerolledError,
  connectAcademy,
  parseHouseTotals,
  parseStudent,
} from "./academyApi";

const student = {
  house: "jujak",
  nickname: "수련생042",
  rerollDay: null,
  today: "2026-11-05",
};

describe("parseStudent — 서버 응답 검증", () => {
  it("정상 응답", () => {
    expect(parseStudent(student)).toEqual(student);
  });

  it("재배정 날짜가 있으면 유지", () => {
    expect(
      parseStudent({ ...student, rerollDay: "2026-11-05" })?.rerollDay,
    ).toBe("2026-11-05");
  });

  it.each([
    ["null", null],
    ["문자열", "jujak"],
    ["없는 기숙사", { ...student, house: "no-such-house" }],
    ["날짜 형식 오류", { ...student, today: "오늘" }],
    ["today 없음", { house: "jujak" }],
  ])("모양이 다르면 null — %s", (_name, raw) => {
    expect(parseStudent(raw)).toBeNull();
  });

  it("이상한 재배정 날짜는 없는 것으로, 닉네임은 12자까지", () => {
    const parsed = parseStudent({
      ...student,
      rerollDay: "yesterday",
      nickname: "가".repeat(30),
    });
    expect(parsed?.rerollDay).toBeNull();
    expect(parsed?.nickname).toHaveLength(12);
  });

  it("닉네임이 비면 기본값", () => {
    expect(parseStudent({ ...student, nickname: "  " })?.nickname).toBe(
      "수련생",
    );
  });
});

describe("parseHouseTotals", () => {
  it("네 기숙사 값을 정수로", () => {
    expect(
      parseHouseTotals({
        baekho: 10,
        jujak: 20.9,
        hyeonmu: "30",
        cheongryong: 0,
      }),
    ).toEqual({ baekho: 10, jujak: 20, hyeonmu: 30, cheongryong: 0 });
  });

  it("빠졌거나 음수·NaN·객체가 아니면 0", () => {
    expect(parseHouseTotals({ baekho: -5, jujak: "abc" })).toEqual({
      baekho: 0,
      jujak: 0,
      hyeonmu: 0,
      cheongryong: 0,
    });
    expect(parseHouseTotals(null)).toEqual({
      baekho: 0,
      jujak: 0,
      hyeonmu: 0,
      cheongryong: 0,
    });
  });
});

function fakeClient(
  options: {
    session?: { user: { id: string } } | null;
    rpc?: (fn: string, args?: Record<string, unknown>) => unknown;
  } = {},
) {
  const signInAnonymously = vi.fn(async () => ({
    data: { user: { id: "anon-1" } },
    error: null,
  }));
  const rpc = vi.fn(async (fn: string, args?: Record<string, unknown>) => {
    const out = options.rpc?.(fn, args);
    if (out instanceof Error) return { data: null, error: out };
    return { data: out ?? null, error: null };
  });
  const client = {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: options.session ?? null },
      })),
      signInAnonymously,
    },
    rpc,
  } as unknown as SupabaseClient;
  return { client, signInAnonymously, rpc };
}

describe("connectAcademy", () => {
  it("세션이 없으면 익명 로그인", async () => {
    const { client, signInAnonymously } = fakeClient();
    const api = await connectAcademy(client);
    expect(signInAnonymously).toHaveBeenCalledTimes(1);
    expect(api.userId).toBe("anon-1");
  });

  it("이미 로그인돼 있으면 그 계정을 그대로 쓴다", async () => {
    const { client, signInAnonymously } = fakeClient({
      session: { user: { id: "google-7" } },
    });
    const api = await connectAcademy(client);
    expect(signInAnonymously).not.toHaveBeenCalled();
    expect(api.userId).toBe("google-7");
  });

  it("동시에 여러 번 연결해도 익명 사용자는 하나만 만든다 (StrictMode)", async () => {
    const { client, signInAnonymously } = fakeClient();
    const [a, b] = await Promise.all([
      connectAcademy(client),
      connectAcademy(client),
    ]);
    expect(signInAnonymously).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it("익명 로그인이 실패하면 에러를 던지고, 다음에 다시 시도할 수 있다", async () => {
    const { client, signInAnonymously } = fakeClient();
    signInAnonymously.mockResolvedValueOnce({
      data: { user: null as never },
      error: { message: "Anonymous sign-ins are disabled" } as never,
    });
    await expect(connectAcademy(client)).rejects.toThrow(/disabled/);
    await expect(connectAcademy(client)).resolves.toMatchObject({
      userId: "anon-1",
    });
  });

  it("me — 입학 전이면 null", async () => {
    const { client } = fakeClient({ rpc: () => null });
    const api = await connectAcademy(client);
    await expect(api.me()).resolves.toBeNull();
  });

  it("join·reroll — RPC 이름과 응답 해석", async () => {
    const { client, rpc } = fakeClient({ rpc: () => student });
    const api = await connectAcademy(client);
    await expect(api.join()).resolves.toEqual(student);
    await expect(api.reroll()).resolves.toEqual(student);
    expect(rpc).toHaveBeenCalledWith("academy_join", undefined);
    expect(rpc).toHaveBeenCalledWith("academy_reroll", undefined);
  });

  it("서버가 already_rerolled로 거절하면 AlreadyRerolledError", async () => {
    const { client } = fakeClient({ rpc: () => new Error("already_rerolled") });
    const api = await connectAcademy(client);
    await expect(api.reroll()).rejects.toBeInstanceOf(AlreadyRerolledError);
  });

  it("해석할 수 없는 응답은 에러", async () => {
    const { client } = fakeClient({ rpc: () => ({ house: "???" }) });
    const api = await connectAcademy(client);
    await expect(api.join()).rejects.toThrow();
  });

  it("reportFocus — 정수·0 이상으로 보낸다", async () => {
    const { client, rpc } = fakeClient();
    const api = await connectAcademy(client);
    await api.reportFocus(125.9);
    await api.reportFocus(-4);
    expect(rpc).toHaveBeenCalledWith("academy_report_focus", { p_total: 125 });
    expect(rpc).toHaveBeenCalledWith("academy_report_focus", { p_total: 0 });
  });
});
