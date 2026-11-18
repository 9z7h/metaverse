// Google Analytics 4 (gtag.js)
// 프로덕션 빌드이고 VITE_GA_ID가 있을 때만 로드한다. 로컬 개발 트래픽은 집계하지 않는다.
// 라우트 이동 페이지뷰는 GA 스트림의 향상된 측정(브라우저 기록 이벤트)이 자동으로 잡는다.
// 이벤트 설계: docs/analytics-events.md

type Gtag = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
}

export type AnalyticsScene = "library" | "garden";
type OnOff = "open" | "close";

/** 이벤트 이름 → 파라미터. 새 이벤트는 여기와 docs/analytics-events.md에 함께 추가한다. */
export interface AnalyticsEvents {
  enter_click: { is_new: boolean };
  sorting_complete: { house: string };
  world_loaded: { scene: AnalyticsScene; load_ms: number };
  first_move: { input: "keyboard" | "joystick"; sec_after_world: number };
  seat_take: { mode: string };
  focus_start: { mode: string };
  focus_pause: { session_sec: number };
  focus_milestone: { minutes: number };
  spell_cast: { spell_id: string };
  spell_locked_view: { spell_id: string };
  spell_unlock: { spell_id: string; total_hours: number };
  spell_dock_toggle: { state: OnOff };
  chat_toggle: { state: OnOff };
  chat_send: { length_bucket: "short" | "mid" | "long" };
  music_toggle: { state: "on" | "off" };
  scene_travel: { from: AnalyticsScene; to: AnalyticsScene };
  scene_leave: { scene: AnalyticsScene; stay_sec: number };
  house_reroll: { from_house: string };
  joystick_used: Record<string, never>;
  webgl_unsupported: Record<string, never>;
}

export type AnalyticsEventName = keyof AnalyticsEvents;

export interface AnalyticsUserProperties {
  house?: string;
  total_hours_bucket?: "0" | "1+" | "3+" | "5+";
}

const GA_ID = import.meta.env.VITE_GA_ID as string | undefined;

let initialized = false;

export function initAnalytics() {
  if (initialized || !import.meta.env.PROD || !GA_ID) return;
  initialized = true;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function gtag() {
    // gtag.js는 arguments 객체 그대로를 dataLayer에서 읽는다
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", GA_ID);
}

/** 이벤트 전송. GA가 꺼져 있으면(개발·테스트) 아무것도 하지 않는다. */
export function trackEvent<K extends AnalyticsEventName>(
  name: K,
  params: AnalyticsEvents[K],
) {
  window.gtag?.("event", name, params);
}

const sentOnce = new Set<string>();

/** 같은 key로는 탭(세션)당 한 번만 보낸다. 보냈으면 true. */
export function trackOnce<K extends AnalyticsEventName>(
  name: K,
  params: AnalyticsEvents[K],
  key: string = name,
): boolean {
  if (sentOnce.has(key)) return false;
  sentOnce.add(key);
  trackEvent(name, params);
  return true;
}

/** 이후 모든 이벤트에 붙는 공통 파라미터 (지금 있는 공간 등) */
export function setEventContext(params: { scene?: AnalyticsScene }) {
  window.gtag?.("set", params);
}

export function setUserProperties(props: AnalyticsUserProperties) {
  window.gtag?.("set", "user_properties", props);
}

let worldLoadedAt: number | null = null;

/**
 * 3D 공간이 처음 그려짐 (세션당 1회).
 * `requestedAt`: 3D 공간으로 들어가기 시작한 시각(performance.now) — 입장 화면에 머문 시간은 빼고 잰다.
 */
export function trackWorldLoaded(scene: AnalyticsScene, requestedAt: number) {
  const now = performance.now();
  if (
    trackOnce("world_loaded", {
      scene,
      load_ms: Math.round(now - requestedAt),
    })
  )
    worldLoadedAt = now;
}

/** 세션 첫 이동 — 키보드든 조이스틱이든 먼저 온 쪽만. 3D가 그려진 뒤 몇 초 만에 움직였는지 */
export function trackFirstMove(input: "keyboard" | "joystick") {
  const since = worldLoadedAt ?? performance.now();
  trackOnce("first_move", {
    input,
    sec_after_world: Math.round((performance.now() - since) / 1000),
  });
}

export function chatLengthBucket(
  text: string,
): AnalyticsEvents["chat_send"]["length_bucket"] {
  const length = text.trim().length;
  if (length <= 10) return "short";
  if (length <= 40) return "mid";
  return "long";
}

const HOUR = 3600;

export function totalHoursBucket(
  totalSeconds: number,
): NonNullable<AnalyticsUserProperties["total_hours_bucket"]> {
  if (totalSeconds >= 5 * HOUR) return "5+";
  if (totalSeconds >= 3 * HOUR) return "3+";
  if (totalSeconds >= HOUR) return "1+";
  return "0";
}

/** 오늘 누적이 처음 넘을 때 focus_milestone을 보내는 기준(분) */
export const FOCUS_MILESTONE_MINUTES = [30, 60, 120] as const;

/** 테스트용: 세션당 1회 기록 초기화 */
export function resetAnalyticsForTest() {
  sentOnce.clear();
  worldLoadedAt = null;
}
