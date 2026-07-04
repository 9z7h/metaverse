Style Dictionary로 토큰 JSON을 CSS로 빌드합니다.

## 절차

1. `npm run build:tokens` 실행 (= `node style-dictionary.config.mjs`)
2. 결과 확인:
   - `src/tokens/_generated.css` (CSS custom properties)
3. 빌드 에러가 있으면 보고

## 토큰 수정 시 흐름

tokens/_.json 수정 → npm run build:tokens → CSS 자동 생성
⚠️ src/tokens/\_generated.css는 직접 수정하지 말 것.
수정하려면 tokens/_.json을 수정하고 다시 빌드.

$ARGUMENTS
