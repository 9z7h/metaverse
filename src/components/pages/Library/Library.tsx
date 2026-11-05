import { Suspense, lazy, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { ButtonLarge, ButtonSmall } from "../../ui/Button";
import { Input } from "../../ui/Input";
import {
  useLibraryPresence,
  type UseLibraryPresenceOptions,
} from "./libraryPresence";
import { useFocusTimer } from "./useFocusTimer";
import { HouseCrest } from "./HouseCrest";
import { SortingReveal } from "./SortingReveal";
import { HOUSES, houseVar, loadHouse, randomHouse, saveHouse } from "./houses";
import type { HouseId } from "./houses";

// three.js 번들(수백 KB)은 장서각에 들어갈 때만 내려받는다
const LibraryWorld = lazy(() =>
  import("./scene/LibraryWorld").then((m) => ({ default: m.LibraryWorld })),
);

/** entrance → (첫 입장이면 sorting) → world(3D 장서각) */
type Step = "entrance" | "sorting" | "world";

export interface LibraryProps {
  /** 접속자 시뮬레이션 옵션 (테스트에서 `{ simulate: false }`) */
  presenceOptions?: UseLibraryPresenceOptions;
  /** 기숙사 배정 연출 길이(ms). 스토리/테스트에서 0으로 즉시 표시 */
  sortingDurationMs?: number;
}

const DEFAULT_SUBJECT = "자율 학습";

/** 이 기기에서 3D(WebGL)를 쓸 수 있는지 */
export function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/* ── 레이아웃 ─────────────────────────────────────────── */

const pageStyle: CSSProperties = {
  minHeight: "100dvh",
  background: "var(--color-background-default)",
  color: "var(--color-text-primary)",
  fontFamily: "var(--font-family-base)",
};

const columnStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--spacing-24)",
  width: "100%",
  maxWidth: "calc(var(--spacing-48) * 10)",
  minHeight: "100dvh",
  margin: "0 auto",
  padding: "var(--spacing-24) var(--spacing-20) var(--spacing-40)",
  boxSizing: "border-box",
};

const captionStyle: CSSProperties = {
  font: "var(--text-caption-lg-medium)",
  color: "var(--color-text-tertiary)",
  margin: 0,
};

function LiveCount({ online, free }: { online: number; free: number }) {
  return (
    <p
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--spacing-8)",
        margin: 0,
        font: "var(--text-body-sm-regular)",
        color: "var(--color-text-secondary)",
      }}
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
      <span>
        지금 <strong>{online}명</strong>이 공부 중 · 빈 자리 {free}석
      </span>
    </p>
  );
}

/** 3D를 쓸 수 없는 기기 안내 (간편 모드 제거 후의 대체 화면) */
function Unsupported({ onBack }: { onBack: () => void }) {
  return (
    <main style={{ ...columnStyle, justifyContent: "center" }}>
      <h1
        style={{
          margin: 0,
          font: "var(--text-display-sm-bold)",
          color: "var(--color-text-primary)",
        }}
      >
        이 기기에서는 3D 장서각을 열 수 없어요
      </h1>
      <p
        style={{
          margin: 0,
          font: "var(--text-body-lg-regular)",
          color: "var(--color-text-secondary)",
        }}
      >
        브라우저가 3D 그래픽(WebGL)을 지원하지 않거나 꺼져 있어요. 최신
        Chrome이나 Safari에서 다시 열어 주세요.
      </p>
      <div style={{ display: "grid" }}>
        <ButtonLarge style="outline" onClick={onBack}>
          입장 화면으로
        </ButtonLarge>
      </div>
    </main>
  );
}

/* ── 페이지 ───────────────────────────────────────────── */

/**
 * 사신학당 장서각 — 함께 공부하는 모바일 페이지.
 * 입장(과목 입력) → 첫 입장 시 사신등 의식(기숙사 배정) → 3D 장서각.
 * `data-theme="library"`로 시맨틱 토큰을 재정의해 기존 UI 컴포넌트를 그대로 테마링한다.
 */
export function Library({ presenceOptions, sortingDurationMs }: LibraryProps) {
  const presence = useLibraryPresence(presenceOptions);
  const [step, setStep] = useState<Step>("entrance");
  // 기숙사는 처음 한 번 배정 후 유지 (localStorage)
  const [house, setHouse] = useState<HouseId | null>(() => loadHouse());
  const [subject, setSubject] = useState("");
  // 오늘 누적 집중 스톱워치 (멈췄다 다시 시작해도 이어서 쌓임)
  const timer = useFocusTimer();
  // 장서각에 들어갈 때 한 번만 확인
  const webgl = useMemo(
    () => (step === "world" ? supportsWebGL() : true),
    [step],
  );

  const assignHouse = () => {
    const h = randomHouse();
    saveHouse(h);
    setHouse(h);
    setStep("sorting");
  };
  /** 입장: 기숙사가 없으면 사신등 의식부터 */
  const enter = () => (house ? setStep("world") : assignHouse());

  const freeSeats =
    presence.seats.length - presence.others.length - (presence.me ? 1 : 0);
  const mySubject = subject.trim() || DEFAULT_SUBJECT;

  const handleSit = (seatId: string) => {
    presence.join({
      seatId,
      subject: mySubject,
      house: house ?? randomHouse(),
      focusing: false,
      focusSeconds: timer.elapsedSeconds,
    });
  };

  /** 자리를 떠나면 일시정지만 — 오늘 누적은 그대로 */
  const handleLeave = () => {
    if (timer.status === "running") timer.pause();
    presence.leave();
  };

  const handleStart = () => {
    timer.start();
    presence.update({ focusing: true });
  };
  const handlePause = () => {
    timer.pause();
    presence.update({ focusing: false });
  };

  if (step === "sorting" && house) {
    return (
      <div data-theme="library" style={pageStyle}>
        <SortingReveal
          house={house}
          durationMs={sortingDurationMs}
          onEnter={() => setStep("world")}
        />
      </div>
    );
  }

  if (step === "world" && house) {
    return (
      <div data-theme="library" style={pageStyle}>
        {webgl ? (
          <Suspense
            fallback={
              <p style={{ ...captionStyle, padding: "var(--spacing-24)" }}>
                장서각 문을 여는 중…
              </p>
            }
          >
            <LibraryWorld
              presence={presence}
              timer={timer}
              subject={mySubject}
              house={house}
              onSit={handleSit}
              onStandUp={handleLeave}
              onStart={handleStart}
              onPause={handlePause}
              onExit={() => {
                if (presence.me) handleLeave();
                setStep("entrance");
              }}
            />
          </Suspense>
        ) : (
          <Unsupported onBack={() => setStep("entrance")} />
        )}
      </div>
    );
  }

  return (
    <div data-theme="library" style={pageStyle}>
      <main style={columnStyle}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--spacing-12)",
            paddingTop: "var(--spacing-48)",
          }}
        >
          <p style={captionStyle}>사신학당 · 밤의 장서각</p>
          <h1
            style={{
              margin: 0,
              font: "var(--text-display-lg-bold)",
              color: "var(--color-text-primary)",
            }}
          >
            청사초롱 아래서
            <br />
            함께 공부해요
          </h1>
          <p
            style={{
              margin: 0,
              font: "var(--text-body-lg-regular)",
              color: "var(--color-text-secondary)",
            }}
          >
            산과 인간 세상의 경계에 선 사신학당의 서고예요. 같은 서고에 앉은
            수련생들과 함께 집중해 보세요.
          </p>
        </div>

        <LiveCount online={presence.onlineCount} free={freeSeats} />

        {house ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--spacing-12)",
              padding: "var(--spacing-12)",
              borderRadius: "var(--radius-lg)",
              background: houseVar(house, "subtle"),
            }}
          >
            <HouseCrest house={house} size={48} />
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                minWidth: 0,
              }}
            >
              <span
                style={{
                  font: "var(--text-body-sm-bold)",
                  color: houseVar(house, "accent"),
                }}
              >
                {HOUSES[house].name} 수련생
              </span>
              <span
                style={{
                  font: "var(--text-caption-lg-medium)",
                  color: "var(--color-text-secondary)",
                }}
              >
                {HOUSES[house].values}
              </span>
            </div>
            <ButtonSmall style="monolight" onClick={assignHouse}>
              다시 배정
            </ButtonSmall>
          </div>
        ) : (
          <p style={captionStyle}>
            첫 입장 날 밤, 사신등 의식으로 네 기숙사 중 하나에 배정돼요.
          </p>
        )}

        <form
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--spacing-16)",
            marginTop: "auto",
          }}
          onSubmit={(e) => {
            e.preventDefault();
            enter();
          }}
        >
          <Input
            label="오늘 공부할 과목"
            placeholder={`예: 알고리즘 (비우면 '${DEFAULT_SUBJECT}')`}
            value={subject}
            maxLength={20}
            onChange={(e) => setSubject(e.target.value)}
          />
          <ButtonLarge onClick={enter}>도서관 입장</ButtonLarge>
        </form>
      </main>
    </div>
  );
}
