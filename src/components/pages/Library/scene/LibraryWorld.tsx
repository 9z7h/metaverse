import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties, PointerEvent, WheelEvent } from "react";
import { Canvas } from "@react-three/fiber";
import { ButtonLarge, ButtonMedium, ButtonSmall } from "../../../ui/Button";
import {
  FocusTimer,
  PRIMARY_LABEL,
  formatClock,
  hourProgress,
} from "../../../ui/FocusTimer";
import type { LibraryPresence, StudyMode } from "../libraryPresence";
import { MagicEffect } from "./MagicEffect";
import type { FocusTimerState } from "../useFocusTimer";
import {
  Bot,
  FloorPicker,
  FrameDriver,
  LeavingBot,
  Player,
  TapMarker,
} from "./Characters";
import type { BotSnapshot } from "./Characters";
import { DISSOLVE_MS, trackLeavers } from "./magicMotion";
import type { Leaver } from "./magicMotion";
import type { FloorPick, MoveOrder } from "./Characters";
import { LibraryRoom } from "./LibraryRoom";
import { HallFrame } from "./HallFrame";
import { Armillary } from "./Armillary";
import { Atmosphere } from "./Atmosphere";
import { HouseCrest } from "../HouseCrest";
import type { RankEntry } from "../houseRanking";
import { RankingBoard } from "./RankingBoard";
import { HOUSES, houseToken, houseVar } from "../houses";
import type { HouseId } from "../houses";
import { LabelPortalContext } from "./Avatar";
import {
  DESK_TOP_Y,
  ORBIT_DEFAULT,
  YAW_FACING_DOOR,
  clampOrbit,
  deskLayout,
  readSceneColors,
  shortestYawTarget,
  tapTarget,
} from "./sceneLayout";
import type { Orbit, SceneColors, Vec2 } from "./sceneLayout";

export interface LibraryWorldProps {
  presence: LibraryPresence;
  timer: FocusTimerState;
  subject: string;
  /** 내 기숙사 */
  house: HouseId;
  /** 오늘의 사신제 — 기숙사별 집중 시간 합계 순위 */
  ranking: RankEntry[];
  /** 이론 / 실습 */
  mode: StudyMode;
  onModeChange: (mode: StudyMode) => void;
  onSit: (seatId: string) => void;
  onStandUp: () => void;
  onStart: () => void;
  onPause: () => void;
  /** 입장 화면으로 */
  onExit: () => void;
}

/** 걷거나 시점을 돌리는 중 60fps, 가만히 앉아 있을 땐 12fps — 장시간 공부 시 발열·배터리 절약 */
const FPS_WALKING = 60;
const FPS_SEATED = 12;

const MODE_LABEL: Record<StudyMode, string> = {
  theory: "이론",
  practice: "실습",
};

/** "동작 줄이기" 설정이면 퇴장 연출 없이 바로 사라진다 */
function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** 퇴장 목록이 그대로면 이전 배열을 돌려줘서 불필요한 상태 갱신을 막는다 */
function sameLeavers(a: Leaver[], b: Leaver[]): Leaver[] {
  return a.length === b.length && a.every((l, i) => l === b[i]) ? a : b;
}

/** 드래그 감도 (px → rad) */
const YAW_PER_PX = 0.008;
const PITCH_PER_PX = 0.005;
/** 순위판 보기: 시점 회전에 걸리는 시간(ms)과 도착 시 시선 각도·거리 배율 */
const TURN_MS = 900;
const BOARD_PITCH = 0.25;
const BOARD_ZOOM = 0.5;

/** 이만큼 덜 움직이고 이 시간 안에 손을 떼면 '탭'(이동), 아니면 '드래그'(시점 회전) */
const TAP_SLOP_PX = 10;
const TAP_MAX_MS = 350;

const hudStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  padding: "var(--spacing-16)",
  paddingTop: "max(var(--spacing-16), env(safe-area-inset-top))",
  paddingBottom: "max(var(--spacing-16), env(safe-area-inset-bottom))",
  pointerEvents: "none", // 빈 영역 터치는 통과, 버튼만 각자 pointerEvents: auto
  boxSizing: "border-box",
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "var(--spacing-8)",
};

const pillStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--spacing-8)",
  padding: "var(--spacing-6) var(--spacing-12)",
  borderRadius: "var(--radius-circle)",
  background: "var(--color-background-Subtle)",
  font: "var(--text-caption-lg-medium)",
  color: "var(--color-text-secondary)",
};

const sheetStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--spacing-12)",
  padding: "var(--spacing-16)",
  borderRadius: "var(--radius-2xl)",
  background: "var(--color-background-Subtle)",
  border: "1px solid var(--color-border-default)",
  pointerEvents: "auto",
};

const auto: CSSProperties = { pointerEvents: "auto" };

/** 화면에는 안 보이고 스크린리더만 읽는 텍스트 */
const visuallyHidden: CSSProperties = {
  position: "absolute",
  width: "1px",
  height: "1px",
  margin: "-1px",
  padding: 0,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
};

const KEY_DIR: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  KeyW: [0, -1],
  ArrowDown: [0, 1],
  KeyS: [0, 1],
  ArrowLeft: [-1, 0],
  KeyA: [-1, 0],
  ArrowRight: [1, 0],
  KeyD: [1, 0],
};

/**
 * 3D 도서관 — 아바타로 걸어 다니다 빈 책상에 앉아 집중 타이머를 켠다.
 * 상태(presence, timer)는 상위 `Library`가 소유한다.
 */
export function LibraryWorld({
  presence,
  timer,
  subject,
  house,
  ranking,
  mode,
  onModeChange,
  onSit,
  onStandUp,
  onStart,
  onPause,
  onExit,
}: LibraryWorldProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const [colors, setColors] = useState<SceneColors | null>(null);
  useLayoutEffect(() => {
    if (rootRef.current) setColors(readSceneColors(rootRef.current));
  }, []);

  const desks = useMemo(
    () => presence.seats.map((s) => deskLayout(s.id)),
    [presence.seats],
  );
  const labelOf = (id: string) =>
    presence.seats.find((s) => s.id === id)?.label ?? id;

  /* 입력: 키보드(WASD·방향키)는 마우스·터치를 못 쓰는 사용자를 위한 대체 수단 — 매 프레임 읽힘 */
  const input = useRef({ x: 0, y: 0 });
  const keys = useRef(new Set<string>());
  const sync = useCallback(() => {
    let x = 0;
    let y = 0;
    keys.current.forEach((k) => {
      x += KEY_DIR[k][0];
      y += KEY_DIR[k][1];
    });
    const len = Math.hypot(x, y);
    input.current = len > 1 ? { x: x / len, y: y / len } : { x, y };
  }, []);

  /* 탭 이동: 바닥을 탭하면 그곳으로, 빈 책상을 탭하면 걸어가서 앉음 */
  const moveOrder = useRef<MoveOrder | null>(null);
  const pickFloor = useRef<FloorPick | null>(null);
  const [marker, setMarker] = useState<{ at: Vec2; key: number } | null>(null);

  const mySeatId = presence.me?.seatId ?? null;
  const [nearSeat, setNearSeat] = useState<string | null>(null);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code in KEY_DIR) {
        keys.current.add(e.code);
        sync();
        e.preventDefault();
      } else if (e.code === "KeyE" && nearSeat && !mySeatId) {
        onSit(nearSeat);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (keys.current.delete(e.code)) sync();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [sync, nearSeat, mySeatId, onSit]);

  // 처음 화면에 있던 학생은 앉은 채로, 이후 들어온 학생만 걸어 들어온다
  const initialIds = useRef(new Set(presence.others.map((s) => s.id)));

  // 나간 학생은 바로 지우지 않고, 마법처럼 스르륵 사라지는 동안만 한 번 더 그린다
  const botRegistry = useRef(new Map<string, BotSnapshot>());
  const prevOthers = useRef(presence.others);
  const [leavers, setLeavers] = useState<Leaver[]>([]);
  useEffect(() => {
    const prev = prevOthers.current;
    prevOthers.current = presence.others;
    if (prefersReducedMotion()) return;
    setLeavers((cur) =>
      sameLeavers(
        cur,
        trackLeavers(prev, presence.others, cur, performance.now()),
      ),
    );
  }, [presence.others]);
  // 연출 시간이 다 된 퇴장자를 정리
  useEffect(() => {
    if (leavers.length === 0) return;
    const id = window.setTimeout(
      () =>
        setLeavers((cur) =>
          sameLeavers(cur, trackLeavers([], [], cur, performance.now())),
        ),
      DISSOLVE_MS + 60,
    );
    return () => window.clearTimeout(id);
  }, [leavers]);

  // 사라지는 중인 자리도 아직 "사용 중" — 연출이 끝나기 전에 그 자리에 앉아 겹치지 않게
  const occupied = useMemo(
    () =>
      new Set([
        ...presence.others.map((s) => s.seatId),
        ...leavers.map((l) => l.student.seatId),
      ]),
    [presence.others, leavers],
  );
  const seat = mySeatId ? deskLayout(mySeatId) : null;
  const focusing = timer.status === "running";
  /** 앉아 있을 때 타이머는 기본 작게 — 3D 공간(함께 공부하는 사람들)이 보이도록 */
  const [expanded, setExpanded] = useState(false);
  const progress = hourProgress(timer.elapsedSeconds);

  /* 시점: 한 손가락/마우스 드래그 = 회전, 두 손가락 핀치·휠 = 줌 */
  const orbit = useRef<Orbit>({ ...ORBIT_DEFAULT });
  const draggingRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchDist = useRef<number | null>(null);
  /** 탭 판별용 — 손을 댄 위치·시각, 그 사이 많이 움직였거나 두 손가락이었는지 */
  const press = useRef<{
    x: number;
    y: number;
    at: number;
    moved: boolean;
  } | null>(null);

  const handleTap = (clientX: number, clientY: number) => {
    if (seat) return; // 앉아 있을 땐 이동하지 않음 (일어나기 버튼으로)
    const pick = pickFloor.current;
    const atFloor = pick?.(clientX, clientY, 0);
    if (!pick || !atFloor) return;
    const t = tapTarget(
      atFloor,
      pick(clientX, clientY, DESK_TOP_Y),
      desks,
      occupied,
    );
    const at = t.kind === "seat" ? t.seat.chair : t.point;
    moveOrder.current = {
      target: at,
      seatId: t.kind === "seat" ? t.seat.seatId : null,
    };
    setMarker({ at, key: performance.now() });
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    stopTurn(); // 순위판으로 돌아가는 중이어도 직접 조작이 우선
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    pinchDist.current = null;
    press.current =
      pointers.current.size === 1
        ? { x: e.clientX, y: e.clientY, at: performance.now(), moved: false }
        : press.current && { ...press.current, moved: true }; // 두 손가락 = 탭 아님
    draggingRef.current = true;
    setDragging(true);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (
      press.current &&
      Math.hypot(e.clientX - press.current.x, e.clientY - press.current.y) >
        TAP_SLOP_PX
    ) {
      press.current.moved = true;
    }
    const pts = [...pointers.current.values()];
    if (pts.length >= 2) {
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (pinchDist.current && d > 0) {
        // 벌리면 가까이(zoom ↓), 오므리면 멀리
        orbit.current = clampOrbit({
          ...orbit.current,
          zoom: orbit.current.zoom * (pinchDist.current / d),
        });
      }
      pinchDist.current = d;
      return;
    }
    orbit.current = clampOrbit({
      ...orbit.current,
      yaw: orbit.current.yaw - (e.clientX - prev.x) * YAW_PER_PX,
      pitch: orbit.current.pitch + (e.clientY - prev.y) * PITCH_PER_PX,
    });
  };
  const onPointerEnd = (e: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    pinchDist.current = null;
    if (pointers.current.size === 0) {
      draggingRef.current = false;
      setDragging(false);
      const p = press.current;
      press.current = null;
      // 거의 안 움직이고 짧게 뗐으면 탭 → 이동 (취소된 포인터는 제외)
      if (
        e.type === "pointerup" &&
        p &&
        !p.moved &&
        performance.now() - p.at <= TAP_MAX_MS
      ) {
        handleTap(e.clientX, e.clientY);
      }
    }
  };
  const onWheel = (e: WheelEvent<HTMLDivElement>) => {
    stopTurn();
    orbit.current = clampOrbit({
      ...orbit.current,
      zoom: orbit.current.zoom * Math.exp(e.deltaY * 0.001),
    });
    // 휠 한 번에도 부드럽게 따라가도록 잠깐 60fps
    draggingRef.current = true;
    setDragging(true);
    window.clearTimeout(wheelTimer.current);
    wheelTimer.current = window.setTimeout(() => {
      draggingRef.current = false;
      setDragging(false);
    }, 400);
  };
  const wheelTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(wheelTimer.current), []);

  /**
   * 순위판(문 위 앞벽) 쪽으로 시점을 부드럽게 돌린다.
   * yaw는 가장 짧은 방향으로, 순위판이 높이 걸려 있으므로 시선을 낮추고 조금 가까이 당긴다.
   * 돌아가는 동안엔 60fps로 그리고, 사용자가 화면을 건드리면 바로 멈춘다.
   */
  const turnRaf = useRef(0);
  const stopTurn = useCallback(() => {
    if (turnRaf.current) {
      cancelAnimationFrame(turnRaf.current);
      turnRaf.current = 0;
    }
  }, []);
  useEffect(() => stopTurn, [stopTurn]);
  const turnToBoard = () => {
    stopTurn();
    const from = orbit.current;
    const to = clampOrbit({
      yaw: shortestYawTarget(from.yaw, YAW_FACING_DOOR),
      pitch: BOARD_PITCH,
      zoom: BOARD_ZOOM,
    });
    const t0 = performance.now();
    draggingRef.current = true;
    setDragging(true);
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / TURN_MS);
      const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2; // easeInOutQuad
      orbit.current = {
        yaw: from.yaw + (to.yaw - from.yaw) * e,
        pitch: from.pitch + (to.pitch - from.pitch) * e,
        zoom: from.zoom + (to.zoom - from.zoom) * e,
      };
      if (p < 1) {
        turnRaf.current = requestAnimationFrame(step);
      } else {
        turnRaf.current = 0;
        draggingRef.current = false;
        setDragging(false);
      }
    };
    turnRaf.current = requestAnimationFrame(step);
  };

  return (
    <div
      ref={rootRef}
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--color-background-default)",
        touchAction: "none",
      }}
    >
      {/* 캔버스 영역: 탭 = 이동, 드래그 = 시점 회전. HUD는 형제 요소라 버튼 조작과 겹치지 않음 */}
      <div
        data-testid="camera-drag-area"
        style={{
          position: "absolute",
          inset: 0,
          cursor: dragging ? "grabbing" : "pointer",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onWheel={onWheel}
      >
        {colors ? (
          <Canvas
            frameloop="demand"
            dpr={[1, 1.5]}
            camera={{ fov: 50, position: [0, 5.2, 13], near: 0.1, far: 90 }}
            onCreated={({ gl }) => {
              if (import.meta.env.DEV) {
                // 검증용: 렌더 횟수(gl.info.render.frame)로 실제 fps 측정
                (window as unknown as { __libraryGl?: unknown }).__libraryGl =
                  gl;
              }
            }}
            aria-label="3D 도서관"
          >
            <LabelPortalContext.Provider value={labelRef}>
              <color
                attach="background"
                args={[colors["--color-background-default"]]}
              />
              {/* 긴 서고의 안쪽이 안개 속으로 깊어지게 — 넓어진 홀(약 31m)에 맞춤 */}
              <fog attach="fog" args={[colors["--color-scene-fog"], 14, 44]} />
              <ambientLight
                intensity={0.55}
                color={colors["--color-scene-light"]}
              />
              <hemisphereLight
                args={[
                  colors["--color-scene-light"],
                  colors["--color-scene-floor"],
                  0.5,
                ]}
              />
              {/* 모바일 부담을 줄이려 실제 광원은 통로 위 4개만 — 나머지 불빛은 발광·번짐으로 표현 */}
              {[-9, -3, 3, 9].map((z) => (
                <pointLight
                  key={z}
                  position={[0, 3.2, z]}
                  intensity={9}
                  distance={11}
                  decay={1.6}
                  color={colors["--color-scene-flame"]}
                />
              ))}

              <LibraryRoom colors={colors} desks={desks} />
              <HallFrame colors={colors} />
              <Armillary colors={colors} />
              <Atmosphere colors={colors} />
              {presence.others.map((s) => (
                <Bot
                  key={s.id}
                  student={s}
                  colors={colors}
                  entering={!initialIds.current.has(s.id)}
                  registry={botRegistry}
                />
              ))}
              {leavers.map((l) => (
                <LeavingBot
                  key={`${l.student.id}:${l.since}`}
                  student={l.student}
                  colors={colors}
                  since={l.since}
                  registry={botRegistry}
                />
              ))}
              <Player
                colors={colors}
                desks={desks}
                input={input}
                moveOrder={moveOrder}
                onArriveSeat={onSit}
                practicing={Boolean(seat && focusing && mode === "practice")}
                occupied={occupied}
                seat={seat}
                focusing={focusing}
                subject={subject}
                house={house}
                onNearSeatChange={setNearSeat}
                orbit={orbit}
                dragging={draggingRef}
              />
              <FloorPicker pickRef={pickFloor} />
              <RankingBoard colors={colors} ranking={ranking} myHouse={house} />
              {marker && !seat ? (
                <TapMarker
                  key={marker.key}
                  at={marker.at}
                  color={colors[houseToken(house, "accent")]}
                />
              ) : null}
              {/* 내가 실습 중이면 내 책상 위로 기숙사 마법 */}
              {seat && focusing && mode === "practice" ? (
                <MagicEffect colors={colors} house={house} at={seat.desk} />
              ) : null}
              <FrameDriver
                fps={
                  seat && !dragging && leavers.length === 0
                    ? FPS_SEATED
                    : FPS_WALKING
                }
              />
            </LabelPortalContext.Provider>
          </Canvas>
        ) : null}
      </div>
      {/* 아바타 이름표가 붙는 레이어 — 캔버스와 같은 크기, 터치는 통과 */}
      <div
        ref={labelRef}
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          pointerEvents: "none",
          // 독립된 쌓임 맥락: 이름표 안쪽의 z-index(최대 10)가 HUD(순위표 등) 위로 올라오지 않게 가둔다
          zIndex: 0,
        }}
      />

      {/* ── HUD ── */}
      <div style={hudStyle}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--spacing-8)",
          }}
        >
          <div style={rowStyle}>
            <div
              style={{
                ...auto,
                display: "flex",
                alignItems: "center",
                gap: "var(--spacing-8)",
              }}
            >
              <ButtonMedium
                type="icon"
                icon="arrow_left"
                style="monolight"
                aria-label="도서관 나가기"
                onClick={onExit}
              />
              <span style={pillStyle} aria-live="polite">
                <span
                  aria-hidden
                  style={{
                    width: "var(--spacing-8)",
                    height: "var(--spacing-8)",
                    borderRadius: "var(--radius-circle)",
                    background: "var(--color-interactive-primary)",
                  }}
                />
                {presence.onlineCount}명 공부 중
              </span>
            </div>
          </div>
          {/* 내 기숙사 배지 + 문 위 순위판 보기 */}
          <div
            style={{
              ...auto,
              display: "flex",
              alignItems: "center",
              gap: "var(--spacing-8)",
              alignSelf: "flex-start",
            }}
          >
            <span
              style={{
                ...pillStyle,
                padding:
                  "var(--spacing-4) var(--spacing-12) var(--spacing-4) var(--spacing-4)",
                background: houseVar(house, "subtle"),
                color: houseVar(house, "accent"),
                font: "var(--text-caption-lg-bold)",
              }}
            >
              <HouseCrest house={house} size={24} aria-hidden />
              {HOUSES[house].name} 수련생
            </span>
            <ButtonSmall style="monolight" onClick={turnToBoard}>
              순위판 보기
            </ButtonSmall>
          </div>
        </div>

        {seat ? (
          <section
            aria-label={`${labelOf(seat.seatId)} 자리 집중 타이머`}
            style={sheetStyle}
          >
            {/* 진행 막대 */}
            <div
              aria-hidden
              style={{
                height: "var(--spacing-4)",
                borderRadius: "var(--radius-circle)",
                background: "var(--color-background-muted)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${progress * 100}%`,
                  background: "var(--color-interactive-primary)",
                  transition: "width 1s linear",
                }}
              />
            </div>
            <div style={rowStyle}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    font: "var(--text-caption-lg-medium)",
                    color: "var(--color-text-tertiary)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {labelOf(seat.seatId)} · {subject} · 오늘 누적
                </span>
                {expanded ? null : (
                  <span
                    role="timer"
                    aria-label={`오늘 누적 집중 ${formatClock(timer.elapsedSeconds)}`}
                    style={{
                      font: "var(--text-display-sm-bold)",
                      color: "var(--color-text-primary)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formatClock(timer.elapsedSeconds)}
                  </span>
                )}
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "var(--spacing-8)",
                  flexShrink: 0,
                }}
              >
                <ButtonSmall
                  style="monolight"
                  onClick={() => setExpanded((v) => !v)}
                >
                  {expanded ? "접기" : "펼치기"}
                </ButtonSmall>
                <ButtonSmall style="monolight" onClick={onStandUp}>
                  일어나기
                </ButtonSmall>
              </div>
            </div>
            {/* 공부 방식: 실습으로 집중하면 책상 위로 기숙사 마법이 피어오름 */}
            <div style={rowStyle}>
              <span
                id="study-mode-label"
                style={{
                  font: "var(--text-caption-lg-medium)",
                  color: "var(--color-text-tertiary)",
                }}
              >
                {mode === "practice"
                  ? `${HOUSES[house].guardian}의 마법을 실습 중`
                  : "책으로 이론 공부 중"}
              </span>
              <div
                role="group"
                aria-labelledby="study-mode-label"
                style={{ display: "flex", gap: "var(--spacing-4)" }}
              >
                {(["theory", "practice"] as const).map((m) => (
                  <ButtonSmall
                    key={m}
                    style={mode === m ? "corelight" : "monolight"}
                    aria-label={`${MODE_LABEL[m]}${mode === m ? ", 선택됨" : ""}`}
                    onClick={() => onModeChange(m)}
                  >
                    {MODE_LABEL[m]}
                  </ButtonSmall>
                ))}
              </div>
            </div>
            {expanded ? (
              <FocusTimer
                elapsedSeconds={timer.elapsedSeconds}
                status={timer.status}
                label={subject}
                onStart={onStart}
                onPause={onPause}
              />
            ) : (
              <div style={{ display: "grid" }}>
                <ButtonLarge
                  style={timer.status === "running" ? "monolight" : "core"}
                  onClick={timer.status === "running" ? onPause : onStart}
                >
                  {PRIMARY_LABEL[timer.status]}
                </ButtonLarge>
              </div>
            )}
          </section>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--spacing-16)",
            }}
          >
            {nearSeat ? (
              <div style={{ ...auto, display: "grid" }}>
                <ButtonLarge onClick={() => onSit(nearSeat)}>
                  {labelOf(nearSeat)} 자리에 앉기
                </ButtonLarge>
              </div>
            ) : (
              <p
                style={{
                  ...pillStyle,
                  flexDirection: "column",
                  alignSelf: "center",
                  gap: "var(--spacing-2)",
                  margin: 0,
                  textAlign: "center",
                  borderRadius: "var(--radius-lg)",
                }}
              >
                <span>바닥을 탭하면 이동, 빈 책상을 탭하면 앉아요</span>
                <span style={{ color: "var(--color-text-tertiary)" }}>
                  화면을 끌면 시점 회전
                </span>
              </p>
            )}
            {/* 키보드 사용자 안내 (화면에는 숨김, 스크린리더로 읽힘) */}
            <p style={visuallyHidden}>
              키보드: 방향키 또는 WASD로 이동, 빈 책상 근처에서 E 키로 앉기
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
