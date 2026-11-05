/**
 * 사신학당 서버 연동 — Supabase RPC 호출을 한곳에 모은다.
 * SQL: supabase/sql/004_academy.sql (모든 접근은 RPC로만, 기숙사·재배정·랭킹은 서버가 판단)
 *
 * 페이지는 `AcademyApi` 인터페이스만 알면 되므로 테스트에서는 가짜 구현을 주입한다.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { HOUSE_IDS, isHouseId } from "./houses";
import type { HouseId } from "./houses";
import { zeroHouseSeconds } from "./houseRanking";
import type { HouseSeconds } from "./houseRanking";

export interface AcademyStudent {
  house: HouseId;
  nickname: string;
  /** 마지막으로 다시 배정한 날(YYYY-MM-DD, 서버 기준) */
  rerollDay: string | null;
  /** 서버 기준 오늘(YYYY-MM-DD, 한국 시간) */
  today: string;
}

/** 오늘 이미 다시 배정했다 (서버가 거절) */
export class AlreadyRerolledError extends Error {
  constructor() {
    super("already_rerolled");
    this.name = "AlreadyRerolledError";
  }
}

export interface AcademyApi {
  /** 로그인된 사용자 id (익명 포함) */
  userId: string;
  /** 내 학생 정보 — 아직 입학 전이면 null */
  me: () => Promise<AcademyStudent | null>;
  /** 입학: 이미 있으면 그대로, 없으면 서버가 기숙사 배정 */
  join: () => Promise<AcademyStudent>;
  /** 다시 배정 (하루 1회, 서버 검증) */
  reroll: () => Promise<AcademyStudent>;
  /** 오늘 누적 집중 시간 보고(초) */
  reportFocus: (totalSeconds: number) => Promise<void>;
  /** 기숙사별 오늘 집중 시간 합계 — 나를 제외 */
  houseTotals: () => Promise<HouseSeconds>;
}

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** 서버 응답(jsonb)을 검증해서 학생 정보로. 모양이 다르면 null */
export function parseStudent(raw: unknown): AcademyStudent | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (!isHouseId(r.house)) return null;
  if (typeof r.today !== "string" || !DAY_PATTERN.test(r.today)) return null;
  const rerollDay =
    typeof r.rerollDay === "string" && DAY_PATTERN.test(r.rerollDay)
      ? r.rerollDay
      : null;
  const nickname =
    typeof r.nickname === "string" && r.nickname.trim()
      ? r.nickname.trim().slice(0, 12)
      : "수련생";
  return { house: r.house, nickname, rerollDay, today: r.today };
}

/** 기숙사별 합계(jsonb) 검증 — 빠졌거나 이상한 값은 0 */
export function parseHouseTotals(raw: unknown): HouseSeconds {
  const totals = zeroHouseSeconds();
  if (typeof raw !== "object" || raw === null) return totals;
  const r = raw as Record<string, unknown>;
  for (const id of HOUSE_IDS) {
    const v = Number(r[id]);
    totals[id] = Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
  }
  return totals;
}

/**
 * 익명 로그인으로 세션을 확보하고 API를 만든다.
 * 이미 로그인(Google 등)돼 있으면 그 계정을 그대로 쓴다.
 */
export function connectAcademy(client: SupabaseClient): Promise<AcademyApi> {
  // StrictMode가 effect를 두 번 실행해도 익명 사용자가 둘 생기지 않도록 클라이언트당 한 번만 연결
  let pending = connections.get(client);
  if (!pending) {
    pending = connect(client);
    connections.set(client, pending);
    pending.catch(() => connections.delete(client));
  }
  return pending;
}

const connections = new WeakMap<SupabaseClient, Promise<AcademyApi>>();

async function connect(client: SupabaseClient): Promise<AcademyApi> {
  const { data: current } = await client.auth.getSession();
  let userId = current.session?.user.id ?? null;
  if (!userId) {
    const { data, error } = await client.auth.signInAnonymously();
    if (error || !data.user) {
      throw new Error(error?.message ?? "익명 로그인에 실패했어요.");
    }
    userId = data.user.id;
  }

  const call = async (fn: string, args?: Record<string, unknown>) => {
    const { data, error } = await client.rpc(fn, args);
    if (error) {
      if (error.message.includes("already_rerolled")) {
        throw new AlreadyRerolledError();
      }
      throw new Error(error.message);
    }
    return data as unknown;
  };

  const student = async (fn: string) => {
    const parsed = parseStudent(await call(fn));
    if (!parsed) throw new Error("서버 응답을 해석하지 못했어요.");
    return parsed;
  };

  return {
    userId,
    me: async () => parseStudent(await call("academy_me")),
    join: () => student("academy_join"),
    reroll: () => student("academy_reroll"),
    reportFocus: async (totalSeconds) => {
      await call("academy_report_focus", {
        p_total: Math.max(0, Math.floor(totalSeconds)),
      });
    },
    houseTotals: async () =>
      parseHouseTotals(await call("academy_house_totals")),
  };
}
