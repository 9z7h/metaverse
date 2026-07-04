import { useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { NavigationBar } from "../../ui/NavigationBar";
import { ButtonSmall, ButtonLarge } from "../../ui/Button";
import { PostWriteHeader } from "../../ui/PostWriteHeader";
import { Input } from "../../ui/Input";
import { supabase } from "../../../lib/supabase";
import { useAuthSession } from "../../../hooks/useAuthSession";

const CONTENT_WIDTH = "840px";

const pageStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  width: "100%",
  minHeight: "100vh",
  background: "var(--color-background-default)",
};

const feedStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  width: "100%",
  paddingBlock: "var(--spacing-48)",
};

const postStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  width: CONTENT_WIDTH,
  gap: "var(--spacing-24)",
};

const bodyStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--spacing-40)",
};

const formGroupStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--spacing-20)",
};

/**
 * 문의 폼 화면 (Figma node-id 764:2245, Community/Page 레이아웃 재사용). 기존
 * NavigationBar / ButtonSmall / ButtonLarge / PostWriteHeader / Input을
 * 조합만 하며, 각 컴포넌트 자체는 수정하지 않는다.
 *
 * name/email/message 3개 필드를 입력받아 Supabase `contacts` 테이블에 저장한다.
 */
export function Write() {
  const navigate = useNavigate();
  const { state, user, signOut } = useAuthSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleAuthClick = () => {
    if (state === "login") {
      navigate("/login");
    } else {
      signOut();
    }
  };

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);

    const { error: submitError } = await supabase
      .from("contacts")
      .insert({ name, email, message });

    setSubmitting(false);

    if (submitError) {
      setError(submitError.message);
      return;
    }

    navigate("/");
  };

  return (
    <div style={pageStyle}>
      <NavigationBar
        state={state}
        user={user ?? undefined}
        onAuthClick={handleAuthClick}
      />

      <div style={feedStyle}>
        <div style={postStyle}>
          <ButtonSmall
            type="icon"
            style="outline"
            icon="arrow_left"
            aria-label="뒤로가기"
            radius="var(--radius-circle)"
            onClick={() => navigate(-1)}
          />

          <div style={bodyStyle}>
            <PostWriteHeader width={CONTENT_WIDTH} />

            <div style={formGroupStyle}>
              <Input
                label="이름"
                placeholder="이름을 입력해주세요."
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <Input
                label="이메일"
                type="email"
                placeholder="이메일을 입력해주세요."
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <Input
                label="메시지"
                placeholder="문의 내용을 입력해주세요."
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                error={error ?? undefined}
              />
            </div>

            <ButtonLarge onClick={handleSubmit} disabled={submitting}>
              {submitting ? "등록 중..." : "등록하기"}
            </ButtonLarge>
          </div>
        </div>
      </div>
    </div>
  );
}
