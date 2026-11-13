import { useCallback, useEffect, useRef, useState } from "react";
import type { FocusTimerStatus } from "../../ui/FocusTimer";

export interface FocusTimerState {
  /** 오늘 누적 집중 시간(초) — 새로고침해도 유지, 자정에 0 */
  elapsedSeconds: number;
  /** 이번 연속 집중 시간(초) — 다시 시작하면 0부터, 멈추면 그 값 유지 */
  runSeconds: number;
  status: FocusTimerStatus;
  start: () => void;
  pause: () => void;
}

/* ── 저장: 오늘 날짜와 누적 초 ────────────────────────────
 * 프로토타입이라 브라우저(localStorage)에 저장. 막힌 환경에선 메모리로만 동작.
 * 실시간 연동 시 사용자 기록(Supabase)으로 옮길 것. */

const STORAGE_KEY = "hanul-academy:focus";
/** 오늘 이전 날들의 누적 초 — 서버가 없는 데모에서만 쓴다 */
const PAST_KEY = "hanul-academy:past";

/** 로컬 시간 기준 YYYY-MM-DD */
export function dayKey(ms: number): string {
  const d = new Date(ms);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function loadToday(now: number): number {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const v = JSON.parse(raw) as { date?: string; seconds?: number };
    return v.date === dayKey(now) && typeof v.seconds === "number"
      ? Math.max(0, v.seconds)
      : 0;
  } catch {
    return 0;
  }
}

/**
 * 오늘 이전의 누적 수련 시간(초). 서버가 없는 데모의 주문 해금용이다.
 * 어제 이전에 저장된 오늘 기록이 남아 있으면 여기에 합치고, 오늘 기록을 0으로 비운다
 * (두 번 불려도 한 번만 합쳐진다).
 */
export function loadPastSeconds(now: number): number {
  try {
    const stored = Number(window.localStorage.getItem(PAST_KEY));
    let past = Number.isFinite(stored) && stored > 0 ? Math.floor(stored) : 0;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const v = JSON.parse(raw) as { date?: string; seconds?: number };
      if (
        typeof v.date === "string" &&
        v.date !== dayKey(now) &&
        typeof v.seconds === "number"
      ) {
        past += Math.max(0, Math.floor(v.seconds));
        window.localStorage.setItem(PAST_KEY, String(past));
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ date: dayKey(now), seconds: 0 }),
        );
      }
    }
    return past;
  } catch {
    return 0;
  }
}

function saveToday(now: number, seconds: number) {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ date: dayKey(now), seconds }),
    );
  } catch {
    /* 저장 불가 환경 — 메모리에만 유지 */
  }
}

/**
 * 누적 집중 스톱워치. 시작 시각 기준으로 계산하므로 모바일에서 탭이
 * 백그라운드로 가서 interval이 늦게 돌아도 시간이 밀리지 않는다.
 */
export function useFocusTimer(): FocusTimerState {
  const [banked, setBanked] = useState(() => loadToday(Date.now()));
  const [status, setStatus] = useState<FocusTimerStatus>(() =>
    loadToday(Date.now()) > 0 ? "paused" : "idle",
  );
  const [now, setNow] = useState(() => Date.now());
  const [lastRun, setLastRun] = useState(0);
  const startedAt = useRef<number | null>(null);
  const day = useRef(dayKey(Date.now()));

  const live = (t: number) =>
    startedAt.current === null ? 0 : (t - startedAt.current) / 1000;

  useEffect(() => {
    if (status !== "running") return;
    const id = window.setInterval(() => {
      const t = Date.now();
      // 자정을 넘기면 새 날로 — 누적 0부터 다시
      if (dayKey(t) !== day.current) {
        day.current = dayKey(t);
        startedAt.current = t;
        setBanked(0);
      }
      setNow(t);
    }, 250);
    return () => window.clearInterval(id);
  }, [status]);

  const elapsedSeconds = Math.floor(
    banked + (status === "running" ? live(now) : 0),
  );

  // 진행 중에도 저장해 두면 새로고침·앱 종료 시 잃는 시간이 1초 이내
  useEffect(() => {
    saveToday(now, elapsedSeconds);
  }, [now, elapsedSeconds]);

  const start = useCallback(() => {
    if (startedAt.current !== null) return;
    const t = Date.now();
    startedAt.current = t;
    day.current = dayKey(t);
    setNow(t);
    setStatus("running");
  }, []);

  const pause = useCallback(() => {
    if (startedAt.current === null) return;
    const t = Date.now();
    const run = live(t);
    startedAt.current = null;
    setBanked((b) => b + run);
    setLastRun(run);
    setNow(t);
    setStatus("paused");
  }, []);

  return {
    elapsedSeconds,
    runSeconds: Math.floor(status === "running" ? live(now) : lastRun),
    status,
    start,
    pause,
  };
}
