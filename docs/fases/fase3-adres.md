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

- **Solo régimen subsidiado.** El contributivo (servicios.adres.gov.co) devolvía error el 2026-10-11;
  `adres_giros.regimen` ya admite `contributivo` para cuando se pueda cargar.
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

- Correr la carga completa (≈700 NIT, unos 10–15 min con `--parallel 2`).
- Contributivo cuando servicios.adres.gov.co responda.
- Revisar si la ADRES publica los giros posteriores a junio-2025 en otro reporte.
