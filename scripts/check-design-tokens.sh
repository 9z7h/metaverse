#!/bin/bash
# PostToolUse hook: 하드코딩된 디자인 값 감지 → Claude에 피드백
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
if [ -z "$FILE_PATH" ]; then exit 0; fi
if echo "$FILE_PATH" | grep -qE '(\.css$|tokens/|tailwind\.config|\.test\.|\.spec\.|\.svg$|\.json$)'; then exit 0; fi
if ! echo "$FILE_PATH" | grep -qE '\.(tsx?|jsx?)$'; then exit 0; fi
if [ ! -f "$FILE_PATH" ]; then exit 0; fi
HARDCODED=$(grep -nE '(#[0-9a-fA-F]{3,8}|rgb\(|rgba\(|hsl\()' "$FILE_PATH" | grep -vE '^\s*//' | head -5)
if [ -n "$HARDCODED" ]; then
  CLEAN=$(echo "$HARDCODED" | tr '\n' ' ' | tr '"' "'")
  echo "{\"additionalContext\": \"⚠️ 하드코딩된 색상값 발견: $FILE_PATH — $CLEAN → src/tokens/의 토큰을 사용하세요.\"}"
fi
exit 0
