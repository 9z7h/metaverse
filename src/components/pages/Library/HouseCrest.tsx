import type { ImgHTMLAttributes } from "react";
import { HOUSES } from "./houses";
import type { HouseId } from "./houses";

export function houseCrestUrl(house: HouseId): string {
  return `${import.meta.env.BASE_URL}assets/house-crests/${house}.png`;
}

export interface HouseCrestProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "width" | "height"> {
  house: HouseId;
  size?: number;
}

/** 웹과 3D 공간에서 공유하는 기숙사 문양 */
export function HouseCrest({ house, size = 64, alt, ...rest }: HouseCrestProps) {
  return (
    <img
      src={houseCrestUrl(house)}
      width={size}
      height={size}
      alt={alt ?? `${HOUSES[house].name} 문장 (${HOUSES[house].guardian})`}
      {...rest}
    />
  );
}
