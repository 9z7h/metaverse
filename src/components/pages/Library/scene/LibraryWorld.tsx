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
import { Joystick } from "../../../ui/Joystick";
import type { JoystickVector } from "../../../ui/Joystick";
import type { LibraryPresence } from "../libraryPresence";
import type { FocusTimerState } from "../useFocusTimer";
import { Bot, FrameDriver, Player } from "./Characters";
import { LibraryRoom } from "./LibraryRoom";
import { Atmosphere } from "./Atmosphere";
import { HouseCrest } from "../HouseCrest";
import { HOUSES, houseVar } from "../houses";
import type { HouseId } from "../houses";
import { LabelPortalContext } from "./Avatar";
import {
  ORBIT_DEFAULT,
  clampOrbit,
  deskLayout,
  readSceneColors,
} from "./sceneLayout";
import type { Orbit, SceneColors } from "./sceneLayout";

export interface LibraryWorldProps {
  presence: LibraryPresence;
  timer: FocusTimerState;
  subject: string;
  /** 내 기숙사 */
  house: HouseId;
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

/** 드래그 감도 (px → rad) */
const YAW_PER_PX = 0.008;
const PITCH_PER_PX = 0.005;

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

  /* 입력: 조이스틱 + 키보드를 하나의 ref로 합친다 (리렌더 없이 매 프레임 읽힘) */
  const input = useRef({ x: 0, y: 0 });
  const stick = useRef<JoystickVector>({ x: 0, y: 0 });
  const keys = useRef(new Set<string>());
  const sync = useCallback(() => {
    let kx = 0;
    let ky = 0;
    keys.current.forEach((k) => {
      kx += KEY_DIR[k][0];
      ky += KEY_DIR[k][1];
    });
    const x = stick.current.x + kx;
    const y = stick.current.y + ky;
    const len = Math.hypot(x, y);
    input.current = len > 1 ? { x: x / len, y: y / len } : { x, y };
  }, []);

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
  const occupied = useMemo(
    () => new Set(presence.others.map((s) => s.seatId)),
    [presence.others],
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

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    pinchDist.current = null;
    draggingRef.current = true;
    setDragging(true);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
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
    }
  };
  const onWheel = (e: WheelEvent<HTMLDivElement>) => {
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
      {/* 캔버스 영역 드래그 = 시점 회전. HUD는 형제 요소라 버튼·조이스틱 조작과 겹치지 않음 */}
      <div
        data-testid="camera-drag-area"
        style={{
          position: "absolute",
          inset: 0,
          cursor: dragging ? "grabbing" : "grab",
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
            camera={{ fov: 50, position: [0, 5.2, 13], near: 0.1, far: 60 }}
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
              <fog attach="fog" args={[colors["--color-scene-fog"], 10, 24]} />
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
              {[-4, -0.5, 3].map((z) => (
                <pointLight
                  key={z}
                  position={[0, 2.8, z]}
                  intensity={9}
                  distance={9}
                  decay={1.6}
                  color={colors["--color-scene-flame"]}
                />
              ))}

              <LibraryRoom colors={colors} desks={desks} />
              <Atmosphere colors={colors} />
              {presence.others.map((s) => (
                <Bot
                  key={s.id}
                  student={s}
                  colors={colors}
                  entering={!initialIds.current.has(s.id)}
                />
              ))}
              <Player
                colors={colors}
                desks={desks}
                input={input}
                occupied={occupied}
                seat={seat}
                focusing={focusing}
                subject={subject}
                house={house}
                onNearSeatChange={setNearSeat}
                orbit={orbit}
                dragging={draggingRef}
              />
              <FrameDriver fps={seat && !dragging ? FPS_SEATED : FPS_WALKING} />
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
          {/* 내 기숙사 배지 */}
          <span
            style={{
              ...pillStyle,
              alignSelf: "flex-start",
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
                  alignSelf: "center",
                  margin: 0,
                }}
              >
                빈 책상으로 걸어가 보세요 · 화면을 끌면 시점 회전
              </p>
            )}
            <div style={{ ...auto, alignSelf: "flex-start" }}>
              <Joystick
                aria-label="이동 조이스틱 (키보드: WASD 또는 방향키)"
                onMove={(v) => {
                  stick.current = v;
                  sync();
                }}
                onEnd={() => {
                  stick.current = { x: 0, y: 0 };
                  sync();
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
