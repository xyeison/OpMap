# Spec: PR 2 – giros "Identifica tu Giro", afiliados BDUA, cifras de MinSalud y proyecciones DANE  (2026-10-11)

**Estado**: implementada (PR pendiente). Rama `feat/giros-bdua-cifras`, creada desde
`feat/fase3-reps-adres` (PR #3, pendiente de merge). Las migraciones 0630, 0640 y 0660 ya están
**aplicadas** en Supabase con autorización del dueño ("Autorizo todo. Procede.", 2026-10-11); las tres
son aditivas.

Detalle: `docs/fases/fase3-adres.md` (sección "Identifica tu Giro") y `docs/fases/fase4-poblacion.md`
(fuentes, tablas, alias, cargas, API y vista). Migraciones: `database/migrations/README.md`.

## Problema
`/inteligencia` solo tenía giros del Reporte 29 de la ADRES: régimen subsidiado y hasta jun-2025. No
había datos de afiliados ni de población por municipio para dimensionar el mercado de cada zona o
Ejecutivo Comercial.

Pedido del dueño (2026-10-11): cargar "Identifica tu Giro" (incluye contributivo y 2026; ejemplo: NIT
890102768 con giros el 26-27/01/2026), los afiliados de la BDUA, las cifras mensuales de afiliación de
MinSalud y las proyecciones DANE, y mostrarlos en `/inteligencia` y en la ficha de IPS. "Autorizo todo.
Procede."

## Resultado esperado
- Giros por giro (fecha, valor con centavos, concepto, proceso, referencia, entidad ordenadora y
  régimen) en `adres_giros_detalle`, cargados con un script reanudable que no evade el firewall.
- `/inteligencia` filtra los giros por régimen (todos, contributivo, subsidiado) y fuente (automática,
  Reporte 29, Identifica tu Giro), muestra la última fecha de giro, la cobertura temporal y las entidades
  ordenadoras. La fuente automática no deja la página con 3 IPS mientras la carga es parcial.
- Sección "Población y cobertura" en `/inteligencia`: afiliados por régimen, población DANE, cobertura,
  EPS dominantes, giros de 12 meses e índice "potencial" por municipio, zona o Ejecutivo Comercial, con
  CSV y vista en tarjetas en el celular.
- Ficha de IPS: tarjeta de giros por régimen con entidades ordenadoras, y tarjeta "Entorno del
  municipio" (afiliados por régimen, cobertura, 3 EPS dominantes y posición de la IPS en el ranking de
  giros de su municipio).
- Nada de esto recalcula asignaciones, llama a Google ni cambia la estética del mapa.

## Criterios de aceptación (pruebas puras y sin red, dentro de `npm run test`)
**`web/scripts/adres-check.ts` (192 pruebas; sección 7 = Identifica tu Giro)**
- [x] El CSV de "Consulta tu Giro" se lee con muestras literales (valores "$177.773.524", comas en el
      concepto sin comillas, vacío, HTML de error); el XML trae centavos y cuadra con el CSV.
- [x] Proceso y referencia salen del concepto ("Proceso 12056 CGD_Proc_12041_EPS005_269_C", "LMA_178_IPS",
      formato viejo repetido); el NIT de la ordenadora sale de "NIT-800251440-…".
- [x] Regla de régimen: subsidiado ("subsidiado" o la palabra "LMA"), contributivo ("compensación",
      "régimen contributivo", "CGD_Proc", "Proceso_<n>_GD_"), otro (recobros, SOAT/ECAT, COVID…).
- [x] Agregación mensual igual a la vista `adres_giros_mensual`; huella estable con ocurrencia para giros
      idénticos; ventanas de ≤ 6 meses; elección de fuente automática con umbral del 90 %.

**`web/scripts/poblacion-check.ts` (89 pruebas)**
- [x] Normalización (tildes, puntuación, `¥` → Ñ) y alias sin coincidencia aproximada; nombres ambiguos
      no se resuelven.
- [x] Lectura de una fila de CoberturaMunicipio (fixture generada en la prueba), con y sin IdMunicipio;
      la suma de filas cuadra con la fila "Total general" (el script de carga se niega a cargar un
      archivo que no cuadre); cálculo de cobertura con tope, como la publica MinSalud.

**`web/scripts/poblacion-api-check.ts` (95 pruebas)**
- [x] Agregación por municipio, zona y Ejecutivo Comercial sin contar dos veces (la suma por zona
      cuadra con el total del país); reparto de municipios con IPS de varias zonas por camas.
- [x] Índice potencial: normalización por el máximo del conjunto filtrado, pesos 0,5 / 0,3 / 0,2,
      subsidiado × 0,6, sin división por cero; top EPS uniendo códigos de una misma EPS; filtros.

## Fuera de alcance
- Carga completa de "Identifica tu Giro" (solo se probaron 3 NIT; ~703 NIT pendientes).
- Cambiar la serie DANE de OpMap (2020-2035) por la de MinSalud (2018-2042).
- Modificar `municipalities` (Nuevo Belén de Bajirá) o la estética del mapa.

## Impacto
- Datos / migración: sí, las tres aditivas y aplicadas.
  - `2026-10-11_0630_adres_detalle.sql` (tabla `adres_giros_detalle`, vista `adres_giros_mensual`,
    función `adres_giros_intel`) – rollback `2026-10-11_9930_adres_detalle_rollback.sql`.
  - `2026-10-11_0640_poblacion.sql` (`municipio_alias`, `bdua_afiliados`, `afiliacion_cifras`,
    `dane_proyecciones`; 55 alias) – rollback `2026-10-11_9930_poblacion_rollback.sql`.
  - `2026-10-11_0660_poblacion_api.sql` (`poblacion_cortes`, `poblacion_bdua_resumen`) – rollback
    `2026-10-11_9930_poblacion_api_rollback.sql` (antes del de 0640).
  - Todas con RLS activado sin políticas, sin privilegios para anon/authenticated, funciones SECURITY
    INVOKER con EXECUTE solo para `service_role`. No tocan `hospitals`, `assignments`, `coverage` ni
    `adres_giros`.
- Costo Google Maps: 0 elementos (ninguna llamada).
- Estética del mapa: no cambia.
- Permisos: rutas nuevas con `requirePermission` (`intelligence:view` para
  `/api/intelligence/poblacion`; `hospitals:view` para `/api/intelligence/poblacion/hospital/[id]`).
  Mismas reglas de líneas que la API de giros (403 si la línea no es del usuario).

## Plan (archivos e interfaces)
- Giros: `web/lib/adres-identifica.mjs` (parser puro), `web/scripts/lib/adres-http.mjs` (sesión
  ReportViewer y cadena TLS compartidas), `web/scripts/adres-identifica-giro.mjs` (carga),
  `web/lib/adres-intelligence.ts` (`chooseGirosSource`, agregados), `app/api/intelligence/giros/**`,
  `app/inteligencia/page.tsx`, `components/HospitalGirosCard.tsx`, `components/GirosMonthlyChart.tsx`.
- Población: `web/lib/municipio-alias.ts`, `web/lib/poblacion-parse.ts`, `web/scripts/bdua-load.ts`,
  `minsalud-cifras-load.ts`, `dane-proyecciones-load.ts`, `_poblacion-db.ts`.
- API y vista: `web/lib/poblacion-intelligence.ts`, `app/api/intelligence/_lib/poblacion-server.ts`,
  `app/api/intelligence/poblacion/**`, `components/IntelligencePoblacion.tsx`,
  `components/HospitalEntornoCard.tsx`.

## Verificación final
- `cd web && GOOGLE_ROUTES_DISABLED=true npm run check` → exit 0 (tsc sin errores; 14 advertencias
  react-hooks de siempre; pruebas 109 / 58 / 90 / 192 / 95 / 89 OK).
- Conteos en Supabase (SELECT): `adres_giros_detalle` 987 filas, $ 408.759.037.125,12 (3 NIT; 987
  huellas distintas; la vista suma igual); `bdua_afiliados` 53.634 / 50.137.787; `afiliacion_cifras`
  15.792 filas en 14 cortes, ago-2026 = 52.553.613 / 53.451.430; `dane_proyecciones` 7.854;
  `municipio_alias` 55; `adres_giros` intacta (62.992).
- API en localhost con cookie de admin y capturas de `/inteligencia` y de la ficha a 1440 px y 390 px
  sin desborde horizontal (ver el PR).
