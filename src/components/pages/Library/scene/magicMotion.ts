/**
 * 실습 중 책상 위로 솟는 마법 회오리 — 빛줄기(streak) 위치 계산 (three.js 무관, 단위 테스트 대상).
 * 좌표는 책상 중심 기준 로컬 좌표(m). y=0은 바닥, 책상 상판은 약 0.8m.
 *
 * 노란 빛줄기 여러 가닥이 아래는 좁고 위로 갈수록 넓어지는 깔때기(토네이도)를 그리며
 * 빠르게 돌면서 솟아오르고, 꼭대기에 가까워지면 흐려진다.
 */

/** 빛줄기 가닥 수 */
export const STREAKS = 14;
/** 한 가닥을 이루는 마디 수 (곡선 매끄러움) */
export const SEGMENTS = 10;

/** 상판 바로 위 */
const BASE_Y = 0.85;
/** 회오리 높이 */
const HEIGHT = 1.5;

/** 0~1 결정적 의사난수 (가닥마다 고정) */
function hash(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export interface StreakFrame {
  /** 회오리 안에서의 높이 진행도 0(바닥)~1(꼭대기) */
  h: number;
  /** 머리(앞쪽 끝)의 각도 rad */
  angle: number;
  /** 깔때기 반지름 m */
  radius: number;
  /** 머리 높이 m */
  y: number;
  /** 가닥이 감는 호의 길이 rad */
  arc: number;
  /** 밝기 0~1 — 바닥에서 나타나 꼭대기에서 사라짐 */
  fade: number;
  /** 빛줄기 두께 m */
  width: number;
}

export function tornadoStreak(i: number, t: number): StreakFrame {
  const r1 = hash(i);
  const r2 = hash(i + 31);
  const r3 = hash(i + 77);
  const period = 1.6 + r2 * 0.8;
  const h = (((t / period + r1) % 1) + 1) % 1;
  return {
    h,
    angle: r2 * Math.PI * 2 + t * (3.4 + r3 * 1.6),
    radius: 0.08 + h * 0.6,
    y: BASE_Y + h * HEIGHT,
    arc: 1.0 + r3 * 0.6,
    fade: Math.sin(Math.PI * h),
    width: 0.05 + h * 0.07,
  };
}

/**
 * 가닥 위의 한 점. u=0은 머리, u=1은 꼬리.
 * 꼬리는 머리보다 뒤 각도·조금 아래에 있어 나선으로 감겨 올라가는 모양이 된다.
 */
export function streakPoint(
  f: StreakFrame,
  u: number,
): [number, number, number] {
  const a = f.angle - f.arc * u;
  const y = f.y - u * 0.18;
  // 꼬리 쪽은 아래라서 깔때기 반지름도 조금 좁다
  const r = Math.max(0.05, f.radius - u * 0.07);
  return [Math.cos(a) * r, y, Math.sin(a) * r];
}
