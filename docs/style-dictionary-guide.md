# Style Dictionary 토큰 파이프라인 가이드

## 이게 뭔가요?

**Style Dictionary**는 Amazon이 만든 오픈소스 빌드 도구입니다.
토큰 JSON 파일 하나를 넣으면 CSS 등 여러 형식으로 자동 변환합니다.

```
tokens/*.json ──→  Style Dictionary  └→ CSS custom properties (React용)
```

## 왜 필요한가?

|               | Claude Code만                               | Style Dictionary + Claude Code   |
| ------------- | ------------------------------------------- | -------------------------------- |
| 토큰 변환     | AI가 CSS 읽고 변환 (매번 약간 다를 수 있음) | JSON → CSS 자동 빌드 (항상 동일) |
| 컴포넌트 변환 | AI가 처리 (이건 AI만 가능)                  | AI가 처리 (동일)                 |
| 토큰 비용     | 토큰 변환에도 Claude 토큰 소모              | 토큰 변환은 무료 (빌드 도구)     |
| 일관성        | 90~95%                                      | 토큰: 100%, 컴포넌트: 90~95%     |
| 플랫폼 추가   | 매번 Claude에 요청                          | config에 플랫폼 한 줄 추가       |

**결론:** 토큰은 Style Dictionary, 컴포넌트는 Claude Code. 역할을 나누는 것.

---

## 구조

```
프로젝트/
├── tokens/                          ← ⭐ 토큰 원본 (JSON, 이것만 수정)
│   ├── color.json                   ← 색상 토큰
│   └── base.json                    ← 스페이싱, 라디우스, 타이포
│
├── style-dictionary.config.mjs      ← Style Dictionary 설정
│
└── src/tokens/                      ← 🔴 자동 생성됨 (직접 수정 금지)
    └── _generated.css               ← CSS custom properties
```

**핵심 원칙: `tokens/*.json`만 수정. 나머지는 빌드로 자동 생성.**

---

## 설치

```bash
npm install -D style-dictionary
```

package.json에 빌드 스크립트 추가:

```json
{
  "scripts": {
    "build:tokens": "node style-dictionary.config.mjs",
    "dev": "vite",
    "build": "npm run build:tokens && vite build"
  }
}
```

---

## 사용법

### 토큰 빌드

```bash
npm run build:tokens
```

출력:

```
✅ Style Dictionary 빌드 완료
   CSS → src/tokens/_generated.css
```

### 토큰 수정할 때

```
1. tokens/color.json 또는 tokens/base.json 수정
2. npm run build:tokens
3. CSS가 자동으로 업데이트됨
4. 끝. Claude에 토큰 변환을 요청할 필요 없음.
```

### Claude Code에서

```
/build-tokens
```

---

## 토큰 JSON 작성법

### 색상 (tokens/color.json)

```json
{
  "color": {
    "brand": {
      "primary": {
        "value": "#3b82f6",
        "type": "color"
      }
    }
  }
}
```

→ CSS: `--color-brand-primary: #3b82f6;`

### 참조 (alias)

```json
{
  "color": {
    "bg": {
      "primary": {
        "value": "{color.primitive.white}",
        "type": "color"
      }
    }
  }
}
```

→ CSS: `--color-bg-primary: var(--color-primitive-white);` (참조 유지)

### 스페이싱 (tokens/base.json)

```json
{
  "spacing": {
    "lg": {
      "value": "16",
      "type": "dimension"
    }
  }
}
```

→ CSS: `--spacing-lg: 16px;` (px 자동 추가)

---

## Figma 변수가 변경되면 (전체 흐름)

```
Figma Variables 변경
       │
       ▼
Claude Code에서:
  "Figma 토큰이 변경됐어. tokens/*.json을 업데이트해줘"
  → token-checker 에이전트가 Figma MCP로 변수 가져옴
  → tokens/*.json 수정 제안 (또는 자동 수정)
       │
       ▼
npm run build:tokens
  → src/tokens/_generated.css 자동 갱신
       │
       ▼
  React: _generated.css import → 바로 적용
```

**Claude Code는 JSON 업데이트만 하고, CSS 생성은 Style Dictionary가 처리.**

---

## 새 플랫폼 추가하기

`style-dictionary.config.mjs`에 플랫폼만 추가하면 됩니다:

```javascript
// iOS Swift 추가 예시
'ios-swift': {
  transformGroup: 'ios-swift',
  buildPath: 'ios_output/',
  files: [{
    destination: 'StyleDictionaryTokens.swift',
    format: 'ios-swift/class.swift',
    className: 'AppTokens',
  }],
},
```
