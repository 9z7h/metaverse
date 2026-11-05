# 디자인 토큰 매핑 테이블

> Figma 변수명 ↔ CSS custom property 매핑.
> Claude Code가 Figma 디자인 구현 시 이 문서를 참조합니다.
> 토큰 추가/변경 시 이 문서도 업데이트하세요.

## 네이밍 규칙

Figma `/` → CSS `-` 변환. 예: `color/bg/primary` → `--color-bg-primary`

## 색상

> node-id: 4035-1488에서 추출. get_variable_defs 응답은 평면(flat) 구조라 color에 alias 메타데이터 없음.
> Semantic 토큰의 "값" 컬럼은 추출된 raw hex, 괄호 안은 값이 일치하는 Primitive(참조 재구성).

### Primitive — Gray

| Figma 변수명 | CSS Property      | 값      | 용도          |
| ------------ | ----------------- | ------- | ------------- |
| gray/100     | --color-gray-100  | #ffffff | 그레이 스케일 |
| Gray/100     | --color-Gray-100  | #f9fafb | 그레이 스케일 |
| Gray/200     | --color-Gray-200  | #f3f4f6 | 그레이 스케일 |
| gray/300     | --color-gray-300  | #f5f7fa | 그레이 스케일 |
| gray/305     | --color-gray-305  | #f1f5f9 | 그레이 스케일 |
| gray/340     | --color-gray-340  | #e2e8f0 | 그레이 스케일 |
| gray/360     | --color-gray-360  | #e5e7eb | 그레이 스케일 |
| gray/400     | --color-gray-400  | #d1d5db | 그레이 스케일 |
| gray/490     | --color-gray-490  | #94a3b8 | 그레이 스케일 |
| gray/500     | --color-gray-500  | #9ca3af | 그레이 스케일 |
| gray/540     | --color-gray-540  | #7c8484 | 그레이 스케일 |
| gray/600     | --color-gray-600  | #6b7280 | 그레이 스케일 |
| gray/610     | --color-gray-610  | #64748b | 그레이 스케일 |
| gray/700     | --color-gray-700  | #4b5563 | 그레이 스케일 |
| gray/800     | --color-gray-800  | #374151 | 그레이 스케일 |
| gray/850     | --color-gray-850  | #2c3030 | 그레이 스케일 |
| gray/900     | --color-gray-900  | #262626 | 그레이 스케일 |
| gray/1000    | --color-gray-1000 | #161c1c | 그레이 스케일 |
| gray/1050    | --color-gray-1050 | #0f172a | 그레이 스케일 |

### Primitive — Blue

| Figma 변수명 | CSS Property      | 값      | 용도                 |
| ------------ | ----------------- | ------- | -------------------- |
| blue/20      | --color-blue-20   | #f7faff | 블루 스케일          |
| blue/50      | --color-blue-50   | #eff6ff | 블루 스케일          |
| blue/100     | --color-blue-100  | #f1f8fe | 블루 스케일          |
| blue/120     | --color-blue-120  | #dbeafe | 블루 스케일          |
| blue/200     | --color-blue-200  | #b8dcfc | 블루 스케일          |
| blue/280     | --color-blue-280  | #93c5fd | 블루 스케일          |
| blue/300     | --color-blue-300  | #91caff | 블루 스케일          |
| blue/400     | --color-blue-400  | #69b1ff | 블루 스케일          |
| blue/440     | --color-blue-440  | #63a3fb | 블루 스케일          |
| blue/500     | --color-blue-500  | #4096ff | 블루 스케일          |
| blue/540     | --color-blue-540  | #3b82f6 | 블루 스케일          |
| blue/600     | --color-blue-600  | #1289f6 | 블루 스케일 (브랜드) |
| blue/680     | --color-blue-680  | #1d4ed8 | 블루 스케일          |
| blue/700     | --color-blue-700  | #0958d9 | 블루 스케일          |
| blue/800     | --color-blue-800  | #003eb3 | 블루 스케일          |
| blue/900     | --color-blue-900  | #002c8c | 블루 스케일          |
| blue/1000    | --color-blue-1000 | #001d66 | 블루 스케일          |

### Primitive — Red

| Figma 변수명 | CSS Property     | 값      | 용도                 |
| ------------ | ---------------- | ------- | -------------------- |
| red/100      | --color-red-100  | #fffbfc | 레드 스케일          |
| red/200      | --color-red-200  | #fff2f5 | 레드 스케일          |
| red/300      | --color-red-300  | #ffccc7 | 레드 스케일          |
| red/400      | --color-red-400  | #ffa39e | 레드 스케일          |
| red/500      | --color-red-500  | #ff4d4f | 레드 스케일          |
| red/600      | --color-red-600  | #fc2a55 | 레드 스케일 (danger) |
| red/700      | --color-red-700  | #cf1322 | 레드 스케일          |
| red/800      | --color-red-800  | #a8071a | 레드 스케일          |
| red/900      | --color-red-900  | #820014 | 레드 스케일          |
| red/1000     | --color-red-1000 | #5c0011 | 레드 스케일          |

### Semantic — Text

| Figma 변수명   | CSS Property           | 값                  | 용도             |
| -------------- | ---------------------- | ------------------- | ---------------- |
| text/primary   | --color-text-primary   | #161c1c (gray/1000) | 주요 텍스트      |
| text/secondary | --color-text-secondary | #6b7280 (gray/600)  | 보조 텍스트      |
| text/tertiary  | --color-text-tertiary  | #9ca3af (gray/500)  | 3차 텍스트       |
| text/disabled  | --color-text-disabled  | #d1d5db (gray/400)  | 비활성 텍스트    |
| text/onbrand   | --color-text-onbrand   | #ffffff (gray/100)  | 브랜드 위 텍스트 |
| text/Danger    | --color-text-Danger    | #fc2a55 (red/600)   | 위험 텍스트      |

### Semantic — Background

| Figma 변수명            | CSS Property                    | 값                 | 용도               |
| ----------------------- | ------------------------------- | ------------------ | ------------------ |
| background/default      | --color-background-default      | #ffffff (gray/100) | 기본 배경          |
| background/Subtle       | --color-background-Subtle       | #fafafa            | 은은한 배경        |
| background/muted        | --color-background-muted        | #f5f7fa            | 약한 배경          |
| background/brand        | --color-background-brand        | #1289f6 (blue/600) | 브랜드 배경        |
| background/brandsubtle  | --color-background-brandsubtle  | #f1f8fe (blue/100) | 브랜드 은은한 배경 |
| background/danger       | --color-background-danger       | #fff2f5 (red/200)  | 위험 배경          |
| background/dangersubtle | --color-background-dangersubtle | #fffbfc (red/100)  | 위험 은은한 배경   |

### Semantic — Border

| Figma 변수명   | CSS Property           | 값                 | 용도        |
| -------------- | ---------------------- | ------------------ | ----------- |
| border/default | --color-border-default | #d1d5db (gray/400) | 기본 보더   |
| border/strong  | --color-border-strong  | #4b5563 (gray/700) | 강한 보더   |
| border/brand   | --color-border-brand   | #1289f6 (blue/600) | 브랜드 보더 |
| border/danger  | --color-border-danger  | #fc2a55 (red/600)  | 위험 보더   |

### Semantic — Interactive

| Figma 변수명                 | CSS Property                         | 값                 | 용도                  |
| ---------------------------- | ------------------------------------ | ------------------ | --------------------- |
| interactive/primary          | --color-interactive-primary          | #1289f6 (blue/600) | 기본 인터랙션         |
| interactive/primaryhover     | --color-interactive-primaryhover     | #0958d9 (blue/700) | 기본 인터랙션 hover   |
| interactive/destructive      | --color-interactive-destructive      | #fc2a55 (red/600)  | 파괴적 인터랙션       |
| interactive/destructivehover | --color-interactive-destructivehover | #cf1322 (red/700)  | 파괴적 인터랙션 hover |

### Semantic — Content

| Figma 변수명    | CSS Property            | 값                 | 용도        |
| --------------- | ----------------------- | ------------------ | ----------- |
| content/strong  | --color-content-strong  | #262626 (gray/900) | 강한 콘텐츠 |
| content/default | --color-content-default | #374151 (gray/800) | 기본 콘텐츠 |
| content/muted   | --color-content-muted   | #4b5563 (gray/700) | 약한 콘텐츠 |

## 스페이싱

> node-id: 4035-1488에서 추출. 모든 spacing 변수는 raw 값(참조 없음). 원본은 단위 없는 숫자 → px 부여.

| Figma 변수명 | CSS Property | 값   |
| ------------ | ------------ | ---- |
| spacing/0    | --spacing-0  | 0    |
| spacing/2    | --spacing-2  | 2px  |
| spacing/4    | --spacing-4  | 4px  |
| spacing/6    | --spacing-6  | 6px  |
| spacing/8    | --spacing-8  | 8px  |
| spacing/12   | --spacing-12 | 12px |
| spacing/16   | --spacing-16 | 16px |
| spacing/20   | --spacing-20 | 20px |
| spacing/24   | --spacing-24 | 24px |
| spacing/32   | --spacing-32 | 32px |
| spacing/40   | --spacing-40 | 40px |
| spacing/48   | --spacing-48 | 48px |
| spacing/64   | --spacing-64 | 64px |

> ⚠️ `spacing/6`, `spacing/20`은 Postcard 섹션(node 781-5287) 구현 시 추가됨.
> Figma 원본에서는 raw 값이었으나 하드코딩 금지 규칙에 따라 토큰으로 승격.

## 반경 (Radius)

> Postcard 섹션(node 781-5287)에서 추출/승격.

| Figma 변수명 | CSS Property | 값  | 용도                              |
| ------------ | ------------ | --- | --------------------------------- |
| radius/sm    | --radius-sm  | 4px | 썸네일 이미지 모서리              |
| radius/md    | --radius-md  | 6px | Chip 모서리 (raw 6px → 토큰 승격) |

## 타이포그래피

> Postcard 섹션(node 781-5287)에서 사용. 폰트: Pretendard.
> 시맨틱 토큰은 CSS `font` 단축 속성 형태 → 컴포넌트에서 `font: var(--text-*)`.

### Primitive

| 구분        | CSS Property                            | 값                     |
| ----------- | --------------------------------------- | ---------------------- |
| font-family | --font-family-base                      | "Pretendard", ... sans |
| weight      | --font-weight-regular / -medium / -bold | 400 / 500 / 700        |
| size        | --font-size-13 / -14 / -16 / -18        | 13 / 14 / 16 / 18px    |
| line-height | --line-height-20 / -21 / -24 / -27      | 20 / 21 / 24 / 27px    |

### Semantic (font shorthand)

| Figma 스타일      | CSS Property             | 값 (weight size/lh family) | 용도            |
| ----------------- | ------------------------ | -------------------------- | --------------- |
| title/sm/bold     | --text-title-sm-bold     | Bold 18/27 Pretendard      | 제목            |
| body/lg/regular   | --text-body-lg-regular   | Regular 16/24 Pretendard   | 본문            |
| body/sm/bold      | --text-body-sm-bold      | Bold 14/21 Pretendard      | Chip 라벨       |
| caption/lg/medium | --text-caption-lg-medium | Medium 13/20 Pretendard    | 통계·타임스탬프 |

## Claude용 규칙

1. Figma MCP가 hex 색상 반환 → 이 테이블에서 찾아서 `var(--color-*)` 사용
2. Figma가 스페이싱 숫자 반환 → `var(--spacing-*)` 매핑
3. 테이블에 없는 값 → 새 변수 만들지 말고 `/* ⚠️ 누락된 토큰 */` 플래그

## Primitive — 마법 도서관 팔레트 (library 테마 전용)

> 원본: `tokens/color.json`. Figma 변수 없음 — 코드에서 먼저 정의. 대비는 WCAG AA 검증 완료.

| CSS Property          | 값      | 용도                            |
| --------------------- | ------- | ------------------------------- |
| --color-mahogany-900  | #16100d | 테마 기본 배경                  |
| --color-mahogany-800  | #21180f | 카드 표면                       |
| --color-mahogany-700  | #2e2219 | 한 단계 올라온 표면             |
| --color-mahogany-600  | #463428 | (예비)                          |
| --color-mahogany-500  | #5e4737 | 테두리, 비활성 텍스트           |
| --color-parchment-100 | #f5ecd9 | 본문 텍스트 (16.05:1)           |
| --color-parchment-300 | #d8c8a6 | 보조 텍스트 (11.43:1)           |
| --color-parchment-500 | #a8977a | 3차 텍스트 (6.62:1)             |
| --color-candle-300    | #ffd98a | 강조 hover                      |
| --color-candle-400    | #f2bf55 | 강조/브랜드 (배경 대비 11.09:1) |
| --color-candle-500    | #d9a03a | (예비)                          |
| --color-candle-900    | #3b2a12 | 강조 subtle 배경                |

## 테마 — `[data-theme="library"]`

> 원본: `tokens/themes/library.json` → 빌드 결과 `src/tokens/_theme-library.css`.
> 새 변수를 만들지 않고 **기존 시맨틱 토큰 이름을 재정의**한다. 그래서 Button/Chip/Input 등
> 기존 컴포넌트를 수정 없이 `data-theme="library"` 하위에 두기만 하면 어두운 도서관 테마가 적용된다.

| 시맨틱 토큰                    | 기본 테마 | library 테마  |
| ------------------------------ | --------- | ------------- |
| --color-background-default     | gray-100  | mahogany-900  |
| --color-background-Subtle      | #fafafa   | mahogany-800  |
| --color-background-muted       | #f5f7fa   | mahogany-700  |
| --color-background-brandsubtle | blue-100  | candle-900    |
| --color-text-primary           | gray-1000 | parchment-100 |
| --color-text-secondary         | gray-600  | parchment-300 |
| --color-text-tertiary          | gray-500  | parchment-500 |
| --color-text-onbrand           | gray-100  | mahogany-900  |
| --color-interactive-primary    | blue-600  | candle-400    |
| --color-border-default         | gray-400  | mahogany-500  |
| --color-border-brand           | blue-600  | candle-400    |
| --color-content-strong         | gray-900  | parchment-100 |

### 3D 장면 토큰 (`--color-scene-*`, library 테마 전용)

> three.js 재질은 CSS를 직접 쓸 수 없으므로 `readSceneColors()`(`src/components/pages/Library/scene/sceneLayout.ts`)가
> `data-theme="library"` 요소의 computed style에서 이 토큰을 읽어 재질 색으로 넘긴다. 3D 코드에 hex를 쓰지 않는다.

| CSS Property                        | 참조                                  | 용도                               |
| ----------------------------------- | ------------------------------------- | ---------------------------------- |
| --color-scene-floor                 | wood-900                              | 바닥                               |
| --color-scene-wall                  | mahogany-800                          | 벽                                 |
| --color-scene-fog                   | mahogany-900                          | 원경 안개                          |
| --color-scene-wood / -dark / -light | wood-500 / 700 / 300                  | 책상·책장·펼친 책                  |
| --color-scene-flame                 | candle-300                            | 촛불(발광), 점광원                 |
| --color-scene-light                 | candle-400                            | 환경광                             |
| --color-scene-skin                  | skin-300                              | 아바타 얼굴                        |
| --color-scene-hat                   | mahogany-900                          | 고깔모자, 눈                       |
| --color-scene-robe-1 ~ 4            | blue-800, red-800, moss-600, plum-600 | 책장 책 색 (로브는 기숙사 primary) |
| --color-scene-rug                   | red-1000                              | 중앙 통로 러그                     |

새 프리미티브: `--color-wood-300/500/700/900`, `--color-moss-600`, `--color-plum-600`, `--color-skin-300` (`tokens/color.json`).

전체 목록은 `tokens/themes/library.json` 참고. 테마 추가 시 `style-dictionary.config.mjs`의 `themes` 배열에 이름을 추가한다.

### 기숙사 토큰 (`--color-house-*`, library 테마 전용)

> 사신학당 4기숙사 (사신수 모티브 창작 설정). 원본: `tokens/themes/library.json` → `color.house.<id>.*`.
> 정의·이름·표어는 `src/components/pages/Library/houses.ts`. 대비는 mahogany-800/900 배경 기준 검증.
> primary는 어두운 먹빛각에서 로브·깃발이 보이도록 배경 대비 3:1 이상으로 맞춤 (현무 남색은 원래보다 밝게 조정).

| 기숙사 (id)          | 상징색        | primary (로브·깃발·초롱)  | accent (글자·문장)           | subtle (배지 배경) | on (primary 위 글자)   |
| -------------------- | ------------- | ------------------------- | ---------------------------- | ------------------ | ---------------------- |
| 백호관 (baekho)      | 아이보리·먹색 | ivory-200 #e8e0cf (14.36) | ivory-100 #f5efe2 (15.24)    | ink-800 #2a2826    | ink-900 (12.80:1)      |
| 주작관 (jujak)       | 주홍·금색     | ember-600 #b8322a (3.17)  | amber-300 #f2c46a (10.71)    | ember-900 #3d1512  | parchment-100 (5.07:1) |
| 현무관 (hyeonmu)     | 남색·은색     | navy-500 #4a62a8 (3.23)   | silver-300 #c9d1de (11.36)   | navy-900 #141b2e   | parchment-100 (4.96:1) |
| 청룡관 (cheongryong) | 청록·금색     | teal-600 #1c6f68 (3.16)   | palegold-300 #e9d58f (11.96) | teal-900 #0f2b29   | parchment-100 (5.08:1) |

청사초롱은 주작 primary(홍)와 청룡 primary(청)를, 단청 띠의 줄무늬도 같은 두 색을 쓴다.

사용: CSS는 `houseVar(id, "accent")` → `var(--color-house-<id>-accent)`, 3D는 `houseToken(id, part)`로 `readSceneColors()` 결과에서 조회.

추가 장면 토큰: `--color-scene-moonlight`(moon-300, 창호 달빛), `--color-scene-dancheong`(dancheong-500, 단청 띠 바탕), `--color-scene-brass`(brass-500, 혼천의·등 다발 고리의 놋쇠), `--color-scene-collar`(ivory-100, 도포 깃의 흰 동정 — 모든 기숙사 공통).

아바타 의상: 도포 = 기숙사 primary, 갓끈·고름·세조대 = 기숙사 accent, 갓 = `--color-scene-hat`.
