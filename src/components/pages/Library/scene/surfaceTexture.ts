import { useEffect, useMemo } from "react";
import { CanvasTexture, RepeatWrapping } from "three";

type Surface = "wood" | "plaster" | "stone" | "tile" | "paper";

/** 중립 명도만 그린다. 실제 재료 색은 장면의 디자인 토큰이 결정한다. */
export function useSurfaceTexture(
  kind: Surface,
  repeatX = 1,
  repeatY = 1,
  /** 나무에 널빤지 이음선을 그린다 — 바닥·상판처럼 판자가 보여야 하는 곳만 */
  seams = false,
) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      let seed = 1741;
      const random = () => {
        seed = (seed * 16807) % 2147483647;
        return (seed - 1) / 2147483646;
      };
      const pixels = ctx.createImageData(256, 256);
      for (let y = 0; y < 256; y++) {
        for (let x = 0; x < 256; x++) {
          // 회벽·기본: 픽셀마다 튀는 잡음 대신 아주 부드러운 얼룩만 (넓은 벽에서 반짝이지 않게)
          let value =
            242 +
            Math.sin(x * 0.045 + Math.sin(y * 0.03) * 2) * 4 +
            Math.sin(y * 0.06 + x * 0.02) * 3 +
            random() * 3;
          if (kind === "wood") {
            const grain = Math.sin(x * 0.48 + Math.sin(y * 0.025) * 2.2);
            value = 200 + grain * 14 + random() * 10;
            if (
              seams &&
              (x % 64 < 2 || (y + (Math.floor(x / 64) % 2) * 128) % 256 < 2)
            )
              value *= 0.62;
          } else if (kind === "stone") {
            value = 196 + random() * 46 + Math.sin(x * 0.07 + y * 0.1) * 9;
          } else if (kind === "tile") {
            value =
              175 + Math.sin(((x % 32) / 32) * Math.PI) * 65 + random() * 12;
            if (y % 64 < 3) value *= 0.6;
          } else if (kind === "paper") {
            if (y > 28 && y < 230 && y % 15 < 2 && x > 16 && x < 238)
              value = 120 + random() * 35;
            if (x > 125 && x < 131) value = 165;
          }
          const i = (y * 256 + x) * 4;
          pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value;
          pixels.data[i + 3] = 255;
        }
      }
      ctx.putImageData(pixels, 0, 0);
    }
    const map = new CanvasTexture(canvas);
    map.wrapS = map.wrapT = RepeatWrapping;
    map.repeat.set(repeatX, repeatY);
    map.anisotropy = 4;
    return map;
  }, [kind, repeatX, repeatY, seams]);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}
