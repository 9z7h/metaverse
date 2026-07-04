import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import { Home } from "./components/pages/Home";
import { View } from "./components/pages/View";
import { HomeDesign } from "./components/pages/HomeDesign";
import { Login } from "./components/pages/Login";
import { Write } from "./components/pages/Write";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/view/:id" element={<View />} />
        <Route path="/home-design" element={<HomeDesign />} />
        <Route path="/login" element={<Login />} />
        <Route path="/write" element={<Write />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
