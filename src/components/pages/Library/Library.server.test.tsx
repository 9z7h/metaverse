import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Library } from "./Library";
import { clearHouse, clearRerollDay } from "./houses";

/**
 * 서버(Supabase) 모드 — 가짜 클라이언트로 RPC 응답을 흉내 낸다.
 * jsdom에는 WebGL이 없어 장서각은 열리지 않으므로, 입장 화면 ↔ 배정 흐름만 확인한다.
 */

interface ServerStudent {
  house: string;
  nickname: string;
  rerollDay: string | null;
  today: string;
}

const TODAY = "2026-11-05";

function fakeServer(initial: ServerStudent | null) {
  let stu = initial;
  const rpcLog: string[] = [];
  const channel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
    track: vi.fn(),
    untrack: vi.fn(),
    presenceState: vi.fn(() => ({})),
  };
  const handlers: Record<string, () => { data?: unknown; error?: Error }> = {
    academy_me: () => ({ data: stu }),
    academy_join: () => {
      stu ??= {
        house: "cheongryong",
        nickname: "수련생777",
        rerollDay: null,
        today: TODAY,
      };
      return { data: stu };
    },
    academy_reroll: () => {
      if (stu?.rerollDay === TODAY) {
        return { error: new Error("already_rerolled") };
      }
      stu = { ...stu!, house: "baekho", rerollDay: TODAY };
      return { data: stu };
    },
    academy_house_totals: () => ({
      data: { baekho: 100, jujak: 0, hyeonmu: 0, cheongryong: 0 },
    }),
    academy_report_focus: () => ({ data: null }),
  };
  const client = {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      signInAnonymously: vi.fn(async () => ({
        data: { user: { id: "anon-1" } },
        error: null,
      })),
    },
    rpc: vi.fn(async (fn: string) => {
      rpcLog.push(fn);
      const out = handlers[fn]();
      return { data: out.data ?? null, error: out.error ?? null };
    }),
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(),
  } as unknown as SupabaseClient;
  return { client, rpcLog, channel };
}

const renderServer = (client: SupabaseClient) =>
  render(
    <Library
      academy={client}
      sortingDurationMs={0}
      presenceOptions={{ simulate: false }}
    />,
  );

beforeEach(() => {
  clearHouse();
  clearRerollDay();
});
afterEach(() => cleanup());

describe("서버 모드", () => {
  it("연결되는 동안 입장 버튼은 잠겨 있다가 풀린다", async () => {
    const { client } = fakeServer(null);
    renderServer(client);
    expect(
      screen.getByRole("button", { name: "서고에 연결하는 중…" }),
    ).toBeDisabled();
    expect(
      await screen.findByRole("button", { name: "도서관 입장" }),
    ).toBeEnabled();
  });

  it("처음 입장하면 서버가 정한 기숙사로 배정되고, 이 기기에는 저장하지 않는다", async () => {
    const { client, rpcLog } = fakeServer(null);
    renderServer(client);
    await userEvent.click(
      await screen.findByRole("button", { name: "도서관 입장" }),
    );

    // 사신등 의식 결과 = 서버가 준 청룡관 (클라이언트가 정한 값이 아님)
    expect(
      await screen.findByRole("heading", { level: 1, name: "청룡관" }),
    ).toBeInTheDocument();
    expect(rpcLog).toContain("academy_join");
    expect(window.localStorage.getItem("hanul-academy:house")).toBeNull();
  });

  it("이미 입학한 학생은 서버 기록으로 내 기숙사가 복원된다", async () => {
    const { client, rpcLog } = fakeServer({
      house: "hyeonmu",
      nickname: "수련생010",
      rerollDay: null,
      today: TODAY,
    });
    renderServer(client);
    expect(await screen.findByText("현무관 수련생")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 배정" })).toBeEnabled();
    expect(rpcLog).not.toContain("academy_join");
  });

  it("서버 기록상 오늘 이미 다시 배정했다면, 이 기기에 기록이 없어도 막힌다", async () => {
    const { client } = fakeServer({
      house: "hyeonmu",
      nickname: "수련생010",
      rerollDay: TODAY,
      today: TODAY,
    });
    renderServer(client);
    await screen.findByText("현무관 수련생");
    expect(screen.getByRole("button", { name: "다시 배정" })).toBeDisabled();
  });

  it("다시 배정은 서버가 정한 다른 기숙사로, 하루 한 번", async () => {
    const { client } = fakeServer({
      house: "hyeonmu",
      nickname: "수련생010",
      rerollDay: null,
      today: TODAY,
    });
    renderServer(client);
    await screen.findByText("현무관 수련생");
    await userEvent.click(screen.getByRole("button", { name: "다시 배정" }));
    await userEvent.click(
      screen.getByRole("button", { name: "다시 배정하기" }),
    );

    expect(
      await screen.findByRole("heading", { level: 1, name: "백호관" }),
    ).toBeInTheDocument();
  });

  it("다른 기기에서 이미 다시 배정했다면 안내하고 막는다", async () => {
    // 화면은 '가능'으로 알고 있지만(me는 재배정 기록 없음) 서버는 오늘 이미 했다고 거절
    const { client } = fakeServer({
      house: "hyeonmu",
      nickname: "수련생010",
      rerollDay: null,
      today: TODAY,
    });
    const rpc = client.rpc as unknown as ReturnType<typeof vi.fn>;
    const original = rpc.getMockImplementation() as (
      fn: string,
    ) => Promise<unknown>;
    rpc.mockImplementation(async (fn: string) =>
      fn === "academy_reroll"
        ? { data: null, error: new Error("already_rerolled") }
        : original(fn),
    );

    renderServer(client);
    await screen.findByText("현무관 수련생");
    await userEvent.click(screen.getByRole("button", { name: "다시 배정" }));
    await userEvent.click(
      screen.getByRole("button", { name: "다시 배정하기" }),
    );

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "오늘은 이미 다시 배정했어요",
      ),
    );
    expect(screen.getByRole("button", { name: "다시 배정" })).toBeDisabled();
    expect(screen.getByText("현무관 수련생")).toBeInTheDocument();
  });

  it("연결에 실패하면 안내하고 이 기기의 체험 모드로 동작한다", async () => {
    const { client } = fakeServer(null);
    (
      client.auth.signInAnonymously as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      data: { user: null },
      error: { message: "Anonymous sign-ins are disabled" },
    });
    renderServer(client);

    expect(await screen.findByRole("status")).toHaveTextContent("체험 모드");
    expect(screen.getByRole("button", { name: "도서관 입장" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "도서관 입장" }));
    expect(
      await screen.findByRole("button", { name: "장서각 입장하기" }),
    ).toBeInTheDocument();
    // 체험 모드에서는 기존처럼 이 기기에 저장
    expect(window.localStorage.getItem("hanul-academy:house")).not.toBeNull();
  });
});
