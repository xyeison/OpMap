#!/bin/bash
# PostToolUse (Edit|Write): tras editar .ts/.tsx dentro de web/, corre tsc y devuelve los errores a Claude.
path=$(jq -r '.tool_input.file_path // empty' 2>/dev/null)
case "$path" in
  */web/*.ts|*/web/*.tsx) ;;
  *) exit 0;;
esac
cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}/web" || exit 0
out=$(npx tsc --noEmit -p tsconfig.json 2>&1)
if [ -n "$out" ]; then
  echo "tsc encontró errores tras editar $(basename "$path"):" >&2
  echo "$out" | head -40 >&2
  exit 2
fi
exit 0
