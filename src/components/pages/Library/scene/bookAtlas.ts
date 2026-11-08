import type { MeshStandardMaterial } from "three";

export const BOOK_SPINE_VARIANTS = 7;
export const BOOK_ATLAS_URL = `${import.meta.env.BASE_URL}textures/korean-books-clean.jpg`;

type BookShader = Parameters<MeshStandardMaterial["onBeforeCompile"]>[0];

/** 앞면은 일곱 책등 중 하나, 위아래와 뒤쪽은 종이 단면을 사용한다. */
export function bookAtlasShader(shader: BookShader) {
  shader.vertexShader = shader.vertexShader.replace(
    "#include <common>",
    `#include <common>
    attribute float bookVariant;`,
  );
  shader.vertexShader = shader.vertexShader.replace(
    "#include <uv_vertex>",
    `#include <uv_vertex>
    #ifdef USE_MAP
      float bookTile = bookVariant;
      vec2 bookUv = uv;
      if (abs(normal.y) > 0.5 || normal.z < -0.5) {
        bookTile = 7.0;
      } else if (abs(normal.x) > 0.5) {
        // 표지는 책등의 천 가장자리만 사용해 제목표가 옆면에 반복되지 않게 한다.
        bookUv.x *= 0.12;
      }
      // 셀 경계 안쪽에서 샘플링해 이웃 책의 색이 번지는 것을 줄인다.
      bookUv = clamp(bookUv, vec2(0.012), vec2(0.988));
      vec2 bookCell = vec2(mod(bookTile, 4.0), 1.0 - floor(bookTile / 4.0));
      vMapUv = (bookUv + bookCell) / vec2(4.0, 2.0);
    #endif`,
  );
}

export const bookAtlasKey = () => "korean-book-atlas-v1";
