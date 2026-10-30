#!/usr/bin/env bash
# SessionStart (startup|clear|compact): inyecta la skill using-superpowers en el contexto.
# Adaptado de hooks/session-start de https://github.com/obra/superpowers (MIT) para
# funcionar como hook de proyecto en vez de plugin: lee la skill desde .claude/skills/.
set -euo pipefail
root="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
skill_md="$root/.claude/skills/using-superpowers/SKILL.md"
if [ -r "$skill_md" ]; then
  content="$(<"$skill_md")"
else
  content="Error: no se encontró .claude/skills/using-superpowers/SKILL.md"
fi
escape_for_json() {
  local s="$1"
  s="${s//\\/\\\\}"; s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"; s="${s//$'\r'/\\r}"; s="${s//$'\t'/\\t}"
  printf '%s' "$s"
}
escaped=$(escape_for_json "$content")
ctx="<EXTREMELY_IMPORTANT>\nYou have superpowers.\n\n**Below is the full content of your 'using-superpowers' skill - your introduction to using skills. For all other skills, use the 'Skill' tool. In this repo the skills are project skills: invoke them by plain name (e.g. 'brainstorming', not 'superpowers:brainstorming'). CLAUDE.md rules take precedence over any skill.**\n\n${escaped}\n</EXTREMELY_IMPORTANT>"
printf '{\n  "hookSpecificOutput": {\n    "hookEventName": "SessionStart",\n    "additionalContext": "%s"\n  }\n}\n' "$ctx"
exit 0
