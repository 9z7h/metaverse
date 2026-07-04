import { Fragment, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { NavigationBar } from "../../ui/NavigationBar";
import { PostFilterHeader } from "../../ui/PostFilterHeader";
import { PostCard, type PostCardProps } from "../../ui/PostCard";
import { Divider } from "../../ui/Divider";
import type { SortTabOption } from "../../ui/SortTab";
import { useAuthSession } from "../../../hooks/useAuthSession";

const SORT_OPTIONS: SortTabOption[] = [
  { value: "latest", label: "최신글" },
  { value: "popular", label: "인기글" },
];

const NOTICE_PREVIEW =
  "안녕하세요, 피그마피디아 운영팀입니다. 커뮤니티가 점점 성장하면서 새롭게 정책을 정비하게 되었습니다. 앞으로 게시글 작성 시 카테고리를 필수로 선택해 주셔야 하며, 홍보성 게시글은 '홍보/공유' 카테고리 외 게시판에 올리실 경우 별도 안내 없이 이동 조치될 수 있습니다. 커뮤니티가 더 건강하게 운영될 수 있도록 멤버 여러분의 협조 부탁드립니다. 문의사항은 운영 DM으로 남겨주세요.";

const DESIGN_PREVIEW =
  "피그마피디아(Figmapedia)는 Figma 중심의 디자인 지식, 템플릿, 프로세스, 그리고 AI 기반 워크플로우를 체계적으로 정리•아카이빙하는 크리에이티브 지식 플랫폼입니다.";

const TITLE = "피그마 커뮤니티는 역시 피그마피디아";

/** Figma의 6개 PostCard 데이터 (node-id 2098:567, Community/Home). */
const POSTS: PostCardProps[] = [
  {
    title: TITLE,
    preview: NOTICE_PREVIEW,
    chips: [{ label: "공지사항", variant: "notice", icon: "notification" }],
    thumbnailType: 1,
    timeAgo: "1분 전",
  },
  {
    title: TITLE,
    preview: DESIGN_PREVIEW,
    chips: [{ label: "디자인", variant: "category", icon: "design" }],
    thumbnailType: 2,
    timeAgo: "1분 전",
  },
  {
    title: TITLE,
    preview: NOTICE_PREVIEW,
    chips: [{ label: "공지사항", variant: "notice", icon: "notification" }],
    thumbnailType: 3,
    timeAgo: "1분 전",
  },
  {
    title: TITLE,
    preview: NOTICE_PREVIEW,
    chips: [
      { label: "공지사항", variant: "notice", icon: "notification" },
      { label: "디자인", variant: "category", icon: "design" },
    ],
    thumbnailType: 4,
    timeAgo: "1분 전",
  },
  {
    title: TITLE,
    preview: DESIGN_PREVIEW,
    chips: [{ label: "디자인", variant: "category", icon: "design" }],
    thumbnailType: 5,
    timeAgo: "1분 전",
  },
  {
    title: TITLE,
    preview: DESIGN_PREVIEW,
    chips: [{ label: "디자인", variant: "category", icon: "design" }],
    thumbnailType: 6,
    timeAgo: "1분 전",
  },
];

const CONTENT_WIDTH = "840px";

const pageStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  width: "100%",
  minHeight: "100vh",
  background: "var(--color-background-default)",
};

const contentStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  width: CONTENT_WIDTH,
  gap: "var(--spacing-24)",
  paddingBlock: "var(--spacing-24)",
};

const listStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  width: "100%",
};

/**
 * 커뮤니티 홈 화면 (Figma node-id 2098:567). 기존 NavigationBar / PostFilterHeader /
 * PostCard / Divider를 조합만 하며, 각 컴포넌트 자체는 수정하지 않는다.
 */
export function Home() {
  const navigate = useNavigate();
  const { state, signOut } = useAuthSession();
  const [sortValue, setSortValue] = useState(SORT_OPTIONS[0].value);
  const [searchValue, setSearchValue] = useState("");

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

      <div style={contentStyle}>
        <PostFilterHeader
          width={CONTENT_WIDTH}
          sortOptions={SORT_OPTIONS}
          sortValue={sortValue}
          onSortChange={setSortValue}
          searchValue={searchValue}
          onSearchChange={(event) => setSearchValue(event.target.value)}
          onButtonClick={() => navigate("/write")}
        />

        <div style={listStyle}>
          <Divider />
          {POSTS.map((post, index) => (
            <Fragment key={post.thumbnailType}>
              <PostCard
                {...post}
                onClick={index === 0 ? () => navigate("/view/1") : undefined}
              />
              <Divider />
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
