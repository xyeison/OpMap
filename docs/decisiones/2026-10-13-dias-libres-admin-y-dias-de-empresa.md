# 2026-10-13 – El administrador sí se aprueba sus días libres; los días de empresa los decide la dirección o RR. HH.

**Contexto**: al cerrar la Fase 2 de la app de visita (`docs/fases/fase7-visitas-f2-config-calendario.md`) quedaron
dos preguntas: si el administrador, cuando su usuario está enlazado a un Ejecutivo Comercial, puede registrarse y
aprobarse sus propios días libres (la regla era que nadie se aprueba a sí mismo), y si el 24 y el 31 de diciembre
se cargan como días no laborables de la empresa.

**Decisión del dueño (2026-10-13)**:
1. **El administrador sí** puede registrarse y aprobarse sus propios días libres. Para los demás que aprueban
   (dirección comercial, recursos humanos) sigue la regla: sus días los aprueba otra persona.
2. **Los días de empresa (24 y 31 de diciembre u otros) los decide la dirección comercial o recursos humanos** en
   Calendario; el sistema no los carga solo.

**Consecuencias**: `puedeAprobarseASiMismo(role)` en `web/lib/visits-rules.ts` (solo `admin`), usada por
`POST /api/dias-libres` y `POST /api/dias-libres/revisar`; pruebas en `web/scripts/visits-check.ts` y
`web/scripts/visits-api-check.ts` (sección 9c). Sin migración: la regla vive en la API. Nada que sembrar para
diciembre.
