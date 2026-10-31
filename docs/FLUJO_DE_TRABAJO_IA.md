# Cómo trabajamos con IA en OpMap (desde 2026-10-11)

Este documento explica el flujo de trabajo con Claude Code en este repositorio, qué se instaló el
2026-10-11 y qué falta. Se basa en la guía oficial de buenas prácticas de Claude Code
(code.claude.com/docs/en/best-practices) y en el estado real del repo ese día.

## Diagnóstico de partida (2026-10-11)

Lo que ya estaba bien: CLAUDE.md versionado con reglas del dueño; rama por fase; despliegue automático
por push a `master`; tres scripts de comprobación (`ips:check` con Supabase falso, `fase2:check`,
`fase1:simulate`); TypeScript estricto; memoria persistente entre sesiones.

Lo que faltaba frente a las buenas prácticas:

| Problema | Evidencia | Efecto |
| --- | --- | --- |
| CLAUDE.md gigante | 1.109 líneas / 59 KB, con esquema de BD, histórico de 2025 y 4 fases completas | Se carga entero en cada sesión; las reglas importantes se pierden entre el ruido |
| Sin verificación determinista | Ningún hook, ningún CI (`.github/` no existía), pruebas no conectadas a nada | La única verificación era que el dueño mirara |
| Sin puerta de entrada a `master` | Merges locales de 2.000–9.000 líneas; 1 PR en toda la historia (bot de Vercel) | Un error llega a producción sin que nadie lo vea antes |
| Sin specs en el repo | El documento de producto vivía fuera (scratchpad de una sesión) | Cada sesión nueva reconstruye el contexto desde cero |
| Configuración de Claude solo local | `settings.local.json` con `rm:*` y `git push:*` permitidos; sin hooks, skills ni agentes | Nada compartible ni reproducible |
| Ruido en el repo | `providers-system.zip`, 8 notas `FIX_*.md` de 2025 en `web/`, `dev-server.log`, clave de Google en `.env.example` | Contexto gastado en basura; secreto expuesto |

## Qué se instaló

1. **CLAUDE.md corto (85 líneas)** con comandos, verificación, flujo y las reglas que no se deducen del
   código. Todo el resto se movió íntegro a `docs/` (ver `docs/README.md`).
2. **`npm run check`** (typecheck + lint + pruebas sin red) como la verificación única; `npm run test`
   apunta a `scripts/ips-routes-check.ts`.
3. **Hooks compartidos** (`.claude/settings.json` + `.claude/hooks/`):
   - `guard-edit.sh` (antes de Edit/Write): bloquea `.env*`, los GeoJSON generados y `database/hardening/`.
   - `typecheck.sh` (después de Edit/Write de `.ts/.tsx` en `web/`): corre `tsc` (≈3 s) y devuelve los
     errores a Claude en el momento.
   - `check-on-stop.sh` (al terminar el turno): si hay cambios sin confirmar en `web/`, exige que
     `npm run check` pase. Es la "puerta determinista" que recomienda la guía oficial.
   - Permisos: se permiten los comandos de verificación y lectura de git; se niegan lectura de `.env*`,
     `git push --force` y `git reset --hard`. Lo personal sigue en `settings.local.json` (ya ignorado).
4. **CI en GitHub Actions** (`.github/workflows/ci.yml`): en cada PR y push a `master` corre
   typecheck, lint y pruebas. Vercel sigue construyendo el preview de cada rama.
5. **Plantilla de PR** con checklist de evidencia, migraciones no aplicadas, costo de Google y estética.
6. **Skills**: `/verificar` (verificación con evidencia) y `/entregar` (commit + push + PR; solo manual).
7. **Plantillas** de spec (`docs/specs/TEMPLATE.md`) y de decisión (`docs/decisiones/TEMPLATE.md`).
8. **Limpieza**: notas viejas a `docs/archive/web/`, zip eliminado, logs y `tsbuildinfo` ignorados,
   clave de Google quitada de `.env.example` (sigue en el historial: hay que rotarla).

## El flujo, paso a paso

1. **Spec primero** para todo lo que toque varios archivos, una migración o una regla de negocio:
   `docs/specs/<fecha>-<tema>.md`. Truco oficial: "Entrevístame con AskUserQuestion y escribe la spec";
   luego sesión nueva para implementar. Cambios de una línea: directo.
2. **Explorar → planear → implementar**: modo plan para lo incierto; sin plan para lo obvio.
3. **Verificar con evidencia**: `npm run check` siempre; captura del preview si se ve; prueba nueva si
   es regla de negocio. Claude muestra la salida, no la resume.
4. **Entregar por PR** (`/entregar`): rama → push → PR con plantilla → CI verde → el dueño revisa y hace
   merge (= producción).
5. **Sesiones cortas**: `/clear` entre tareas distintas; tras dos correcciones fallidas, sesión nueva con
   mejor prompt. Investigaciones grandes con subagentes para no llenar el contexto.
6. **Revisión adversaria** antes de cerrar PRs grandes: `/code-review` o un subagente que compare el
   diff contra la spec y reporte solo huecos de corrección.

## Superpowers (desde 2026-10-30)

El 2026-10-30 el dueño pidió que el método de trabajo use Superpowers (obra/superpowers 7.0.1, copiado en
`.claude/skills/`; ver `docs/superpowers.md`). Donde difiera de "El flujo, paso a paso", manda esto. Por qué:

- **Aclarar antes de construir.** `brainstorming` convierte el pedido en la spec que el dueño aprueba. Claude
  construye lo que el dueño quiere, no lo que cree que quiere.
- **Pruebas primero y causa raíz.** `test-driven-development` y `systematic-debugging` evitan los arreglos a ciegas.
  Las reglas de negocio quedan probadas en `web/scripts/*-check.ts`.
- **Evidencia antes de "listo".** `verification-before-completion` es el mismo `npm run check` con su salida que ya
  pedía este repo.

El orden: brainstorming → spec → plan (`docs/planes/`, sin aprobación aparte) → pruebas primero con `executing-plans`
→ `npm run check` → `revisor` → `/entregar`.

Lo que Superpowers haría distinto y aquí no:
- **Merge local** (`finishing-a-development-branch`): aquí se entrega por PR con `/entregar`, porque el merge a
  `master` publica en producción.
- **Worktree siempre**: aquí solo cuando otra sesión trabaja a la vez. Dos sesiones en la misma carpeta se pisan al
  cambiar de rama; una sola, no.
- **Subagentes por defecto**: aquí solo bajo pedido, porque cuestan más tokens.
- **Carpetas `docs/superpowers/`**: aquí `docs/specs/` y `docs/planes/`.

La tabla paso → skill → cuándo no está en `docs/superpowers.md`, y `CLAUDE.md` manda sobre las skills.

## Linear Agents: veredicto

Linear for Agents (linear.app/agents) convierte a los agentes en "miembros" del espacio de trabajo: se
les asigna un issue, trabajan, y devuelven un PR; la persona sigue siendo la responsable. No hay
integración oficial de Claude Code: las que listan son Cursor, Codex, Devin, Sentry y terceros (Cyrus,
Tembo, Replicas, Merlin, boxes.dev) que ejecutan Claude Code por ti, cada uno con su infraestructura y
su costo.

Para OpMap hoy (una persona, Claude Code de escritorio, producción que se despliega sola) la
recomendación es **no adoptarlo todavía**:

- El valor real de Linear es el issue como spec rastreable. Eso ya lo da GitHub Issues gratis y con
  `gh`, que Claude usa sin configuración.
- Delegar issues a un agente sin CI ni PR obligatorio solo acelera la llegada de errores a producción.
  Primero las puertas (hechas hoy), luego la delegación.
- Cuando haya 2+ personas o se quiera trabajar desde el celular, el camino más corto con lo que ya se
  tiene es Claude Code en la nube (sesiones remotas desde el issue) o el GitHub Action oficial
  (`@claude` en un PR o issue). Si se quiere Linear por la gestión de proyecto, úsese como tablero y
  conéctese después un runner (Cyrus es open source y corre en máquina propia).

## Recursos de la reunión (2026-10-11): qué aplica y qué no

| Recurso | Qué es | Veredicto para OpMap |
| --- | --- | --- |
| **ejemplo-harness-subagentes** (betta-tech) | Ejemplo chico: `leader` no edita, `implementer` implementa, `reviewer` revisa sin editar; estado en disco (`progress/`, `feature_list.json`), `CHECKPOINTS.md`, `init.sh` corre las pruebas reales | **Adoptado en parte.** El `revisor` ya existe (`.claude/agents/revisor.md`); la verificación ejecutable es `npm run check` + hooks; el estado en disco son las specs y `docs/decisiones/`. El `leader` que no edita se reserva para fases grandes (varias specs en paralelo); para cambios normales es sobrecarga. |
| **ECC** (affaan-m) | Harness enorme: 71 agentes, 311 skills, 97 comandos, hooks en Node, "memoria" con instintos, AgentShield | **No instalar como plugin.** Las descripciones de 311 skills se cargan en cada sesión y contradicen la regla de contexto corto; mezcla adaptadores para Codex/Cursor que no usamos; `/astra-review` manda diffs a OpenAI; el propio README avisa de re-subidas con malware. Tomar ideas sueltas: hook de typecheck tras editar (ya hecho), agente `security-reviewer` (candidato), guardar estado antes de compactar (cubierto con la sección "Al compactar" de CLAUDE.md). |
| **Guía de orquestación (hub-and-spoke)** | Un coordinador reparte a subagentes aislados que no comparten nada; todo pasa por el coordinador | **Es lo que ya hace la herramienta `Agent` de Claude Code.** Regla práctica: el subagente solo sabe lo que va en su prompt; si falla, revisar qué le pasaste. Y cuidado con el costo: la auditoría de octubre corrió 332 agentes y agotó la cuota; asignar modelo por etapa y batchear. |
| **Orca** (onorca.dev) | IDE libre (MIT) para correr varios agentes CLI en paralelo, cada uno en su worktree, con browser y diff integrados | **No hace falta hoy.** El app de escritorio de Claude ya corre sesiones en paralelo con worktree aislado. Tiene sentido si se mezclan Codex/Gemini o se quiere seguimiento desde el celular. |
| **Linear AI** (linear.app/ai) | Triaje automático de issues, Loops programados, sesiones de código, MCP para agentes externos | **Mismo veredicto que Linear for Agents:** herramienta de equipo. Con una persona, GitHub Issues + `gh` cubre el issue-como-spec. Reconsiderar con 2+ personas; su MCP permite asignar issues a agentes externos. |

## Pendientes (en orden)

1. **Rotar la clave de Google Maps** y restringirla por API y cuota (solo el dueño). Está en el
   historial de git.
2. **Proteger `master` en GitHub**: exigir PR, CI verde y 1 revisión; prohibir push directo. Es un
   ajuste de la configuración del repo, no de código.
3. **Primera spec real** con la plantilla (candidato: homologar topes 240/360 de las celdas de Bogotá).
4. **Partir `MapComponent.tsx`** (2.201 líneas) y `hospitals/[id]/page.tsx` (1.517): un archivo de ese
   tamaño cuesta mucho contexto por lectura y es donde más se equivoca la IA.
5. **Convertir `fase2:check` en prueba sin red** (hoy necesita Supabase) o dejarla como "prueba de
   aceptación manual" documentada.
6. **Subir `--max-warnings`** de lint a 0 cuando se arreglen las 14 advertencias de `react-hooks`.
7. Opcional: GitHub Action de Claude para revisión de PR; subagente `revisor` en `.claude/agents/`.
