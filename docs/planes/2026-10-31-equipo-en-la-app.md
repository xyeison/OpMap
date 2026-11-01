# Plan: "Equipo" en la app, dónde están y cómo rinden  (2026-10-31, Entrega 2)

> **Para quien ejecute el plan:** usar la skill `executing-plans` (o `subagent-driven-development`) tarea por tarea.
> Los pasos llevan casillas (`- [ ]`). Primero la prueba que falla, después el código, después `npm run check`.

**Objetivo:** una pestaña "Equipo" en la app de campo donde la dirección, el administrador y cada líder ven dónde está
su gente (por lo reportado y agendado) y cómo rinde en un periodo, con el reparto por línea; se entra desde el menú de
OpMap sin contraseña.

**Arquitectura:** las reglas (quién ve a quién, dónde está, cadenas de "otra fecha", cifras) viven PURAS en
`web/lib/equipo.ts` y se prueban sin red; `web/app/api/equipo/*` lee las tablas con `supabase-admin`, arma filas mínimas
(sin transcripción, foto, documento ni GPS) y llama a esas funciones; la app (`mobile/`) solo pinta y guarda la última
respuesta. El servidor dice quién supervisa (`supervisa` en `/api/auth/me`, permiso `team:view`); la app decide sus
pestañas con eso y con la persona.

**Tecnología:** Next.js 14 (`web/`), Expo + expo-router (`mobile/`), pruebas puras con `tsx`
(`web/scripts/*-check.ts` con `scripts/lib/fake-supabase.ts`; `mobile/scripts/checks/*.ts`).

**Spec:** `docs/specs/2026-10-31-equipo-en-la-app-y-ejecutivos-de-vuelta.md` (sección "Entrega 2"). Base: la rama
`feat/ejecutivos-de-vuelta-a-la-app` (PR #75); esta rama (`feat/equipo-en-la-app`) sale de ella.

## Restricciones globales

- Sin migración, sin Google, sin tocar el mapa de asignación ni su estética. Terminología: "Ejecutivo Comercial",
  "Zona", "IPS"; nunca "KAM". Textos en español.
- **Privacidad (spec)**: `/api/equipo/*` nunca devuelve `transcript`, `foto_path`, `gps_accuracy_m`, `distance_m`,
  `lat/lng` de la visita, `conclusion`, `compromisos`, ni el documento, teléfono o correo de un médico o contacto.
  Solo sede y municipio. Las marcas (`marcas`) sí, como lista de códigos.
- **Nunca ubicación en vivo** (C5): todo sale de `visits` y `visitas_agenda`. El texto fijo arriba de Equipo › Hoy:
  `Lo que cada persona reporta o agenda. La app no sigue la ubicación.`
- **VMO fuera**: solo `visits.source = 'app'` y `deleted_at IS NULL`; citas con `estado <> 'eliminada'`.
- Tipos compartidos: lo que la API responde se declara en `web/lib/reporte-visitas.ts` (sección "Equipo") y se COPIA a
  `mobile/lib/tipos.ts`; cada forma nueva entra en `mobile/lib/claves-api.ts` (`exactas<T>()`), y
  `web/scripts/reporte-api-check.ts` ya vigila que web y app se asignen entre sí.
- La app no decide por el nombre del rol: usa `supervisa` y `persona` del servidor (sin el dato, como antes).
- `npm run check` en verde en `web/` y en `mobile/` antes de dar por terminado; mostrar la salida. Commits en español
  con prefijo convencional y el porqué.

## Puntos de revisión (lo que la spec implica y ninguna prueba cubría)

1. **Paola vista por la líder de Sustitutos óseos**: solo lo que hizo con `executive_id` (sus visitas y citas como
   Ejecutiva); sus visitas de Trauma como líder no salen ni en Hoy ni en Rendimiento. Prueba en la Tarea 2 y en la
   Tarea 6 (la API filtra).
2. **Una visita con dos líneas** cuenta una vez en "hechas" y una vez en cada línea de "por línea"; la suma por línea
   supera las hechas y la respuesta lo dice (`porLinea.sumaSuperaHechas: true`). Tarea 4.
3. **Un periodo con cambio de mes** (p. ej. 15 días del 25 al 9): `cuota` null para todos. Tarea 4.
4. **Una persona sin nada en el periodo** sale en Rendimiento con ceros (y en Hoy con "Sin reportes ni plan hoy"), no
   desaparece; quien ya no está y no tiene nada en el periodo NO sale. Tareas 3 y 4.
5. **Un id de persona fuera de `personasVisibles`** → 404 en `persona/[id]` y `persona/[id]/rendimiento`, también
   para la dirección si el id no es persona de campo. Tarea 6.
6. **Sin señal** la pantalla muestra lo último guardado con "Visto hace N min" y no deja cambiar de día ni de periodo;
   sin nada guardado, el aviso de sin conexión. Tarea 9.

---

### Tarea 1: permiso `team:view`, "Equipo" en el menú, `supervisa` en `/api/auth/me` e ingreso único

**Archivos:**
- Modificar: `web/lib/permissions.ts` (tipo `Permission`; listas de `admin`, `commercial_director`, `line_leader`;
  `getNavigationMenu`: `if (tiene('team:view')) menu.push({ name: 'Equipo', href: '/campo/equipo', icon: 'users' })`
  justo después de "Agendamiento" y antes de "Mapa"; `getAllowedRoutes`: `/campo/equipo`).
- Modificar: `web/app/api/auth/me/route.ts` (`supervisa: hasPermission(user.role, 'team:view')`),
  `web/lib/reporte-visitas.ts` (`MeResponse.supervisa: boolean`), `mobile/lib/tipos.ts` (igual),
  `mobile/lib/claves-api.ts` (`me`: añadir `'supervisa'`).
- Modificar: `web/app/api/auth/sesion-app/route.ts` (acepta `campo:app` o `team:view`; encabezado: "una sola app, un
  solo ingreso, dueño 2026-10-31").
- Modificar: `web/docs/ROLES_AND_PERMISSIONS.md` (`team:view`, `campo:app`).
- Pruebas: `web/scripts/menu-check.ts` (`ORDEN` y `ESPERADO`), `web/scripts/reporte-check.ts` (sesion-app),
  `web/scripts/reporte-api-check.ts` (`me` trae `supervisa`), `mobile/scripts/movil-check.ts` (claves de `me`).

**Interfaces:**
- Produce: `Permission 'team:view'` (admin, commercial_director, line_leader); menú `Equipo → /campo/equipo` para esos
  tres (en el admin y la dirección va PRIMERO; en la líder, segundo, tras Agendamiento); `MeResponse.supervisa`.

- [ ] **Paso 1 (RED):** en `menu-check.ts`: `ORDEN` con `'/campo/equipo'` tras `'/campo/agenda'`; `ESPERADO.admin`
  empieza con `'/campo/equipo'`; `commercial_director` empieza con `'/campo/equipo'`; `line_leader` con
  `['/campo/agenda', '/campo/equipo', …]`; `eq('team:view está en admin, commercial_director y line_leader', …)`;
  `eq('Equipo', getNavigationMenu('commercial_director')[0], { name: 'Equipo', href: '/campo/equipo', icon: 'users' })`.
  En `reporte-check.ts:1630`: `deAdmin.status === 200` con `deAdmin.body.token === tokenDe(USUARIO_ADMIN)` (el
  administrador ya entra con el ingreso único) y un `viewer` → 403 (añadir `cookieDe` de un usuario viewer si no hay).
  En `reporte-api-check.ts` (sección 16, al final): `meDirectoraSolo.body.supervisa === true`,
  `meAdminSolo.body.supervisa === true`, `meLuciaSolo.body.supervisa === true`, `meAna.body.supervisa === false`.
- [ ] **Paso 2:** correr las tres → fallan.
- [ ] **Paso 3 (GREEN):** los cambios de arriba. `ok('me', …)` de la prueba exige las claves exactas: actualizar
  `claves-api.ts` (`me`) y el tipo de la app en el mismo paso.
- [ ] **Paso 4:** `cd web && npx tsx scripts/menu-check.ts && npx tsx scripts/reporte-check.ts && npx tsx
  scripts/reporte-api-check.ts` → 0 fallas; `cd mobile && npm run check` → verde.
- [ ] **Paso 5: commit** `feat(equipo): permiso team:view, "Equipo" en el menú y supervisa en /api/auth/me`.

### Tarea 2: `web/lib/equipo.ts`: quién ve a quién, anticipación y cadenas de "otra fecha"

**Archivos:**
- Crear: `web/lib/equipo.ts` (puro; importa solo tipos y `fechaBogota` de `./reporte-visitas`, `sumarDias` de
  `./visits-rules`, `estadoVisible` y tipos de `./agenda-ciclo`).
- Crear: `web/scripts/equipo-check.ts` (añadir a `"test"` de `web/package.json`, antes de `tema-check`).

**Interfaces (produce):**
```ts
export type PapelEquipo = 'lider' | 'ejecutivo' | 'lider_y_ejecutivo'
export interface PersonaEquipo {
  userId: string; nombre: string; papel: PapelEquipo
  executiveId: string | null; kamId: string | null; zona: string | null; municipio: string | null
  lineasEc: string[]; lineasLider: string[]
  /** users.active y, con Ejecutivo Comercial, executives.status = 'active'. */
  activa: boolean
}
export interface AlcanceEquipo {
  personas: PersonaEquipo[]
  /** userIds que esta supervisora ve SOLO como Ejecutivo Comercial (filas con executive_id). */
  soloComoEjecutivo: Set<string>
}
export function personasVisibles(
  quien: { id: string; role: string },
  personas: readonly PersonaEquipo[],
  lineasQueLidera: readonly string[]
): AlcanceEquipo
/** Una visita o cita reducida a lo que Equipo necesita (nunca GPS, transcripción ni documento). */
export interface VisitaEquipo {
  id: string; userId: string; executiveId: string | null; fecha: string; checkedInAt: string
  tipo: TipoVisita; modalidad: Modalidad; efectiva: boolean; motivoCodigo: string | null; failureReason: string | null
  medicoId: string | null; medicoNombre: string | null; cuentaId: string | null; cuentaNombre: string | null
  sedeId: string | null; sedeNombre: string | null; municipioId: string | null; municipioNombre: string | null
  lineas: string[]; agendaId: string | null; agendada: boolean; marcas: MarcaVisita[]
  medicoNoListado: string | null
}
export interface CitaEquipo {
  id: string; userId: string; executiveId: string | null; fecha: string; hora: string | null; createdAt: string
  tipo: TipoVisita; estado: EstadoCita; vieneDe: string | null; visitaId: string | null
  motivoCodigo: MotivoCierre | null; noRealizadaMotivo: string | null
  medicoId: string | null; medicoNombre: string | null; cuentaId: string | null; cuentaNombre: string | null
  sedeId: string; sedeNombre: string; municipioId: string | null; municipioNombre: string | null
}
/** Días entre la fecha de la cita y la fecha en Bogotá de su created_at (≥ 0; una "otra fecha" mide desde la suya). */
export function anticipacionDias(cita: Pick<CitaEquipo, 'fecha' | 'createdAt'>): number
/** Cadenas de "otra fecha": cada cadena, de la primera a la última cita (por viene_de); la última decide. */
export function cadenasDeCitas(citas: readonly CitaEquipo[]): CitaEquipo[][]
export interface CumplimientoPlan { programadas: number; cumplidas: number; ratio: number | null }
/** Cadenas cuya última cita tiene fecha ≤ hoy; cumplidas = última `hecha`. */
export function cumplimientoDelPlan(citas: readonly CitaEquipo[], hoy: string): CumplimientoPlan
/** Lo de una persona vista solo como Ejecutivo: deja solo filas con executiveId. */
export function soloComoEjecutivo<T extends { userId: string; executiveId: string | null }>(filas: readonly T[], alcance: AlcanceEquipo): T[]
```

- [ ] **Paso 1 (RED):** `equipo-check.ts` con el marco de `persona-campo-check.ts` (`check`, `igual`, contador y
  `process.exit(1)`), datos: Laura (`commercial_director`), el admin, Paola (líder de Trauma y Ejecutiva de Sustitutos),
  Lucía (líder de Deportiva, sin Ejecutivo), Ana (Ejecutiva de Osteosíntesis y Columna), Berta (Ejecutiva de Trauma y
  Sustitutos), una vacante (sin `userId`) y Carla inactiva. Afirmaciones:
  - `personasVisibles(Laura, todas, [])` y `(admin, …)` → todas las activas con usuario, sin la vacante ni Carla;
    `soloComoEjecutivo` vacío.
  - `personasVisibles(Paola, …, [TRAUMA])` → Paola, Berta; `soloComoEjecutivo` = {} (Berta solo es Ejecutiva, y Paola se
    ve a sí misma entera).
  - `personasVisibles(líder de Sustitutos, …, [SUSTITUTOS])` → ella, Paola y Berta, con `soloComoEjecutivo = {Paola}`.
  - `personasVisibles(Ana (sales_manager), …)` → `personas: []`.
  - `anticipacionDias({ fecha: '2026-10-20', createdAt: '2026-10-13T15:00:00Z' })` = 7;
    creada el mismo día a las 23:30 de Bogotá (`'2026-10-21T04:30:00Z'`, fecha `2026-10-20`) = 0.
  - `cadenasDeCitas`: A ← B (viene_de A) ← C → una cadena `[A, B, C]`; D sola → `[D]`.
  - `cumplimientoDelPlan` con hoy `2026-10-20`: cadena [A no_realizada, B hecha] → 1/1; [D pendiente futura] → fuera;
    [E cancelada] → 0/1; [F pendiente vencida (sin cerrar)] → 0/1; total programadas 3, cumplidas 1, ratio 1/3.
  - `soloComoEjecutivo(filas de Paola con y sin executiveId, alcance de Sustitutos)` → solo las con executiveId.
- [ ] **Paso 2:** `cd web && npx tsx scripts/equipo-check.ts` → falla (módulo no existe).
- [ ] **Paso 3 (GREEN):** `web/lib/equipo.ts` con las firmas de arriba.
- [ ] **Paso 4:** correr → 0 fallas; `npm run typecheck`.
- [ ] **Paso 5: commit** `feat(equipo): quién ve a quién, anticipación y cadenas de otra fecha (puro)`.

### Tarea 3: `web/lib/equipo.ts`: dónde está cada persona y el rastro del día

**Interfaces (produce, en el mismo archivo):**
```ts
export type CasoUbicacion = 'dia_libre' | 'festivo' | 'reportado' | 'reportado_hace_rato' | 'planeado' | 'sin_nada'
export interface Ubicacion {
  caso: CasoUbicacion
  /** Reportado / Planeado; null en los demás. */
  fuente: 'reportado' | 'planeado' | null
  hora: string | null; sedeNombre: string | null; municipioNombre: string | null
  /** Minutos desde el reporte (caso reportado*); null si no aplica. */
  haceMin: number | null
  marcas: MarcaVisita[]
}
export const HORAS_ULTIMO_REPORTE = 3
export const VENTANA_CITA_DE_AHORA = { antesMin: 30, despuesMin: 60 }
export function dondeEsta(entrada: {
  fecha: string; ahora: Date; visitas: readonly VisitaEquipo[]; citas: readonly CitaEquipo[]
  diaLibre: boolean; festivo: boolean
}): Ubicacion
export interface PasoRastro {
  hora: string | null; tipo: TipoVisita; conQuien: string | null; sedeNombre: string | null; municipioNombre: string | null
  estado: EstadoVisible | 'hecha' | 'no_efectiva'; motivo: string | null
  anticipacionDias: number | null; vieneDeFecha: string | null; lineas: string[]; marcas: MarcaVisita[]
  visitaId: string | null; citaId: string | null; modalidad: Modalidad | null
}
/** Por hora: cada cita del día (con su visita si la cumplió) y cada visita sin cita. */
export function rastroDelDia(entrada: { fecha: string; ahora: Date; visitas: readonly VisitaEquipo[]; citas: readonly CitaEquipo[] }): PasoRastro[]
/** "Cartagena 2 · Bogotá 6 · Sin reporte ni plan 3": conteo por municipio de la ubicación de cada persona. */
export function resumenPorCiudad(ubicaciones: readonly Ubicacion[]): { ciudades: Array<{ nombre: string; personas: number }>; sinNada: number }
```

- [ ] **Paso 1 (RED):** en `equipo-check.ts`, sección "3. dondeEsta y rastroDelDia" con `ahora = 2026-10-20T16:15:00Z`
  (11:15 Bogotá):
  - día libre → `dia_libre` aunque haya visitas; festivo sin visitas → `festivo`; festivo con visita → `reportado`.
  - visita presencial a las 10:40 → `reportado`, `haceMin` 35, sede y municipio; una telefónica a las 11:00 no ubica
    (si solo hay telefónica → sigue a la cita o `sin_nada`).
  - visita a las 07:50 (3 h 25 antes) → `reportado_hace_rato`, `haceMin` 205.
  - sin visita y cita a las 11:30 → `planeado`; cita a las 13:00 → `sin_nada` (fuera de la ventana −30/+60).
  - visita con `marcas: ['lejos_de_ips']` → `marcas` en la ubicación.
  - `rastroDelDia`: cita 09:00 hecha con visita efectiva → un paso `hecha` con `anticipacionDias` y lineas de la visita;
    cita 10:00 no_realizada → `no_realizada` con `motivo`; visita 10:40 sin cita → `anticipacionDias: null` (no planeada)
    y estado `hecha`/`no_efectiva` según `efectiva`; cita pendiente 11:30 → `programada`; cita pendiente 09:30 pasada
    → `atrasada`; una "otra fecha" → `vieneDeFecha`. Orden por hora; sin hora al final.
  - `resumenPorCiudad` con 3 ubicaciones (2 Cartagena reportadas, 1 Bogotá planeada, 1 sin nada) →
    `[{Cartagena,2},{Bogotá,1}]`, `sinNada: 1` (orden: más personas primero, luego nombre).
- [ ] **Paso 2:** correr → fallan.
- [ ] **Paso 3 (GREEN):** implementar. `dondeEsta`: el orden de casos es el de la spec (día libre, festivo sin nada,
  última presencial del día, cita de ahora, nada).
- [ ] **Paso 4:** correr → 0 fallas. **Paso 5: commit** `feat(equipo): dónde está cada persona y el rastro del día (puro)`.

### Tarea 4: `web/lib/equipo.ts`: rendimiento del periodo

**Interfaces (produce):**
```ts
export interface Cifras {
  hechas: number; efectivas: number; noEfectivas: number; noEfectivasPorMotivo: Record<string, number>
  noSeHizo: number; noSeHizoPorMotivo: Record<string, number>; canceladas: number; canceladasPorMotivo: Record<string, number>
  sinCerrar: number; programadas: number; telefonicas: number
  cumplimientoPlan: CumplimientoPlan
  anticipacion: { medianaDias: number | null; pctConTiempo: number | null; pctMismoDia: number | null; noPlaneadas: number }
  medicosDistintos: number; ciudadesDistintas: number
  porLinea: { lineas: Array<{ lineId: string; hechas: number }>; sumaSuperaHechas: boolean }
}
export interface FilaRendimiento extends Cifras {
  persona: PersonaEquipo; yaNoEsta: boolean
  diasHabilesSinVisitas: number | null
  cuota: { medica: { cuota: number; hechas: number; cumplimiento: number | null }; institucional: { … } } | null
}
export const DIAS_CON_TIEMPO = 7
export function esMesCompleto(desde: string, hasta: string): boolean
export function rendimiento(entrada: {
  personas: readonly PersonaEquipo[]; alcance: AlcanceEquipo
  visitas: readonly VisitaEquipo[]; citas: readonly CitaEquipo[]
  desde: string; hasta: string; hoy: string; ahora: Date
  /** Por userId; null = no se calcula para esa persona. */
  diasHabilesSinVisitas: ReadonlyMap<string, number | null>
  cuotas: ReadonlyMap<string, FilaRendimiento['cuota']>
}): { equipo: Cifras; porPersona: FilaRendimiento[] }
```
Reglas: `hechas` = visitas de la app no anuladas con `fecha` en [desde, hasta]; `programadas` = citas pendientes con
fecha > hoy; `sinCerrar` = pendientes con fecha ≤ hoy (hoy: pasada su hora); `porPersona` ordenadas por
`cumplimientoPlan.ratio` ascendente (null al final) y luego nombre; `yaNoEsta` = tuvo filas y `!persona.activa`; una
persona activa sin filas sale con ceros; `equipo.medicosDistintos` y `ciudadesDistintas` son los distintos de todos (no
la suma); `cuota` se copia tal cual del mapa (el servidor solo la calcula si `esMesCompleto`).

- [ ] **Paso 1 (RED):** sección "4. rendimiento" en `equipo-check.ts` con un periodo `2026-10-01..2026-10-31`, hoy
  `2026-10-20`: Ana con 3 visitas (2 efectivas de Osteosíntesis, 1 no efectiva motivo `sin_tiempo` con Osteosíntesis y
  Columna), 2 citas (una hecha con anticipación 7, una cancelada motivo `cliente`), 1 pendiente futura; Berta sin
  nada; Carla inactiva con 1 visita. Afirma: `hechas` 3, `efectivas` 2, `noEfectivasPorMotivo.sin_tiempo` 1,
  `porLinea` Osteosíntesis 3 y Columna 1 con `sumaSuperaHechas: true`, `canceladasPorMotivo.cliente` 1, `programadas` 1,
  `cumplimientoPlan` 1/2, `anticipacion.medianaDias` 7 y `noPlaneadas` 2, `pctConTiempo` 100; Berta con ceros y
  `cumplimientoPlan.ratio null`; Carla `yaNoEsta: true`; el equipo `medicosDistintos` = los distintos de las tres;
  orden: Ana (0,5) antes que Berta (null); `esMesCompleto('2026-10-01','2026-10-31')` true,
  `('2026-09-25','2026-10-09')` false, `('2026-02-01','2026-02-28')` true (año no bisiesto 2026).
- [ ] **Paso 2:** correr → fallan. **Paso 3 (GREEN):** implementar. **Paso 4:** 0 fallas.
- [ ] **Paso 5: commit** `feat(equipo): rendimiento del periodo con reparto por línea (puro)`.

### Tarea 5: tipos de respuesta y servidor de Equipo (personas, hoy, día de una persona)

**Archivos:**
- Modificar: `web/lib/reporte-visitas.ts` (sección "Equipo": `EquipoPersonasResponse`, `EquipoHoyResponse`,
  `EquipoPersonaDiaResponse`, `EquipoRendimientoResponse`, `EquipoPersonaRendimientoResponse` — formas de abajo),
  `mobile/lib/tipos.ts` (copia), `mobile/lib/claves-api.ts` (`equipoPersonas`, `equipoHoy`, `equipoPersonaDia`,
  `equipoRendimiento`, `equipoPersonaRendimiento`).
- Crear: `web/app/api/equipo/_lib/equipo-server.ts`, `web/app/api/equipo/personas/route.ts`,
  `web/app/api/equipo/hoy/route.ts`, `web/app/api/equipo/persona/[id]/route.ts`.
- Crear: `web/scripts/equipo-api-check.ts` (añadir a `"test"`), con `fakeSupabase` de `scripts/lib/fake-supabase.ts`
  y `globalThis.fetch` desviado como en `lineas-api-check.ts:57`; sesión por cookie con `SESSION_SECRET` falso como en
  `reporte-api-check.ts` (`tokenDe`).

**Formas (todas con `dynamic = 'force-dynamic'`, `Cache-Control: no-store`):**
```ts
interface PersonaEquipoItem { user_id: string; nombre: string; papel: PapelEquipo; executive_id: string | null; zona: string | null; lineas: Array<{ id: string; nombre: string; como: ComoPersona }>; solo_como_ejecutivo: boolean; activa: boolean }
interface EquipoPersonasResponse { personas: PersonaEquipoItem[]; lineas: Array<{ id: string; nombre: string }> }
interface UbicacionItem { caso: CasoUbicacion; fuente: 'reportado' | 'planeado' | null; hora: string | null; sede: string | null; municipio: string | null; hace_min: number | null; marcas: MarcaVisita[] }
interface EquipoHoyResponse { fecha: string; texto_fijo: string; resumen: { ciudades: Array<{ nombre: string; personas: number }>; sin_nada: number }; personas: Array<{ persona: PersonaEquipoItem; donde: UbicacionItem }> }
interface PasoRastroItem { hora: string | null; tipo: TipoVisita; modalidad: Modalidad | null; con_quien: string | null; sede: string | null; municipio: string | null; estado: PasoRastro['estado']; motivo: string | null; anticipacion_dias: number | null; viene_de_fecha: string | null; lineas: string[]; marcas: MarcaVisita[]; visita_id: string | null; cita_id: string | null }
interface EquipoPersonaDiaResponse { fecha: string; persona: PersonaEquipoItem; donde: UbicacionItem; rastro: PasoRastroItem[]; siguiente: PasoRastroItem[] /* hoy pendiente + 2 días */ }
```

**Servidor (`equipo-server.ts`, produce):**
```ts
export async function requireEquipo(request: Request, contexto: string): Promise<{ ok: true; user: SessionUser; alcance: AlcanceEquipo; lineas: Map<string, string> } | { ok: false; response: NextResponse }>
export async function cargarPersonasEquipo(): Promise<PersonaEquipo[]>   // users activos ∪ executives activos con user_id, executive_lines, business_lines (leader_user_id), kams (zona, municipio)
export async function visitasEquipo(userIds: readonly string[], desde: string, hasta: string): Promise<VisitaEquipo[]>  // visits: columnas mínimas, source app, deleted_at null, visit_date en rango; nombres de sedes, municipios, médicos y cuentas por trozos de 100
export async function citasEquipo(userIds: readonly string[], desde: string, hasta: string): Promise<CitaEquipo[]>   // visitas_agenda sin eliminadas, con created_at
export async function diasEspeciales(personas: readonly PersonaEquipo[], desde: string, hasta: string): Promise<{ libres: Map<string, Set<string>>; festivos: Map<string, Set<string>> }> // dias_libres aprobados fraccion ≥ 1 por executive_id; calendario nacional + empresa para todos y de ciudad por persona.municipio
export function personaItem(p: PersonaEquipo, alcance: AlcanceEquipo, lineas: Map<string, string>): PersonaEquipoItem
```
`requireEquipo` = `requirePermission(request, 'team:view')` + `cargarPersonasEquipo` + `personasVisibles(user, …,
líneas que lidera)` (para `line_leader`, `business_lines.leader_user_id = user.id`).

- [ ] **Paso 1 (RED):** `equipo-api-check.ts` con tablas sembradas: users (Laura, admin, Paola, Lucía, Ana, Berta,
  viewer), executives, executive_lines, business_lines, kams, sedes (con `municipality_id`), municipalities, medicos
  (con `numero_documento`, para probar que NO sale), cuentas, visits (de la app, una de VMO, una anulada, una con
  `transcript` y `gps_accuracy_m`), visitas_agenda, dias_libres, calendario. Afirmaciones:
  - sin sesión 401; viewer y Ana → 403 en las tres rutas.
  - `GET /api/equipo/personas` Laura → todas las personas activas con usuario (no la vacante), `lineas` del catálogo;
    Paola → Paola y Berta; líder de Sustitutos → Paola con `solo_como_ejecutivo: true`.
  - `GET /api/equipo/hoy?fecha=2026-10-20` Laura → `texto_fijo` exacto, `resumen` y `donde` de Ana `reportado` con sede
    y municipio; la visita de VMO y la anulada no influyen; la respuesta serializada no contiene `transcript`,
    `gps_accuracy_m`, `distance_m`, `numero_documento`, `telefono` ni `"lat"`.
  - `GET /api/equipo/persona/<Ana>?fecha=` Laura → rastro con la cita hecha y la visita; `<Paola>` para la líder de
    Sustitutos → solo pasos con `executive_id`; `<Lucía>` para Paola → 404; `<id inexistente>` → 404.
  - `fecha` inválida → 400; sin `fecha` → hoy (reloj falso).
  - `ok('equipoHoy', body)` con `tieneClaves` de `mobile/lib/claves-api.ts` (como hace `reporte-api-check`).
- [ ] **Paso 2:** correr → falla (rutas no existen). **Paso 3 (GREEN):** tipos, servidor y las tres rutas.
- [ ] **Paso 4:** `npx tsx scripts/equipo-api-check.ts` → 0 fallas; `npm run typecheck`; `cd mobile && npm run check`
  (claves).
- [ ] **Paso 5: commit** `feat(equipo): API de personas, hoy y el día de una persona`.

### Tarea 6: rutas de rendimiento

**Archivos:** crear `web/app/api/equipo/rendimiento/route.ts` y `web/app/api/equipo/persona/[id]/rendimiento/route.ts`;
ampliar `equipo-server.ts` (`cuotasDelMes`, `diasHabilesSinVisitas`) y `equipo-api-check.ts`.

**Formas:**
```ts
interface CifrasItem { /* Cifras con las claves en snake_case: hechas, efectivas, no_efectivas, no_efectivas_por_motivo, no_se_hizo, no_se_hizo_por_motivo, canceladas, canceladas_por_motivo, sin_cerrar, programadas, telefonicas, cumplimiento_plan: { programadas, cumplidas, ratio }, anticipacion: { mediana_dias, pct_con_tiempo, pct_mismo_dia, no_planeadas }, medicos_distintos, ciudades_distintas, por_linea: { lineas: [{ line_id, nombre, hechas }], suma_supera_hechas } */ }
interface FilaRendimientoItem extends CifrasItem { persona: PersonaEquipoItem; ya_no_esta: boolean; dias_habiles_sin_visitas: number | null; cuota: { medica: { cuota, hechas, cumplimiento }, institucional: { … } } | null }
interface EquipoRendimientoResponse { desde: string; hasta: string; mes_completo: boolean; equipo: CifrasItem; por_persona: FilaRendimientoItem[] }
interface EquipoPersonaRendimientoResponse { desde: string; hasta: string; mes_completo: boolean; fila: FilaRendimientoItem; visitas: PasoRastroItem[]; citas: PasoRastroItem[] }
```
Query: `desde`, `hasta` (AAAA-MM-DD, `hasta ≥ desde`, máximo 93 días → si no, 400), `linea` (id: filtra personas que
la llevan y, en las cifras, deja solo las visitas con esa línea), `papel` (`lider` | `ejecutivo`). `cuota` solo si
`esMesCompleto` y la persona tiene Ejecutivo Comercial: `calcularCuota(personaVisitas, mes, hoy)` y hechas por tipo de
sus visitas como Ejecutivo (`visitaSumaALaCuota`). `dias_habiles_sin_visitas`: con Ejecutivo, de
`calcularCuotaDetallada(...).porDia.medica` (días hábiles ya pasados sin visita); una líder sin Ejecutivo: lunes a
viernes del periodo hasta hoy que no sean festivo nacional ni día de empresa (`leerCalendario` sin municipio) y sin
visita ese día.

- [ ] **Paso 1 (RED):** en `equipo-api-check.ts`: Laura `GET /api/equipo/rendimiento?desde=2026-10-01&hasta=2026-10-31`
  → `mes_completo: true`, `por_persona` con Ana primero (menor ratio), `por_linea` de Ana con dos líneas y
  `suma_supera_hechas: true`; `?desde=2026-09-25&hasta=2026-10-09` → `mes_completo: false` y `cuota: null` en todos;
  `?linea=<Columna>` → solo quien lleva Columna y `hechas` solo con esa línea; `?papel=lider` → solo líderes; 94 días →
  400; `hasta < desde` → 400; Paola → solo Paola y Berta; la líder de Sustitutos → Paola solo con filas con
  `executive_id`; `GET /api/equipo/persona/<Ana>/rendimiento?…` → `fila` y listas; `<Lucía>` para Paola → 404; la
  respuesta no contiene `transcript`, `gps_accuracy_m`, `distance_m`, `numero_documento`.
- [ ] **Paso 2:** correr → fallan. **Paso 3 (GREEN):** rutas y servidor. **Paso 4:** 0 fallas, typecheck, mobile check.
- [ ] **Paso 5: commit** `feat(equipo): API de rendimiento del equipo y de una persona`.

### Tarea 7: la app sabe quién supervisa y arma sus pestañas

**Archivos:**
- Modificar: `mobile/lib/persona.ts` (`estadoPersona` recibe `supervisa?: boolean | null`; estado nuevo `'supervisa'`;
  `pestanasDe`, `muestraMiEquipo`; `MENSAJE_DIRECCION_EN_LA_WEB` se queda para un servidor sin `supervisa`),
  `mobile/lib/navegacion.ts` (`PESTANAS_SUPERVISA`, `equipo` en `PESTANAS` como pestaña que la líder no ve;
  `OCULTAS`: `equipo/persona/[id]` "Su día", `equipo/rendimiento` "Rendimiento"), `mobile/lib/iconos-nombres.ts`
  (`'equipo'` → Ionicons `people`), `mobile/lib/sesion.ts` (`Perfil.supervisa?: boolean`, guardado desde `me`),
  `mobile/app/(app)/_layout.tsx` (pestañas según `pestanasDe`; las demás con `href: null`), `mobile/app/index.tsx`
  (`'/equipo'` si el estado es `'supervisa'`), `mobile/lib/api.ts` (`equipoPersonas`, `equipoHoy`, `equipoPersonaDia`,
  `equipoRendimiento`, `equipoPersonaRendimiento`).
- Pruebas: `mobile/scripts/checks/21-persona.ts`, `15-navegacion.ts`, crear `26-equipo.ts` (registrar en
  `movil-check.ts`).

**Interfaces (produce):**
```ts
export type EstadoPersona = 'campo' | 'supervisa' | 'direccion' | 'fuera' | 'sin_lineas' | 'sin_saber'
export function estadoPersona(o: { role; persona; sinPersona?; sinConfirmar?; supervisa?: boolean | null }): EstadoPersona
// supervisa && !persona → 'supervisa' (también commercial_director); persona → 'campo'; commercial_director sin supervisa → 'direccion' (servidor viejo)
export function pestanasDe(estado: EstadoPersona): readonly Pestana['ruta'][]  // 'supervisa' → ['equipo','ajustes']; los demás → ['hoy','reportar','agenda','numeros','ajustes']
export function muestraMiEquipo(o: { estado: EstadoPersona; supervisa?: boolean | null }): boolean  // 'campo' && supervisa
```

- [ ] **Paso 1 (RED):** `21-persona.ts`: `estadoPersona({ role: 'commercial_director', persona: null, supervisa: true })
  === 'supervisa'`; `({ role: 'admin', persona: null, sinPersona: MENSAJE_SIN_LINEAS, supervisa: true }) ===
  'supervisa'`; `({ role: 'line_leader', persona: LUCIA, supervisa: true }) === 'campo'` y
  `muestraMiEquipo(...) === true`; `({ role: 'commercial_director', persona: null }) === 'direccion'` (sin el dato);
  `pestanasDe('supervisa')` y `pestanasDe('campo')`. `15-navegacion.ts`: toda ruta de `app/(app)/` está en `PESTANAS`
  u `OCULTAS` (ya lo hace: sumar las nuevas a las listas); `equipo` cabe en 8 letras. `26-equipo.ts`: `api.ts` expone
  las cinco funciones; `_layout.tsx` usa `pestanasDe` y pone `href: null` a las pestañas que no van; `index.tsx` manda a
  `/equipo` cuando `estado === 'supervisa'`; `sesion.ts` guarda `supervisa` de `me`.
- [ ] **Paso 2:** correr `cd mobile && npx tsx scripts/movil-check.ts` → fallan.
- [ ] **Paso 3 (GREEN):** lo de arriba. Las pantallas `equipo.tsx`, `equipo/persona/[id].tsx` y `equipo/rendimiento.tsx`
  se crean en esta tarea como esqueleto mínimo (`<EnConstruccion titulo="Equipo" />`) para que expo-router las conozca.
- [ ] **Paso 4:** `npm run check` en `mobile/` → verde. **Paso 5: commit** `feat(app): quién supervisa y sus pestañas`.

### Tarea 8: pantalla Equipo › Hoy y el día de una persona

**Archivos:** crear `mobile/lib/equipo.ts` (puro), `mobile/app/(app)/equipo.tsx`, `mobile/app/(app)/equipo/persona/[id].tsx`;
pruebas en `26-equipo.ts`.

**Interfaces (`mobile/lib/equipo.ts`, produce):**
```ts
export const TEXTO_FIJO_EQUIPO = 'Lo que cada persona reporta o agenda. La app no sigue la ubicación.'
export const ETIQUETA_MARCA: Record<MarcaVisita, string>  // lejos_de_ips 'Lejos de la sede', sin_ubicacion 'Sin GPS', precision_baja 'GPS impreciso', hora_inconsistente 'Hora del teléfono rara', medico_por_validar 'Médico por validar', en_sitio 'En la sede', ips_sin_coordenadas 'Sede sin ubicación'
export function textoUbicacion(u: UbicacionItem): string   // 'Día libre' | 'Festivo' | '10:40 · <sede>, <municipio> (hace 35 min)' | 'Último reporte hace 4 h · <municipio>' | 'Planeado 11:00 · <sede>, <municipio>' | 'Sin reportes ni plan hoy'
export function textoHace(min: number): string             // 'hace 35 min' | 'hace 4 h' | 'hace 1 h 20 min'
export function textoResumen(r: EquipoHoyResponse['resumen']): string  // 'Cartagena 2 · Bogotá 6 · Sin reporte ni plan 3'
export type FiltroPapel = 'todas' | 'lideres' | 'ejecutivos'
export function filtrarPersonas<T extends { persona: PersonaEquipoItem }>(filas: readonly T[], papel: FiltroPapel, linea: string | null): T[]
export function textoPaso(p: PasoRastroItem): { titulo: string; detalle: string; estado: string }
export const RELEER_CADA_MS = 5 * 60 * 1000
```
Pantalla `equipo.tsx` (pestaña, encabezado "Equipo"): texto fijo, selector de día (`fechaLarga`, flechas, sin futuro),
chips de papel y línea (las líneas de `equipoPersonas`), resumen, botón "Rendimiento" (→ `/equipo/rendimiento`), una
`Tarjeta` por persona (nombre, papel, `textoUbicacion`, `Insignia` por marca) que abre `/equipo/persona/<id>?fecha=`.
Se relee cada `RELEER_CADA_MS` mientras está enfocada (`useFocusEffect` + `setInterval`). `equipo/persona/[id].tsx`:
encabezado "Su día" con "Volver", `donde`, "Rastro" (lista `textoPaso`) y "Siguiente".

- [ ] **Paso 1 (RED):** `26-equipo.ts`: las funciones puras con los textos exactos de arriba (casos: 35 min, 4 h, 1 h 20
  min; cada caso de ubicación; filtro por papel y línea; `textoResumen`); estático: `equipo.tsx` usa
  `TEXTO_FIJO_EQUIPO`, `RELEER_CADA_MS` y `router.push('/equipo/persona/')`; `[id].tsx` muestra `rastro` y `siguiente`.
- [ ] **Paso 2:** correr → fallan. **Paso 3 (GREEN):** lib y pantallas con el kit de `lib/ui.tsx` (`Pantalla`,
  `Seccion`, `Tarjeta`, `Chip`, `Insignia`, `Vacio`, `Cargando`, `Aviso`), DM Sans y los colores del tema (claro y
  oscuro). **Paso 4:** `npm run check` → verde.
- [ ] **Paso 5: commit** `feat(app): Equipo › Hoy y el día de una persona`.

### Tarea 9: pantalla Rendimiento, "Mi equipo" para la líder y sin señal

**Archivos:** `mobile/app/(app)/equipo/rendimiento.tsx` (acepta `?persona=` para el detalle), `mobile/lib/equipo.ts`
(`periodo(tipo: 'semana' | 'quincena' | 'mes' | 'rango', hoy, rango?)`, `textoCifra`, `ordenFilas`),
`mobile/app/(app)/hoy.tsx` (tarjeta "Mi equipo" arriba cuando `muestraMiEquipo`), `mobile/app/(app)/ajustes.tsx`
(`Tarjeta` "Equipo" con la misma condición), caché: `guardarJson('opmap.equipo.hoy.v1', { fecha, visto_at, datos })` y
`'opmap.equipo.rendimiento.v1'` en `lib/equipo-cache.ts` con `leerUltimo`/`guardarUltimo` y `textoVisto(visto_at,
ahora)` → "Visto hace N min". Pruebas en `26-equipo.ts`.

- [ ] **Paso 1 (RED):** `periodo('semana', '2026-10-20')` → lunes 19 a domingo 25; `'quincena'` → 15 días hasta hoy;
  `'mes'` → `2026-10-01..2026-10-31`; `textoVisto` ('Visto hace 3 min', 'Visto hace 2 h'); `ordenFilas` (ratio
  ascendente, null al final, nombre); estático: `hoy.tsx` y `ajustes.tsx` usan `muestraMiEquipo`; `rendimiento.tsx`
  muestra `cuota` solo si `mes_completo`, y `ya_no_esta` con la insignia "Ya no está"; `equipo.tsx` y
  `rendimiento.tsx` leen la caché cuando `peticion` falla por red (`esNoDisponible`) y muestran `textoVisto`.
- [ ] **Paso 2:** correr → fallan. **Paso 3 (GREEN).** **Paso 4:** `npm run check` → verde.
- [ ] **Paso 5: commit** `feat(app): Rendimiento del equipo, "Mi equipo" para la líder y lectura sin señal`.

### Tarea 10: documentos, verificación de punta a punta y entrega

- [ ] **Paso 1:** `docs/decisiones/2026-10-31-equipo-en-la-app.md` (plantilla): contexto literal del dueño (la spec lo
  trae), decisión (Equipo en la app; una sola app y un solo ingreso para todos los roles; cada líder ve todo el
  Ejecutivo y cuánto por línea; VMO fuera de Equipo), consecuencias, dónde vive.
- [ ] **Paso 2:** `CLAUDE.md` (regla "Equipo en la app", junto a la de la app de campo), `web/docs/ROLES_AND_PERMISSIONS.md`,
  `docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md` (sección F4: "hecho en la app, no en `/equipo` web"),
  `docs/specs/2026-10-15-actividades-de-campo.md` (nota en "Vista de la directora"), la spec de esta entrega (Estado).
- [ ] **Paso 3:** `cd web && npm run check` y `cd mobile && npm run check` → salidas en verde pegadas en el PR.
- [ ] **Paso 4:** capturas en el celular (preview de Vercel, lo toma el dueño si aquí no hay base): Equipo › Hoy, el día
  de una persona y Rendimiento, como dirección y como líder, en claro y en oscuro.
- [ ] **Paso 5:** subagente `revisor` sobre el diff y la spec; corregir lo que afecte corrección o reglas.
- [ ] **Paso 6:** PR a `master` con la plantilla (sobre PR #75 mezclado; si no, con base en esa rama). Sin merge local.
