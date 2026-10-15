# 2026-10-14 – La app de visita tiene agenda, y "visita agendada" es un indicador

**Contexto**: la spec aprobada de la app de visita (`docs/specs/2026-10-12-app-de-visita-opmap.md`, sección 8,
"Qué no se hace") dejó fuera la agenda de VMO, con sus medias horas y ruteros. Al probar la app, el dueño escribió:
"ya yo tengo un agendamiento y tengo que elegir el médico con el cual yo hablé, que en teoría debería estar en la
agenda. Ahora, si no está en la agenda, puede ser una visita extra… Visita agendada, visitas no agendadas, y eso es un
indicador. De mis 100 visitas, cuántas fueron agendadas anteriores".

**Decisión del dueño (2026-10-14)**:
1. Cada Ejecutivo Comercial planea sus visitas en una agenda.
2. Al reportar, la persona primero dice dónde está y elige la cita: el médico con el que habló.
3. Si la visita no estaba en la agenda, se reporta igual como visita no agendada.
4. El porcentaje de visitas agendadas es un indicador.

**Consecuencias**:
- Se reemplaza la línea "agenda en medias horas y ruteros" de lo que no se hace: ahora hay una agenda sencilla, por
  día con hora opcional y sin ruteros.
- Reportar empieza por el sitio.
- La definición de "agendada" la tomó Claude: cita creada antes del día de la visita. El dueño puede cambiarla.
- Detalle y criterios en `docs/specs/2026-10-14-agenda-dictado-y-marca.md`.

**Dónde vive en el código**:
- Migración `database/migrations/2026-10-14_0840_visitas_agenda.sql`, que crea la tabla `visitas_agenda`, las
  funciones `agenda_crear` y `agenda_cancelar`, y el vínculo en `visitas_registrar`.
- Rutas `/api/me/agenda`.
- Pantallas Hoy, Agenda y Reportar en `mobile/`.
- Indicador en `/api/me/numeros`.
- Pruebas en `web/scripts/reporte-check.ts` y `reporte-api-check.ts`.
