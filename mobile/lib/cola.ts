/**
 * Cola sin señal de la app (decisiones 4 y 5 del contrato fase 8). PURA: sin React Native; el almacén
 * (AsyncStorage en la app, memoria en las pruebas) y el envío (POST /api/me/visitas) se inyectan. La conecta con
 * la app lib/cola-contexto.tsx (reintento al volver a primer plano y al reconectar).
 *
 * Reglas:
 * - Cada visita lleva su `client_id` (uuid de la app). Encolar dos veces el mismo client_id no duplica, y el
 *   servidor responde la misma fila si ya la tenía (`repetida: true`): reintentar siempre es seguro.
 * - La visita conserva el punto y la hora del sitio (`checked_in_at`); se reintenta hasta las 23:59 de ESE día en
 *   Bogotá. Pasada la medianoche NO se descarta a ciegas: pasa a "por confirmar" y se manda UNA vez más solo para
 *   preguntar si ya estaba guardada (el servidor busca el client_id ANTES de la regla del mismo día: si el envío de
 *   las 23:58 llegó pero la respuesta se perdió, contesta `repetida` y queda "enviada"). Si el servidor la rechaza
 *   (no estaba: ya no se puede reportar) queda "no enviada" con el aviso; sin señal sigue "por confirmar".
 * - Sin señal, tiempo agotado, error del servidor o ruta no disponible (404/502/503) → sigue pendiente y se
 *   reintenta. Datos rechazados (400/403/409/422) → "no enviada" con el mensaje del servidor. Sesión vencida
 *   (401) → se detiene sin tocar nada (se envía al volver a entrar, si sigue siendo el mismo día).
 */
import { aApiError, type ApiError } from './errores'
import { fechaBogota, hoyBogota, sumarDias } from './fechas'
import type { VisitaCreate } from './tipos'

export type EstadoCola = 'pendiente' | 'por_confirmar' | 'enviada' | 'no_enviada'

export interface ElementoCola {
  client_id: string
  cuerpo: VisitaCreate
  /** Texto corto para la lista ("Médica · Dr. Pérez · Clínica Norte"). Sin documentos. */
  resumen: string
  /** Fecha del sitio en Bogotá (de checked_in_at): el único día en que se puede enviar. */
  fecha: string
  creado_at: string
  estado: EstadoCola
  intentos: number
  ultimo_intento_at: string | null
  /** Último error (pendiente: por qué no salió; no enviada: por qué no se aceptó). */
  error: string | null
  visita_id: string | null
  enviada_at: string | null
  /** El servidor ya la tenía (mismo client_id). */
  repetida: boolean
}

export interface ResumenCola {
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

export const MENSAJE_PASO_MEDIANOCHE =
  'Pasó la medianoche sin que se pudiera enviar: solo se reportan visitas del mismo día. Avísale a tu líder.'
export const MENSAJE_OTRO_DIA = 'Solo se reportan visitas del mismo día'

/** Días que se conserva una "no enviada" sin que la persona la descarte. */
export const DIAS_CONSERVAR_NO_ENVIADA = 7

// ---------------------------------------------------------------------------------------------
// Funciones puras sobre la lista
// ---------------------------------------------------------------------------------------------

/** Agrega una visita. Mismo client_id → la cola no cambia (idempotente). Lanza si la visita no es de hoy. */
export function agregar(
  cola: readonly ElementoCola[],
  entrada: { cuerpo: VisitaCreate; resumen: string },
  ahora: Date
): { cola: ElementoCola[]; elemento: ElementoCola; nueva: boolean } {
  const existente = cola.find(e => e.client_id === entrada.cuerpo.client_id)
  if (existente) return { cola: [...cola], elemento: existente, nueva: false }
  const fecha = fechaBogota(entrada.cuerpo.checked_in_at)
  if (fecha !== hoyBogota(ahora)) throw new Error(MENSAJE_OTRO_DIA)
  const elemento: ElementoCola = {
    client_id: entrada.cuerpo.client_id,
    cuerpo: entrada.cuerpo,
    resumen: entrada.resumen.trim().slice(0, 200),
    fecha,
    creado_at: ahora.toISOString(),
    estado: 'pendiente',
    intentos: 0,
    ultimo_intento_at: null,
    error: null,
    visita_id: null,
    enviada_at: null,
    repetida: false,
  }
  return { cola: [...cola, elemento], elemento, nueva: true }
}

/** Aviso mientras se pregunta al servidor si una visita de un día anterior ya había quedado guardada. */
export const MENSAJE_POR_CONFIRMAR = 'Pasó la medianoche: al volver la señal se revisa si esta visita ya había quedado guardada.'

/**
 * Pendientes de días anteriores (en Bogotá) → "por confirmar": se preguntan una vez al servidor (pudieron llegar
 * antes de medianoche con la respuesta perdida). Nunca se descartan sin preguntar.
 */
export function aplicarMedianoche(cola: readonly ElementoCola[], ahora: Date): ElementoCola[] {
  const hoy = hoyBogota(ahora)
  return cola.map(e => (e.estado === 'pendiente' && e.fecha < hoy ? { ...e, estado: 'por_confirmar', error: MENSAJE_POR_CONFIRMAR } : e))
}

/**
 * Lo que se manda ahora, en el orden en que se reportó: las pendientes de hoy (en Bogotá) y las "por confirmar" de
 * días anteriores (una pregunta: el servidor responde `repetida` si ya estaba o la rechaza si no).
 */
export function porEnviar(cola: readonly ElementoCola[], ahora: Date): ElementoCola[] {
  const hoy = hoyBogota(ahora)
  return cola
    .filter(e => (e.estado === 'pendiente' && e.fecha === hoy) || e.estado === 'por_confirmar')
    .sort((a, b) => a.creado_at.localeCompare(b.creado_at))
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
 * Registra un intento fallido: reintentable → sigue como estaba (pendiente o por confirmar); rechazo de datos → no
 * enviada con el mensaje del servidor (o, si era de un día anterior, con el aviso de medianoche: no estaba guardada y
 * ya no se puede reportar).
 */
export function marcarFallo(cola: readonly ElementoCola[], clientId: string, error: ApiError, ahora: Date): ElementoCola[] {
  const reintentable = esReintentable(error) || error.status === 401
  return cola.map(e => {
    if (e.client_id !== clientId) return e
    const porConfirmar = e.estado === 'por_confirmar'
    return {
      ...e,
      estado: reintentable ? e.estado : 'no_enviada',
      intentos: e.intentos + 1,
      ultimo_intento_at: ahora.toISOString(),
      error: reintentable ? (porConfirmar ? MENSAJE_POR_CONFIRMAR : error.message) : porConfirmar ? MENSAJE_PASO_MEDIANOCHE : error.message,
    }
  })
}

/** Quita una visita (la persona leyó el aviso de "no enviada", o ya se envió y no hace falta mostrarla). */
export function quitar(cola: readonly ElementoCola[], clientId: string): ElementoCola[] {
  return cola.filter(e => e.client_id !== clientId)
}

/** Limpieza: enviadas de días anteriores fuera; no enviadas de hace más de DIAS_CONSERVAR_NO_ENVIADA días fuera. */
export function podar(cola: readonly ElementoCola[], ahora: Date): ElementoCola[] {
  const hoy = hoyBogota(ahora)
  const limite = sumarDias(hoy, -DIAS_CONSERVAR_NO_ENVIADA)
  return cola.filter(e => {
    if (e.estado === 'enviada') return e.fecha === hoy
    if (e.estado === 'no_enviada') return e.fecha >= limite
    return true
  })
}

export function resumen(cola: readonly ElementoCola[], ahora: Date): ResumenCola {
  const hoy = hoyBogota(ahora)
  return {
    pendientes: cola.filter(e => e.estado === 'pendiente' || e.estado === 'por_confirmar').length,
    enviadas_hoy: cola.filter(e => e.estado === 'enviada' && e.fecha === hoy).length,
    no_enviadas: cola.filter(e => e.estado === 'no_enviada').length,
  }
}

/**
 * Envía las pendientes de hoy (y pregunta por las "por confirmar") una por una. Se detiene al primer error
 * reintentable (no tiene sentido seguir sin red) o con 401. Antes de cada envío vuelve a aplicar la medianoche (por si
 * el envío cruza las 00:00: la que no salió antes pasa a "por confirmar" y se pregunta igual).
 */
export async function procesar(cola: readonly ElementoCola[], enviar: Enviar, reloj: () => Date = () => new Date()): Promise<ResultadoProceso> {
  let actual = aplicarMedianoche(cola, reloj())
  const enviadas: string[] = []
  const no_enviadas: string[] = []
  for (const elemento of porEnviar(actual, reloj())) {
    actual = aplicarMedianoche(actual, reloj())
    const vigente = actual.find(e => e.client_id === elemento.client_id)
    if (!vigente || (vigente.estado !== 'pendiente' && vigente.estado !== 'por_confirmar')) continue
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
  version: 1
  items: ElementoCola[]
}

export const VERSION_COLA = 1

/** Lee el JSON guardado (vacío si no hay, está dañado o es de otra versión). */
export function deserializar(texto: string | null): ElementoCola[] {
  if (!texto) return []
  try {
    const datos = JSON.parse(texto) as Partial<Guardado>
    if (datos?.version !== VERSION_COLA || !Array.isArray(datos.items)) return []
    return datos.items.filter(e => e && typeof e.client_id === 'string' && e.cuerpo && typeof e.fecha === 'string')
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
 * reconectar al mismo tiempo no envíen dos veces lo mismo ni pisen lo guardado.
 */
export class ColaVisitas {
  private cadena: Promise<unknown> = Promise.resolve()
  private oyentes = new Set<(cola: ElementoCola[]) => void>()
  private ultima: ElementoCola[] = []

  constructor(
    private readonly almacen: AlmacenCola,
    private readonly reloj: () => Date = () => new Date()
  ) {}

  private enFila<T>(tarea: () => Promise<T>): Promise<T> {
    const resultado = this.cadena.then(tarea, tarea)
    this.cadena = resultado.catch(() => undefined)
    return resultado
  }

  private async cargar(): Promise<ElementoCola[]> {
    return podar(aplicarMedianoche(deserializar(await this.almacen.leer()), this.reloj()), this.reloj())
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

  encolar(cuerpo: VisitaCreate, textoResumen: string): Promise<ElementoCola> {
    return this.enFila(async () => {
      const { cola, elemento } = agregar(await this.cargar(), { cuerpo, resumen: textoResumen }, this.reloj())
      await this.guardar(cola)
      return elemento
    })
  }

  procesar(enviar: Enviar): Promise<ResultadoProceso> {
    return this.enFila(async () => {
      const resultado = await procesar(await this.cargar(), enviar, this.reloj)
      await this.guardar(resultado.cola)
      return resultado
    })
  }

  /** Guarda primero (nunca se pierde) y luego intenta enviar: lo que usa "Confirmar" en Reportar. */
  async encolarYEnviar(cuerpo: VisitaCreate, textoResumen: string, enviar: Enviar): Promise<{ elemento: ElementoCola; proceso: ResultadoProceso }> {
    await this.encolar(cuerpo, textoResumen)
    const proceso = await this.procesar(enviar)
    const elemento = proceso.cola.find(e => e.client_id === cuerpo.client_id)
    if (!elemento) throw new Error('La visita no quedó en la cola')
    return { elemento, proceso }
  }

  quitar(clientId: string): Promise<ElementoCola[]> {
    return this.enFila(async () => this.guardar(quitar(await this.cargar(), clientId)))
  }
}
