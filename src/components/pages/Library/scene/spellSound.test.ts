import { describe, expect, it } from "vitest";
import { SPELL_ORDER } from "./spellLogic";
import {
  SPELL_SOUNDS,
  SPELL_SOUND_VOLUME,
  hasSpellSound,
  playSpellSound,
} from "./spellSound";

describe("주문 효과음", () => {
  it("명경과 묵령에는 소리가 있고 아직 정하지 않은 주문은 없다", () => {
    expect(hasSpellSound("myeonggyeong")).toBe(true);
    expect(hasSpellSound("mukryeong")).toBe(true);
    expect(hasSpellSound("hwaryong")).toBe(false);
  });

  it("소리가 있는 주문은 모두 알려진 주문이다", () => {
    for (const key of Object.keys(SPELL_SOUNDS)) {
      expect(SPELL_ORDER).toContain(key);
    }
  });

  it("명경은 짧고 경쾌한 한 음이다 — 올라오는 시간이 짧고 0.3초 안에 사라진다", () => {
    const tone = SPELL_SOUNDS.myeonggyeong!;
    expect(tone.kind).toBe("tone");
    if (tone.kind !== "tone") return;
    expect(tone.attackMs).toBeLessThanOrEqual(10);
    for (const p of tone.partials) {
      expect(p.decayMs).toBeLessThanOrEqual(300);
    }
  });

  it("묵령은 숨처럼 새며 낮아지는 소리다 — 높이가 내려가고 1초 안에 끝난다", () => {
    const hiss = SPELL_SOUNDS.mukryeong!;
    expect(hiss.kind).toBe("hiss");
    if (hiss.kind !== "hiss") return;
    expect(hiss.toHz).toBeLessThan(hiss.fromHz);
    expect(hiss.attackMs + hiss.decayMs).toBeLessThanOrEqual(1000);
    expect(hiss.gain).toBeGreaterThan(0);
    expect(hiss.gain).toBeLessThanOrEqual(1);
  });

  it("음량은 0보다 크고 작게 유지한다", () => {
    expect(SPELL_SOUND_VOLUME).toBeGreaterThan(0);
    expect(SPELL_SOUND_VOLUME).toBeLessThanOrEqual(0.3);
  });

  it("오디오를 쓸 수 없는 환경에서도 던지지 않는다", () => {
    expect(() => playSpellSound("myeonggyeong", 480)).not.toThrow();
    expect(() => playSpellSound("mukryeong", 480)).not.toThrow();
    expect(() => playSpellSound("hwaryong")).not.toThrow();
  });
});
