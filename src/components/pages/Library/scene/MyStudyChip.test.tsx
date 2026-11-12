import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MyStudyChip } from "./MyStudyChip";

describe("내 공부 시간 칩", () => {
  it("오늘 누적 수련 시간을 보여 준다", () => {
    render(<MyStudyChip todaySeconds={3 * 3600 + 25 * 60 + 9} />);
    expect(screen.getByRole("status").getAttribute("aria-label")).toBe(
      "오늘 수련 시간 3:25:09",
    );
  });

  it("처음에는 0으로 시작한다", () => {
    render(<MyStudyChip todaySeconds={0} />);
    expect(screen.getByText("오늘 수련 시간")).toBeTruthy();
    expect(screen.getByText("00:00")).toBeTruthy();
  });
});
