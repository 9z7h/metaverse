import StyleDictionary from "style-dictionary";

// ── 빌드 설정 ──
const sd = new StyleDictionary({
  source: ["tokens/**/*.json"],
  platforms: {
    // CSS 출력 (React용)
    css: {
      transformGroup: "css",
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

await sd.buildAllPlatforms();
console.log("\n✅ Style Dictionary 빌드 완료");
console.log("   CSS → src/tokens/_generated.css");
