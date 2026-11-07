import StyleDictionary from "style-dictionary";

// ── 커스텀 transform ──
// 기본 css 그룹의 name/kebab은 이름을 소문자로 바꿔서
// `--color-Gray-100` 과 `--color-gray-100` 처럼 대소문자만 다른 기존 토큰이 충돌한다.
// 기존 CSS 변수 이름을 100% 보존하기 위해 경로를 그대로 '-'로 이어붙인다.
StyleDictionary.registerTransform({
  name: "name/preserve-case",
  type: "name",
  transform: (token) => token.path.join("-"),
});

// 값은 JSON에 적힌 그대로 출력한다 (px → rem 변환, 색 포맷 변환 없음).
const transforms = ["name/preserve-case"];

// ── 1) 기본 토큰: tokens/*.json → :root ──
const base = new StyleDictionary({
  source: ["tokens/*.json"],
  platforms: {
    css: {
      transforms,
      buildPath: "src/tokens/",
      files: [
        {
          destination: "_generated.css",
          format: "css/variables",
          options: {
            outputReferences: true, // var(--xxx) 참조 구조 유지
          },
        },
      ],
    },
  },
});

// ── 2) 테마 토큰: tokens/themes/<name>.json → [data-theme="<name>"] ──
// 테마 파일은 기본 토큰과 같은 시맨틱 이름을 재정의한다.
// 기본 토큰은 include(참조 해석용)로만 불러오고, 출력은 테마 파일 토큰만 한다.
const themes = ["library"];

const themeBuilds = themes.map(
  (theme) =>
    new StyleDictionary({
      include: ["tokens/*.json"],
      source: [`tokens/themes/${theme}.json`],
      log: { warnings: "disabled" }, // include ↔ source 재정의는 의도된 동작
      platforms: {
        css: {
          transforms,
          buildPath: "src/tokens/",
          files: [
            {
              destination: `_theme-${theme}.css`,
              format: "css/variables",
              filter: (token) =>
                token.filePath.replaceAll("\\", "/") ===
                `tokens/themes/${theme}.json`,
              options: {
                selector: `[data-theme="${theme}"]`,
                outputReferences: true,
              },
            },
          ],
        },
      },
    }),
);

await base.buildAllPlatforms();
for (const sd of themeBuilds) await sd.buildAllPlatforms();

console.log("\n✅ Style Dictionary 빌드 완료");
console.log("   CSS → src/tokens/_generated.css");
for (const theme of themes)
  console.log(`   CSS → src/tokens/_theme-${theme}.css`);
