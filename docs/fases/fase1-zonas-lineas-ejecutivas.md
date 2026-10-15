# Fase 1 (2026-10-10): zonas, líneas y ejecutivas

Rama `fase1/zonas-y-equipo`. Migraciones en `database/migrations/2026-10-10_*` (0100 esquema,
0200 seed, 0300 zonas, 9900 rollback; ver su README). **Escritas, no aplicadas** a Supabase.

- **Modelo**: ZONA (geografía + ciudad base) ≠ PERSONA (ejecutiva) ≠ LÍNEA de negocio.
  - La tabla `kams` NO se renombra: **cada fila de `kams` es una ZONA** (ciudad base = `area_id`).
    En la UI "KAM" se muestra como "Zona" y la tabla `zones` como "Región"; en código siguen
    `kam_id`/`kams`, rutas `/kams` y `/zones` sin cambios. (2026-10-14: la página `/zones` "Regiones" se quitó
    por ser de una versión anterior; ese mismo día el dueño pidió quitar las Regiones del todo: sin `/api/zones`,
    sin modo Regiones en el mapa ni permisos `zones:*`. La tabla `zones` queda sin uso;
    `docs/specs/2026-10-14-quitar-regiones.md`.)
  - `business_lines`: PerOssal, Reemplazo articular, Medicina deportiva, Columna, Trauma
    (líder opcional, `max_reach_minutes` = 240 por defecto).
  - `executives`: personas (status `active` | `placeholder` = vacante por contratar | `inactive`;
    nunca se borran, la baja pone `left_at`). `base_kam_id` = zona donde vive; `odoo_employee_id`.
  - `executive_lines` (N:M ejecutiva↔línea) y `line_zones` (en qué zonas hay equipo de cada línea).
  - `coverage` y `coverage_overrides`: **creadas en Fase 1, vacías; se llenan en Fase 2**
    (cálculo de quién cubre cada zona por línea + ajustes manuales del líder).
- **Seguridad**: las 6 tablas con RLS activado, sin políticas y REVOKE a anon/authenticated;
  solo el servidor (service_role) las usa.
- **API**: `GET /api/business-lines`, `PATCH /api/business-lines/[id]`,
  `PUT /api/business-lines/[id]/zones`, `GET|POST /api/executives`,
  `PATCH|DELETE /api/executives/[id]` (DELETE = baja lógica). Permisos `lines:view|edit`,
  `executives:view|edit` en `web/lib/permissions.ts`.
- **UI**: páginas `/lines` (matriz línea × zona) y `/executives`.
- **Zonas (0300)**: activa Cartagena (13001) e Ibagué (73001) y borra las filas "MD" vacías.
  Simulación de solo lectura (`npm run fase1:simulate`): 71 IPS cambian (37 a Cartagena, 34 a
  Ibagué), ninguna se mueve entre otras zonas. Tras aplicar 0300 hay que recalcular desde la app.
- **No cambia** el algoritmo de asignación de IPS ni la estética del mapa (colores, marcadores).

_Extraído de CLAUDE.md el 2026-10-11 (texto íntegro, solo reubicado)._
