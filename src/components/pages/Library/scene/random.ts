/**
 * 결정적 의사난수(LCG) — 같은 seed면 렌더·테스트마다 같은 값이 나와
 * 서가·정원 같은 배치가 매번 똑같이 만들어진다. 0 이상 1 미만을 돌려준다.
 */
export function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
