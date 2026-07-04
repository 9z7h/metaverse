import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Icon, iconPaths, multicolorIcons, type IconName } from "./Icon";

const allNames = Object.keys(iconPaths) as IconName[];

describe("Icon", () => {
  it("svg 엘리먼트로 렌더된다", () => {
    const { container } = render(<Icon name="search" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("viewBox", "0 0 16 16");
  });

  it("레지스트리의 21개 아이콘이 모두 path/shape를 그린다", () => {
    expect(allNames).toHaveLength(21);
    for (const name of allNames) {
      const { container } = render(<Icon name={name} />);
      const drawables = container.querySelectorAll(
        "path, circle, rect, ellipse, line, polygon, polyline",
      );
      expect(drawables.length).toBeGreaterThan(0);
    }
  });

  it("title이 없으면 aria-hidden, role 없음", () => {
    const { container } = render(<Icon name="close" />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).not.toHaveAttribute("role");
    expect(svg.querySelector("title")).toBeNull();
  });

  it("title이 있으면 role=img + <title> 제공", () => {
    const { container } = render(<Icon name="close" title="닫기" />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("role", "img");
    expect(svg).not.toHaveAttribute("aria-hidden");
    expect(svg.querySelector("title")?.textContent).toBe("닫기");
  });

  it("size prop이 width/height에 적용된다 (기본 16)", () => {
    const { container: c1 } = render(<Icon name="user" />);
    expect(c1.querySelector("svg")).toHaveAttribute("width", "16");

    const { container: c2 } = render(<Icon name="user" size={32} />);
    const svg = c2.querySelector("svg")!;
    expect(svg).toHaveAttribute("width", "32");
    expect(svg).toHaveAttribute("height", "32");
  });

  it("color prop이 style.color로 전달된다", () => {
    const { container } = render(
      <Icon name="heart_fill" color="rgb(255, 0, 0)" />,
    );
    const svg = container.querySelector("svg")!;
    expect(svg.style.color).toBe("rgb(255, 0, 0)");
  });

  it("나머지 SVG props(className, aria-label 등)가 펼쳐진다", () => {
    const { container } = render(
      <Icon name="menu" className="custom-icon" data-testid="menu-icon" />,
    );
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveClass("custom-icon");
    expect(svg).toHaveAttribute("data-testid", "menu-icon");
  });

  it("단색 아이콘은 currentColor를 사용한다 (하드코딩 색 없음)", () => {
    const { container } = render(<Icon name="search" />);
    const path = container.querySelector("path")!;
    // stroke 기반 단색 아이콘
    expect(path.getAttribute("stroke")).toBe("currentColor");
  });

  it("heart_fill은 fill=currentColor (채워진 단색)", () => {
    const { container } = render(<Icon name="heart_fill" />);
    const path = container.querySelector("path")!;
    expect(path.getAttribute("fill")).toBe("currentColor");
  });

  it("google은 멀티컬러로 원본 색상을 유지한다", () => {
    expect(multicolorIcons).toContain("google");
    const { container } = render(<Icon name="google" />);
    const fills = Array.from(container.querySelectorAll("path")).map((p) =>
      p.getAttribute("fill"),
    );
    // currentColor가 아닌 실제 브랜드 토큰 색상들
    expect(fills).toContain("var(--color-brand-google-red)");
    expect(fills).toContain("var(--color-brand-google-yellow)");
    expect(fills).toContain("var(--color-brand-google-blue)");
    expect(fills).toContain("var(--color-brand-google-green)");
    expect(fills).not.toContain("currentColor");
  });
});
