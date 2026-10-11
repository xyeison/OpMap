#!/bin/bash
# Stop: si hay cambios sin confirmar en web/, exige que `npm run check` pase antes de terminar el turno.
input=$(cat)
active=$(echo "$input" | jq -r '.stop_hook_active // false' 2>/dev/null)
[ "$active" = "true" ] && exit 0   # ya estamos continuando por este hook: no entrar en bucle
root="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}"
cd "$root" || exit 0
changed=$(git status --porcelain -- web | grep -E '\.(ts|tsx|js|json)$' | grep -vE 'web/(package-lock\.json|public/geo/)' | head -1)
[ -z "$changed" ] && exit 0
cd web || exit 0
out=$(GOOGLE_ROUTES_DISABLED=true npm run check --silent 2>&1)
status=$?
if [ $status -ne 0 ]; then
  echo "npm run check falló (hay cambios en web/ sin verificar). Arregla la causa antes de terminar:" >&2
  echo "$out" | grep -vE '^\s*$' | tail -40 >&2
  exit 2
fi
exit 0
