#!/bin/bash
# PostToolUse hook: 컴포넌트에 .stories.tsx가 없으면 경고
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
if [ -z "$FILE_PATH" ]; then exit 0; fi
if ! echo "$FILE_PATH" | grep -qE '^src/components/.*\.tsx$'; then exit 0; fi
if echo "$FILE_PATH" | grep -qE '\.(stories|test|spec)\.tsx$'; then exit 0; fi
if echo "$FILE_PATH" | grep -qE 'index\.ts'; then exit 0; fi
DIR=$(dirname "$FILE_PATH")
NAME=$(basename "$FILE_PATH" .tsx)
if [ ! -f "$DIR/$NAME.stories.tsx" ]; then
  echo "{\"additionalContext\": \"⚠️ Story 파일 누락: $DIR/$NAME.stories.tsx — 컴포넌트와 함께 .stories.tsx를 반드시 생성하세요.\"}"
fi
exit 0
