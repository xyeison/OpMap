# Spec: Zonas por línea para las líderes  (2026-10-23)

**Estado**: aprobada por el dueño (respuestas del 2026-10-23; decisión en
`docs/decisiones/2026-10-23-zonas-por-linea-las-lideres-asignan.md`). Quedan dos confirmaciones menores al final.

## Problema

El dueño, con sus palabras: "la idea es que ellas [las líderes] puedan definir las zonas. ¿Cuáles son las zonas? ¿De qué
forma pueden verlas con datos ciertos: qué tan grande es, qué municipios cubre, cuántas clínicas, población, cuánta plata
reciben esas IPS de la ADRES? Que ellas le pongan la zona a la comercial o a la que esté vacante… yo quiero trabajar en
Pereira: a la comercial de Pereira le pongo mi línea para que vaya construyendo su mapa".

Hoy:

- Las cifras de una Zona solo existen por persona o vacante, en "Datos de la zona" de `/executives`. Una Zona sin nadie
  (Engativá, Kennedy, San Cristóbal, Ibagué) no tiene dónde mostrarlas.
- `/lines` muestra quién cubre cada Zona en una línea, sin las cifras de la Zona al lado.
- Una líder puede forzar un ajuste manual, pero **no** puede dar o quitar su línea a un Ejecutivo Comercial ni a una
  vacante: eso exige `executives:edit`, que `line_leader` no tiene (`web/lib/permissions.ts:124-144`).
- "Vacante" nombra dos cosas: la persona por contratar (`executives.status = 'placeholder'`) y la celda de cobertura sin
  nadie dentro del tope (`coverage.kind = 'vacant'`, etiqueta "Vacante" en `app/lines/coverage-shared.ts:71`).
- La tabla `coverage` se calculó el 2026-10-11 y no refleja las vacantes creadas el 2026-10-14 (Neiva aparece sin
  cobertura en Sustitutos óseos aunque Vacante Neiva lleva la línea).
- No hay forma de que la dirección limite qué líneas puede tener una persona, así que una líder podría asignar por error.

Lo que el modelo ya resuelve: una vacante "para unas líneas y no para otras" es una fila `placeholder` con esas filas en
`executive_lines` (Vacante Barranquilla lleva Medicina deportiva y Columna; Vacante Bogotá lleva Reemplazo articular,
Medicina deportiva y Columna; ninguna lleva Sustitutos óseos). Las cifras de una Zona no dependen de la línea.

## Resultado esperado

### E1 · La página "Zonas" (`/kams`, menú existente) es la entrada de las líderes

- Encabezado "Zonas" · "Ciudades base, qué cubre cada una y quién la atiende en tu línea". Selector de línea (pestañas
  con `?line=<code>`; las líneas de `resolveUserLines`; por defecto la primera).
- Una fila por Zona activa (16). Bogotá va agrupada como "Bogotá (4 zonas)" con su total y sus cuatro celdas debajo.
  - **Qué hay en la Zona** (igual para todas las líneas): IPS y camas; municipios (con IPS, de alcance, compartidos);
    departamentos; población DANE del año; afiliados BDUA con su corte; giros ADRES de 12 meses con su fuente y ventana.
    Las cuentas salen de `construirBloque([kam_id], datos)` (`lib/zona-estadisticas.ts:708`): mismas reglas que
    "Datos de la zona" (municipio con IPS repartido por camas, giro del NIT repartido por sedes, nada dos veces).
    "Ver datos" abre la ventana "Datos de la zona" de esa Zona (misma ventana que hoy, sin cabecera de persona).
  - **Vive aquí**: Ejecutivos Comerciales y vacantes con `base_kam_id` en la Zona, con chips de sus líneas y, si la
    dirección la limitó, la nota "solo puede tener: <líneas>".
  - **En mi línea**, un estado derivado de la cobertura **calculada en memoria** (`estadoDePlaza`):
    `Ocupada · <nombre>` (local o ajuste manual a una persona) · `Reservada · Vacante <ciudad>` (local o ajuste a una
    vacante) · `Por alcance · <nombre> desde <zona> · 2 h 30` · `Sin cobertura (más cercana: <nombre>, 5 h 08)` ·
    `Conflicto: <nombres>` · insignia "Sin equipo" si `has_equipment = false`.
  - **Acciones** (solo quien puede asignar en esa línea): "Darle <línea> a…", "Quitarle <línea>", "Forzar a alguien de
    otra ciudad…" (ajuste manual existente), "Quitar ajuste", "Ver datos".
- Chips de la línea: Ocupadas · Reservadas · Por alcance · Sin cobertura · Conflicto · Sin equipo.
- Si la cobertura guardada no coincide con la calculada, la ruta **recalcula y guarda** al abrir (sin Google) y la
  página lo dice: "Cobertura actualizada ahora". El mapa deja de quedar desactualizado.
- Pie con fuentes y cortes reales (DANE, BDUA, giros según `chooseGirosSource`, fecha de la cobertura), la nota de
  Bogotá (la población de una celda es la parte de la ciudad repartida por camas más sus municipios de alcance) y la de
  las IPS activas sin Zona. "Nada de esta pantalla calcula rutas ni consulta Google."
- La administración de Zonas (Agregar, colores, editar, desactivar, Bogotá) queda plegada al final y solo para
  `kams:edit` / `kams:bogota-config`; hoy se muestra a quien recibe 403. El valor de contratos solo con `contracts:view`.
- La celda `vacant` pasa a llamarse **"Sin cobertura"** en `/kams`, `/lines` y la leyenda del mapa.
- Enlace "Ver en el mapa" → `/map?line=<code>` (existe).

### E2 · Asignar (solo en la línea propia; toda escritura muestra antes la vista previa simulada)

| Acción | Qué guarda | Efecto |
|---|---|---|
| Darle mi línea a quien vive en la Zona (persona o vacante) | inserta `executive_lines`; recalcula | Ocupada (Reservada si es vacante). Si otro residente ya lleva la línea → Conflicto, que se resuelve con ajuste manual a un residente. 409 si la dirección no permitió esa línea para esa persona |
| Quitarle mi línea | borra `executive_lines`; recalcula | Vuelve a Por alcance o Sin cobertura. Confirmación con la cuenta de médicos de esa línea que pierden visitante (disparador 0820) |
| Dejar abierta | nada | La toma la más cercana que lleve la línea dentro de `max_reach_minutes`, o queda Sin cobertura |
| Forzar a alguien de otra ciudad / Quitar ajuste | `POST`/`DELETE /api/coverage/overrides` (existen) | Regla del 2026-10-11 intacta: 409 si en la Zona vive alguien con la línea |
| Bogotá: "Darle <línea> en Bogotá" | una sola fila de `executive_lines` para quien vive en una celda | Las otras tres celdas le llegan por alcance (26 a 30 min) si nadie local las lleva; la vista previa muestra las cuatro |

**Vacantes.** Son plazas autorizadas por la gerencia; las crea la dirección (Traspasar). La líder no crea vacantes:
le da su línea a la que ya vive en la Zona. "Contratar" sigue igual: la misma fila pasa a `active` y "Reservada ·
Vacante X" pasa a "Ocupada · <nombre>".

**Líneas permitidas (restricción de la dirección).** En Ejecutivos Comerciales (`executives:edit`) cada persona o vacante
tiene "Líneas permitidas": vacío = sin restricción; con valores = solo esas. La API de líneas rechaza con 409 cualquier
otra ("La dirección limitó a <nombre> a: <líneas>"); el botón en Zonas sale deshabilitado con ese texto. Datos iniciales
(migración 0870): la persona de Barranquilla → Sustitutos óseos y Reemplazo articular; Vacante Barranquilla → Medicina
deportiva, Columna y Trauma; las demás sin restricción.

**Borrado inicial.** La migración de datos 0870 copia `executive_lines` a `executive_lines_respaldo_20261023`, borra
todas las filas y deja las dos restricciones. Se aplica solo con autorización del dueño, en la ventana del despliegue;
después se recalcula la cobertura (`npm run fase2:recalculate` o el botón). Consecuencias que el dueño aceptó: hasta que
cada líder asigne, su línea se ve sin cobertura; los Ejecutivos Comerciales no ven líneas en el mapa ni en la app; el
disparador 0820 termina los visitantes de los 10 médicos de prueba.

**Mapa (autorizado por el dueño el 2026-10-23).** En la vista por línea, las Zonas sin cobertura se pintan en gris con un
tono distinto por Zona (`grisDeZona`: lightness en rampa sobre las Zonas activas ordenadas por nombre, con un leve matiz
del color de la Zona), relleno, IPS e insignia hueca; borde como hoy. Leyenda: "Sin cobertura en esta línea (gris, un
tono por Zona)". Nada más de la estética cambia; se anota en `docs/mapa-estetica.md`.

**No cambia:** `computeCoverage` (manual → local/conflicto → alcance → sin cobertura; vacante elegible como persona;
`overrideBlockingResidents`; matriz por mediana de `hospital_kam_distances`), `recomputeAndSaveCoverage`, Bogotá por
corredores, `assignments`, `municipality_zone`, Traspasar, Contratar, `/lines` (salvo la etiqueta), la app móvil.

## Criterios de aceptación (se convierten en pruebas)

- [ ] Una líder de Reemplazo articular abre `/kams` y ve las 16 Zonas con cifras, quién vive en cada una y el estado en
      su línea; `?line=` de otra línea responde 403; nunca ve personas de líneas que no ve (`mapa-zonas-api-check.ts`).
- [ ] `hr` recibe 403 sin leer nada; `viewer` ve todas las Zonas; SECOP solo con `intelligence:view`; valor de contratos
      solo con `contracts:view`.
- [ ] Suma de IPS por Zona = IPS asignadas; municipio con IPS en dos Zonas repartido por camas sin contarse dos veces; el
      giro de un NIT con dos sedes repartido por camas; Bogotá por celda con `municipioZoneShares`.
- [ ] `coberturaDesactualizada` es verdadero si cambia `kind` o `executive_id` de una celda; la ruta recalcula y guarda
      una sola vez y responde `cobertura.recalculada = true`; si coincide, no escribe.
- [ ] `estadoDePlaza` cubre las 5 `kind` × `active`/`placeholder` × `has_equipment`.
- [ ] Simulación pura: dar la línea a una vacante residente en una Zona sin local → `local` (Reservada); con residente
      activo que ya lleva la línea → `conflict`; la vacante con la línea compite por alcance hacia una vecina sin local y
      un ajuste a persona lo corrige; quitar la línea a la única local → `reach` si hay vecina ≤ tope y si no `vacant`
      con `nearest`; ajuste desde otra ciudad bloqueado por una vacante residente; `diff` vacío si nada cambia y las
      entradas no se mutan; dar la línea a quien vive en Chapinero deja Engativá, Kennedy y San Cristóbal por alcance.
- [ ] `executives:lines` lo tienen exactamente admin, commercial_director y line_leader; la líder solo en su línea
      (403 en otra); ejecutivo `inactive` o sin zona base → 400; `PUT` idempotente; respuesta con `medicosTerminados`.
- [ ] Líneas permitidas: `PUT` de una línea no permitida → 409 con `lineasPermitidas`; `PATCH /api/executives/[id]` con
      `lines` fuera de `lineas_permitidas` → 400; sin filas = todo permitido; `GET /api/executives` trae
      `lineas_permitidas`.
- [ ] `POST /api/coverage/simular` nunca escribe (el Supabase falso rechaza toda escritura); recorta el `diff` a las
      líneas del usuario; 403 si un cambio es de otra línea; máximo 20 cambios.
- [ ] `grisDeZona` da 16 valores distintos y deterministas para las 16 Zonas activas, todos colores CSS válidos, y el
      mismo valor para la misma Zona en cualquier orden de entrada.
- [ ] Ninguna ruta nueva importa `lib/google-distance.ts`. `menu-check.ts` sigue en verde sin cambios.
- [ ] Migraciones 0860 y 0870 con rollback, idempotentes, con los `REVOKE` de las tablas nuevas; la 0870 falla con
      `RAISE` si no encuentra exactamente una persona activa en Barranquilla con Sustitutos óseos o una Vacante
      Barranquilla; ninguna se aplica sin autorización del dueño.
- [ ] Nada de "KAM", "panel", "representante" ni "PerOssal" como línea en texto visible; la línea es "Sustitutos óseos".

## Fuera de alcance

Tabla de plazas, `kind = 'reserved'`, siglas y códigos de Zona por línea, nombre de Zona por línea; que la reserva no
compita por alcance (el dueño confirmó que sí compite); crear vacantes desde Zonas; productos dentro de una línea; Zonas
nuevas o cambio de municipios (Google y autorización); cambios a la app móvil; filtrar IPS o población por línea; mover
`base_kam_id` desde esta pantalla; relevos de personas (Traspasar); cualquier cambio del mapa fuera de los grises por
Zona y el texto de la leyenda.

## Impacto

- Datos / migración: **sí**. `database/migrations/2026-10-23_0860_lineas_permitidas.sql` (tabla
  `executive_allowed_lines`) con rollback `2026-10-23_9946_lineas_permitidas_rollback.sql`; y la migración de datos
  `2026-10-23_0870_borrar_lineas_para_redistribuir.sql` (respaldo + borrado + dos restricciones) con rollback
  `2026-10-23_9947_borrar_lineas_para_redistribuir_rollback.sql` (restaura desde el respaldo). Se aplican solo con
  autorización del dueño, en la ventana del despliegue, y la 0870 va seguida del recálculo de cobertura.
- Costo Google Maps: **0 elementos**.
- Estética del mapa: **cambia solo la vista por línea**: grises por Zona para "Sin cobertura" y el texto de la leyenda.
  Autorizado por el dueño el 2026-10-23; se anota en `docs/mapa-estetica.md`.
- Permisos / roles: nuevo `executives:lines` (admin, commercial_director, line_leader en su línea). Las cifras de `/kams`
  usan la puerta de "Datos de la zona" (`executives:view` + `hospitals:view`); `hr` queda fuera. Documentar en
  `web/docs/ROLES_AND_PERMISSIONS.md`.

## Plan (archivos e interfaces)

Contratos compartidos (quien construya la UI y quien construya la API se atienen a esto):

```ts
// web/lib/types/zonas.ts
export type EstadoPlaza = 'ocupada' | 'reservada' | 'alcance' | 'sin_cobertura' | 'conflicto'
export interface EjecutivoRef { id: string; nombre: string; status: 'active' | 'placeholder' }
export interface ZonaEnLinea {
  estado: EstadoPlaza; ejecutivo: EjecutivoRef | null; desde: { kam_id: string; nombre: string } | null
  minutos: number | null; masCercano: (EjecutivoRef & { minutos: number | null }) | null
  ajuste: { id: string; motivo: string } | null; sinEquipo: boolean; nota: string | null
}
export interface ZonaResidente extends EjecutivoRef { lineas: string[]; lineasPermitidas: string[] | null } // codes
export interface ZonaCifras {
  ips: number; camas: number; municipios: number; municipiosConIps: number; municipiosAlcance: number
  municipiosCompartidos: number; departamentos: string[]; poblacion: number | null; poblacionAnio: number | null
  afiliados: number | null; afiliadosCorte: string | null; giros12m: number | null; girosFuente: string | null
  girosDesde: string | null; girosHasta: string | null
}
export interface ZonaFila {
  kam_id: string; nombre: string; ciudad_base: string | null; departamento: string | null; area_id: string
  color: string | null; bogota: boolean; cifras: ZonaCifras; residentes: ZonaResidente[]; enLinea: ZonaEnLinea | null
}
export interface ZonasResponse {
  linea: { id: string; code: string; name: string; max_reach_minutes: number } | null
  lineas: Array<{ id: string; code: string; name: string }>
  zonas: ZonaFila[]
  bogota: { kam_ids: string[]; cifras: ZonaCifras } | null
  cobertura: { calculadaEn: string | null; desactualizada: boolean; recalculada: boolean }
  acceso: { asignar: boolean; ajustar: boolean; comprasPublicas: boolean; administrar: boolean }
  notas: string[]
}
// web/lib/cobertura-simulacion.ts
export type Cambio =
  | { tipo: 'linea_agregar'; executive_id: string; line_id: string }
  | { tipo: 'linea_quitar'; executive_id: string; line_id: string }
  | { tipo: 'ajuste'; line_id: string; kam_id: string; executive_id: string }
  | { tipo: 'quitar_ajuste'; override_id: string }
export interface DiffCelda { line_id: string; kam_id: string; antes: { kind: CoverageKind; executive_id: string | null }; despues: { kind: CoverageKind; executive_id: string | null } }
```

| Ruta | Método | Quién | Qué hace |
|---|---|---|---|
| `/api/kams/zonas?line=<code>` | GET | sesión + `puedeVerDatosDeZona`; línea por `findAccessibleLine` (403) | `cargarDatosZonas()` una vez; por Zona activa `construirBloque([kam_id])`, residentes, `computeCoverage` en memoria; si difiere de la tabla, `recomputeAndSaveCoverage()` y `recalculada: true`; responde `ZonasResponse` |
| `/api/kams/[id]/estadisticas` | GET | ídem | "Datos de la zona" por Zona; `coberturaDeZona` solo en `lineasConCobertura`; 404 si no existe |
| `/api/executives/[id]/lineas/[lineId]` | PUT / DELETE | `executives:lines` + `canEditCoverageLine` | ejecutivo `active`/`placeholder` con zona base (400); línea activa (400); 409 si no está en `executive_allowed_lines` cuando hay filas; inserta/borra `executive_lines`; `recalcularCobertura()`; idempotente; `{ ejecutivo: {id, nombre, status, lineas}, medicosTerminados, cobertura: { recalculada: true } }` |
| `/api/coverage/simular` | POST `{ cambios: Cambio[] }` (≤ 20) | sesión; cada `line_id` en `resolveUserLines` (403) | `loadCoverageInputs` + `simularCobertura`; `{ diff: DiffCelda[] con nombres, resumen: Record<line_code, Record<EstadoPlaza, number>> }` recortado a sus líneas; nunca escribe |
| `/api/executives` y `/api/executives/[id]` | GET / PATCH | `executives:view` / `executives:edit` | `lineas_permitidas: string[] \| null` (ids); PATCH valida `lines ⊆ lineas_permitidas` (400) y reemplaza las filas de `executive_allowed_lines` |

Archivos:

- `web/lib/cobertura-simulacion.ts` (puro, nuevo): `aplicarCambios(inputs, cambios)` (copias; nunca muta),
  `simularCobertura(inputs, matrix, cambios) → { antes, despues, diff }` sobre `computeCoverage` (nunca sobre la tabla),
  `estadoDePlaza(kind, ejecutivo, has_equipment)`, `coberturaDesactualizada(guardada, calculada)`,
  `resumenPorEstado(filas)`. Nombre distinto de `scripts/simulacion-check.ts`.
- `web/lib/types/zonas.ts` (nuevo): los contratos de arriba.
- `web/lib/permissions.ts`: `executives:lines` en admin, commercial_director y line_leader.
- `web/app/api/kams/_lib/zonas-server.ts` (nuevo): `cargarDatosZonas(user)` extraída de
  `app/api/executives/[id]/estadisticas/route.ts:237-342` (sin visitas ni médicos); la ruta de ejecutivos pasa a usarla.
- Rutas nuevas: `web/app/api/kams/zonas/route.ts`, `web/app/api/kams/[id]/estadisticas/route.ts`,
  `web/app/api/executives/[id]/lineas/[lineId]/route.ts`, `web/app/api/coverage/simular/route.ts`. Todas con
  `dynamic = 'force-dynamic'`, `Cache-Control: no-store`, zod y `UUID_RE`.
- `web/app/api/executives/route.ts`, `[id]/route.ts` y `_lib/executive-shared.ts`: `lineas_permitidas`.
- UI: `web/app/kams/page.tsx` (selector de línea, tabla y tarjetas a 390 px, estados, acciones, administración
  plegada tras `kams:edit`), `web/app/kams/ZonaDatosModal.tsx`, extracción de `Bloque`/`Tarjeta`/`CoberturaBase` de
  `app/executives/ZonaEstadisticasModal.tsx` a `web/app/executives/zona-bloques.tsx`, diálogos "Darle/Quitarle <línea>"
  con "Vista previa" (`POST /api/coverage/simular`) y "Guardar"; `AdjustModal` reutilizado; campo "Líneas permitidas" en
  `app/executives/ExecutiveModal.tsx`.
- `web/app/lines/coverage-shared.ts`: `KIND_LABELS.vacant` → "Sin cobertura".
- `web/components/mapStyles.ts`: `grisDeZona(kam_id, zonas)` y documentación; `web/components/MapComponent.tsx`: usarlo
  en relleno, IPS e insignia de Zonas `vacant` en la vista por línea; etiqueta de leyenda.
- Migraciones: `2026-10-23_0860_lineas_permitidas.sql` / `9946` rollback; `2026-10-23_0870_borrar_lineas_para_redistribuir.sql`
  / `9947` rollback. Patrón: cabecera, `BEGIN`/`COMMIT`, `IF NOT EXISTS`, RLS sin políticas, `REVOKE` a `anon`/`authenticated`,
  comentarios en español, bloque `DO` de comprobación al final.
- Pruebas (`web/scripts`, puras; añadidas a `"test"` en `package.json`): `cobertura-simulacion-check.ts`,
  `zonas-api-check.ts` (Supabase falso de `zona-estadisticas-api-check.ts`), `lineas-api-check.ts`,
  `mapa-estilo-check.ts`.
- Documentos: `web/docs/ROLES_AND_PERMISSIONS.md`, `docs/fases/fase2-cobertura-por-linea.md`, `docs/mapa-estetica.md`,
  `CLAUDE.md` (una línea en "Reglas").

## Verificación final

`GOOGLE_ROUTES_DISABLED=true npm run check` en `web/` con la salida completa. Capturas de `/kams` en escritorio y a
390 px para admin y para una líder de línea: tabla con cifras y estados, "Ver datos" de una Zona sin persona (Ibagué),
diálogo "Darle <línea> a…" con la vista previa, y el mapa por línea con los grises por Zona. Subagente `revisor` sobre el
diff y esta spec antes de `/entregar`. Las migraciones se aplican solo con autorización del dueño; la 0870 va seguida del
recálculo de cobertura.

## Para confirmar (dueño)

1. En la base hay cuatro vacantes: Barranquilla, Bogotá, Cúcuta y Neiva. ¿Las cuatro son plazas autorizadas? Si Cúcuta o
   Neiva no lo son, la dirección las desactiva en Ejecutivos Comerciales; la pantalla no las trata distinto.
2. Tras el borrado, ¿la persona de Barranquilla conserva Sustitutos óseos y Reemplazo articular, o se las vuelven a dar
   las dos líderes? Recomendación: que se las den las líderes, como a todas; la restricción ya impide darle otra.

## Texto para el acta

> **Zonas en OpMap.** Cada Zona es una ciudad base con lo que hoy cubre: sus IPS y camas, los municipios con IPS y los
> que le llegan por tiempo real de carretera, sus departamentos, la población (DANE), los afiliados (BDUA) y los giros
> de la ADRES de los últimos doce meses. Esas cifras son las mismas para todas las líneas; lo que cambia por línea es
> quién la atiende.
>
> Se borra la asignación de líneas que había y se redistribuye desde cero. Cada líder entrará a "Zonas", elegirá su
> línea y verá cada Zona como **ocupada**, **reservada** (una vacante autorizada por la gerencia la guarda mientras se
> contrata) o **sin cobertura**, junto con quién vive en la Zona y qué líneas puede tener.
>
> Cada líder, solo en su línea y con vista previa antes de guardar, le dará su línea al Ejecutivo Comercial o a la
> vacante de cada Zona donde quiera trabajar, y podrá quitarla o forzar a alguien de otra ciudad cuando en la Zona
> nadie lleve la línea. Quien no tenga nadie en una Zona la verá en gris en el mapa. La dirección puede fijar qué
> líneas puede tener cada persona, para que nadie asigne por error.
>
> Orden sugerido: (1) revisar las cifras de las Zonas; (2) dar la línea a quien vive en cada Zona donde se quiere
> trabajar, incluidas las vacantes; (3) usar el ajuste manual solo para excepciones, con motivo; (4) anotar las Zonas
> que quedan sin cobertura para decidir contrataciones. Nada de esto calcula rutas ni tiene costo.

## Cifras de referencia (lectura de solo lectura del 2026-10-23, verificadas por dos consultas independientes)

16 Zonas activas y 1 inactiva (Sincelejo). 783 IPS activas, 766 asignadas, 17 sin Zona (901.552 M COP de giros que no
entran en ninguna fila). Municipios: 136 con IPS, 840 por alcance, 79 fuera de alcance, 66 sin ruta. Giros ADRES de 12
meses (Identifica tu Giro, contributivo + subsidiado, oct-2025 a sep-2026): 47,86 billones COP. Cobertura guardada del
2026-10-11: 80 celdas, 26 locales, 20 por alcance, 34 sin cobertura, 0 ajustes, 0 conflictos; nadie lleva Trauma.
Bogotá por celda solo con el reparto de la app (`municipioZoneShares`): Chapinero 3.747.693 hab., Engativá 5.097.608,
Kennedy 2.255.244, San Cristóbal 3.063.588; agregado 182 IPS, 15.591 camas, 14.164.133 hab., 17,15 billones COP.
Página para el acta: https://claude.ai/artifact/D9aM1macUX9Ko2krXYroxL
