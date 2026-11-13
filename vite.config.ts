import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // 라이브러리를 용도별로 나눠 캐시한다 — 앱 코드만 바뀌어도 three(수백 kB)를 다시 받지 않는다
        manualChunks(id) {
          // 동적 import 도우미는 시작부터 쓰인다 — three 청크에 끼면 입장 화면에서 three를 미리 받게 된다
          if (
            id.includes("vite/preload-helper") ||
            id.includes("vite/modulepreload-polyfill")
          )
            return "react";
          if (!id.includes("node_modules")) return undefined;
          if (/node_modules\/(three|@react-three)\//.test(id)) return "three";
          if (id.includes("node_modules/@supabase/")) return "supabase";
          if (
            /node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(
              id,
            )
          )
            return "react";
          return undefined;
        },
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
  },
});
