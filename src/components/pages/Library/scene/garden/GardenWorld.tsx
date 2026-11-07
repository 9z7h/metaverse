import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { CSSProperties, PointerEvent, WheelEvent } from "react";
import { Canvas } from "@react-three/fiber";
import { ButtonLarge, ButtonMedium } from "../../../../ui/Button";
import { isTypingTarget } from "../../chat";
import { houseToken } from "../../houses";
import type { HouseId } from "../../houses";
import { FloorPicker, FrameDriver, TapMarker } from "../Characters";
import type { FloorPick } from "../Characters";
import { LabelPortalContext } from "../Avatar";
import {
  CAMERA_FOV,
  ORBIT_DEFAULT,
  clampOrbit,
  readSceneColors,
} from "../sceneLayout";
import type { Orbit, SceneColors, Vec2 } from "../sceneLayout";
import { BroomRider } from "./Broom";
import { GardenScenery } from "./GardenScenery";
import { GARDEN_HALF, resolveWalk } from "./gardenLayout";

export interface GardenWorldProps {
  house: HouseId;
  /** 서고로 돌아가기 (HUD 화살표·문 앞 버튼·E 키) */
  onBack: () => void;
}

/** 움직이거나 빗자루를 탄 동안은 부드럽게, 가만히 있으면 아낀다 */
const FPS_ACTIVE = 60;
const FPS_IDLE = 24;

const YAW_PER_PX = 0.008;
const PITCH_PER_PX = 0.005;
const TAP_SLOP_PX = 10;
const TAP_MAX_MS = 350;

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

function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

const hudStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  padding: "var(--spacing-16)",
  paddingTop: "max(var(--spacing-16), env(safe-area-inset-top))",
  paddingBottom: "max(var(--spacing-16), env(safe-area-inset-bottom))",
  pointerEvents: "none",
  boxSizing: "border-box",
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

const auto: CSSProperties = { pointerEvents: "auto" };

/**
 * 숨돌림 뜰 — 서고 밖 달밤의 후원. 걷다가 도깨비 몽당 싸리비를 타고 천천히 날며 머리를 식힌다.
 * 혼자만의 공간이라 다른 수련생·대화·타이머는 없다(타이머는 상위가 멈춰 둔다).
 */
export function GardenWorld({ house, onBack }: GardenWorldProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [colors, setColors] = useState<SceneColors | null>(null);
  useLayoutEffect(() => {
    if (rootRef.current) setColors(readSceneColors(rootRef.current));
  }, []);

  const [reduced] = useState(prefersReducedMotion);
  const [riding, setRiding] = useState(false);
  const ridingRef = useRef(false);
  const [nearDoor, setNearDoor] = useState(false);
  const [moving, setMoving] = useState(false);
  const nearDoorRef = useRef(false);

  /* 입력 */
  const input = useRef({ x: 0, y: 0 });
  const keys = useRef(new Set<string>());
  const target = useRef<Vec2 | null>(null);
  const pickFloor = useRef<FloorPick | null>(null);
  const [marker, setMarker] = useState<{ at: Vec2; key: number } | null>(null);

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

  const toggleRide = useCallback(() => {
    ridingRef.current = !ridingRef.current;
    setRiding(ridingRef.current);
    target.current = null;
  }, []);

  const handleNearDoor = useCallback((near: boolean) => {
    nearDoorRef.current = near;
    setNearDoor(near);
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (e.code in KEY_DIR) {
        keys.current.add(e.code);
        sync();
        e.preventDefault();
      } else if (e.code === "KeyE" && nearDoorRef.current) {
        onBack();
      } else if (e.code === "Space" && !e.repeat) {
        // 스페이스 = 타기/내리기 (버튼에 포커스가 있을 땐 버튼 본래 동작)
        if (!(e.target instanceof HTMLButtonElement)) {
          toggleRide();
          e.preventDefault();
        }
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
  }, [sync, onBack, toggleRide]);

  /* 시점: 드래그 = 회전, 핀치·휠 = 줌, 짧은 탭 = 그곳으로 이동/비행 */
  const orbit = useRef<Orbit>({ ...ORBIT_DEFAULT });
  const draggingRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchDist = useRef<number | null>(null);
  const press = useRef<{
    x: number;
    y: number;
    at: number;
    moved: boolean;
  } | null>(null);
  const wheelTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(wheelTimer.current), []);

  const handleTap = (clientX: number, clientY: number) => {
    const at = pickFloor.current?.(clientX, clientY, 0);
    if (!at) return;
    const to = ridingRef.current
      ? {
          x: Math.max(-GARDEN_HALF, Math.min(GARDEN_HALF, at.x)),
          z: Math.max(-GARDEN_HALF, Math.min(GARDEN_HALF, at.z)),
        }
      : resolveWalk(at);
    target.current = to;
    setMarker({ at: to, key: performance.now() });
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    pinchDist.current = null;
    press.current =
      pointers.current.size === 1
        ? { x: e.clientX, y: e.clientY, at: performance.now(), moved: false }
        : press.current && { ...press.current, moved: true };
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
    orbit.current = clampOrbit({
      ...orbit.current,
      zoom: orbit.current.zoom * Math.exp(e.deltaY * 0.001),
    });
    draggingRef.current = true;
    setDragging(true);
    window.clearTimeout(wheelTimer.current);
    wheelTimer.current = window.setTimeout(() => {
      draggingRef.current = false;
      setDragging(false);
    }, 400);
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
      <div
        data-testid="garden-drag-area"
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
            camera={{
              fov: CAMERA_FOV,
              position: [0, 6, -14],
              near: 0.1,
              far: 260,
            }}
            onCreated={({ gl }) => {
              if (import.meta.env.DEV) {
                (window as unknown as { __libraryGl?: unknown }).__libraryGl =
                  gl;
              }
            }}
            aria-label="숨돌림 뜰"
          >
            {/* 아바타 이름표는 쓰지 않지만 Avatar가 컨텍스트를 기대하므로 빈 ref를 준다 */}
            <LabelPortalContext.Provider value={noLabel}>
              <color
                attach="background"
                args={[colors["--color-background-default"]]}
              />
              <fog attach="fog" args={[colors["--color-scene-fog"], 30, 120]} />
              {/* 달빛: 서늘하고 약한 전체광 + 위에서 비추는 한 줄기 */}
              <ambientLight
                intensity={0.5}
                color={colors["--color-scene-light"]}
              />
              <hemisphereLight
                args={[
                  colors["--color-scene-light"],
                  colors["--color-scene-floor"],
                  0.45,
                ]}
              />
              <directionalLight
                position={[-18, 40, 12]}
                intensity={0.7}
                color={colors["--color-scene-light"]}
              />
              <GardenScenery colors={colors} />
              <BroomRider
                colors={colors}
                house={house}
                riding={riding}
                input={input}
                target={target}
                orbit={orbit}
                dragging={draggingRef}
                onNearDoorChange={handleNearDoor}
                onMovingChange={setMoving}
                reducedMotion={reduced}
              />
              <FloorPicker pickRef={pickFloor} />
              {marker ? (
                <TapMarker
                  key={marker.key}
                  at={marker.at}
                  color={colors[houseToken(house, "accent")]}
                />
              ) : null}
              <FrameDriver
                fps={riding || moving || dragging ? FPS_ACTIVE : FPS_IDLE}
              />
            </LabelPortalContext.Provider>
          </Canvas>
        ) : null}
      </div>

      <div style={hudStyle}>
        <div
          style={{
            ...auto,
            alignSelf: "flex-start",
            display: "flex",
            alignItems: "center",
            gap: "var(--spacing-8)",
          }}
        >
          <ButtonMedium
            type="icon"
            icon="arrow_left"
            style="monolight"
            aria-label="서고로 돌아가기"
            onClick={onBack}
          />
          <span style={pillStyle}>숨돌림 뜰 · 잠시 쉬어 가는 중</span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--spacing-8)",
          }}
        >
          <p
            style={{
              margin: 0,
              textAlign: "center",
              font: "var(--text-caption-lg-medium)",
              color: "var(--color-text-secondary)",
            }}
          >
            {riding
              ? "가고 싶은 곳을 누르세요 · 끌어서 둘러보기 · WASD"
              : "뜰을 걸어 보세요 · 끌어서 둘러보기 · 빗자루를 타 볼까요?"}
          </p>
          <div style={{ ...auto, display: "grid", gap: "var(--spacing-8)" }}>
            {nearDoor ? (
              <ButtonLarge onClick={onBack}>서고로 돌아가기</ButtonLarge>
            ) : null}
            <ButtonLarge style="monolight" onClick={toggleRide}>
              {riding ? "빗자루에서 내리기" : "빗자루 타기"}
            </ButtonLarge>
          </div>
        </div>
      </div>
    </div>
  );
}

const noLabel = { current: null };
