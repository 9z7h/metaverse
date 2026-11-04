import { useCallback, useEffect, useRef, useState } from "react";
import type { FocusTimerStatus } from "../../ui/FocusTimer";

export interface FocusTimerState {
  remainingSeconds: number;
  status: FocusTimerStatus;
  /** 오늘 완료한 세션 수 */
  completedSessions: number;
  /** 오늘 누적 집중 시간(초) — 진행 중인 세션 포함 */
  focusedSeconds: number;
  start: () => void;
  pause: () => void;
  reset: () => void;
}

/**
 * 뽀모도로 타이머 로직. 남은 시간을 `endAt` 타임스탬프로 계산하므로
 * 모바일에서 탭이 백그라운드로 가서 interval이 늦게 돌아도 시간이 밀리지 않는다.
 */
export function useFocusTimer(
  totalSeconds: number,
  onComplete?: () => void,
): FocusTimerState {
  const [remainingSeconds, setRemaining] = useState(totalSeconds);
  const [status, setStatus] = useState<FocusTimerStatus>("idle");
  const [completedSessions, setCompleted] = useState(0);
  // 완료하지 못하고 초기화한 세션의 집중 시간도 오늘 기록에 남긴다
  const [bankedSeconds, setBanked] = useState(0);
  const endAtRef = useRef<number | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (status !== "running") return;
    const id = window.setInterval(() => {
      const left = Math.ceil(((endAtRef.current ?? 0) - Date.now()) / 1000);
      if (left <= 0) {
        endAtRef.current = null;
        setStatus("idle");
        setRemaining(totalSeconds);
        setCompleted((n) => n + 1);
        onCompleteRef.current?.();
      } else {
        setRemaining(left);
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [status, totalSeconds]);

  const start = useCallback(() => {
    endAtRef.current = Date.now() + remainingSeconds * 1000;
    setStatus("running");
  }, [remainingSeconds]);

  const pause = useCallback(() => {
    endAtRef.current = null;
    setStatus("paused");
  }, []);

  const reset = useCallback(() => {
    endAtRef.current = null;
    setBanked((b) => b + (totalSeconds - remainingSeconds));
    setStatus("idle");
    setRemaining(totalSeconds);
  }, [totalSeconds, remainingSeconds]);

  return {
    remainingSeconds,
    status,
    completedSessions,
    focusedSeconds:
      bankedSeconds +
      completedSessions * totalSeconds +
      (totalSeconds - remainingSeconds),
    start,
    pause,
    reset,
  };
}
