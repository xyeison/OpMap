# Spec: Agendar con una sede que el médico aún no tiene  (2026-10-30)

**Estado**: aprobada por el dueño ("De una haz todo", 2026-10-30) | implementada (PR en revisión; revisor 2026-10-30: el error de vínculo al volver se ve bajo "¿Con quién?", la vuelta conserva fecha y hora, un 409 cuenta como vinculada y Nueva sede avisa si la vuelta venció)

## Problema
Al agendar una cita médica, el selector "Sede" solo ofrece las sedes que el médico ya tiene en OpMap. Si la líder sabe
que atiende en otra clínica (o en una que ni siquiera está en OpMap), no puede agendar ahí: la pantalla dice "Este
médico no tiene sedes en OpMap" o muestra una lista incompleta, y no hay salida. Pedido del dueño (captura de Agendar
con Juan, ortopedia, y la lista "Clínica Misericordia, San Rafael…"): *"si al agendar no veo una clínica donde el
doctor atiende, ¿qué propones para poder asociarlo a una clínica sede existente o crear una nueva?"*.

En Reportar esto ya existe (la tarjeta del médico ofrece "Atiende en [sede cercana]" y "Crear sede aquí" con el GPS
del sitio). Agendar es distinto en una cosa: normalmente no se está en la sede, así que el GPS no sirve para ubicarla.

## Resultado esperado
En Agendar, con un médico elegido, el selector "Sede" ofrece además "Buscar en OpMap" con lo que se escribe:
1. **Una sede que ya está en OpMap** (buscador por nombre de sede o de cuenta, el mismo de Nuevo médico): al tocarla
   queda vinculada al médico con rol "atiende" y elegida en la cita. En adelante aparece entre sus sedes (en Agendar,
   Reportar y la web).
2. **Crear la sede** cuando la búsqueda no encontró nada: la misma pantalla Nueva sede de Reportar, con lo buscado como
   nombre, pero con la **ubicación opcional**: si la líder está en la sede, la toma con un botón; si no, la sede nace
   "por confirmar" (origen `manual`, sin coordenadas) y el equipo de datos la ubica desde la web, como cualquier sede
   manual. Al volver a Agendar, la sede queda vinculada al médico y elegida, y el formulario conserva lo que llevaba.
Sin señal, vincular o crear avisa con el mensaje de error de la API y no encola nada (la cita misma tampoco se agenda
sin señal).

## Criterios de aceptación (se convierten en pruebas)
- [ ] Dado un médico elegido en Agendar, el selector "Sede" tiene "Buscar en OpMap" (`api.buscarSedes`) y, cuando la
      búsqueda no encuentra nada, "Crear la sede" con lo buscado.
- [ ] Dado que se toca una sede del buscador, se llama `POST /api/terceros/medicos/[id]/sedes` con rol `atiende`, la
      sede entra a las del médico (propio o traído del buscador) y queda elegida; si la API falla, el mensaje se ve
      junto al buscador y no cambia nada.
- [ ] Dado "Crear la sede", Agendar guarda su formulario en la vuelta y pide Nueva sede con `CLAVE_RETORNO_AGENDAR`,
      el nombre buscado y el médico.
- [ ] Nueva sede pedida por Agendar: no exige ni toma sola la ubicación; con ubicación manda `origen 'gps_app'` y
      coordenadas, sin ella manda sin origen ni coordenadas (`cuerpoSedeNueva`); al crear deja la sede en la vuelta
      (`sedeParaAgendar`) sin avisar a Reportar y vuelve atrás.
- [ ] Nueva sede pedida por Reportar: igual que hoy (ubicación obligatoria, `origen 'gps_app'`, aviso a Reportar).
- [ ] La vuelta a Agendar trae formulario, médico y sede una sola vez; vencida o sin guardar, nada.
- [ ] Al montarse con una sede en la vuelta y un médico en el formulario, Agendar la vincula y la elige.
- [ ] `sedesConVinculadas` junta las sedes del médico con las vinculadas en la pantalla sin repetir.

## Fuera de alcance
- "Es su consultorio" desde Agendar: crear la cuenta consultorio necesita el documento del médico, que la app no tiene
  para uno existente. Sigue en Nuevo médico y en la web.
- Sedes cercanas en Agendar (no se está en el sitio) y desvincular sedes (solo web, `terceros:manage`).
- Cambios en la API o en la base: `POST /api/terceros/sedes` ya acepta una sede sin coordenadas (nace con
  `ubicacion_confirmada = false`) y `POST /api/terceros/medicos/[id]/sedes` ya existe con `terceros:create`.

## Impacto
- Datos / migración: no.
- Costo Google Maps: 0 (vincular o crear una sede nunca llama a Google).
- Estética del mapa: no cambia (las sedes nuevas no entran a `hospitals` ni al mapa).
- Permisos / roles: ninguno nuevo; las líderes ya tienen `terceros:create`.

## Plan (archivos e interfaces)
- `mobile/lib/sede-del-medico.ts` (nuevo, puro): `sedesConVinculadas`, `cuerpoSedeNueva`, textos.
- `mobile/lib/retorno.ts`: la vuelta a Agendar lleva también `sedeId` (`sedeParaAgendar`); `PedidoCreacion.medico`.
- `mobile/app/(app)/agenda/nueva.tsx`: `buscarFuera` en el selector "Sede" (médico), `vincularSede`, `crearSede`,
  aplicar la sede de la vuelta.
- `mobile/app/(app)/sede/nueva.tsx`: ubicación opcional cuando el pedido viene de Agendar; `sedeParaAgendar`.
- `mobile/scripts/checks/23-sede-del-medico.ts` (nuevo) + registro en `correr.ts` y `movil-check.ts`.
- Docs: `docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md` (sección 0950/Agendar), `mobile/README.md`.

## Verificación final
`npm run check` en `mobile/` y en `web/`; preview web de `/campo` en el navegador: Agendar › médico › Sede › "Buscar
en OpMap" › vincular una sede y "Crear la sede" sin ubicación; captura.
