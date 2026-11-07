import type { CSSProperties } from "react";

/**
 * 사신갓 — 사신등 불빛이 깃들어 학생의 마음을 읽고 기숙사를 외치는 의식용 갓.
 * 색은 모두 토큰(`--color-scene-*`)에서 오고, 움직임은 CSS 애니메이션이라 WebGL이 필요 없다.
 * "동작 줄이기" 설정이면 애니메이션 없이 정지한 모습으로 그린다.
 */

export interface MagicGatProps {
  /** 가로 크기(px). 세로는 비율에 맞춰 따라온다 */
  size?: number;
  /** 말하는 중 — 입이 달싹인다 */
  talking?: boolean;
  /** 외치는 순간 — 한 번 크게 부풀며 빛이 번진다 */
  shout?: boolean;
  /** 빛 색 (CSS 색 값, 보통 기숙사 토큰). 없으면 촛불색 */
  glow?: string;
}

const hatFill: CSSProperties = { fill: "var(--color-scene-hat)" };
const lightStroke: CSSProperties = {
  stroke: "var(--color-scene-light)",
  fill: "none",
};

/** 애니메이션 정의. 클래스 이름은 `gat-` 접두사로 겹치지 않게 한다 */
const GAT_CSS = `
@keyframes gat-drop {
  from { transform: translateY(-140%) rotate(-8deg); opacity: 0; }
  60% { opacity: 1; }
  to { transform: translateY(0) rotate(0); opacity: 1; }
}
@keyframes gat-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}
@keyframes gat-talk {
  from { transform: scaleY(0.35); }
  to { transform: scaleY(1.5); }
}
@keyframes gat-shout {
  0% { transform: scale(1); }
  35% { transform: scale(1.16) rotate(-3deg); }
  70% { transform: scale(1.08) rotate(2deg); }
  100% { transform: scale(1); }
}
.gat-drop { animation: gat-drop 700ms cubic-bezier(0.2, 0.8, 0.2, 1) both; }
.gat-float { animation: gat-float 2.4s ease-in-out infinite; }
.gat-shout { animation: gat-shout 650ms ease-out both; }
.gat-mouth { transform-box: fill-box; transform-origin: center; }
.gat-mouth-talk { animation: gat-talk 260ms ease-in-out infinite alternate; }
@media (prefers-reduced-motion: reduce) {
  .gat-drop, .gat-float, .gat-shout, .gat-mouth-talk { animation: none; }
}
`;

export function MagicGat({
  size = 200,
  talking = false,
  shout = false,
  glow = "var(--color-scene-flame)",
}: MagicGatProps) {
  return (
    <div
      className="gat-drop"
      style={{ width: size, height: size * 0.78 }}
      aria-hidden
    >
      <style>{GAT_CSS}</style>
      <div
        className={shout ? "gat-shout" : "gat-float"}
        style={{
          width: "100%",
          height: "100%",
          // 사신등 불빛이 갓을 감싼다 — 외칠 때는 더 넓게 번진다
          filter: `drop-shadow(0 0 ${shout ? 28 : 14}px ${glow})`,
          transition: "filter 300ms ease-out",
        }}
      >
        <svg viewBox="0 0 200 156" width="100%" height="100%">
          {/* 갓끈 */}
          <path
            d="M70 112 Q66 128 72 146"
            strokeWidth={2.4}
            style={lightStroke}
          />
          <path
            d="M130 112 Q134 128 128 146"
            strokeWidth={2.4}
            style={lightStroke}
          />
          {/* 양태(넓은 챙) */}
          <ellipse cx={100} cy={100} rx={94} ry={28} style={hatFill} />
          <ellipse
            cx={100}
            cy={100}
            rx={94}
            ry={28}
            strokeWidth={2}
            style={lightStroke}
            opacity={0.7}
          />
          {/* 총모자(둥근 윗부분) */}
          <path
            d="M62 100 L66 44 Q66 30 100 30 Q134 30 134 44 L138 100 Q100 116 62 100 Z"
            style={hatFill}
          />
          <path
            d="M62 100 L66 44 Q66 30 100 30 Q134 30 134 44 L138 100"
            strokeWidth={2}
            style={lightStroke}
            opacity={0.7}
          />
          {/* 윗면 결 */}
          <ellipse
            cx={100}
            cy={40}
            rx={30}
            ry={8}
            strokeWidth={1.4}
            style={lightStroke}
            opacity={0.45}
          />
          {/* 눈 — 사신등 불빛 */}
          <ellipse cx={86} cy={68} rx={5} ry={7} style={{ fill: glow }} />
          <ellipse cx={114} cy={68} rx={5} ry={7} style={{ fill: glow }} />
          {/* 입 */}
          <ellipse
            className={talking ? "gat-mouth gat-mouth-talk" : "gat-mouth"}
            cx={100}
            cy={88}
            rx={9}
            ry={3.5}
            style={{ fill: glow }}
          />
        </svg>
      </div>
    </div>
  );
}
