import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import { Home } from "./components/pages/Home";
import { View } from "./components/pages/View";
import { HomeDesign } from "./components/pages/HomeDesign";
import { Login } from "./components/pages/Login";
import { Write } from "./components/pages/Write";
import { Library } from "./components/pages/Library";
import { supabaseOrNull } from "./lib/supabase";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/view/:id" element={<View />} />
        <Route path="/home-design" element={<HomeDesign />} />
        <Route path="/login" element={<Login />} />
        <Route path="/write" element={<Write />} />
        {/* 환경변수가 있으면 Supabase 연결, 없으면 이 기기 안의 체험 모드 */}
        <Route path="/library" element={<Library academy={supabaseOrNull} />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
