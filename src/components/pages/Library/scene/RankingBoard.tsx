/**
 * 사신제 순위판 — 문 위 앞벽에 거는 현판과 걸이대, 기숙사 족자(두루마리) 네 폭.
 *
 * 구름무늬·꽃 장식이 있는 현판("오늘의 사신제") 아래 걸이대에 놋쇠 고리로 족자가 걸린다.
 * 족자는 위아래에 축(두루마리 막대)이 있고, 집중 시간이 많을수록 길다.
 * 순위 순서대로 왼쪽부터 걸리며, 순위가 바뀌면 족자가 부드럽게 자리를 옮긴다.
 * 족자 한 폭에는 문장 메달·순위·기숙사 이름·합계 시간이 적히고, 내 기숙사는 금색 틀을 두른다.
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
  LatheGeometry,
  PlaneGeometry,
  SRGBColorSpace,
  Vector2,
} from "three";
import type { Group, Mesh, MeshBasicMaterial, Texture } from "three";
import { CREST_SHAPES } from "../HouseCrest";
import { HOUSES, houseToken } from "../houses";
import type { HouseId } from "../houses";
import { flagLength, formatTotal } from "../houseRankingLogic";
import type { RankEntry } from "../houseRankingLogic";
import {
  FRONT_WALL_Z,
  MASK_WHITE_TOKEN,
  rootToken,
  withAlpha,
} from "./sceneLayout";
import type { SceneColors } from "./sceneLayout";

/* ── 배치 (그룹 로컬 좌표, +z가 보는 사람 쪽) ───────────────── */

/** 널판 벽: 순위판 뒤를 받치는 나무 패널 */
const PANEL = { w: 5.7, h: 2.3, cy: 4.82 } as const;
const PLAQUE = { w: 4.6, h: 0.62, y: 5.62 } as const;
const RAIL_Y = 5.0;
/** 족자 천이 시작되는 높이 — 윗축이 이 높이에 있다 */
const SCROLL_TOP = 4.9;
/** 족자 폭·간격 (보는 사람 기준 좌→우) */
const SCROLL_W = 0.96;
const SCROLL_GAP = 1.16;
/** 윗부분 안내 카드 — 최소 길이(1.2m) 안에 들어간다 */
const CARD_W = 0.8;
const CARD_H = 1.1;
const CARD_PX = { w: 512, h: 704 };
/** 구름무늬가 앉는 족자 아랫단 (이 길이보다 짧으면 카드와 겹치므로 서서히 숨김) */
const CLOUD_FADE_FROM = 1.45;

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

/**
 * 상서구름: 윗면이 둥근 구름 덩이 셋과 말려 나가는 꼬리. (0,0)이 밑선 가운데, 오른쪽이 꼬리.
 * `flip`이면 좌우 반전, `s`는 배율.
 */
function strokeCloud(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  flip: boolean,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flip ? -s : s, s);
  ctx.beginPath();
  ctx.moveTo(-40, 0);
  ctx.lineTo(8, 0);
  ctx.moveTo(-36, 0);
  ctx.arc(-24, 0, 12, Math.PI, Math.PI * 2);
  ctx.moveTo(-18, 0);
  ctx.arc(-6, -2, 14, Math.PI, Math.PI * 2);
  ctx.moveTo(2, 0);
  ctx.arc(12, 0, 10, Math.PI, Math.PI * 2);
  // 꼬리: 오른쪽으로 뻗어 위로 말림
  ctx.moveTo(22, 0);
  ctx.bezierCurveTo(34, 4, 48, -4, 54, -16);
  ctx.arc(50, -20, 6, 0.3, Math.PI * 1.55, true);
  ctx.stroke();
  ctx.restore();
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

/* ── 공유 자원: 널판 벽·구름무늬·축 ─────────────────────── */

let cloudTex: CanvasTexture | null = null;
/** 흰색 구름무늬 알파 마스크 — 재질 color(기숙사 포인트색)가 곱해진다 */
function getCloudTexture() {
  if (cloudTex) return cloudTex;
  const tex = makeTexture(256, 96);
  const ctx = (tex.image as HTMLCanvasElement).getContext("2d");
  if (ctx) {
    // 알파 마스크일 뿐 — 실제 색은 재질 color(기숙사 토큰)가 곱해지므로 흰색 토큰으로 그린다
    ctx.strokeStyle = rootToken(MASK_WHITE_TOKEN);
    ctx.lineWidth = 1.8;
    ctx.lineCap = "round";
    strokeCloud(ctx, 110, 70, 2, false);
  }
  tex.needsUpdate = true;
  cloudTex = tex;
  return tex;
}

let rodGeo: LatheGeometry | null = null;
/**
 * 족자 축 — 양 끝이 굵은 막대. 모든 족자 폭이 같아서 geometry 하나를 공유한다.
 * y축 방향으로 만들어 z축으로 90° 눕혀 쓴다.
 */
function getRodGeometry() {
  if (rodGeo) return rodGeo;
  const half = (SCROLL_W + 0.2) / 2;
  const cap = 0.06;
  const pts: Vector2[] = [
    new Vector2(0, -half),
    new Vector2(0.05, -half),
    new Vector2(0.05, -half + cap),
    new Vector2(0.024, -half + cap + 0.012),
    new Vector2(0.024, half - cap - 0.012),
    new Vector2(0.05, half - cap),
    new Vector2(0.05, half),
    new Vector2(0, half),
  ];
  rodGeo = new LatheGeometry(pts, 14);
  return rodGeo;
}

/** 실제 비단 질감에 기숙사색을 입히고 가장자리에 가는 자수선을 더한다. */
function drawScrollCloth(
  ctx: CanvasRenderingContext2D,
  colors: SceneColors,
  house: HouseId,
  fabric: Texture,
) {
  const primary = colors[houseToken(house, "primary")];
  const accent = colors[houseToken(house, "accent")];
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = primary;
  ctx.fillRect(0, 0, 256, 768);
  ctx.globalCompositeOperation = "multiply";
  ctx.drawImage(fabric.image as CanvasImageSource, 0, 0, 256, 768);
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = withAlpha(accent, 0.48);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(8, 12, 240, 744);
  ctx.strokeStyle = withAlpha(accent, 0.18);
  ctx.lineWidth = 0.7;
  ctx.strokeRect(12, 16, 232, 736);
}

/** 천 끝은 앞으로 조금 말리고, 글자가 놓이는 중앙은 평평하게 유지한다. */
function createScrollGeometry() {
  const geometry = new PlaneGeometry(SCROLL_W, 1, 24, 40);
  const positions = geometry.getAttribute("position");
  for (let i = 0; i < positions.count; i++) {
    const edge = Math.abs(positions.getX(i)) / (SCROLL_W / 2);
    const v = positions.getY(i) + 0.5;
    positions.setZ(
      i,
      0.045 * edge ** 10 +
        0.018 * Math.exp(-(1 - v) * 50) +
        0.025 * Math.exp(-v * 45),
    );
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
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
    ctx.lineCap = "round";
    ctx.strokeStyle = withAlpha(gold, 0.65);
    ctx.lineWidth = 3;
    strokeCloud(ctx, 150, 178, 1.7, false);
    strokeCloud(ctx, W - 150, 178, 1.7, true);
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
    ctx.textBaseline = "middle";
    ctx.fillText("오늘의 사신제", W / 2, 112);
    ctx.fillStyle = gold;
    ctx.font = `400 34px ${fontFamily()}`;
    ctx.fillText("네 기숙사가 함께 쌓은 오늘의 수련", W / 2, 216);
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

/* ── 족자 ─────────────────────────────────────────────── */

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
  const root = useRef<Group>(null);
  const cloth = useRef<Mesh>(null);
  const bottomRod = useRef<Group>(null);
  const cloud = useRef<Mesh>(null);
  const frame = useRef<Mesh>(null);

  const targetX = slotX(slot);
  const targetLen = flagLength(entry.seconds, maxSeconds);
  // 현재 값 — 매 프레임 목표를 향해 부드럽게 따라간다 (처음엔 목표에서 시작해 미끄러져 들어오지 않게)
  const x = useRef(targetX);
  const len = useRef(targetLen);
  const target = useRef({ x: targetX, len: targetLen });
  target.current = { x: targetX, len: targetLen };

  const scrollGeometry = useMemo(createScrollGeometry, []);
  useEffect(() => () => scrollGeometry.dispose(), [scrollGeometry]);
  const silk = useMemo(() => makeTexture(256, 768), []);
  useEffect(() => () => silk.dispose(), [silk]);
  useRedraw(() => {
    const ctx = (silk.image as HTMLCanvasElement).getContext("2d");
    if (ctx) drawScrollCloth(ctx, colors, house, fabric);
    silk.needsUpdate = true;
  }, [silk, colors, house, fabric]);
  const timeText = formatTotal(entry.seconds);
  const texture = useMemo(() => makeTexture(CARD_PX.w, CARD_PX.h), []);
  useEffect(() => () => texture.dispose(), [texture]);

  const apply = () => {
    const L = len.current;
    if (root.current) root.current.position.x = x.current;
    if (cloth.current) {
      cloth.current.scale.y = L;
      cloth.current.position.y = -L / 2;
    }
    if (bottomRod.current) bottomRod.current.position.y = -L;
    if (cloud.current) {
      cloud.current.position.y = -L + 0.3;
      (cloud.current.material as MeshBasicMaterial).opacity =
        Math.min(1, Math.max(0, (L - CLOUD_FADE_FROM) / 0.15)) * 0.24;
    }
    if (frame.current) {
      frame.current.scale.y = L + 0.04;
      frame.current.position.y = -L / 2;
    }
  };
  useLayoutEffect(apply);

  useFrame(({ clock }, dt) => {
    const k = 1 - Math.exp(-Math.min(dt, 0.1) * 4);
    x.current += (target.current.x - x.current) * k;
    len.current += (target.current.len - len.current) * k;
    apply();
    // 바람에 살짝 흔들림 (윗축을 중심으로)
    if (root.current) {
      root.current.rotation.z =
        Math.sin(clock.elapsedTime * 0.9 + slot * 1.3) * 0.012;
    }
  });

  // 글자가 바뀔 때만 다시 그린다 (시간은 분 단위로만 바뀐다)
  useRedraw(() => {
    const ctx = (texture.image as HTMLCanvasElement).getContext("2d");
    if (!ctx) return;
    const { w, h } = CARD_PX;
    const fg = colors[houseToken(house, "on")];
    const accent = colors[houseToken(house, "accent")];
    const subtle = colors[houseToken(house, "subtle")];
    const gold = new Color(colors["--color-scene-brass"])
      .lerp(new Color(colors["--color-scene-collar"]), 0.22)
      .getStyle();
    const family = fontFamily();
    ctx.clearRect(0, 0, w, h);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = withAlpha(fg, 0.55);
    ctx.font = `500 26px ${family}`;
    ctx.fillText("수련 순위", w / 2, 38);

    // 문장은 기숙사색 원판 위에 크게, 금테는 가늘게 그린다.
    ctx.fillStyle = subtle;
    ctx.beginPath();
    ctx.arc(w / 2, 145, 68, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = gold;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(w / 2, 145, 75, 0, Math.PI * 2);
    ctx.stroke();
    ctx.save();
    ctx.translate(w / 2 - 48, 145 - 48);
    ctx.scale(1.5, 1.5);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const crestColor = accent;
    for (const shape of CREST_SHAPES[house]) {
      const path = new Path2D(shape.d);
      if (shape.stroke) {
        ctx.strokeStyle = crestColor;
        ctx.lineWidth = shape.stroke;
        ctx.stroke(path);
      } else {
        ctx.fillStyle = crestColor;
        ctx.fill(path, shape.evenodd ? "evenodd" : "nonzero");
      }
    }
    ctx.restore();

    ctx.fillStyle = fg;
    ctx.font = `700 120px ${family}`;
    ctx.fillText(`${entry.rank}위`, w / 2, 287);
    ctx.font = `600 80px ${family}`;
    ctx.fillText(HOUSES[house].name, w / 2, 390);
    ctx.strokeStyle = withAlpha(fg, 0.16);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(85, 430);
    ctx.lineTo(w - 85, 430);
    ctx.stroke();
    ctx.fillStyle = withAlpha(fg, 0.55);
    ctx.font = `400 28px ${family}`;
    ctx.fillText("오늘의 수련", w / 2, 479);
    ctx.fillStyle = fg;
    ctx.font = `700 84px ${family}`;
    ctx.fillText(timeText, w / 2, 551, w - 40);
    if (mine) {
      ctx.fillStyle = withAlpha(fg, 0.76);
      ctx.font = `600 32px ${family}`;
      ctx.fillText("내 기숙사", w / 2, 653);
      ctx.fillStyle = gold;
      ctx.save();
      ctx.translate(w / 2, 610);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-5, -5, 10, 10);
      ctx.restore();
    }
    texture.needsUpdate = true;
  }, [colors, house, entry.rank, timeText, mine, texture]);

  const gold = new Color(colors["--color-scene-brass"]).lerp(
    new Color(colors["--color-scene-collar"]),
    0.22,
  );
  return (
    <group ref={root} position={[slotX(slot), SCROLL_TOP, 0.1]}>
      {/* 걸이 고리: 걸이대 위의 놋쇠 고리 */}
      <mesh position={[0, 0.1, 0]}>
        <torusGeometry args={[0.047, 0.009, 6, 16]} />
        <meshBasicMaterial color={gold} toneMapped={false} />
      </mesh>
      {/* 윗축 */}
      <mesh
        geometry={getRodGeometry()}
        rotation={[0, 0, Math.PI / 2]}
        position={[0, 0.01, 0.03]}
      >
        <meshBasicMaterial map={timber} toneMapped={false} />
      </mesh>
      {/* 윗축에 감긴 비단. 나무 축의 양 끝은 밖으로 드러난다. */}
      <mesh position={[0, 0.005, 0.012]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.043, 0.043, SCROLL_W, 24]} />
        <meshBasicMaterial
          map={fabric}
          color={colors[houseToken(house, "primary")]}
          toneMapped={false}
        />
      </mesh>
      {/* 말린 가장자리가 있는 족자 천: 길이는 scale.y로 */}
      <mesh ref={cloth} geometry={scrollGeometry}>
        <meshBasicMaterial map={silk} toneMapped={false} />
      </mesh>
      {/* 내 기숙사: 천 둘레에 금색 틀 */}
      {mine ? (
        <mesh ref={frame} position={[0, 0, -0.004]}>
          <planeGeometry args={[SCROLL_W + 0.04, 1]} />
          <meshBasicMaterial color={gold} toneMapped={false} />
        </mesh>
      ) : null}
      {/* 아랫단 구름무늬 (기숙사 포인트색) — 길 때만 보임 */}
      <mesh ref={cloud} position={[0, -targetLen + 0.3, 0.003]}>
        <planeGeometry args={[0.72, 0.27]} />
        <meshBasicMaterial
          map={getCloudTexture()}
          color={colors[houseToken(house, "accent")]}
          transparent
          toneMapped={false}
        />
      </mesh>
      {/* 안내 카드 (메달·순위·이름·시간) */}
      <mesh position={[0, -0.06 - CARD_H / 2, 0.005]}>
        <planeGeometry args={[CARD_W, CARD_H]} />
        <meshBasicMaterial map={texture} transparent toneMapped={false} />
      </mesh>
      {/* 아랫축을 감싸며 말린 비단과 돌출된 나무 마구리 */}
      <group ref={bottomRod} position={[0, -targetLen, 0.03]}>
        <mesh geometry={getRodGeometry()} rotation={[0, 0, Math.PI / 2]}>
          <meshBasicMaterial map={timber} toneMapped={false} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.045, 0.045, SCROLL_W, 24]} />
          <meshBasicMaterial
            map={fabric}
            color={colors[houseToken(house, "primary")]}
            toneMapped={false}
          />
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
    // 앞벽(문이 있는 벽) 안쪽 면 바로 앞. 판을 y축 180° 돌려 방 안쪽(-z)을 바라보게 한다.
    <group position={[0, 0, FRONT_WALL_Z - 0.2]} rotation={[0, Math.PI, 0]}>
      {/* 널판 벽 + 위아래 금띠 */}
      <mesh position={[0, PANEL.cy, -0.1]}>
        <boxGeometry args={[PANEL.w, PANEL.h, 0.1]} />
        <meshBasicMaterial map={timber} toneMapped={false} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, PANEL.cy + (s * PANEL.h) / 2, -0.03]}>
          <boxGeometry args={[PANEL.w + 0.04, 0.018, 0.025]} />
          <meshBasicMaterial color={gold} toneMapped={false} />
        </mesh>
      ))}

      <Plaque colors={colors} timber={timber} />

      {/* 걸이대: 가로 나무 + 양 끝 마구리 */}
      <mesh position={[0, RAIL_Y, 0.06]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.036, 0.036, 5.2, 16]} />
        <meshBasicMaterial map={timber} toneMapped={false} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 2.65, RAIL_Y, 0.06]}>
          <boxGeometry args={[0.15, 0.21, 0.14]} />
          <meshBasicMaterial map={timber} toneMapped={false} />
        </mesh>
      ))}

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
