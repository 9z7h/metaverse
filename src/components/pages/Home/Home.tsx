import { Fragment, useEffect, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { NavigationBar } from "../../ui/NavigationBar";
import { PostFilterHeader } from "../../ui/PostFilterHeader";
import { PostCard } from "../../ui/PostCard";
import { Divider } from "../../ui/Divider";
import type { SortTabOption } from "../../ui/SortTab";
import { useAuthSession } from "../../../hooks/useAuthSession";
import { supabase } from "../../../lib/supabase";

const SORT_OPTIONS: SortTabOption[] = [
  { value: "latest", label: "최신글" },
  { value: "popular", label: "인기글" },
];

interface Post {
  id: string;
  title: string;
  content: string;
  author_name: string;
  created_at: string;
}

/** "3시간 전" 형태의 상대 시간 문자열로 변환한다. */
function formatTimeAgo(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diffMs / (1000 * 60));

  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;

  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

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

const emptyStyle: CSSProperties = {
  font: "var(--text-body-lg-regular)",
  color: "var(--color-text-secondary)",
  paddingBlock: "var(--spacing-48)",
  textAlign: "center",
};

/**
 * 커뮤니티 홈 화면 (Figma node-id 2098:567). 기존 NavigationBar / PostFilterHeader /
 * PostCard / Divider를 조합만 하며, 각 컴포넌트 자체는 수정하지 않는다.
 */
export function Home() {
  const navigate = useNavigate();
  const { state, user, signOut } = useAuthSession();
  const [sortValue, setSortValue] = useState(SORT_OPTIONS[0].value);
  const [searchValue, setSearchValue] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("posts")
      .select("id, title, content, author_name, created_at")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setPosts(data ?? []);
        setLoading(false);
      });
  }, []);

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
        user={user ?? undefined}
        onAuthClick={handleAuthClick}
      />

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
          {!loading && posts.length === 0 && (
            <p style={emptyStyle}>아직 게시글이 없습니다.</p>
          )}
          {posts.map((post) => (
            <Fragment key={post.id}>
              <PostCard
                title={post.title}
                preview={post.content}
                timeAgo={formatTimeAgo(post.created_at)}
                chips={[]}
                showThumbnail={false}
              />
              <Divider />
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
