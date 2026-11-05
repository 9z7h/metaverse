import { Suspense, lazy, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { ButtonLarge, ButtonSmall } from "../../ui/Button";
import { Input } from "../../ui/Input";
import {
  useLibraryPresence,
  type StudyMode,
  type UseLibraryPresenceOptions,
} from "./libraryPresence";
import { dayKey, useFocusTimer } from "./useFocusTimer";
import { HouseCrest } from "./HouseCrest";
import { SortingReveal } from "./SortingReveal";
import {
  HOUSES,
  HOUSE_IDS,
  canReroll,
  houseVar,
  loadHouse,
  loadRerollDay,
  saveHouse,
  saveRerollDay,
} from "./houses";
import { HouseRanking } from "./HouseRanking";
import {
  addMine,
  balancedHouse,
  houseHeadcounts,
  rankHouses,
} from "./houseRanking";
import { DAY_ROSTER_HOUSES } from "./libraryPresence";
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

interface HouseCardProps {
  house: HouseId | null;
  rerollAvailable: boolean;
  confirming: boolean;
  onAskReroll: () => void;
  onConfirmReroll: () => void;
  onCancelReroll: () => void;
}

/**
 * 입장 화면 맨 위 카드 — 내 기숙사를 가장 먼저 보여준다.
 * 아직 배정 전(첫 입장)이면 네 기숙사 문장과 함께 사신등 의식 안내를 보여준다.
 * 다시 배정은 하루 1번이라 실수로 누르지 않게 한 번 더 확인한다.
 */
function HouseCard({
  house,
  rerollAvailable,
  confirming,
  onAskReroll,
  onConfirmReroll,
  onCancelReroll,
}: HouseCardProps) {
  if (!house) {
    return (
      <section
        aria-label="기숙사 배정 안내"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--spacing-12)",
          padding: "var(--spacing-16)",
          borderRadius: "var(--radius-lg)",
          background: "var(--color-background-Subtle)",
        }}
      >
        <div style={{ display: "flex", gap: "var(--spacing-8)" }}>
          {HOUSE_IDS.map((id) => (
            <HouseCrest key={id} house={id} size={32} aria-hidden />
          ))}
        </div>
        <p
          style={{
            margin: 0,
            font: "var(--text-body-sm-bold)",
            color: "var(--color-text-primary)",
          }}
        >
          첫 입장 날 밤, 사신등 의식으로 기숙사가 정해져요
        </p>
        <p style={captionStyle}>
          백호관·주작관·현무관·청룡관 중 한 곳에 배정돼요.
        </p>
      </section>
    );
  }

  const h = HOUSES[house];
  return (
    <section
      aria-label="내 기숙사"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--spacing-12)",
        padding: "var(--spacing-16)",
        borderRadius: "var(--radius-lg)",
        background: houseVar(house, "subtle"),
        border: `1px solid ${houseVar(house, "accent")}`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--spacing-16)",
        }}
      >
        <HouseCrest house={house} size={64} />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--spacing-2)",
            minWidth: 0,
          }}
        >
          <span style={captionStyle}>내 기숙사</span>
          <strong
            style={{
              font: "var(--text-display-sm-bold)",
              color: houseVar(house, "accent"),
            }}
          >
            {h.name} 수련생
          </strong>
          <span
            style={{
              font: "var(--text-caption-lg-medium)",
              color: "var(--color-text-secondary)",
            }}
          >
            {h.values}
          </span>
        </div>
      </div>
      <p
        style={{
          margin: 0,
          font: "var(--text-body-sm-regular)",
          color: "var(--color-text-primary)",
        }}
      >
        “{h.motto}”
      </p>

      {confirming ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--spacing-8)",
          }}
        >
          <p
            role="alert"
            style={{
              margin: 0,
              font: "var(--text-caption-lg-medium)",
              color: "var(--color-text-primary)",
            }}
          >
            다시 배정은 하루에 한 번만 할 수 있어요. 오늘 쌓은 집중 시간도 새
            기숙사에 더해져요. 지금 다시 배정할까요?
          </p>
          <div style={{ display: "flex", gap: "var(--spacing-8)" }}>
            <ButtonSmall style="core" onClick={onConfirmReroll}>
              다시 배정하기
            </ButtonSmall>
            <ButtonSmall style="monolight" onClick={onCancelReroll}>
              취소
            </ButtonSmall>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--spacing-12)",
          }}
        >
          {/* 옆의 안내 문구가 길어도 버튼 글자가 줄바꿈되지 않게 */}
          <div style={{ flexShrink: 0, whiteSpace: "nowrap" }}>
            <ButtonSmall
              style="monolight"
              disabled={!rerollAvailable}
              onClick={onAskReroll}
            >
              다시 배정
            </ButtonSmall>
          </div>
          <span style={captionStyle}>
            {rerollAvailable
              ? "하루 1번 가능해요"
              : "오늘은 이미 다시 배정했어요 · 내일 다시 배정할 수 있어요"}
          </span>
        </div>
      )}
    </section>
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
  // 이론 / 실습 — 실습으로 집중하면 내 책상 위로 기숙사 마법이 피어오름
  const [mode, setMode] = useState<StudyMode>("theory");
  // 오늘 누적 집중 스톱워치 (멈췄다 다시 시작해도 이어서 쌓임)
  const timer = useFocusTimer();
  // 장서각에 들어갈 때 한 번만 확인
  const webgl = useMemo(
    () => (step === "world" ? supportsWebGL() : true),
    [step],
  );

  /**
   * 오늘 인원이 가장 적은 기숙사 중에서 무작위 배정 — 기숙사 합계 순위가
   * 인원 수 차이로 왜곡되지 않게 하루 동안 인원을 고르게 유지한다.
   */
  const pickHouse = (exclude?: HouseId) =>
    balancedHouse(houseHeadcounts(DAY_ROSTER_HOUSES), Math.random, exclude);

  /** 사신제: 다른 학생들의 기숙사별 합계 + 내 오늘 누적(내 기숙사) → 순위 */
  const ranking = useMemo(
    () =>
      rankHouses(addMine(presence.houseTotals, house, timer.elapsedSeconds)),
    [presence.houseTotals, house, timer.elapsedSeconds],
  );

  /** `exclude`: 다시 배정할 때 지금 기숙사 (같은 곳이 또 나오지 않게) */
  const assignHouse = (exclude?: HouseId) => {
    const h = pickHouse(exclude);
    saveHouse(h);
    setHouse(h);
    setStep("sorting");
  };
  /** 입장: 기숙사가 없으면 사신등 의식부터 */
  const enter = () => (house ? setStep("world") : assignHouse());

  /* 다시 배정은 하루 1번 — 순위가 생겨서 마음에 드는 기숙사가 나올 때까지 반복하는 것을 막는다 */
  const [rerollDay, setRerollDay] = useState<string | null>(() =>
    loadRerollDay(),
  );
  const [confirmReroll, setConfirmReroll] = useState(false);
  const rerollAvailable = canReroll(rerollDay, dayKey(Date.now()));
  const reroll = () => {
    const today = dayKey(Date.now());
    if (!house || !canReroll(rerollDay, today)) return;
    saveRerollDay(today);
    setRerollDay(today);
    setConfirmReroll(false);
    assignHouse(house);
  };

  const freeSeats =
    presence.seats.length - presence.others.length - (presence.me ? 1 : 0);
  const mySubject = subject.trim() || DEFAULT_SUBJECT;

  const handleSit = (seatId: string) => {
    presence.join({
      seatId,
      subject: mySubject,
      house: house ?? pickHouse(),
      mode,
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
              ranking={ranking}
              mode={mode}
              onModeChange={(m) => {
                setMode(m);
                presence.update({ mode: m });
              }}
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
        {/* 내 기숙사가 가장 먼저 — 첫 입장이면 사신등 의식 안내 */}
        <HouseCard
          house={house}
          rerollAvailable={rerollAvailable}
          confirming={confirmReroll}
          onAskReroll={() => setConfirmReroll(true)}
          onConfirmReroll={reroll}
          onCancelReroll={() => setConfirmReroll(false)}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--spacing-12)",
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

        <HouseRanking
          title="오늘의 사신제"
          caption="기숙사별 오늘 집중 시간 합계 · 내 집중도 내 기숙사에 더해져요"
          entries={ranking}
          myHouse={house}
        />

        <form
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--spacing-16)",
            marginTop: "auto",
            // 화면이 길어져도 입장 버튼이 항상 보이도록 아래에 고정
            position: "sticky",
            bottom: 0,
            background: "var(--color-background-default)",
            paddingTop: "var(--spacing-12)",
            paddingBottom:
              "max(var(--spacing-16), env(safe-area-inset-bottom))",
            borderTop: "1px solid var(--color-background-muted)",
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
