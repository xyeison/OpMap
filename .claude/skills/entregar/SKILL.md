---
name: entregar
description: Entrega el trabajo de la rama actual de OpMap como pull request a master: verifica, hace commit en español, empuja la rama y abre el PR con la plantilla. Solo se invoca a mano.
disable-model-invocation: true
---
# Entregar la rama actual como PR

1. Confirma que NO estás en `master` (`git branch --show-current`). Si lo estás, crea una rama `feat/…`,
   `fix/…` o `chore/…` antes de seguir.
2. Ejecuta `/verificar`. No sigas si `npm run check` falla.
3. Revisa `git status` y `git diff --stat`; no incluyas archivos ajenos al cambio (ni `.env*`, ni logs).
4. Commit en español con prefijo convencional y cuerpo que explique el porqué. Termina el mensaje con la
   línea de atribución vigente de la sesión.
5. `git push -u origin <rama>`. La cuenta activa de `gh` puede no tener permiso sobre
   `xyeison/OpMap`; si el push falla por permisos, usa un credential helper de una sola vez con
   `gh auth token -u xyeison` sin dejar configuración persistente.
6. Abre el PR con `gh pr create --base master --fill` y completa la plantilla
   (`.github/pull_request_template.md`): evidencia de verificación, migraciones no aplicadas, costo de
   Google si aplica, cambios de estética del mapa.
7. Entrega al dueño: enlace del PR, URL del preview de Vercel de la rama
   (`https://op-map-git-<rama-con-guiones>-xyeisons-projects.vercel.app`) y qué debe autorizar antes
   del merge. Nunca hagas el merge a `master` sin que el dueño lo pida: eso despliega a producción.
