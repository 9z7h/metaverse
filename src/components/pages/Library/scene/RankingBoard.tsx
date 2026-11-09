/**
 * 사신제 순위판 — 문 왼쪽에 세우는 목재 걸이대와 기숙사별 비단 족자 네 폭.
 *
 * 족자에는 문장 메달·순위·기숙사 이름·합계 시간이 표시되고, 수련 시간에 따라 길이가 달라진다.
 * 내 기숙사의 족자에는 금실 테두리를 둘러 구분한다.
 *
 * 문 쪽은 방의 조명이 닿지 않아 어둡기 때문에, 순위판은 조명에 영향받지 않는
 * (MeshBasicMaterial) 재질로 항상 또렷하게 읽히도록 한다. 색은 모두 장면 토큰에서 읽는다.
 */
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import {
  CanvasTexture,
  Color,
  PlaneGeometry,
  SRGBColorSpace,
} from "three";
import type { Group, Mesh, Texture } from "three";
import { houseCrestUrl } from "../HouseCrest";
import { HOUSES, houseToken } from "../houses";
import type { HouseId } from "../houses";
import { formatTotal } from "../houseRankingLogic";
import type { RankEntry } from "../houseRankingLogic";
import {
  BOARD_CENTER_X,
  BOARD_STAND_Z,
  HALL_WINDOW,
  withAlpha,
} from "./sceneLayout";
import type { SceneColors } from "./sceneLayout";

/* ── 배치 (그룹 로컬 좌표, +z가 보는 사람 쪽) ───────────────── */

/** 판 전체 배율 — 현판 높이를 월드 기준(창문)으로 맞출 때 보정한다 */
const BOARD_SCALE = [0.65, 0.82, 1] as const;
/** 현판 하단이 앞벽 창문 하단과 같은 높이가 되도록 로컬 y를 구한다 */
const PLAQUE_H = 0.62;
/** 창문 하단에서 월드 기준으로 더 내려 달 높이(m) */
const PLAQUE_DROP = 0.06;
const PLAQUE = {
  w: 4.6,
  h: PLAQUE_H,
  y:
    (HALL_WINDOW.y - HALL_WINDOW.h / 2 - PLAQUE_DROP) / BOARD_SCALE[1] +
    PLAQUE_H / 2,
} as const;
/** 네 족자의 폭과 간격 */
const SCROLL_W = 0.96;
const SCROLL_GAP = 1.16;
const SCROLL_TOP = 4.83;
const CARD_SIZE = { w: 0.84, h: 1.18 };
const CARD_PX = { w: 512, h: 704 };
const TIME_SIZE = { w: 0.78, h: 0.24 };
const TIME_PX = { w: 768, h: 216 };

/**
 * 순위 칸(0~3) → 족자 그룹의 x. 1위가 보는 사람의 왼쪽 끝이다.
 * 판을 y축으로 180° 돌려 걸었고, 문 쪽(+z)을 바라보는 사람에게는 월드 -x가 오른쪽이므로
 * (= 로컬 +x가 오른쪽) 칸 번호가 커질수록 로컬 x도 커진다.
 */
const slotX = (slot: number) => (slot - 1.5) * SCROLL_GAP;

/* ── 캔버스 그리기 도우미 ─────────────────────────────── */

function fontFamily() {
  return getComputedStyle(document.body).fontFamily;
}

function makeTexture(w: number, h: number) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

/** 폰트가 늦게 로드돼도 한 번 더 그리도록 */
function useRedraw(draw: () => void, deps: unknown[]) {
  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (!cancelled) draw();
    };
    run();
    document.fonts?.ready.then(run).catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** 8장 꽃잎 장식(현판 모서리) */
function fillRosette(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  petal: string,
  center: string,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = petal;
  for (let i = 0; i < 8; i++) {
    ctx.rotate(Math.PI / 4);
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.62, r * 0.3, r * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = center;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* ── 현판 ─────────────────────────────────────────────── */

function Plaque({ colors, timber }: { colors: SceneColors; timber: Texture }) {
  const texture = useMemo(() => makeTexture(2048, 280), []);
  useEffect(() => () => texture.dispose(), [texture]);

  useRedraw(() => {
    const ctx = (texture.image as HTMLCanvasElement).getContext("2d");
    if (!ctx) return;
    const W = 2048;
    const H = 280;
    const gold = new Color(colors["--color-scene-brass"])
      .lerp(new Color(colors["--color-scene-collar"]), 0.32)
      .getStyle();
    const goldLight = colors["--color-scene-collar"];
    ctx.clearRect(0, 0, W, H);
    // 실제 목재 앞에 얇은 금속선과 읽기 쉬운 글씨를 얹는다.
    ctx.strokeStyle = withAlpha(gold, 0.8);
    ctx.lineWidth = 3;
    ctx.strokeRect(22, 22, W - 44, H - 44);
    ctx.lineWidth = 1;
    ctx.strokeRect(34, 34, W - 68, H - 68);
    for (const [x, y] of [
      [48, 48],
      [W - 48, 48],
      [48, H - 48],
      [W - 48, H - 48],
    ])
      fillRosette(ctx, x, y, 10, gold, colors["--color-scene-wood-dark"]);
    ctx.fillStyle = goldLight;
    ctx.font = `700 120px ${fontFamily()}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    const title = "오늘의 사신제";
    const m = ctx.measureText(title);
    // 글자 실측 상자의 한가운데를 나무칸 한가운데(가로 W/2, 세로 H/2)에 맞춘다
    const cx = W / 2 + (m.actualBoundingBoxLeft - m.actualBoundingBoxRight) / 2;
    const cy =
      H / 2 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
    ctx.fillText(title, cx, cy);
    texture.needsUpdate = true;
  }, [colors, texture]);

  return (
    <group position={[0, PLAQUE.y, 0]}>
      <mesh position={[0, 0, 0.02]}>
        <boxGeometry args={[PLAQUE.w, PLAQUE.h, 0.07]} />
        <meshBasicMaterial map={timber} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, 0.058]}>
        <planeGeometry args={[PLAQUE.w, PLAQUE.h]} />
        <meshBasicMaterial map={texture} transparent toneMapped={false} />
      </mesh>
    </group>
  );
}

/* ── 비단 족자 ───────────────────────────────────────────── */

interface ScrollProps {
  house: HouseId;
  entry: RankEntry;
  slot: number;
  maxSeconds: number;
  mine: boolean;
  colors: SceneColors;
  timber: Texture;
  fabric: Texture;
}

function createScrollGeometry() {
  const geometry = new PlaneGeometry(SCROLL_W, 1, 24, 32);
  const positions = geometry.getAttribute("position");
  for (let i = 0; i < positions.count; i++) {
    const edge = Math.abs(positions.getX(i)) / (SCROLL_W / 2);
    positions.setZ(i, 0.026 * edge ** 8);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function drawSilk(
  ctx: CanvasRenderingContext2D,
  colors: SceneColors,
  house: HouseId,
  fabric: Texture,
) {
  const primary = colors[houseToken(house, "primary")];
  const accent = colors[houseToken(house, "accent")];
  ctx.clearRect(0, 0, 256, 768);
  ctx.fillStyle = primary;
  ctx.fillRect(0, 0, 256, 768);
  ctx.globalCompositeOperation = "multiply";
  ctx.drawImage(fabric.image as CanvasImageSource, 0, 0, 256, 768);
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = withAlpha(accent, 0.56);
  ctx.lineWidth = 3;
  ctx.strokeRect(10, 10, 236, 748);
  ctx.strokeStyle = withAlpha(colors["--color-scene-collar"], 0.42);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(17, 17, 222, 734);
  // 한국 전통 직물의 단정한 끝단처럼 위아래에 얇은 색띠를 넣는다.
  ctx.fillStyle = withAlpha(accent, 0.78);
  ctx.fillRect(18, 22, 220, 10);
  ctx.fillRect(18, 736, 220, 10);
}

function Scroll({
  house,
  entry,
  slot,
  maxSeconds,
  mine,
  colors,
  timber,
  fabric,
}: ScrollProps) {
  const crest = useTexture(houseCrestUrl(house));
  const root = useRef<Group>(null);
  const cloth = useRef<Mesh>(null);
  const bottomRod = useRef<Group>(null);
  const frame = useRef<Mesh>(null);
  const timeLabel = useRef<Mesh>(null);
  const ratio = maxSeconds > 0 ? entry.seconds / maxSeconds : 0;
  const targetLength = 2.35 + ratio * 0.85;
  const length = useRef(targetLength);
  const currentX = useRef(slotX(slot));
  const target = useRef({ x: slotX(slot), length: targetLength });
  target.current = { x: slotX(slot), length: targetLength };
  const geometry = useMemo(createScrollGeometry, []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const silk = useMemo(() => makeTexture(256, 768), []);
  useEffect(() => () => silk.dispose(), [silk]);
  useRedraw(() => {
    const ctx = (silk.image as HTMLCanvasElement).getContext("2d");
    if (ctx) drawSilk(ctx, colors, house, fabric);
    silk.needsUpdate = true;
  }, [silk, colors, house, fabric]);

  const timeText = formatTotal(entry.seconds);
  const cardTexture = useMemo(() => makeTexture(CARD_PX.w, CARD_PX.h), []);
  useEffect(() => () => cardTexture.dispose(), [cardTexture]);
  useRedraw(() => {
    const ctx = (cardTexture.image as HTMLCanvasElement).getContext("2d");
    if (!ctx) return;
    const { w, h } = CARD_PX;
    const ink = colors[houseToken(house, "on")];
    const gold = colors["--color-scene-collar"];
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = withAlpha(colors[houseToken(house, "primary")], 0.92);
    ctx.fillRect(10, 10, w - 20, h - 20);
    ctx.strokeStyle = gold;
    ctx.lineWidth = 5;
    ctx.strokeRect(14, 14, w - 28, h - 28);
    ctx.lineWidth = 2;
    ctx.strokeRect(23, 23, w - 46, h - 46);
    ctx.drawImage(crest.image as CanvasImageSource, w / 2 - 130, 48, 260, 260);
    ctx.fillStyle = ink;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 92px ${fontFamily()}`;
    ctx.fillText(`${entry.rank}위`, w / 2, 390);
    ctx.font = `600 78px ${fontFamily()}`;
    ctx.fillText(HOUSES[house].name, w / 2, 510);
    if (mine) {
      ctx.fillStyle = gold;
      ctx.font = `600 42px ${fontFamily()}`;
      ctx.fillText("내 기숙사", w / 2, 620);
    }
    cardTexture.needsUpdate = true;
  }, [colors, house, entry.rank, mine, cardTexture, crest]);

  const timeTexture = useMemo(() => makeTexture(TIME_PX.w, TIME_PX.h), []);
  useEffect(() => () => timeTexture.dispose(), [timeTexture]);
  useRedraw(() => {
    const ctx = (timeTexture.image as HTMLCanvasElement).getContext("2d");
    if (!ctx) return;
    const { w, h } = TIME_PX;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = colors[houseToken(house, "on")];
    ctx.font = `700 138px ${fontFamily()}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(timeText, w / 2, h / 2, w - 24);
    timeTexture.needsUpdate = true;
  }, [colors, house, timeText, timeTexture]);

  const apply = () => {
    const L = length.current;
    if (root.current) root.current.position.x = currentX.current;
    if (cloth.current) {
      cloth.current.scale.y = L;
      cloth.current.position.y = -L / 2 - 0.035;
    }
    if (bottomRod.current) bottomRod.current.position.y = -L;
    if (timeLabel.current) timeLabel.current.position.y = -L + 0.2;
    if (frame.current) {
      frame.current.scale.y = L + 0.02;
      frame.current.position.y = -L / 2 - 0.035;
    }
  };
  useLayoutEffect(apply);
  useFrame(({ clock }, dt) => {
    const ease = 1 - Math.exp(-Math.min(dt, 0.1) * 4);
    currentX.current += (target.current.x - currentX.current) * ease;
    length.current += (target.current.length - length.current) * ease;
    apply();
    if (root.current)
      root.current.rotation.z =
        Math.sin(clock.elapsedTime * 0.8 + slot * 1.2) * 0.009;
  });

  const brass = new Color(colors["--color-scene-brass"]).lerp(
    new Color(colors["--color-scene-collar"]),
    0.24,
  );
  return (
    <group ref={root} position={[slotX(slot), SCROLL_TOP, 0.08]}>
      {/* 걸이대와 놋쇠 고리를 잇는 짧은 꼰 끈 */}
      <mesh position={[0, 0.08, 0]}>
        <torusGeometry args={[0.048, 0.009, 8, 20]} />
        <meshBasicMaterial color={brass} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.015, 0.018]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.013, 0.013, 0.14, 8]} />
        <meshStandardMaterial map={timber} roughness={0.74} />
      </mesh>
      {/* 윗축에 걸린 비단과, 금실로 두른 안내 패 */}
      <mesh position={[0, -0.005, 0.025]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.052, 0.052, SCROLL_W + 0.16, 24]} />
        <meshStandardMaterial map={timber} roughness={0.58} />
      </mesh>
      <mesh
        ref={cloth}
        geometry={geometry}
        position={[0, -0.5, 0.012]}
        scale={[1, 1, 1]}
      >
        <meshBasicMaterial map={silk} toneMapped={false} />
      </mesh>
      {mine ? (
        <mesh ref={frame} position={[0, -0.5, 0.006]}>
          <planeGeometry args={[SCROLL_W + 0.025, 1]} />
          <meshBasicMaterial color={brass} toneMapped={false} />
        </mesh>
      ) : null}
      <mesh position={[0, -0.68, 0.03]}>
        <planeGeometry args={[CARD_SIZE.w, CARD_SIZE.h]} />
        <meshBasicMaterial map={cardTexture} transparent toneMapped={false} />
      </mesh>
      <mesh ref={timeLabel} position={[0, -targetLength + 0.2, 0.032]}>
        <planeGeometry args={[TIME_SIZE.w, TIME_SIZE.h]} />
        <meshBasicMaterial map={timeTexture} transparent toneMapped={false} />
      </mesh>
      {/* 아랫축과 짧은 금실 술로 족자 끝을 정돈한다. */}
      <group ref={bottomRod} position={[0, -targetLength, 0.025]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.047, 0.047, SCROLL_W + 0.16, 24]} />
          <meshStandardMaterial map={timber} roughness={0.58} />
        </mesh>
        <mesh position={[0, -0.12, 0.01]}>
          <cylinderGeometry args={[0.012, 0.008, 0.24, 8]} />
          <meshStandardMaterial color={brass} metalness={0.46} roughness={0.4} />
        </mesh>
      </group>
    </group>
  );
}

/* ── 순위판 ───────────────────────────────────────────── */

export interface RankingBoardProps {
  colors: SceneColors;
  /** 순위 순서로 정렬된 기숙사별 합계 (`rankHouses` 결과) */
  ranking: RankEntry[];
  myHouse: HouseId;
}

export function RankingBoard({ colors, ranking, myHouse }: RankingBoardProps) {
  const maxSeconds = Math.max(0, ...ranking.map((e) => e.seconds));

  const timber = useTexture(
    `${import.meta.env.BASE_URL}textures/antique-walnut.jpg`,
    (texture) => {
      texture.colorSpace = SRGBColorSpace;
      texture.anisotropy = 4;
    },
  );
  const fabric = useTexture(
    `${import.meta.env.BASE_URL}textures/scroll-silk.jpg`,
    (texture) => {
      texture.colorSpace = SRGBColorSpace;
      texture.anisotropy = 4;
    },
  );
  const gold = new Color(colors["--color-scene-brass"]).lerp(
    new Color(colors["--color-scene-collar"]),
    0.22,
  );
  return (
    // 문 오른쪽에 세워 두는 독립형 거치대. 벽에서 떨어져 방 안쪽을 바라본다.
    <group
      position={[BOARD_CENTER_X, 0, BOARD_STAND_Z]}
      rotation={[0, Math.PI, 0]}
      scale={BOARD_SCALE}
    >
      {/* 양쪽 지지 기둥과 바닥의 무게 받침 */}
      {[-2.65, 2.65].map((x) => (
        <group key={x}>
          <mesh position={[x, 2.98, -0.02]}>
            <boxGeometry args={[0.14, 5.72, 0.16]} />
            <meshStandardMaterial map={timber} roughness={0.68} />
          </mesh>
          <mesh position={[x, 0.12, 0.12]}>
            <boxGeometry args={[0.86, 0.22, 0.8]} />
            <meshStandardMaterial
              color={colors["--color-scene-wood-dark"]}
              map={timber}
              roughness={0.82}
            />
          </mesh>
          <mesh position={[x, 0.245, 0.12]}>
            <boxGeometry args={[0.82, 0.025, 0.75]} />
            <meshBasicMaterial color={gold} toneMapped={false} />
          </mesh>
          {/* 뒤쪽으로 기울어진 버팀목이 측면에서도 독립형 구조를 드러낸다. */}
          <mesh position={[x, 1.82, -0.48]} rotation={[-0.16, 0, 0]}>
            <boxGeometry args={[0.075, 3.28, 0.075]} />
            <meshStandardMaterial map={timber} roughness={0.72} />
          </mesh>
        </group>
      ))}

      {/* 비단 족자를 거는 전통 목재 걸이대와 놋쇠 마감 */}
      <mesh position={[0, SCROLL_TOP + 0.02, 0.04]}>
        <boxGeometry args={[5.18, 0.14, 0.24]} />
        <meshStandardMaterial map={timber} roughness={0.62} />
      </mesh>
      <mesh position={[0, SCROLL_TOP - 0.075, 0.055]}>
        <boxGeometry args={[5.12, 0.022, 0.25]} />
        <meshBasicMaterial color={gold} toneMapped={false} />
      </mesh>

      <Plaque colors={colors} timber={timber} />

      {ranking.map((entry, i) => (
        <Scroll
          key={entry.house}
          house={entry.house}
          entry={entry}
          slot={i}
          maxSeconds={maxSeconds}
          mine={entry.house === myHouse}
          colors={colors}
          timber={timber}
          fabric={fabric}
        />
      ))}
    </group>
  );
}
