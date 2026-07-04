import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Divider } from "./Divider";

describe("Divider", () => {
  it("separator role로 렌더된다", () => {
    render(<Divider />);
    expect(screen.getByRole("separator")).toBeInTheDocument();
  });

  it("가로 방향이다", () => {
    render(<Divider />);
    expect(screen.getByRole("separator")).toHaveAttribute(
      "aria-orientation",
      "horizontal",
    );
  });

  it("전달한 className이 적용된다", () => {
    render(<Divider className="my-custom" />);
    expect(screen.getByRole("separator")).toHaveClass("my-custom");
  });
});
