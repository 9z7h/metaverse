/**
 * 실습 중 책상 위로 솟는 마법 회오리 — 빛줄기(streak) 위치 계산 (three.js 무관, 단위 테스트 대상).
 * 좌표는 책상 중심 기준 로컬 좌표(m). y=0은 바닥, 책상 상판은 약 0.8m.
 *
 * 노란 빛줄기 여러 가닥이 아래는 좁고 위로 갈수록 넓어지는 깔때기(토네이도)를 그리며
 * 빠르게 돌면서 솟아오르고, 꼭대기에 가까워지면 흐려진다.
 */

import type { PresenceStudent } from "../libraryPresence";

/** 빛줄기 가닥 수 */
export const STREAKS = 14;
/** 한 가닥을 이루는 마디 수 (곡선 매끄러움) */
export const SEGMENTS = 18;

/** 상판 바로 위 */
const BASE_Y = 0.85;
/** 회오리 높이 */
const HEIGHT = 1.25;

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
  const period = 2.6 + r2 * 1.2;
  const h = (((t / period + r1) % 1) + 1) % 1;
  return {
    h,
    angle: r2 * Math.PI * 2 + t * (1.8 + r3 * 0.9),
    radius: 0.08 + h * 0.6,
    y: BASE_Y + h * HEIGHT,
    arc: 1.5 + r3 * 0.7,
    fade: Math.sin(Math.PI * h),
    width: 0.022 + h * 0.034,
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

/* ── 퇴장: 마법처럼 스르륵 사라지기 ────────────────────────────
 * 학생이 나가면 아바타가 기숙사색 빛 입자로 흩어지며 위로 떠오르고 서서히 투명해진다.
 * 접속자 목록에서 빠진 학생을 잠시 "퇴장 중"으로 붙들어 두는 계산도 여기서 한다. */

/** 사라지는 데 걸리는 시간(ms) */
export const DISSOLVE_MS = 1200;
/** 빛 입자 수 */
export const DISSOLVE_PARTICLES = 60;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** 경과 시간(ms) → 진행도 0~1 */
export function dissolveProgress(elapsedMs: number): number {
  return clamp01(elapsedMs / DISSOLVE_MS);
}

/** 아바타 불투명도: 처음 잠깐은 또렷하다가 서서히 0으로 */
export function dissolveAlpha(p: number): number {
  return 1 - smoothstep(0.08, 0.9, p);
}

/** 아바타가 떠오르는 높이(m) — 처음엔 빠르게, 끝에서 느리게 */
export function dissolveRise(p: number): number {
  const t = clamp01(p);
  return 0.45 * (1 - (1 - t) ** 3);
}

/**
 * 빛 입자 하나의 위치(아바타 발밑 기준 로컬 m)와 밝기.
 * 몸 주변(높이 0.25~1.25m)에서 시작해 나선을 그리며 위로 솟아오른다.
 */
export function dissolveParticle(
  i: number,
  p: number,
): { x: number; y: number; z: number; alpha: number } {
  const r1 = hash(i);
  const r2 = hash(i + 31);
  const r3 = hash(i + 77);
  const angle = r1 * Math.PI * 2 + p * (2.2 + r2 * 2);
  const radius = 0.12 + r2 * 0.3 + p * 0.25;
  return {
    x: Math.cos(angle) * radius,
    y: 0.25 + r3 + p * (0.6 + r1 * 0.9),
    z: Math.sin(angle) * radius,
    alpha: clamp01(p * 5) * (1 - p),
  };
}

/** 퇴장 중인 학생 — 나간 순간의 모습을 `since`(ms)부터 `DISSOLVE_MS` 동안 그린다 */
export interface Leaver {
  student: PresenceStudent;
  since: number;
}

/**
 * 접속자 목록이 `prev`에서 `next`로 바뀔 때 퇴장 중 목록을 갱신한다.
 *  - 빠진 학생은 새 퇴장자로 추가
 *  - 이미 시간이 다 된 퇴장자는 제거
 *  - 같은 학생이 다시 들어왔으면 퇴장 연출을 접는다
 * 바뀐 게 없으면 같은 항목 객체를 그대로 돌려줘서 호출하는 쪽이 변화를 쉽게 알아챈다.
 */
export function trackLeavers(
  prev: PresenceStudent[],
  next: PresenceStudent[],
  leavers: Leaver[],
  now: number,
  durationMs = DISSOLVE_MS,
): Leaver[] {
  const nextIds = new Set(next.map((s) => s.id));
  const alive = leavers.filter(
    (l) => !nextIds.has(l.student.id) && now - l.since < durationMs,
  );
  const known = new Set(alive.map((l) => l.student.id));
  const added = prev
    .filter((s) => !nextIds.has(s.id) && !known.has(s.id))
    .map((student) => ({ student, since: now }));
  return added.length ? [...alive, ...added] : alive;
}

/* ── 프레임 속도 ─────────────────────────────────────────── */

/** 걷거나 시점을 돌리는 중 */
export const FPS_WALKING = 60;
/** 앉아서 마법이나 다른 사람의 움직임을 볼 때 — 끊기지 않는 선에서 아낀다 */
export const FPS_MOVING = 30;
/** 가만히 앉아 공부만 할 때 — 장시간 공부 시 발열·배터리 절약 */
export const FPS_SEATED = 12;

export interface FpsInput {
  /** 내가 앉아 있는가 */
  seated: boolean;
  /** 드래그·퇴장 연출·순위판 보기처럼 카메라나 장면이 크게 움직이는 중 */
  busy: boolean;
  /** 내 마법이나 보이는 다른 사람의 마법이 켜져 있는가 */
  magic: boolean;
  /** 서고를 걸어 다니는 다른 접속자가 있는가 */
  othersMoving: boolean;
}

/** 지금 장면을 몇 fps로 그릴지. 움직임이 있을 때만 올리고 가만히 있을 때는 아낀다 */
export function pickFps({
  seated,
  busy,
  magic,
  othersMoving,
}: FpsInput): number {
  if (!seated || busy) return FPS_WALKING;
  return magic || othersMoving ? FPS_MOVING : FPS_SEATED;
}
