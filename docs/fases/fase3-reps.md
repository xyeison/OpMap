# Fase 3 (2026-10-11): IPS por código de habilitación (sedes del REPS)

Pedido del dueño: "un NIT puede tener varias sedes, eso está mal… debe ser por código de
habilitación". La IPS correcta es la **sede** del REPS (Registro Especial de Prestadores, MinSalud),
identificada por su código de habilitación de 12 dígitos (= código de prestador de 10 + número de
sede de 2; la sede principal suele terminar en `01`).

Migración `database/migrations/2026-10-11_0600_fase3_reps.sql` (rollback
`2026-10-11_9930_reps_rollback.sql`). **Aplicada** en Supabase el 2026-10-11 (aditiva: tabla nueva,
columnas nuevas, índices y restricciones; no toca datos existentes ni `updated_at`).

## Modelo

- **`reps_sedes`** (PK `codigo_habilitacion`): copia del CSV de sedes del REPS con nombres limpios
  (`codigo_prestador`, `nombre_prestador`, `nombre_sede`, `tipo_id`, `nit` sin DV, `naturaleza`, `ese`,
  `municipio_sede` DANE 5, `direccion_sede`, `clase_prestador`, `fecha_corte`, `imported_at`, …) más
  `nombre_busqueda` (sede + prestador normalizados, sin tildes) para el buscador. Índices por `nit` y
  `municipio_sede`. RLS activado sin políticas, sin privilegios para anon/authenticated; solo
  `service_role`.
  - Se cargan las clases **IPS**, **Objeto Social Diferente** y **Transporte Especial de Pacientes**
    (22.164 sedes en el corte del 12-mar-2026, todas con NIT). **No** se cargan los 54.657
    "Profesionales Independientes" (personas naturales con cédula y datos de contacto personales; no
    son IPS objetivo y ningún NIT de `hospitals` estaba solo entre ellos).
- **`hospitals`**, 4 columnas nuevas:
  - `reps_code` text UNIQUE (12 dígitos): la sede que ES esta IPS. "FK suave": sin FOREIGN KEY porque
    `reps_sedes` se recarga cada mes; la app valida al vincular y el informe marca huérfanas.
  - `nit` text **GENERADA** desde `code` (`substring(btrim(code) from '^(\d{9})(?:-\d{1,2}|\d)$')`,
    igual que `nitFromCode()` en `web/lib/reps-match.ts`). No se escribe nunca. Las 787 IPS tienen NIT.
  - `reps_matched_at` timestamptz, `reps_match_status` ∈ `matched` | `ambiguous` | `unmatched`
    (NULL = sin evaluar). CHECK: `matched` ⇔ `reps_code` no nulo.
- Ojo: el número tras el guion de `hospitals.code` **no es el DV de la DIAN** (698 de 787 terminan en
  `-1`; 647 no cuadran con el módulo 11) **ni el número de sede** (de las 79 IPS vinculadas con sufijo
  distinto de 1, solo 9 coinciden con el número de sede de su código de habilitación). El cruce usa
  solo los 9 dígitos del NIT.

## Reglas del cruce (`web/lib/reps-match.ts`, funciones puras)

Por IPS con NIT, contra las sedes de ese NIT:

1. 1 sede → `matched` (si está en otro municipio se avisa: suele ser el municipio de la IPS mal puesto).
2. Varias: las del municipio de la IPS (`municipio_sede = municipality_id`; en Bogotá 11001, sin
   localidad en el REPS). Si queda 1 → `matched`.
3. Varias en el municipio (o ninguna: se comparan todas) → nombre normalizado (sin tildes, sin
   S.A.S./E.S.E./IPS/CLINICA/HOSPITAL/SEDE y conectores; tolera una errata en palabras largas):
   - una sola con los mismos tokens → `matched`; si varias los comparten, gana la única escrita igual
     que la IPS (nombre completo o mismas palabras salvo forma societaria);
   - si no, la mejor con parecido ≥ 0,8 y ventaja ≥ 0,15 (o ≥ 0,65 y ventaja ≥ 0,5) → `matched`;
   - si no → `ambiguous`, con **sugerida** (sedes con el mismo nombre: la de código más bajo; si no, la
     de mayor parecido sin empate). La sugerida **no** se aplica sola: la ficha la preselecciona.
4. Ninguna sede con ese NIT → `unmatched`.

Una sede, una IPS: si dos IPS piden la misma, gana la más fuerte; con empate, las dos quedan
`ambiguous`. Las IPS que ya tienen `reps_code` (automático o manual) no se tocan y su sede no se ofrece
a otras. El cruce se repite en vueltas hasta que no vincula nada nuevo (lo vinculado en una vuelta deja
de competir en la siguiente).

## Scripts (desde `web/`, sin Google)

- `npx tsx scripts/reps-load-sedes.ts --file <csv> [--dry-run] [--prune]`: upsert idempotente por
  `codigo_habilitacion` en lotes de 1.000. `--prune` borra sedes que no vienen en el archivo (solo si la
  carga terminó sin errores).
- `npx tsx scripts/reps-match.ts [--apply]`: informe en `REPS_OUTPUT_DIR/reps-match-report.md`
  (conteos, método, ambiguas con sugerida, sin cruce con pista de sede parecida de otro NIT, sede en
  otro municipio, huérfanas, simulación desde cero y vínculos que difieren de ella). `--apply` escribe
  `reps_code`/`reps_match_status`/`reps_matched_at` en las vinculadas y solo el estado en ambiguas y sin
  cruce; nunca pisa un `reps_code` existente y no reescribe estados que no cambian. Las IPS
  **desvinculadas a mano** (su último `hospital_history.changes.reps_link` tiene `after.reps_code = null`)
  quedan fuera del cruce y de `--apply`: el mantenimiento mensual no deshace esa corrección. El informe
  las lista aparte. Para volver a vincularlas, hacerlo desde la ficha.
- `npm run reps:check` (= `npx tsx scripts/reps-check.ts`): pruebas puras (normalización, NIT, CSV,
  casos del cruce, vueltas, idempotencia).

Resultado aplicado el 2026-10-11 (corte REPS 12-mar-2026): **730 vinculadas** (332 NIT con una sede,
66 una sola en el municipio, 321 mismo nombre, 11 nombre parecido), **35 ambiguas** (29 con
sugerida), **22 sin cruce** (UPRES y hospitales militares/policía, que no están en el REPS, y NIT que
no aparecen en el corte). 2 vinculadas con la sede en otro municipio (Sanasalud: El Banco ↔ Plato;
San Vicente de Paul Rionegro registrada en Medellín).

## API

- `GET /api/hospitals/[id]/reps-link` (`hospitals:view`): sede vinculada, candidatas del mismo NIT
  ordenadas (mismo municipio, parecido, código; sede principal; ya vinculada a otra IPS) y evaluación
  en vivo con la sugerida.
- `PATCH /api/hospitals/[id]/reps-link` (`hospitals:edit`) `{ reps_code }` vincula (la sede debe
  existir en `reps_sedes` y estar libre: 400/409; avisa si el NIT o el municipio no coinciden);
  `{ reps_code: null }` desvincula (queda `ambiguous` si su NIT tiene sedes, si no `unmatched`).
  Registra el cambio en `hospital_history` (action `edited`, `changes.reps_link`). Además deja los
  datos del REPS coherentes con la sede: las filas de `hospital_services`/`hospital_capacity` de la sede
  anterior quedan con `hospital_id = NULL`, las ya importadas de la sede nueva pasan a la IPS y se
  recalculan `service_flags`, `reps_services_count`, `quirofanos`, `reps_beds` y `reps_updated_at`
  (`afterRepsLinkChange` en `app/api/_lib/reps.ts`). Si falla, avisa de que hay que reimportar.
- `GET /api/hospitals/reps/summary` (`reps:manage`: admin y data_manager desde el 2026-10-31): conteos, corte, pendientes con motivo y
  sugerida, vinculadas con sede en otro municipio y huérfanas.
- `GET /api/hospitals/reps/sedes?q=&municipio=&limit=` (`hospitals:view`): buscador por código de
  habilitación (12), código de prestador (10), NIT (5–9) o palabras del nombre (sede o prestador).
- `GET /api/hospitals` y `GET /api/hospitals/[id]` devuelven además `nit`, `reps_code`,
  `reps_match_status` y `reps_matched_at` (`select('*')`). `POST /api/hospitals` y
  `PUT /api/hospitals/[id]` aceptan `reps_code` opcional (12 dígitos; mismas validaciones, queda
  `matched`; en PUT `null` desvincula). PUT hace lo mismo que PATCH `/reps-link` al cambiar el
  vínculo: historial y datos del REPS de la sede.

## UI

- Ficha de IPS: sección **"Sede REPS"** (`web/components/RepsSedeSection.tsx`): código de
  habilitación, nombre de sede, prestador y NIT, dirección, naturaleza (ESE), fecha de corte. Si es
  ambigua o sin cruce: lista de sedes del mismo NIT (sugerida preseleccionada), buscador por nombre /
  NIT / código (por defecto en el municipio de la IPS) y botón "Vincular". Vinculada: "Cambiar sede" y
  "Desvincular". Editar requiere `hospitals:edit`.
- **`/hospitals/reps` "Cruce REPS"** (`reps:manage` desde el 2026-10-31: el REPS es de administración; enlace en la cabecera de /hospitals): tarjetas
  por estado (filtran la tabla), tabla de pendientes con motivo, sugerida y enlace a la ficha, y lista de
  vinculadas para revisar.

## Mantenimiento mensual

Con cada corte nuevo del REPS: `reps-load-sedes.ts --file <nuevo csv> --prune` → `reps-match.ts`
(revisar informe) → `reps-match.ts --apply`. Las IPS nuevas entran como "Sin evaluar" hasta el
siguiente `--apply`, o se vinculan a mano desde su ficha. No cambia la asignación de IPS a zonas.
