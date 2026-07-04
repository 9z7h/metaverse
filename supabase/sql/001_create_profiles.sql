-- profiles: auth.users와 1:1로 연결되는 공개 프로필 테이블
-- auth.users는 Supabase 시스템 테이블이라 클라이언트에서 직접 다루기 어려워 별도 테이블로 미러링한다.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  last_sign_in_at timestamptz
);

alter table public.profiles enable row level security;

-- 본인 프로필만 조회 가능
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

-- 본인 프로필만 수정 가능 (id, email, created_at은 애플리케이션에서 직접 수정할 일이 없음)
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

-- 회원가입 시 auth.users에 새 행이 생기면 profiles에도 동일한 id/email로 행을 생성한다.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, created_at)
  values (new.id, new.email, new.created_at);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 로그인 시 auth.users.last_sign_in_at이 갱신되면 profiles에도 반영한다.
create function public.handle_user_sign_in()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.profiles
  set last_sign_in_at = new.last_sign_in_at
  where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_sign_in
  after update of last_sign_in_at on auth.users
  for each row execute function public.handle_user_sign_in();
