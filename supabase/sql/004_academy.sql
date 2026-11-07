-- 사신학당(장서각) — 기숙사 배정 · 하루 1회 재배정 · 기숙사 집중시간 랭킹
--
-- 실행 대상: **사신학당용 새 Supabase 프로젝트**의 SQL Editor.
-- ⚠ 001_create_profiles.sql 은 같은 프로젝트에서 실행하지 마세요.
--    그 파일의 on_auth_user_created 트리거가 `email not null` 이라서,
--    이메일이 없는 익명 로그인(Anonymous sign-in)이 실패합니다.
--
-- 사전 설정: Authentication → Providers → "Anonymous sign-ins" 켜기
--
-- 보안 모델
--  - 두 테이블 모두 RLS를 켜고 정책을 만들지 않는다 → 클라이언트의 직접 읽기·쓰기는 전부 거부.
--  - 모든 접근은 아래 security definer 함수(RPC)로만 하며, 함수 안에서 auth.uid()로 본인만 다룬다.
--  - 기숙사는 서버가 정한다 (클라이언트가 고를 수 없음). 재배정은 서버 날짜 기준 하루 1회.
--  - "하루"는 한국 시간(Asia/Seoul) 기준.

create table if not exists public.academy_students (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 12),
  house text not null check (house in ('baekho', 'jujak', 'hyeonmu', 'cheongryong')),
  -- 이 기숙사로 배정된 날 — 그날의 기숙사별 인원을 셀 때 쓴다
  house_day date not null,
  -- 마지막으로 다시 배정한 날 (하루 1회 제한)
  reroll_day date,
  created_at timestamptz not null default now()
);

create table if not exists public.academy_focus (
  student_id uuid not null references public.academy_students (id) on delete cascade,
  day date not null,
  seconds integer not null default 0 check (seconds >= 0 and seconds <= 86400),
  updated_at timestamptz not null default now(),
  primary key (student_id, day)
);

alter table public.academy_students enable row level security;
alter table public.academy_focus enable row level security;

-- 한국 시간 기준 오늘
create or replace function public.academy_today()
returns date
language sql
stable
as $$
  select (now() at time zone 'Asia/Seoul')::date
$$;

-- 오늘 배정 인원이 가장 적은 기숙사 중 무작위로 하나.
-- p_exclude: 제외할 기숙사(다시 배정할 때 지금 기숙사), p_skip: 인원 계산에서 뺄 학생(본인)
create or replace function public.academy_pick_house(p_exclude text, p_skip uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select h.id
  from (values ('baekho'), ('jujak'), ('hyeonmu'), ('cheongryong')) as h(id)
  left join public.academy_students s
    on s.house = h.id
   and s.house_day = public.academy_today()
   and s.id is distinct from p_skip
  where h.id is distinct from p_exclude
  group by h.id
  order by count(s.id), random()
  limit 1
$$;

create or replace function public.academy_student_json(s public.academy_students)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'house', s.house,
    'nickname', s.nickname,
    'rerollDay', s.reroll_day,
    'today', public.academy_today()
  )
$$;

-- 내 학생 정보 (아직 입학 전이면 null)
create or replace function public.academy_me()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  stu public.academy_students;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  select * into stu from public.academy_students where id = auth.uid();
  if not found then
    return null;
  end if;
  return public.academy_student_json(stu);
end;
$$;

-- 입학: 이미 있으면 그대로 돌려주고, 없으면 인원이 가장 적은 기숙사에 배정
create or replace function public.academy_join()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  stu public.academy_students;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  -- 동시 입학 때 같은 기숙사로 몰리지 않도록 배정을 한 줄로 세운다
  perform pg_advisory_xact_lock(hashtext('academy_assign'));

  select * into stu from public.academy_students where id = uid;
  if not found then
    insert into public.academy_students (id, nickname, house, house_day)
    values (
      uid,
      '수련생' || lpad((floor(random() * 1000))::int::text, 3, '0'),
      public.academy_pick_house(null, uid),
      public.academy_today()
    )
    returning * into stu;
  end if;
  return public.academy_student_json(stu);
end;
$$;

-- 다시 배정: 하루 1회, 지금 기숙사는 제외
create or replace function public.academy_reroll()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  stu public.academy_students;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  perform pg_advisory_xact_lock(hashtext('academy_assign'));

  select * into stu from public.academy_students where id = uid for update;
  if not found then
    raise exception 'not_joined';
  end if;
  if stu.reroll_day = public.academy_today() then
    raise exception 'already_rerolled';
  end if;

  update public.academy_students
     set house = public.academy_pick_house(stu.house, uid),
         house_day = public.academy_today(),
         reroll_day = public.academy_today()
   where id = uid
   returning * into stu;
  return public.academy_student_json(stu);
end;
$$;

-- 오늘 누적 집중 시간 보고 (클라이언트가 보내는 값이라 상한을 둔다)
--  - 줄어들지 않는다 (greatest)
--  - 마지막 보고 이후 흐른 실제 시간만큼만 늘 수 있다
--  - 오늘 첫 보고는 자정(한국 시간) 이후 흐른 시간까지만 인정
create or replace function public.academy_report_focus(p_total integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  today date := public.academy_today();
  prev public.academy_focus;
  cap integer;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_total is null or p_total < 0 then
    return;
  end if;

  select * into prev from public.academy_focus where student_id = uid and day = today;
  if found then
    cap := prev.seconds + ceil(extract(epoch from (now() - prev.updated_at)))::int + 2;
  else
    cap := least(
      86400,
      ceil(extract(epoch from (now() - (today::timestamp at time zone 'Asia/Seoul'))))::int
    );
  end if;

  insert into public.academy_focus (student_id, day, seconds, updated_at)
  values (uid, today, least(p_total, cap), now())
  on conflict (student_id, day) do update
    set seconds = greatest(public.academy_focus.seconds, least(p_total, cap)),
        updated_at = now();
end;
$$;

-- 기숙사별 오늘 집중 시간 합계 — 나를 제외한 모든 학생(이미 나간 학생 포함).
-- 내 시간은 클라이언트의 타이머가 가장 정확해서 화면에서 따로 더한다.
create or replace function public.academy_house_totals()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_object_agg(h.id, coalesce(t.total, 0))
  from (values ('baekho'), ('jujak'), ('hyeonmu'), ('cheongryong')) as h(id)
  left join (
    select s.house, sum(f.seconds)::bigint as total
    from public.academy_focus f
    join public.academy_students s on s.id = f.student_id
    where f.day = public.academy_today()
      and f.student_id is distinct from auth.uid()
    group by s.house
  ) t on t.house = h.id
$$;

-- 로그인한 사용자(익명 포함)만 실행. 비로그인(anon 역할)·PUBLIC은 막는다.
revoke all on function public.academy_pick_house(text, uuid) from public, anon, authenticated;
revoke all on function public.academy_me() from public, anon;
revoke all on function public.academy_join() from public, anon;
revoke all on function public.academy_reroll() from public, anon;
revoke all on function public.academy_report_focus(integer) from public, anon;
revoke all on function public.academy_house_totals() from public, anon;
grant execute on function public.academy_me() to authenticated;
grant execute on function public.academy_join() to authenticated;
grant execute on function public.academy_reroll() to authenticated;
grant execute on function public.academy_report_focus(integer) to authenticated;
grant execute on function public.academy_house_totals() to authenticated;
