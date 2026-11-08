import { BoxGeometry } from "three";
import type { MeshStandardMaterial } from "three";

/** 가운데 제본 홈과 양쪽 페이지의 완만한 굴곡. 옆면도 같은 높이로 맞춘다. */
export function createDeskBookGeometry() {
  const geometry = new BoxGeometry(1, 1, 1, 20, 1, 1);
  const positions = geometry.getAttribute("position");
  for (let i = 0; i < positions.count; i++) {
    if (positions.getY(i) <= 0) continue;
    const distance = Math.abs(positions.getX(i));
    const height =
      0.36 + Math.sin(distance * Math.PI * 2) * 0.22 + distance * 0.25;
    positions.setY(i, height);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

type BookShader = Parameters<MeshStandardMaterial["onBeforeCompile"]>[0];

/** 본문은 윗면에만, 얇은 종이 단면은 글씨 없는 바깥 여백을 사용한다. */
export function deskBookShader(shader: BookShader) {
  shader.vertexShader = shader.vertexShader.replace(
    "#include <uv_vertex>",
    `#include <uv_vertex>
    #ifdef USE_MAP
      if (abs(normal.y) < 0.5) vMapUv = vec2(0.018, 0.08 + uv.y * 0.84);
    #endif`,
  );
}

export const deskBookKey = () => "hanji-desk-book-v1";
