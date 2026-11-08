/** 풍경의 비율을 유지하면서 창을 빈틈없이 채우는 UV 범위. */
export function windowLandscapeCrop(
  width: number,
  height: number,
  imageWidth: number,
  imageHeight: number,
  pan = 0.5,
) {
  const ratio = width / height / (imageWidth / imageHeight);
  const scaleX = Math.min(1, ratio);
  const scaleY = Math.min(1, 1 / ratio);
  return {
    scaleX,
    scaleY,
    offsetX: (1 - scaleX) * Math.min(1, Math.max(0, pan)),
    offsetY: (1 - scaleY) * 0.6,
  };
}
