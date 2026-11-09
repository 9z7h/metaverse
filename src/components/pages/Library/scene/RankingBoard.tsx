/**
 * 사신제 순위판 — 문 왼쪽에 세우는 목재 걸이대와 기숙사별 비단 족자 네 폭.
 *
 * 족자에는 문장 메달·순위·기숙사 이름·합계 시간이 표시되고, 수련 시간에 따라 길이가 달라진다.
 * 내 기숙사의 족자에는 금실 테두리를 둘러 구분한다.
 *
 * 문 쪽은 방의 조명이 잘 닿지 않아, 순위판 전용 등불을 따로 두고 재질에 약한 자체 발광을 더해
 * 어두운 곳에서도 읽히되 비단 결·금박·목재의 입체감은 살아 있게 한다. 색은 모두 장면 토큰에서 읽는다.
 */
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import {
  CanvasTexture,
  Color,
  PlaneGeometry,
  RepeatWrapping,
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
/**
 * 판이 가로로만 더 줄어든 비균등 배율이라 평면에 그린 문양이 가로로 눌려 보인다.
 * 그림을 그릴 때 가로를 이만큼 미리 늘려 두면 화면에서 원래 비율로 보인다.
 */
const SQUASH_FIX = BOARD_SCALE[1] / BOARD_SCALE[0];
/** 가운데를 기준으로 가로만 `SQUASH_FIX`배 늘려 그리도록 캔버스 변환을 건다 */
function stretchX(ctx: CanvasRenderingContext2D, w: number) {
  ctx.translate(w / 2, 0);
  ctx.scale(SQUASH_FIX, 1);
  ctx.translate(-w / 2, 0);
}
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
/** 족자 길이: 0분이면 min(안내 카드와 시간이 겨우 들어가는 길이), 1위는 min+span */
const SCROLL_LEN = { min: 1.9, span: 1.3 } as const;
/**
 * 시간 글씨 중심이 아랫단에서 올라온 높이. 글씨 아래 여백이 천 위쪽 끝에서 메달까지의
 * 여백(약 0.255)과 같아지도록 잡았다.
 */
const TIME_LIFT = 0.275;
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

/* ── 현판 ─────────────────────────────────────────────── */

function Plaque({
  colors,
  timber,
  gilt,
}: {
  colors: SceneColors;
  timber: Texture;
  gilt: Texture;
}) {
  const texture = useMemo(() => makeTexture(2048, 280), []);
  useEffect(() => () => texture.dispose(), [texture]);

  useRedraw(() => {
    const ctx = (texture.image as HTMLCanvasElement).getContext("2d");
    if (!ctx) return;
    const W = 2048;
    const H = 280;
    const img = gilt.image as HTMLImageElement;
    const n = img.width;
    const goldColor = new Color(colors["--color-scene-brass"])
      .lerp(new Color(colors["--color-scene-collar"]), 0.32)
      .getStyle();
    const goldLight = colors["--color-scene-collar"];
    const woodDark = colors["--color-scene-wood-dark"];
    ctx.clearRect(0, 0, W, H);
    // 바탕: 생성한 금박 편액 재질의 한가운데 나뭇결을 가로로 늘려 쓴다 (결이 가로라 늘어나도 자연스럽다)
    ctx.drawImage(img, n * 0.22, n * 0.3, n * 0.56, n * 0.4, 0, 0, W, H);
    // 양 끝: 같은 재질의 구름무늬 모서리를 가장자리가 번지게 겹쳐 네 모서리에 둔다
    const cornerSrc = n * 0.31;
    const cornerPx = H * 1.02;
    const corner = document.createElement("canvas");
    corner.width = corner.height = 256;
    const cc = corner.getContext("2d");
    if (cc) {
      cc.drawImage(img, 0, 0, cornerSrc, cornerSrc, 0, 0, 256, 256);
      cc.globalCompositeOperation = "destination-in";
      const fade = cc.createRadialGradient(0, 0, 70, 0, 0, 256);
      fade.addColorStop(0, "rgba(0,0,0,1)");
      fade.addColorStop(0.78, "rgba(0,0,0,1)");
      fade.addColorStop(1, "rgba(0,0,0,0)");
      cc.fillStyle = fade;
      cc.fillRect(0, 0, 256, 256);
    }
    for (const [fx, fy] of [
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
    ]) {
      ctx.save();
      ctx.translate(fx === 1 ? 0 : W, fy === 1 ? 0 : H);
      ctx.scale(fx, fy);
      ctx.drawImage(corner, 0, 0, cornerPx, cornerPx);
      ctx.restore();
    }
    // 안쪽 금선 두 줄
    ctx.strokeStyle = withAlpha(goldColor, 0.85);
    ctx.lineWidth = 3;
    ctx.strokeRect(cornerPx * 0.62, 30, W - cornerPx * 1.24, H - 60);
    ctx.lineWidth = 1;
    ctx.strokeRect(cornerPx * 0.62 + 9, 39, W - cornerPx * 1.24 - 18, H - 78);
    // 글씨: 파낸 자리에 금박을 입힌 양각 — 아래 그림자, 위 하이라이트, 금빛 그라데이션
    ctx.font = `700 118px ${fontFamily()}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    const title = "오늘의 사신제";
    const m = ctx.measureText(title);
    // 글자 실측 상자의 한가운데를 나무칸 한가운데(가로 W/2, 세로 H/2)에 맞춘다
    const cx = W / 2 + (m.actualBoundingBoxLeft - m.actualBoundingBoxRight) / 2;
    const cy =
      H / 2 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
    ctx.fillStyle = withAlpha(woodDark, 0.9);
    ctx.fillText(title, cx + 3, cy + 5);
    ctx.fillStyle = withAlpha(goldLight, 0.55);
    ctx.fillText(title, cx - 1.5, cy - 2.5);
    const top = cy - m.actualBoundingBoxAscent;
    const grad = ctx.createLinearGradient(
      0,
      top,
      0,
      cy + m.actualBoundingBoxDescent,
    );
    grad.addColorStop(0, goldLight);
    grad.addColorStop(0.55, goldColor);
    grad.addColorStop(1, withAlpha(goldColor, 0.82));
    ctx.fillStyle = grad;
    ctx.fillText(title, cx, cy);
    texture.needsUpdate = true;
  }, [colors, texture, gilt]);

  const brass = colors["--color-scene-brass"];
  return (
    <group position={[0, PLAQUE.y, 0]}>
      {/* 뒤에 한 단 더 두른 짙은 틀 — 판이 벽에서 떠 보이게 */}
      <mesh position={[0, 0, 0.0]}>
        <boxGeometry args={[PLAQUE.w + 0.1, PLAQUE.h + 0.1, 0.05]} />
        <meshStandardMaterial
          map={timber}
          color={colors["--color-scene-wood-dark"]}
          roughness={0.7}
        />
      </mesh>
      <mesh position={[0, 0, 0.04]}>
        <boxGeometry args={[PLAQUE.w, PLAQUE.h, 0.07]} />
        <meshStandardMaterial map={timber} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0, 0.078]}>
        <planeGeometry args={[PLAQUE.w, PLAQUE.h]} />
        <meshStandardMaterial
          map={texture}
          emissiveMap={texture}
          emissive="white"
          emissiveIntensity={0.42}
          roughness={0.42}
          metalness={0.28}
        />
      </mesh>
      {/* 네 모서리 놋쇠 못 */}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sy) => (
          <mesh
            key={`${sx}${sy}`}
            position={[
              sx * (PLAQUE.w / 2 - 0.045),
              sy * (PLAQUE.h / 2 - 0.045),
              0.092,
            ]}
          >
            <sphereGeometry args={[0.022, 12, 8]} />
            <meshStandardMaterial
              color={brass}
              metalness={0.7}
              roughness={0.35}
            />
          </mesh>
        )),
      )}
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
  silkBump: Texture;
  brocade: Texture;
}

function createScrollGeometry() {
  const geometry = new PlaneGeometry(SCROLL_W, 1, 24, 32);
  const positions = geometry.getAttribute("position");
  for (let i = 0; i < positions.count; i++) {
    const edge = Math.abs(positions.getX(i)) / (SCROLL_W / 2);
    const x = positions.getX(i);
    const v = positions.getY(i) + 0.5;
    // 가장자리는 말려 올라가고, 천은 가운데가 살짝 불룩하며 세로로 아주 완만한 결이 흐른다
    positions.setZ(
      i,
      0.026 * edge ** 8 +
        0.014 * (1 - edge * edge) +
        0.006 * Math.sin(v * Math.PI * 3.2 + x * 2.4),
    );
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
  brocade: Texture,
) {
  const primary = colors[houseToken(house, "primary")];
  const accent = colors[houseToken(house, "accent")];
  const gold = colors["--color-scene-brass"];
  const W = 256;
  const H = 768;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = primary;
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = "multiply";
  ctx.drawImage(fabric.image as CanvasImageSource, 0, 0, W, H);
  ctx.globalCompositeOperation = "source-over";
  // 표구: 본폭 둘레를 금실 운문 비단(배접)으로 두르고 위아래는 조금 더 넓게 댄다
  const bro = brocade.image as HTMLImageElement;
  const band = (x: number, y: number, w: number, h: number) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    const sh = bro.width * (h / w);
    ctx.drawImage(bro, 0, 0, bro.width, Math.min(sh, bro.height), x, y, w, h);
    ctx.restore();
    ctx.strokeStyle = withAlpha(gold, 0.9);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);
  };
  band(0, 0, W, 38);
  band(0, H - 38, W, 38);
  band(0, 38, 17, H - 76);
  band(W - 17, 38, 17, H - 76);
  // 본폭 안쪽의 얇은 금실 선
  ctx.strokeStyle = withAlpha(accent, 0.7);
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 46, W - 48, H - 92);
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
  silkBump,
  brocade,
}: ScrollProps) {
  const crest = useTexture(houseCrestUrl(house));
  const root = useRef<Group>(null);
  const cloth = useRef<Mesh>(null);
  const bottomRod = useRef<Group>(null);
  const frame = useRef<Mesh>(null);
  const timeLabel = useRef<Mesh>(null);
  const ratio = maxSeconds > 0 ? entry.seconds / maxSeconds : 0;
  const targetLength = SCROLL_LEN.min + ratio * SCROLL_LEN.span;
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
    if (ctx) drawSilk(ctx, colors, house, fabric, brocade);
    silk.needsUpdate = true;
  }, [silk, colors, house, fabric, brocade]);

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
    ctx.save();
    stretchX(ctx, w);
    // 바탕·테두리 없이 메달과 글씨만 그려 천 위에 한 겹 덧댄 것처럼 보이지 않게 한다
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
    ctx.restore();
    cardTexture.needsUpdate = true;
  }, [colors, house, entry.rank, mine, cardTexture, crest]);

  const timeTexture = useMemo(() => makeTexture(TIME_PX.w, TIME_PX.h), []);
  useEffect(() => () => timeTexture.dispose(), [timeTexture]);
  useRedraw(() => {
    const ctx = (timeTexture.image as HTMLCanvasElement).getContext("2d");
    if (!ctx) return;
    const { w, h } = TIME_PX;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    stretchX(ctx, w);
    ctx.fillStyle = colors[houseToken(house, "on")];
    ctx.font = `700 138px ${fontFamily()}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(timeText, w / 2, h / 2, (w - 24) / SQUASH_FIX);
    ctx.restore();
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
    if (timeLabel.current) timeLabel.current.position.y = -L + TIME_LIFT;
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
      {[-1, 1].map((sx) => (
        <mesh
          key={sx}
          position={[sx * (SCROLL_W / 2 + 0.095), -0.005, 0.025]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.066, 0.058, 0.07, 20]} />
          <meshStandardMaterial
            color={colors["--color-scene-brass"]}
            metalness={0.3}
            roughness={0.35}
            emissive={colors["--color-scene-brass"]}
            emissiveIntensity={0.4}
          />
        </mesh>
      ))}
      <mesh
        ref={cloth}
        geometry={geometry}
        position={[0, -0.5, 0.012]}
        scale={[1, 1, 1]}
      >
        {/* 비단: 직조 결을 범프로, 비스듬히 볼 때 은은한 광택(sheen)을 준다 */}
        <meshPhysicalMaterial
          map={silk}
          bumpMap={silkBump}
          bumpScale={1.4}
          roughness={0.52}
          sheen={1}
          sheenRoughness={0.4}
          sheenColor={colors[houseToken(house, "accent")]}
          emissiveMap={silk}
          emissive="white"
          emissiveIntensity={0.34}
        />
      </mesh>
      {mine ? (
        <mesh ref={frame} position={[0, -0.5, 0.006]}>
          <planeGeometry args={[SCROLL_W + 0.025, 1]} />
          <meshBasicMaterial color={brass} toneMapped={false} />
        </mesh>
      ) : null}
      <mesh position={[0, -0.8, 0.07]}>
        <planeGeometry args={[CARD_SIZE.w, CARD_SIZE.h]} />
        <meshBasicMaterial map={cardTexture} transparent toneMapped={false} />
      </mesh>
      <mesh ref={timeLabel} position={[0, -targetLength + TIME_LIFT, 0.072]}>
        <planeGeometry args={[TIME_SIZE.w, TIME_SIZE.h]} />
        <meshBasicMaterial map={timeTexture} transparent toneMapped={false} />
      </mesh>
      {/* 아랫축: 양 끝에 금색 마개 */}
      <group ref={bottomRod} position={[0, -targetLength, 0.025]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.047, 0.047, SCROLL_W + 0.16, 24]} />
          <meshStandardMaterial map={timber} roughness={0.58} />
        </mesh>
        {[-1, 1].map((sx) => (
          <mesh
            key={sx}
            position={[sx * (SCROLL_W / 2 + 0.095), 0, 0]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.062, 0.054, 0.07, 20]} />
            <meshStandardMaterial
              color={colors["--color-scene-brass"]}
              metalness={0.3}
              roughness={0.35}
              emissive={colors["--color-scene-brass"]}
              emissiveIntensity={0.4}
            />
          </mesh>
        ))}
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
  const silkBump = useTexture(
    `${import.meta.env.BASE_URL}textures/scroll-silk-bump.jpg`,
    (texture) => {
      texture.wrapS = texture.wrapT = RepeatWrapping;
      texture.repeat.set(5, 14);
      texture.anisotropy = 4;
    },
  );
  const brocade = useTexture(
    `${import.meta.env.BASE_URL}textures/scroll-brocade.jpg`,
    (texture) => {
      texture.colorSpace = SRGBColorSpace;
      texture.anisotropy = 4;
    },
  );
  const gilt = useTexture(
    `${import.meta.env.BASE_URL}textures/plaque-gilt.jpg`,
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
          {/* 받침 윗면: 금색 판 — 장면에 반사할 주변이 없어 금속 재질은 어둡게 나오므로 자체 발광을 더한다 */}
          <mesh position={[x, 0.245, 0.12]}>
            <boxGeometry args={[0.8, 0.025, 0.74]} />
            <meshStandardMaterial
              color={colors["--color-scene-brass"]}
              metalness={0.3}
              roughness={0.35}
              emissive={colors["--color-scene-brass"]}
              emissiveIntensity={0.4}
            />
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

      {/* 순위판 전용 등불 — 방 조명이 닿지 않는 문 쪽에서도 비단 결과 금박이 살아나게 */}
      <pointLight
        position={[0, 3.6, 2.4]}
        color={colors["--color-scene-light"]}
        intensity={9}
        distance={11}
        decay={1.6}
      />
      <Plaque colors={colors} timber={timber} gilt={gilt} />

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
          silkBump={silkBump}
          brocade={brocade}
        />
      ))}
    </group>
  );
}
