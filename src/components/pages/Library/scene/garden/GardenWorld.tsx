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
import { ButtonLarge, ButtonMedium, ButtonSmall } from "../../../../ui/Button";
import { ChatPanel } from "../../ChatPanel";
import {
  ME_BUBBLE_KEY,
  activeBubbles,
  hasUnreadChat,
  isTypingTarget,
} from "../../chat";
import { houseToken } from "../../houses";
import type { HouseId } from "../../houses";
import type { LibraryPresence } from "../../libraryPresence";
import { FloorPicker, FrameDriver, TapMarker } from "../Characters";
import { SpellEffects } from "../SpellEffects";
import { SpellBar } from "../SpellBar";
import { useSpellCaster } from "../useSpellCaster";
import { SPELL_ORDER } from "../spellLogic";
import type { SpellId } from "../spellLogic";
import type { FloorPick } from "../Characters";
import { LabelPortalContext } from "../Avatar";
import {
  CAMERA_FOV,
  ORBIT_DEFAULT,
  clampOrbit,
  readSceneColors,
} from "../sceneLayout";
import type { Orbit, SceneColors, Vec2 } from "../sceneLayout";
import { BroomRider, RemoteRider } from "./Broom";
import { GardenScenery } from "./GardenScenery";
import { SpaceSelect } from "../SpaceSelect";
import {
  GARDEN_HALF,
  GARDEN_SPAWN,
  preparingText,
  resolveWalk,
} from "./gardenLayout";

/** 정원이 쓰는 접속 정보 — 같은 정원에 있는 다른 사람과 내 위치 알림 */
export type GardenPresence = Pick<
  LibraryPresence,
  | "walkers"
  | "moves"
  | "sendMove"
  | "sendCast"
  | "onRemoteCast"
  | "chat"
  | "connectedCount"
  | "restingCount"
>;

export interface GardenWorldProps {
  house: HouseId;
  presence: GardenPresence;
  /** 서고로 돌아가기 (HUD 화살표·문 앞 버튼·E 키) */
  onBack: () => void;
}

/** 움직이거나 구름을 탄 동안은 부드럽게, 가만히 있으면 아낀다 */
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
 * 숨돌림 뜰 — 서고 밖 달밤의 후원. 걷다가 전통 구름을 타고 천천히 날며 머리를 식힌다.
 * 같은 정원에 있는 다른 수련생이 걷거나 구름을 타는 모습이 보인다. 대화·타이머는 없다(타이머는 상위가 멈춰 둔다).
 */
export function GardenWorld({ house, presence, onBack }: GardenWorldProps) {
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
  const [nearBuilding, setNearBuilding] = useState<string | null>(null);
  const labelRef = useRef<HTMLDivElement>(null);

  /* 서고와 이어진 속삭임: 대화창·말풍선·안 읽은 글 표시 */
  const [chatOpen, setChatOpen] = useState(false);
  const [chatEnabled, setChatEnabled] = useState(true);
  const chatMessages = presence.chat.messages;
  const [bubbleNow, setBubbleNow] = useState(() => Date.now());
  useEffect(() => {
    setBubbleNow(Date.now());
  }, [chatMessages]);
  // 대화창이 열려 있는 동안은 같은 내용이 목록에 보이므로 말풍선은 숨긴다
  const bubbles = useMemo(
    () =>
      chatEnabled && !chatOpen
        ? activeBubbles(chatMessages, bubbleNow)
        : new Map(),
    [chatEnabled, chatOpen, chatMessages, bubbleNow],
  );
  const hasBubble = bubbles.size > 0;
  useEffect(() => {
    if (!hasBubble) return;
    const id = window.setInterval(() => setBubbleNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [hasBubble]);
  const lastMessage = chatMessages[chatMessages.length - 1];
  const [seenId, setSeenId] = useState<string | null>(null);
  useEffect(() => {
    if (chatOpen && lastMessage) setSeenId(lastMessage.id);
  }, [chatOpen, lastMessage]);
  const unread = hasUnreadChat(chatMessages, seenId, {
    open: chatOpen,
    enabled: chatEnabled,
  });

  /* 입력 */
  const input = useRef({ x: 0, y: 0 });
  const keys = useRef(new Set<string>());
  const boost = useRef(false);
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

  /* 주문: 걸어 다닐 때만. 효과는 내 앞 작은 구역에 남고 시전자별로 따로 관리된다 */
  const selfPos = useRef<Vec2>({ ...GARDEN_SPAWN });
  const selfFacing = useRef(0);
  const selfHeight = useRef(0);
  const spells = useSpellCaster({
    selfId: "me",
    getPose: () => ({
      x: selfPos.current.x,
      z: selfPos.current.z,
      y: selfHeight.current,
      ry: selfFacing.current,
    }),
    enabled: true,
  });
  const castLocal = spells.cast;
  const addRemoteCast = spells.addRemote;
  const { sendCast, onRemoteCast } = presence;
  /** 시전하면 같은 곳의 다른 사람에게도 효과만 알린다 */
  const castSpell = useCallback(
    (id: SpellId) => {
      const made = castLocal(id);
      if (made) sendCast(made.spell, made.x, made.z, made.ry, made.y);
    },
    [castLocal, sendCast],
  );
  // 다른 사람이 시전하면 그 자리에 효과를 그리고 그 사람이 지팡이를 휘두르게 한다
  const [remoteCastAt, setRemoteCastAt] = useState<Record<string, number>>({});
  useEffect(
    () =>
      onRemoteCast((c) => {
        const now = performance.now();
        addRemoteCast({
          id: `${c.senderId}-${now}`,
          caster: c.senderId,
          spell: c.spell,
          x: c.x,
          z: c.z,
          y: c.y,
          ry: c.ry,
          t0: now,
        });
        setRemoteCastAt((m) => ({ ...m, [c.senderId]: now }));
      }),
    [onRemoteCast, addRemoteCast],
  );

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
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
        boost.current = true;
      } else if (e.code in KEY_DIR) {
        keys.current.add(e.code);
        sync();
        e.preventDefault();
      } else if (
        /^Digit[1-4]$/.test(e.code) &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        castSpell(SPELL_ORDER[Number(e.code.slice(5)) - 1]);
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
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
        boost.current = false;
      }
      if (keys.current.delete(e.code)) sync();
    };
    // 창이 포커스를 잃으면 keyup이 오지 않아 부스트가 켜진 채 남는다
    const blur = () => {
      boost.current = false;
    };
    window.addEventListener("blur", blur);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [sync, onBack, toggleRide, castSpell]);

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
            dpr={[1, 1.25]}
            gl={{ powerPreference: "high-performance" }}
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
            <LabelPortalContext.Provider value={labelRef}>
              <color
                attach="background"
                args={[colors["--color-background-default"]]}
              />
              <fog attach="fog" args={[colors["--color-scene-fog"], 30, 120]} />
              <GardenScenery colors={colors} />
              {presence.walkers.map((w) => (
                <RemoteRider
                  key={w.id}
                  walker={w}
                  colors={colors}
                  moves={presence.moves}
                  reducedMotion={reduced}
                  bubble={bubbles.get(w.id)?.text}
                  castAt={remoteCastAt[w.id] ?? null}
                  wandLightAt={
                    spells.casts.find(
                      (c) => c.caster === w.id && c.spell === "myeonggyeong",
                    )?.t0 ?? null
                  }
                />
              ))}
              <BroomRider
                colors={colors}
                house={house}
                riding={riding}
                input={input}
                boost={boost}
                target={target}
                orbit={orbit}
                dragging={draggingRef}
                onNearDoorChange={handleNearDoor}
                onNearBuildingChange={setNearBuilding}
                onMovingChange={setMoving}
                reducedMotion={reduced}
                bubble={bubbles.get(ME_BUBBLE_KEY)?.text}
                positionRef={selfPos}
                facingRef={selfFacing}
                heightRef={selfHeight}
                castAt={spells.castAt}
                wandLightAt={
                  spells.casts.find(
                    (c) => c.caster === "me" && c.spell === "myeonggyeong",
                  )?.t0 ?? null
                }
                onMove={presence.sendMove}
              />
              <SpellEffects colors={colors} casts={spells.casts} />
              <FloorPicker pickRef={pickFloor} />
              {marker ? (
                <TapMarker
                  key={marker.key}
                  at={marker.at}
                  color={colors[houseToken(house, "accent")]}
                />
              ) : null}
              <FrameDriver
                fps={
                  riding || moving || dragging || spells.active
                    ? FPS_ACTIVE
                    : FPS_IDLE
                }
              />
            </LabelPortalContext.Provider>
          </Canvas>
        ) : null}
      </div>

      {/* 아바타 이름표·말풍선이 붙는 레이어 — 캔버스와 같은 크기, 터치는 통과 */}
      <div
        ref={labelRef}
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <div style={hudStyle}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--spacing-8)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "var(--spacing-8)",
            }}
          >
            <div
              style={{
                ...auto,
                display: "flex",
                alignItems: "center",
                gap: "var(--spacing-8)",
                minWidth: 0,
                flex: "1 1 auto",
                flexWrap: "wrap",
              }}
            >
              <ButtonMedium
                type="icon"
                icon="arrow_left"
                style="monolight"
                aria-label="서고로 돌아가기"
                onClick={onBack}
              />
              <SpaceSelect current="garden" onChange={() => onBack()} />
              <span
                style={{ ...pillStyle, whiteSpace: "nowrap" }}
                aria-live="polite"
              >
                <span
                  aria-hidden
                  style={{
                    width: "var(--spacing-8)",
                    height: "var(--spacing-8)",
                    borderRadius: "var(--radius-circle)",
                    background: "var(--color-interactive-primary)",
                  }}
                />
                {presence.connectedCount}명 접속 · {presence.restingCount}명
                휴식 중
              </span>
            </div>
            <div style={auto}>
              <ButtonSmall
                style="monolight"
                aria-expanded={chatOpen}
                aria-label={unread ? "대화 (새 글 있음)" : "대화"}
                onClick={() => setChatOpen((v) => !v)}
              >
                대화
                {unread ? (
                  <span
                    aria-hidden
                    data-testid="chat-unread"
                    style={{
                      display: "inline-block",
                      marginLeft: "var(--spacing-4)",
                      width: "var(--spacing-8)",
                      height: "var(--spacing-8)",
                      borderRadius: "var(--radius-circle)",
                      background: "var(--color-interactive-primary)",
                    }}
                  />
                ) : null}
              </ButtonSmall>
            </div>
          </div>
          {chatOpen ? (
            <div style={{ ...auto, alignSelf: "stretch" }}>
              <ChatPanel
                messages={chatEnabled ? chatMessages : []}
                onSend={(text) => presence.chat.send(text, house)}
                enabled={chatEnabled}
                onToggleEnabled={() => setChatEnabled((v) => !v)}
                onClose={() => setChatOpen(false)}
                onFocusChange={(focused) => {
                  // 입력을 시작할 때 눌려 있던 이동 키가 남아 계속 걷지 않게 정리
                  if (focused) {
                    keys.current.clear();
                    sync();
                  }
                }}
              />
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--spacing-8)",
          }}
        >
          {nearBuilding ? (
            <p role="status" style={{ ...pillStyle, margin: "0 auto" }}>
              {preparingText(nearBuilding)}
            </p>
          ) : null}
          <p
            style={{
              margin: 0,
              textAlign: "center",
              font: "var(--text-caption-lg-medium)",
              color: "var(--color-text-secondary)",
            }}
          >
            {riding
              ? "가고 싶은 곳을 누르세요 · 끌어서 둘러보기 · WASD · Shift 가속"
              : "뜰을 걸어 보세요 · 끌어서 둘러보기 · 구름을 타 볼까요?"}
          </p>
          <SpellBar
            onCast={castSpell}
            lightOn={spells.lightOn}
            cooldowns={spells.cooldowns}
          />
          <div style={{ ...auto, display: "grid", gap: "var(--spacing-8)" }}>
            {nearDoor ? (
              <ButtonLarge onClick={onBack}>서고로 돌아가기</ButtonLarge>
            ) : null}
            <ButtonLarge style="monolight" onClick={toggleRide}>
              {riding ? "구름에서 내리기" : "구름 타기"}
            </ButtonLarge>
          </div>
        </div>
      </div>
    </div>
  );
}
