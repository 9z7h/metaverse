import { useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { NavigationBar } from "../../ui/NavigationBar";
import { ButtonSmall } from "../../ui/Button";
import { PostWriteHeader } from "../../ui/PostWriteHeader";
import { DateText } from "../../ui/DateText";
import { ContentInputContainer } from "../../ui/ContentInputContainer";
import { PostCardStats } from "../../ui/PostCardStats";
import { Divider } from "../../ui/Divider";
import { useAuthSession } from "../../../hooks/useAuthSession";

const CONTENT_WIDTH = "840px";

const POST_BODY =
  "안녕하세요, 피그마피디아 운영팀입니다. 커뮤니티가 점점 성장하면서 새롭게 정책을 정비하게 되었습니다. 앞으로 게시글 작성 시 카테고리를 필수로 선택해 주셔야 하며, 홍보성 게시글은 '홍보/공유' 카테고리 외 게시판에 올리실 경우 별도 안내 없이 이동 조치될 수 있습니다. 커뮤니티가 더 건강하게 운영될 수 있도록 멤버 여러분의 협조 부탁드립니다. 문의사항은 운영 DM으로 남겨주세요.";

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

/**
 * 게시글 상세 화면 (Figma node-id 783:3370, Community/View). 기존
 * NavigationBar / ButtonSmall / PostWriteHeader / DateText /
 * ContentInputContainer / PostCardStats / Divider를 조합만 하며, 각 컴포넌트
 * 자체는 수정하지 않는다. 좋아요/북마크는 `PostCardStats`의
 * `onLikeClick`/`showBookmark` prop으로 활성화하고, 클릭 시 로컬 상태를 토글한다.
 */
export function View() {
  const navigate = useNavigate();
  const { state, signOut } = useAuthSession();
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);

  const handleAuthClick = () => {
    if (state === "login") {
      navigate("/login");
    } else {
      signOut();
    }
  };

  return (
    <div style={pageStyle}>
      <NavigationBar state={state} onAuthClick={handleAuthClick} />

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

          <PostWriteHeader
            width={CONTENT_WIDTH}
            title="피그마피디아 짱짱"
            subtitle="피튜"
          />

          <DateText value="26.05.06" />

          <Divider />

          <ContentInputContainer
            state="filled"
            value={POST_BODY}
            imageType={1}
          />

          <PostCardStats
            viewCount="56,654"
            likeCount="99,999"
            liked={liked}
            onLikeClick={() => setLiked((prev) => !prev)}
            showBookmark
            bookmarked={bookmarked}
            onBookmarkClick={() => setBookmarked((prev) => !prev)}
          />
        </div>
      </div>
    </div>
  );
}
