import { describe, expect, it } from "vitest";
import { parseOthers, parsePayload } from "./remotePresence";

const base = {
  name: "하린",
  subject: "알고리즘",
  seatId: "L1",
  focusing: true,
  focusSeconds: 600,
  house: "jujak",
  mode: "practice",
};

describe("parsePayload — 다른 클라이언트가 보낸 값은 믿지 않는다", () => {
  it("정상 payload", () => {
    expect(parsePayload("u1", base)).toEqual({ id: "u1", ...base });
  });

  it.each([
    ["없는 좌석", { ...base, seatId: "Z9" }],
    ["없는 기숙사", { ...base, house: "no-such-house" }],
    ["없는 모드", { ...base, mode: "cheat" }],
    ["객체 아님", "hello"],
    ["null", null],
  ])("버린다 — %s", (_name, raw) => {
    expect(parsePayload("u1", raw)).toBeNull();
  });

  it("집중 시간은 0~하루 사이로, 이름·과목은 길이 제한", () => {
    expect(
      parsePayload("u1", { ...base, focusSeconds: 9e9 })?.focusSeconds,
    ).toBe(86400);
    expect(
      parsePayload("u1", { ...base, focusSeconds: -3 })?.focusSeconds,
    ).toBe(0);
    expect(
      parsePayload("u1", { ...base, focusSeconds: "NaN" })?.focusSeconds,
    ).toBe(0);
    const long = parsePayload("u1", {
      ...base,
      name: "가".repeat(50),
      subject: "나".repeat(50),
    });
    expect(long?.name).toHaveLength(12);
    expect(long?.subject).toHaveLength(20);
  });

  it("focusing은 true일 때만 집중 중", () => {
    expect(parsePayload("u1", { ...base, focusing: "true" })?.focusing).toBe(
      false,
    );
  });
});

describe("parseOthers", () => {
  it("나는 제외하고 다른 학생만", () => {
    const others = parseOthers(
      { me: [base], u2: [{ ...base, seatId: "L2", name: "도윤" }] },
      "me",
    );
    expect(others.map((s) => s.id)).toEqual(["u2"]);
  });

  it("탭을 여러 개 연 사용자는 가장 최근 상태를 쓴다", () => {
    const [s] = parseOthers(
      {
        u2: [
          { ...base, focusing: false },
          { ...base, focusing: true },
        ],
      },
      null,
    );
    expect(s.focusing).toBe(true);
  });

  it("같은 좌석을 둘이 주장하면 먼저 온 쪽만 보인다", () => {
    const others = parseOthers({ u1: [base], u2: [base] }, null);
    expect(others.map((s) => s.id)).toEqual(["u1"]);
  });

  it("잘못된 payload를 보낸 사용자는 건너뛴다", () => {
    const others = parseOthers(
      { bad: [{ ...base, seatId: "??" }], u2: [{ ...base, seatId: "L3" }] },
      null,
    );
    expect(others.map((s) => s.id)).toEqual(["u2"]);
  });

  it("빈 상태", () => {
    expect(parseOthers({}, "me")).toEqual([]);
  });
});
