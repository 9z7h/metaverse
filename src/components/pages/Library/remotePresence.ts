/**
 * 도서관 실시간 접속(presence) — Supabase Realtime Presence 구현.
 * `useLibraryPresence`(목업)와 같은 `LibraryPresence` 인터페이스를 돌려주므로 화면은 그대로다.
 *
 *  - join / update / leave → channel.track(payload) / channel.untrack()
 *  - others                → presence "sync" 이벤트의 상태 (나 제외)
 *  - houseTotals           → 서버 RPC(academy_house_totals)를 주기적으로 조회
 *
 * 다른 클라이언트가 보낸 payload는 신뢰하지 않고 모양·범위를 검증해서 쓴다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isHouseId } from "./houses";
import type { HouseId } from "./houses";
import {
  acceptIncoming,
  appendChat,
  canSendChat,
  createReceiveLimiter,
  makeChatMessage,
  normalizeChatText,
  parseIncomingChat,
} from "./chat";
import type { ChatMessage } from "./chat";
import { zeroHouseSeconds } from "./houseRankingLogic";
import type { HouseSeconds } from "./houseRankingLogic";
import { SEATS } from "./libraryPresence";
import type {
  LibraryPresence,
  MyPresence,
  PresenceStudent,
  RemoteMove,
  StudyMode,
  Walker,
} from "./libraryPresence";
import { ROOM } from "./scene/sceneLayout";
import type { AcademyApi } from "./academyApi";

const CHANNEL = "academy:library";
/** 앉지 않은 사람까지 세는 접속자 전용 채널 */
const LOBBY_CHANNEL = "academy:lobby";
/** 같은 사람이 보낸 위치를 이보다 자주 받으면 버린다 (보내는 쪽은 약 300ms 간격) */
const MIN_MOVE_GAP_MS = 120;
/** 서고 밖으로 나간 값은 모양이 이상한 것으로 보고 서고 안으로 붙인다 */
const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));
const TOTALS_POLL_MS = 15_000;
const DAY_SECONDS = 86_400;

/** 채널로 오가는 내 상태 (id는 presence key로 대신한다) */
export type PresencePayload = Omit<PresenceStudent, "id">;

const SEAT_IDS = new Set(SEATS.map((s) => s.id));

const isMode = (v: unknown): v is StudyMode =>
  v === "theory" || v === "practice";

/** 상대가 보낸 payload를 검증해서 학생으로. 이상하면 null */
export function parsePayload(id: string, raw: unknown): PresenceStudent | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.seatId !== "string" || !SEAT_IDS.has(r.seatId)) return null;
  if (!isHouseId(r.house) || !isMode(r.mode)) return null;
  const seconds = Number(r.focusSeconds);
  return {
    id,
    name:
      typeof r.name === "string" && r.name.trim()
        ? r.name.trim().slice(0, 12)
        : "수련생",
    subject: typeof r.subject === "string" ? r.subject.trim().slice(0, 20) : "",
    seatId: r.seatId,
    focusing: r.focusing === true,
    focusSeconds: Number.isFinite(seconds)
      ? Math.min(DAY_SECONDS, Math.max(0, Math.floor(seconds)))
      : 0,
    house: r.house,
    mode: r.mode,
  };
}

/** presence 상태에서 나를 뺀 접속자 목록. 같은 자리를 둘이 주장하면 먼저 온 쪽만 */
export function parseOthers(
  state: Record<string, unknown[]>,
  selfId: string | null,
): PresenceStudent[] {
  const taken = new Set<string>();
  const out: PresenceStudent[] = [];
  for (const [key, metas] of Object.entries(state)) {
    if (key === selfId || !Array.isArray(metas) || metas.length === 0) continue;
    // 한 사용자가 탭을 여러 개 열면 가장 최근 상태를 쓴다
    const student = parsePayload(key, metas[metas.length - 1]);
    if (!student || taken.has(student.seatId)) continue;
    taken.add(student.seatId);
    out.push(student);
  }
  return out;
}

/** 로비에 올린 이름·기숙사. 기숙사가 아직 없거나 이상하면 null (접속자 수에는 센다) */
export function parseMember(raw: unknown): Omit<Walker, "id"> | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (!isHouseId(r.house)) return null;
  return {
    name:
      typeof r.name === "string" && r.name.trim()
        ? r.name.trim().slice(0, 12)
        : "수련생",
    house: r.house,
  };
}

/** 상대가 방송한 위치를 검증해서 서고 안의 좌표로. 이상하면 null */
export function parseMove(
  raw: unknown,
): (Omit<RemoteMove, "at"> & { senderId: string }) | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || r.id.length === 0 || r.id.length > 64) {
    return null;
  }
  const x = Number(r.x);
  const z = Number(r.z);
  const ry = Number(r.ry);
  if (![x, z, ry].every(Number.isFinite)) return null;
  return {
    senderId: r.id,
    x: clamp(x, ROOM.minX, ROOM.maxX),
    z: clamp(z, ROOM.minZ, ROOM.maxZ),
    ry: clamp(ry, -Math.PI * 4, Math.PI * 4),
    moving: r.moving === true,
  };
}

/** 로비 presence 상태에서 앉지 않은 접속자 — 나와 이미 앉은 사람은 뺀다 */
export function parseWalkers(
  state: Record<string, unknown[]>,
  selfId: string | null,
  seatedIds: ReadonlySet<string>,
): Walker[] {
  const out: Walker[] = [];
  for (const [key, metas] of Object.entries(state)) {
    if (key === selfId || seatedIds.has(key)) continue;
    if (!Array.isArray(metas) || metas.length === 0) continue;
    const member = parseMember(metas[metas.length - 1]);
    if (member) out.push({ id: key, ...member });
  }
  return out;
}

/** 로비 presence 상태에서 접속자 수. 나는 항상 포함하고, 같은 사용자의 여러 탭은 한 명으로 */
export function countConnected(
  state: Record<string, unknown[]>,
  selfId: string | null,
): number {
  const keys = new Set(
    Object.entries(state)
      .filter(([, metas]) => Array.isArray(metas) && metas.length > 0)
      .map(([key]) => key),
  );
  if (selfId) keys.add(selfId);
  return keys.size;
}

export interface UseRemotePresenceOptions {
  /** null이면 아무것도 하지 않는다 (연결 전·데모 모드) */
  client: SupabaseClient | null;
  /** null이면 아무것도 하지 않는다 (아직 로그인 중) */
  api: AcademyApi | null;
  /** 서버가 정해 준 닉네임 */
  nickname: string;
  /** 내 기숙사 — 걸어 다니는 모습의 로브 색. 배정 전이면 null */
  house?: HouseId | null;
}

export function useRemotePresence({
  client,
  api,
  nickname,
  house = null,
}: UseRemotePresenceOptions): LibraryPresence {
  const userId = api?.userId ?? null;
  const [others, setOthers] = useState<PresenceStudent[]>([]);
  const [totals, setTotals] = useState<HouseSeconds>(zeroHouseSeconds);
  const [me, setMe] = useState<PresenceStudent | null>(null);
  const [ready, setReady] = useState(false);
  const [lobbyState, setLobbyState] = useState<Record<string, unknown[]>>({});
  const [lobbyReady, setLobbyReady] = useState(false);
  const moves = useRef(new Map<string, RemoteMove>());
  const lastMoveAt = useRef(new Map<string, number>());
  const lobbyRef = useRef<ReturnType<SupabaseClient["channel"]> | null>(null);
  const [chatLog, setChatLog] = useState<ChatMessage[]>([]);
  const receiveLimiter = useRef(createReceiveLimiter());
  const lastSentAt = useRef<number | null>(null);
  const channelRef = useRef<ReturnType<SupabaseClient["channel"]> | null>(null);

  // 채널 구독 — 접속 중인 학생들의 상태를 받는다
  useEffect(() => {
    if (!client || !userId) return;
    const channel = client.channel(CHANNEL, {
      config: { presence: { key: userId } },
    });
    channelRef.current = channel;
    channel.on("presence", { event: "sync" }, () => {
      setOthers(
        parseOthers(
          channel.presenceState() as Record<string, unknown[]>,
          userId,
        ),
      );
    });
    // 서고의 속삭임 — 저장하지 않는 방송. 받은 값은 모양·길이·속도를 모두 다시 검사한다
    channel.on("broadcast", { event: "chat" }, ({ payload }) => {
      const incoming = parseIncomingChat(payload);
      if (!incoming || incoming.senderId === userId) return;
      const now = Date.now();
      if (!acceptIncoming(receiveLimiter.current, incoming.senderId, now)) {
        return;
      }
      setChatLog((log) =>
        appendChat(log, makeChatMessage({ ...incoming, at: now, mine: false })),
      );
    });
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") setReady(true);
    });
    return () => {
      setReady(false);
      channelRef.current = null;
      void client.removeChannel(channel);
    };
  }, [client, userId]);

  // 접속 중인 사람 — 자리에 앉지 않아도 사이트를 여는 순간부터 센다.
  // 이름·기숙사는 presence로, 걸어 다니는 위치는 broadcast로 나눈다
  // (위치를 presence로 보내면 바뀔 때마다 모두에게 전체 상태가 다시 간다).
  useEffect(() => {
    if (!client || !userId) return;
    const lobby = client.channel(LOBBY_CHANNEL, {
      config: { presence: { key: userId } },
    });
    lobbyRef.current = lobby;
    lobby.on("presence", { event: "sync" }, () => {
      const state = lobby.presenceState() as Record<string, unknown[]>;
      setLobbyState(state);
      // 나간 사람의 위치는 버린다
      for (const id of [...moves.current.keys()]) {
        if (!(id in state)) {
          moves.current.delete(id);
          lastMoveAt.current.delete(id);
        }
      }
    });
    lobby.on("broadcast", { event: "move" }, ({ payload }) => {
      const move = parseMove(payload);
      if (!move || move.senderId === userId) return;
      const now = Date.now();
      const last = lastMoveAt.current.get(move.senderId) ?? 0;
      if (now - last < MIN_MOVE_GAP_MS) return;
      lastMoveAt.current.set(move.senderId, now);
      const { senderId, ...rest } = move;
      moves.current.set(senderId, { ...rest, at: now });
    });
    lobby.subscribe((status) => {
      if (status === "SUBSCRIBED") setLobbyReady(true);
    });
    return () => {
      setLobbyReady(false);
      lobbyRef.current = null;
      moves.current.clear();
      lastMoveAt.current.clear();
      void client.removeChannel(lobby);
    };
  }, [client, userId]);

  // 이름·기숙사가 정해지거나 바뀌면 로비에 다시 알린다
  useEffect(() => {
    const lobby = lobbyRef.current;
    if (!lobbyReady || !lobby) return;
    void lobby.track({ name: nickname, house });
  }, [lobbyReady, nickname, house]);

  // 내 상태가 바뀔 때마다 알린다 (앉으면 track, 일어서면 untrack)
  useEffect(() => {
    const channel = channelRef.current;
    if (!ready || !channel) return;
    if (me) {
      const { id: _id, ...payload } = me;
      void channel.track(payload satisfies PresencePayload);
    } else {
      void channel.untrack();
    }
  }, [ready, me]);

  // 기숙사별 합계 — 주기적으로 서버에서 가져온다 (탭이 숨겨져 있으면 쉼)
  useEffect(() => {
    if (!api) return;
    let cancelled = false;
    const load = () => {
      if (document.hidden) return;
      api
        .houseTotals()
        .then((t) => {
          if (!cancelled) setTotals(t);
        })
        .catch(() => {
          /* 네트워크 오류 — 직전 값을 유지하고 다음 주기에 다시 */
        });
    };
    load();
    const id = window.setInterval(load, TOTALS_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [api]);

  const join = useCallback(
    (presence: MyPresence) => {
      if (!userId) return;
      setMe({ id: userId, name: nickname, ...presence });
    },
    [userId, nickname],
  );
  const update = useCallback((patch: Partial<MyPresence>) => {
    setMe((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);
  const leave = useCallback(() => setMe(null), []);

  const sendChat = useCallback(
    (text: string, house: HouseId) => {
      const channel = channelRef.current;
      const clean = normalizeChatText(text);
      const now = Date.now();
      if (!channel || !ready || !userId || !clean) return false;
      if (!canSendChat(lastSentAt.current, now)) return false;
      lastSentAt.current = now;
      void channel.send({
        type: "broadcast",
        event: "chat",
        payload: { id: userId, name: nickname, house, text: clean },
      });
      // 내 글은 방송으로 돌아오지 않으므로 바로 내 대화창에 더한다
      setChatLog((log) =>
        appendChat(
          log,
          makeChatMessage({
            senderId: userId,
            name: nickname,
            house,
            text: clean,
            at: now,
            mine: true,
          }),
        ),
      );
      return true;
    },
    [ready, userId, nickname],
  );

  const connectedCount = useMemo(
    () => countConnected(lobbyState, userId),
    [lobbyState, userId],
  );
  const walkers = useMemo(
    () => parseWalkers(lobbyState, userId, new Set(others.map((o) => o.id))),
    [lobbyState, userId, others],
  );

  const sendMove = useCallback(
    (x: number, z: number, ry: number, moving: boolean) => {
      const lobby = lobbyRef.current;
      if (!lobby || !lobbyReady || !userId) return;
      const round = (v: number) => Math.round(v * 100) / 100;
      void lobby.send({
        type: "broadcast",
        event: "move",
        payload: {
          id: userId,
          x: round(x),
          z: round(z),
          ry: round(ry),
          moving,
        },
      });
    },
    [lobbyReady, userId],
  );

  return useMemo(
    () => ({
      seats: SEATS,
      others,
      houseTotals: totals,
      onlineCount: others.length + (me ? 1 : 0),
      connectedCount,
      walkers,
      moves,
      sendMove,
      me,
      join,
      update,
      leave,
      chat: { messages: chatLog, send: sendChat },
    }),
    [
      others,
      totals,
      me,
      connectedCount,
      walkers,
      sendMove,
      join,
      update,
      leave,
      chatLog,
      sendChat,
    ],
  );
}
