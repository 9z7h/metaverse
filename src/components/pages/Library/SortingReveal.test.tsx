import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, it, expect, vi } from "vitest";
import { SortingReveal } from "./SortingReveal";

afterEach(() => vi.useRealTimers());

describe("SortingReveal — 사신등 의식", () => {
  it("durationMs=0이면 바로 결과·표어·질문과 입장 버튼을 보여준다", async () => {
    const onEnter = vi.fn();
    render(<SortingReveal house="hyeonmu" durationMs={0} onEnter={onEnter} />);
    expect(screen.getByRole("heading", { name: "현무관" })).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /현무관 문장 \(현무\)/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("“깊이 살피고, 때가 오면 움직인다.”"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/눈앞의 답을 의심하고 진실을 찾을 수 있는가\?/),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "먹빛각 입장하기" }),
    );
    expect(onEnter).toHaveBeenCalledOnce();
  });

  it("연출 중에는 결과와 입장 버튼을 숨기고, 끝나면 정해진 기숙사에서 멈춘다", () => {
    vi.useFakeTimers();
    render(
      <SortingReveal house="jujak" durationMs={1000} onEnter={() => {}} />,
    );
    expect(screen.getByText("사신등의 빛이 정해지는 중…")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "주작관" })).toBeNull();
    // 연출 중 버튼은 숨김(visibility: hidden) → 보조기기·포커스 대상에서도 빠짐
    expect(
      screen.queryByRole("button", { name: "먹빛각 입장하기" }),
    ).toBeNull();

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByRole("heading", { name: "주작관" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "먹빛각 입장하기" }),
    ).toBeEnabled();
  });
});
