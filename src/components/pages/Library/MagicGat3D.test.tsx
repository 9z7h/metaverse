import { describe, expect, it } from "vitest";
import {
  BRIM_PROFILE,
  CROWN_PROFILE,
  DROP_SECONDS,
  FACE,
  SHOUT_SECONDS,
  blinkScale,
  crownRadiusAt,
  dropOffset,
  mouthOpenness,
  shoutScale,
} from "./MagicGat3D";

describe("사신갓 3D — 모양", () => {
  it("대우는 위로 갈수록 좁아지고 꼭대기에서 닫힌다", () => {
    for (let i = 1; i < CROWN_PROFILE.length; i++) {
      expect(CROWN_PROFILE[i][1]).toBeGreaterThan(CROWN_PROFILE[i - 1][1]);
      expect(CROWN_PROFILE[i][0]).toBeLessThanOrEqual(CROWN_PROFILE[i - 1][0]);
    }
    expect(CROWN_PROFILE[CROWN_PROFILE.length - 1][0]).toBe(0);
  });

  it("양태는 대우보다 훨씬 넓다", () => {
    const widest = Math.max(...BRIM_PROFILE.map(([r]) => r));
    expect(widest).toBeGreaterThan(CROWN_PROFILE[0][0] * 2.5);
  });

  it("높이에 따른 대우 반지름은 윤곽을 이은 값이다", () => {
    expect(crownRadiusAt(-1)).toBe(CROWN_PROFILE[0][0]);
    expect(crownRadiusAt(0.15)).toBeCloseTo(0.49);
    expect(crownRadiusAt(0.25)).toBeCloseTo((0.49 + 0.47) / 2);
    expect(crownRadiusAt(99)).toBe(0);
  });

  it("얼굴 부위는 아래에서 위로 입 → 눈 → 눈썹 순서로 대우 안에 놓인다", () => {
    expect(FACE.mouthY).toBeLessThan(FACE.eyeY);
    expect(FACE.eyeY).toBeLessThan(FACE.browY);
    expect(FACE.browY).toBeLessThan(CROWN_PROFILE[CROWN_PROFILE.length - 1][1]);
  });
});

describe("사신갓 3D — 움직임", () => {
  it("처음엔 높이 올라가 기울어 있고 DROP_SECONDS 뒤 곧게 내려온다", () => {
    const start = dropOffset(0);
    expect(start.y).toBeGreaterThan(2);
    expect(start.tilt).toBeLessThan(0);
    const end = dropOffset(DROP_SECONDS);
    expect(end.y).toBeCloseTo(0);
    expect(end.tilt).toBeCloseTo(0);
    expect(dropOffset(99).y).toBe(0);
    expect(dropOffset(-1).y).toBe(start.y);
  });

  it("내려오는 동안 높이는 줄기만 한다", () => {
    let last = Infinity;
    for (let s = 0; s <= DROP_SECONDS; s += 0.05) {
      const y = dropOffset(s).y;
      expect(y).toBeLessThanOrEqual(last);
      last = y;
    }
  });

  it("말하지 않을 때 입은 거의 닫혀 있고, 말하면 여닫힌다", () => {
    expect(mouthOpenness(1, false, null)).toBeCloseTo(0.05);
    const values = Array.from({ length: 40 }, (_, i) =>
      mouthOpenness(i * 0.05, true, null),
    );
    expect(Math.max(...values)).toBeGreaterThan(0.8);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0.3);
    expect(Math.max(...values)).toBeLessThanOrEqual(1);
  });

  it("외칠 때 입을 활짝 벌렸다가 천천히 닫는다", () => {
    expect(mouthOpenness(5, true, 0.1)).toBe(1);
    expect(mouthOpenness(5, true, 0.7)).toBeLessThan(1);
    expect(mouthOpenness(5, true, 0.7)).toBeGreaterThan(0.05);
    expect(mouthOpenness(5, true, 3)).toBeCloseTo(0.05);
  });

  it("외칠 때 한 번 부풀었다 원래 크기로 돌아온다", () => {
    expect(shoutScale(null)).toBe(1);
    expect(shoutScale(0)).toBeCloseTo(1);
    expect(shoutScale(SHOUT_SECONDS / 2)).toBeCloseTo(1.16);
    expect(shoutScale(SHOUT_SECONDS)).toBeCloseTo(1);
    expect(shoutScale(99)).toBeCloseTo(1);
  });

  it("눈은 대부분 뜨고 있다가 잠깐 감았다 뜬다", () => {
    expect(blinkScale(0)).toBe(1);
    expect(blinkScale(3.31)).toBeLessThan(0.3);
    expect(blinkScale(3.39)).toBeGreaterThan(0.8);
    const samples = Array.from({ length: 340 }, (_, i) => blinkScale(i * 0.01));
    const closed = samples.filter((v) => v < 1).length;
    expect(closed).toBeLessThan(samples.length * 0.1);
    expect(Math.min(...samples)).toBeGreaterThan(0);
  });
});
