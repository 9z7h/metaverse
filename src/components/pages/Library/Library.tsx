import { useState } from "react";
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

type Step = "entrance" | "seats" | "studying";

export interface LibraryProps {
  /** 한 세션 길이(초). 기본 25분. 스토리/데모에서 짧게 줄일 수 있다. */
  sessionSeconds?: number;
  /** 접속자 시뮬레이션 옵션 (테스트에서 `{ simulate: false }`) */
  presenceOptions?: UseLibraryPresenceOptions;
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
 * 마법학교 대도서관 — 함께 공부하는 모바일 페이지.
 * 입장(과목 입력) → 좌석 선택 → 집중 타이머 3단계.
 * `data-theme="library"`로 시맨틱 토큰을 재정의해 기존 UI 컴포넌트를 그대로 테마링한다.
 */
export function Library({
  sessionSeconds = 25 * 60,
  presenceOptions,
}: LibraryProps) {
  const presence = useLibraryPresence(presenceOptions);
  const [step, setStep] = useState<Step>("entrance");
  const [subject, setSubject] = useState("");

  const timer = useFocusTimer(sessionSeconds, () =>
    presence.update({ focusing: false }),
  );

  const seatLabel = (id: string) =>
    presence.seats.find((s) => s.id === id)?.label ?? id;
  const occupantOf = (seatId: string) =>
    presence.others.find((s) => s.seatId === seatId);
  const freeSeats =
    presence.seats.length - presence.others.length - (presence.me ? 1 : 0);
  const mySubject = subject.trim() || DEFAULT_SUBJECT;

  const handleSit = (seatId: string) => {
    presence.join({
      seatId,
      subject: mySubject,
      focusing: false,
      focusSeconds: timer.focusedSeconds,
    });
    setStep("studying");
  };

  const handleLeave = () => {
    if (timer.status !== "idle") timer.reset();
    presence.leave();
    setStep("seats");
  };

  const handleStart = () => {
    timer.start();
    presence.update({ focusing: true });
  };
  const handlePause = () => {
    timer.pause();
    presence.update({ focusing: false });
  };
  const handleReset = () => {
    timer.reset();
    presence.update({ focusing: false });
  };

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
              <p style={captionStyle}>마법학교 · 밤 열람실</p>
              <h1
                style={{
                  margin: 0,
                  font: "var(--text-display-lg-bold)",
                  color: "var(--color-text-primary)",
                }}
              >
                대도서관에
                <br />
                촛불이 켜졌어요
              </h1>
              <p
                style={{
                  margin: 0,
                  font: "var(--text-body-lg-regular)",
                  color: "var(--color-text-secondary)",
                }}
              >
                혼자 하면 흐트러지는 공부, 같은 서고에 앉은 수련생들과 함께
                집중해요.
              </p>
            </div>

            <LiveCount online={presence.onlineCount} free={freeSeats} />

            <form
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--spacing-16)",
                marginTop: "auto",
              }}
              onSubmit={(e) => {
                e.preventDefault();
                setStep("seats");
              }}
            >
              <Input
                label="오늘 공부할 과목"
                placeholder={`예: 알고리즘 (비우면 '${DEFAULT_SUBJECT}')`}
                value={subject}
                maxLength={20}
                onChange={(e) => setSubject(e.target.value)}
              />
              <ButtonLarge onClick={() => setStep("seats")}>
                도서관 입장
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
                <ButtonSmall style="monolight" onClick={handleLeave}>
                  자리 비우기
                </ButtonSmall>
              }
            />

            <FocusTimer
              totalSeconds={sessionSeconds}
              remainingSeconds={timer.remainingSeconds}
              status={timer.status}
              label={mySubject}
              onStart={handleStart}
              onPause={handlePause}
              onReset={handleReset}
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
                  label="집중한 시간"
                  value={formatFocusMinutes(
                    Math.floor(timer.focusedSeconds / 60),
                  )}
                />
                <Stat
                  label="완료한 세션"
                  value={`${timer.completedSessions}회`}
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
