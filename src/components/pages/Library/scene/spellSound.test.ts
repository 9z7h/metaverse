import { describe, expect, it } from "vitest";
import { SPELL_ORDER } from "./spellLogic";
import {
  SPELL_SOUNDS,
  SPELL_SOUND_VOLUME,
  SPELL_SOUND_LAYERS,
  hasSpellSound,
  playSpellSound,
} from "./spellSound";

describe("주문 효과음", () => {
  it("네 주문에 모두 효과음이 있다", () => {
    expect(hasSpellSound("myeonggyeong")).toBe(true);
    expect(hasSpellSound("mukryeong")).toBe(true);
    expect(hasSpellSound("hwaryong")).toBe(true);
    expect(hasSpellSound("buun")).toBe(true);
  });

  it("화룡과 부운은 서로 다른 불길과 떠오르는 바람 소리를 사용한다", () => {
    expect(
      SPELL_SOUND_LAYERS.hwaryong?.some(
        ({ sound }) => sound.kind === "hiss" && sound.fromHz > sound.toHz,
      ),
    ).toBe(true);
    expect(
      SPELL_SOUND_LAYERS.buun?.some(
        ({ sound }) => sound.kind === "hiss" && sound.fromHz < sound.toHz,
      ),
    ).toBe(true);
    expect(
      SPELL_SOUND_LAYERS.buun?.some(({ sound }) => sound.kind === "tone"),
    ).toBe(true);
  });

  it("소리가 있는 주문은 모두 알려진 주문이다", () => {
    for (const key of Object.keys(SPELL_SOUNDS)) {
      expect(SPELL_ORDER).toContain(key);
    }
  });

  it("명경을 켤 때 맑은 잔향이 이어진다", () => {
    expect(SPELL_SOUNDS.myeonggyeong).toBeUndefined();
    const layer = SPELL_SOUND_LAYERS.myeonggyeong?.[0];
    expect(layer?.offsetMs).toBeGreaterThan(0);
    expect(layer?.sound.kind).toBe("tone");
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
