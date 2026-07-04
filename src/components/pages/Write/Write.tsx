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

const contentLabelStyle: CSSProperties = {
  font: "var(--text-body-sm-bold)",
  color: "var(--color-text-primary)",
};

const contentFieldStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--spacing-4)",
};

/**
 * 디자인 시스템에 여러 줄 입력용 컴포넌트가 없어(Input은 한 줄 전용,
 * ContentInputContainer는 표시 전용), Input과 동일한 토큰으로 스타일링한
 * 네이티브 textarea를 이 페이지에서만 로컬로 사용한다.
 */
const contentTextareaStyle: CSSProperties = {
  boxSizing: "border-box",
  width: "100%",
  minHeight: "200px",
  padding: "var(--spacing-12) var(--spacing-16)",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--color-border-default)",
  background: "var(--color-background-default)",
  font: "var(--text-body-lg-regular)",
  color: "var(--color-text-primary)",
  resize: "vertical",
};

const loginRequiredStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "var(--spacing-16)",
};

const loginRequiredTextStyle: CSSProperties = {
  font: "var(--text-body-lg-regular)",
  color: "var(--color-text-secondary)",
};

/**
 * 게시글 작성 화면 (Figma node-id 764:2245, Community/Page 레이아웃 재사용). 기존
 * NavigationBar / ButtonSmall / ButtonLarge / PostWriteHeader / Input을
 * 조합만 하며, 각 컴포넌트 자체는 수정하지 않는다.
 *
 * 제목/내용을 입력받아 Supabase `posts` 테이블에 저장한다. 로그인한 사용자만
 * 작성할 수 있다 (RLS: `auth.uid() = user_id`).
 */
export function Write() {
  const navigate = useNavigate();
  const { state, session, user, signOut } = useAuthSession();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
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
    if (!session || !user) return;

    setError(null);
    setSubmitting(true);

    const { error: submitError } = await supabase.from("posts").insert({
      user_id: session.user.id,
      author_name: user.name,
      title,
      content,
    });

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

            {state === "login" ? (
              <div style={loginRequiredStyle}>
                <p style={loginRequiredTextStyle}>
                  게시글을 작성하려면 로그인이 필요합니다.
                </p>
                <ButtonLarge onClick={() => navigate("/login")}>
                  로그인하러 가기
                </ButtonLarge>
              </div>
            ) : (
              <>
                <div style={formGroupStyle}>
                  <Input
                    label="제목"
                    placeholder="제목을 입력해주세요."
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                  />
                  <div style={contentFieldStyle}>
                    <label htmlFor="post-content" style={contentLabelStyle}>
                      내용
                    </label>
                    <textarea
                      id="post-content"
                      placeholder="게시글 내용을 입력해주세요."
                      value={content}
                      onChange={(event) => setContent(event.target.value)}
                      style={contentTextareaStyle}
                    />
                    {error && (
                      <span
                        role="alert"
                        style={{ color: "var(--color-text-Danger)" }}
                      >
                        {error}
                      </span>
                    )}
                  </div>
                </div>

                <ButtonLarge onClick={handleSubmit} disabled={submitting}>
                  {submitting ? "등록 중..." : "등록하기"}
                </ButtonLarge>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
