/**
 * 도서관 "실시간 접속(presence)" 데이터 레이어 — 프로토타입용 목업 구현.
 *
 * 페이지는 `useLibraryPresence()`가 돌려주는 `LibraryPresence` 인터페이스만 사용한다.
 * 실시간 연동 시 이 훅 내부만 Supabase Realtime Presence로 교체하면 된다:
 *   - join / update / leave  → channel.track(payload) / channel.untrack()
 *   - others                 → channel.on("presence", { event: "sync" }, ...) 결과
 * 지금은 타이머로 다른 학생들의 집중/휴식 전환과 입·퇴장을 시뮬레이션한다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HouseId } from "./houses";
import { zeroHouseSeconds } from "./houseRanking";
import type { HouseSeconds } from "./houseRanking";

export interface LibrarySeat {
  id: string;
  label: string;
}

export interface PresenceStudent {
  id: string;
  name: string;
  subject: string;
  seatId: string;
  /** 지금 집중 세션 중인지 */
  focusing: boolean;
  /** 오늘 누적 집중 시간(초) */
  focusSeconds: number;
  /** 소속 기숙사 */
  house: HouseId;
  /** 공부 방식 — 실습 중 + 집중 중이면 책상 위로 기숙사 마법이 피어오름 */
  mode: StudyMode;
}

/** 이론(책) / 실습(마법) */
export type StudyMode = "theory" | "practice";

export type MyPresence = Omit<PresenceStudent, "id" | "name">;

export interface LibraryPresence {
  seats: LibrarySeat[];
  /** 나를 제외한 접속자 */
  others: PresenceStudent[];
  /**
   * 기숙사별 오늘 집중 시간(초) 합계 — 나를 제외한 학생들만.
   * 지금 접속해 있는 학생과, 이미 나간 학생이 남기고 간 시간을 모두 더한 값이다.
   * (내 시간은 타이머가 가장 정확하므로 화면에서 따로 더한다)
   */
  houseTotals: HouseSeconds;
  /** 나를 포함한 현재 접속자 수 */
  onlineCount: number;
  me: PresenceStudent | null;
  join: (presence: MyPresence) => void;
  update: (patch: Partial<MyPresence>) => void;
  leave: () => void;
}

/**
 * 긴 열람 테이블 2개(L·R) × 양쪽 면 16석씩 = 64석. 좌표는 scene/sceneLayout.ts의 deskLayout.
 * 1~16은 통로 쪽 면, 17~32는 벽 쪽 면 (각각 안쪽 → 입구 쪽).
 */
export const SEATS: LibrarySeat[] = ["L", "R"].flatMap((table) =>
  Array.from({ length: 32 }, (_, i) => ({
    id: `${table}${i + 1}`,
    label: `${table}-${i + 1}`,
  })),
);

/** 좌석이 입구에서 얼마나 가까운지 (클수록 입구 쪽) — 같은 면 안에서의 순번 */
const seatNearness = (id: string) => (Number(id.slice(1)) - 1) % 16;

const INITIAL_OTHERS: PresenceStudent[] = [
  {
    id: "s1",
    name: "하린",
    subject: "알고리즘",
    seatId: "L15",
    focusing: true,
    focusSeconds: 95 * 60,
    house: "jujak",
    mode: "practice",
  },
  {
    id: "s2",
    name: "도윤",
    subject: "토익",
    seatId: "R31",
    focusing: false,
    focusSeconds: 40 * 60,
    house: "baekho",
    mode: "theory",
  },
  {
    id: "s3",
    name: "서아",
    subject: "UX 리서치",
    seatId: "L10",
    focusing: true,
    focusSeconds: 130 * 60,
    house: "hyeonmu",
    mode: "practice",
  },
];

/** 빈 자리가 있으면 들어왔다가 나가는 학생들 (입·퇴장 시뮬레이션) */
const VISITORS: Omit<PresenceStudent, "seatId">[] = [
  {
    id: "v1",
    name: "지호",
    subject: "통계학",
    focusing: true,
    focusSeconds: 15 * 60,
    house: "cheongryong",
    mode: "practice",
  },
  {
    id: "v2",
    name: "유나",
    subject: "한국사",
    focusing: true,
    focusSeconds: 55 * 60,
    house: "jujak",
    mode: "theory",
  },
];

/**
 * 오늘 접속하는 (목업) 학생들의 기숙사 — 새 학생을 기숙사에 균등 배정할 때 인원 계산의 기준.
 * 실제 서비스에서는 서버가 오늘 배정된 학생 수를 센다.
 */
export const DAY_ROSTER_HOUSES: HouseId[] = [
  ...INITIAL_OTHERS,
  ...VISITORS,
].map((s) => s.house);

const ME_ID = "me";
const ME_NAME = "수련생";

export interface UseLibraryPresenceOptions {
  /** 다른 학생 움직임 시뮬레이션 on/off (테스트·스토리에서 고정 화면이 필요할 때 false) */
  simulate?: boolean;
  /** 시뮬레이션 1틱 간격(ms). 기본 1초. */
  tickMs?: number;
}

export function useLibraryPresence({
  simulate = true,
  tickMs = 1000,
}: UseLibraryPresenceOptions = {}): LibraryPresence {
  // others와 banked는 한 상태로 묶어, 퇴장 시 시간을 합계에 넘기는 일을 순수하게 처리한다
  // (StrictMode가 업데이터를 두 번 실행해도 이중 계산되지 않도록)
  const [world, setWorld] = useState<{
    others: PresenceStudent[];
    /** 이미 나간 학생들이 남기고 간 기숙사별 시간 */
    banked: HouseSeconds;
    /** 한 번이라도 입장했던 방문자 — 다시 들어오면 0부터 센다 (남기고 간 시간은 banked에 있음) */
    visited: string[];
  }>({ others: INITIAL_OTHERS, banked: zeroHouseSeconds(), visited: [] });
  const { others, banked } = world;
  const [me, setMe] = useState<PresenceStudent | null>(null);
  const [tick, setTick] = useState(0);
  // 시뮬레이션 effect가 내 좌석을 피하도록 최신 값을 ref로 읽는다 (effect 재실행 방지)
  const meRef = useRef(me);
  meRef.current = me;

  useEffect(() => {
    if (!simulate) return;
    const id = window.setInterval(() => setTick((t) => t + 1), tickMs);
    return () => window.clearInterval(id);
  }, [simulate, tickMs]);

  useEffect(() => {
    if (tick === 0) return;
    setWorld((prevWorld) => {
      const prev = prevWorld.others;
      let nextBanked = prevWorld.banked;
      let nextVisited = prevWorld.visited;
      // 1) 집중 중인 학생은 1초씩 누적
      let next = prev.map((s) =>
        s.focusing ? { ...s, focusSeconds: s.focusSeconds + 1 } : s,
      );
      // 2) 7틱마다 한 명씩 집중 ↔ 휴식 전환 (순환, 결정적)
      if (tick % 7 === 0 && next.length > 0) {
        const i = (tick / 7) % next.length;
        next = next.map((s, idx) =>
          idx === i ? { ...s, focusing: !s.focusing } : s,
        );
      }
      // 3) 17틱마다 한 명씩 이론 ↔ 실습 전환 (순환, 결정적)
      if (tick % 17 === 0 && next.length > 0) {
        const i = (tick / 17) % next.length;
        next = next.map((s, idx) =>
          idx === i
            ? { ...s, mode: s.mode === "practice" ? "theory" : "practice" }
            : s,
        );
      }
      // 4) 12틱마다 방문자 입장/퇴장
      if (tick % 12 === 0) {
        const visitor = VISITORS[(tick / 12) % VISITORS.length];
        const present = next.find((s) => s.id === visitor.id);
        if (present) {
          next = next.filter((s) => s.id !== visitor.id);
          // 나가도 오늘 쌓은 시간은 기숙사 합계에 남는다
          nextBanked = {
            ...nextBanked,
            [present.house]: nextBanked[present.house] + present.focusSeconds,
          };
        } else {
          const taken = new Set(next.map((s) => s.seatId));
          if (meRef.current) taken.add(meRef.current.seatId);
          // 빈 자리 중 입구에 가장 가까운 곳 (긴 서고에서 방문자가 멀리 걸어가지 않게)
          const free = SEATS.filter((seat) => !taken.has(seat.id)).reduce<
            LibrarySeat | undefined
          >(
            (best, seat) =>
              !best || seatNearness(seat.id) > seatNearness(best.id)
                ? seat
                : best,
            undefined,
          );
          if (free) {
            const again = nextVisited.includes(visitor.id);
            next = [
              ...next,
              {
                ...visitor,
                seatId: free.id,
                // 다시 들어온 방문자는 0부터 (이전 시간은 banked에 있음)
                focusSeconds: again ? 0 : visitor.focusSeconds,
              },
            ];
            if (!again) nextVisited = [...nextVisited, visitor.id];
          }
        }
      }
      return { others: next, banked: nextBanked, visited: nextVisited };
    });
  }, [tick]);

  const join = useCallback((presence: MyPresence) => {
    setMe({ id: ME_ID, name: ME_NAME, ...presence });
  }, []);

  const update = useCallback((patch: Partial<MyPresence>) => {
    setMe((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const leave = useCallback(() => setMe(null), []);

  const houseTotals = useMemo(() => {
    const totals = { ...banked };
    for (const s of others) totals[s.house] += s.focusSeconds;
    return totals;
  }, [others, banked]);

  return useMemo(
    () => ({
      seats: SEATS,
      others,
      houseTotals,
      onlineCount: others.length + (me ? 1 : 0),
      me,
      join,
      update,
      leave,
    }),
    [others, houseTotals, me, join, update, leave],
  );
}
