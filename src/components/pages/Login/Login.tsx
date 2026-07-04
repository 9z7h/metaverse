import { useState } from "react";
import type { CSSProperties } from "react";
import { Logo } from "../../ui/Logo";
import { TitleInput } from "../../ui/TitleInput";
import { ButtonLarge } from "../../ui/Button";
import { LoginGoogle } from "../../ui/LoginGoogle";
import { LoginBottom } from "../../ui/LoginBottom";
import { supabase } from "../../../lib/supabase";

const CARD_WIDTH = "720px";
const INPUTLIST_WIDTH = "320px";

const pageStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "center",
  width: "100%",
  minHeight: "100vh",
  // ⚠️ 토큰 외 값(200px): Figma 프레임(781:4699)의 상하 패딩. 대응 spacing 토큰 없음.
  paddingBlock: "200px",
  background: "var(--color-background-Subtle)",
};

const cardStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "var(--spacing-32)",
  width: CARD_WIDTH,
  // ⚠️ 토큰 외 값(90px/160px): Figma 프레임(781:4701 "section")의 카드 패딩. 대응 spacing 토큰 없음.
  paddingBlock: "90px",
  paddingInline: "160px",
  borderRadius: "var(--radius-2xl)",
  background: "var(--color-background-default)",
};

const inputListStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "var(--spacing-16)",
  width: "100%",
  maxWidth: INPUTLIST_WIDTH,
};

const bodyStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "var(--spacing-8)",
  width: "100%",
};

const loginAreaStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "var(--spacing-16)",
  width: "100%",
};

const oauthErrorStyle: CSSProperties = {
  font: "var(--text-caption-lg-medium)",
  color: "var(--color-text-Danger)",
};

/**
 * 커뮤니티 로그인 화면 (Figma node-id 781:4699, Community/Login).
 * 기존 Logo / TitleInput / ButtonLarge / LoginGoogle / LoginBottom을 조합만 하며,
 * 각 컴포넌트 자체는 수정하지 않는다.
 *
 * TitleInput은 Figma를 그대로 미러링하는 표시 전용 컴포넌트(실제 입력값 상태 없음)라
 * 이메일/비밀번호 폼 제출 로직은 이 작업 범위 밖이며, 구글 로그인만 Supabase OAuth에 연결한다.
 */
export function Login() {
  const [oauthError, setOauthError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setOauthError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      setOauthError(error.message);
    }
  };

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <Logo title="FigmaPedia" />

        <div style={inputListStyle}>
          <div style={bodyStyle}>
            <div style={loginAreaStyle}>
              <TitleInput
                label="이메일"
                headline="이메일을 입력해주세요"
                helptext={false}
                icon={false}
              />
              <TitleInput
                label="비밀번호"
                headline="비밀번호를 입력해주세요"
                iconName="eye-off"
              />
            </div>

            <ButtonLarge className="login-page__submit">로그인</ButtonLarge>
            <style>{`.login-page__submit { width: 100%; }`}</style>

            <LoginGoogle onClick={handleGoogleLogin} />
            {oauthError && <span style={oauthErrorStyle}>{oauthError}</span>}
          </div>

          <LoginBottom />
        </div>
      </div>
    </div>
  );
}
