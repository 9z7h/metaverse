import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { INTRO_CARDS, WorldIntro } from "./WorldIntro";

describe("WorldIntro", () => {
  it("initialOpen이면 첫 장이 펼쳐져 있다", () => {
    render(<WorldIntro initialOpen />);
    expect(
      screen.getByRole("heading", { name: INTRO_CARDS[0].title }),
    ).toBeInTheDocument();
    expect(screen.getByText("학당 소개 1 / 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "이전" })).toBeDisabled();
  });

  it("다음·이전으로 넘기고 마지막 장에서 닫는다", async () => {
    const user = userEvent.setup();
    render(<WorldIntro initialOpen />);
    await user.click(screen.getByRole("button", { name: "다음" }));
    expect(
      screen.getByRole("heading", { name: INTRO_CARDS[1].title }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "이전" }));
    expect(
      screen.getByRole("heading", { name: INTRO_CARDS[0].title }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "다음" }));
    await user.click(screen.getByRole("button", { name: "다음" }));
    await user.click(screen.getByRole("button", { name: "알겠어요" }));
    expect(screen.queryByRole("region", { name: "학당 소개" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "학당 소개 보기" }),
    ).toBeInTheDocument();
  });

  it("기본은 접혀 있고 버튼으로 첫 장부터 다시 연다", async () => {
    const user = userEvent.setup();
    render(<WorldIntro />);
    expect(screen.queryByRole("heading")).toBeNull();
    await user.click(screen.getByRole("button", { name: "학당 소개 보기" }));
    expect(
      screen.getByRole("heading", { name: INTRO_CARDS[0].title }),
    ).toBeInTheDocument();
  });

  it("둘째 장에는 네 기숙사 이름이 보인다", async () => {
    const user = userEvent.setup();
    render(<WorldIntro initialOpen />);
    await user.click(screen.getByRole("button", { name: "다음" }));
    for (const name of ["백호관", "주작관", "현무관", "청룡관"]) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
  });
});
