# 2026-10-14 – Las Regiones salen de OpMap

**Contexto**: las Regiones (tabla `zones`) quedaron de una versión anterior. Hay 5 en la base y ninguna zona tiene
una asignada. Ese mismo día el dueño ya había pedido borrar su página: "las regiones… quedó una versión anterior, toca
borrarlo". Después lo confirmó: "Eso de región deberíamos quitarlo al fin".

**Decisión del dueño (2026-10-14)**: se quitan de la web las Regiones, es decir, la página, el botón y la columna en
Zonas, el modo Regiones del mapa, la API y los permisos `zones:*`.

**Consecuencias**:
- La tabla `zones` y la columna `kams.zone_id` se quedan en la base, sin uso. Borrarlas sería otra migración, con su
  rollback, y solo si el dueño lo pide.
- La regla de terminología "tabla `zones` → Región" de `CLAUDE.md` deja de aplicar en la interfaz.

**Dónde vive**: la spec `docs/specs/2026-10-14-quitar-regiones.md`.
