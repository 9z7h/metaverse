import { Fragment, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { NavigationBar } from "../../ui/NavigationBar";
import { PostFilterHeader } from "../../ui/PostFilterHeader";
import { PostCard, type PostCardProps } from "../../ui/PostCard";
import { Divider } from "../../ui/Divider";
import type { SortTabOption } from "../../ui/SortTab";
import { useAuthSession } from "../../../hooks/useAuthSession";

const SORT_OPTIONS: SortTabOption[] = [
  { value: "popular", label: "추천순" },
  { value: "latest", label: "최신순" },
];

const POSTS: PostCardProps[] = [
  {
    title: "Auto Layout 완벽 가이드",
    preview:
      "Auto Layout의 핵심 개념부터 실전 활용까지. Fill, Hug, Fixed의 차이를 예제와 함께 정리했습니다.",
    chips: [{ label: "튜토리얼", variant: "notice", icon: "pencil" }],
    thumbnailType: 1,
    timeAgo: "2시간 전",
  },
  {
    title: "디자인 토큰, 왜 써야 할까?",
    preview:
      "색상, 간격, 타이포 — 왜 하드코딩하면 안 되는지, 토큰으로 관리하면 뭐가 좋은지 실무 관점에서 정리합니다",
    chips: [{ label: "리소스", variant: "category", icon: "design" }],
    thumbnailType: 2,
    timeAgo: "5시간 전",
  },
  {
    title: "Figma Variables로 다크모드 만들기",
    preview:
      "Variables 기능으로 라이트/다크 모드를 한 파일에서 관리하는 방법. 컬렉션 구조 설계부터 적용까지.",
    chips: [
      { label: "튜토리얼", variant: "notice", icon: "pencil" },
      { label: "AI", variant: "category", icon: "ai" },
    ],
    thumbnailType: 3,
    timeAgo: "1일 전",
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
 * Home 베리에이션 — "디자인 팁" 카테고리 화면 (화면정의서 기준).
 * 기존 NavigationBar / PostFilterHeader / PostCard / Divider를 조합만 하며,
 * 각 컴포넌트 자체는 수정하지 않는다.
 */
export function HomeDesign() {
  const navigate = useNavigate();
  const { state, user, signOut } = useAuthSession();
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
      <NavigationBar
        state={state}
        category="디자인 팁"
        user={user ?? undefined}
        onAuthClick={handleAuthClick}
      />

      <div style={contentStyle}>
        <PostFilterHeader
          title="실시간 게시글"
          width={CONTENT_WIDTH}
          sortOptions={SORT_OPTIONS}
          sortValue={sortValue}
          onSortChange={setSortValue}
          searchValue={searchValue}
          onSearchChange={(event) => setSearchValue(event.target.value)}
        />

        <div style={listStyle}>
          <Divider />
          {POSTS.map((post) => (
            <Fragment key={post.thumbnailType}>
              <PostCard {...post} />
              <Divider />
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
