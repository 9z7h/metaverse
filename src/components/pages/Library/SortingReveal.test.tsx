import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, it, expect, vi } from "vitest";
import { SortingReveal } from "./SortingReveal";
import { HOUSES, HOUSE_IDS } from "./houses";

afterEach(() => vi.useRealTimers());

describe("SortingReveal — 사신갓 의식", () => {
  it("durationMs=0이면 바로 이름·가치·표어와 입장 버튼을 보여준다", async () => {
    const onEnter = vi.fn();
    render(<SortingReveal house="hyeonmu" durationMs={0} onEnter={onEnter} />);
    expect(screen.getByRole("heading", { name: "현무관" })).toBeInTheDocument();
    expect(screen.getByText("(지혜 · 탐구 · 신중함)")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /현무관 문장 \(현무\)/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("“깊이 살피고, 때가 오면 움직인다.”"),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "먹빛각 입장하기" }),
    );
    expect(onEnter).toHaveBeenCalledOnce();
  });

  it("갓이 두 줄을 차례로 말한 뒤 기숙사 이름과 가치를 외친다", () => {
    vi.useFakeTimers();
    render(
      <SortingReveal house="jujak" durationMs={1000} onEnter={() => {}} />,
    );
    const [first, second] = HOUSES.jujak.gatLines;
    // 처음엔 결과도 입장 버튼도 없다 (건너뛰기만)
    expect(screen.queryByRole("heading", { name: "주작관" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "먹빛각 입장하기" }),
    ).toBeNull();
    expect(screen.getByRole("button", { name: "건너뛰기" })).toBeEnabled();
    expect(screen.getByText(first)).toHaveStyle({ opacity: "0" });

    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.getByText(first)).toHaveStyle({ opacity: "1" });
    expect(screen.getByText(second)).toHaveStyle({ opacity: "0" });

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.getByText(second)).toHaveStyle({ opacity: "1" });

    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(screen.getByRole("heading", { name: "주작관" })).toBeInTheDocument();
    expect(screen.getByText("(생명 · 공감 · 회복)")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "먹빛각 입장하기" }),
    ).toBeEnabled();
    expect(screen.queryByRole("button", { name: "건너뛰기" })).toBeNull();
  });

  it("건너뛰기를 누르면 바로 외침과 입장 버튼으로 간다", async () => {
    render(
      <SortingReveal house="baekho" durationMs={60_000} onEnter={() => {}} />,
    );
    expect(screen.queryByRole("heading", { name: "백호관" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "건너뛰기" }));
    expect(screen.getByRole("heading", { name: "백호관" })).toBeInTheDocument();
    expect(screen.getByText("(정의 · 용기 · 책임)")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "먹빛각 입장하기" }),
    ).toBeEnabled();
  });
});

describe("사신갓이 읽어 주는 말", () => {
  it.each(HOUSE_IDS)("%s는 성격 줄과 기숙사 설명 줄 두 줄을 가진다", (id) => {
    const [personality, about] = HOUSES[id].gatLines;
    expect(personality.startsWith("너는 ")).toBe(true);
    expect(about.startsWith(`${HOUSES[id].name}은 `)).toBe(true);
    expect(about.endsWith("집이다.")).toBe(true);
  });
});
