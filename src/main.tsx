import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import "./index.css";
import { Library } from "./components/pages/Library";
import { supabaseOrNull } from "./lib/supabase";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        {/* 환경변수가 있으면 Supabase 연결, 없으면 이 기기 안의 체험 모드 */}
        <Route path="/" element={<Library academy={supabaseOrNull} />} />
        {/* 예전에 공유한 /library 링크가 계속 열리도록 */}
        <Route path="/library" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
