# Superpowers en OpMap

Superpowers (<https://github.com/obra/superpowers>, Jesse Vincent, licencia MIT) es un paquete de skills
para Claude Code que ordena el método de trabajo: aclarar antes de programar (`brainstorming`), planear por
tareas (`writing-plans`), ejecutar con pruebas primero (`test-driven-development`, `executing-plans`,
`subagent-driven-development`), depurar por causa raíz (`systematic-debugging`), verificar con evidencia antes
de dar algo por hecho (`verification-before-completion`) y revisar con otros agentes (`requesting-code-review`,
`receiving-code-review`).

## Cómo está instalado

En este entorno no existe `/plugin install`, así que va **copiado en el repositorio** como skills de proyecto,
no como plugin de la cuenta:

- `.claude/skills/<nombre>/` – las 15 skills tal cual vienen del repositorio (versión **7.0.1**, commit
  `2ce8aa15`, 2026-10-21), con sus scripts y referencias. Licencia en `.claude/skills/LICENSE-superpowers.txt`.
- `.claude/hooks/superpowers-session-start.sh` – hook `SessionStart` (registrado en `.claude/settings.json`)
  que inyecta la skill `using-superpowers` al arrancar, limpiar o compactar, igual que hace el plugin. Es
  una adaptación del `hooks/session-start` original: lee la skill desde `.claude/skills/` en vez de
  `CLAUDE_PLUGIN_ROOT`.

Las skills se invocan por su nombre llano (`brainstorming`, `systematic-debugging`…). Donde su texto dice
`superpowers:nombre` se refiere a esa misma skill: no se editaron para poder actualizarlas con un copiado.

## Precedencia

Las reglas de `CLAUDE.md` mandan sobre cualquier skill (la propia `using-superpowers` lo dice). En
particular siguen valiendo: spec corta en `docs/specs/` para trabajo mediano o grande, rama por cambio y PR
a `master` con `/entregar` (no las opciones de merge local que ofrece `finishing-a-development-branch`),
`npm run check` como evidencia, subagente `revisor` antes de entregar, y nunca llamadas nuevas a Google
Maps sin autorización. Las skills `verificar` y `entregar` son propias de OpMap y no vienen de Superpowers.

## Actualizar

```bash
git clone --depth 1 https://github.com/obra/superpowers /tmp/superpowers
cp -a /tmp/superpowers/skills/. .claude/skills/
cp /tmp/superpowers/LICENSE .claude/skills/LICENSE-superpowers.txt
```

Luego revisar el diff (sobre todo `using-superpowers/SKILL.md`, que es lo que inyecta el hook), anotar la
versión nueva aquí y, si cambió el formato de salida del hook original, comparar con
`.claude/hooks/superpowers-session-start.sh`.
