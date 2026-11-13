-- 사신학당(장서각) — 내 지난 수련 시간 합계 (주문 해금용)
--
-- 실행 대상: 004_academy.sql 을 실행한 같은 Supabase 프로젝트의 SQL Editor.
--
-- 주문 일부는 누적 수련 시간이 차야 풀린다. 오늘 시간은 클라이언트 타이머가 가장 정확하므로
-- 여기서는 "오늘 이전" 날짜의 합계만 돌려주고, 화면에서 오늘 시간을 더한다.
-- 본인(auth.uid()) 기록만 읽으며, 경쟁·순위에는 쓰지 않는다.

create or replace function public.academy_my_past_seconds()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(f.seconds), 0)::bigint
  from public.academy_focus f
  where f.student_id = auth.uid()
    and f.day < public.academy_today()
$$;

revoke all on function public.academy_my_past_seconds() from public, anon;
grant execute on function public.academy_my_past_seconds() to authenticated;
