import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, it, expect, vi } from "vitest";
import { SortingReveal } from "./SortingReveal";

afterEach(() => vi.useRealTimers());

describe("SortingReveal", () => {
  it("durationMs=0이면 바로 결과와 입장 버튼을 보여준다", async () => {
    const onEnter = vi.fn();
    render(<SortingReveal house="verdant" durationMs={0} onEnter={onEnter} />);
    expect(screen.getByRole("heading", { name: "장생당" })).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /장생당 문장/ }),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "장서각 입장하기" }),
    );
    expect(onEnter).toHaveBeenCalledOnce();
  });

  it("연출 중에는 결과와 입장 버튼을 숨기고, 끝나면 정해진 기숙사에서 멈춘다", () => {
    vi.useFakeTimers();
    render(
      <SortingReveal house="ember" durationMs={1000} onEnter={() => {}} />,
    );
    expect(screen.getByText("기숙사를 정하는 중…")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "주작당" })).toBeNull();
    // 연출 중 버튼은 숨김(visibility: hidden) → 보조기기·포커스 대상에서도 빠짐
    expect(
      screen.queryByRole("button", { name: "장서각 입장하기" }),
    ).toBeNull();

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByRole("heading", { name: "주작당" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "장서각 입장하기" }),
    ).toBeEnabled();
  });
});
