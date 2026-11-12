/**
 * 주문 효과음 — 파일 없이 WebAudio로 짧게 합성한다.
 * 소리가 없는 주문은 아무 일도 하지 않는다. 소리를 낼 수 없는 환경에서도 조용히 넘어간다.
 */
import { getAudioContext } from "./Avatar";
import type { SpellId } from "./spellLogic";

/** 소리 하나를 이루는 사인파 — 기본음에 대한 배수, 크기, 사라지는 데 걸리는 시간 */
interface Overtone {
  ratio: number;
  gain: number;
  decayMs: number;
}

/** 맑은 음정 — 짧게 땅 울리고 사라진다 */
interface ToneSpec {
  kind: "tone";
  /** 기본음 Hz */
  freq: number;
  /** 시작할 때 소리가 올라오는 시간 — 짧을수록 "틱" */
  attackMs: number;
  partials: ReadonlyArray<Overtone>;
}

/** 잡음이 숨처럼 새어 나가며 낮아지는 소리 — 불이 꺼질 때의 "치이" */
interface HissSpec {
  kind: "hiss";
  attackMs: number;
  decayMs: number;
  /** 거르는 소리의 높이가 시작에서 끝으로 내려간다 (Hz) */
  fromHz: number;
  toHz: number;
  /** 거르는 폭 — 클수록 좁고 맑게 들린다 */
  q: number;
  /** 이 소리의 상대 크기 (잡음은 같은 크기여도 더 크게 들려 낮춘다) */
  gain: number;
}

type SoundSpec = ToneSpec | HissSpec;

/**
 * 주문별 소리.
 *  - 명경: 불을 켤 때의 짧고 경쾌한 한 음 "틱"
 *  - 묵령: 불이 꺼지며 "치이" 하고 새는 소리
 */
export const SPELL_SOUNDS: Partial<Record<SpellId, SoundSpec>> = {
  myeonggyeong: {
    kind: "tone",
    freq: 1318.5,
    attackMs: 3,
    partials: [
      { ratio: 1, gain: 1, decayMs: 170 },
      { ratio: 2, gain: 0.35, decayMs: 70 },
    ],
  },
  mukryeong: {
    kind: "hiss",
    attackMs: 10,
    decayMs: 420,
    fromHz: 5200,
    toHz: 1300,
    q: 1.1,
    gain: 0.8,
  },
};

/** 효과음 크기(0~1). 은은하게 — 배경음 위에서 거슬리지 않을 만큼 */
export const SPELL_SOUND_VOLUME = 0.12;

/** 주문에 소리가 있는가 */
export function hasSpellSound(spell: SpellId): boolean {
  return SPELL_SOUNDS[spell] !== undefined;
}

let noise: AudioBuffer | null = null;

/** 잡음 1초 분량 — 처음 쓸 때 한 번만 만든다 */
function noiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noise && noise.sampleRate === ctx.sampleRate) return noise;
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  noise = buffer;
  return buffer;
}

function playTone(
  ctx: AudioContext,
  tone: ToneSpec,
  start: number,
  out: AudioNode,
) {
  const attack = tone.attackMs / 1000;
  for (const p of tone.partials) {
    const decay = p.decayMs / 1000;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = tone.freq * p.ratio;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.linearRampToValueAtTime(p.gain, start + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, start + attack + decay);
    osc.connect(env).connect(out);
    osc.start(start);
    osc.stop(start + attack + decay + 0.02);
  }
}

function playHiss(
  ctx: AudioContext,
  hiss: HissSpec,
  start: number,
  out: AudioNode,
) {
  const attack = hiss.attackMs / 1000;
  const decay = hiss.decayMs / 1000;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = hiss.q;
  filter.frequency.setValueAtTime(hiss.fromHz, start);
  filter.frequency.exponentialRampToValueAtTime(
    hiss.toHz,
    start + attack + decay,
  );
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, start);
  env.gain.linearRampToValueAtTime(hiss.gain, start + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, start + attack + decay);
  src.connect(filter).connect(env).connect(out);
  src.start(start);
  src.stop(start + attack + decay + 0.02);
}

/**
 * 주문 효과음을 낸다. delayMs 뒤에 시작한다 — 지팡이가 앞으로 나가는 정점에 맞추려고 쓴다.
 */
export function playSpellSound(spell: SpellId, delayMs = 0): void {
  const sound = SPELL_SOUNDS[spell];
  if (!sound) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const start = ctx.currentTime + Math.max(0, delayMs) / 1000;
    const out = ctx.createGain();
    out.gain.value = SPELL_SOUND_VOLUME;
    out.connect(ctx.destination);
    if (sound.kind === "tone") playTone(ctx, sound, start, out);
    else playHiss(ctx, sound, start, out);
  } catch {
    // 소리를 낼 수 없는 환경이면 조용히 넘어간다
  }
}
