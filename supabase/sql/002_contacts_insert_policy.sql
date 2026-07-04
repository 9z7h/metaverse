-- contacts: 누구나(비로그인 포함) 문의를 남길 수 있도록 INSERT를 허용한다.
-- 조회/수정/삭제는 별도 정책이 없으므로 계속 차단된 상태로 남는다.

alter table public.contacts enable row level security;

create policy "contacts_insert_anyone"
  on public.contacts for insert
  to anon, authenticated
  with check (true);
