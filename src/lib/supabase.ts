import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const MISSING_ENV_MESSAGE =
  "VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 환경변수가 설정되지 않았습니다. .env를 확인하세요.";

/** 환경변수가 모두 있으면 true */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/**
 * 환경변수가 없으면 null — 도서관처럼 "연결이 없어도 데모로 동작"해야 하는 곳에서 쓴다.
 */
export const supabaseOrNull: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/**
 * 기존 페이지(Home·Write·Login)가 쓰는 클라이언트.
 * 환경변수가 없으면 import 시점이 아니라 "처음 사용하는 시점"에 에러를 던진다 —
 * 그래서 Supabase가 필요 없는 페이지(/library 데모)는 env 없이도 열린다.
 */
export const supabase: SupabaseClient =
  supabaseOrNull ??
  new Proxy({} as SupabaseClient, {
    get() {
      throw new Error(MISSING_ENV_MESSAGE);
    },
  });
