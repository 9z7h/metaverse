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
import { CanvasTexture, LatheGeometry, SRGBColorSpace, Vector2 } from "three";
import type { Group, Mesh, MeshBasicMaterial } from "three";
import { CREST_SHAPES } from "../HouseCrest";
import { HOUSES, houseToken } from "../houses";
import type { HouseId } from "../houses";
import { flagLength, formatTotal } from "../houseRanking";
import type { RankEntry } from "../houseRanking";
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
const CARD_PX = { w: 256, h: 352 };
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

/** 0~1 결정적 의사난수 */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
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
    ctx.lineWidth = 5;
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

/** 세로 널판 질감 — 널판 사이 이음매, 널판마다 살짝 다른 어둡기, 나뭇결 */
function drawPlanks(
  ctx: CanvasRenderingContext2D,
  base: string,
  /** 널판 어둡기·이음매·결에 쓰는 가장 어두운 토큰 색 */
  shade: string,
) {
  const W = 512;
  const H = 512;
  const rand = seeded(11);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);
  const planks = 8;
  const pw = W / planks;
  for (let i = 0; i < planks; i++) {
    ctx.fillStyle = withAlpha(shade, 0.04 + rand() * 0.12);
    ctx.fillRect(i * pw, 0, pw, H);
    ctx.strokeStyle = withAlpha(shade, 0.16);
    ctx.lineWidth = 1.5;
    for (let g = 0; g < 5; g++) {
      const gx = i * pw + 6 + rand() * (pw - 12);
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      for (let y = 0; y <= H; y += 64) {
        ctx.lineTo(gx + (rand() - 0.5) * 5, y);
      }
      ctx.stroke();
    }
    ctx.fillStyle = withAlpha(shade, 0.5);
    ctx.fillRect(i * pw - 1.5, 0, 3, H);
  }
}

/* ── 현판 ─────────────────────────────────────────────── */

function Plaque({ colors }: { colors: SceneColors }) {
  const texture = useMemo(() => makeTexture(2048, 280), []);
  useEffect(() => () => texture.dispose(), [texture]);

  useRedraw(() => {
    const ctx = (texture.image as HTMLCanvasElement).getContext("2d");
    if (!ctx) return;
    const W = 2048;
    const H = 280;
    const gold = colors["--color-scene-light"];
    const goldLight = colors["--color-scene-flame"];
    ctx.clearRect(0, 0, W, H);
    // 바탕(어두운 나무) + 가장자리 살짝 어둡게
    ctx.fillStyle = colors["--color-scene-wood-dark"];
    ctx.fillRect(0, 0, W, H);
    // 이중 금테
    ctx.strokeStyle = gold;
    ctx.lineWidth = 9;
    ctx.strokeRect(18, 18, W - 36, H - 36);
    ctx.lineWidth = 3;
    ctx.strokeRect(40, 40, W - 80, H - 80);
    // 구름무늬 (좌우 대칭)
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.strokeStyle = gold;
    strokeCloud(ctx, 190, 190, 3.2, false);
    strokeCloud(ctx, W - 190, 190, 3.2, true);
    // 모서리 꽃 장식
    for (const [x, y] of [
      [58, 58],
      [W - 58, 58],
      [58, H - 58],
      [W - 58, H - 58],
    ]) {
      fillRosette(ctx, x, y, 30, gold, colors["--color-scene-wood-dark"]);
    }
    // 금색 글자
    ctx.fillStyle = goldLight;
    ctx.font = `700 150px ${fontFamily()}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("오 늘 의  사 신 제", W / 2, H / 2 + 6);
    texture.needsUpdate = true;
  }, [colors, texture]);

  return (
    <group position={[0, PLAQUE.y, 0]}>
      <mesh position={[0, 0, 0.02]}>
        <boxGeometry args={[PLAQUE.w, PLAQUE.h, 0.07]} />
        <meshBasicMaterial
          color={colors["--color-scene-wood-dark"]}
          toneMapped={false}
        />
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
}

function Scroll({ house, entry, slot, maxSeconds, mine, colors }: ScrollProps) {
  const root = useRef<Group>(null);
  const cloth = useRef<Mesh>(null);
  const bottomRod = useRef<Mesh>(null);
  const cloud = useRef<Mesh>(null);
  const frame = useRef<Mesh>(null);

  const targetX = slotX(slot);
  const targetLen = flagLength(entry.seconds, maxSeconds);
  // 현재 값 — 매 프레임 목표를 향해 부드럽게 따라간다 (처음엔 목표에서 시작해 미끄러져 들어오지 않게)
  const x = useRef(targetX);
  const len = useRef(targetLen);
  const target = useRef({ x: targetX, len: targetLen });
  target.current = { x: targetX, len: targetLen };

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
      (cloud.current.material as MeshBasicMaterial).opacity = Math.min(
        1,
        Math.max(0, (L - CLOUD_FADE_FROM) / 0.15),
      );
    }
    if (frame.current) {
      frame.current.scale.y = L + 0.14;
      frame.current.position.y = -L / 2 - 0.03;
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
    const gold = colors["--color-scene-light"];
    ctx.clearRect(0, 0, w, h);

    // 문장 메달: 어두운 원판 + 안쪽 포인트색 테 + 바깥 금테 + 상징
    ctx.save();
    ctx.translate(w / 2, 78);
    ctx.scale(1.9, 1.9);
    ctx.translate(-32, -32);
    ctx.fillStyle = subtle;
    ctx.beginPath();
    ctx.arc(32, 32, 31, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = gold;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(32, 32, 31, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(32, 32, 27.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.scale(0.72, 0.72);
    ctx.translate(12.4, 12.4);
    for (const s of CREST_SHAPES[house]) {
      const path = new Path2D(s.d);
      if (s.stroke) {
        ctx.strokeStyle = accent;
        ctx.lineWidth = s.stroke;
        ctx.stroke(path);
      } else {
        ctx.fillStyle = accent;
        ctx.fill(path, s.evenodd ? "evenodd" : "nonzero");
      }
    }
    ctx.restore();

    const family = fontFamily();
    ctx.fillStyle = fg;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 64px ${family}`;
    ctx.fillText(`${entry.rank}위`, w / 2, 192);
    ctx.font = `700 42px ${family}`;
    ctx.fillText(HOUSES[house].name, w / 2, 246);
    ctx.font = `700 38px ${family}`;
    ctx.fillText(timeText, w / 2, 294);
    if (mine) {
      // "— ◆ —" 장식선 + 내 기숙사
      ctx.strokeStyle = gold;
      ctx.fillStyle = gold;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(34, 322);
      ctx.lineTo(w / 2 - 14, 322);
      ctx.moveTo(w / 2 + 14, 322);
      ctx.lineTo(w - 34, 322);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(w / 2, 314);
      ctx.lineTo(w / 2 + 8, 322);
      ctx.lineTo(w / 2, 330);
      ctx.lineTo(w / 2 - 8, 322);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = fg;
      ctx.font = `700 26px ${family}`;
      ctx.fillText("내 기숙사", w / 2, 346);
    }
    texture.needsUpdate = true;
  }, [colors, house, entry.rank, timeText, mine, texture]);

  const wood = colors["--color-scene-wood-light"];
  const gold = colors["--color-scene-light"];
  return (
    <group ref={root} position={[slotX(slot), SCROLL_TOP, 0.1]}>
      {/* 걸이 고리: 걸이대 위의 놋쇠 고리 */}
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[0.09, 0.2, 0.05]} />
        <meshBasicMaterial color={gold} toneMapped={false} />
      </mesh>
      {/* 윗축 */}
      <mesh
        geometry={getRodGeometry()}
        rotation={[0, 0, Math.PI / 2]}
        position={[0, 0.01, 0.03]}
      >
        <meshBasicMaterial color={wood} toneMapped={false} />
      </mesh>
      {/* 족자 천: 길이는 scale.y로 */}
      <mesh ref={cloth}>
        <planeGeometry args={[SCROLL_W, 1]} />
        <meshBasicMaterial
          color={colors[houseToken(house, "primary")]}
          toneMapped={false}
        />
      </mesh>
      {/* 내 기숙사: 천 둘레에 금색 틀 */}
      {mine ? (
        <mesh ref={frame} position={[0, 0, -0.004]}>
          <planeGeometry args={[SCROLL_W + 0.14, 1]} />
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
      {/* 아랫축 */}
      <mesh
        ref={bottomRod}
        geometry={getRodGeometry()}
        rotation={[0, 0, Math.PI / 2]}
        position={[0, -targetLen, 0.03]}
      >
        <meshBasicMaterial color={wood} toneMapped={false} />
      </mesh>
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

  const planks = useMemo(() => makeTexture(512, 512), []);
  useEffect(() => () => planks.dispose(), [planks]);
  useRedraw(() => {
    const ctx = (planks.image as HTMLCanvasElement).getContext("2d");
    if (!ctx) return;
    drawPlanks(
      ctx,
      colors["--color-scene-wood-dark"],
      colors["--color-background-default"],
    );
    planks.needsUpdate = true;
  }, [colors, planks]);

  const gold = colors["--color-scene-light"];
  const wood = colors["--color-scene-wood"];
  return (
    // 앞벽(문이 있는 벽) 안쪽 면 바로 앞. 판을 y축 180° 돌려 방 안쪽(-z)을 바라보게 한다.
    <group position={[0, 0, FRONT_WALL_Z - 0.2]} rotation={[0, Math.PI, 0]}>
      {/* 널판 벽 + 위아래 금띠 */}
      <mesh position={[0, PANEL.cy, -0.05]}>
        <planeGeometry args={[PANEL.w, PANEL.h]} />
        <meshBasicMaterial map={planks} toneMapped={false} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, PANEL.cy + (s * PANEL.h) / 2, -0.03]}>
          <boxGeometry args={[PANEL.w + 0.1, 0.07, 0.06]} />
          <meshBasicMaterial color={gold} toneMapped={false} />
        </mesh>
      ))}

      <Plaque colors={colors} />

      {/* 걸이대: 가로 나무 + 양 끝 마구리 */}
      <mesh position={[0, RAIL_Y, 0.06]}>
        <boxGeometry args={[5.2, 0.09, 0.1]} />
        <meshBasicMaterial color={wood} toneMapped={false} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 2.65, RAIL_Y, 0.06]}>
          <boxGeometry args={[0.2, 0.3, 0.14]} />
          <meshBasicMaterial color={wood} toneMapped={false} />
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
        />
      ))}
    </group>
  );
}
