import { useEffect, useRef } from "react";
import {
  FOCUS_MILESTONE_MINUTES,
  setEventContext,
  setUserProperties,
  totalHoursBucket,
  trackEvent,
  trackFirstMove,
  trackOnce,
  type AnalyticsScene,
} from "../../../lib/analytics";
import { SPELL_ORDER, SPELLS, isUnlocked } from "./scene/spellLogic";

/** 이동 키 — LibraryWorld·GardenWorld의 키 매핑과 같다 */
const MOVE_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
]);

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT")
  );
}

interface UseLibraryAnalyticsOptions {
  /** 지금 있는 공간. 3D 공간 밖(입장·배정 화면)이면 null */
  scene: AnalyticsScene | null;
  /** 3D를 그릴 수 있는지 */
  webgl: boolean;
  house: string | null;
  /** 누적 수련 시간(초) — 개발용 전체 해제 값이 아닌 실제 값 */
  trainedSeconds: number;
  /** 오늘 누적 수련 시간(초) */
  todaySeconds: number;
  timerRunning: boolean;
}

/**
 * 먹빛각 전체에 걸친 GA 기록: 공간 체류 시간, 첫 이동(키보드), 주문 해제,
 * 수련 시간 마일스톤, 사용자 속성. 버튼 단위 이벤트는 각 컴포넌트에서 직접 보낸다.
 */
export function useLibraryAnalytics({
  scene,
  webgl,
  house,
  trainedSeconds,
  todaySeconds,
  timerRunning,
}: UseLibraryAnalyticsOptions) {
  // 공간 체류 시간: 들어오면 재기 시작, 떠나거나 탭이 숨으면 보낸다
  useEffect(() => {
    if (!scene) return;
    setEventContext({ scene });
    let since: number | null = performance.now();
    const flush = () => {
      if (since === null) return;
      const staySec = Math.round((performance.now() - since) / 1000);
      since = null;
      if (staySec > 0) trackEvent("scene_leave", { scene, stay_sec: staySec });
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
      else if (since === null) since = performance.now();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      flush();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
    };
  }, [scene]);

  // 첫 이동 (키보드). 조이스틱은 MovementJoystick이 보낸다
  useEffect(() => {
    if (!scene) return;
    const onKey = (e: KeyboardEvent) => {
      if (!MOVE_KEYS.has(e.code) || isTyping(e.target)) return;
      trackFirstMove("keyboard");
      window.removeEventListener("keydown", onKey);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scene]);

  useEffect(() => {
    if (scene && !webgl) trackOnce("webgl_unsupported", {});
  }, [scene, webgl]);

  useEffect(() => {
    if (house) setUserProperties({ house });
  }, [house]);

  const bucket = totalHoursBucket(trainedSeconds);
  useEffect(() => {
    setUserProperties({ total_hours_bucket: bucket });
  }, [bucket]);

  // 주문 해제·마일스톤은 수련 중에 기준을 넘은 순간만 센다.
  // (서버에서 지난 누적이 늦게 도착해 값이 뛰는 경우는 해제로 세지 않는다)
  const prevTrained = useRef(trainedSeconds);
  const prevToday = useRef(todaySeconds);
  useEffect(() => {
    const before = prevTrained.current;
    prevTrained.current = trainedSeconds;
    if (!timerRunning) return;
    for (const id of SPELL_ORDER) {
      if (SPELLS[id].unlockSeconds === 0) continue;
      if (!isUnlocked(id, before) && isUnlocked(id, trainedSeconds)) {
        trackEvent("spell_unlock", {
          spell_id: id,
          total_hours: Math.floor(trainedSeconds / 3600),
        });
      }
    }
  }, [trainedSeconds, timerRunning]);

  useEffect(() => {
    const before = prevToday.current;
    prevToday.current = todaySeconds;
    if (!timerRunning) return;
    for (const minutes of FOCUS_MILESTONE_MINUTES) {
      const at = minutes * 60;
      if (before < at && todaySeconds >= at) {
        trackEvent("focus_milestone", { minutes });
      }
    }
  }, [todaySeconds, timerRunning]);
}
