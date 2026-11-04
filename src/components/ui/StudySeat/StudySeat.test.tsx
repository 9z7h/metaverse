import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { StudySeat, formatFocusMinutes } from "./StudySeat";

describe("formatFocusMinutes", () => {
  it("분/시간 단위로 포맷한다", () => {
    expect(formatFocusMinutes(0)).toBe("0분");
    expect(formatFocusMinutes(25)).toBe("25분");
    expect(formatFocusMinutes(60)).toBe("1시간");
    expect(formatFocusMinutes(95)).toBe("1시간 35분");
  });
});

describe("StudySeat", () => {
  it("빈 자리는 '여기 앉기' 버튼을 렌더하고 클릭 시 onSelect를 호출한다", async () => {
    const onSelect = vi.fn();
    render(<StudySeat seatLabel="A-1" onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("button", { name: "여기 앉기" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("group", { name: "A-1 빈 자리" }),
    ).toBeInTheDocument();
  });

  it("다른 학생 자리는 버튼 없이 이름/과목/시간을 보여준다", () => {
    render(
      <StudySeat
        state="occupied"
        seatLabel="B-2"
        name="하린"
        subject="알고리즘"
        focusMinutes={95}
        focusing
      />,
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("하린")).toBeInTheDocument();
    expect(screen.getByText("알고리즘")).toBeInTheDocument();
    expect(screen.getByText("1시간 35분")).toBeInTheDocument();
    expect(screen.getByTestId("focus-indicator")).toBeInTheDocument();
  });

  it("휴식 중이면 집중 표시가 없다", () => {
    render(
      <StudySeat
        state="occupied"
        seatLabel="B-3"
        name="도윤"
        focusing={false}
      />,
    );
    expect(screen.queryByTestId("focus-indicator")).toBeNull();
  });

  it("내 자리는 이름 뒤에 (나)를 붙이고 data-state=mine", () => {
    render(<StudySeat state="mine" seatLabel="C-1" name="수련생" />);
    expect(screen.getByText("수련생 (나)")).toBeInTheDocument();
    expect(screen.getByRole("group")).toHaveAttribute("data-state", "mine");
  });
});
