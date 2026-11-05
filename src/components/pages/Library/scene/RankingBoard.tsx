/**
 * 사신제 순위판 — 문 위 앞벽에 거는 현판과 기숙사 깃발 네 개.
 *
 * 현판("오늘의 사신제")에서 깃발이 늘어지고, 집중 시간이 많을수록 깃발이 길다.
 * 순위 순서대로 왼쪽부터 걸리며, 순위가 바뀌면 깃발이 부드럽게 자리를 옮긴다.
 * 깃발 한 장에는 문장·순위·기숙사 이름·합계 시간이 적힌다.
 *
 * 문 쪽은 방의 조명이 닿지 않아 어둡기 때문에, 순위판은 조명에 영향받지 않는
 * (MeshBasicMaterial) 재질로 항상 또렷하게 읽히도록 한다.
 */
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CanvasTexture, SRGBColorSpace } from "three";
import type { Group, Mesh } from "three";
import { CREST_SHAPES } from "../HouseCrest";
import { HOUSES, houseToken } from "../houses";
import type { HouseId } from "../houses";
import { flagLength, formatTotal } from "../houseRanking";
import type { RankEntry } from "../houseRanking";
import { FRONT_WALL_Z } from "./sceneLayout";
import type { SceneColors } from "./sceneLayout";

/** 현판 위치(높이)와 깃발이 매달리는 높이 */
const PLAQUE_Y = 5.45;
const FLAG_TOP = 5.08;
/** 깃발 폭·간격 (보는 사람 기준 좌→우) */
const FLAG_W = 0.96;
const FLAG_GAP = 1.16;
/** 깃발 윗부분의 안내 카드 크기 — 최소 깃발 길이(1.2m) 안에 들어간다 */
const CARD_W = 0.8;
const CARD_H = 1.1;
const CARD_PX = { w: 256, h: 352 };

/**
 * 순위 칸(0~3) → 깃발 그룹의 x. 1위가 보는 사람의 왼쪽 끝이다.
 * 판을 y축으로 180° 돌려 걸었고, 문 쪽(+z)을 바라보는 사람에게는 월드 -x가 오른쪽이므로
 * (= 로컬 +x가 오른쪽) 칸 번호가 커질수록 로컬 x도 커진다.
 */
const slotX = (slot: number) => (slot - 1.5) * FLAG_GAP;

function fontFamily() {
  return getComputedStyle(document.body).fontFamily;
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

function makeTexture(w: number, h: number) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

/* ── 현판 ─────────────────────────────────────────────── */

function Plaque({ colors }: { colors: SceneColors }) {
  const texture = useMemo(() => makeTexture(1024, 128), []);
  useEffect(() => () => texture.dispose(), [texture]);

  useRedraw(() => {
    const ctx = (texture.image as HTMLCanvasElement).getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, 1024, 128);
    ctx.fillStyle = colors["--color-scene-flame"];
    ctx.font = `700 64px ${fontFamily()}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("오 늘 의  사 신 제", 512, 68);
    texture.needsUpdate = true;
  }, [colors, texture]);

  return (
    <group position={[0, PLAQUE_Y, 0]}>
      {/* 바깥 테두리(밝은 나무) 위에 검은 바탕(어두운 나무) — 현판 모양 */}
      <mesh position={[0, 0, -0.03]}>
        <boxGeometry args={[5.1, 0.76, 0.06]} />
        <meshBasicMaterial
          color={colors["--color-scene-wood"]}
          toneMapped={false}
        />
      </mesh>
      <mesh>
        <boxGeometry args={[4.94, 0.6, 0.08]} />
        <meshBasicMaterial
          color={colors["--color-scene-wood-dark"]}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, 0, 0.045]}>
        <planeGeometry args={[4.6, 0.575]} />
        <meshBasicMaterial map={texture} transparent toneMapped={false} />
      </mesh>
    </group>
  );
}

/* ── 깃발 ─────────────────────────────────────────────── */

interface FlagProps {
  house: HouseId;
  entry: RankEntry;
  slot: number;
  maxSeconds: number;
  mine: boolean;
  colors: SceneColors;
}

function Flag({ house, entry, slot, maxSeconds, mine, colors }: FlagProps) {
  const root = useRef<Group>(null);
  const cloth = useRef<Mesh>(null);
  const trim = useRef<Mesh>(null);
  const outline = useRef<Mesh>(null);

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
    if (root.current) root.current.position.x = x.current;
    if (cloth.current) {
      cloth.current.scale.y = len.current;
      cloth.current.position.y = -len.current / 2;
    }
    if (trim.current) trim.current.position.y = -len.current + 0.03;
    if (outline.current) {
      outline.current.scale.y = len.current + 0.1;
      outline.current.position.y = -len.current / 2 - 0.03;
    }
  };
  useLayoutEffect(apply);

  useFrame(({ clock }, dt) => {
    const k = 1 - Math.exp(-Math.min(dt, 0.1) * 4);
    x.current += (target.current.x - x.current) * k;
    len.current += (target.current.len - len.current) * k;
    apply();
    // 바람에 살짝 흔들림 (윗부분을 축으로)
    if (root.current) {
      root.current.rotation.z =
        Math.sin(clock.elapsedTime * 0.9 + slot * 1.3) * 0.015;
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
    ctx.clearRect(0, 0, w, h);

    // 문장: 어두운 원판 + 밝은 테두리 + 상징
    ctx.save();
    ctx.translate(w / 2, 78);
    ctx.scale(1.9, 1.9);
    ctx.translate(-32, -32);
    ctx.fillStyle = subtle;
    ctx.beginPath();
    ctx.arc(32, 32, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(32, 32, 28, 0, Math.PI * 2);
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
      ctx.font = `700 28px ${family}`;
      ctx.fillText("내 기숙사", w / 2, 334);
    }
    texture.needsUpdate = true;
  }, [colors, house, entry.rank, timeText, mine, texture]);

  return (
    <group ref={root} position={[slotX(slot), FLAG_TOP, 0]}>
      {/* 깃발 천: 길이는 scale.y로 */}
      <mesh ref={cloth}>
        <planeGeometry args={[FLAG_W, 1]} />
        <meshBasicMaterial
          color={colors[houseToken(house, "primary")]}
          toneMapped={false}
        />
      </mesh>
      {/* 아랫단 장식 띠 (기숙사 포인트색) */}
      <mesh ref={trim} position={[0, -targetLen + 0.03, 0.002]}>
        <planeGeometry args={[FLAG_W, 0.06]} />
        <meshBasicMaterial
          color={colors[houseToken(house, "accent")]}
          toneMapped={false}
        />
      </mesh>
      {/* 안내 카드 (문장·순위·이름·시간) */}
      <mesh position={[0, -0.06 - CARD_H / 2, 0.004]}>
        <planeGeometry args={[CARD_W, CARD_H]} />
        <meshBasicMaterial map={texture} transparent toneMapped={false} />
      </mesh>
      {/* 내 기숙사: 깃발 뒤에 밝은 테두리 (길이는 천과 함께 scale.y로) */}
      {mine ? (
        <mesh ref={outline} position={[0, 0, -0.003]}>
          <planeGeometry args={[FLAG_W + 0.1, 1]} />
          <meshBasicMaterial
            color={colors["--color-scene-flame"]}
            toneMapped={false}
          />
        </mesh>
      ) : null}
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
  return (
    // 앞벽(문이 있는 벽) 안쪽 면 바로 앞. 판을 y축 180° 돌려 방 안쪽(-z)을 바라보게 한다.
    <group position={[0, 0, FRONT_WALL_Z - 0.2]} rotation={[0, Math.PI, 0]}>
      <Plaque colors={colors} />
      {ranking.map((entry, i) => (
        <Flag
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
