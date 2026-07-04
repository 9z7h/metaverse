-- posts: 커뮤니티 게시글. 로그인한 사용자가 작성하고, 누구나 조회할 수 있다.

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  author_name text not null,
  title text not null,
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.posts enable row level security;

-- 비로그인 포함 누구나 게시글을 조회할 수 있다.
create policy "posts_select_anyone"
  on public.posts for select
  to anon, authenticated
  using (true);

-- 로그인한 본인 명의로만 게시글을 작성할 수 있다.
create policy "posts_insert_own"
  on public.posts for insert
  to authenticated
  with check (auth.uid() = user_id);
