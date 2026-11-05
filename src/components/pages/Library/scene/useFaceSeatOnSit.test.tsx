import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useFaceSeatOnSit } from "./Characters";
import { deskLayout } from "./sceneLayout";
import type { Orbit } from "./sceneLayout";

const orbitAt = (yaw: number): { current: Orbit } => ({
  current: { yaw, pitch: 0.65, zoom: 1 },
});

/** 두 각이 같은 방향인지 (2π 배수 차이 무시) */
const sameDirection = (a: number, b: number) => {
  expect(Math.cos(a)).toBeCloseTo(Math.cos(b));
  expect(Math.sin(a)).toBeCloseTo(Math.sin(b));
};

describe("useFaceSeatOnSit — 앉을 때 시점을 등 뒤로", () => {
  it("앉으면 시점이 테이블 쪽 정면(자기 등 뒤)으로 맞춰진다", () => {
    const orbit = orbitAt(0);
    renderHook(() => useFaceSeatOnSit("R8", orbit));
    sameDirection(orbit.current.yaw, deskLayout("R8").facing + Math.PI);
  });

  it("[버그 재현] 같은 좌석에 앉아 있는 동안 다시 렌더돼도 돌려 둔 시점이 되돌려지지 않는다", () => {
    const orbit = orbitAt(0);
    const { rerender } = renderHook(
      ({ id }: { id: string | null }) => useFaceSeatOnSit(id, orbit),
      { initialProps: { id: "R8" as string | null } },
    );
    // 사용자가 화면을 끌어 주위를 둘러봄
    orbit.current.yaw = 1.2;
    // 접속자 갱신·타이머 등으로 부모가 계속 다시 렌더한다
    for (let i = 0; i < 5; i++) rerender({ id: "R8" });
    expect(orbit.current.yaw).toBe(1.2);
  });

  it("앉아 있지 않으면 시점을 건드리지 않는다", () => {
    const orbit = orbitAt(2.4);
    renderHook(() => useFaceSeatOnSit(null, orbit));
    expect(orbit.current.yaw).toBe(2.4);
  });

  it("다른 좌석에 새로 앉으면 그 좌석 기준으로 다시 맞춘다", () => {
    const orbit = orbitAt(0);
    const { rerender } = renderHook(
      ({ id }: { id: string | null }) => useFaceSeatOnSit(id, orbit),
      { initialProps: { id: "R8" as string | null } },
    );
    orbit.current.yaw = 0.7;
    rerender({ id: null }); // 일어남
    expect(orbit.current.yaw).toBe(0.7);
    rerender({ id: "L17" }); // 반대편(벽 쪽, 반대 방향) 좌석
    sameDirection(orbit.current.yaw, deskLayout("L17").facing + Math.PI);
  });

  it("가장 짧은 방향으로 돈다 (여러 바퀴 돌아간 시점에서도 한 바퀴를 되돌지 않음)", () => {
    const orbit = orbitAt(Math.PI * 6); // 세 바퀴 돌아간 상태
    renderHook(() => useFaceSeatOnSit("R8", orbit));
    expect(Math.abs(orbit.current.yaw - Math.PI * 6)).toBeLessThanOrEqual(
      Math.PI + 1e-9,
    );
  });
});
