import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { PostCardStats } from "./PostCardStats";

describe("PostCardStats", () => {
  it("조회수/좋아요 값을 렌더한다", () => {
    render(<PostCardStats viewCount="12" likeCount="34" />);
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("34")).toBeInTheDocument();
  });

  it("onLikeClick이 없으면 좋아요 영역은 버튼이 아니다(표시 전용, 하위 호환)", () => {
    render(<PostCardStats viewCount="12" likeCount="34" />);
    expect(screen.queryByRole("button", { name: "좋아요" })).toBeNull();
  });

  it("onLikeClick이 있으면 좋아요 버튼이 렌더되고 클릭 시 콜백이 호출된다", async () => {
    const user = userEvent.setup();
    const onLikeClick = vi.fn();
    render(
      <PostCardStats viewCount="12" likeCount="34" onLikeClick={onLikeClick} />,
    );
    const likeButton = screen.getByRole("button", { name: "좋아요" });
    expect(likeButton).toHaveAttribute("aria-pressed", "false");
    await user.click(likeButton);
    expect(onLikeClick).toHaveBeenCalledTimes(1);
  });

  it("liked=true면 좋아요 버튼 aria-pressed=true다", () => {
    render(
      <PostCardStats
        viewCount="12"
        likeCount="34"
        liked
        onLikeClick={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "좋아요" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("showBookmark=false면 북마크 버튼이 없다(하위 호환)", () => {
    render(<PostCardStats viewCount="12" likeCount="34" />);
    expect(screen.queryByRole("button", { name: "북마크" })).toBeNull();
  });

  it("showBookmark=true면 북마크 버튼이 렌더되고 클릭 시 콜백이 호출된다", async () => {
    const user = userEvent.setup();
    const onBookmarkClick = vi.fn();
    render(
      <PostCardStats
        viewCount="12"
        likeCount="34"
        showBookmark
        onBookmarkClick={onBookmarkClick}
      />,
    );
    await user.click(screen.getByRole("button", { name: "북마크" }));
    expect(onBookmarkClick).toHaveBeenCalledTimes(1);
  });
});
