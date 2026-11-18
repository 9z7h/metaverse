// Google Analytics 4 (gtag.js)
// 프로덕션 빌드이고 VITE_GA_ID가 있을 때만 로드한다. 로컬 개발 트래픽은 집계하지 않는다.
// 라우트 이동 페이지뷰는 GA 스트림의 향상된 측정(브라우저 기록 이벤트)이 자동으로 잡는다.

type Gtag = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
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

/** 커스텀 이벤트 전송. GA가 꺼져 있으면 아무것도 하지 않는다. */
export function trackEvent(name: string, params?: Record<string, unknown>) {
  window.gtag?.("event", name, params);
}
