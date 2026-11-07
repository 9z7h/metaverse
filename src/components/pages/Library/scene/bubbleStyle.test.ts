import { describe, expect, it } from "vitest";
import { bubbleStyle } from "./Avatar";

describe("말풍선 스타일 — 한 글자 폭의 세로 줄이 되지 않게", () => {
  it("폭은 글 길이만큼(max-content)이고, 최대 폭에서만 줄바꿈한다", () => {
    expect(bubbleStyle.width).toBe("max-content");
    expect(bubbleStyle.maxWidth).toBeTruthy();
  });

  it("[버그 재현] overflow-wrap: anywhere를 쓰지 않는다 — 최소 너비가 글자 하나로 줄어든다", () => {
    expect(bubbleStyle.overflowWrap).not.toBe("anywhere");
  });

  it("글은 눌러서 선택되거나 터치를 가로채지 않는다", () => {
    expect(bubbleStyle.pointerEvents).toBe("none");
    expect(bubbleStyle.userSelect).toBe("none");
  });
});
