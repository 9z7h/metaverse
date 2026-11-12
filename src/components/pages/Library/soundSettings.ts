/** 효과음은 하나의 출력으로 모아 재생 중에도 음량을 함께 바꾼다. */
let effectsVolume = 1;
let effectsBus: GainNode | null = null;
let busContext: AudioContext | null = null;

export function getEffectsVolume(): number {
  return effectsVolume;
}

export function setEffectsVolume(value: number): void {
  effectsVolume = Math.max(0, Math.min(1, value));
  if (effectsBus) effectsBus.gain.value = effectsVolume;
}

export function getEffectsBus(context: AudioContext): GainNode {
  if (!effectsBus || busContext !== context) {
    effectsBus = context.createGain();
    effectsBus.gain.value = effectsVolume;
    effectsBus.connect(context.destination);
    busContext = context;
  }
  return effectsBus;
}
