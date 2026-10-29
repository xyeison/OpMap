# Fase 2b (2026-10-11): municipios completos, anexo de territorio y versiones

Rama `fase2b/municipios-y-anexos`. Migración `database/migrations/2026-10-11_0500_fase2b_municipios_anexos.sql`
(rollback `2026-10-11_9920_fase2b_rollback.sql`, que va ANTES de 9910 y 9900; ver README). **Escrita,
no aplicada**. Orden de despliegue: aplicar 0500 → desplegar código → `cd web && npx tsx
scripts/fase2b-municipios.ts` (dry-run, sin Google) → el dueño autoriza el gasto con esa cifra →
`--run --max-elements N` → `--assign`.

- **Regla de negocio del dueño (va al contrato con cada Ejecutivo Comercial)**:
  - El mapa cubre TODOS los municipios, con dos intensidades: **con IPS objetivo** (color fuerte,
    hay que visitarlos; zona por la regla de mayoría de siempre) y **de alcance** (color suave, sin
    IPS hoy; si mañana abre una clínica, ya se sabe qué zona la visita).
  - Los municipios SIN IPS se reparten por **TIEMPO REAL DE CARRETERA** (Google Distance Matrix,
    modo driving) desde la ciudad base de cada zona. **NUNCA por distancia en línea recta**: dos
    municipios vecinos pueden no tener carretera entre sí y no se entrega a nadie un municipio al
    que no puede llegar.
  - **Sin ruta en Google → "sin acceso terrestre" (`no_road`): NO se asigna a nadie.** Ruta por
    encima del tope de la zona (`kams.max_travel_time`, minutos) → "fuera de alcance"
    (`out_of_reach`): NO se asigna; la más cercana se guarda solo como dato.
  - Candidatas: zonas activas que participan en la asignación cuyo departamento es el del municipio
    o adyacente de nivel 1 o 2 (`department_adjacency` leída en los dos sentidos); mismo criterio que
    el algoritmo de IPS. Como en el algoritmo de IPS, el tope de cada zona filtra antes de competir
    (hoy hay topes de 240 y 360 min). Sin ninguna candidata (San Andrés, Guainía) → `out_of_reach`
    sin "más cercana".
  - **Bogotá hacia afuera compite como UNA ciudad** (desde el 2026-10-28, igual que las IPS desde el
    2026-10-11): mejor tiempo de sus celdas, tope único `bogota_config.max_travel_minutes` (360) y la
    celda la decide el corredor del municipio (`docs/algoritmo-asignacion.md`, punto 8 de "Bogotá hacia
    afuera"; pruebas en `web/scripts/municipios-check.ts`).
- **Modelo (0500)**, las 4 con RLS, sin políticas y solo service_role:
  - `municipality_travel_times`: caché PERMANENTE zona→municipio (status ok | no_route | error;
    ok/no_route nunca se vuelven a pedir, error sí).
  - `municipality_zone`: un municipio por fila, `kind` ∈ ips | reach | out_of_reach | no_road | pending.
    Bogotá 11001 guarda el ganador global; el mapa y el anexo siguen usando localidades. Las localidades sin
    IPS no van en `municipality_zone` (la clave foránea exige un municipio): el mapa las pinta con la celda de su
    corredor (`localidades` de GET, desde el 2026-10-28) y no entran en ningún anexo.
  - `territory_snapshots`: versiones **INMUTABLES** del territorio (anexos A y B + resumen + sha256);
    trigger bloquea UPDATE/DELETE/TRUNCATE (SQLSTATE OPM01) y service_role solo tiene SELECT/INSERT.
  - `line_territory_names`: nombre comercial de la zona de cada ejecutivo por línea.
- **Regla de mayoría única** (`web/lib/territory-rules.ts`: más camas, luego más IPS, luego nombre de
  zona y kam_id): la usan el mapa al colorear, `/api/map/data` (territoryStats), el motor de municipios
  y el anexo de territorio. Las IPS asignadas HOY mandan; `municipality_zone` solo aporta lo que no
  tiene IPS.
- **Motor** (`web/lib/municipality-coverage.ts`, `web/lib/google-distance.ts` = único cliente nuevo de
  Google, solo lo invoca `scripts/fase2b-municipios.ts --run`; respeta `GOOGLE_ROUTES_DISABLED=true`,
  concurrencia ≤ 3, tope duro `--max-elements`). Dry-run 2026-10-11 con caché vacía: 1.121 municipios
  → 136 con IPS, 10 sin candidata, 975 por carretera = 10.267 elementos ≈ 51,34 USD (0,005 USD/elem.).
- **API**: `GET /api/municipality-coverage` (requireUser, caché 60 s por proceso; `localidades`: celda de las
  localidades de Bogotá sin IPS por su corredor, `docs/decisiones/2026-10-28-localidades-sin-ips-por-corredor.md`);
  `POST /api/municipality-coverage/recompute` (`municipalities:recompute`, solo admin; sin Google);
  `GET /api/territory?line&executive`, `GET /api/territory/export?annex=a|b` (CSV UTF-8 con BOM, `;`),
  `GET|POST /api/territory/snapshots`, `GET /api/territory/snapshots/[id]` y `/diff`,
  `PUT /api/territory/names`. Permisos `territory:view` (roles con coverage:view; line_leader solo su
  línea; ejecutivo enlazado solo el suyo), `territory:snapshot` (admin, commercial_director,
  line_leader en su línea), `municipalities:recompute` (admin).
- **Mapa** (excepción autorizada por el dueño 2026-10-11 a "no agregar capas"): capa completa de
  municipios y localidades desde `web/public/geo/municipios.json` (1.120, sin 11001) y
  `localidades.json` (20), generados con `scripts/build-geojson.ts` (mapshaper). Estilo actualizado el
  2026-10-11 (ver "Estética del Mapa"): con IPS 0,55; de alcance: mismo color a 0,22; fuera de alcance:
  #e5e7eb con borde #9ca3af discontinuo; sin acceso terrestre: #d1d5db con trama de puntos; pendiente:
  blanco con borde #e5e7eb. Leyenda "Con IPS objetivo (visitar)", "De alcance (sin IPS hoy)", "Fuera de
  alcance", "Sin acceso terrestre". `/api/geojson` queda solo por compatibilidad.
- **Anexo de territorio** (`/lines`, panel "Territorio por ejecutivo comercial"): Anexo A = IPS activas
  asignadas a sus zonas (las que hay que visitar); Anexo B = municipios por departamento, "Con IPS"
  (incluye los municipios donde tiene IPS del Anexo A aunque otra zona gane la mayoría) y "Alcance"
  (con minutos por carretera). Fuera de alcance y sin acceso terrestre no entran en ningún anexo.
  Exportar CSV, imprimir (con hash) y "Guardar versión" (inmutable) con "Comparar con vigente".

_Extraído de CLAUDE.md el 2026-10-11 (texto íntegro, solo reubicado)._
