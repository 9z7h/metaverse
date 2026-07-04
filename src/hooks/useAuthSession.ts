import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export type AuthState = "login" | "logout";

export interface AuthUser {
  name: string;
  avatarUrl?: string;
}

/** Google OAuth 등 소셜 로그인 시 `user_metadata`에 담기는 표시용 필드를 뽑아낸다. */
function toAuthUser(session: Session): AuthUser {
  const metadata = session.user.user_metadata as
    | Record<string, unknown>
    | undefined;
  const name =
    (metadata?.full_name as string | undefined) ??
    (metadata?.name as string | undefined) ??
    session.user.email ??
    "사용자";
  const avatarUrl = metadata?.avatar_url as string | undefined;

  return { name, avatarUrl };
}

/**
 * 현재 Supabase 세션을 구독한다. `state`는 NavigationBar의 `state` prop과
 * 1:1로 매핑된다 — 세션이 있으면 "logout"(로그인된 상태, 로그아웃 버튼을 보여줌),
 * 없으면 "login"(로그인 버튼을 보여줌).
 */
export function useAuthSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoaded(true);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
      },
    );

    return () => subscription.subscription.unsubscribe();
  }, []);

  const state: AuthState = session ? "logout" : "login";
  const user: AuthUser | null = session ? toAuthUser(session) : null;

  return {
    session,
    loaded,
    state,
    user,
    signOut: () => supabase.auth.signOut(),
  };
}
