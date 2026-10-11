#!/bin/bash
# PreToolUse (Edit|Write): bloquea ediciones a archivos que nunca debe tocar el agente.
path=$(jq -r '.tool_input.file_path // empty' 2>/dev/null)
[ -z "$path" ] && exit 0
case "$path" in
  *.env|*.env.*|*/.env|*/.env.*)
    echo "Bloqueado: no se editan archivos .env (secretos). Pide al dueño que lo cambie a mano." >&2; exit 2;;
  */web/public/geo/*.json)
    echo "Bloqueado: $path es generado por web/scripts/build-geojson.ts; edita el script y regenera." >&2; exit 2;;
  */database/hardening/*)
    echo "Bloqueado: database/hardening/ ya se aplicó en producción; escribe una migración nueva en database/migrations/." >&2; exit 2;;
esac
exit 0
