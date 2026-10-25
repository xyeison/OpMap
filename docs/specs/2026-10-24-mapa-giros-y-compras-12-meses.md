# Spec: El mapa muestra giros ADRES y compras públicas SECOP de 12 meses (municipio e IPS)  (2026-10-24)

**Estado**: borrador para el dueño (pedido del 2026-10-24); pendiente de "Para decidir (dueño)".

## Problema

El dueño, 2026-10-24: "tenemos una información de contratos y proveedores con nombre propio […] está súper desactualizado.
Recientemente hicimos lo de los giros de la ADRES y la contratación pública de SECOP. Yo quiero que ESA sea la información que
sale en el mapa […] si le doy clic al municipio, que me diga cuánto tiene en total en giros, cuánto en compras, cuáles son los
proveedores. SECOP trae cosas viejísimas; quiero los últimos 12 meses […] y si le doy clic a un hospital público que tiene
contratos o giros, que me salga esa información."

Hoy:

- Las tarjetas del mapa muestran los contratos cargados a mano (`hospital_contracts`: 93 filas, 92 "activas" con `end_date`
  vencida, última actualización 2025-12-30): fila "Contratos" en las dos tarjetas de IPS (`web/components/MapPopups.tsx:127`,
  `:156-160`), sección "Contratos activos" con 3 proveedores en la tarjeta de municipio (`:350-364`) y el interruptor "Solo con
  Contratos" (`web/components/MapControls.tsx:435-471`). Los arma `web/app/api/map/data/route.ts:138-139, :178-180, :238-253,
  :259-332, :373-379`.
- Giros ADRES (Identifica tu Giro, 604 de 703 NIT con giro, 2025-04 a 2026-09) y SECOP (cargas automáticas; último OK 2026-10-24)
  ya existen y se ven en la ficha de IPS (`HospitalGirosCard`, `HospitalSecopCard`, `web/app/hospitals/[id]/page.tsx:566-567`)
  y en `/inteligencia`, pero el mapa no los muestra ni para municipio ni para IPS.
- La ficha y el ranking de SECOP usan 24 meses (`SECOP_VENTANA_MESES`, `web/lib/compras-publicas.ts:45`); el dueño pide 12.
- La vista de zonas tiene un hueco anotado: `viewer`, `data_manager` y `user` con línea reciben contratos sin `contracts:view`
  (`docs/specs/2026-10-14-mapa-vista-de-zonas-para-todos.md:58-61`).

## Resultado esperado

Nada cambia en polígonos, puntos, insignias, colores, opacidades ni globos (`docs/mapa-estetica.md:95-96, :127-128`). Cambia
**el contenido** de las tarjetas que ya existen; se quita un interruptor de "Filtros y visitas" (confirmar, punto 3).

### E1 · Tarjeta de municipio o localidad de Bogotá (clic / toque)

Debajo de "Estadísticas hospitalarias" y antes de "Población", para quien tiene `intelligence:view`, una sección por fuente:

- **"Giros ADRES · oct-2025 a sep-2026"**: Total · Contributivo · Subsidiado · Otro (recobros, SOAT…) · "n de m IPS con giro".
  Giro de una IPS = giro de su NIT × su parte por camas entre las sedes activas del NIT (`sedeShares`,
  `web/lib/adres-intelligence.ts:184`; misma regla de Inteligencia y "Datos de la zona"). Giro del municipio = suma de sus IPS
  activas (`hospitals.municipality_id`, o `locality_id` en Bogotá). Nota si algún NIT tiene sedes en varios municipios: "parte
  por camas (estimación)".
- **"Compras públicas de material ortopédico y neurocirugía (SECOP) · nov-2025 a hoy"**: Valor adjudicado · Contratos ·
  Entidades · lista de proveedores ordenada por valor (nombre, NIT, valor, nº contratos, última firma, líneas, marca
  "Vigilado"); 5 visibles y "Ver los N proveedores" dentro de la tarjeta. Aparte y en una línea: "Sin clasificar (proveedores
  vigilados): N contratos · $X"; "Servicios de especialistas: N contratos"; "Personas naturales: N contratos". Sin nombres de
  personas, nunca `proveedor_hash`. Suma lo mismo que Inteligencia (`esOrto`, `esServicio` `:349`, `esFueraEscala` `:339`,
  `estimado` marcado): en 12 meses hoy no hay estimados ni fuera de escala.
- Textos cuando no hay dato: municipio con IPS pero ninguna pública → "Sin entidades públicas de compra en OpMap en este
  municipio" (30 de 147; se muestran los giros). Municipio de alcance sin IPS (`kind:'other'`, `MapPopups.tsx:314-333`) → una
  línea: "Giros y compras se cuentan donde está la IPS; este municipio no tiene IPS en OpMap" (sin llamada).
- Pie: "Fuentes: ADRES Identifica tu Giro (giro del NIT repartido por camas) · SECOP I/II (valor adjudicado). Rango de cada una."
- Sin `intelligence:view`: la tarjeta de siempre, sin la sección, sin llamada y sin error.

### E2 · Tarjeta de IPS (con Zona y sin Zona)

Debajo de "Tiempo de llegada", mismas dos secciones, cifras de **la sede**: giros = parte del NIT por camas; compras = la misma
parte aplicada a los hechos del NIT (para el 93 % de los NIT, una sola sede: la cifra es el NIT completo). Si el NIT tiene n > 1
sedes: "Parte de esta sede: 1 de n sedes del NIT X, reparto por camas. La ficha muestra el NIT completo." Proveedores de 12 meses
del NIT (máx. 5 + "Ver los N"). Estados: IPS privada (`resolverCompraPublica`, `compras-publicas.ts:323`; la marca manual
`hospitals.compra_publica` manda sobre el REPS) → solo giros y la línea de la ficha "IPS privada: sin contratación pública
(SECOP)"; IPS pública sin contratos en la ventana → "Sin contratos de ortopedia o neurocirugía en SECOP en los últimos 12 meses"
(nunca "sin compras"). El botón "Ver ficha →" sigue igual (`fichaActions`, `MapComponent.tsx:1634`).

### E3 · Se quitan del mapa los contratos cargados a mano

Desaparecen la fila "Contratos", la sección "Contratos activos", el interruptor "Solo con Contratos" y, en `/api/map/data`,
la lectura de `hospital_contracts` y los campos `contractValuesByHospital`, `contractProvidersByHospital`, `contractsIncluded`
y `territoryStats[].totalContracts/contractValue/providers`. Con ello se cierra el hueco de permisos del 2026-10-14 (el mapa ya
no manda contratos a nadie). Siguen igual: `/contracts`, `/providers`, `/api/contracts/**`, `/api/providers/**`, "Contratos y
Oportunidades" de la ficha (`page.tsx:858-882`), `/territories/[id]`, `GET /api/kams/stats` y el permiso `contracts:view`.

### E4 · Carga perezosa por clic

Los datos nuevos NO van en `/api/map/data` (≈1,1 MB, se vuelve a pedir al cambiar de línea; SECOP 12 m país = 126 KB, giros por
NIT país ≈ 60 KB). Se piden al abrir la tarjeta, con el patrón de `/api/travel-times/unassigned-optimized`
(`MapComponent.tsx:536-559`): `useQuery(['map-detalle', tipo, code])`, `staleTime` 5 min, `enabled` solo con la tarjeta abierta
y `inteligenciaIncluida`. Medido en base: SECOP 12 m con 1 NIT 70 ms, Bucaramanga (17 NIT) 128 ms, Bogotá (≈100 NIT) 333 ms;
giros por lista de NIT ≈ 1 ms con RPC (738 ms y 1,56 MB si hay que leer `adres_giros_intel` entero). Objetivo: < 1 s en frío,
unos KB por respuesta. Estados visibles: "Cargando giros y compras…" y "No se pudieron cargar · Reintentar". Servidor con
`dynamic = 'force-dynamic'` y `Cache-Control: no-store` (nunca el Data Cache de Next, CLAUDE.md).

### E5 · Ventana de 12 meses

- Giros: 12 meses que terminan en el **último mes con giros cargados** (`loadIdentificaBounds`,
  `web/app/api/intelligence/_lib/giros-server.ts:61` → `resolveGirosRange(null, null, latest)`, `adres-intelligence.ts:588`),
  igual que Inteligencia; hoy "oct-2025 a sep-2026".
- SECOP: 12 meses calendario hasta hoy (`ventanaMeses(hoyBogota(), 12)`, `compras-publicas.ts:205`,
  `web/app/api/secop/_lib/hoy.ts:3`); hoy "nov-2025 a hoy (24-oct-2026)". La ficha y el ranking siguen en 24 meses.
- Las dos ventanas van escritas en el título de cada sección. Constante única `MAPA_VENTANA_MESES = 12`.

## Criterios de aceptación (se convierten en pruebas)

- [ ] Admin, `line_leader`, `commercial_director`, `data_manager` y `viewer` reciben 200 de las dos rutas nuevas; `sales_manager`,
      `contract_manager`, `user` y `hr` reciben 403 sin que se lea ninguna tabla; sin sesión, 401.
- [ ] `/api/map/data` nunca consulta `hospital_contracts`; su respuesta no contiene `contractValuesByHospital`,
      `contractProvidersByHospital`, `contractsIncluded` ni `providers`, y trae `inteligenciaIncluida` según el rol.
- [ ] Giro de un territorio = Σ (giro del NIT × parte por camas de cada sede activa en el territorio); un NIT con dos sedes en
      dos municipios reparte por camas y la suma de los dos municipios es el giro del NIT (nada dos veces); sin camas, 1/n.
- [ ] Compras de un territorio: solo hechos de NIT de IPS del territorio, firmados dentro de la ventana, de las 6 líneas
      (`esOrto`), con la misma parte por camas; servicios de especialistas, fuera de escala y personas naturales no suman y se
      cuentan aparte; "sin clasificar" aparte con valor; proveedores ordenados por valor con `vigilado`.
- [ ] La respuesta serializada nunca contiene `persona:`, un `proveedor_hash`, un documento de persona ni un nombre de médico.
- [ ] `comprasEstado` cubre los cuatro casos: `con_datos`, `sin_contratos_12m` (pública sin hechos), `sin_entidad_publica`
      (municipio sin IPS pública), `ips_privada` (manual `compra_publica=false` gana sobre REPS "Pública").
- [ ] Ventanas: giros terminan en el último mes cargado (no en hoy); SECOP `desde` = primer día de hace 11 meses; ambos textos
      visibles en la tarjeta ("oct-2025 a sep-2026", "nov-2025 a hoy").
- [ ] Localidad de Bogotá: la ruta agrupa por `hospitals.locality_id`; el municipio 11001 no se pide entero.
- [ ] Si la RPC `adres_giros_nits` no existe, la ruta usa `loadGirosIntel` y responde igual (misma suma, prueba con las dos
      ramas del Supabase falso); con RPC, la llamada lleva solo los NIT del territorio.
- [ ] Territorio sin IPS activas → 200 con `ips.total = 0`, `giros = null`, `compras = null` y la nota; `code` inválido → 400.
- [ ] Ninguna ruta nueva importa `lib/google-distance.ts`; el Supabase falso no registra escrituras ni peticiones externas.
- [ ] Texto visible sin "KAM", "panel", "representante"; rótulos "Ejecutivo Comercial" y "Zona"; nunca "sin compras".
- [ ] `mapa-estilo-check.ts` sigue en verde: ningún color, opacidad, capa ni marcador nuevo.

## Fuera de alcance

Borrar las páginas y tablas de contratos/proveedores manuales (`/contracts`, `/providers`, `hospital_contracts`, `providers`) y
quitar `contract_value_total` de `GET /api/kams/stats` (pendiente anotado en la spec 2026-10-23). Cambiar la ficha o el ranking
de 24 a 12 meses. Colorear o rankear municipios por giros o compras (exigiría precálculo nacional y autorización de estética).
Un filtro "Solo con compras públicas" que reemplace al interruptor quitado. Números en los globos (tooltips). Giros por
municipio del paciente (el giro se atribuye a la IPS). Entidades públicas que no son IPS de OpMap (10 contratos, $1.810 M en 12
m, 1,5 %). Corregir datos (NIT de HOCEN). Cambios en la app móvil, en `/inteligencia` o en `aggregateSecopRanking`.

## Impacto

- Datos / migración: **opcional y aditiva**. `database/migrations/2026-10-24_0880_adres_giros_nits.sql` crea
  `adres_giros_nits(p_desde date, p_hasta date, p_nits text[])` (totales por NIT y régimen, `REVOKE` a `anon`/`authenticated`,
  `GRANT EXECUTE` a `service_role`; borrador en `scratchpad/mapa-giros/rpc-propuesta.sql`) con rollback
  `2026-10-24_9948_adres_giros_nits_rollback.sql` (`DROP FUNCTION`). El código funciona sin ella (respaldo `loadGirosIntel`,
  ≈ 740 ms). Se aplica solo con autorización del dueño, en la ventana del despliegue.
- Costo Google Maps: **0 elementos**. Ninguna ruta nueva toca `lib/google-distance.ts`.
- Estética del mapa: **no cambia** (solo contenido de tarjetas; estilos existentes `.opmap-popup__section`, `__rows`, `__note`,
  `web/app/globals.css:442-540`). Se quita el interruptor "Solo con Contratos" de "Filtros y visitas": confirmar con el dueño.
- Permisos / roles: **ningún permiso nuevo**. La sección se ve con `intelligence:view` (`web/lib/permissions.ts:97, :143, :172,
  :219, :232`). `contracts:view` deja de influir en el mapa. Documentar en `web/docs/ROLES_AND_PERMISSIONS.md`.

## Contratos de API

```ts
// web/lib/types/mapa-detalle.ts
export const MAPA_VENTANA_MESES = 12
export interface Ventana { desde: string; hasta: string; texto: string }            // 'YYYY-MM', "oct-2025 a sep-2026"
export interface GirosDetalle {
  fuente: 'identifica' | 'reporte29'; ventana: Ventana
  total: number; contributivo: number; subsidiado: number; otro: number; ultimaFecha: string | null
  nits: number; nitsConGiro: number; estimadoPorCamas: boolean          // algún NIT con sedes en varios municipios
}
export interface ProveedorDetalle {
  nit: string; nombre: string; valor: number; contratos: number; ultimaFecha: string | null
  lineas: string[]; entidades: number; vigilado: boolean
}
export interface ComprasDetalle {
  ventana: Ventana; actualizado: string | null                          // loadSecopActualizado
  valor: number; contratos: number; entidades: number; proveedores: ProveedorDetalle[]   // orden: valor desc
  sinClasificar: { contratos: number; valor: number }
  especialistas: { contratos: number }; personasNaturales: { contratos: number; valor: number }
  estimados: { contratos: number; valor: number }                       // SECOP I sin adjudicado (hoy 0 en 12 m)
}
export type ComprasEstado = 'con_datos' | 'sin_contratos_12m' | 'sin_entidad_publica' | 'ips_privada'
export interface TerritorioDetalle {
  territorio: { code: string; tipo: 'municipio' | 'localidad'; nombre: string; departamento: string | null }
  ips: { total: number; publicas: number }
  giros: GirosDetalle | null; compras: ComprasDetalle | null; comprasEstado: ComprasEstado; notas: string[]
}
export interface IpsDetalle {
  hospital: { id: string; nombre: string; nit: string | null; sedesNit: number; parte: number   // 0-1, por camas
              compraPublica: boolean; compraPublicaOrigen: 'manual' | 'reps' | 'contratos' | 'ninguno' }
  giros: GirosDetalle | null; compras: ComprasDetalle | null; comprasEstado: ComprasEstado; notas: string[]
}
```

| Ruta | Método | Quién | Respuesta |
|---|---|---|---|
| `/api/map/detalle/territorio?tipo=municipio\|localidad&code=<DANE5 \| id localidad>` | GET | `requirePermission(request,'intelligence:view')` | `TerritorioDetalle`; 400 si `tipo`/`code` inválidos (zod); 200 con `ips.total=0` y nota si no hay IPS |
| `/api/map/detalle/ips/[id]` | GET | ídem | `IpsDetalle`; 404 si no existe o inactiva; `id` con `isUuid` (`web/app/api/_lib/api-error.ts:54`) |
| `/api/map/data` (existente) | GET | `map:view` | quita los campos de contratos; añade `inteligenciaIncluida: boolean` (`hasPermission(role,'intelligence:view')`) |

Las tres: `export const dynamic = 'force-dynamic'`, `Cache-Control: no-store`, 500 genérico con detalle solo en el log
(`serverError`, `api-error.ts:10`). Sin cambios en `/api/intelligence/*` ni `/api/secop/*`.

## Plan (archivos e interfaces)

- `web/lib/types/mapa-detalle.ts` (nuevo): los contratos de arriba.
- `web/lib/mapa-detalle.ts` (nuevo, **puro**, sin red): `ventanaGiros(latest)`, `ventanaSecop(hoy)`, `textoVentana()`;
  `resumirGiros(nitsResumen, hospitals, shares, ipsDelTerritorio)`; `resumirCompras(facts, hospitals, shares, ipsDelTerritorio,
  vigilados, publicaPorNit)` reutilizando `esOrto`, `esServicio`, `esFueraEscala`, `lineaPasaFiltro` (`compras-publicas.ts:339,
  :349, :744`), `sedeShares` y `nitOfHospital` (`adres-intelligence.ts:175-184`) y `parseResumen` (`:610`); `estadoCompras()`.
  No se toca `aggregateSecopRanking` (alternativa descartada: añadir `group:'municipio'` en `SECOP_GROUPS`, `:38-39`, cambiaría
  `/inteligencia`).
- `web/app/api/intelligence/_lib/giros-server.ts`: `loadGirosNits({desde, hasta, nits})` → `db.rpc('adres_giros_nits')`; si
  `isMissingRelationError`, respaldo `loadGirosIntel` (`:146`) filtrado por NIT. Reutiliza `loadIdentificaBounds` (`:61`) y
  `loadIntelHospitals` (`:178`, todas las IPS activas: `sedeShares` las necesita).
- `web/app/api/map/_lib/detalle-server.ts` (nuevo): `cargarDetalleTerritorio(tipo, code)` y `cargarDetalleIps(id)`:
  `loadIntelHospitals` → IPS del territorio (`municipality_id` / `locality_id`) → NIT → `loadGirosNits` + `loadHechos({desde,
  hasta, nits})` (`web/app/api/secop/_lib/secop-server.ts:165`; nunca `loadContratosEntidad`, `:113`, que trae el histórico) +
  `loadVigiladosActivos` (`:242`) + `loadSecopActualizado` (`:305`) + `resolverCompraPublica` por NIT.
- Rutas nuevas: `web/app/api/map/detalle/territorio/route.ts`, `web/app/api/map/detalle/ips/[id]/route.ts`.
- `web/app/api/map/data/route.ts`: borrar `:138-139`, `:178-180`, `:195`, `:223-228`, `:238-253`, los tres campos de
  `territoryStats` (`:273-275`, `:286-295`, `:309-311`, `:322-331`, `:360-362`) y `:373-379`; añadir `inteligenciaIncluida`.
- `web/components/MapPopups.tsx`: quitar `contractValue` (`:113`, `:127`, `:141`, `:156-160`) y `TerritoryInfo.contracts`
  (`:296`, `:350-364`); nuevo `GirosComprasSection({ estado, data, error, onRetry, modo:'territorio'|'ips' })` con `PopupRow`,
  `opmap-popup__section`, "Ver los N proveedores" (estado local); usado por `TerritoryPopupCard` (`:313`), `IpsPopupCard`
  (`:117`) y `UnassignedPopupCard` (`:149`).
- `web/components/MapComponent.tsx`: quitar `showContracts` (`:447`), el filtro (`:1109-1134`), `contractValue` (`:1658`,
  `:1688`), `contracts` en `territoryInfo` (`:1597-1604`) y `onShowContractsChange` (`:2026`); `useQuery(['map-detalle', tipo,
  code])` junto a `:536-559`, `staleTime: 5 * 60_000`, `enabled: !!activePopup && mapData?.inteligenciaIncluida`; pasar datos a
  `renderActivePopup()` (`:1747-1795`). Globos (`territoryTooltipHtml`, `:1470-1495`) sin cambios.
- `web/components/MapControls.tsx`: quitar "Solo con Contratos" (`:35`, `:69`, `:266-269`, `:435-471`).
- Pruebas (`web/scripts`, puras, registradas en `"test"` de `web/package.json:14`): `mapa-detalle-check.ts` (reglas puras:
  ventanas, reparto, nada dos veces, exclusiones, privacidad, cuatro estados, orden); `mapa-detalle-api-check.ts` (Supabase
  falso de `mapa-zonas-api-check.ts:43-60, :300-319`: 401/403/200 por rol, RPC presente y ausente, sin escrituras ni red,
  `persona:` ausente del texto, 400/404); ajustar `mapa-zonas-api-check.ts:364, :402-411, :434-439, :456, :489-492` (ahora
  comprueban que `hospital_contracts` no se lee y que no hay campos de contratos).
- Migración opcional `2026-10-24_0880_adres_giros_nits.sql` / `2026-10-24_9948_…_rollback.sql` con la cabecera de la 0860
  (`database/migrations/2026-10-23_0860_lineas_permitidas.sql:1-12`), `BEGIN`/`COMMIT`, bloque `DO` de comprobación.
- Documentos: `docs/mapa-estetica.md:44-46` (contratos → giros y compras), `docs/specs/2026-10-14-mapa-vista-de-zonas-para-
  todos.md:58-61` y `docs/decisiones/2026-10-14-mapa-vista-de-zonas-para-todos.md:18` (nota "superado el 2026-10-24"),
  `docs/fases/fase3-adres.md` ("Carga completa" ya hecha), `docs/fases/fase5-secop.md` (ventana de 12 m del mapa),
  `web/docs/ROLES_AND_PERMISSIONS.md`, `CLAUDE.md` (una línea en "Reglas"), `docs/decisiones/2026-10-24-mapa-giros-y-compras.md`.

## Verificación final

`GOOGLE_ROUTES_DISABLED=true npm run check` en `web/` con la salida completa. Capturas de escritorio y a 390 px: Bucaramanga
(giros + 6 proveedores, PRECIMEC $8.050 M arriba), una localidad de Bogotá, un municipio de alcance sin IPS (una línea), una IPS
pública con contratos, una IPS privada (solo giros), una IPS pública sin contratos en 12 m; con admin y con `sales_manager` (sin
sección, sin error en consola); "Filtros y visitas" sin "Solo con Contratos". `mapa-estilo-check.ts` en verde. Subagente
`revisor` sobre el diff y esta spec antes de `/entregar`. La 0880 solo con autorización del dueño.

## Para decidir (dueño)

1. **Total de giros**: `todos` (contributivo + subsidiado + otro, $49,10 billones país en 12 m, como `/inteligencia`) o
   contributivo + subsidiado ($47,86 billones, como "Datos de la zona" y Población). **Recomendación**: `todos`, con las tres
   cifras visibles para que cualquier comparación se explique; después unificar "Datos de la zona" a `todos` (cambio aparte).
2. **Quién lo ve**: `intelligence:view` (admin, dirección, líderes, datos, viewer). Los Ejecutivos Comerciales (`sales_manager`)
   no. **Recomendación**: así por ahora; darles `intelligence:view` es una línea en `permissions.ts:110-115`, pero abre también
   todo `/inteligencia` (ranking por ejecutivo incluido). Decidirlo aparte si lo quiere.
3. **Quitar "Solo con Contratos" y la fila "Contratos"** del mapa sin reemplazo, dejando `/contracts` y `/providers` vivos hasta
   decidir su borrado. **Recomendación**: sí; un filtro "Solo con compras públicas" exigiría precálculo nacional y va aparte.
4. **Ventana SECOP de 12 meses solo en el mapa**; la ficha y el ranking siguen en 24. **Recomendación**: sí; si prefiere 12 en
   toda la app, es cambiar `SECOP_VENTANA_MESES` (`compras-publicas.ts:45`) y sus pruebas, en otra entrega.
5. **Proveedores**: solo las 6 líneas ortopédicas y neurocirugía, con "sin clasificar" aparte en una línea y **sin conmutador
   "todas las compras"**: la carga de SECOP solo guarda tres tipos de contrato (líneas ortopédicas, proveedores vigilados,
   servicios de especialistas), así que "todas las compras" del hospital no existe en la base y el conmutador prometería algo
   falso. **Recomendación**: rotular siempre "material ortopédico y neurocirugía"; si quiere, un conmutador "incluir sin
   clasificar" (proveedores vigilados sin línea) es barato y honesto.
6. **Personas naturales proveedoras** (5 contratos ortopédicos en 12 m): no nombrarlas en el mapa, agruparlas como "Personas
   naturales: N contratos". La ficha sigue mostrándolas. **Recomendación**: sí.
7. **RPC `adres_giros_nits`** (migración 0880, aditiva, con rollback): sin ella cada clic lee 1,56 MB de `adres_giros_intel`
   (≈ 740 ms). **Recomendación**: aplicarla con el despliegue; el código funciona antes y después.
8. **NIT de HOCEN**: OpMap tiene 830041314 (2 contratos de 2017); SECOP contrata con 830067597 (9 contratos, $668 M en 12 m) que
   hoy no se enlazan a ninguna IPS. Es dato, no código: revisar `hospitals.code` o un alias. **Recomendación**: corregir el dato.
9. **Globos (tooltips)**: quedan como hoy, sin cifras. **Recomendación**: sí; meter números cambia el tamaño visual.
10. **Municipio de alcance sin IPS**: una línea explicando que no hay dato, o nada. **Recomendación**: la línea, para que las
    líderes no crean que falló.

## Cifras de referencia (lectura de solo lectura, 2026-10-25)

Giros 12 m (Identifica, 2025-10-01 a 2026-09-30, reparto por camas): 600 NIT con giro, $49,102 billones (contributivo 24,842;
subsidiado 23,016; otro 1,245); 680 de 783 IPS con NIT con giro; 145 de 147 municipios con IPS tienen giros; top: Bogotá
13.529,6 mil millones, Medellín 4.788,4, Cali 3.801,4. SECOP 12 m (2025-11-01 a hoy, IPS de OpMap, 6 líneas, sin servicios):
287 contratos, $120.819 M, 41 entidades, 75 proveedores empresa (los 10 primeros suman el 66 %: OSTEOCOL $18.675 M,
SOLUCIONES MEDICAS DEL NORTE $13.700 M, TRAUMASUR $8.117 M…); solo 36 municipios con compras ortopédicas y 46 de 141 NIT
públicos con contratos; sin clasificar 68 contratos ($8.759 M); servicios de especialistas 398; estimados y fuera de escala 0.
Top municipios: Ocaña $13.851 M, Tunja $13.844 M, Bucaramanga $9.785 M; Bogotá puesto 11 ($4.817 M). `hospital_contracts`:
93 filas, 92 activas vencidas, última edición 2025-12-30.
