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

## En el flujo de OpMap: paso → skill → cuándo no

Decidido con el dueño el 2026-10-30 (puntos 1, 7 y 8 de "Flujo de trabajo" en `CLAUDE.md`). Las skills están en
inglés. Specs, planes, commits y PR van en español.

| Paso del flujo | Skill | Cuándo no |
| --- | --- | --- |
| Al arrancar la sesión | `using-superpowers` (la inyecta el hook) | Nunca se salta; `CLAUDE.md` manda sobre ella |
| Entender el pedido y escribir la spec (punto 1) | `brainstorming`. Su resultado es la spec en `docs/specs/<fecha>-<tema>.md`, con la plantilla, y la aprueba el dueño | Arreglos de una línea, textos o docs. Preguntas o consultas. Cuando el dueño dice que no hacen falta preguntas |
| Planear (punto 1) | `writing-plans`: el plan va en `docs/planes/<fecha>-<tema>.md` y no se aprueba aparte | Sin spec (cambios pequeños, textos, docs) |
| Aislar el cambio (punto 8) | Rama desde `master` en la carpeta principal. `using-git-worktrees` solo si otra sesión trabaja a la vez en el repo o el dueño lo pide | Con una sola sesión trabajando, sin worktree |
| Implementar (punto 7) | `test-driven-development`: primero la prueba que falla, en `web/scripts/*-check.ts` o `mobile/scripts/checks/`. Luego `executing-plans` | Cambios solo visuales: la evidencia es la captura del preview. Textos y docs |
| Implementar con subagentes | `subagent-driven-development` | Por defecto no: solo si el dueño lo pide (cuesta más tokens) |
| Varias fallas independientes | `dispatching-parallel-agents` | Por defecto no: solo si el dueño lo pide |
| Un error o una prueba que falla (punto 7) | `systematic-debugging`, antes de proponer cualquier arreglo | Nunca se salta |
| Decir "listo" (punto 7) | `verification-before-completion`: `npm run check` con la salida pegada. También el de `mobile/` si cambió, y la captura si se ve | Nunca se salta en cambios de código |
| Revisión antes de entregar (punto 7) | `requesting-code-review` es aquí el subagente `revisor` (`.claude/agents/revisor.md`): no se duplica | Cambios pequeños, textos o docs |
| Recibir la revisión | `receiving-code-review`: comprobar cada hallazgo antes de corregirlo; se corrige solo lo que afecte corrección o reglas | — |
| Entregar (puntos 3 y 8) | `/entregar` (PR a `master`) | `finishing-a-development-branch` no se usa: ofrece merge local |
| Crear o editar skills propias de OpMap | `writing-skills` | Las de Superpowers no se editan: se actualizan copiando (abajo) |
| Superpowers no hace lo que se espera | `diagnosing-superpowers` | — |

## Precedencia

Las reglas de `CLAUDE.md` mandan sobre cualquier skill (la propia `using-superpowers` lo dice). En particular siguen
valiendo:
- spec corta en `docs/specs/` para trabajo mediano o grande, y plan en `docs/planes/` (no en `docs/superpowers/`);
- rama por cambio desde `master`, con worktree solo si otra sesión trabaja a la vez en el repo o el dueño lo pide;
- PR a `master` con `/entregar`, no las opciones de merge local que ofrece `finishing-a-development-branch`;
- `npm run check` como evidencia;
- subagente `revisor` antes de entregar;
- nunca llamadas nuevas a Google Maps sin autorización.

Las skills `verificar` y `entregar` son propias de OpMap y no vienen de Superpowers.

## Actualizar

```bash
git clone --depth 1 https://github.com/obra/superpowers /tmp/superpowers
cp -a /tmp/superpowers/skills/. .claude/skills/
cp /tmp/superpowers/LICENSE .claude/skills/LICENSE-superpowers.txt
```

Luego revisar el diff (sobre todo `using-superpowers/SKILL.md`, que es lo que inyecta el hook), anotar la
versión nueva aquí y, si cambió el formato de salida del hook original, comparar con
`.claude/hooks/superpowers-session-start.sh`.
