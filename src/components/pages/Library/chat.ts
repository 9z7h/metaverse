/**
 * 서고의 속삭임(채팅) — 보내고 받는 규칙. React·three에 묶이지 않은 순수 로직(단위 테스트 대상).
 *
 * 글은 서버에 저장하지 않고 Realtime 방송으로만 오간다. 로그인 없는 익명 계정이라
 * 보내는 쪽 값은 전혀 믿을 수 없으므로, 받는 쪽에서 모양·길이·속도를 모두 다시 검사한다.
 * 글은 화면에 항상 "텍스트"로만 그린다 (HTML로 해석되지 않게).
 */
import { isHouseId } from "./houses";
import type { HouseId } from "./houses";

/** 한 번에 보낼 수 있는 글자 수 (코드 포인트 기준) */
export const CHAT_MAX_LEN = 60;
/** 내가 연달아 보낼 수 있는 최소 간격 */
export const CHAT_SEND_INTERVAL_MS = 2000;
/** 받는 쪽: 같은 사람의 글은 이 간격 안에 오면 버린다 */
export const CHAT_RECEIVE_PER_SENDER_MS = 1000;
/** 받는 쪽: 보낸 사람을 바꿔 가며 쏟아내는 것도 막는다 — 이 시간 동안 최대 개수 */
export const CHAT_RECEIVE_BURST = { max: 8, windowMs: 3000 } as const;
/** 대화창에 남기는 최근 글 수 */
export const CHAT_LOG_MAX = 50;
/** 말풍선이 머리 위에 떠 있는 시간 */
export const BUBBLE_MS = 6000;
/** 내 글의 말풍선을 찾는 키 */
export const ME_BUBBLE_KEY = "__me__";

const NAME_MAX = 12;
const SENDER_ID_MAX = 64;

export interface ChatMessage {
  id: string;
  /** 보낸 사람 — 접속자 id와 같다 (말풍선을 그 학생 머리 위에 띄우는 데 쓴다) */
  senderId: string;
  name: string;
  /** 보낸 사람의 기숙사 — 이름 앞 색 점 */
  house: HouseId | null;
  text: string;
  /** 받은(보낸) 시각 ms */
  at: number;
  /** 내가 보낸 글 */
  mine: boolean;
}

// 제어 문자와 보이지 않는 서식 문자(제로폭·방향 제어 등)는 글 모양을 속이는 데 쓰이므로 공백으로 바꾼다
const INVISIBLE = /[\u0000-\u001F\u007F-\u009F​-‏‪-‮⁠-⁯﻿]/g;

/** 글을 한 줄로 정리하고 길이를 자른다. 비었거나 문자열이 아니면 null */
export function normalizeChatText(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const text = raw.replace(INVISIBLE, " ").replace(/\s+/g, " ").trim();
  if (!text) return null;
  // 코드 포인트 단위로 자른다 (이모지가 반으로 쪼개지지 않게)
  return [...text].slice(0, CHAT_MAX_LEN).join("");
}

/** 마지막으로 보낸 뒤 충분히 지났는지 */
export function canSendChat(lastSentAt: number | null, now: number): boolean {
  return lastSentAt === null || now - lastSentAt >= CHAT_SEND_INTERVAL_MS;
}

export interface IncomingChat {
  senderId: string;
  name: string;
  house: HouseId | null;
  text: string;
}

/** 방송으로 받은 값을 검사해서 쓸 수 있는 모양으로. 이상하면 null */
export function parseIncomingChat(raw: unknown): IncomingChat | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const senderId = typeof r.id === "string" ? r.id.trim() : "";
  if (!senderId || senderId.length > SENDER_ID_MAX) return null;
  const text = normalizeChatText(r.text);
  if (!text) return null;
  const name =
    typeof r.name === "string"
      ? [...r.name.replace(INVISIBLE, " ").trim()].slice(0, NAME_MAX).join("")
      : "";
  return {
    senderId,
    name: name || "수련생",
    house: isHouseId(r.house) ? r.house : null,
    text,
  };
}

export interface ReceiveLimiter {
  lastBySender: Map<string, number>;
  recent: number[];
}

export function createReceiveLimiter(): ReceiveLimiter {
  return { lastBySender: new Map(), recent: [] };
}

/**
 * 받은 글을 받아들일지 정한다 (받아들이면 true).
 * 같은 사람이 너무 빨리 보내거나, 보낸 사람을 바꿔 가며 한꺼번에 쏟아내면 버린다.
 */
export function acceptIncoming(
  limiter: ReceiveLimiter,
  senderId: string,
  now: number,
): boolean {
  const last = limiter.lastBySender.get(senderId);
  if (last !== undefined && now - last < CHAT_RECEIVE_PER_SENDER_MS) {
    return false;
  }
  limiter.recent = limiter.recent.filter(
    (t) => now - t < CHAT_RECEIVE_BURST.windowMs,
  );
  if (limiter.recent.length >= CHAT_RECEIVE_BURST.max) return false;
  limiter.lastBySender.set(senderId, now);
  limiter.recent.push(now);
  // 보낸 사람 기록이 끝없이 늘지 않게 오래된 것은 정리
  if (limiter.lastBySender.size > 200) {
    for (const [id, t] of limiter.lastBySender) {
      if (now - t > 60_000) limiter.lastBySender.delete(id);
    }
  }
  return true;
}

/** 최근 `CHAT_LOG_MAX`개만 남기며 글을 더한다 */
export function appendChat(
  log: ChatMessage[],
  message: ChatMessage,
): ChatMessage[] {
  return [...log, message].slice(-CHAT_LOG_MAX);
}

let seq = 0;
/** 글 하나를 만든다 (id는 목록에서 key로 쓰는 고유 값) */
export function makeChatMessage(
  input: IncomingChat & { at: number; mine: boolean },
): ChatMessage {
  return { ...input, id: `${input.at}-${seq++}` };
}

/**
 * 지금 말풍선으로 보여 줄 글 — 보낸 사람마다 가장 최근 글 하나, `ms` 안에 온 것만.
 * 내 글은 `ME_BUBBLE_KEY`로 찾는다 (걷는 중에는 내 접속자 id가 없을 수 있다).
 */
export function activeBubbles(
  log: ChatMessage[],
  now: number,
  ms = BUBBLE_MS,
): Map<string, ChatMessage> {
  const out = new Map<string, ChatMessage>();
  for (const m of log) {
    if (now - m.at >= ms) continue;
    out.set(m.mine ? ME_BUBBLE_KEY : m.senderId, m);
  }
  return out;
}

/**
 * 대화창이 닫혀 있는 동안 '안 읽은 새 글'이 있는지 — 내 글이 아닌 마지막 글을 아직 못 봤을 때.
 * `seenId`는 대화창을 마지막으로 열었을 때 본 마지막 글의 id.
 */
export function hasUnreadChat(
  log: ChatMessage[],
  seenId: string | null,
  opts: { open: boolean; enabled: boolean },
): boolean {
  if (opts.open || !opts.enabled) return false;
  const last = log[log.length - 1];
  return last !== undefined && !last.mine && last.id !== seenId;
}

/**
 * 글자를 입력하는 칸(입력창·글상자·선택 상자·편집 가능 요소)에서 일어난 키 이벤트인지.
 * 3D 장면의 이동·앉기 키(W·A·S·D·E)가 대화창에서 글자를 치는 것과 섞이지 않게 거를 때 쓴다.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    target.closest("input, textarea, select, [contenteditable='true']") !== null
  );
}
