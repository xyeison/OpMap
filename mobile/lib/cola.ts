/**
 * Cola sin señal de la app (decisiones 4 y 5 del contrato fase 8; versión 2 desde la app sin señal, dueño 2026-10-30).
 * PURA: sin React Native; el almacén (AsyncStorage en el teléfono, IndexedDB en el navegador, memoria en las pruebas) y
 * el envío (POST /api/me/visitas) se inyectan. La conecta con la app lib/cola-contexto.tsx (reintento al guardar, al
 * abrir, al volver la señal, cada minuto y con Background Sync donde existe).
 *
 * Reglas:
 * - Cada visita lleva su `client_id` (uuid de la app). Encolar dos veces el mismo client_id no duplica, y el servidor
 *   responde la misma fila si ya la tenía (`repetida: true`): reintentar siempre es seguro.
 * - Estados: pendiente (por subir), enviando (en este instante), enviada (el servidor respondió 201) y no_enviada (el
 *   servidor rechazó los datos: 400/403/409/422; se muestra el error y la persona la reporta de nuevo o la descarta).
 *   Al cargar, una "enviando" que quedó así (la app se cerró a mitad) vuelve a pendiente.
 * - La visita conserva el punto y la hora del sitio (`checked_in_at`) y se reintenta HASTA QUE SUBA: ya no se descarta a
 *   medianoche (el servidor acepta otro día y la marca si hace falta). Lo que la 1 llamaba "por confirmar" es pendiente.
 * - Espera creciente entre reintentos (esperaReintento: 1, 2, 4, 8 min… tope 15): un fallo reintentable fija
 *   `proximo_intento_at`; `porEnviar` no manda antes de esa hora salvo con `forzar` ("Subir ahora", volver la señal).
 * - Sin señal, tiempo agotado, error del servidor o ruta no disponible (404/502/503) → sigue pendiente. Datos
 *   rechazados → no_enviada con el mensaje del servidor. Sesión vencida (401) → se detiene sin tocar nada (se envía al
 *   volver a entrar: la cola es por usuario y cerrar sesión no la borra).
 * - La versión 1 guardada (opmap.cola.v1.<usuario>, con estados "por_confirmar" y sin proximo_intento_at) se lee y se
 *   migra: nunca se descarta una visita por el formato.
 */
import { aApiError, type ApiError } from './errores'
import { fechaBogota, hoyBogota, sumarDias } from './fechas'
import type { VisitaCreate } from './tipos'

export type EstadoCola = 'pendiente' | 'enviando' | 'enviada' | 'no_enviada'

export const ETIQUETA_ESTADO_COLA: Record<EstadoCola, string> = {
  pendiente: 'Pendiente por subir',
  enviando: 'Subiendo…',
  enviada: 'Enviada',
  no_enviada: 'Con error',
}

export interface ElementoCola {
  client_id: string
  cuerpo: VisitaCreate
  /** Texto corto para la lista ("Médica · Dr. Pérez · Clínica Norte"). Sin documentos. */
  resumen: string
  /** Fecha del sitio en Bogotá (de checked_in_at). */
  fecha: string
  creado_at: string
  estado: EstadoCola
  intentos: number
  ultimo_intento_at: string | null
  /** Antes de esta hora no se reintenta sola (espera creciente); null = ya. */
  proximo_intento_at: string | null
  /** Último error (pendiente: por qué no salió; no enviada: por qué no se aceptó). */
  error: string | null
  visita_id: string | null
  enviada_at: string | null
  /** El servidor ya la tenía (mismo client_id). */
  repetida: boolean
  /** Tiene una foto en la cola de fotos (sube aparte, después de la visita). */
  con_foto: boolean
}

export interface ResumenCola {
  /** Pendientes y enviando. */
  pendientes: number
  enviadas_hoy: number
  no_enviadas: number
}

export interface RespuestaEnvio {
  visita_id: string
  repetida: boolean
}

export type Enviar = (cuerpo: VisitaCreate) => Promise<RespuestaEnvio>

export interface ResultadoProceso {
  cola: ElementoCola[]
  enviadas: string[]
  no_enviadas: string[]
  /** Por qué se detuvo antes de terminar: sin red (o servidor caído) o sesión vencida. */
  detenida: 'red' | 'sesion' | null
}

/** Días que se conserva una "no enviada" sin que la persona la descarte. */
export const DIAS_CONSERVAR_NO_ENVIADA = 7
/** Espera mínima y máxima entre reintentos automáticos. */
export const ESPERA_MIN_MS = 60_000
export const ESPERA_MAX_MS = 15 * 60_000

/** Espera antes del siguiente reintento automático tras `intentos` fallidos: 1, 2, 4, 8 min… con tope de 15 min. */
export function esperaReintento(intentos: number): number {
  const n = Math.max(1, Math.floor(intentos))
  return Math.min(ESPERA_MIN_MS * 2 ** (n - 1), ESPERA_MAX_MS)
}

// ---------------------------------------------------------------------------------------------
// Funciones puras sobre la lista
// ---------------------------------------------------------------------------------------------

/** Agrega una visita. Mismo client_id → la cola no cambia (idempotente). Cualquier día: nunca se rechaza aquí. */
export function agregar(
  cola: readonly ElementoCola[],
  entrada: { cuerpo: VisitaCreate; resumen: string; conFoto?: boolean },
  ahora: Date
): { cola: ElementoCola[]; elemento: ElementoCola; nueva: boolean } {
  const existente = cola.find(e => e.client_id === entrada.cuerpo.client_id)
  if (existente) return { cola: [...cola], elemento: existente, nueva: false }
  const elemento: ElementoCola = {
    client_id: entrada.cuerpo.client_id,
    cuerpo: entrada.cuerpo,
    resumen: entrada.resumen.trim().slice(0, 200),
    fecha: fechaDeLaVisita(entrada.cuerpo, ahora),
    creado_at: ahora.toISOString(),
    estado: 'pendiente',
    intentos: 0,
    ultimo_intento_at: null,
    proximo_intento_at: null,
    error: null,
    visita_id: null,
    enviada_at: null,
    repetida: false,
    con_foto: entrada.conFoto === true,
  }
  return { cola: [...cola, elemento], elemento, nueva: true }
}

function fechaDeLaVisita(cuerpo: VisitaCreate, ahora: Date): string {
  try {
    return fechaBogota(cuerpo.checked_in_at)
  } catch {
    return hoyBogota(ahora)
  }
}

/**
 * Lo que se manda ahora, en el orden en que se reportó: las pendientes cuya espera ya pasó (o todas, con `forzar`).
 * Una "enviando" que quedó de una ejecución anterior también cuenta (al cargar se normaliza a pendiente).
 */
export function porEnviar(cola: readonly ElementoCola[], ahora: Date, opciones: { forzar?: boolean } = {}): ElementoCola[] {
  const ahoraMs = ahora.getTime()
  return cola
    .filter(e => e.estado === 'pendiente' || e.estado === 'enviando')
    .filter(e => opciones.forzar || !e.proximo_intento_at || Date.parse(e.proximo_intento_at) <= ahoraMs)
    .sort((a, b) => a.creado_at.localeCompare(b.creado_at))
}

/** Una visita que estaba "enviando" cuando la app se cerró vuelve a pendiente (nada se perdió: el servidor es idempotente). */
export function normalizar(cola: readonly ElementoCola[]): ElementoCola[] {
  return cola.map(e => (e.estado === 'enviando' ? { ...e, estado: 'pendiente' } : e))
}

export function marcarEnviando(cola: readonly ElementoCola[], clientId: string): ElementoCola[] {
  return cola.map(e => (e.client_id === clientId ? { ...e, estado: 'enviando' } : e))
}

export function marcarEnviada(cola: readonly ElementoCola[], clientId: string, respuesta: RespuestaEnvio, ahora: Date): ElementoCola[] {
  return cola.map(e =>
    e.client_id === clientId
      ? {
          ...e,
          estado: 'enviada',
          visita_id: respuesta.visita_id,
          repetida: respuesta.repetida,
          enviada_at: ahora.toISOString(),
          ultimo_intento_at: ahora.toISOString(),
          proximo_intento_at: null,
          intentos: e.intentos + 1,
          error: null,
        }
      : e
  )
}

/** ¿Se reintenta más tarde? Sin red, tiempo agotado, 5xx, 404 (ruta aún no publicada), 429. */
export function esReintentable(error: ApiError): boolean {
  return error.tipo === 'red' || error.tipo === 'tiempo' || error.tipo === 'servidor' || error.tipo === 'no_disponible' || error.status === 429
}

/**
 * Registra un intento fallido: reintentable (o 401) → sigue pendiente con la espera creciente y el error visible;
 * rechazo de datos → no enviada con el mensaje del servidor.
 */
export function marcarFallo(cola: readonly ElementoCola[], clientId: string, error: ApiError, ahora: Date): ElementoCola[] {
  const reintentable = esReintentable(error) || error.status === 401
  return cola.map(e => {
    if (e.client_id !== clientId) return e
    const intentos = e.intentos + 1
    return {
      ...e,
      estado: reintentable ? 'pendiente' : 'no_enviada',
      intentos,
      ultimo_intento_at: ahora.toISOString(),
      // Con la sesión vencida no hay espera: al volver a entrar sube enseguida.
      proximo_intento_at: reintentable && error.status !== 401 ? new Date(ahora.getTime() + esperaReintento(intentos)).toISOString() : null,
      error: error.message,
    }
  })
}

/** Quita una visita (la persona leyó el aviso de "no enviada", o ya se envió y no hace falta mostrarla). */
export function quitar(cola: readonly ElementoCola[], clientId: string): ElementoCola[] {
  return cola.filter(e => e.client_id !== clientId)
}

/** Marca que la visita tiene (o ya no tiene) foto pendiente. */
export function marcarFoto(cola: readonly ElementoCola[], clientId: string, conFoto: boolean): ElementoCola[] {
  return cola.map(e => (e.client_id === clientId ? { ...e, con_foto: conFoto } : e))
}

/** Limpieza: enviadas de días anteriores fuera; no enviadas de hace más de DIAS_CONSERVAR_NO_ENVIADA días fuera. Pendientes, nunca. */
export function podar(cola: readonly ElementoCola[], ahora: Date): ElementoCola[] {
  const hoy = hoyBogota(ahora)
  const limite = sumarDias(hoy, -DIAS_CONSERVAR_NO_ENVIADA)
  return cola.filter(e => {
    if (e.estado === 'enviada') return (e.enviada_at ? fechaBogota(e.enviada_at) : e.fecha) === hoy
    // Por el último intento (no por la fecha de la visita): una de hace días que el servidor rechazó hoy se ve hoy.
    if (e.estado === 'no_enviada') return (e.ultimo_intento_at ? fechaBogota(e.ultimo_intento_at) : e.fecha) >= limite
    return true
  })
}

export function resumen(cola: readonly ElementoCola[], ahora: Date): ResumenCola {
  const hoy = hoyBogota(ahora)
  return {
    pendientes: cola.filter(e => e.estado === 'pendiente' || e.estado === 'enviando').length,
    enviadas_hoy: cola.filter(e => e.estado === 'enviada' && (e.enviada_at ? fechaBogota(e.enviada_at) : e.fecha) === hoy).length,
    no_enviadas: cola.filter(e => e.estado === 'no_enviada').length,
  }
}

/**
 * Envía las pendientes una por una (la más vieja primero). Se detiene al primer error reintentable (no tiene sentido
 * seguir sin red) o con 401. `guardar`, si viene, persiste la cola con la visita en "enviando" antes de cada envío (así
 * la pantalla muestra "Subiendo…" y, si la app muere a mitad, al cargar vuelve a pendiente).
 */
export async function procesar(
  cola: readonly ElementoCola[],
  enviar: Enviar,
  reloj: () => Date = () => new Date(),
  opciones: { forzar?: boolean; guardar?: (cola: ElementoCola[]) => Promise<void> } = {}
): Promise<ResultadoProceso> {
  let actual = normalizar(cola)
  const enviadas: string[] = []
  const no_enviadas: string[] = []
  for (const elemento of porEnviar(actual, reloj(), { forzar: opciones.forzar })) {
    const vigente = actual.find(e => e.client_id === elemento.client_id)
    if (!vigente || vigente.estado !== 'pendiente') continue
    actual = marcarEnviando(actual, vigente.client_id)
    if (opciones.guardar) await opciones.guardar(actual).catch(() => undefined)
    try {
      const respuesta = await enviar(vigente.cuerpo)
      actual = marcarEnviada(actual, vigente.client_id, respuesta, reloj())
      enviadas.push(vigente.client_id)
    } catch (lanzado) {
      const error = aApiError(lanzado)
      actual = marcarFallo(actual, vigente.client_id, error, reloj())
      if (error.status === 401) return { cola: actual, enviadas, no_enviadas, detenida: 'sesion' }
      if (esReintentable(error)) return { cola: actual, enviadas, no_enviadas, detenida: 'red' }
      no_enviadas.push(vigente.client_id)
    }
  }
  return { cola: actual, enviadas, no_enviadas, detenida: null }
}

// ---------------------------------------------------------------------------------------------
// La cola con almacén (una por usuario) y exclusión mutua
// ---------------------------------------------------------------------------------------------

export interface AlmacenCola {
  leer(): Promise<string | null>
  escribir(texto: string): Promise<void>
}

interface Guardado {
  version: 1 | 2
  items: unknown[]
}

export const VERSION_COLA = 2
/** Clave del almacén para la cola de un usuario (la misma que lee el service worker en la web). */
export const claveCola = (usuarioId: string) => `opmap.cola.v${VERSION_COLA}.${usuarioId}`
/** La clave de la versión 1 (se lee para migrar; no se borra). */
export const claveColaV1 = (usuarioId: string) => `opmap.cola.v1.${usuarioId}`

/** Un elemento guardado por la versión 1 o la 2 → la forma de la 2. null si no es una visita. */
export function migrarElemento(crudo: unknown): ElementoCola | null {
  if (!crudo || typeof crudo !== 'object') return null
  const e = crudo as Partial<ElementoCola> & { estado?: string }
  if (typeof e.client_id !== 'string' || !e.cuerpo || typeof e.fecha !== 'string') return null
  const estado: EstadoCola = e.estado === 'enviada' || e.estado === 'no_enviada' ? e.estado : 'pendiente' // por_confirmar y enviando → pendiente
  return {
    client_id: e.client_id,
    cuerpo: e.cuerpo as VisitaCreate,
    resumen: typeof e.resumen === 'string' ? e.resumen : '',
    fecha: e.fecha,
    creado_at: typeof e.creado_at === 'string' ? e.creado_at : new Date(0).toISOString(),
    estado,
    intentos: typeof e.intentos === 'number' ? e.intentos : 0,
    ultimo_intento_at: typeof e.ultimo_intento_at === 'string' ? e.ultimo_intento_at : null,
    proximo_intento_at: typeof e.proximo_intento_at === 'string' ? e.proximo_intento_at : null,
    error: typeof e.error === 'string' ? e.error : null,
    visita_id: typeof e.visita_id === 'string' ? e.visita_id : null,
    enviada_at: typeof e.enviada_at === 'string' ? e.enviada_at : null,
    repetida: e.repetida === true,
    con_foto: e.con_foto === true,
  }
}

/** Lee el JSON guardado (vacío si no hay o está dañado). La versión 1 se migra; una versión futura no se entiende → []. */
export function deserializar(texto: string | null): ElementoCola[] {
  if (!texto) return []
  try {
    const datos = JSON.parse(texto) as Partial<Guardado>
    if ((datos?.version !== 1 && datos?.version !== VERSION_COLA) || !Array.isArray(datos.items)) return []
    return datos.items.map(migrarElemento).filter((e): e is ElementoCola => e !== null)
  } catch {
    return []
  }
}

export function serializar(cola: readonly ElementoCola[]): string {
  const guardado: Guardado = { version: VERSION_COLA, items: [...cola] }
  return JSON.stringify(guardado)
}

/**
 * La cola de un usuario. Todas las operaciones van en fila (una a la vez) para que volver a primer plano y
 * reconectar al mismo tiempo no envíen dos veces lo mismo ni pisen lo guardado. `anterior`: el almacén de la versión 1
 * (se lee una vez, si la 2 está vacía, y se une; no se borra).
 */
export class ColaVisitas {
  private cadena: Promise<unknown> = Promise.resolve()
  private oyentes = new Set<(cola: ElementoCola[]) => void>()
  private ultima: ElementoCola[] = []
  private migrada = false

  constructor(
    private readonly almacen: AlmacenCola,
    private readonly reloj: () => Date = () => new Date(),
    private readonly anterior: Pick<AlmacenCola, 'leer'> | null = null
  ) {}

  private enFila<T>(tarea: () => Promise<T>): Promise<T> {
    const resultado = this.cadena.then(tarea, tarea)
    this.cadena = resultado.catch(() => undefined)
    return resultado
  }

  private async cargar(): Promise<ElementoCola[]> {
    const crudo = await this.almacen.leer()
    let cola = deserializar(crudo)
    // La v1 se une UNA vez: solo mientras la v2 no exista (listar la escribe enseguida). Si se uniera siempre, una
    // visita quitada o podada de la v2 reviviría desde la v1 en cada apertura.
    if (!this.migrada && this.anterior && crudo === null) {
      this.migrada = true
      const vieja = deserializar(await this.anterior.leer().catch(() => null))
      for (const e of vieja) if (!cola.some(x => x.client_id === e.client_id)) cola = [...cola, e]
    }
    return podar(normalizar(cola), this.reloj())
  }

  private async guardar(cola: ElementoCola[]): Promise<ElementoCola[]> {
    await this.almacen.escribir(serializar(cola))
    this.ultima = cola
    for (const oyente of this.oyentes) oyente(cola)
    return cola
  }

  /** Última lista conocida (sin leer el almacén). */
  get actual(): ElementoCola[] {
    return this.ultima
  }

  suscribir(oyente: (cola: ElementoCola[]) => void): () => void {
    this.oyentes.add(oyente)
    return () => {
      this.oyentes.delete(oyente)
    }
  }

  listar(): Promise<ElementoCola[]> {
    return this.enFila(async () => this.guardar(await this.cargar()))
  }

  encolar(cuerpo: VisitaCreate, textoResumen: string, conFoto = false): Promise<ElementoCola> {
    return this.enFila(async () => {
      const { cola, elemento } = agregar(await this.cargar(), { cuerpo, resumen: textoResumen, conFoto }, this.reloj())
      await this.guardar(cola)
      return elemento
    })
  }

  procesar(enviar: Enviar, opciones: { forzar?: boolean } = {}): Promise<ResultadoProceso> {
    return this.enFila(async () => {
      const resultado = await procesar(await this.cargar(), enviar, this.reloj, {
        forzar: opciones.forzar,
        guardar: async cola => {
          await this.guardar(cola)
        },
      })
      await this.guardar(resultado.cola)
      return resultado
    })
  }

  /** Guarda primero (nunca se pierde) y luego intenta enviar: lo que usa "Confirmar" en Reportar. */
  async encolarYEnviar(cuerpo: VisitaCreate, textoResumen: string, enviar: Enviar, conFoto = false): Promise<{ elemento: ElementoCola; proceso: ResultadoProceso }> {
    await this.encolar(cuerpo, textoResumen, conFoto)
    const proceso = await this.procesar(enviar, { forzar: true })
    const elemento = proceso.cola.find(e => e.client_id === cuerpo.client_id)
    if (!elemento) throw new Error('La visita no quedó en la cola')
    return { elemento, proceso }
  }

  quitar(clientId: string): Promise<ElementoCola[]> {
    return this.enFila(async () => this.guardar(quitar(await this.cargar(), clientId)))
  }

  marcarFoto(clientId: string, conFoto: boolean): Promise<ElementoCola[]> {
    return this.enFila(async () => this.guardar(marcarFoto(await this.cargar(), clientId, conFoto)))
  }
}
