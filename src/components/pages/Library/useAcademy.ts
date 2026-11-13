import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { connectAcademy } from "./academyApi";
import type { AcademyApi, AcademyStudent } from "./academyApi";

/** 서버 연결 상태. client가 없으면 "off" — 기존 로컬 데모로 동작한다 */
export type AcademyConnection =
  | { status: "off" }
  | { status: "connecting" }
  | { status: "error"; message: string }
  | { status: "ready"; api: AcademyApi; student: AcademyStudent | null };

/** 익명 로그인 → 내 학생 정보 복원 */
export function useAcademyConnection(
  client: SupabaseClient | null | undefined,
): AcademyConnection {
  const [conn, setConn] = useState<AcademyConnection>(
    client ? { status: "connecting" } : { status: "off" },
  );

  useEffect(() => {
    if (!client) {
      setConn({ status: "off" });
      return;
    }
    let cancelled = false;
    setConn({ status: "connecting" });
    connectAcademy(client)
      .then(async (api) => {
        const student = await api.me();
        if (!cancelled) setConn({ status: "ready", api, student });
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setConn({
            status: "error",
            message: e instanceof Error ? e.message : "연결에 실패했어요.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [client]);

  return conn;
}

/**
 * 오늘 이전의 내 수련 시간 합계(초) — 주문 해금에 쓴다. 연결되면 한 번 가져온다.
 * 연결이 없거나 실패하면 `fallback`(이 기기에 쌓은 값)을 그대로 돌려준다.
 */
export function usePastSeconds(
  api: AcademyApi | null,
  fallback: number,
): number {
  const [past, setPast] = useState<number | null>(null);
  useEffect(() => {
    if (!api) {
      setPast(null);
      return;
    }
    let cancelled = false;
    api
      .pastSeconds()
      .then((seconds) => {
        if (!cancelled) setPast(seconds);
      })
      .catch(() => {
        if (!cancelled) setPast(null);
      });
    return () => {
      cancelled = true;
    };
  }, [api]);
  return past ?? fallback;
}

const REPORT_INTERVAL_MS = 15_000;

/**
 * 오늘 누적 집중 시간을 서버에 보고한다.
 *  - 집중 중에는 15초마다
 *  - 멈췄을 때·화면에서 나갈 때·탭이 숨겨질 때·페이지를 닫을 때 한 번 더
 * 값이 그대로면 보내지 않는다. 실패해도 다음 주기에 다시 시도한다.
 */
export function useFocusReport(
  api: AcademyApi | null,
  seconds: number,
  running: boolean,
  active: boolean,
): void {
  const latest = useRef(seconds);
  latest.current = seconds;
  const sent = useRef(0);

  useEffect(() => {
    if (!api || !active) return;
    const flush = () => {
      const value = latest.current;
      if (value <= sent.current) return;
      sent.current = value;
      api.reportFocus(value).catch(() => {
        // 실패 시 다음 보고에서 다시 보내도록 되돌린다
        sent.current = Math.min(sent.current, value - 1);
      });
    };
    const onHide = () => {
      if (document.hidden) flush();
    };
    const id = running ? window.setInterval(flush, REPORT_INTERVAL_MS) : null;
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      if (id !== null) window.clearInterval(id);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      flush(); // 멈춤·퇴장 시 마지막 값
    };
  }, [api, running, active]);
}
