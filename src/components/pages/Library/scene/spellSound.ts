/**
 * 주문 효과음 — 파일 없이 WebAudio로 짧게 합성한다.
 * 소리가 없는 주문은 아무 일도 하지 않는다. 소리를 낼 수 없는 환경에서도 조용히 넘어간다.
 */
import { getAudioContext } from "./Avatar";
import { getEffectsBus } from "../soundSettings";
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
 *  - 묵령: 불이 꺼지며 "치이" 하고 새는 소리
 */
export const SPELL_SOUNDS: Partial<Record<SpellId, SoundSpec>> = {
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

/**
 * 불빛에는 잔향을, 불꽃에는 불길을, 부운에는 바람과 맑은 울림을 겹친다.
 * 소신은 내려가는 두 음, 거신은 올라가는 두 음, 은형은 숨 같은 바람, 수호령은 종 같은 울림이다.
 */
export const SPELL_SOUND_LAYERS: Partial<
  Record<SpellId, ReadonlyArray<{ offsetMs: number; sound: SoundSpec }>>
> = {
  myeonggyeong: [
    {
      offsetMs: 55,
      sound: {
        kind: "tone",
        freq: 1975.5,
        attackMs: 30,
        partials: [
          { ratio: 1, gain: 0.24, decayMs: 500 },
          { ratio: 2, gain: 0.06, decayMs: 250 },
        ],
      },
    },
  ],
  hwaryong: [
    {
      offsetMs: 0,
      sound: {
        kind: "hiss",
        attackMs: 35,
        decayMs: 680,
        fromHz: 1900,
        toHz: 420,
        q: 0.55,
        gain: 0.8,
      },
    },
    {
      offsetMs: 35,
      sound: {
        kind: "tone",
        freq: 105,
        attackMs: 40,
        partials: [
          { ratio: 1, gain: 0.42, decayMs: 440 },
          { ratio: 2, gain: 0.16, decayMs: 240 },
        ],
      },
    },
    {
      offsetMs: 190,
      sound: {
        kind: "hiss",
        attackMs: 15,
        decayMs: 380,
        fromHz: 3400,
        toHz: 1100,
        q: 0.7,
        gain: 0.3,
      },
    },
  ],
  buun: [
    {
      offsetMs: 0,
      sound: {
        kind: "hiss",
        attackMs: 180,
        decayMs: 900,
        fromHz: 550,
        toHz: 1900,
        q: 0.8,
        gain: 0.35,
      },
    },
    {
      offsetMs: 120,
      sound: {
        kind: "tone",
        freq: 659.25,
        attackMs: 90,
        partials: [
          { ratio: 1, gain: 0.35, decayMs: 850 },
          { ratio: 2, gain: 0.16, decayMs: 520 },
        ],
      },
    },
    {
      offsetMs: 300,
      sound: {
        kind: "tone",
        freq: 987.77,
        attackMs: 60,
        partials: [
          { ratio: 1, gain: 0.2, decayMs: 650 },
          { ratio: 2, gain: 0.07, decayMs: 350 },
        ],
      },
    },
  ],
  sosin: [
    {
      offsetMs: 0,
      sound: {
        kind: "tone",
        freq: 1318.5,
        attackMs: 20,
        partials: [
          { ratio: 1, gain: 0.26, decayMs: 260 },
          { ratio: 2, gain: 0.08, decayMs: 140 },
        ],
      },
    },
    {
      offsetMs: 110,
      sound: {
        kind: "tone",
        freq: 987.77,
        attackMs: 20,
        partials: [
          { ratio: 1, gain: 0.22, decayMs: 320 },
          { ratio: 2, gain: 0.06, decayMs: 160 },
        ],
      },
    },
  ],
  geosin: [
    {
      offsetMs: 0,
      sound: {
        kind: "tone",
        freq: 440,
        attackMs: 40,
        partials: [
          { ratio: 1, gain: 0.32, decayMs: 420 },
          { ratio: 2, gain: 0.1, decayMs: 220 },
        ],
      },
    },
    {
      offsetMs: 140,
      sound: {
        kind: "tone",
        freq: 659.25,
        attackMs: 50,
        partials: [
          { ratio: 1, gain: 0.26, decayMs: 520 },
          { ratio: 2, gain: 0.08, decayMs: 260 },
        ],
      },
    },
  ],
  eunhyeong: [
    {
      offsetMs: 0,
      sound: {
        kind: "hiss",
        attackMs: 260,
        decayMs: 820,
        fromHz: 1200,
        toHz: 2600,
        q: 0.6,
        gain: 0.3,
      },
    },
  ],
  suhoryeong: [
    {
      offsetMs: 0,
      sound: {
        kind: "tone",
        freq: 587.33,
        attackMs: 80,
        partials: [
          { ratio: 1, gain: 0.3, decayMs: 1100 },
          { ratio: 2.76, gain: 0.08, decayMs: 600 },
        ],
      },
    },
    {
      offsetMs: 180,
      sound: {
        kind: "tone",
        freq: 880,
        attackMs: 70,
        partials: [
          { ratio: 1, gain: 0.22, decayMs: 1000 },
          { ratio: 2.76, gain: 0.06, decayMs: 500 },
        ],
      },
    },
    {
      offsetMs: 380,
      sound: {
        kind: "tone",
        freq: 1174.66,
        attackMs: 60,
        partials: [{ ratio: 1, gain: 0.16, decayMs: 1200 }],
      },
    },
  ],
};

/** 효과음 크기(0~1). 은은하게 — 배경음 위에서 거슬리지 않을 만큼 */
export const SPELL_SOUND_VOLUME = 0.12;

/** 주문에 소리가 있는가 */
export function hasSpellSound(spell: SpellId): boolean {
  return (
    SPELL_SOUNDS[spell] !== undefined || SPELL_SOUND_LAYERS[spell] !== undefined
  );
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
  const layers = SPELL_SOUND_LAYERS[spell];
  if (!sound && !layers) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const start = ctx.currentTime + Math.max(0, delayMs) / 1000;
    const out = ctx.createGain();
    out.gain.value = SPELL_SOUND_VOLUME;
    out.connect(getEffectsBus(ctx));
    const play = (part: SoundSpec, at: number) => {
      if (part.kind === "tone") playTone(ctx, part, at, out);
      else playHiss(ctx, part, at, out);
    };
    if (sound) play(sound, start);
    layers?.forEach((layer) =>
      play(layer.sound, start + layer.offsetMs / 1000),
    );
  } catch {
    // 소리를 낼 수 없는 환경이면 조용히 넘어간다
  }
}
