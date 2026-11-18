# GA4 이벤트 설계

측정 ID `G-JTJXHBB7LZ` (속성: 사신학당). 코드: `src/lib/analytics.ts`.

## 원칙

- 프로덕션 빌드 + `VITE_GA_ID`가 있을 때만 전송. 로컬 개발 트래픽은 집계 안 함.
- 이벤트 이름은 `snake_case`. 이름·파라미터는 `analytics.ts`의 `AnalyticsEvents` 타입에만 추가.
- 채팅 내용, 공부 과목 텍스트는 보내지 않는다 (개인정보).
- 이동처럼 잦은 동작은 세션(탭)당 첫 1회만 (`trackOnce`).
- 파라미터를 보고서에서 보려면 GA 관리 → 맞춤 정의에 등록해야 한다 (맨 아래 표).

## ① 퍼널

| 이벤트             | 시점                                                       | 파라미터                                      |
| ------------------ | ---------------------------------------------------------- | --------------------------------------------- |
| `page_view`        | 접속 (자동)                                                | —                                             |
| `enter_click`      | 입장 버튼                                                  | `is_new` (기숙사 없음)                        |
| `sorting_complete` | 사신등 의식 끝, 서고 입장                                  | `house`                                       |
| `world_loaded`     | 3D 공간 첫 렌더 (세션당 1회, `load_ms`는 3D 진입 시작부터) | `scene`, `load_ms`                            |
| `first_move`       | 세션 첫 이동                                               | `input`: keyboard/joystick, `sec_after_world` |
| `seat_take`        | 자리에 앉음                                                | `mode`: theory/practice                       |
| `focus_start`      | 수련 타이머 시작                                           | `mode`                                        |

신규 사용자 유입경로 탐색: `page_view` → `enter_click` → `sorting_complete` → `world_loaded` → `first_move` → `seat_take` → `focus_start`

## ② 기능 사용률

| 이벤트              | 시점                              | 파라미터                        |
| ------------------- | --------------------------------- | ------------------------------- |
| `spell_cast`        | 주문 시전                         | `spell_id`, `scene`             |
| `spell_locked_view` | 잠긴 주문 설명 열림               | `spell_id`                      |
| `spell_unlock`      | 누적 수련 시간이 해제 기준을 넘음 | `spell_id`, `total_hours`       |
| `spell_dock_toggle` | 주문 목록 열기/닫기               | `state`                         |
| `chat_toggle`       | 채팅창 열기/닫기                  | `state`                         |
| `chat_send`         | 메시지 전송 (내용 제외)           | `length_bucket`: short/mid/long |
| `music_toggle`      | 배경음 재생/정지                  | `state`                         |
| `focus_pause`       | 수련 타이머 일시정지              | `session_sec`                   |
| `scene_travel`      | 서고 ↔ 뜰                         | `from`, `to`                    |
| `house_reroll`      | 기숙사 다시 배정                  | `from_house`                    |

## ④ 기기

기기·OS·브라우저·화면은 GA 자동 수집.

| 이벤트              | 시점                              | 파라미터 |
| ------------------- | --------------------------------- | -------- |
| `joystick_used`     | 조이스틱 첫 사용 (세션당 1회)     | —        |
| `webgl_unsupported` | WebGL 없이 대체 화면 (세션당 1회) | —        |

`world_loaded.load_ms`를 기기별로 나눠 로딩 성능 비교.

## ⑤ 리텐션 + 수련 시간

신규/재사용자·코호트(D1/D7)는 GA 자동 (보고서 → 유지).

| 종류        | 이름                 | 값                                            |
| ----------- | -------------------- | --------------------------------------------- |
| 사용자 속성 | `house`              | 배정 기숙사                                   |
| 사용자 속성 | `total_hours_bucket` | `0` / `1+` / `3+` / `5+` (주문 해제 구간)     |
| 이벤트      | `focus_milestone`    | 오늘 누적 30·60·120분 처음 넘을 때, `minutes` |

동질 집단 탐색: 주문 해제자 vs 미해제자 D7 재방문 비교. 한계: GA는 브라우저 쿠키 기준이라 기기가 바뀌면 다른 사용자로 셈.

## ⑥ 유입 경로

GA 자동 (획득 → 트래픽 획득). 공유 링크에 UTM 규칙만 지킨다.

| 채널              | 링크 뒤에 붙일 것                           |
| ----------------- | ------------------------------------------- |
| 포트폴리오 사이트 | `?utm_source=portfolio&utm_medium=referral` |
| 인스타·스레드     | `?utm_source=instagram&utm_medium=social`   |
| 카톡              | `?utm_source=kakao&utm_medium=messenger`    |
| 이력서 PDF        | `?utm_source=resume&utm_medium=pdf`         |

## 방문 시간

평균 참여 시간·세션당 참여 시간은 GA 자동.

| 이벤트        | 시점                                                                                                           | 파라미터            |
| ------------- | -------------------------------------------------------------------------------------------------------------- | ------------------- |
| `scene_leave` | 서고/뜰을 떠날 때, 탭을 숨기거나 닫을 때 (보이던 구간마다 1건, 0초는 제외. 체류 시간은 `stay_sec` 합계로 본다) | `scene`, `stay_sec` |

## GA 맞춤 정의 등록 목록

| 범위            | 이름                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------- |
| 이벤트 측정기준 | `spell_id`, `scene`, `input`, `mode`, `state`, `from`, `to`, `house`, `from_house`, `is_new`, `length_bucket` |
| 이벤트 측정항목 | `load_ms`, `stay_sec`, `session_sec`, `minutes`, `sec_after_world`, `total_hours`                             |
| 사용자 측정기준 | `house`, `total_hours_bucket`                                                                                 |
