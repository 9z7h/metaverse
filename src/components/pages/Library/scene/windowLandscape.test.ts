import { describe, expect, it } from "vitest";
import { windowLandscapeCrop } from "./windowLandscape";

describe("창밖 풍경의 비율과 잘림", () => {
  it("서고의 세로창과 가로창에서도 산과 나무가 늘어나지 않는다", () => {
    for (const [width, height] of [
      [5, 6.8],
      [2.2, 2.4],
      [2.2, 4],
      [6, 2],
    ]) {
      const crop = windowLandscapeCrop(width, height, 1536, 1024);
      const sampledAspect = (1536 * crop.scaleX) / (1024 * crop.scaleY);
      expect(sampledAspect).toBeCloseTo(width / height);
    }
  });
  it("창마다 다른 부분을 보여 주어도 이미지 바깥을 샘플링하지 않는다", () => {
    for (const pan of [-1, 0, 0.2, 0.5, 0.8, 1, 2]) {
      const crop = windowLandscapeCrop(2.2, 4, 1536, 1024, pan);
      expect(crop.offsetX).toBeGreaterThanOrEqual(0);
      expect(crop.offsetY).toBeGreaterThanOrEqual(0);
      expect(crop.offsetX + crop.scaleX).toBeLessThanOrEqual(1);
      expect(crop.offsetY + crop.scaleY).toBeLessThanOrEqual(1);
    }
  });
  it("사진과 창의 비율이 같으면 전체 사진을 보여 준다", () => {
    expect(windowLandscapeCrop(6, 4, 1536, 1024)).toEqual({
      scaleX: 1,
      scaleY: 1,
      offsetX: 0,
      offsetY: 0,
    });
  });
});
