import type { SVGProps } from "react";
import { HOUSES, houseVar } from "./houses";
import type { HouseId } from "./houses";

/**
 * 기숙사 문장 — 64×64 좌표계의 SVG path 데이터.
 * 같은 데이터를 SVG(UI)와 Canvas Path2D(3D 깃발 텍스처) 양쪽에서 쓴다.
 */
interface CrestShape {
  d: string;
  /** fill(기본) 또는 stroke로 그림 */
  stroke?: number;
  evenodd?: boolean;
}

/** 원을 path로 (Path2D 호환) */
const circle = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${r * 2} 0 a${r} ${r} 0 1 0 ${-r * 2} 0`;

export const CREST_SHAPES: Record<HouseId, CrestShape[]> = {
  // 백호 — 산마루 위에 선 백호 (정면 얼굴, 이마의 줄무늬)
  baekho: [
    // 산마루
    { d: "M4 60L16 48l6 4 10-10 10 9 6-4 12 13z" },
    // 귀
    { d: `${circle(22, 17, 5)}${circle(42, 17, 5)}` },
    // 얼굴 + 눈·코·이마 줄무늬·뺨 줄무늬 (구멍)
    {
      d: `${circle(32, 28, 12)}${circle(27.5, 27, 2.2)}${circle(36.5, 27, 2.2)}
          M29.5 32h5l-2.5 3z
          M29 18h6v1.6h-6zM28.5 21h7v1.6h-7z
          M20.5 29l4.5 1-4.5 1.4zM43.5 29l-4.5 1 4.5 1.4z`,
      evenodd: true,
    },
  ],
  // 주작 — 날개로 작은 불씨를 감싼 붉은 새 (몸 가운데 불씨 모양 구멍)
  jujak: [
    {
      d: `M32 13c3 0 5 2 5 5l7-2-5 6c7 0 12-3 16-7-1 11-10 17-18 17l4 15-9-7-9 7 4-15c-8 0-17-6-18-17 4 4 9 7 16 7l-5-6 7 2c0-3 2-5 5-5z
          M32 23c3.5 3.5 4.5 7 2.5 10-1.2 1.6-3.8 1.6-5 0-2-3-1-6.5 2.5-10z`,
      evenodd: true,
    },
  ],
  // 현무 — 서로를 감싸는 거북과 뱀
  hyeonmu: [
    // 거북 머리·다리
    { d: circle(30, 15, 4.5) },
    {
      d: "M14 28c-5-3-8-1-8 2 2 1 5 1 8 0zM46 28c5-3 8-1 8 2-2 1-5 1-8 0zM16 45c-4 2-5 6-3 7 2 0 4-2 6-4zM44 45c4 2 5 6 3 7-2 0-4-2-6-4z",
    },
    // 등껍질 (육각 무늬 구멍)
    {
      d: `${circle(30, 36, 15)}M30 29l5.5 3.5v6.5l-5.5 3.5-5.5-3.5v-6.5z`,
      evenodd: true,
    },
    // 등껍질을 휘감은 뱀
    { d: "M12 56C24 62 46 60 53 48S56 26 47 20", stroke: 3.2 },
    { d: circle(45.5, 17.5, 3.4) },
  ],
  // 청룡 — 구름을 헤치며 솟아오르는 용
  cheongryong: [
    { d: "M15 50c-3-10 10-12 14-18s-2-12 6-17c4-2 8-1 10 1", stroke: 6 },
    { d: circle(47, 16, 5.5) },
    { d: "M45 11l-3-6M50 11l2-6", stroke: 2.5 },
    { d: "M19 45l-6 2M27 33l-6-1M33 23l-5-3", stroke: 2.5 },
    // 아래에서 감싸는 구름
    { d: "M6 56c-1-4 3-7 7-6 1-5 8-7 11-2 3-3 9-2 9 3 4 0 6 3 4 5z" },
  ],
};

export interface HouseCrestProps extends Omit<
  SVGProps<SVGSVGElement>,
  "children"
> {
  house: HouseId;
  /** 렌더 크기(px). 기본 64 */
  size?: number;
}

/** 원형 테두리 + 구름무늬 점 + 기숙사 상징 */
export function HouseCrest({ house, size = 64, ...rest }: HouseCrestProps) {
  const accent = houseVar(house, "accent");
  const dots = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    return { x: 32 + Math.cos(a) * 29, y: 32 + Math.sin(a) * 29 };
  });
  return (
    <svg
      width={size}
      height={size}
      viewBox="-2 -2 68 68"
      role="img"
      aria-label={`${HOUSES[house].name} 문장 (${HOUSES[house].guardian})`}
      {...rest}
    >
      <circle cx={32} cy={32} r={31} fill={houseVar(house, "primary")} />
      <circle cx={32} cy={32} r={26} fill={houseVar(house, "subtle")} />
      <circle
        cx={32}
        cy={32}
        r={29}
        fill="none"
        stroke={accent}
        strokeWidth={1.2}
      />
      {dots.map((p) => (
        <circle key={`${p.x}${p.y}`} cx={p.x} cy={p.y} r={1.4} fill={accent} />
      ))}
      <g transform="translate(32 32) scale(0.72) translate(-32 -32)">
        {CREST_SHAPES[house].map((s) =>
          s.stroke ? (
            <path
              key={s.d}
              d={s.d}
              fill="none"
              stroke={accent}
              strokeWidth={s.stroke}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : (
            <path
              key={s.d}
              d={s.d}
              fill={accent}
              fillRule={s.evenodd ? "evenodd" : undefined}
            />
          ),
        )}
      </g>
    </svg>
  );
}
