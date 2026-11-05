import { Suspense, lazy, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { ButtonLarge, ButtonMedium, ButtonSmall } from "../../ui/Button";
import { FocusTimer } from "../../ui/FocusTimer";
import { Input } from "../../ui/Input";
import { StudySeat, formatFocusMinutes } from "../../ui/StudySeat";
import {
  useLibraryPresence,
  type PresenceStudent,
  type UseLibraryPresenceOptions,
} from "./libraryPresence";
import { useFocusTimer } from "./useFocusTimer";
import { HouseCrest } from "./HouseCrest";
import { SortingReveal } from "./SortingReveal";
import { HOUSES, houseVar, loadHouse, randomHouse, saveHouse } from "./houses";
import type { HouseId } from "./houses";

// three.js 번들(수백 KB)은 3D 모드에 들어갈 때만 내려받는다
const LibraryWorld = lazy(() =>
  import("./scene/LibraryWorld").then((m) => ({ default: m.LibraryWorld })),
);

/**
 * entrance → (첫 입장이면 sorting) → world | seats → studying
 * world = 3D, seats/studying = 2D 간편 모드
 */
type Step = "entrance" | "sorting" | "world" | "seats" | "studying";

export interface LibraryProps {
  /** 접속자 시뮬레이션 옵션 (테스트에서 `{ simulate: false }`) */
  presenceOptions?: UseLibraryPresenceOptions;
  /** 기숙사 배정 연출 길이(ms). 스토리/테스트에서 0으로 즉시 표시 */
  sortingDurationMs?: number;
}

const DEFAULT_SUBJECT = "자율 학습";

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

const seatGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "var(--spacing-12)",
};

const captionStyle: CSSProperties = {
  font: "var(--text-caption-lg-medium)",
  color: "var(--color-text-tertiary)",
  margin: 0,
};

const sectionTitleStyle: CSSProperties = {
  font: "var(--text-title-sm-bold)",
  color: "var(--color-text-primary)",
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

function Header({
  title,
  onBack,
  action,
}: {
  title: string;
  onBack?: () => void;
  action?: ReactNode;
}) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--spacing-12)",
      }}
    >
      {onBack ? (
        <ButtonMedium
          type="icon"
          icon="arrow_left"
          style="monolight"
          aria-label="뒤로"
          onClick={onBack}
        />
      ) : null}
      <h1
        style={{
          flex: 1,
          margin: 0,
          font: "var(--text-display-sm-bold)",
          color: "var(--color-text-primary)",
        }}
      >
        {title}
      </h1>
      {action}
    </header>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--spacing-4)",
        padding: "var(--spacing-16)",
        borderRadius: "var(--radius-lg)",
        background: "var(--color-background-Subtle)",
      }}
    >
      <span style={captionStyle}>{label}</span>
      <span
        style={{
          font: "var(--text-title-sm-bold)",
          color: "var(--color-text-primary)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function OtherSeat({
  student,
  label,
}: {
  student: PresenceStudent;
  label: string;
}) {
  return (
    <StudySeat
      state="occupied"
      seatLabel={label}
      name={student.name}
      subject={student.subject}
      focusMinutes={Math.floor(student.focusSeconds / 60)}
      focusing={student.focusing}
    />
  );
}

/* ── 페이지 ───────────────────────────────────────────── */

/**
 * 한울 마법학당 장서각 — 함께 공부하는 모바일 페이지.
 * 입장(과목 입력) → 첫 입장 시 기숙사 배정 → 3D 장서각(기본) 또는 2D 간편 모드.
 * 두 모드는 같은 presence/timer 상태를 공유해서 언제든 전환할 수 있다.
 * `data-theme="library"`로 시맨틱 토큰을 재정의해 기존 UI 컴포넌트를 그대로 테마링한다.
 */
export function Library({ presenceOptions, sortingDurationMs }: LibraryProps) {
  const presence = useLibraryPresence(presenceOptions);
  const [step, setStep] = useState<Step>("entrance");
  // 기숙사는 처음 한 번 배정 후 유지 (localStorage)
  const [house, setHouse] = useState<HouseId | null>(() => loadHouse());
  const [afterSorting, setAfterSorting] = useState<Step>("world");

  const assignHouse = (next: Step) => {
    const h = randomHouse();
    saveHouse(h);
    setHouse(h);
    setAfterSorting(next);
    setStep("sorting");
  };
  /** 입장: 기숙사가 없으면 배정 연출부터 */
  const enter = (next: Step) => (house ? setStep(next) : assignHouse(next));
  const [subject, setSubject] = useState("");

  // 오늘 누적 집중 스톱워치 (멈췄다 다시 시작해도 이어서 쌓임)
  const timer = useFocusTimer();

  const seatLabel = (id: string) =>
    presence.seats.find((s) => s.id === id)?.label ?? id;
  const occupantOf = (seatId: string) =>
    presence.others.find((s) => s.seatId === seatId);
  const freeSeats =
    presence.seats.length - presence.others.length - (presence.me ? 1 : 0);
  const mySubject = subject.trim() || DEFAULT_SUBJECT;

  const handleSit = (seatId: string, next: Step = "studying") => {
    presence.join({
      seatId,
      subject: mySubject,
      house: house ?? randomHouse(),
      focusing: false,
      focusSeconds: timer.elapsedSeconds,
    });
    setStep(next);
  };

  /** 자리를 떠나면 일시정지만 — 오늘 누적은 그대로 */
  const handleLeave = (next: Step = "seats") => {
    if (timer.status === "running") timer.pause();
    presence.leave();
    setStep(next);
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
          onEnter={() => setStep(afterSorting)}
        />
      </div>
    );
  }

  if (step === "world" && house) {
    return (
      <div data-theme="library" style={pageStyle}>
        <Suspense
          fallback={
            <p style={{ ...captionStyle, padding: "var(--spacing-24)" }}>
              도서관 문을 여는 중…
            </p>
          }
        >
          <LibraryWorld
            presence={presence}
            timer={timer}
            subject={mySubject}
            house={house}
            onSit={(seatId) => handleSit(seatId, "world")}
            onStandUp={() => handleLeave("world")}
            onStart={handleStart}
            onPause={handlePause}
            onExit={() =>
              presence.me ? handleLeave("entrance") : setStep("entrance")
            }
            onSimpleMode={() => setStep(presence.me ? "studying" : "seats")}
          />
        </Suspense>
      </div>
    );
  }

  return (
    <div data-theme="library" style={pageStyle}>
      <main style={columnStyle}>
        {step === "entrance" ? (
          <>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--spacing-12)",
                paddingTop: "var(--spacing-48)",
              }}
            >
              <p style={captionStyle}>한울 마법학당 · 밤의 장서각</p>
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
                한국에 처음 문을 연 마법학당의 도서관이에요. 같은 서고에 앉은
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
                    {HOUSES[house].trait}
                  </span>
                </div>
                <ButtonSmall
                  style="monolight"
                  onClick={() => assignHouse("world")}
                >
                  다시 배정
                </ButtonSmall>
              </div>
            ) : (
              <p style={captionStyle}>
                첫 입장 시 네 기숙사 중 하나가 무작위로 배정돼요.
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
                enter("world");
              }}
            >
              <Input
                label="오늘 공부할 과목"
                placeholder={`예: 알고리즘 (비우면 '${DEFAULT_SUBJECT}')`}
                value={subject}
                maxLength={20}
                onChange={(e) => setSubject(e.target.value)}
              />
              <ButtonLarge onClick={() => enter("world")}>
                도서관 입장
              </ButtonLarge>
              <ButtonLarge style="outline" onClick={() => enter("seats")}>
                간편 모드로 입장
              </ButtonLarge>
            </form>
          </>
        ) : null}

        {step === "seats" ? (
          <>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--spacing-8)",
              }}
            >
              <Header
                title="자리를 골라주세요"
                onBack={() => setStep("entrance")}
                action={
                  <ButtonSmall
                    style="monolight"
                    onClick={() => setStep("world")}
                  >
                    3D로 보기
                  </ButtonSmall>
                }
              />
              <LiveCount online={presence.onlineCount} free={freeSeats} />
            </div>
            <section aria-label="열람실 좌석" style={seatGridStyle}>
              {presence.seats.map((seat) => {
                const occupant = occupantOf(seat.id);
                return occupant ? (
                  <OtherSeat
                    key={seat.id}
                    student={occupant}
                    label={seat.label}
                  />
                ) : (
                  <StudySeat
                    key={seat.id}
                    seatLabel={seat.label}
                    onSelect={() => handleSit(seat.id)}
                  />
                );
              })}
            </section>
          </>
        ) : null}

        {step === "studying" && presence.me ? (
          <>
            <Header
              title={`${seatLabel(presence.me.seatId)} 자리`}
              action={
                <ButtonSmall style="monolight" onClick={() => handleLeave()}>
                  자리 비우기
                </ButtonSmall>
              }
            />

            <FocusTimer
              elapsedSeconds={timer.elapsedSeconds}
              status={timer.status}
              label={mySubject}
              onStart={handleStart}
              onPause={handlePause}
            />

            <section
              aria-labelledby="today-record"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--spacing-12)",
              }}
            >
              <h2 id="today-record" style={sectionTitleStyle}>
                오늘의 기록
              </h2>
              <div style={seatGridStyle}>
                <Stat
                  label="오늘 누적 집중"
                  value={formatFocusMinutes(
                    Math.floor(timer.elapsedSeconds / 60),
                  )}
                />
                <Stat
                  label="이번 연속 집중"
                  value={formatFocusMinutes(Math.floor(timer.runSeconds / 60))}
                />
              </div>
            </section>

            <section
              aria-labelledby="together"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--spacing-12)",
              }}
            >
              <h2 id="together" style={sectionTitleStyle}>
                함께 공부 중 {presence.others.length}명
              </h2>
              {presence.others.length > 0 ? (
                <div style={seatGridStyle}>
                  {presence.others.map((s) => (
                    <OtherSeat
                      key={s.id}
                      student={s}
                      label={seatLabel(s.seatId)}
                    />
                  ))}
                </div>
              ) : (
                <p style={captionStyle}>
                  지금은 혼자예요. 첫 촛불을 밝혀보세요.
                </p>
              )}
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
