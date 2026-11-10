/**
 * 내 주문 시전 상태 — 서고와 뜰이 함께 쓴다.
 * 내 위치와 방향은 장면이 매 프레임 쓰는 ref에서 시전 순간에만 읽는다.
 * 규칙(쿨다운·한 사람당 주문마다 하나·동시 상한)은 spellLogic이 정한다.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CAST_RELEASE_MS,
  CAST_SWING_MS,
  COOLDOWN_MS,
  activeCasts,
  addCast,
  canCast,
  castZone,
  resolveLightToggle,
} from "./spellLogic";
import type { SpellCast, SpellId } from "./spellLogic";

export interface CasterPose {
  x: number;
  z: number;
  /** 구름 위일 때 높이. 없으면 땅 */
  y?: number;
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
  const castsRef = useRef<SpellCast[]>([]);
  const [castAt, setCastAt] = useState<number | null>(null);
  const [animationAt, setAnimationAt] = useState<number | null>(null);
  const lastCastAt = useRef<Partial<Record<SpellId, number>>>({});
  const [cooldownUntil, setCooldownUntil] = useState<
    Partial<Record<SpellId, number>>
  >({});
  const [cooldownNow, setCooldownNow] = useState(() => performance.now());
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
      const isLight = spell === "myeonggyeong" || spell === "mukryeong";
      const cooldownKey = isLight ? "myeonggyeong" : spell;
      if (!canCast(lastCastAt.current[cooldownKey] ?? null, now, cooldownKey))
        return null;
      const pose = getPoseRef.current();
      if (!pose) return null;
      lastCastAt.current[cooldownKey] = now;
      setCooldownUntil((current) => ({
        ...current,
        [cooldownKey]: now + COOLDOWN_MS[cooldownKey],
      }));
      setCooldownNow(now);
      const zone = castZone(pose.x, pose.z, pose.ry);
      const lightOn = castsRef.current.some(
        (c) => c.caster === selfId && c.spell === "myeonggyeong",
      );
      const resolvedSpell = resolveLightToggle(spell, lightOn);
      const next: SpellCast = {
        id: `${selfId}-${seq.current++}`,
        caster: selfId,
        spell: resolvedSpell,
        x: zone.x,
        z: zone.z,
        y: pose.y ?? 0,
        ry: pose.ry,
        // 효과는 지팡이가 나아가는 정점에 풀려난다
        t0: now + CAST_RELEASE_MS,
      };
      const updated = addCast(castsRef.current, next, now);
      castsRef.current = updated;
      setCasts(updated);
      setCastAt(now);
      setAnimationAt(now);
      return next;
    },
    [selfId],
  );

  /** 다른 사람의 시전을 보여 준다 (시각 전용, 받은 시각을 시작으로 삼는다) */
  const addRemote = useCallback((remote: SpellCast) => {
    const now = performance.now();
    const updated = addCast(
      castsRef.current,
      { ...remote, t0: now + CAST_RELEASE_MS },
      now,
    );
    castsRef.current = updated;
    setCasts(updated);
    setAnimationAt(now);
  }, []);

  // 끝난 효과를 치워 장면이 가만히 있을 때 다시 그리지 않게 한다
  const hasCasts = casts.some((c) => c.spell !== "myeonggyeong");
  useEffect(() => {
    if (!hasCasts) return;
    const timer = window.setInterval(() => {
      setCasts((list) => {
        const alive = activeCasts(list, performance.now());
        castsRef.current = alive;
        return alive.length === list.length ? list : alive;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [hasCasts]);

  useEffect(() => {
    if (animationAt === null) return;
    const timer = window.setTimeout(() => setAnimationAt(null), CAST_SWING_MS);
    return () => window.clearTimeout(timer);
  }, [animationAt]);

  useEffect(() => {
    const lastEnd = Math.max(0, ...Object.values(cooldownUntil));
    if (lastEnd <= performance.now()) return;
    const timer = window.setInterval(() => {
      const now = performance.now();
      setCooldownNow(now);
      if (now >= lastEnd) window.clearInterval(timer);
    }, 100);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);

  const cooldowns = {
    myeonggyeong: Math.max(0, (cooldownUntil.myeonggyeong ?? 0) - cooldownNow),
    hwaryong: Math.max(0, (cooldownUntil.hwaryong ?? 0) - cooldownNow),
    buun: Math.max(0, (cooldownUntil.buun ?? 0) - cooldownNow),
  };
  return {
    casts,
    castAt,
    cast,
    addRemote,
    cooldowns,
    active: hasCasts || animationAt !== null,
    lightOn: casts.some(
      (c) => c.caster === selfId && c.spell === "myeonggyeong",
    ),
  };
}
