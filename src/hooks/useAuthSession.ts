import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export type AuthState = "login" | "logout";

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

  return {
    session,
    loaded,
    state,
    signOut: () => supabase.auth.signOut(),
  };
}
