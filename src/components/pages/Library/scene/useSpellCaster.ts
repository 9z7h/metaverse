/**
 * 내 주문 시전 상태 — 서고와 뜰이 함께 쓴다.
 * 내 위치와 방향은 장면이 매 프레임 쓰는 ref에서 시전 순간에만 읽는다.
 * 규칙(쿨다운·한 사람당 주문마다 하나·동시 상한)은 spellLogic이 정한다.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CAST_RELEASE_MS,
  activeCasts,
  addCast,
  canCast,
  castZone,
} from "./spellLogic";
import type { SpellCast, SpellId } from "./spellLogic";

export interface CasterPose {
  x: number;
  z: number;
  /** 바라보는 방향 rad (아바타 rotation.y와 같은 기준) */
  ry: number;
}

export interface UseSpellCasterOptions {
  /** 내 시전을 가리키는 이름 (효과를 시전자별로 가른다) */
  selfId: string;
  /** 시전 순간의 내 위치·방향. 읽을 수 없으면 null */
  getPose: () => CasterPose | null;
  /** false면 시전하지 않는다 (앉아 있음, 구름 타는 중 등) */
  enabled: boolean;
}

export function useSpellCaster({
  selfId,
  getPose,
  enabled,
}: UseSpellCasterOptions) {
  const [casts, setCasts] = useState<SpellCast[]>([]);
  const [castAt, setCastAt] = useState<number | null>(null);
  const lastCastAt = useRef<number | null>(null);
  const seq = useRef(0);
  const getPoseRef = useRef(getPose);
  getPoseRef.current = getPose;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  /** 시전에 성공하면 그 시전을, 쿨다운이거나 할 수 없는 상태면 null을 돌려준다 */
  const cast = useCallback(
    (spell: SpellId): SpellCast | null => {
      if (!enabledRef.current) return null;
      const now = performance.now();
      if (!canCast(lastCastAt.current, now)) return null;
      const pose = getPoseRef.current();
      if (!pose) return null;
      lastCastAt.current = now;
      const zone = castZone(pose.x, pose.z, pose.ry);
      const next: SpellCast = {
        id: `${selfId}-${seq.current++}`,
        caster: selfId,
        spell,
        x: zone.x,
        z: zone.z,
        ry: pose.ry,
        // 효과는 지팡이가 나아가는 정점에 풀려난다
        t0: now + CAST_RELEASE_MS,
      };
      setCasts((list) => addCast(list, next, now));
      setCastAt(now);
      return next;
    },
    [selfId],
  );

  /** 다른 사람의 시전을 보여 준다 (시각 전용, 받은 시각을 시작으로 삼는다) */
  const addRemote = useCallback((remote: SpellCast) => {
    const now = performance.now();
    setCasts((list) =>
      addCast(list, { ...remote, t0: now + CAST_RELEASE_MS }, now),
    );
  }, []);

  // 끝난 효과를 치워 장면이 가만히 있을 때 다시 그리지 않게 한다
  const hasCasts = casts.length > 0;
  useEffect(() => {
    if (!hasCasts) return;
    const timer = window.setInterval(() => {
      setCasts((list) => {
        const alive = activeCasts(list, performance.now());
        return alive.length === list.length ? list : alive;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [hasCasts]);

  return { casts, castAt, cast, addRemote, active: hasCasts };
}
