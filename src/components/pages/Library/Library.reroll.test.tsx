import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, it, expect } from "vitest";
import { Library } from "./Library";
import { clearHouse, clearRerollDay, saveHouse } from "./houses";
import { dayKey } from "./useFocusTimer";

/**
 * jsdom에는 WebGL이 없어서 먹빛각 입장은 "3D를 열 수 없어요" 안내로 이어진다.
 * 덕분에 입장 화면 ↔ 배정 연출 흐름을 3D 없이 끝까지 따라갈 수 있다.
 */
/** 입장 화면 본문(main)의 두 번째 블록 — 첫 블록은 타이틀 */
const houseCard = () => {
  const main = screen.getByRole("main");
  expect(
    within(main.children[0] as HTMLElement).getByRole("heading", { level: 1 }),
  ).toBeInTheDocument();
  return main.children[1] as HTMLElement;
};

const renderLibrary = () =>
  render(
    <Library sortingDurationMs={0} presenceOptions={{ simulate: false }} />,
  );

async function rerollThroughReveal() {
  await userEvent.click(screen.getByRole("button", { name: "다시 배정" }));
  await userEvent.click(screen.getByRole("button", { name: "다시 배정하기" }));
}

beforeEach(() => {
  clearHouse();
  clearRerollDay();
});
afterEach(() => cleanup());

describe("입장 화면 — 타이틀 바로 아래에 내 기숙사", () => {
  it("배정된 기숙사가 있으면 타이틀 바로 아래가 '내 기숙사' 카드", () => {
    saveHouse("hyeonmu");
    renderLibrary();
    const first = houseCard();
    expect(first).toHaveAttribute("aria-label", "내 기숙사");
    expect(within(first).getByText("현무관 수련생")).toBeInTheDocument();
    expect(
      within(first).getByText(/깊이 살피고, 때가 오면 움직인다/),
    ).toBeInTheDocument();
  });

  it("첫 입장이면 타이틀 바로 아래에 사신갓 안내 카드", () => {
    renderLibrary();
    const first = houseCard();
    expect(first).toHaveAttribute("aria-label", "기숙사 배정 안내");
    expect(
      within(first).getByText(/사신갓이 기숙사를 정해 줘요/),
    ).toBeInTheDocument();
  });
});

describe("다시 배정 — 하루 1번", () => {
  it("누르면 먼저 확인을 묻고, 취소하면 아무 일도 없다", async () => {
    saveHouse("hyeonmu");
    renderLibrary();
    await userEvent.click(screen.getByRole("button", { name: "다시 배정" }));
    expect(screen.getByRole("alert")).toHaveTextContent("하루에 한 번만");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "집중 시간도 새 기숙사에 더해져요",
    );

    await userEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: "다시 배정" })).toBeEnabled();
    expect(screen.getByText("현무관 수련생")).toBeInTheDocument();
  });

  it("확인하면 항상 다른 기숙사로 배정되고, 같은 날 다시는 못 한다", async () => {
    saveHouse("hyeonmu");
    renderLibrary();
    await rerollThroughReveal();

    // 사신등 의식 결과 — 현무관이 아닌 다른 기숙사
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).not.toBe("현무관");
    expect(["백호관", "주작관", "청룡관"]).toContain(heading.textContent);

    // 입장 → (jsdom: 3D 불가 안내) → 입장 화면으로
    await userEvent.click(
      screen.getByRole("button", { name: "먹빛각 입장하기" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "입장 화면으로" }),
    );

    expect(screen.getByRole("button", { name: "다시 배정" })).toBeDisabled();
    expect(screen.getByText(/내일 다시 배정할 수 있어요/)).toBeInTheDocument();
    // 새 기숙사가 맨 위 카드에 표시된다
    const first = houseCard();
    expect(within(first).queryByText("현무관 수련생")).toBeNull();
    expect(within(first).getByText(/수련생/)).toBeInTheDocument();
  });

  it("새로고침(재마운트)해도 오늘은 여전히 불가", async () => {
    saveHouse("hyeonmu");
    renderLibrary();
    await rerollThroughReveal();
    cleanup();

    renderLibrary();
    expect(screen.getByRole("button", { name: "다시 배정" })).toBeDisabled();
  });

  it("어제 한 기록이면 오늘 다시 할 수 있다", () => {
    saveHouse("hyeonmu");
    window.localStorage.setItem("hanul-academy:reroll-day", "2000-01-01");
    renderLibrary();
    expect(screen.getByRole("button", { name: "다시 배정" })).toBeEnabled();
    expect(screen.getByText("하루 1번 가능해요")).toBeInTheDocument();
  });

  it("다시 배정한 날짜는 오늘 날짜로 저장된다", async () => {
    saveHouse("hyeonmu");
    renderLibrary();
    await rerollThroughReveal();
    expect(window.localStorage.getItem("hanul-academy:reroll-day")).toBe(
      dayKey(Date.now()),
    );
  });
});

describe("입장 화면 — 세계관 소개", () => {
  it("첫 입장이면 소개가 펼쳐져 있고, 기숙사별 랭킹은 보이지 않는다", () => {
    renderLibrary();
    expect(
      screen.getByRole("region", { name: "학당 소개" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("오늘의 사신제")).toBeNull();
  });

  it("이미 배정된 재방문이면 접혀 있고 버튼으로 다시 볼 수 있다", async () => {
    saveHouse("hyeonmu");
    renderLibrary();
    expect(screen.queryByRole("region", { name: "학당 소개" })).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: "학당 소개 보기" }),
    );
    expect(
      screen.getByRole("region", { name: "학당 소개" }),
    ).toBeInTheDocument();
  });
});
