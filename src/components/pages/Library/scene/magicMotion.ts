/**
 * 실습 중 책상 위로 피어오르는 기숙사별 마법 — 파티클 위치 계산 (three.js 무관, 단위 테스트 대상).
 * 좌표는 책상 중심 기준 로컬 좌표(m). y=0은 바닥, 책상 상판은 약 0.8m.
 *
 * - 백호관 (결계 방어): 은백색 결계 고리가 책상 위로 퍼져 나감
 * - 주작관 (치유술·약초술): 따뜻한 불씨가 흔들리며 피어오름
 * - 현무관 (천문술·진법): 별빛이 두 겹의 궤도를 그리며 돎
 * - 청룡관 (기상술·물길): 물줄기가 소용돌이치며 솟아오름
 */
import type { HouseId } from "../houses";

export const MAGIC_PARTICLES = 42;

/** 상판 바로 위 */
const BASE_Y = 0.9;

/** 0~1 결정적 의사난수 (입자마다 고정) */
function hash(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** 반복 주기 안에서의 진행도 0~1 */
const cycle = (t: number, period: number, offset: number) =>
  (((t / period + offset) % 1) + 1) % 1;

export function magicParticle(
  house: HouseId,
  i: number,
  t: number,
): [number, number, number] {
  const r = hash(i);
  const r2 = hash(i + 97);
  switch (house) {
    case "baekho": {
      // 3겹 고리가 시간차를 두고 퍼짐. 입자는 고리 둘레에 고르게.
      const ring = i % 3;
      const p = cycle(t, 2.4, ring / 3);
      const a = (i / MAGIC_PARTICLES) * Math.PI * 2 * 3 + ring;
      const radius = 0.15 + p * 0.75;
      return [
        Math.cos(a) * radius,
        BASE_Y + 0.05 + p * 0.35,
        Math.sin(a) * radius,
      ];
    }
    case "jujak": {
      // 불씨: 아래에서 위로, 좌우로 하늘거림
      const p = cycle(t, 1.8 + r2, r);
      const sway = Math.sin(t * 3 + i) * 0.08 * p;
      return [
        (r - 0.5) * 0.4 + sway,
        BASE_Y + p * 1.3,
        (r2 - 0.5) * 0.3 + Math.cos(t * 2.5 + i) * 0.05 * p,
      ];
    }
    case "hyeonmu": {
      // 별빛: 안쪽·바깥쪽 두 궤도를 반대 방향으로 돎
      const inner = i % 2 === 0;
      const a = r * Math.PI * 2 + t * (inner ? 0.9 : -0.6);
      const radius = inner ? 0.35 : 0.6;
      return [
        Math.cos(a) * radius,
        BASE_Y + 0.45 + (inner ? 0.2 : 0) + Math.sin(t * 1.5 + i) * 0.05,
        Math.sin(a) * radius,
      ];
    }
    case "cheongryong": {
      // 물줄기: 위로 갈수록 좁아지는 나선
      const p = cycle(t, 2.2, r);
      const a = p * Math.PI * 4 + r2 * Math.PI * 2 + t * 1.2;
      const radius = 0.45 * (1 - p) + 0.06;
      return [Math.cos(a) * radius, BASE_Y + p * 1.4, Math.sin(a) * radius];
    }
  }
}
