# Fase 3 (2026-10-11): giros directos de la ADRES e inteligencia por municipio, zona y ejecutivo

Pedido del dueño: "podemos hacer inteligencia de negocio con los giros directos de la ADRES por NIT,
así vemos qué IPS reciben más recursos por municipio".

Migración `database/migrations/2026-10-11_0610_fase3_adres.sql` (rollback
`2026-10-11_9930_adres_rollback.sql`). **Aplicada** en Supabase el 2026-10-11 (aditiva: 2 tablas y 1
función nuevas; no toca ninguna tabla existente).

## Fuente

- ADRES, `https://aplicaciones.adres.gov.co/SII_LMA_WEB/LMA/frmReportes.aspx?Reporte=29`
  ("Liquidación Mensual de Afiliados Régimen Subsidiado" → "Reporte Giro a IPS"). Pública, sin login.
- Parámetros: FECHA INICIAL y FECHA FIN (dd/mm/aaaa) y NIT IPS (sin DV). Resultado por **mes de
  proceso**, tipo de contratación (Capitación / Evento) y EPS (código y nombre), con subtotales y total.
- Es un ReportViewer 2010 (SSRS). El visor exporta el reporte en CSV (es-CO: punto de miles, coma
  decimal) y en XML (punto decimal).

## Limitaciones (decirlas siempre que se muestren cifras)

- **Reporte 29: solo régimen subsidiado.** El contributivo y los giros de 2026 vienen de "Identifica tu
  Giro" (sección al final), que se guarda en otra tabla (`adres_giros_detalle`).
- **El NIT es del prestador, no de la sede.** Un NIT con varias sedes activas en OpMap (47 NIT, 127
  IPS el 2026-10-11; p. ej. Colsanitas con 10) recibe un solo giro. Para agregar por municipio / zona /
  ejecutivo, la app lo reparte entre sus sedes **en proporción a las camas** (a partes iguales si ninguna
  tiene camas). El total nunca se cuenta dos veces. La ficha de la IPS muestra el giro del NIT completo y
  avisa si es compartido.
- **Datos publicados hasta junio de 2025.** Con los 3 NIT de prueba el reporte devuelve meses desde 2022
  hasta junio-2025 y nada después (consultado el 2026-10-11 con rango hasta septiembre-2026). Por eso la
  página toma por defecto los 12 meses que terminan en el **último mes cargado**, no en el mes actual.
- El cruce IPS ↔ NIT usa la misma regla que la columna generada `hospitals.nit` (9 dígitos + DV):
  `nitFromHospitalCode()` en `web/lib/adres-parse.mjs`.

## Modelo (0610)

- **`adres_giros`**: una fila por (`nit`, `periodo` = primer día del mes, `regimen`,
  `tipo_contratacion`, `eps_codigo`) — UNIQUE —, con `eps_nombre`, `valor` numeric(18,2) en COP,
  `fuente` ('adres_reporte_29') y `fetched_at`. CHECKs de formato (NIT de 5–12 dígitos, día 1, régimen).
- **`adres_fetch_log`**: bitácora de cada consulta (`nit`, `desde`, `hasta`, `estado` ok |
  sin_registros | error, `mensaje`, `filas`, `total`, `nombre_prestador`, `fetched_at`). El script la usa
  para reanudar.
- **`adres_giros_resumen(p_desde, p_hasta, p_regimen)`**: agregado por NIT y mes en UN jsonb (evita
  paginar decenas de miles de filas por PostgREST). SECURITY INVOKER, `search_path` fijo, EXECUTE solo
  para `service_role`.
- Las 2 tablas con RLS activado, sin políticas, sin privilegios para anon/authenticated/PUBLIC; solo
  `service_role`.

## Carga: `web/scripts/adres-giros.mjs` (Node 22, sin dependencias nuevas)

```bash
cd web
node scripts/adres-giros.mjs --desde 2023-07     # primera carga: todos los NIT de IPS activas (≈700)
node scripts/adres-giros.mjs                      # recargas: 24 meses hasta fin del mes pasado
node scripts/adres-giros.mjs --nit 891200679,800058856 --dry-run   # probar sin escribir
node scripts/adres-giros.mjs --help
```

- Cómo consulta: igual que el formulario — GET de la página, POST con los 3 parámetros y "View Report",
  y descarga del CSV por la URL de exportación del propio visor (respaldo: XML del mismo reporte).
  Peticiones HTTP normales con un User-Agent que **se identifica como el script**; sin navegador y sin
  hacerse pasar por uno. **Chrome headless no sirve**: el firewall de la ADRES bloquea su User-Agent
  ("Web Page Blocked"); no se evade. Si el firewall bloquea al script, este se detiene sin reintentar.
- TLS: el servidor de la ADRES envía una cadena incompleta (falta "Go Daddy Secure Certificate
  Authority - G2"). El script descarga ese intermedio de la URL AIA del propio certificado (lo mismo que
  hacen navegadores y curl en macOS) y verifica la cadena completa contra las raíces de Node.
- Por NIT: lee el CSV mapeando columnas por nombre y, si el nombre no se reconoce, por contenido (mes-año,
  tipo, código EPS, valor); comprueba que la suma de filas cuadre con el total general del reporte
  (si no cuadra, reintenta y al final registra error); suma duplicados; upsert por lotes; borra las filas
  de ese NIT dentro del rango que ya no vinieron (correcciones de la ADRES); registra en `adres_fetch_log`.
- Opciones: `--parallel N` (1–4, por defecto 2), `--retries N` (3), `--delay MS` (1000 entre NIT por
  consulta simultánea), `--force`, `--recent-days N` (20: salta NIT con consulta ok/sin_registros
  reciente que cubra el rango), `--limit N`, `--save-dir DIR` (guarda CSV/XML crudos).
- Prueba del 2026-10-11 con 891200679, 800058856 y 838000096 (`--desde 2023-07`): 3 con datos, 512 filas,
  $ 69.223.157.540; una segunda pasada saltó los 3 (reanudable). Tiempo ≈ 1–6 s por NIT.

## API y permisos

- Permiso nuevo **`intelligence:view`**: admin, commercial_director, line_leader, data_manager, viewer.
  sales_manager, contract_manager y user no lo tienen (no ven `/inteligencia`).
- `GET /api/intelligence/giros?group=ips|municipio|zona|ejecutivo&line=<code>&desde=YYYY-MM&hasta=YYYY-MM&departamento=<DANE 2>&municipio=<DANE 5>`
  → `{kpis, series, rows, range, available, fetch, filters, notes, line, group}`. IPS activas →
  zona actual (`assignments`) → Ejecutivo Comercial de esa zona en la línea (`coverage`, vía
  `loadCoverageResponse`). `line` es opcional salvo para `group=ejecutivo` (400) y debe estar entre las
  del usuario (`findAccessibleLine`, si no 403). Sin `desde/hasta`: 12 meses hasta el último mes cargado;
  máximo 60 meses. 503 con mensaje claro si falta la migración.
- `GET /api/intelligence/giros/hospital/[id]` (permiso `hospitals:view`, datos públicos de esa IPS) →
  `{nit, sedesNit, range, summary {total, capitacion, evento, otros, topEps (5), series}, lastFetch}`.
- Lógica pura en `web/lib/adres-intelligence.ts` (reparto por sede, agregación, parámetros) y
  `web/lib/adres-parse.mjs` (lectura del reporte, NIT, meses). Pruebas: `npm run adres:check`
  (también dentro de `npm run test`).

## UI

- **`/inteligencia`** (menú "Inteligencia"): filtros en una fila (línea, departamento, municipio, desde,
  hasta, Restablecer, Exportar CSV), KPIs (total girado, IPS con giro de N, % del total en IPS con zona
  asignada, Capitación / Evento), columnas por mes apiladas (SVG propio, tabla por mes en "Ver tabla") y
  ranking por IPS / Municipio / Zona / Ejecutivo Comercial (este último exige línea). El ranking de IPS
  muestra municipio, zona, ejecutivo (si hay línea), camas y marca "NIT compartido". CSV para Excel en
  español (BOM, `;`, CRLF, protección contra fórmulas).
- **Ficha de IPS**: tarjeta "Giros ADRES (últimos 12 meses)" (`web/components/HospitalGirosCard.tsx`)
  al final: total, Capitación, Evento, 5 EPS que más giraron, columnas por mes. Sin datos: "Sin giros
  registrados (régimen subsidiado)" y si el NIT nunca se consultó o la ADRES no reporta giros.
- No hay quirófanos en `hospitals` (`surgeries` está en 0 en las 783 activas): el ranking muestra camas.

## Pendiente

- ~~Correr la carga completa~~ Hecha el 2026-10-11: 701 NIT, 553 con datos, 148 sin registros, 0
  errores, 62.480 filas, $ 26,96 billones COP (jul-2023 a jun-2025). La tabla tiene además los 3 NIT de
  la prueba previa (512 filas).
- ~~Contributivo y giros posteriores a junio-2025~~ Resuelto con "Identifica tu Giro" (sección
  siguiente). Falta la carga completa de esa fuente (ver allí).

## Identifica tu Giro (ERP de la ADRES): contributivo, subsidiado y 2026

Migración `database/migrations/2026-10-11_0630_adres_detalle.sql` (rollback
`2026-10-11_9930_adres_detalle_rollback.sql`). **Aplicada** el 2026-10-11 (aditiva: 1 tabla, 1 vista y
1 función nuevas; no toca `adres_giros` ni `adres_giros_resumen()`).

### Fuente

- `https://aplicaciones.adres.gov.co/ERP/Default.aspx`, reporte SSRS "Consulta_Pagos_ERP" (ReportViewer
  2012), público y sin login. Parámetros: Fecha Inicio, Fecha Fin (dd/mm/aaaa) y "NIT EPS o IPS
  Beneficiaria" (NIT sin DV). Botón "Ver informe".
- Una fila por giro: NIT beneficiario, nombre, fecha del giro, valor, concepto y entidad ordenadora
  (`NIT-800251440-ENTIDAD PROMOTORA DE SALUD SANITAS S A S`).
- Exporta en **XML** (valores con centavos: `177773524.0000000000000000`) y en **CSV** (valores
  redondeados a pesos, `$177.773.524`, y **sin comillas**). El script lee el XML y usa el CSV para
  validarlo (mismas filas y sumas que cuadran a medio peso por fila); el CSV solo se usa si falta el XML.
- **Datos desde el 4-abr-2025** (lo más antiguo que devolvió con rango desde ene-2025; consultado el
  2026-10-11) hasta el día anterior a la consulta.
- Mismo mecanismo HTTP que el Reporte 29 (sin navegador, User-Agent propio, cadena TLS completada por
  AIA, se detiene ante el firewall). La sesión y la cadena TLS quedaron en `web/scripts/lib/adres-http.mjs`,
  compartido por los dos scripts.

### Regla de régimen (`regimenDeConcepto()` en `web/lib/adres-identifica.mjs`)

Sobre el concepto sin tildes ni mayúsculas, en este orden:

1. **subsidiado** si contiene "subsidiado" o la palabra "lma" (`LMA_186_IPS`, "PROCESO LMA"; no
   "palma"). Incluye los giros LMA "CXP IPS", los "CXP EPS" (giro a terceros) y el presupuesto máximo del
   subsidiado.
2. **contributivo** si contiene "compensacion", "regimen contributivo", "cgd_proc" o `proceso_<n>_gd_`
   (giro directo de la compensación con el formato viejo de abr-2025, que no trae la palabra). Incluye el
   presupuesto máximo del contributivo.
3. **otro** en los demás casos: recobros NO UPC, reclamaciones SOAT/ECAT (víctimas de accidentes de
   tránsito), pruebas COVID, resoluciones del MSPS (deuda con entes territoriales por migrantes).

Se ajustó la regla pedida ("Compensación" → contributivo; "LMA"/"Subsidiado" → subsidiado; otro) con dos
casos reales: el formato viejo `Proceso_11266_GD_SURA` y el presupuesto máximo "Régimen Contributivo".

**Entidad ordenadora**: es la EPS, salvo en los giros LMA "CXP IPS" del subsidiado, donde la ADRES
registra el **ente territorial** (municipio o departamento) de la liquidación. Con los 3 NIT de prueba:
342 de 377 giros del subsidiado traen un ente territorial. Las columnas se llaman `eps_ordenadora_*` pero
guardan lo que publica la ADRES.

### Modelo (0630)

- **`adres_giros_detalle`**: `nit`, `fecha_giro`, `valor` numeric(18,2), `concepto` (espacios
  colapsados), `proceso` ("Proceso 12056" → `12056`; NULL si no trae), `referencia` (código final:
  `CGD_Proc_12041_EPS005_269_C`, `LMA_186_IPS`, `PM2025-RC-GD1`…; NULL si no trae), `eps_ordenadora_nit`,
  `eps_ordenadora_nombre`, `regimen` (contributivo | subsidiado | otro), `fuente`
  ('adres_identifica_giro'), `ocurrencia`, `huella`, `fetched_at`.
- **Clave única `huella`** = sha256 de `nit|fecha|valor (2 decimales)|concepto|NIT ordenadora (o su
  nombre)|ocurrencia`. `ocurrencia` numera los giros idénticos de una misma descarga (no se funden dos
  pagos iguales el mismo día). Se eligió la huella en lugar de un UNIQUE de 5 columnas porque una
  ordenadora sin NIT (NULL) rompería la unicidad.
- **`adres_giros_mensual`** (vista, `security_invoker`): el detalle por NIT, mes (`periodo` = día 1),
  régimen y NIT de la ordenadora, con `valor`, `giros` y `ultima_fecha`. Misma forma que `adres_giros`; la
  usa la ficha de IPS.
- **`adres_giros_intel(p_fuente, p_desde, p_hasta, p_regimen)`**: agregado por NIT en un jsonb para las
  **dos** fuentes (`identifica` = detalle; `reporte29` = `adres_giros`): totales, capitación/evento,
  contributivo/subsidiado/otro, meses, valor por entidad y último giro, más el diccionario de nombres de
  entidades. La usa `GET /api/intelligence/giros` (y la vista de población de la Fase 4). Comprobado: para
  el Reporte 29 da el mismo total que `adres_giros_resumen()` (jul-2024 a jun-2025: $ 15.967.511.745.238).
- `adres_fetch_log` (0610) se reutiliza con `fuente = 'adres_identifica_giro'` y `regimen = 'todos'`.
- RLS activado sin políticas, sin privilegios para anon/authenticated/PUBLIC; función solo `service_role`.

### Carga: `web/scripts/adres-identifica-giro.mjs`

```bash
cd web
node scripts/adres-identifica-giro.mjs --nit 890102768 --desde 2025-01 --hasta 2026-09 --dry-run
node scripts/adres-identifica-giro.mjs --desde 2025-04          # carga completa (todos los NIT activos; reanudable)
node scripts/adres-identifica-giro.mjs --help
```

- Mismas opciones que `adres-giros.mjs` (`--nit`, `--desde`, `--hasta`, `--parallel`, `--force`,
  `--recent-days`, `--retries`, `--delay`, `--limit`, `--dry-run`, `--save-dir`) más `--ventana N`
  (meses por consulta, 1–12, por defecto 6): el rango se parte en ventanas de calendario.
- Por ventana: valida XML↔CSV, que todos los giros sean del NIT pedido y estén dentro de la ventana, y
  que no haya filas ilegibles; si algo falla, reintenta con una sesión nueva y al final marca el NIT como
  error **sin escribir nada** de ese NIT.
- Escritura por NIT (solo si todas sus ventanas se leyeron bien): upsert por `huella` en lotes de 500,
  poda de los giros de ese NIT dentro del rango que ya no vinieron (correcciones de la ADRES) y una fila
  en `adres_fetch_log`. Reanudable como el Reporte 29.
- **Prueba del 2026-10-11** (`--nit 890102768,891200679,800058856 --desde 2025-01 --hasta 2026-09`):
  3 NIT con datos, 0 errores, **987 filas**, **$ 408.759.037.125**: contributivo $ 157.699.804.782,
  subsidiado $ 247.230.299.298, otro $ 3.828.933.045. ≈ 3–4 s por NIT (4 ventanas, 2 exportaciones cada
  una). Sin giros repetidos (ocurrencia máxima 1).
- **Cruce con el Reporte 29** (abr–jun 2025, los meses que se solapan): para 800058856 la LMA de
  Identifica suma lo mismo que el Reporte 29 ($ 600.073.913); para 891200679 la parte "CXP IPS" de la LMA
  (abr + may + jun = $ 981.566.371) coincide peso a peso con el Reporte 29, y la diferencia son giros
  "CXP EPS" que el Reporte 29 no incluye. Ojo: el Reporte 29 va por **mes de proceso** e Identifica por
  **fecha de giro**.

### API y UI

- `GET /api/intelligence/giros` acepta `regimen=todos|contributivo|subsidiado` y
  `fuente=auto|reporte29|identifica`, y devuelve además `fuente`, `fuenteMotivo`, `cobertura` (hasta el
  último giro cargado), `sources`, `epsTop` (10 entidades que más giraron, con el reparto por sede) y, por
  fila, `contributivo`, `subsidiado`, `otro`, `ultima_fecha` y `eps_top` (3).
- **Fuente automática** (`chooseGirosSource()`): Identifica tu Giro si está cargado para **al menos el
  90 % de los NIT activos** (consulta ok o sin registros) y tiene giros en el rango; si no, el Reporte 29.
  Decisión: con solo los 3 NIT de prueba, cambiar a Identifica dejaría la página con 3 IPS; por eso hoy
  la fuente automática sigue siendo el Reporte 29 y lo dice en pantalla ("cargado para 3 de 703 NIT").
  Con `fuente=identifica` se ve lo cargado. `regimen=contributivo` con el Reporte 29 devuelve 0 y un aviso.
- `GET /api/intelligence/giros/hospital/[id]`: si el NIT ya se consultó en Identifica tu Giro (ok o sin
  registros) devuelve `fuente: 'identifica'` con total por régimen, entidades ordenadoras y serie por
  régimen (vista `adres_giros_mensual`, 12 meses hasta el último mes con giros); si no, el Reporte 29
  como antes. Ambos traen `ultimaFecha`.
- **`/inteligencia`**: filtros Régimen y Fuente, línea con la fuente usada y el motivo, nota de cobertura
  temporal, KPI "Contributivo / Subsidiado" (Identifica) o "Capitación / Evento" (Reporte 29), gráfico
  apilado por régimen o por tipo, tarjeta "Entidades ordenadoras" (o "EPS que más giraron"), columna
  "Último giro" y "Principal: …" en cada fila; el CSV exporta las mismas columnas.
- **Ficha de IPS**: la tarjeta "Giros ADRES" muestra total, contributivo, subsidiado y otros conceptos,
  último giro, las 5 entidades ordenadoras que más giraron y la serie por régimen.
- Pruebas: sección 7 de `npm run adres:check` (muestras literales del CSV y el XML, sin registros, CSV con
  comas sin comillas, proceso/referencia, régimen, huella y ocurrencias, ventanas, agregación mensual,
  fuente automática, agregación por régimen y entidad).

### Pendiente

- **Carga completa** de Identifica tu Giro (≈ 703 NIT × 4 ventanas): `node scripts/adres-identifica-giro.mjs
  --desde 2025-04`. Hasta que cubra el 90 % de los NIT, la fuente automática sigue en el Reporte 29.
- La vista de población (Fase 4, `poblacion-server.ts`) usa el detalle en cuanto existe alguna fila; con
  la carga parcial muestra solo los 3 NIT de prueba. Conviene aplicarle el mismo umbral de cobertura.
