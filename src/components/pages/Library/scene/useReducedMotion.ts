import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/** 사용자가 동작 줄이기를 켰는지. matchMedia가 없거나 던져도 false. */
export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia?.(QUERY).matches === true;
  } catch {
    return false;
  }
}

/** 동작 줄이기 설정을 따라가는 훅 — 앱을 켠 채 설정을 바꿔도 바로 반영된다. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotion);
  useEffect(() => {
    const media = window.matchMedia?.(QUERY);
    if (!media) return;
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}
