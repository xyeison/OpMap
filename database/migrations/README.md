# Migraciones — Fase 1: zonas y equipo

> **ESTADO: NADA DE ESTO SE HA EJECUTADO.** Los scripts se generaron el 2026-10-10 a partir del
> estado vivo del proyecto `norvxqgohddgsdkggqzq`, consultado solo con `SELECT`. No se ha lanzado
> ningún DDL/DML contra la base. Ejecutarlos es decisión del dueño.

## Modelo

La Fase 1 separa tres cosas que hoy se mezclan en el "KAM":

| Concepto | Dónde vive | Nota |
|---|---|---|
| **Zona** (geografía, ciudad base, tiempo de viaje) | `kams` (no se renombra) | En la UI "KAM" pasa a llamarse **Zona**; la tabla `zones` actual se muestra como **Región**. En código sigue siendo `kam_id`. |
| **Persona** (ejecutiva) | `executives` | Zona base (`base_kam_id`), usuario de la app opcional, id de empleado de Odoo, estado `active` / `placeholder` / `inactive`. |
| **Línea** | `business_lines` | PerOssal, Reemplazo articular, Medicina deportiva, Columna, Trauma. |

Tablas de relación: `executive_lines` (qué líneas lleva cada ejecutiva), `line_zones` (en qué
zonas opera cada línea según los equipos), `coverage` y `coverage_overrides` (se crean ahora, se
llenan en la Fase 2).

Las 6 tablas nacen con **RLS activado, sin políticas y sin privilegios para `anon`/`authenticated`**:
solo el servidor las usa con `service_role`. Es lo mismo que fija `database/hardening/02` y `03`.

## Orden

| # | Archivo | Qué hace | Destructivo |
|---|---|---|---|
| 1 | `2026-10-10_0100_fase1_schema.sql` | Crea las 6 tablas, índices, triggers `updated_at`, RLS, REVOKE y comentarios | No |
| 2 | `2026-10-10_0200_fase1_seed.sql` | 5 líneas, 11 ejecutivas + 2 placeholders, líneas por ejecutiva, matriz línea × zona (16 zonas × 5 líneas = 80 filas) | No |
| 3 | `2026-10-10_0300_fase1_zonas.sql` | Activa Cartagena (13001) e Ibagué (73001); borra `KAM Barranquilla MD` y `Kam Valledupar MD` tras comprobar que no tienen datos ligados | Sí (borra 2 filas de `kams`, sin dependientes) |
| — | `2026-10-10_9900_fase1_rollback.sql` | Sección A: borra las 6 tablas. Sección B: re-desactiva Cartagena e Ibagué | Sí |

`0300` es independiente de `0100`/`0200` y puede ir antes o después, pero el orden recomendado es
el de la tabla. **Inmediatamente después de `0300` hay que recalcular las asignaciones desde la
app** (botón de recálculo de la página principal → `POST /api/recalculate-simplified`): el script
no toca `assignments`, y hasta recalcular Cartagena e Ibagué aparecen en el mapa con 0 IPS.

Cuándo ejecutar: `0100` y `0200` antes de desplegar el código que usa `/api/business-lines` y
`/api/executives` (sin las tablas esas rutas fallan). `0300` en una ventana en la que se pueda
recalcular enseguida.

## Cómo ejecutar

1. Supabase Dashboard → SQL Editor (rol `postgres`): pegar el archivo entero y ejecutar.
   O bien: `psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f <archivo>`.
2. Cada archivo es una transacción (`BEGIN … COMMIT`) con comprobaciones al final. Si algo no
   queda como se espera, lanza `RAISE EXCEPTION` y **no se aplica nada de ese archivo**.
3. Todos son re-ejecutables. Matices de `0200`:
   - No pisa lo editado desde la app en campos de gestión (líder de línea, `max_reach_minutes`,
     `active`, estado de la ejecutiva, `user_id`/`notes` ya rellenados).
   - `executive_lines` y `line_zones` solo añaden; nunca quitan lo que se haya desmarcado.
   - Los placeholders se identifican por `full_name`. Si al contratar se renombra
     "Nueva Barranquilla" o "Nueva Bogotá" (lo recomendado), volver a correr `0200` crearía otro
     placeholder. **No re-ejecutar `0200` una vez se empiece a editar desde la app.**
4. Mensajes esperados (`NOTICE`): `Fase 1 seed OK: 5 líneas, 13 ejecutivas, 16 zonas en la matriz
   (80 filas)` y `Fase 1 zonas OK. SIGUIENTE PASO: recalcular asignaciones desde la app.`

## Datos comprobados con SELECT (2026-10-10)

- Ninguna de las 6 tablas existe todavía. `update_updated_at_column()` existe. PostgreSQL 17.4.
- Zonas por `area_id` (excluyendo las filas "MD"): 05001 Medellín, 08001 Barranquilla,
  1100102 Chapinero, 13001 Cartagena, 20001 Valledupar, 23001 Montería, 52001 Pasto,
  54001 Cúcuta, 66001 Pereira, 68001 Bucaramanga, 73001 Ibagué, 76001 Cali — una fila cada una.
  08001 y 20001 tienen además la fila "MD"; `0200` las descarta por nombre (`\sMD$`).
- Usuarios existentes en `users`: líderes `m.cobo@`, `sramirez@`, `mn@`; ejecutivas
  `carmenbarrios@` y `m.buelvas@`. Las otras 9 ejecutivas no tienen usuario: quedan con
  `user_id = NULL` hasta que se les cree.
- `KAM Barranquilla MD` y `Kam Valledupar MD`: inactivas, 0 asignaciones, 0 distancias,
  0 asignaciones forzadas, 0 visitas. `KAM Cartagena` tiene 191 visitas históricas (no se borra).
- Neiva (41001) sigue activa (zona vacante); Sincelejo (70001) sigue inactiva.

## Cómo volver atrás

`2026-10-10_9900_fase1_rollback.sql`, por secciones (cada una es su propia transacción):

- **A** — borra las 6 tablas (con todos sus datos) y quita el comentario de `kams`.
- **B** — re-desactiva Cartagena e Ibagué; luego **recalcular desde la app**. Las zonas MD
  borradas no se reactivan con un UPDATE (ya no existen); al final de B va comentado el INSERT
  con sus valores exactos por si hicieran falta.
