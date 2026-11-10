import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import type { RefObject } from "react";
import type { CSSProperties } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, useTexture } from "@react-three/drei";
import {
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  LatheGeometry,
  QuadraticBezierCurve3,
  SRGBColorSpace,
  SphereGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Group, PointLight } from "three";
import { formatClock } from "../../../ui/FocusTimer";
import { houseCrestUrl } from "../HouseCrest";
import type { HouseId } from "../houses";
import { swingPose, wandLightIsOn } from "./spellLogic";
import { MASK_WHITE_TOKEN, rootToken } from "./sceneLayout";

/** 도포 윤곽 [높이 y, 반지름 r] — 몸통(Lathe)과 깃이 같은 곡선을 따른다 */
const COAT_PROFILE: ReadonlyArray<readonly [number, number]> = [
  [0.12, 0.345],
  [0.2, 0.338],
  [0.3, 0.318],
  [0.42, 0.296],
  [0.54, 0.268],
  [0.62, 0.246],
  [0.68, 0.238],
  [0.76, 0.228],
  [0.85, 0.222],
  [0.93, 0.22],
  [1.0, 0.205],
  [1.043, 0.15],
  [1.057, 0.1],
];

/** 높이 y에서 도포의 반지름 */
function coatRadiusAt(y: number) {
  const p = COAT_PROFILE;
  if (y <= p[0][0]) return p[0][1];
  for (let i = 1; i < p.length; i++) {
    if (y <= p[i][0]) {
      const [y0, r0] = p[i - 1];
      const [y1, r1] = p[i];
      return r0 + ((y - y0) / (y1 - y0)) * (r1 - r0);
    }
  }
  return p[p.length - 1][1];
}

/**
 * 깃 한 줄: 목선에서 가슴 한가운데로 내려오며 도포 표면을 따라 휘는 띠.
 * 평평한 판자 두 장으로는 몸통의 둥근 면에서 떠서 뻣뻣해 보이므로, 띠의 모든 점을
 * 도포 반지름에 붙여 만든다. 위는 넓고 아래로 갈수록 좁아지며, `lift`로 겹침 순서를 준다.
 * side는 +x(입은 사람의 왼쪽) 쪽이면 1.
 */
function collarStrip(
  side: 1 | -1,
  widthTop: number,
  widthBottom: number,
  lift: number,
  inset = 0,
) {
  const steps = 16;
  const top = 1.035;
  const drop = 0.24;
  const pos: number[] = [];
  const index: number[] = [];
  const center = (t: number) => ({
    // 목선에서 가슴 한가운데로 내려오며 살짝 둥글게 모이고, 아래에서 반대쪽으로 겹친다
    x: side * (0.078 * Math.pow(1 - t, 1.1) - 0.012 * t - inset * (1 - t)),
    y: top - drop * t,
  });
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = center(Math.max(0, t - 0.02));
    const b = center(Math.min(1, t + 0.02));
    const c = center(t);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const w = widthTop + (widthBottom - widthTop) * t;
    for (const k of [-0.5, 0.5]) {
      const x = c.x + nx * w * k;
      const y = c.y + ny * w * k;
      const r = coatRadiusAt(y) + lift;
      pos.push(x, y, Math.sqrt(Math.max(r * r - x * x, 1e-4)));
    }
    if (i < steps) {
      const v = i * 2;
      index.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(pos, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

const mouthCurve = new QuadraticBezierCurve3(
  new Vector3(-0.028, 0.002, 0),
  new Vector3(0, 0.002, 0.005),
  new Vector3(0.028, 0.002, 0),
);

/* ── 발소리: 에셋 없이 WebAudio로 짧게 합성한다 ─────────────────── */

export type FootstepKind = "wood" | "grass";

let audioCtx: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;

/** 샘플을 쓸 수 없을 때의 대체 합성음 — 또각. 잡음(챱챱) 대신 굽이 딱 닿는 짧은 점 소리 + 나무가 울리는 음정으로 만든다.
 * 마루는 높고 맑게, 풀밭은 낮고 둔하게 같은 소리를 작게 낸다. 매번 높낮이·세기를 조금씩 달리한다.
 */
function synthFootstep(kind: FootstepKind, running: boolean) {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    audioCtx ??= new Ctx();
    const ctx = audioCtx;
    if (ctx.state === "suspended") void ctx.resume();
    const t = ctx.currentTime;
    const wood = kind === "wood";
    const vol =
      (running ? 1.2 : 1) * (wood ? 1 : 0.55) * (0.88 + Math.random() * 0.24);
    const tone = (wood ? 1 : 0.62) * (0.94 + Math.random() * 0.12);
    const out = ctx.createGain();
    out.gain.value = 1;
    out.connect(ctx.destination);
    const ring = (
      type: OscillatorType,
      from: number,
      to: number,
      peak: number,
      decay: number,
    ) => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(from * tone, t);
      osc.frequency.exponentialRampToValueAtTime(to * tone, t + decay);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak * vol, t + 0.001);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      osc.connect(g).connect(out);
      osc.start(t);
      osc.stop(t + decay + 0.02);
    };
    // 굽이 닿는 단단한 몸통 소리와 그 위의 맑은 울림
    ring("triangle", 1250, 760, 0.07, 0.07);
    ring("sine", 2500, 2100, 0.022, 0.035);
    // 닿는 순간의 아주 짧은 딱 소리 (잡음은 5ms만, 높은 소리만 통과)
    if (!noiseBuffer) {
      noiseBuffer = ctx.createBuffer(
        1,
        Math.floor(ctx.sampleRate * 0.006),
        ctx.sampleRate,
      );
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++)
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const click = ctx.createBufferSource();
    click.buffer = noiseBuffer;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 3200;
    const cg = ctx.createGain();
    cg.gain.value = 0.03 * vol;
    click.connect(hp).connect(cg).connect(out);
    click.start(t);
  } catch {
    // 소리를 낼 수 없는 환경이면 조용히 넘어간다
  }
}

const FOOTSTEP_FILES = [0, 1, 2, 3, 4].map(
  (i) => `${import.meta.env.BASE_URL}sounds/footstep/wood-00${i}.ogg`,
);
let footstepBuffers: AudioBuffer[] | null = null;
let footstepLoading = false;
let lastFootstep = -1;

/** 발소리 샘플(Kenney, CC0)을 한 번만 불러와 디코딩한다 */
function loadFootsteps(ctx: AudioContext) {
  if (footstepLoading) return;
  footstepLoading = true;
  void Promise.all(
    FOOTSTEP_FILES.map((url) =>
      fetch(url)
        .then((r) => r.arrayBuffer())
        .then((data) => ctx.decodeAudioData(data)),
    ),
  )
    .then((buffers) => {
      footstepBuffers = buffers;
    })
    .catch(() => {
      // 못 불러오면 합성음으로 계속 간다
    });
}

/**
 * 걸음 소리. 실제 나무 바닥 발소리 샘플 5종을 돌려 가며 틀고(같은 것이 연달아 나오지 않게),
 * 매번 속도·세기를 조금씩 달리한다. 풀밭은 같은 샘플을 낮고 둔하게 작게 튼다.
 * 샘플이 아직 없으면 합성음으로 대신한다.
 */
export function playFootstep(kind: FootstepKind, running: boolean) {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    audioCtx ??= new Ctx();
    const ctx = audioCtx;
    if (ctx.state === "suspended") void ctx.resume();
    if (!footstepBuffers) {
      loadFootsteps(ctx);
      synthFootstep(kind, running);
      return;
    }
    let pick = Math.floor(Math.random() * footstepBuffers.length);
    if (pick === lastFootstep) pick = (pick + 1) % footstepBuffers.length;
    lastFootstep = pick;
    const wood = kind === "wood";
    const src = ctx.createBufferSource();
    src.buffer = footstepBuffers[pick];
    src.playbackRate.value = (wood ? 1 : 0.8) * (0.94 + Math.random() * 0.12);
    const gain = ctx.createGain();
    gain.gain.value =
      (wood ? 0.5 : 0.3) * (running ? 1.2 : 1) * (0.85 + Math.random() * 0.3);
    if (wood) {
      src.connect(gain).connect(ctx.destination);
    } else {
      const soften = ctx.createBiquadFilter();
      soften.type = "lowpass";
      soften.frequency.value = 1800;
      src.connect(soften).connect(gain).connect(ctx.destination);
    }
    src.start();
  } catch {
    // 소리를 낼 수 없는 환경이면 조용히 넘어간다
  }
}

export type AvatarPose = "stand" | "walk" | "run" | "sit" | "ride";

/**
 * 이름표(Html)를 붙일 DOM 컨테이너. 기본값(R3F 내부 노드)에 붙이면 Canvas 언마운트 시
 * R3F가 그 노드를 먼저 지워서 이름표 정리 단계에서 removeChild 에러가 난다.
 * → LibraryWorld가 소유한 div에 붙인다.
 */
export const LabelPortalContext =
  createContext<RefObject<HTMLElement | null> | null>(null);

export interface AvatarProps {
  house: HouseId;
  /** 깃 안감·매듭의 기숙사 primary */
  robe: string;
  /** 고름·세조대 색 (기숙사 accent) */
  band?: string;
  /** 깃의 흰 동정 */
  collar: string;
  /** 이름표 앞 기숙사 점 색 */
  houseDot?: string;
  skin: string;
  hat: string;
  pose: AvatarPose;
  /** 앉아서 집중 중이면 고개를 숙이고 끄덕임, 아니면 등을 젖히고 흔들림 */
  focusing?: boolean;
  /** 머리 위 이름표 */
  name: string;
  subject?: string;
  /** 오늘 누적 공부시간(초) — 있으면 이름표에 시계로 보인다 */
  focusSeconds?: number;
  /** 내 아바타 — 이름표 강조 */
  highlight?: boolean;
  /** 이름표 표시 여부. 기본 true */
  showLabel?: boolean;
  /** 실습(마법) 중 — 지팡이를 들고 휘두르며, 이름표에 "실습 중" 표시 */
  practicing?: boolean;
  /** 지팡이 색 (나무) / 지팡이 끝 빛 — 실습 중이거나 주문을 시전할 때만 보인다 */
  wand?: { wood: string; glow: string };
  /** 주문을 시전한 시각(performance.now ms). 이 시각부터 잠깐 지팡이를 들어 휘두른다 */
  castAt?: number | null;
  wandLightAt?: number | null;
  /** 머리 위 말풍선 (서고의 속삭임). 없으면 그리지 않는다 — 글은 항상 텍스트로만 그린다 */
  bubble?: string;
  /** 걸을 때 발소리를 낸다 (내 아바타만) — 바닥 종류에 따라 소리가 다르다 */
  footstep?: FootstepKind;
}

function HousePatch({ house }: { house: HouseId }) {
  const crest = useTexture(houseCrestUrl(house), (texture) => {
    texture.colorSpace = SRGBColorSpace;
  });
  return (
    <mesh position={[-0.152, 0.81, 0.185]} rotation={[0, -0.58, 0]}>
      <planeGeometry args={[0.13, 0.13]} />
      <meshStandardMaterial
        map={crest}
        transparent
        alphaTest={0.08}
        depthWrite={false}
        roughness={0.9}
        side={DoubleSide}
      />
    </mesh>
  );
}

/**
 * 말풍선 모양. 폭은 `max-content`(글 길이만큼)로 두고 `maxWidth`에서만 줄바꿈한다.
 * 주의: `overflow-wrap: anywhere`는 글상자의 "최소 너비"를 글자 하나로 만들어,
 * 자동 너비로 놓이는 이 상자가 한 글자 폭의 세로 줄이 된다 → `break-word`를 쓴다.
 */
export const bubbleStyle: CSSProperties = {
  width: "max-content",
  maxWidth: "calc(var(--spacing-48) * 3)",
  padding: "var(--spacing-8) var(--spacing-12)",
  borderRadius: "var(--radius-xl)",
  background: "var(--color-background-default)",
  color: "var(--color-text-primary)",
  font: "var(--text-body-sm-regular)",
  textAlign: "center",
  whiteSpace: "normal",
  // 한글은 단어 단위로 줄바꿈하되, 띄어쓰기 없는 긴 글도 넘치지 않게
  wordBreak: "keep-all",
  overflowWrap: "break-word",
  pointerEvents: "none",
  userSelect: "none",
};

/** 이름표는 알약 3개가 세로로 쌓인다 — 이름 / 공부명 / 시간 */
const tagStackStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "var(--spacing-2)",
  pointerEvents: "none",
  userSelect: "none",
};

const tagPillStyle = (highlight: boolean): CSSProperties => ({
  display: "flex",
  alignItems: "center",
  gap: "var(--spacing-4)",
  padding: "var(--spacing-2) var(--spacing-8)",
  borderRadius: "var(--radius-circle)",
  background: highlight
    ? "var(--color-background-brand)"
    : "var(--color-background-Subtle)",
  color: highlight ? "var(--color-text-onbrand)" : "var(--color-text-primary)",
  whiteSpace: "nowrap",
});

/**
 * 저폴리곤 사신학당 학생 아바타 — 도포(흰 동정·고름·세조대) + 갓.
 * 먹색 겉도포에 기숙사색 깃 안감과 매듭을 더한다. 위치/회전은 부모가 ref로 제어하고,
 * 여기서는 포즈별 미세 애니메이션(걷기 흔들림, 집중 끄덕임)만 처리한다.
 */
export const Avatar = forwardRef<Group, AvatarProps>(function Avatar(
  {
    house,
    robe,
    band,
    collar,
    houseDot,
    skin,
    hat,
    pose,
    focusing = false,
    name,
    subject,
    focusSeconds,
    highlight = false,
    showLabel = true,
    practicing = false,
    wand,
    castAt = null,
    wandLightAt = null,
    bubble,
    footstep,
  },
  ref,
) {
  const fabric = useTexture(
    `${import.meta.env.BASE_URL}textures/hanbok-fabric.jpg`,
    (texture) => {
      texture.colorSpace = SRGBColorSpace;
      texture.anisotropy = 4;
    },
  );
  const body = useRef<Group>(null);
  const head = useRef<Group>(null);
  const arm = useRef<Group>(null);
  const leftArm = useRef<Group>(null);
  const wandGroup = useRef<Group>(null);
  const wandLight = useRef<Group>(null);
  const wandLightLamp = useRef<PointLight>(null);
  const lightWhite = useMemo(() => rootToken(MASK_WHITE_TOKEN), []);
  const leftFoot = useRef<Group>(null);
  const rightFoot = useRef<Group>(null);
  const coat = useMemo(
    () => new Color(hat).lerp(new Color(robe), 0.16),
    [hat, robe],
  );
  const coatGeometry = useMemo(
    () =>
      new LatheGeometry(
        COAT_PROFILE.map(([y, r]) => new Vector2(r, y)),
        32,
      ),
    [],
  );
  useEffect(() => () => coatGeometry.dispose(), [coatGeometry]);
  // 깃: 입은 사람의 오른쪽(-x) 깃이 왼쪽(+x) 깃 위에 겹친다 (우임). 안깃 위에 흰 동정이 얹힌다.
  const collarGeometries = useMemo(
    () =>
      ([-1, 1] as const).map((side) => ({
        side,
        base: collarStrip(side, 0.068, 0.05, side === -1 ? 0.012 : 0.006),
        trim: collarStrip(
          side,
          0.024,
          0.016,
          side === -1 ? 0.016 : 0.01,
          0.014,
        ),
      })),
    [],
  );
  useEffect(
    () => () =>
      collarGeometries.forEach((c) => {
        c.base.dispose();
        c.trim.dispose();
      }),
    [collarGeometries],
  );
  // 흰 동정을 많이 섞으면 창백해진다 — 살구빛이 남도록 살짝만 섞는다
  const face = useMemo(
    () => new Color(skin).lerp(new Color(collar), 0.1),
    [skin, collar],
  );
  // 볼·입·코는 피부색에서 붉게/짙게 비껴 만든다 (색을 따로 쓰지 않고 같은 토큰에서 파생)
  const cheek = useMemo(
    () => new Color(skin).offsetHSL(-0.025, 0.28, -0.06),
    [skin],
  );
  const lip = useMemo(
    () => new Color(skin).offsetHSL(-0.04, 0.3, -0.22),
    [skin],
  );
  const noseTone = useMemo(
    () => new Color(face).offsetHSL(-0.01, 0.06, -0.06),
    [face],
  );
  const eyelidTone = useMemo(
    () => new Color(face).lerp(new Color(lip), 0.24),
    [face, lip],
  );
  // 피부 자체에 홍조를 섞어 별도의 원판 테두리가 드러나지 않게 한다.
  const faceGeometry = useMemo(() => {
    const geometry = new SphereGeometry(0.295, 32, 22);
    const positions = geometry.getAttribute("position");
    const vertexColors = new Float32Array(positions.count * 3);
    const shade = new Color();
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);
      const jaw = Math.max(0, Math.min(1, (-y - 0.06) / 0.23));
      positions.setX(i, x * (1 - jaw * 0.1));
      const cheekDistance =
        ((Math.abs(x) - 0.165) / 0.065) ** 2 + ((y + 0.075) / 0.05) ** 2;
      const blush =
        Math.exp(-cheekDistance * 1.8) * Math.max(0, z / 0.295) * 0.45;
      shade.copy(face).lerp(cheek, blush);
      shade.toArray(vertexColors, i * 3);
    }
    positions.needsUpdate = true;
    geometry.setAttribute("color", new Float32BufferAttribute(vertexColors, 3));
    geometry.computeVertexNormals();
    return geometry;
  }, [face, cheek]);
  useEffect(() => () => faceGeometry.dispose(), [faceGeometry]);
  const trim = band ?? robe;
  // 갓끈: 대우 양쪽에서 뺨을 따라 내려와 턱 밑에서 묶인다
  const strapGeometry = useMemo(
    () =>
      mergeGeometries(
        ([-1, 1] as const).map(
          (side) =>
            new TubeGeometry(
              new CatmullRomCurve3([
                new Vector3(side * 0.15, 0.42, 0.1),
                new Vector3(side * 0.262, 0.28, 0.12),
                new Vector3(side * 0.272, 0.1, 0.14),
                new Vector3(side * 0.17, -0.03, 0.17),
                new Vector3(side * 0.04, -0.09, 0.19),
              ]),
              20,
              0.0035,
              4,
              false,
            ),
        ),
      ),
    [],
  );
  useEffect(() => () => strapGeometry?.dispose(), [strapGeometry]);
  const portal = useContext(LabelPortalContext);

  // 걸음·앉음 상태 — 위상(phase)을 누적해 박자가 바뀌어도 발이 튀지 않게 하고,
  // 걷기/달리기/앉기 가중치는 부드럽게 따라가게 해서 출발·정지·착석 때 동작이 뚝 끊기지 않게 한다
  const gait = useRef({ phase: 0, move: 0, run: 0, sit: 0, ride: 0 });
  const lastStep = useRef<number | null>(null);

  useFrame(({ clock }, rawDt) => {
    const t = clock.elapsedTime;
    if (!body.current || !head.current) return;
    const dt = Math.min(rawDt, 0.1);
    const g = gait.current;
    const moving = pose === "walk" || pose === "run";
    g.move += ((moving ? 1 : 0) - g.move) * (1 - Math.exp(-10 * dt));
    g.run += ((pose === "run" ? 1 : 0) - g.run) * (1 - Math.exp(-8 * dt));
    // 구름 탈것("ride")도 앉은 몸짓을 쓰되, 팔은 책상이 없으니 아래로 내린다
    const seated = pose === "sit" || pose === "ride";
    g.sit += ((seated ? 1 : 0) - g.sit) * (1 - Math.exp(-7 * dt));
    g.ride += ((pose === "ride" ? 1 : 0) - g.ride) * (1 - Math.exp(-7 * dt));
    // 걷기 ↔ 달리기 사이 값을 섞는다: mix(걷기, 달리기)
    const mix = (walk: number, run: number) => walk + (run - walk) * g.run;
    // 서 있는 값 ↔ 앉은 값을 섞는다: seat(선 값, 앉은 값)
    const seat = (stand: number, sat: number) => stand + (sat - stand) * g.sit;
    if (moving) g.phase += mix(10, 14) * dt;
    const sw = Math.sin(g.phase);
    const co = Math.cos(g.phase);
    const gm = g.move * (1 - g.sit);
    // 발이 바닥에 닿는 순간(위상이 π/2 + kπ)마다 한 번씩 소리를 낸다
    const stepIndex = Math.floor((g.phase - Math.PI / 2) / Math.PI);
    if (lastStep.current === null) lastStep.current = stepIndex;
    else if (stepIndex !== lastStep.current) {
      lastStep.current = stepIndex;
      if (footstep && gm > 0.5) playFootstep(footstep, g.run > 0.5);
    }

    for (const [foot, side] of [
      [leftFoot.current, -1],
      [rightFoot.current, 1],
    ] as const) {
      if (!foot) continue;
      // 발은 앞으로 나아갈 때(위상 미분이 +) 들린다 — 앞에서 뒤로 끌릴 땐 바닥에 붙는다
      const stride = sw * side;
      const swing = Math.max(0, co * side);
      // 앉으면 무릎을 굽혀 발이 도포 자락 앞으로 나온다
      foot.position.z = 0.045 + stride * mix(0.17, 0.3) * gm + 0.3 * g.sit;
      foot.position.y = 0.065 + swing * mix(0.05, 0.12) * gm + 0.015 * g.sit;
      foot.rotation.x = stride * -0.2 * gm;
    }

    // 걷기·서기 몸짓 (앉았을 땐 아래에서 앉은 값으로 섞인다)
    // 발이 가장 벌어질 때(sw=±1) 몸이 가장 낮고, 발이 교차할 때(sw=0) 가장 높다
    const bounce = (1 + Math.cos(2 * g.phase)) / 2;
    const idle = Math.sin(t * 2) * 0.01;
    const standY = idle + (bounce * mix(0.022, 0.09) - idle) * g.move;
    const standRx = mix(0.04, 0.2) * g.move;
    const headStandRx = -mix(0.04, 0.12) * g.move;

    // 앉은 몸짓: 엉덩이를 의자 면에 얹고(약간만 가라앉음), 숨 쉬듯 미세하게 움직인다
    const breath = Math.sin(t * 1.8) * 0.004;
    const sitHeadRx = practicing
      ? -0.2 + Math.sin(t * 1.2) * 0.04 // 책 대신 회오리를 올려다봄
      : focusing
        ? 0.3 + Math.sin(t * 1.4) * 0.05 // 책을 내려다보며 살짝 끄덕
        : -0.12 + Math.sin(t * 0.6) * 0.04; // 기지개 펴듯 젖힘
    const sitBodyRx = practicing ? 0 : focusing ? 0.14 : -0.06;

    body.current.position.y = seat(standY, -0.1 + breath);
    body.current.rotation.x = seat(standRx, sitBodyRx);
    body.current.rotation.y = sw * mix(0.07, 0.12) * gm;
    body.current.rotation.z = sw * mix(0.03, 0.06) * gm;
    head.current.rotation.x = seat(headStandRx, sitHeadRx);
    // 머리는 몸이 틀어도 정면을 유지하려고 반대로 조금 돌린다
    head.current.rotation.y = -sw * mix(0.04, 0.07) * gm;
    head.current.rotation.z = -sw * 0.015 * gm;

    // 팔은 같은 쪽 발과 반대로 흔든다. 앉으면 무릎 위에 얹고 공부할 땐 살짝 움직인다.
    // 지팡이 휘두르기: 앞으로 든 팔이 작은 원을 그림
    const armSwing = sw * mix(0.45, 1) * g.move;
    const sitArm = focusing ? -1.05 : -0.85;
    // 구름 위: 팔을 몸 옆으로 내리고 구름 흔들림에 맞춰 미세하게 흔든다
    const rideArm = -0.08 + Math.sin(t * 1.6) * 0.03;
    const armDown = (sat: number) => sat + (rideArm - sat) * g.ride;
    // 주문 시전: 평소 팔 자세에서 지팡이를 앞으로 든 자세로 섞는다
    const cast = castAt === null ? null : swingPose(performance.now() - castAt);
    const now = performance.now();
    const wandLit = wandLightIsOn(wandLightAt, now);
    if (wandLight.current) wandLight.current.visible = wandLit;
    if (wandLightLamp.current && wandLightAt !== null) {
      const elapsed = now - wandLightAt;
      const fade = Math.max(0, Math.min(1, elapsed / 400));
      wandLightLamp.current.intensity = 3 * fade;
    }
    if (cast && body.current && head.current) {
      body.current.rotation.y += cast.flick * cast.weight * 0.12;
      body.current.rotation.x += cast.flick * cast.weight * 0.06;
      head.current.rotation.y -= cast.flick * cast.weight * 0.06;
    }
    if (wandGroup.current) {
      wandGroup.current.visible =
        practicing || wandLit || (cast !== null && cast.weight > 0);
    }
    if (arm.current) {
      const baseX = practicing
        ? -1.15 + Math.sin(t * 4) * 0.12
        : seat(
            armSwing,
            armDown(sitArm + (focusing ? Math.sin(t * 2.6) * 0.03 : 0)),
          );
      const baseZ = practicing ? -0.25 + Math.cos(t * 4) * 0.15 : 0;
      const w = cast?.weight ?? 0;
      arm.current.rotation.x =
        baseX + (-1.3 + (cast?.flick ?? 0) * 0.45 - baseX) * w;
      arm.current.rotation.z =
        baseZ + (-0.2 + (cast?.flick ?? 0) * 0.12 - baseZ) * w;
    }
    if (leftArm.current) {
      leftArm.current.rotation.x = seat(-armSwing, armDown(sitArm + 0.05));
    }
  });

  return (
    <group ref={ref}>
      <group ref={body}>
        {/* 겉도포와 안쪽 저고리. 기숙사색은 안감과 작은 매듭에 쓴다. */}
        <mesh geometry={coatGeometry}>
          <meshStandardMaterial
            map={fabric}
            bumpMap={fabric}
            bumpScale={0.0015}
            color={coat}
            roughness={0.9}
            side={DoubleSide}
          />
        </mesh>
        <HousePatch house={house} />
        {/* 앞섶의 겹침과 자락 끝의 가는 선 */}
        <mesh position={[0.045, 0.46, 0.275]} rotation={[-0.16, 0, -0.06]}>
          <boxGeometry args={[0.11, 0.55, 0.018]} />
          <meshStandardMaterial
            map={fabric}
            bumpMap={fabric}
            bumpScale={0.0015}
            color={coat.clone().multiplyScalar(1.12)}
            roughness={0.9}
          />
        </mesh>
        <mesh position={[0, 0.119, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.346, 0.008, 4, 32]} />
          <meshStandardMaterial map={fabric} color={trim} roughness={0.85} />
        </mesh>
        {/* 등 쪽 맞주름: 뒤에서 보는 내 캐릭터에도 옷의 구조가 보인다. */}
        {[-1, 1].map((side) => (
          <mesh
            key={`pleat${side}`}
            position={[side * 0.12, 0.43, -0.279]}
            rotation={[0.13, 0, side * 0.1]}
          >
            <boxGeometry args={[0.012, 0.54, 0.014]} />
            <meshStandardMaterial
              map={fabric}
              color={coat.clone().multiplyScalar(0.65)}
              roughness={1}
            />
          </mesh>
        ))}
        {/* 저고리의 안깃과 그 위에 겹쳐지는 흰 동정 — 도포 표면을 따라 휘는 띠 */}
        {collarGeometries.map(({ side, base, trim: trimGeo }) => (
          <group key={`collar${side}`}>
            <mesh geometry={base}>
              <meshStandardMaterial
                map={fabric}
                color={robe}
                roughness={0.85}
                side={DoubleSide}
              />
            </mesh>
            <mesh geometry={trimGeo}>
              <meshStandardMaterial
                map={fabric}
                color={collar}
                roughness={0.95}
                side={DoubleSide}
              />
            </mesh>
          </group>
        ))}
        {/* 고름: 납작한 매듭과 길이가 다른 두 가닥 */}
        <mesh position={[0.105, 0.76, 0.252]}>
          <sphereGeometry args={[0.026, 8, 6]} />
          <meshStandardMaterial map={fabric} color={trim} roughness={0.75} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh
            key={`ribbon${side}`}
            position={[0.105 + side * 0.026, 0.66, 0.26]}
            rotation={[0, 0, side * 0.2]}
          >
            <boxGeometry args={[0.025, side === 1 ? 0.21 : 0.16, 0.012]} />
            <meshStandardMaterial map={fabric} color={trim} roughness={0.85} />
          </mesh>
        ))}
        {/* 세조대와 허리의 작은 매듭 표식 */}
        <mesh position={[0, 0.665, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.24, 0.012, 6, 24]} />
          <meshStandardMaterial map={fabric} color={trim} roughness={0.8} />
        </mesh>
        <group position={[-0.18, 0.58, 0.215]}>
          <mesh rotation={[0, 0, Math.PI / 4]}>
            <torusGeometry args={[0.034, 0.01, 4, 4]} />
            <meshStandardMaterial map={fabric} color={robe} roughness={0.8} />
          </mesh>
          <mesh position={[0, -0.08, 0]}>
            <cylinderGeometry args={[0.012, 0.024, 0.09, 8]} />
            <meshStandardMaterial map={fabric} color={trim} roughness={0.85} />
          </mesh>
        </group>
        {/* 버선과 검은 신발 */}
        {[-1, 1].map((side) => (
          <group
            key={`shoe${side}`}
            ref={side === 1 ? rightFoot : leftFoot}
            position={[side * 0.125, 0.065, 0.045]}
          >
            <mesh position={[0, 0.035, -0.02]}>
              <cylinderGeometry args={[0.06, 0.06, 0.09, 10]} />
              <meshStandardMaterial map={fabric} color={collar} roughness={1} />
            </mesh>
            <mesh scale={[1, 0.5, 1.65]}>
              <sphereGeometry args={[0.085, 12, 8]} />
              <meshStandardMaterial color={hat} roughness={0.75} />
            </mesh>
          </group>
        ))}
        {/* 양팔과 넓은 소매. 실습하는 오른팔은 기존 동작을 유지한다. */}
        {[-1, 1].map((side) => (
          <group
            key={`arm${side}`}
            ref={side === 1 ? arm : leftArm}
            position={[side * 0.19, 0.96, 0]}
          >
            <group rotation={[0, 0, side * 0.3]}>
              {/* 소매: 어깨에서 좁게 시작해 소맷부리로 갈수록 넓어지는 한복 소매 */}
              <mesh position={[side * 0.035, 0.0, 0]} scale={[1, 1, 0.95]}>
                <sphereGeometry args={[0.082, 16, 12]} />
                <meshStandardMaterial
                  map={fabric}
                  bumpMap={fabric}
                  bumpScale={0.0015}
                  color={coat}
                  roughness={0.9}
                />
              </mesh>
              <mesh position={[side * 0.035, -0.17, 0]} scale={[1, 1, 0.92]}>
                <cylinderGeometry args={[0.082, 0.122, 0.31, 20]} />
                <meshStandardMaterial
                  map={fabric}
                  bumpMap={fabric}
                  bumpScale={0.0015}
                  color={coat}
                  roughness={0.9}
                />
              </mesh>
              <mesh position={[side * 0.035, -0.31, 0]}>
                <cylinderGeometry args={[0.124, 0.124, 0.032, 20]} />
                <meshStandardMaterial
                  map={fabric}
                  color={robe}
                  roughness={0.85}
                />
              </mesh>
              <mesh
                position={[side * 0.035, -0.385, 0.005]}
                scale={[0.85, 1.15, 0.8]}
              >
                <sphereGeometry args={[0.066, 12, 10]} />
                <meshStandardMaterial color={face} roughness={0.85} />
              </mesh>
              {side === 1 && wand ? (
                <group
                  ref={wandGroup}
                  visible={practicing}
                  position={[0.034, -0.42, 0.09]}
                  rotation={[Math.PI / 2, 0, 0]}
                >
                  <mesh position={[0, 0.12, 0]}>
                    <cylinderGeometry args={[0.007, 0.021, 0.42, 16]} />
                    <meshStandardMaterial
                      color={wand.wood}
                      roughness={0.48}
                      metalness={0.08}
                    />
                  </mesh>
                  {/* 대나무 마디와 손잡이를 감싼 천 */}
                  {[0.035, 0.13, 0.225].map((y) => (
                    <mesh
                      key={y}
                      position={[0, y, 0]}
                      rotation={[Math.PI / 2, 0, 0]}
                    >
                      <torusGeometry args={[0.016 - y * 0.02, 0.0025, 6, 16]} />
                      <meshStandardMaterial color={wand.wood} roughness={0.8} />
                    </mesh>
                  ))}
                  <mesh position={[0, -0.035, 0]}>
                    <cylinderGeometry args={[0.023, 0.024, 0.105, 16]} />
                    <meshStandardMaterial color={robe} roughness={0.95} />
                  </mesh>
                  <mesh position={[0, -0.035, 0]}>
                    <cylinderGeometry args={[0.024, 0.024, 0.028, 16]} />
                    <meshStandardMaterial color={collar} roughness={0.9} />
                  </mesh>
                  {/* 북두칠성 금점 */}
                  {[
                    [0, 0.055],
                    [0.007, 0.075],
                    [0.002, 0.097],
                    [0.009, 0.115],
                    [0.003, 0.136],
                    [0.009, 0.155],
                    [0.004, 0.175],
                  ].map(([x, y], i) => (
                    <mesh key={i} position={[x, y, 0.018]}>
                      <sphereGeometry args={[0.0025, 6, 6]} />
                      <meshBasicMaterial color={band} toneMapped={false} />
                    </mesh>
                  ))}
                  {/* 옥 구슬과 수술이 달린 노리개 */}
                  <group position={[0.035, -0.11, 0]} rotation={[0, 0, 0.18]}>
                    <mesh position={[0, 0.025, 0]}>
                      <cylinderGeometry args={[0.002, 0.002, 0.07, 6]} />
                      <meshStandardMaterial color={collar} />
                    </mesh>
                    <mesh position={[0, -0.02, 0]}>
                      <sphereGeometry args={[0.013, 12, 10]} />
                      <meshStandardMaterial color={band} roughness={0.25} />
                    </mesh>
                    <mesh position={[0, -0.075, 0]}>
                      <cylinderGeometry args={[0.012, 0.018, 0.09, 10]} />
                      <meshStandardMaterial color={robe} roughness={0.95} />
                    </mesh>
                  </group>
                  <mesh position={[0, 0.31, 0]}>
                    <sphereGeometry args={[0.015, 8, 8]} />
                    <meshBasicMaterial color={wand.glow} toneMapped={false} />
                  </mesh>
                  {wandLightAt !== null ? (
                    <group
                      ref={wandLight}
                      position={[0, 0.335, 0]}
                      visible={false}
                    >
                      <pointLight
                        ref={wandLightLamp}
                        color={lightWhite}
                        intensity={0}
                        distance={4}
                        decay={2}
                      />
                      <mesh>
                        <sphereGeometry args={[0.035, 12, 10]} />
                        <meshBasicMaterial
                          color={lightWhite}
                          toneMapped={false}
                        />
                      </mesh>
                      <mesh>
                        <sphereGeometry args={[0.095, 12, 10]} />
                        <meshBasicMaterial
                          color={lightWhite}
                          transparent
                          opacity={0.14}
                          depthWrite={false}
                          toneMapped={false}
                        />
                      </mesh>
                    </group>
                  ) : null}
                </group>
              ) : null}
            </group>
          </group>
        ))}
        <group ref={head} position={[0, 1.1, 0]} scale={0.92}>
          {/* 둥근 얼굴과 머리카락, 귀 */}
          <mesh
            geometry={faceGeometry}
            position={[0, 0.17, 0.012]}
            scale={[1, 0.98, 0.94]}
          >
            <meshStandardMaterial vertexColors roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.195, -0.008]}>
            <sphereGeometry
              args={[0.302, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.46]}
            />
            <meshStandardMaterial color={hat} roughness={0.95} />
          </mesh>
          {[-1, 1].map((side) => (
            <group key={`face${side}`}>
              <mesh position={[side * 0.285, 0.16, 0]} scale={[0.55, 1, 0.7]}>
                <sphereGeometry args={[0.064, 10, 8]} />
                <meshStandardMaterial color={face} roughness={0.9} />
              </mesh>
              <mesh
                position={[side * 0.255, 0.24, 0.07]}
                scale={[0.48, 1, 0.6]}
              >
                <sphereGeometry args={[0.086, 10, 8]} />
                <meshStandardMaterial color={hat} roughness={0.95} />
              </mesh>
              {/* 검정 동그라미 눈과 작은 흰색 하이라이트 */}
              <group
                position={[side * 0.105, 0.162, 0.274]}
                rotation={[0, side * 0.36, side * 0.025]}
              >
                <mesh>
                  <circleGeometry args={[0.029, 24]} />
                  <meshBasicMaterial color={hat} />
                </mesh>
                <mesh position={[-0.008, 0.01, 0.002]}>
                  <circleGeometry args={[0.007, 16]} />
                  <meshBasicMaterial color={collar} toneMapped={false} />
                </mesh>
              </group>
              {/* 귓바퀴 안쪽의 오목한 색면 */}
              <mesh
                position={[side * 0.3, 0.155, 0.034]}
                rotation={[0, side * 0.75, 0]}
                scale={[0.55, 1, 0.2]}
              >
                <sphereGeometry args={[0.034, 12, 10]} />
                <meshStandardMaterial color={eyelidTone} roughness={1} />
              </mesh>
            </group>
          ))}
          {/* 콧대와 코끝, 아랫입술의 볼륨 */}
          <mesh position={[0, 0.113, 0.285]} scale={[0.65, 1.65, 0.45]}>
            <sphereGeometry args={[0.024, 12, 12]} />
            <meshStandardMaterial color={face} roughness={0.95} />
          </mesh>
          <mesh position={[0, 0.082, 0.298]} scale={[0.95, 0.7, 0.75]}>
            <sphereGeometry args={[0.022, 14, 12]} />
            <meshStandardMaterial color={noseTone} roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.027, 0.258]} scale={[1.3, 0.4, 0.25]}>
            <sphereGeometry args={[0.022, 12, 8]} />
            <meshStandardMaterial color={eyelidTone} roughness={1} />
          </mesh>
          <mesh position={[0, 0.038, 0.266]}>
            <tubeGeometry args={[mouthCurve, 14, 0.003, 5, false]} />
            <meshStandardMaterial color={lip} roughness={1} />
          </mesh>
          {/* 갓끈과 턱 밑 매듭 */}
          {strapGeometry ? (
            <mesh geometry={strapGeometry}>
              <meshStandardMaterial color={trim} roughness={0.7} />
            </mesh>
          ) : null}
          <mesh position={[0, -0.095, 0.195]}>
            <sphereGeometry args={[0.012, 10, 8]} />
            <meshStandardMaterial color={trim} roughness={0.35} />
          </mesh>
          {/* 갓의 얇은 챙과 원통형 대우 */}
          <mesh position={[0, 0.425, 0]}>
            <cylinderGeometry args={[0.375, 0.385, 0.016, 32]} />
            <meshStandardMaterial color={hat} roughness={0.72} />
          </mesh>
          <mesh position={[0, 0.55, 0]}>
            <cylinderGeometry args={[0.133, 0.153, 0.24, 24]} />
            <meshStandardMaterial color={hat} roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.438, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.153, 0.008, 4, 24]} />
            <meshStandardMaterial color={trim} roughness={0.8} />
          </mesh>
          {/* 챙의 가장자리 테와 대우의 둥근 윗면 */}
          <mesh position={[0, 0.425, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.38, 0.007, 5, 40]} />
            <meshStandardMaterial color={hat} roughness={0.55} />
          </mesh>
          <mesh position={[0, 0.668, 0]} scale={[1, 0.18, 1]}>
            <sphereGeometry
              args={[0.133, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2]}
            />
            <meshStandardMaterial color={hat} roughness={0.8} />
          </mesh>
        </group>
      </group>

      {showLabel ? (
        <Html
          position={[0, 2.05, 0]}
          center
          distanceFactor={7}
          zIndexRange={[10, 0]}
          // drei 타입은 non-null ref를 요구하지만 마운트 전 null은 drei 내부에서 처리된다
          portal={(portal ?? undefined) as RefObject<HTMLElement> | undefined}
        >
          <div style={tagStackStyle} aria-hidden>
            <span
              style={{
                ...tagPillStyle(highlight),
                font: "var(--text-caption-lg-bold)",
              }}
            >
              {houseDot ? (
                <span
                  style={{
                    width: "var(--spacing-8)",
                    height: "var(--spacing-8)",
                    borderRadius: "var(--radius-circle)",
                    background: houseDot,
                  }}
                />
              ) : null}
              {name}
            </span>
            {subject ? (
              <span
                style={{
                  ...tagPillStyle(highlight),
                  font: "var(--text-caption-lg-medium)",
                }}
              >
                {subject}
                {pose === "sit"
                  ? practicing
                    ? " · 실습 중"
                    : focusing
                      ? ""
                      : " · 휴식"
                  : ""}
              </span>
            ) : null}
            {focusSeconds !== undefined ? (
              <span
                style={{
                  ...tagPillStyle(highlight),
                  font: "var(--text-caption-lg-medium)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {formatClock(focusSeconds)}
              </span>
            ) : null}
          </div>
        </Html>
      ) : null}

      {/* 서고의 속삭임: 이름표 위에 잠깐 떠오르는 말풍선 */}
      {bubble ? (
        <Html
          position={[0, 2.75, 0]}
          center
          distanceFactor={7}
          zIndexRange={[11, 1]}
          portal={(portal ?? undefined) as RefObject<HTMLElement> | undefined}
        >
          <div style={bubbleStyle} aria-hidden>
            {bubble}
          </div>
        </Html>
      ) : null}
    </group>
  );
});
