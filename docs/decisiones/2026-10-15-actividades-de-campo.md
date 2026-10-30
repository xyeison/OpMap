# 2026-10-15 – Una sola app de actividades de campo: las líderes agendan, la directora vigila y lo programado se cierra, no se mueve

**Contexto**: el dueño, el 2026-10-15, sobre la app de visita y la directora comercial:

> "No me parece que sea una aplicación aparte… es muy parecido a lo que está ahorita. Los ejecutivos comerciales
> tienen la capacidad de agendar visitas médicas, que estaría mal decir que son visitas médicas, porque ellos no
> solamente visitan a médicos… también van a compras, visitan clientes. […] Los líderes podrían también tener la
> capacidad de agendar, de tener su agenda ahí."

> "¿Qué quiere saber la directora comercial? ¿Dónde están sus líderes? ¿Qué tienen planificado? […] Hacer dos
> aplicaciones vuelve más tedioso el tema. Debería ser una."

Ese día solo un Ejecutivo Comercial con zona podía agendar y reportar, y solo visitas médicas e institucionales. La
directora llevaba un Excel ("Tracker Líderes") con 212 filas de las 5 líderes. Claude escribió la spec
`docs/specs/2026-10-15-actividades-de-campo.md` con preguntas abiertas, y el dueño respondió A1–A17.

**Decisión del dueño (2026-10-15)**:

- **Concepción**: una sola aplicación, la de hoy, para Ejecutivos Comerciales y líderes. No es un "módulo de visitas
  médicas": son las **actividades de campo** de la gente comercial (visitas, juntas, cenas, capacitaciones, congresos,
  cirugías, correrías y otras).
- **A1**. La directora comercial no agenda ni reporta: solo vigila.
- **A2**. Una líder no ve a las otras líderes. Sí ve a los Ejecutivos Comerciales de su línea.
- **A3**. Mapa de calor de dónde ha estado cada persona (líderes y Ejecutivos Comerciales), solo para la directora:
  "ver que en 6 meses solo ha estado en Barranquilla y Cartagena y no ha visitado otras ciudades importantes". El dueño
  lo autoriza. Va en `/equipo`, no en el mapa de asignación ni en su estética.
- **A4**. Sin límite de tiempo para agendar hacia adelante.
- **A5**. "Planeado con tiempo" = 7 días o más de anticipación, porque los tiquetes de un día para otro son más caros.
  Es un indicador, no una restricción.
- **A6**. La correría puede ser de todo el día. En la correría la líder suele visitar junto con el Ejecutivo Comercial
  de la zona, que debería tener esas visitas agendadas: se puede indicar con quién va y ver sus visitas agendadas de
  esos días, sin complicarlo.
- **A7**. No se reprograma moviendo la fecha: se pierde el registro de lo que pasó ese día. Lo programado se cierra con
  su resultado: hecha (efectiva), o no efectiva / no se hizo, con motivo. Si hace falta otra fecha, se crea una
  actividad nueva enlazada a la anterior. Si se programó por error, se puede eliminar y no cuenta en los indicadores.
  Igual para las correrías: "programé una correría y no pude ir" se cierra como no hecha, con motivo.
- **A8**. Cancelar exige motivo.
- **A9**. Cena: al planear se indican los médicos invitados; al reportar, cuáles asistieron y cuáles no. Solo médicos
  de su unidad de negocio: una líder solo agrega médicos de su línea o de sus Ejecutivos Comerciales (una líder de
  medicina deportiva no puede invitar a un médico que no es de esa línea).
- **A10**. No se registra el costo de la cena por ahora.
- **A11**. Los reportes tardíos de actividades que no son visita se aceptan hasta 7 días, marcados "tarde".
- **A12**. Las líderes tienen días libres (con motivos como congreso o viaje al exterior) y metas de correrías.
- **A13**. Paola tiene dos metas separadas: como Ejecutivo Comercial (vende 2 productos de Sustitutos óseos, de forma
  transitoria mientras se importa Trauma) y como líder de su unidad.
- **A14**. Nombre de la app: duda entre "VG Campo" y "VG Tracker". Pendiente; no se cambia todavía.
- **A15**. No se importa el histórico del Excel. Se quita esa fase.
- **A16**. Al salir alguien de la empresa, se cancela lo que tenía planeado; la persona nueva vuelve a agendar todo.
- **A17**. Sí a subtipos institucionales nuevos como "Cobro / cartera" (ir a un cliente a cobrar) y "Seguimiento
  comercial" (ir a una clínica a hacer seguimiento).
- **Del mismo día, siguen en pie**: dos citas no se cruzan en su media hora (bloqueo en el servidor, 409); la cita
  lleva hora, salvo la correría y el congreso de todo el día; la app toma la dirección visual A, estilo Uber.

**Consecuencias**:

- **Reemplaza**:
  - la idea de "reprogramar con historial" (estado `reprogramada`) de la versión anterior de la spec, y la D3 de
    `docs/specs/2026-10-15-usabilidad-y-agenda-con-hora.md` (`agenda_reprogramar`, que conservaba `created_at`);
  - la D4 de esa misma spec (choque solo como aviso);
  - la decisión 3 de `docs/specs/2026-10-14-agenda-dictado-y-marca.md` (agendar de hoy a hoy + 30);
  - la decisión 46 de `docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md` (motivo de cancelación opcional).
- **Ciclo de vida de lo programado**, igual para citas y actividades: programada → hecha (efectiva o no efectiva) | no
  se hizo (con motivo) | cancelada (con motivo) | eliminada por error (no cuenta). "Otra fecha" es una actividad nueva
  con "viene de". Nada se borra de la base: eliminar deja la fila con su estado, para auditoría.
- **Quien hace la actividad es la persona** (`users.id`), con el Ejecutivo Comercial opcional. Paola tiene una sola
  agenda y reporta como líder o como Ejecutivo Comercial según las líneas.
- **La directora** pierde `visits:report` y gana `/equipo` (Hoy, Próximas semanas, Tablero y Mapa de calor). Las
  líderes ven `/equipo` sin el Mapa de calor, solo con ellas mismas y los Ejecutivos Comerciales de su línea.
- **Datos**: tres migraciones con rollback, que se aplican solo con autorización del dueño y en la ventana del
  despliegue de su fase: `0850_persona_de_campo_y_agenda` (9945), `0860_actividades_de_campo` (9946) y
  `0870_lideres_dias_libres_y_metas` (9947).
- **Costo**: Google Maps 0 (la ciudad sale de la sede o de la lista DANE; el mapa de calor usa la cabecera del
  municipio). OpenAI y Claude, igual que hoy por dictado.
- **Fases**: F0 datos (subtipos de A17), F1a base de datos + API, el estilo Uber de la app, F1b la app, F2a y F2b las
  actividades, F3 días libres y metas de las líderes, F4 `/equipo`, F5 voz. Cada una se despliega sola.
- **Descartado**: importar el Excel (A15), costo de las cenas (A10), mover citas de fecha (A7), rastreo de ubicación
  en segundo plano, cambiar el nombre de la app por ahora (A14).
- **Queda abierto** (spec, "Lo que sigue abierto"): el nombre de la app; la ventana para eliminar por error; qué son
  "ciudades importantes" (se propone 200.000 habitantes o más); los médicos de Trauma, que no tiene Ejecutivos
  Comerciales ni médicos y con A9 deja a su líder sin médicos que invitar o visitar; 2026 en el selector del mapa de
  asignación.

**Dónde vive en el código**: todavía en ninguna parte; se implementa por fases según
`docs/specs/2026-10-15-actividades-de-campo.md`. Lo que lo va a proteger:

- F1a: la migración 0850 (`persona_lineas`, `persona_de_campo`, `medico_de_lineas`, `agenda_choque`, `agenda_cerrar`,
  `agenda_eliminar`, `agenda_otra_fecha`, `agenda_cancelar` con motivo y los disparadores de salida) con su bloque DO
  `P0850`; `web/lib/persona-campo.ts` y `web/lib/agenda-ciclo.ts` con `web/scripts/persona-campo-check.ts`,
  `web/scripts/agenda-ciclo-check.ts` y `web/scripts/reporte-api-check.ts`.
- F2a: la 0860 (`actividades`, `actividad_asistentes` con invitado y asistió) y `web/scripts/actividades-check.ts`.
- F3: la 0870 (días libres por persona y `config_lideres`).
- F4: `web/lib/equipo.ts` con `web/scripts/equipo-check.ts` y `web/scripts/equipo-api-check.ts`; permisos `team:view`
  y `team:map`.
