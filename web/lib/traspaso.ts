/**
 * Traspaso de lo de un Ejecutivo Comercial a otra persona: lógica PURA (sin red, sin base de datos, sin node:*),
 * compartida por la API (/api/executives/[id]/traspaso/**, /api/executives/[id]/contratar,
 * /api/executives/traspasos), la interfaz (/executives) y las pruebas (scripts/traspaso-check.ts).
 * Spec: docs/specs/2026-10-12-traspaso-ejecutivo-comercial.md. Decisión del dueño:
 * docs/decisiones/2026-10-12-traspaso-de-ejecutivas.md ("si alguien se va o se le quita, pues ya no está").
 *
 * planearTraspaso(datos) es la VISTA PREVIA: con las filas actuales y lo que pide quien administra el equipo,
 * devuelve exactamente lo que haría ejecutivas_traspasar (migración 0820), sin escribir nada. Reglas (decisiones
 * 1 a 10 de la spec), espejo de la función SQL:
 *   1. Fecha F: por defecto hoy; entre hoy − 90 y hoy. Quien entrega deja de tenerlo el día F − 1 (left_at si se da
 *      de baja) y quien recibe lo tiene desde F.
 *   2. Baja ⇒ se traspasan TODAS sus líneas y hay que elegir quién recibe (otra persona, una nueva o una vacante).
 *      "Nadie" solo al quitar líneas a quien se queda.
 *   3. Persona nueva o vacante: heredan la zona base de quien entrega y las líneas traspasadas (la nueva queda
 *      activa con started_at = F; la vacante, "Vacante · <zona>" en estado placeholder). Con baja heredan también su
 *      color en el mapa (quien entrega queda inactiva: no hay dos colores iguales); sin baja, sin color (lo sigue
 *      usando quien entrega). Persona que ya existe: conserva su zona y su color y suma las líneas; la cobertura
 *      recalculada decide sus zonas (avisos de alcance o conflicto).
 *   4. Médicos: cada asignación ABIERTA (hasta NULL) de quien entrega en esas líneas se termina con
 *      hasta = max(desde, F − 1) (el CHECK hasta >= desde de medico_visitantes) y se crea la misma (médico, línea,
 *      ciudad) para quien recibe desde max(F, desde): con una fecha pasada, quien recibe nunca lo tiene desde antes
 *      de que existiera la asignación. Si quien recibe ya la tiene abierta → no se duplica (omitido,
 *      'ya_lo_visita'). Médico inactivo → solo se termina ('medico_inactivo'). Con "nadie" → solo se terminan
 *      ('sin_destino'). Con baja, las asignaciones abiertas que le queden en líneas que ya no llevaba (no debería
 *      haber: desde la 0820 quitar una línea termina sus visitantes) las termina el disparador de la baja.
 *   5. Ajustes manuales activos de quien entrega en esas líneas: se desactivan y se crea el mismo (línea, zona,
 *      motivo) para quien recibe; con "nadie", solo se desactivan. Luego se recalcula la cobertura (global, sin
 *      Google Maps).
 *   6. Nombre del territorio de la línea: se copia a quien recibe si no tiene uno.
 *   7. Versión final del anexo de quien entrega, por línea donde tiene territorio (coverage local|reach|manual):
 *      etiqueta "Final AAAA-MM-DD (traspaso)" con F; la guarda la ruta antes de llamar a la función.
 *   8. Excepciones personales (config_personas y config_metas con scope ejecutiva vigentes en F): solo si se pide
 *      copiarlas; se registran para quien recibe desde F (config_registrar, que corta las suyas de la misma clave).
 *   9. Usuario de OpMap de quien se va: se desactiva si se pide (por defecto sí, solo con baja) y solo si es un
 *      usuario de Ejecutivo Comercial (rol sales_manager o user), activo y distinto de quien hace el traspaso. Un
 *      admin, un líder de línea o cualquier otro rol se maneja en Usuarios (users:manage, con sus guardas: nadie se
 *      desactiva a sí mismo ni se queda el sistema sin administrador).
 *  10. Días libres y visitas no se traspasan.
 *
 * Conteo del resumen: EXACTAMENTE el que devuelve ejecutivas_traspasar (migración 0820), mismo orden incluido.
 *   visitantes_movidos    = asignaciones terminadas a quien entrega Y creadas para quien recibe.
 *   visitantes_terminados = terminadas que quedan sin visitante: "nadie", médico inactivo y, con baja, las de
 *                           líneas que ya no llevaba.
 *   omitidos              = médicos que, habiendo quien recibe, no se le crearon, con su razón: 'ya_lo_visita'
 *                           (quien recibe ya lo visita por esa línea y ciudad; NO cuenta en terminados: el médico
 *                           sigue con visitante) y 'medico_inactivo' (también cuenta en terminados).
 *                           Así movidos + terminados + omitidos 'ya_lo_visita' = asignaciones que se cierran.
 *                           Orden: línea, médico, ciudad (sin ciudad primero), asignación — el del bucle SQL.
 *   lineas                = las traspasadas en orden de id (como la función); el plan por línea (lineas de la
 *                           vista previa) va en el orden del catálogo, para mostrarlo.
 *   ajustes_movidos (hay quien recibe) y ajustes_desactivados (con "nadie") no se solapan.
 *
 * Imports relativos (no '@/') para que los scripts de prueba lo usen con tsx.
 */
import { getRoleTitle, type Role } from './permissions'
import { etiquetaDe, valoresDe, type Opcion } from './terceros'
import { esFechaIso, sumarDias } from './visits-rules'
import { zoneDisplayName } from './zone-names'

// ---------------------------------------------------------------------------------------------
// 1. Constantes y mensajes (los mismos textos que RAISE la función SQL, para que la UI hable igual)
// ---------------------------------------------------------------------------------------------

/** Hasta cuántos días atrás se puede fechar un traspaso (para registrar una salida que ya pasó). */
export const DIAS_ATRAS_MAX = 90
/** Largo del nombre de la persona nueva o contratada. */
export const NOMBRE_MIN = 2
export const NOMBRE_MAX = 120
/** Largo máximo del motivo del traspaso. */
export const MOTIVO_MAX = 300

export type TipoDestino = 'existente' | 'nueva' | 'vacante' | 'nadie'

/** Quién recibe (ejecutivas_traspasos.destino_tipo). */
export const TIPOS_DESTINO: readonly Opcion<TipoDestino>[] = [
  { valor: 'existente', etiqueta: 'Otra persona del equipo' },
  { valor: 'nueva', etiqueta: 'Una persona nueva' },
  { valor: 'vacante', etiqueta: 'Una vacante' },
  { valor: 'nadie', etiqueta: 'Nadie' },
] as const
export const VALORES_TIPO_DESTINO = valoresDe<TipoDestino>(TIPOS_DESTINO)
export const etiquetaTipoDestino = (valor: string | null | undefined) => etiquetaDe(TIPOS_DESTINO, valor)

/** Por qué terminó una asignación de visitante (medico_visitantes.fin_motivo, migración 0820). */
export type FinMotivoVisitante = 'manual' | 'traspaso' | 'baja' | 'linea_quitada'
export const FIN_MOTIVOS_VISITANTE: readonly Opcion<FinMotivoVisitante>[] = [
  { valor: 'manual', etiqueta: 'Terminada a mano' },
  { valor: 'traspaso', etiqueta: 'Traspaso' },
  { valor: 'baja', etiqueta: 'Baja del Ejecutivo Comercial' },
  { valor: 'linea_quitada', etiqueta: 'Se le quitó la línea' },
] as const
export const etiquetaFinMotivoVisitante = (valor: string | null | undefined) => etiquetaDe(FIN_MOTIVOS_VISITANTE, valor)

/** Razón por la que un médico no se crea para quien recibe aunque se termina a quien entrega (plan por línea). */
export type RazonOmitido = 'ya_lo_visita'
/** Razones que trae resumen.omitidos (el de la vista previa y el de la función SQL). */
export type RazonOmitidoResumen = RazonOmitido | 'medico_inactivo'
/** Razón por la que una asignación solo se termina. */
export type RazonTerminado = 'sin_destino' | 'medico_inactivo'

export const ETIQUETAS_RAZON: Record<RazonOmitido | RazonTerminado, string> = {
  ya_lo_visita: 'Quien recibe ya visita a este médico por esta línea y ciudad',
  sin_destino: 'Nadie recibe esta línea: queda sin visitante',
  medico_inactivo: 'El médico está inactivo: solo se termina',
}
export const etiquetaRazon = (razon: string | null | undefined) =>
  razon ? ETIQUETAS_RAZON[razon as RazonOmitido | RazonTerminado] ?? razon : ''

/**
 * Roles cuyo usuario de OpMap puede desactivar el traspaso al dar de baja (el de las cuentas de los Ejecutivos
 * Comerciales, EXECUTIVE_ACCOUNT_ROLE, y el básico). Cualquier otro rol (admin, líder de línea, dirección...) se
 * desactiva solo desde Usuarios, que pide users:manage. La función SQL de la 0820 usa la misma lista.
 */
export const ROLES_USUARIO_DESACTIVABLES: readonly string[] = ['sales_manager', 'user']

export const MENSAJE_BAJA_SIN_DESTINO =
  'Al dar de baja hay que elegir quién recibe: otra persona, una persona nueva o una vacante'
export const MENSAJE_BAJA_TODAS = 'Al dar de baja se traspasan todas sus líneas'
export const MENSAJE_USUARIO_SIN_BAJA = 'Solo se desactiva el usuario de quien se da de baja'
export const MENSAJE_DESTINO_ES_ORIGEN = 'Quien recibe tiene que ser otra persona'

// ---------------------------------------------------------------------------------------------
// 2. Entrada (cuerpo validado por traspaso-schemas.ts) y lo que devuelve la función SQL
// ---------------------------------------------------------------------------------------------

export type TraspasoDestino =
  | { tipo: 'existente'; id: string }
  | { tipo: 'nueva'; full_name: string; email: string | null }
  | { tipo: 'vacante' }
  | { tipo: 'nadie' }

/** Cuerpo de POST /api/executives/[id]/traspaso y de su vista previa, ya validado (traspasoSchema). */
export interface TraspasoInput {
  destino: TraspasoDestino
  /** null = todas las líneas de quien entrega. */
  lineas: string[] | null
  /** null = hoy (en Bogotá). */
  fecha: string | null
  dar_de_baja: boolean
  /** Solo con baja (sin baja siempre false). */
  desactivar_usuario: boolean
  copiar_excepciones: boolean
  /** Guardar la versión final del anexo de quien entrega en cada línea donde tiene territorio. */
  guardar_anexo_final: boolean
  motivo: string | null
}

/** POST /api/executives/[id]/contratar (contratarSchema): la vacante pasa a ser la persona contratada. */
export interface ContratarInput {
  full_name: string
  email: string | null
  /** null = hoy (en Bogotá); va a executives.started_at. */
  fecha_ingreso: string | null
}

/** Un médico que se terminó a quien entrega sin crearlo para quien recibe, y por qué. */
export interface TraspasoOmitido {
  medico_id: string
  /** 'ya_lo_visita' | 'medico_inactivo' (ver RazonOmitidoResumen). Texto para no romper si la base añade otra. */
  razon: string
}

/** Lo que devuelve ejecutivas_traspasar (y lo que guarda ejecutivas_traspasos.resumen). */
export interface TraspasoResumen {
  traspaso_id: string
  destino_id: string | null
  lineas: string[]
  ajustes_movidos: number
  ajustes_desactivados: number
  nombres_copiados: number
  visitantes_movidos: number
  visitantes_terminados: number
  omitidos: TraspasoOmitido[]
  excepciones_copiadas: number
}

/** Lo mismo, contado por la vista previa antes de confirmar (aún sin traspaso; destino_id null si se crea). */
export type TraspasoResumenPrevisto = Omit<TraspasoResumen, 'traspaso_id'>

/** Parámetro p de ejecutivas_traspasar(p jsonb, p_user uuid). guardar_anexo_final no va: lo hace la ruta. */
export interface ParametroTraspaso {
  origen_id: string
  destino: { tipo: TipoDestino; id?: string; full_name?: string; email?: string | null }
  lineas: string[] | null
  fecha: string
  dar_de_baja: boolean
  desactivar_usuario: boolean
  copiar_excepciones: boolean
  motivo: string | null
}

// ---------------------------------------------------------------------------------------------
// 3. Filas que lee la vista previa (la ruta las carga; aquí no hay E/S)
// ---------------------------------------------------------------------------------------------

export type EstadoEjecutiva = 'active' | 'placeholder' | 'inactive'

/** executives + sus líneas (executive_lines). Compatible con Executive de lib/types/lines.ts. */
export interface EjecutivaTraspaso {
  id: string
  full_name: string
  email: string | null
  status: EstadoEjecutiva
  base_kam_id: string | null
  user_id: string | null
  lines: string[]
  /** Color en el mapa por línea (#RRGGBB); la persona nueva o la vacante lo heredan si hay baja. */
  color?: string | null
  /** Fecha de ingreso (para avisar si la fecha del traspaso es anterior). */
  started_at?: string | null
}

/** users (solo lo que decide si el traspaso puede desactivarlo). */
export interface UsuarioTraspaso {
  id: string
  role: string
  active: boolean
}

/** business_lines (en el orden en que se quieren mostrar: sort_order). */
export interface LineaTraspaso {
  id: string
  name: string
  code?: string | null
}

/** kams (zona), para mostrar nombres. */
export interface ZonaTraspaso {
  id: string
  name: string | null
}

/** coverage guardada. */
export interface CoberturaTraspaso {
  line_id: string
  kam_id: string
  executive_id: string | null
  kind: string
}

/** coverage_overrides. */
export interface AjusteTraspaso {
  id: string
  line_id: string
  kam_id: string
  executive_id: string
  reason: string | null
  active: boolean
}

/** line_territory_names. */
export interface NombreTerritorioTraspaso {
  line_id: string
  executive_id: string
  name: string
}

/** medico_visitantes + medicos.activo (y el nombre del médico para mostrar). */
export interface VisitanteTraspaso {
  id: string
  medico_id: string
  medico_nombre?: string | null
  medico_activo: boolean
  executive_id: string
  line_id: string
  municipality_id: string | null
  desde: string
  hasta: string | null
}

/** config_personas o config_metas con scope 'ejecutiva' (excepciones personales). */
export interface ExcepcionTraspaso {
  tabla: 'config_personas' | 'config_metas'
  id: string
  executive_id: string
  /** Solo config_metas: tipo y subtipo forman la clave junto con la persona. */
  tipo?: string | null
  subtipo_id?: string | null
  vigente_desde: string
  vigente_hasta: string | null
  anulado_at?: string | null
}

export interface DatosTraspaso {
  /** Hoy en Bogotá (AAAA-MM-DD). */
  hoy: string
  origen_id: string
  input: TraspasoInput
  /** Todas las ejecutivas (incluidas las inactivas) con sus líneas. */
  ejecutivas: EjecutivaTraspaso[]
  lineas: LineaTraspaso[]
  zonas?: ZonaTraspaso[]
  cobertura: CoberturaTraspaso[]
  ajustes: AjusteTraspaso[]
  nombres: NombreTerritorioTraspaso[]
  /** Al menos las de quien entrega y las de quien recibe (si ya existe). */
  visitantes: VisitanteTraspaso[]
  /** Al menos las de quien entrega y las de quien recibe (si ya existe). Sin esto, 0 excepciones. */
  excepciones?: ExcepcionTraspaso[]
  /** Al menos el usuario de OpMap de quien entrega. Sin su fila no se desactiva (no se sabe su rol). */
  usuarios?: UsuarioTraspaso[]
  /** Usuario que hace el traspaso (p_user): su propio usuario nunca se desactiva. */
  solicitante_id?: string | null
}

// ---------------------------------------------------------------------------------------------
// 4. Lo que devuelve la vista previa
// ---------------------------------------------------------------------------------------------

export type CodigoErrorTraspaso =
  | 'origen_no_existe'
  | 'origen_inactivo'
  | 'sin_lineas'
  | 'linea_no_la_lleva'
  | 'baja_todas'
  | 'baja_sin_destino'
  | 'usuario_sin_baja'
  | 'fecha_invalida'
  | 'fecha_futura'
  | 'fecha_muy_atras'
  | 'destino_no_existe'
  | 'destino_es_origen'
  | 'destino_inactivo'
  | 'nombre_requerido'
  | 'email_en_uso'

export type CodigoAvisoTraspaso =
  | 'se_crea_destino'
  | 'otra_ciudad'
  | 'conflicto'
  | 'ajuste_sin_efecto'
  | 'sin_zona_base'
  | 'zonas_sin_ejecutiva'
  | 'anexo_final'
  | 'usuario_se_desactiva'
  | 'usuario_sigue_activo'
  | 'usuario_no_se_desactiva'
  | 'fecha_antes_de_ingreso'
  | 'origen_sin_lineas'
  | 'excepciones_reemplazan'
  | 'excepciones_no_copiadas'
  | 'visitantes_sin_linea'

/** info: para que se sepa; atencion: puede no ser lo que se espera (la cobertura, un ajuste, el usuario). */
export type NivelAviso = 'info' | 'atencion'

export interface TraspasoError {
  codigo: CodigoErrorTraspaso
  mensaje: string
  line_id?: string
}

export interface TraspasoAviso {
  codigo: CodigoAvisoTraspaso
  nivel: NivelAviso
  mensaje: string
  line_id?: string
  kam_id?: string
}

export type TipoZonaTerritorio = 'local' | 'reach' | 'manual'

export interface PlanZona {
  kam_id: string
  kam_name: string
  kind: TipoZonaTerritorio
}

export interface PlanAjuste {
  override_id: string
  kam_id: string
  kam_name: string
  reason: string | null
  /** El ajuste movido no regiría en la cobertura recalculada (la zona tiene residente con la línea, o sin zona). */
  queda_sin_efecto: boolean
}

export interface PlanMedico {
  visitante_id: string
  medico_id: string
  medico_nombre: string | null
  municipality_id: string | null
  /** desde de la asignación de quien entrega. */
  desde: string
  /** hasta con que se termina a quien entrega: max(desde, F − 1). */
  hasta_origen: string
  /** desde con que lo tiene quien recibe: max(F, desde) (nunca antes de que existiera la asignación). */
  desde_destino: string
}

export interface PlanMedicoTerminado extends PlanMedico {
  razon: RazonTerminado
}

export interface PlanMedicoOmitido extends PlanMedico {
  razon: RazonOmitido
}

export interface PlanLinea {
  line_id: string
  line_name: string
  line_code: string | null
  /** Quien recibe ya llevaba la línea (no se suma otra vez). */
  destino_ya_la_lleva: boolean
  /** Zonas que hoy tiene quien entrega en esta línea (coverage guardada local|reach|manual). */
  zonas: PlanZona[]
  ajustes_mover: PlanAjuste[]
  ajustes_desactivar: PlanAjuste[]
  nombre_territorio: { origen: string | null; destino_actual: string | null; se_copia: boolean }
  /** Se terminan a quien entrega y se crean para quien recibe desde F. */
  medicos_mover: PlanMedico[]
  /** Solo se terminan ("nadie" o médico inactivo). */
  medicos_terminar: PlanMedicoTerminado[]
  /** Se terminan a quien entrega; quien recibe ya los visita. */
  medicos_omitidos: PlanMedicoOmitido[]
  anexo_final: { tiene_territorio: boolean; se_guarda: boolean; etiqueta: string | null }
}

export interface PlanOrigen {
  id: string
  full_name: string
  status: EstadoEjecutiva
  base_kam_id: string | null
  base_kam_name: string | null
  user_id: string | null
  lineas_antes: string[]
  lineas_despues: string[]
  status_despues: EstadoEjecutiva
  /** left_at que se le pone (F − 1) si se da de baja; null = no cambia. */
  left_at_despues: string | null
}

export interface PlanDestino {
  tipo: TipoDestino
  /** null si se crea (nueva o vacante) o si es "nadie". */
  id: string | null
  se_crea: boolean
  full_name: string | null
  email: string | null
  status_despues: EstadoEjecutiva | null
  base_kam_id: string | null
  base_kam_name: string | null
  /** started_at de la persona nueva (F); null en los demás casos. */
  started_at: string | null
  /** Color en el mapa: el suyo si ya existe; el de quien entrega si se crea con baja; null si se crea sin baja. */
  color: string | null
  /** Líneas que se le suman (las traspasadas que no llevaba). */
  lineas_sumadas: string[]
}

export interface PlanExcepcion {
  tabla: ExcepcionTraspaso['tabla']
  id: string
  tipo: string | null
  subtipo_id: string | null
  /** Quien recibe (si ya existe) tiene una vigente en F con la misma clave: config_registrar la corta. */
  reemplaza_la_de_destino: boolean
}

/** POST /api/executives/[id]/traspaso/vista-previa → esto. No escribe nada. */
export interface VistaPreviaTraspaso {
  /** Sin errores: el traspaso se puede confirmar. */
  ok: boolean
  errores: TraspasoError[]
  avisos: TraspasoAviso[]
  fecha: string
  /** F − 1: último día de quien entrega. */
  fin_origen: string
  dar_de_baja: boolean
  /** Efectivo: solo con baja, si se pidió y si su usuario es de Ejecutivo Comercial, activo y no el de quien lo hace. */
  desactivar_usuario: boolean
  copiar_excepciones: boolean
  guardar_anexo_final: boolean
  motivo: string | null
  origen: PlanOrigen | null
  destino: PlanDestino
  lineas: PlanLinea[]
  excepciones_a_copiar: PlanExcepcion[]
  resumen: TraspasoResumenPrevisto
}

// ---------------------------------------------------------------------------------------------
// 5. Historial y respuestas de la API (para que API e interfaz hablen igual)
// ---------------------------------------------------------------------------------------------

/** Elemento de GET /api/executives/traspasos (ejecutivas_traspasos con nombres). */
export interface TraspasoHistorialItem {
  id: string
  origen_id: string
  origen_nombre: string | null
  destino_id: string | null
  destino_nombre: string | null
  destino_tipo: TipoDestino
  lineas: string[]
  lineas_nombres: string[]
  fecha: string
  dar_de_baja: boolean
  desactivar_usuario: boolean
  copiar_excepciones: boolean
  /** Solo para quien administra el equipo (executives:edit o executives:transfer); para los demás, null. */
  motivo: string | null
  resumen: TraspasoResumen | null
  created_by: string | null
  created_by_nombre: string | null
  created_at: string
}

export interface TraspasosHistorialResponse {
  traspasos: TraspasoHistorialItem[]
}

/** Versión final del anexo que guardó la ruta antes del traspaso. */
export interface AnexoFinalGuardado {
  line_id: string
  etiqueta: string
  /** La versión que guardó ESTE intento (null si ya existía o si falló). */
  snapshot_id: string | null
  /** Solo si no se pudo guardar. */
  error: string | null
  /** Ya había una versión con esa etiqueta (un intento anterior del mismo día): queda guardada esa. */
  ya_existia: boolean
}

/** POST /api/executives/[id]/traspaso → esto. */
export interface TraspasoResponse {
  resumen: TraspasoResumen
  anexos_finales: AnexoFinalGuardado[]
  cobertura_recalculada: boolean
  /** Solo persona nueva con email: true si quedó enlazada con el usuario de OpMap de ese email. */
  usuario_enlazado?: boolean
}

// ---------------------------------------------------------------------------------------------
// 6. Piezas puras
// ---------------------------------------------------------------------------------------------

const ESTADOS_ELEGIBLES: ReadonlySet<string> = new Set(['active', 'placeholder'])
const TIPOS_TERRITORIO: ReadonlySet<string> = new Set(['local', 'reach', 'manual'])

function compararTexto(a: string, b: string): number {
  return a.localeCompare(b, 'es', { sensitivity: 'base' })
}

/** Orden de uuid de PostgreSQL (bytes) = orden de su texto en minúsculas; sin localeCompare. */
function compararId(a: string, b: string): number {
  const x = a.toLowerCase()
  const y = b.toLowerCase()
  return x < y ? -1 : x > y ? 1 : 0
}

/** municipality_id como lo ordena la función (NULLS FIRST; códigos DANE, solo dígitos). */
function compararCiudad(a: string | null, b: string | null): number {
  if (a === b) return 0
  if (a === null) return -1
  if (b === null) return 1
  return a < b ? -1 : a > b ? 1 : 0
}

function unicos(valores: string[]): string[] {
  return Array.from(new Set(valores))
}

/** "A", "A y B", "A, B y C". */
function unirNombres(nombres: string[]): string {
  if (nombres.length <= 1) return nombres[0] ?? ''
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`
}

function plural(n: number, singular: string, varios: string): string {
  return `${n} ${n === 1 ? singular : varios}`
}

/** "la zona de Ana en Columna la decide" / "las 3 zonas de Ana en Columna las decide" (concordancia del aviso). */
function zonasQueDecide(n: number, nombreOrigen: string, nombreLinea: string): string {
  return n === 1
    ? `la zona de ${nombreOrigen} en ${nombreLinea} la decide`
    : `las ${n} zonas de ${nombreOrigen} en ${nombreLinea} las decide`
}

/** Primer día permitido para la fecha del traspaso: hoy − 90. */
export function fechaMinimaTraspaso(hoy: string): string {
  return sumarDias(hoy, -DIAS_ATRAS_MAX)
}

/** Mensaje si la fecha del traspaso no vale (formato o fuera de [hoy − 90, hoy]); null si vale. */
export function errorFechaTraspaso(fecha: string, hoy: string): string | null {
  if (!esFechaIso(fecha)) return 'Fecha no válida: usa AAAA-MM-DD'
  if (fecha > hoy) return `La fecha del traspaso no puede ser posterior a hoy (${hoy}): no se programan traspasos`
  const minima = fechaMinimaTraspaso(hoy)
  if (fecha < minima) return `La fecha del traspaso puede ser hasta ${DIAS_ATRAS_MAX} días atrás (desde ${minima})`
  return null
}

/** Último día de quien entrega (F − 1): left_at si se da de baja. */
export function finDeOrigen(fecha: string): string {
  return sumarDias(fecha, -1)
}

/** hasta con que se termina una asignación de quien entrega: F − 1, pero nunca antes de su desde. */
export function hastaDeCierre(desde: string, fecha: string): string {
  const fin = finDeOrigen(fecha)
  return desde > fin ? desde : fin
}

/**
 * desde con que quien recibe tiene la asignación: F, pero nunca antes del desde de la de quien entrega (con una
 * fecha pasada, quien recibe no "visita" al médico desde antes de que estuviera asignado).
 */
export function desdeDeDestino(desde: string, fecha: string): string {
  return desde > fecha ? desde : fecha
}

/** Por qué el traspaso no desactiva el usuario de OpMap de quien se va (null = sí lo desactiva). */
export type RazonUsuarioNoSeDesactiva = 'sin_usuario' | 'no_encontrado' | 'ya_inactivo' | 'propio' | 'rol'

/**
 * Regla 9: el traspaso solo desactiva el usuario de un Ejecutivo Comercial (ROLES_USUARIO_DESACTIVABLES), activo y
 * que no sea el de quien hace el traspaso. Espejo del paso k de ejecutivas_traspasar (0820).
 */
export function razonUsuarioNoSeDesactiva(
  userId: string | null | undefined,
  usuario: UsuarioTraspaso | null | undefined,
  solicitanteId: string | null | undefined
): RazonUsuarioNoSeDesactiva | null {
  if (!userId) return 'sin_usuario'
  if (solicitanteId && userId === solicitanteId) return 'propio'
  if (!usuario || usuario.id !== userId) return 'no_encontrado'
  if (!ROLES_USUARIO_DESACTIVABLES.includes(usuario.role)) return 'rol'
  if (!usuario.active) return 'ya_inactivo'
  return null
}

/** Etiqueta de la versión final del anexo de quien entrega (territory_snapshots.version_label). */
export function etiquetaAnexoFinal(fecha: string): string {
  return `Final ${fecha} (traspaso)`
}

/** Nombre de la vacante que se crea: "Vacante · <zona>" (sin el prefijo "KAM " de kams.name). */
export function nombreVacante(zona: string | null | undefined): string {
  const nombre = zoneDisplayName(zona)
  return nombre ? `Vacante · ${nombre}` : 'Vacante'
}

/** ¿La excepción rige en la fecha (no anulada, desde <= F <= hasta)? */
export function excepcionVigente(excepcion: ExcepcionTraspaso, fecha: string): boolean {
  if (excepcion.anulado_at) return false
  if (excepcion.vigente_desde > fecha) return false
  return excepcion.vigente_hasta === null || excepcion.vigente_hasta >= fecha
}

/** Clave de config_registrar sin la persona: una por persona en config_personas; tipo y subtipo en metas. */
function claveExcepcion(excepcion: ExcepcionTraspaso): string {
  if (excepcion.tabla === 'config_personas') return 'config_personas'
  return `config_metas:${excepcion.tipo ?? '-'}:${excepcion.subtipo_id ?? '-'}`
}

/** Ciudad de una asignación tal como la compara el índice único (coalesce(municipality_id, '')). */
function claveVisitante(medicoId: string, lineId: string, municipio: string | null): string {
  return `${medicoId}|${lineId}|${municipio ?? ''}`
}

/** Parámetro p para ejecutivas_traspasar, con la fecha resuelta (null → hoy). */
export function parametroTraspaso(origenId: string, input: TraspasoInput, hoy: string): ParametroTraspaso {
  const destino: ParametroTraspaso['destino'] =
    input.destino.tipo === 'existente'
      ? { tipo: 'existente', id: input.destino.id }
      : input.destino.tipo === 'nueva'
        ? { tipo: 'nueva', full_name: input.destino.full_name, email: input.destino.email }
        : { tipo: input.destino.tipo }
  return {
    origen_id: origenId,
    destino,
    lineas: input.lineas,
    fecha: input.fecha ?? hoy,
    dar_de_baja: input.dar_de_baja,
    desactivar_usuario: input.dar_de_baja ? input.desactivar_usuario : false,
    copiar_excepciones: input.copiar_excepciones,
    motivo: input.motivo,
  }
}

function entero(valor: unknown): number {
  const numero = typeof valor === 'string' ? Number(valor) : valor
  return typeof numero === 'number' && Number.isFinite(numero) ? Math.trunc(numero) : 0
}

function listaDeTexto(valor: unknown): string[] {
  return Array.isArray(valor) ? valor.filter((item): item is string => typeof item === 'string') : []
}

/** Lee el jsonb que devuelve ejecutivas_traspasar (o ejecutivas_traspasos.resumen); null si no tiene forma. */
export function leerResumenTraspaso(valor: unknown): TraspasoResumen | null {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return null
  const fila = valor as Record<string, unknown>
  if (typeof fila.traspaso_id !== 'string') return null
  const omitidos = Array.isArray(fila.omitidos)
    ? fila.omitidos
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
        .filter(item => typeof item.medico_id === 'string')
        .map(item => ({ medico_id: item.medico_id as string, razon: typeof item.razon === 'string' ? item.razon : '' }))
    : []
  return {
    traspaso_id: fila.traspaso_id,
    destino_id: typeof fila.destino_id === 'string' ? fila.destino_id : null,
    lineas: listaDeTexto(fila.lineas),
    ajustes_movidos: entero(fila.ajustes_movidos),
    ajustes_desactivados: entero(fila.ajustes_desactivados),
    nombres_copiados: entero(fila.nombres_copiados),
    visitantes_movidos: entero(fila.visitantes_movidos),
    visitantes_terminados: entero(fila.visitantes_terminados),
    omitidos,
    excepciones_copiadas: entero(fila.excepciones_copiadas),
  }
}

// ---------------------------------------------------------------------------------------------
// 7. La vista previa
// ---------------------------------------------------------------------------------------------

/**
 * Lo que haría ejecutivas_traspasar con estas filas y este pedido, sin escribir nada. Con errores (ok = false) el
 * plan se calcula igual, para que la interfaz muestre qué pasaría, pero la función SQL lo rechazaría (400/404/409).
 */
export function planearTraspaso(datos: DatosTraspaso): VistaPreviaTraspaso {
  const { input, hoy } = datos
  const errores: TraspasoError[] = []
  const avisos: TraspasoAviso[] = []

  // --- Fecha (decisión 1)
  const fechaPedida = input.fecha ?? hoy
  const errorFecha = errorFechaTraspaso(fechaPedida, hoy)
  if (errorFecha) {
    const codigo: CodigoErrorTraspaso = !esFechaIso(fechaPedida)
      ? 'fecha_invalida'
      : fechaPedida > hoy
        ? 'fecha_futura'
        : 'fecha_muy_atras'
    errores.push({ codigo, mensaje: errorFecha })
  }
  // Con una fecha que ni siquiera es fecha, el plan se calcula con hoy (igual queda rechazado).
  const fecha = esFechaIso(fechaPedida) ? fechaPedida : hoy
  const finOrigen = finDeOrigen(fecha)

  // --- Catálogos
  const ejecutivas = new Map<string, EjecutivaTraspaso>()
  for (const ejecutiva of datos.ejecutivas) ejecutivas.set(ejecutiva.id, ejecutiva)
  const nombreZona = new Map<string, string>()
  for (const zona of datos.zonas ?? []) nombreZona.set(zona.id, zoneDisplayName(zona.name))
  const zonaNombre = (id: string | null | undefined) => (id ? nombreZona.get(id) || 'zona sin nombre' : null)
  const catalogoLineas = new Map<string, { linea: LineaTraspaso; orden: number }>()
  datos.lineas.forEach((linea, orden) => catalogoLineas.set(linea.id, { linea, orden }))
  const nombreLinea = (id: string) => catalogoLineas.get(id)?.linea.name ?? 'línea desconocida'
  const ordenarLineas = (ids: string[]) =>
    [...ids].sort((a, b) => {
      const oa = catalogoLineas.get(a)?.orden ?? Number.MAX_SAFE_INTEGER
      const ob = catalogoLineas.get(b)?.orden ?? Number.MAX_SAFE_INTEGER
      return oa - ob || a.localeCompare(b)
    })

  const darDeBaja = input.dar_de_baja
  if (!darDeBaja && input.desactivar_usuario) errores.push({ codigo: 'usuario_sin_baja', mensaje: MENSAJE_USUARIO_SIN_BAJA })

  // --- Quien entrega
  const origen = ejecutivas.get(datos.origen_id) ?? null
  if (!origen) {
    errores.push({ codigo: 'origen_no_existe', mensaje: 'Ejecutivo Comercial no encontrado' })
  } else if (origen.status === 'inactive') {
    errores.push({ codigo: 'origen_inactivo', mensaje: `${origen.full_name} ya está inactivo: no hay nada que traspasar` })
  }
  const lineasOrigen = ordenarLineas(unicos(origen?.lines ?? []))
  const nombreOrigen = origen?.full_name ?? 'Quien entrega'

  // --- Líneas que se traspasan (decisión 2)
  let lineas: string[]
  if (input.lineas === null) {
    lineas = lineasOrigen
  } else {
    const pedidas = unicos(input.lineas)
    for (const lineId of pedidas) {
      if (origen && !lineasOrigen.includes(lineId)) {
        errores.push({
          codigo: 'linea_no_la_lleva',
          mensaje: `${nombreOrigen} no lleva la línea ${nombreLinea(lineId)}`,
          line_id: lineId,
        })
      }
    }
    if (darDeBaja && (pedidas.length !== lineasOrigen.length || pedidas.some(id => !lineasOrigen.includes(id)))) {
      errores.push({ codigo: 'baja_todas', mensaje: MENSAJE_BAJA_TODAS })
    }
    lineas = darDeBaja ? lineasOrigen : ordenarLineas(pedidas.filter(id => lineasOrigen.includes(id)))
  }
  if (origen && origen.status !== 'inactive' && lineasOrigen.length === 0) {
    errores.push({ codigo: 'sin_lineas', mensaje: `${nombreOrigen} no lleva ninguna línea: no hay nada que traspasar` })
  }

  // --- Quien recibe (decisiones 2 y 3)
  // Color de la persona nueva o la vacante: el de quien entrega solo con baja (queda inactiva: no hay dos iguales).
  const colorHeredado = darDeBaja ? origen?.color ?? null : null
  const destinoPedido = input.destino
  let destinoExistente: EjecutivaTraspaso | null = null
  let destino: PlanDestino
  if (destinoPedido.tipo === 'existente') {
    destinoExistente = ejecutivas.get(destinoPedido.id) ?? null
    if (!destinoExistente) {
      errores.push({ codigo: 'destino_no_existe', mensaje: 'No se encontró a la persona que recibe' })
    } else if (destinoExistente.id === datos.origen_id) {
      errores.push({ codigo: 'destino_es_origen', mensaje: MENSAJE_DESTINO_ES_ORIGEN })
      destinoExistente = null // sus filas son las de quien entrega: no sirven para calcular el plan
    } else if (destinoExistente.status === 'inactive') {
      errores.push({
        codigo: 'destino_inactivo',
        mensaje: `${destinoExistente.full_name} está inactivo: no puede recibir un traspaso`,
      })
    }
    destino = {
      tipo: 'existente',
      id: destinoPedido.id,
      se_crea: false,
      full_name: destinoExistente?.full_name ?? null,
      email: destinoExistente?.email ?? null,
      status_despues: destinoExistente?.status ?? null,
      base_kam_id: destinoExistente?.base_kam_id ?? null,
      base_kam_name: zonaNombre(destinoExistente?.base_kam_id),
      started_at: null,
      color: destinoExistente?.color ?? null,
      lineas_sumadas: [],
    }
  } else if (destinoPedido.tipo === 'nueva') {
    const nombre = destinoPedido.full_name.trim().replace(/\s+/g, ' ')
    if (nombre.length < NOMBRE_MIN || nombre.length > NOMBRE_MAX) {
      errores.push({
        codigo: 'nombre_requerido',
        mensaje: `Escribe el nombre de la persona nueva (de ${NOMBRE_MIN} a ${NOMBRE_MAX} caracteres)`,
      })
    }
    const email = destinoPedido.email ? destinoPedido.email.trim().toLowerCase() : null
    if (email) {
      const enUso = datos.ejecutivas.find(ejecutiva => (ejecutiva.email ?? '').trim().toLowerCase() === email)
      if (enUso) {
        errores.push({ codigo: 'email_en_uso', mensaje: `El email ${email} ya es de ${enUso.full_name}` })
      }
    }
    destino = {
      tipo: 'nueva',
      id: null,
      se_crea: true,
      full_name: nombre,
      email,
      status_despues: 'active',
      base_kam_id: origen?.base_kam_id ?? null,
      base_kam_name: zonaNombre(origen?.base_kam_id),
      started_at: fecha,
      color: colorHeredado,
      lineas_sumadas: [],
    }
  } else if (destinoPedido.tipo === 'vacante') {
    destino = {
      tipo: 'vacante',
      id: null,
      se_crea: true,
      full_name: nombreVacante(zonaNombre(origen?.base_kam_id)),
      email: null,
      status_despues: 'placeholder',
      base_kam_id: origen?.base_kam_id ?? null,
      base_kam_name: zonaNombre(origen?.base_kam_id),
      started_at: null,
      color: colorHeredado,
      lineas_sumadas: [],
    }
  } else {
    if (darDeBaja) errores.push({ codigo: 'baja_sin_destino', mensaje: MENSAJE_BAJA_SIN_DESTINO })
    destino = {
      tipo: 'nadie',
      id: null,
      se_crea: false,
      full_name: null,
      email: null,
      status_despues: null,
      base_kam_id: null,
      base_kam_name: null,
      started_at: null,
      color: null,
      lineas_sumadas: [],
    }
  }
  const hayDestino = destino.tipo !== 'nadie'
  const nombreDestino = destino.full_name ?? 'quien recibe'
  const lineasDestinoAntes = new Set(destinoExistente?.lines ?? [])
  destino.lineas_sumadas = hayDestino ? lineas.filter(id => !lineasDestinoAntes.has(id)) : []

  if (hayDestino && destino.se_crea) {
    avisos.push({
      codigo: 'se_crea_destino',
      nivel: 'info',
      mensaje:
        (destino.tipo === 'nueva'
          ? `Se crea a ${nombreDestino} como Ejecutivo Comercial activo en la zona ${destino.base_kam_name ?? '(sin zona)'}, desde ${fecha}`
          : `Se crea la vacante «${nombreDestino}» con la zona de ${nombreOrigen}; cuando se contrate a alguien, usa «Contratar» en esa vacante`) +
        (destino.color ? `. Conserva el color de ${nombreOrigen} en el mapa` : ''),
    })
  }
  if (hayDestino && !destino.base_kam_id && (destino.se_crea || destinoExistente)) {
    avisos.push({
      codigo: 'sin_zona_base',
      nivel: 'atencion',
      mensaje: `${nombreDestino} queda sin zona base: la cobertura no le dará zonas ni le aplicará los ajustes manuales`,
    })
  }

  // Residentes elegibles de una zona que llevan la línea DESPUÉS del traspaso, sin contar a quien entrega (pierde
  // esas líneas) ni a quien recibe. Igual que las "locales" de computeCoverage.
  const idDestino = destinoExistente?.id ?? null
  const residentes = (kamId: string, lineId: string) =>
    datos.ejecutivas
      .filter(
        ejecutiva =>
          ejecutiva.id !== datos.origen_id &&
          ejecutiva.id !== idDestino &&
          ESTADOS_ELEGIBLES.has(ejecutiva.status) &&
          ejecutiva.base_kam_id === kamId &&
          ejecutiva.lines.includes(lineId)
      )
      .sort((a, b) => compararTexto(a.full_name, b.full_name))

  // --- Por línea
  const nombresPorClave = new Map<string, string>()
  for (const fila of datos.nombres) nombresPorClave.set(`${fila.line_id}|${fila.executive_id}`, fila.name)
  const abiertasDestino = new Set<string>()
  if (idDestino) {
    for (const visitante of datos.visitantes) {
      if (visitante.executive_id === idDestino && visitante.hasta === null) {
        abiertasDestino.add(claveVisitante(visitante.medico_id, visitante.line_id, visitante.municipality_id))
      }
    }
  }

  const planLineas: PlanLinea[] = lineas.map(lineId => {
    const linea = catalogoLineas.get(lineId)?.linea
    const nombreDeLinea = nombreLinea(lineId)

    const zonas: PlanZona[] = datos.cobertura
      .filter(
        fila => fila.line_id === lineId && fila.executive_id === datos.origen_id && TIPOS_TERRITORIO.has(fila.kind)
      )
      .map(fila => ({ kam_id: fila.kam_id, kam_name: zonaNombre(fila.kam_id) ?? '', kind: fila.kind as TipoZonaTerritorio }))
      .sort((a, b) => compararTexto(a.kam_name, b.kam_name) || a.kam_id.localeCompare(b.kam_id))

    // Ajustes manuales (decisión 5)
    const ajustes: PlanAjuste[] = datos.ajustes
      .filter(ajuste => ajuste.active && ajuste.line_id === lineId && ajuste.executive_id === datos.origen_id)
      .map(ajuste => {
        let quedaSinEfecto = false
        if (hayDestino) {
          if (!destino.base_kam_id) quedaSinEfecto = true
          else if (destino.base_kam_id !== ajuste.kam_id) quedaSinEfecto = residentes(ajuste.kam_id, lineId).length > 0
        }
        return {
          override_id: ajuste.id,
          kam_id: ajuste.kam_id,
          kam_name: zonaNombre(ajuste.kam_id) ?? '',
          reason: ajuste.reason,
          queda_sin_efecto: quedaSinEfecto,
        }
      })
      .sort((a, b) => compararTexto(a.kam_name, b.kam_name) || a.override_id.localeCompare(b.override_id))

    // Nombre del territorio (decisión 6)
    const nombreOrigenLinea = nombresPorClave.get(`${lineId}|${datos.origen_id}`) ?? null
    const nombreDestinoLinea = idDestino ? nombresPorClave.get(`${lineId}|${idDestino}`) ?? null : null

    // Médicos (decisión 4)
    const medicosMover: PlanMedico[] = []
    const medicosTerminar: PlanMedicoTerminado[] = []
    const medicosOmitidos: PlanMedicoOmitido[] = []
    const abiertas = datos.visitantes
      .filter(
        visitante => visitante.executive_id === datos.origen_id && visitante.line_id === lineId && visitante.hasta === null
      )
      .sort(
        (a, b) =>
          compararTexto(a.medico_nombre ?? '', b.medico_nombre ?? '') ||
          (a.municipality_id ?? '').localeCompare(b.municipality_id ?? '') ||
          a.id.localeCompare(b.id)
      )
    for (const visitante of abiertas) {
      const medico: PlanMedico = {
        visitante_id: visitante.id,
        medico_id: visitante.medico_id,
        medico_nombre: visitante.medico_nombre ?? null,
        municipality_id: visitante.municipality_id,
        desde: visitante.desde,
        hasta_origen: hastaDeCierre(visitante.desde, fecha),
        desde_destino: desdeDeDestino(visitante.desde, fecha),
      }
      if (!hayDestino) medicosTerminar.push({ ...medico, razon: 'sin_destino' })
      else if (!visitante.medico_activo) medicosTerminar.push({ ...medico, razon: 'medico_inactivo' })
      else if (abiertasDestino.has(claveVisitante(visitante.medico_id, lineId, visitante.municipality_id))) {
        medicosOmitidos.push({ ...medico, razon: 'ya_lo_visita' })
      } else medicosMover.push(medico)
    }

    // Versión final del anexo (decisión 7)
    const tieneTerritorio = zonas.length > 0
    const seGuarda = tieneTerritorio && input.guardar_anexo_final

    // Avisos de cobertura de esta línea
    if (hayDestino) {
      const zonaDestino = destino.base_kam_id
      if (zonaDestino) {
        const otros = residentes(zonaDestino, lineId)
        if (otros.length > 0) {
          avisos.push({
            codigo: 'conflicto',
            nivel: 'atencion',
            mensaje: `En ${destino.base_kam_name} ya ${otros.length === 1 ? 'vive' : 'viven'} ${unirNombres(
              otros.map(otra => otra.full_name)
            )} con ${nombreDeLinea}: con ${nombreDestino} la zona queda en conflicto y el líder de la línea debe repartir`,
            line_id: lineId,
            kam_id: zonaDestino,
          })
        }
      }
      if (destinoExistente && zonaDestino && zonaDestino !== origen?.base_kam_id && zonas.length > 0) {
        avisos.push({
          codigo: 'otra_ciudad',
          nivel: 'atencion',
          mensaje: `${nombreDestino} vive en otra ciudad (${destino.base_kam_name}): ${zonasQueDecide(
            zonas.length,
            nombreOrigen,
            nombreDeLinea
          )} la cobertura recalculada; ${zonas.length === 1 ? 'puede' : 'pueden'} quedar con alcance de ${nombreDestino}, con otra persona, en conflicto o ${zonas.length === 1 ? 'vacante' : 'vacantes'}`,
          line_id: lineId,
        })
      }
      for (const ajuste of ajustes.filter(item => item.queda_sin_efecto)) {
        const bloquean = destino.base_kam_id ? residentes(ajuste.kam_id, lineId) : []
        avisos.push({
          codigo: 'ajuste_sin_efecto',
          nivel: 'atencion',
          mensaje:
            bloquean.length > 0
              ? `El ajuste manual de ${ajuste.kam_name} en ${nombreDeLinea} pasa a ${nombreDestino} pero quedará sin efecto: la zona ya tiene a ${unirNombres(
                  bloquean.map(otra => otra.full_name)
                )} con esta línea`
              : `El ajuste manual de ${ajuste.kam_name} en ${nombreDeLinea} pasa a ${nombreDestino} pero quedará sin efecto mientras no tenga zona base`,
          line_id: lineId,
          kam_id: ajuste.kam_id,
        })
      }
    } else if (zonas.length > 0) {
      avisos.push({
        codigo: 'zonas_sin_ejecutiva',
        nivel: 'atencion',
        mensaje: `Nadie recibe ${nombreDeLinea}: ${zonasQueDecide(zonas.length, nombreOrigen, nombreDeLinea)} la cobertura recalculada (otra persona por alcance o ${zonas.length === 1 ? 'vacante' : 'vacantes'})`,
        line_id: lineId,
      })
    }
    if (seGuarda) {
      avisos.push({
        codigo: 'anexo_final',
        nivel: 'info',
        mensaje: `Se guarda la versión final del anexo de ${nombreOrigen} en ${nombreDeLinea}: «${etiquetaAnexoFinal(fecha)}»`,
        line_id: lineId,
      })
    }

    return {
      line_id: lineId,
      line_name: nombreDeLinea,
      line_code: linea?.code ?? null,
      destino_ya_la_lleva: lineasDestinoAntes.has(lineId),
      zonas,
      ajustes_mover: hayDestino ? ajustes : [],
      ajustes_desactivar: hayDestino ? [] : ajustes,
      nombre_territorio: {
        origen: nombreOrigenLinea,
        destino_actual: nombreDestinoLinea,
        se_copia: hayDestino && nombreOrigenLinea !== null && nombreDestinoLinea === null,
      },
      medicos_mover: medicosMover,
      medicos_terminar: medicosTerminar,
      medicos_omitidos: medicosOmitidos,
      anexo_final: { tiene_territorio: tieneTerritorio, se_guarda: seGuarda, etiqueta: seGuarda ? etiquetaAnexoFinal(fecha) : null },
    }
  })

  // --- Excepciones personales (decisión 8)
  const excepciones = datos.excepciones ?? []
  const vigentesOrigen = excepciones
    .filter(excepcion => excepcion.executive_id === datos.origen_id && excepcionVigente(excepcion, fecha))
    .sort((a, b) => claveExcepcion(a).localeCompare(claveExcepcion(b)) || a.id.localeCompare(b.id))
  const clavesDestino = new Set(
    idDestino
      ? excepciones
          .filter(excepcion => excepcion.executive_id === idDestino && excepcionVigente(excepcion, fecha))
          .map(claveExcepcion)
      : []
  )
  const excepcionesACopiar: PlanExcepcion[] =
    input.copiar_excepciones && hayDestino
      ? vigentesOrigen.map(excepcion => ({
          tabla: excepcion.tabla,
          id: excepcion.id,
          tipo: excepcion.tipo ?? null,
          subtipo_id: excepcion.subtipo_id ?? null,
          reemplaza_la_de_destino: clavesDestino.has(claveExcepcion(excepcion)),
        }))
      : []
  const reemplazadas = excepcionesACopiar.filter(excepcion => excepcion.reemplaza_la_de_destino).length
  if (reemplazadas > 0) {
    avisos.push({
      codigo: 'excepciones_reemplazan',
      nivel: 'atencion',
      mensaje: `${nombreDestino} ya tiene ${plural(reemplazadas, 'excepción propia', 'excepciones propias')} que se ${
        reemplazadas === 1 ? 'reemplaza' : 'reemplazan'
      } desde ${fecha} por las de ${nombreOrigen}`,
    })
  }
  if (!input.copiar_excepciones && hayDestino && vigentesOrigen.length > 0) {
    avisos.push({
      codigo: 'excepciones_no_copiadas',
      nivel: 'info',
      mensaje: `${nombreOrigen} tiene ${plural(vigentesOrigen.length, 'excepción personal', 'excepciones personales')} (metas propias, perfil, telefónica o radio) que no se copian`,
    })
  }

  // --- Quien entrega, después
  const lineasDespues = darDeBaja ? [] : lineasOrigen.filter(id => !lineas.includes(id))
  // Regla 9: solo el usuario de un Ejecutivo Comercial, activo y que no sea el de quien hace el traspaso.
  const usuarioOrigen = origen?.user_id ? (datos.usuarios ?? []).find(usuario => usuario.id === origen.user_id) ?? null : null
  const razonUsuario = razonUsuarioNoSeDesactiva(origen?.user_id, usuarioOrigen, datos.solicitante_id)
  const desactivarUsuario = darDeBaja && input.desactivar_usuario && razonUsuario === null
  if (origen && darDeBaja && origen.user_id) {
    if (desactivarUsuario) {
      avisos.push({
        codigo: 'usuario_se_desactiva',
        nivel: 'info',
        mensaje: `El usuario de OpMap de ${nombreOrigen} se desactiva: deja de entrar`,
      })
    } else if (!input.desactivar_usuario) {
      avisos.push({
        codigo: 'usuario_sigue_activo',
        nivel: 'atencion',
        mensaje: `El usuario de OpMap de ${nombreOrigen} sigue activo aunque se da de baja`,
      })
    } else if (razonUsuario === 'ya_inactivo') {
      avisos.push({
        codigo: 'usuario_no_se_desactiva',
        nivel: 'info',
        mensaje: `El usuario de OpMap de ${nombreOrigen} ya estaba inactivo`,
      })
    } else {
      avisos.push({
        codigo: 'usuario_no_se_desactiva',
        nivel: 'atencion',
        mensaje:
          razonUsuario === 'propio'
            ? `El usuario de OpMap de ${nombreOrigen} es el tuyo: el traspaso no lo desactiva (nadie se desactiva a sí mismo)`
            : razonUsuario === 'rol' && usuarioOrigen
              ? `El usuario de OpMap de ${nombreOrigen} tiene el rol «${getRoleTitle(usuarioOrigen.role as Role)}»: el traspaso solo desactiva usuarios de Ejecutivo Comercial y este sigue activo. Si debe dejar de entrar, que un administrador lo desactive en Usuarios`
              : `No se encontró el usuario de OpMap de ${nombreOrigen}: el traspaso no lo desactiva`,
      })
    }
  }
  // Fecha del traspaso anterior al ingreso (no se rechaza: se avisa para revisarla)
  if (origen && darDeBaja && origen.started_at && finOrigen < origen.started_at) {
    avisos.push({
      codigo: 'fecha_antes_de_ingreso',
      nivel: 'atencion',
      mensaje: `${nombreOrigen} ingresó el ${origen.started_at}: con esta fecha su último día (${finOrigen}) queda antes de su ingreso. Revisa la fecha`,
    })
  }
  if (destinoExistente?.started_at && fecha < destinoExistente.started_at) {
    avisos.push({
      codigo: 'fecha_antes_de_ingreso',
      nivel: 'atencion',
      mensaje: `${destinoExistente.full_name} ingresó el ${destinoExistente.started_at}, después de la fecha del traspaso (${fecha}): recibiría lo traspasado desde antes de su ingreso. Revisa la fecha`,
    })
  }
  if (origen && !darDeBaja && lineas.length > 0 && lineasDespues.length === 0) {
    avisos.push({
      codigo: 'origen_sin_lineas',
      nivel: 'atencion',
      mensaje: `${nombreOrigen} se queda sin líneas y sigue en el equipo; si se va, haz el traspaso como baja`,
    })
  }

  // Con baja, las asignaciones abiertas de quien entrega en líneas que ya no llevaba (no deberían existir: desde la
  // 0820 quitar una línea termina sus visitantes) las termina el disparador de la baja; la función las cuenta en
  // visitantes_terminados y la vista previa también.
  const abiertasSinLinea =
    origen && darDeBaja
      ? datos.visitantes.filter(
          visitante =>
            visitante.executive_id === datos.origen_id && visitante.hasta === null && !lineasOrigen.includes(visitante.line_id)
        ).length
      : 0
  if (abiertasSinLinea > 0) {
    avisos.push({
      codigo: 'visitantes_sin_linea',
      nivel: 'atencion',
      mensaje: `${nombreOrigen} tiene ${plural(
        abiertasSinLinea,
        'asignación de visitante abierta',
        'asignaciones de visitante abiertas'
      )} en líneas que ya no lleva: con la baja ${abiertasSinLinea === 1 ? 'se termina' : 'se terminan'} y ${
        abiertasSinLinea === 1 ? 'ese médico queda' : 'esos médicos quedan'
      } sin visitante`,
    })
  }

  const planOrigen: PlanOrigen | null = origen
    ? {
        id: origen.id,
        full_name: origen.full_name,
        status: origen.status,
        base_kam_id: origen.base_kam_id,
        base_kam_name: zonaNombre(origen.base_kam_id),
        user_id: origen.user_id,
        lineas_antes: lineasOrigen,
        lineas_despues: lineasDespues,
        status_despues: darDeBaja ? 'inactive' : origen.status,
        left_at_despues: darDeBaja ? finOrigen : null,
      }
    : null

  // --- Resumen previsto (el mismo conteo y orden que la función SQL)
  // omitidos: los 'ya_lo_visita' y los 'medico_inactivo', en el orden del bucle de ejecutivas_traspasar
  // (ORDER BY line_id, medico_id, municipality_id NULLS FIRST, id).
  const omitidos = planLineas
    .flatMap(linea => [
      ...linea.medicos_omitidos.map(medico => ({ linea: linea.line_id, medico, razon: medico.razon as RazonOmitidoResumen })),
      ...linea.medicos_terminar
        .filter(medico => medico.razon === 'medico_inactivo')
        .map(medico => ({ linea: linea.line_id, medico, razon: 'medico_inactivo' as RazonOmitidoResumen })),
    ])
    .sort(
      (a, b) =>
        compararId(a.linea, b.linea) ||
        compararId(a.medico.medico_id, b.medico.medico_id) ||
        compararCiudad(a.medico.municipality_id, b.medico.municipality_id) ||
        compararId(a.medico.visitante_id, b.medico.visitante_id)
    )
    .map(item => ({ medico_id: item.medico.medico_id, razon: item.razon }))
  const resumen: TraspasoResumenPrevisto = {
    destino_id: destino.id,
    lineas: [...lineas].sort(compararId),
    ajustes_movidos: planLineas.reduce((suma, linea) => suma + linea.ajustes_mover.length, 0),
    ajustes_desactivados: planLineas.reduce((suma, linea) => suma + linea.ajustes_desactivar.length, 0),
    nombres_copiados: planLineas.filter(linea => linea.nombre_territorio.se_copia).length,
    visitantes_movidos: planLineas.reduce((suma, linea) => suma + linea.medicos_mover.length, 0),
    visitantes_terminados:
      planLineas.reduce((suma, linea) => suma + linea.medicos_terminar.length, 0) + abiertasSinLinea,
    omitidos,
    excepciones_copiadas: excepcionesACopiar.length,
  }

  return {
    ok: errores.length === 0,
    errores,
    avisos,
    fecha,
    fin_origen: finOrigen,
    dar_de_baja: darDeBaja,
    desactivar_usuario: desactivarUsuario,
    copiar_excepciones: input.copiar_excepciones,
    guardar_anexo_final: input.guardar_anexo_final,
    motivo: input.motivo,
    origen: planOrigen,
    destino,
    lineas: planLineas,
    excepciones_a_copiar: excepcionesACopiar,
    resumen,
  }
}
