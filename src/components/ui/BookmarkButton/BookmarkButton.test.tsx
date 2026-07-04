import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { BookmarkButton } from "./BookmarkButton";

describe("BookmarkButton", () => {
  it("기본 상태는 aria-pressed=false, 접근성 라벨은 '북마크'다", () => {
    render(<BookmarkButton />);
    const button = screen.getByRole("button", { name: "북마크" });
    expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it("state='filled'면 aria-pressed=true다", () => {
    render(<BookmarkButton state="filled" />);
    expect(screen.getByRole("button", { name: "북마크" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("클릭 시 onClick이 호출된다", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<BookmarkButton onClick={onClick} />);
    await user.click(screen.getByRole("button", { name: "북마크" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("aria-label을 커스터마이즈할 수 있다", () => {
    render(<BookmarkButton aria-label="게시글 저장" />);
    expect(
      screen.getByRole("button", { name: "게시글 저장" }),
    ).toBeInTheDocument();
  });
});
