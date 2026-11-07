# 사신학당 — Supabase 연결 · Vercel 배포

## 구조

| 구분            | 서버 모드 (Supabase 연결)                      | 체험 모드 (연결 없음/실패)   |
| --------------- | ---------------------------------------------- | ---------------------------- |
| 기숙사 배정     | 서버가 오늘 인원이 가장 적은 기숙사에서 무작위 | 이 기기에서만 (localStorage) |
| 하루 1회 재배정 | 서버가 날짜(한국 시간) 기준으로 강제           | 이 기기 기록으로만 판단      |
| 접속자          | Realtime Presence로 실제 접속자                | 가짜 학생 시뮬레이션         |
| 기숙사 랭킹     | 모든 학생의 오늘 집중 시간 합                  | 가짜 학생 + 내 시간          |

환경변수(`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)가 없으면 자동으로 체험 모드로 열립니다.

## 1. Supabase (새 프로젝트)

1. supabase.com → New project 생성
2. **Authentication → Providers → Anonymous sign-ins** 켜기
3. **SQL Editor**에서 `supabase/sql/004_academy.sql` 전체 실행
   - `001_create_profiles.sql`은 이 프로젝트에서 실행하지 마세요. 이메일 `not null` 트리거 때문에 익명 로그인이 실패합니다.
4. **Project Settings → API**에서 두 값 복사
   - Project URL → `VITE_SUPABASE_URL`
   - `anon` `public` 키 → `VITE_SUPABASE_ANON_KEY`
   - `service_role` 키는 어디에도 넣지 마세요 (클라이언트·저장소·Vercel 모두 불필요).
5. (선택) **Authentication → Rate Limits**에서 익명 로그인 시간당 한도 확인 — 기본값은 IP당 시간당 30회입니다. 공유 후 한꺼번에 몰리면 늘려야 할 수 있습니다.

## 2. 로컬 확인

```bash
# 프로젝트 루트에 .env를 만들고 아래 두 값을 채운다 (.env는 git에 올라가지 않는다)
#   VITE_SUPABASE_URL=...
#   VITE_SUPABASE_ANON_KEY=...   (anon public 키만. service_role 키는 넣지 않는다)
npm run dev              # http://localhost:5173/library
```

## 3. Vercel

1. vercel.com → Add New → Project → GitHub 저장소 Import
2. Framework Preset: Vite (`vercel.json`에 이미 지정)
3. **Environment Variables**에 위 두 값을 등록 (Production · Preview · Development)
4. Deploy → `https://<프로젝트>.vercel.app/library`

`vercel.json`의 rewrite 덕분에 `/library`를 직접 열거나 새로고침해도 404가 나지 않습니다.
환경변수를 바꾼 뒤에는 **Redeploy**해야 번들에 반영됩니다 (Vite는 빌드 시점에 값을 넣습니다).

## 알려진 한계

- **집중 시간은 클라이언트가 보고하는 값**입니다. 서버가 상한(마지막 보고 이후 흐른 실제 시간)을 두지만, 마음먹고 조작하는 사용자를 완전히 막지는 못합니다. 친구끼리 즐기는 용도 기준입니다.
- **익명 계정은 브라우저 데이터를 지우면 사라집니다.** 기숙사·오늘 기록도 함께 사라지고, 그 기기에서 새 학생으로 다시 배정됩니다. (Google 계정 연결은 이후 `linkIdentity`로 확장 가능)
- 같은 순간에 두 명이 같은 자리에 앉으면 한쪽만 보입니다 (먼저 접속한 쪽 우선).
- 오늘 누적 시간은 이 기기의 타이머가 기준입니다. 다른 기기에서 이어 하면 그 기기의 타이머부터 시작합니다 (서버 기록은 줄어들지 않음).
- 하루의 기준은 한국 시간(Asia/Seoul)입니다.
- Supabase 무료 플랜 Realtime 동시접속 한도(약 200)를 넘으면 접속자가 보이지 않을 수 있습니다.
