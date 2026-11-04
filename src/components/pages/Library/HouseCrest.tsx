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
  // 주작 — 날개를 펼치고 긴 꼬리를 늘어뜨린 붉은 새
  ember: [
    {
      d: "M32 13c3 0 5 2 5 5l7-2-5 6c7 0 12-3 16-7-1 11-10 17-18 17l4 15-9-7-9 7 4-15c-8 0-17-6-18-17 4 4 9 7 16 7l-5-6 7 2c0-3 2-5 5-5z",
    },
  ],
  // 청룡 — S자로 휘감아 오르는 용
  azure: [
    { d: "M15 50c-3-10 10-12 14-18s-2-12 6-17c4-2 8-1 10 1", stroke: 6 },
    { d: circle(47, 16, 5.5) },
    { d: "M45 11l-3-6M50 11l2-6", stroke: 2.5 },
    { d: "M19 45l-6 2M27 33l-6-1M33 23l-5-3", stroke: 2.5 },
  ],
  // 해태 — 외뿔과 갈기를 가진 수호수의 얼굴
  gold: [
    { d: "M29 19l3-11 3 11z" },
    {
      d: `${circle(32, 36, 14)}${circle(26.5, 33, 2.6)}${circle(37.5, 33, 2.6)}M26 42h12l-6 5z`,
      evenodd: true,
    },
    {
      d: "M18 30l-6-4 3 8M46 30l6-4-3 8",
      stroke: 2.5,
    },
  ],
  // 장생(거북) — 위에서 본 거북, 육각 등껍질
  verdant: [
    { d: circle(32, 14, 5) },
    {
      d: "M14 28c-5-3-8-1-8 2 2 1 5 1 8 0zM50 28c5-3 8-1 8 2-2 1-5 1-8 0zM17 46c-4 2-5 6-3 7 2 0 4-2 6-4zM47 46c4 2 5 6 3 7-2 0-4-2-6-4z",
    },
    {
      d: `M32 18c11 0 19 8 19 18s-8 18-19 18-19-8-19-18 8-18 19-18z
          M32 28l6 4v7l-6 4-6-4v-7z`,
      evenodd: true,
    },
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
      aria-label={`${HOUSES[house].name} 문장 (${HOUSES[house].creature})`}
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
