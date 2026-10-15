/**
 * La ubicación del reporte, sin React Native: las fuentes (permiso, lectura precisa, lectura rápida, última conocida)
 * se inyectan. lib/ubicacion.ts les pone expo-location; scripts/movil-check.ts, unas falsas.
 *
 * Reportar la toma en DOS PASOS para no dejar a la persona mirando "Tomando tu ubicación…" (2026-10-14: en el iPhone,
 * dentro de una clínica, la lectura de alta precisión no llegaba antes del tiempo máximo y la pantalla esperaba
 * entero ese tiempo antes de pedir las sedes cercanas):
 *   - `primera`: solo para MOSTRAR ya las citas y las sedes cercanas. Es la última posición conocida de hace menos de
 *     2 minutos (la misma edad que ya se aceptaba de respaldo) o, si no hay, una lectura rápida de precisión media;
 *     si la final llega antes, la final.
 *   - `final`: la que VALE para la visita, con la regla de siempre: una lectura nueva de alta precisión con tiempo
 *     máximo y, si no llega a tiempo, la última conocida de hace menos de 2 minutos (marcada `aproximada`). Reportar
 *     no confirma una visita con la primera: si la final no ha llegado, la espera.
 * Si la final queda a más de DISTANCIA_RECARGA_M de la primera, Reportar vuelve a pedir el contexto (las sedes a menos
 * de 1 km son las del punto con que se pidió); si no, solo vuelve a medir las distancias con el punto nuevo.
 *
 * La lectura rápida, como cualquier lectura, queda en el teléfono como "última conocida" (en iOS, expo-location la lee
 * de CLLocationManager().location). Para que la regla de la final no cambie, la app registra sus propias lecturas
 * rápidas (registroDeRapidas) y la final y pedirUbicacion (Nuevo médico, "Crear sede aquí") no las aceptan de
 * respaldo: dentro de una clínica, sin lectura precisa, el resultado es el de antes de los dos pasos (sin punto), no un
 * punto de ~100 m que en una sede quedaría para siempre.
 *
 * Al final del archivo, lo que Reportar hace con los dos pasos, también puro para probarlo (la pantalla solo lo aplica):
 * el orden de la llegada (arrancarLlegada), con qué sale una tarjeta al confirmar (datosParaConfirmar), lo que se
 * conserva al recargar el contexto (contextoAlRecargar) y qué hace al recibir el foco o terminar un envío
 * (pasoDelReporte).
 */
import { isoBogota } from './fechas'
import { esPunto, haversineM, type Punto } from './geo'
import { catalogoDesdeContexto, cuentaDeCita, type Borrador, type Catalogo, type ExtrasCatalogo, type SedeOpcion } from './propuesta'
import type { CitaItem, ContextoResponse } from './tipos'

export interface Ubicacion {
  lat: number
  lng: number
  /** Precisión del GPS en metros (null si el teléfono no la da). */
  precision: number | null
  /** Instante en que se tomó (ISO con zona de Bogotá). */
  tomada_at: string
  /** Es la última posición conocida (no una lectura nueva). */
  aproximada: boolean
}

export interface ResultadoUbicacion {
  ubicacion: Ubicacion | null
  error: string | null
}

export const MENSAJE_SIN_PERMISO_UBICACION =
  'La app no tiene permiso de ubicación. Actívalo en los ajustes del teléfono para ver las sedes cercanas y reportar presencial.'
export const MENSAJE_SIN_UBICACION = 'No se pudo tomar la ubicación. Sal a un lugar abierto o revisa que el GPS esté encendido.'

/** Edad máxima de la última posición conocida (respaldo de la final y, en Reportar, la primera que se muestra). */
export const EDAD_MAXIMA_ULTIMA_MS = 120_000
/** Tiempo máximo para leer la última posición conocida (es una lectura del teléfono, no del GPS). */
export const TIEMPO_ULTIMA_MS = 2_000
/** Tiempo máximo por defecto de la lectura de alta precisión. */
export const TIEMPO_PRECISA_MS = 10_000
/** Si el punto final se aleja más que esto del primero, se vuelve a pedir el contexto (sedes cercanas). */
export const DISTANCIA_RECARGA_M = 100

/** Una lectura del teléfono (la forma de expo-location reducida a lo que se usa). */
export interface Lectura {
  lat: number
  lng: number
  /** Metros; null o undefined si el teléfono no la da. */
  precision?: number | null
  /** Milisegundos (época) de la lectura; null o 0 si no viene. */
  timestamp?: number | null
}

export interface FuentesUbicacion {
  /** Pide el permiso si hace falta; true si quedó concedido. */
  permiso: () => Promise<boolean>
  /** Una lectura nueva de alta precisión (puede tardar o no llegar nunca). */
  precisa: () => Promise<Lectura>
  /** Una lectura nueva de precisión media (wifi o antenas): llega en uno o dos segundos. Solo para mostrar. */
  rapida?: () => Promise<Lectura>
  /** La última lectura conocida de hace menos de `edadMaximaMs` (null si no hay). */
  ultima: (edadMaximaMs: number) => Promise<Lectura | null>
  /**
   * Las lecturas rápidas que tomó la propia app (ver registroDeRapidas). La lectura rápida queda en el caché del
   * sistema como "última conocida"; sin este registro, la final y "Crear sede aquí" la tomarían como respaldo cuando la
   * precisa no llega, y antes de los dos pasos ese caso terminaba sin punto. Así la regla de la final no cambia.
   */
  rapidasPropias?: RegistroDeRapidas
  /** Reloj (para las pruebas). */
  ahora?: () => number
}

/** Una promesa con tiempo máximo: null si no llega a tiempo o falla. */
export function conTiempo<T>(promesa: Promise<T>, ms: number): Promise<T | null> {
  return new Promise(resolve => {
    const temporizador = setTimeout(() => resolve(null), ms)
    promesa.then(
      valor => {
        clearTimeout(temporizador)
        resolve(valor)
      },
      () => {
        clearTimeout(temporizador)
        resolve(null)
      }
    )
  })
}

/** Lectura → Ubicacion (coordenadas con 6 decimales, precisión entera). null si las coordenadas no sirven. */
export function aUbicacion(lectura: Lectura | null | undefined, aproximada: boolean, ahoraMs: number = Date.now()): Ubicacion | null {
  if (!lectura || !esPunto(lectura.lat, lectura.lng)) return null
  const precision = lectura.precision
  return {
    lat: Math.round(lectura.lat * 1e6) / 1e6,
    lng: Math.round(lectura.lng * 1e6) / 1e6,
    precision: precision !== null && precision !== undefined && Number.isFinite(precision) ? Math.round(precision) : null,
    tomada_at: isoBogota(new Date(lectura.timestamp || ahoraMs)),
    aproximada,
  }
}

/** Registro de las lecturas rápidas que tomó la app (por su hora y coordenadas exactas). */
export interface RegistroDeRapidas {
  registrar: (lectura: Lectura) => void
  contiene: (lectura: Lectura) => boolean
}

/** Un registro en memoria con las últimas lecturas rápidas (las de más de 2 minutos ya no importan: no son "recientes"). */
export function registroDeRapidas(maximo = 10): RegistroDeRapidas {
  const lecturas: Lectura[] = []
  const igual = (a: Lectura, b: Lectura) => a.lat === b.lat && a.lng === b.lng && (a.timestamp ?? null) === (b.timestamp ?? null)
  return {
    registrar: lectura => {
      lecturas.push(lectura)
      if (lecturas.length > maximo) lecturas.splice(0, lecturas.length - maximo)
    },
    contiene: lectura => lecturas.some(propia => igual(propia, lectura)),
  }
}

/**
 * La última conocida si no pasa de EDAD_MAXIMA_ULTIMA_MS (se revisa aquí también: no todas las plataformas lo hacen).
 * `sinRapidasPropias`: para la final (y pedirUbicacion), no vale una lectura rápida que tomó la propia app.
 */
async function ultimaReciente(fuentes: FuentesUbicacion, opciones: { sinRapidasPropias?: boolean } = {}): Promise<Ubicacion | null> {
  const ahora = (fuentes.ahora ?? Date.now)()
  const lectura = await conTiempo(fuentes.ultima(EDAD_MAXIMA_ULTIMA_MS), TIEMPO_ULTIMA_MS)
  if (!lectura) return null
  if (lectura.timestamp && ahora - lectura.timestamp > EDAD_MAXIMA_ULTIMA_MS) return null
  if (opciones.sinRapidasPropias && fuentes.rapidasPropias?.contiene(lectura)) return null
  return aUbicacion(lectura, true, ahora)
}

/**
 * La ubicación que vale (la regla de siempre): pide el permiso, toma una lectura nueva de alta precisión con tiempo
 * máximo y, si no llega, usa la última conocida de hace menos de 2 minutos (marcada aproximada). Nunca lanza.
 */
export async function ubicacionFinal(
  fuentes: FuentesUbicacion,
  opciones: { timeoutMs?: number; permiso?: Promise<boolean> } = {}
): Promise<ResultadoUbicacion> {
  const timeoutMs = opciones.timeoutMs ?? TIEMPO_PRECISA_MS
  try {
    const concedido = await (opciones.permiso ?? fuentes.permiso())
    if (!concedido) return { ubicacion: null, error: MENSAJE_SIN_PERMISO_UBICACION }
    const nueva = aUbicacion(await conTiempo(fuentes.precisa(), timeoutMs), false, (fuentes.ahora ?? Date.now)())
    if (nueva) return { ubicacion: nueva, error: null }
    const ultima = await ultimaReciente(fuentes, { sinRapidasPropias: true })
    if (ultima) return { ubicacion: ultima, error: null }
    return { ubicacion: null, error: MENSAJE_SIN_UBICACION }
  } catch {
    return { ubicacion: null, error: MENSAJE_SIN_UBICACION }
  }
}

export interface UbicacionEnDosPasos {
  /** Lo primero que sirve para mostrar. `esFinal`: ya es la final (no hay nada que afinar). */
  primera: Promise<{ resultado: ResultadoUbicacion; esFinal: boolean }>
  /** La que vale para la visita (ubicacionFinal). */
  final: Promise<ResultadoUbicacion>
}

/** Las dos a la vez, con un solo pedido de permiso. Ninguna lanza. */
export function ubicacionEnDosPasos(fuentes: FuentesUbicacion, opciones: { timeoutMs?: number } = {}): UbicacionEnDosPasos {
  const timeoutMs = opciones.timeoutMs ?? TIEMPO_PRECISA_MS
  const permiso = fuentes.permiso()
  const final = ubicacionFinal(fuentes, { timeoutMs, permiso })
  const comoFinal = async () => ({ resultado: await final, esFinal: true })
  const primera = (async () => {
    try {
      if (!(await permiso)) return await comoFinal()
      const ultima = await ultimaReciente(fuentes)
      if (ultima) return { resultado: { ubicacion: ultima, error: null }, esFinal: false }
      if (!fuentes.rapida) return await comoFinal()
      // Se registra al llegar, aunque llegue después del tiempo máximo (igual queda en el caché del sistema).
      const pedida = fuentes.rapida().then(lectura => {
        fuentes.rapidasPropias?.registrar(lectura)
        return lectura
      })
      const rapida = conTiempo(pedida, timeoutMs).then(lectura => aUbicacion(lectura, false, (fuentes.ahora ?? Date.now)()))
      const gana = await Promise.race([final.then(resultado => ({ tipo: 'final' as const, resultado })), rapida.then(ubicacion => ({ tipo: 'rapida' as const, ubicacion }))])
      if (gana.tipo === 'rapida' && gana.ubicacion) return { resultado: { ubicacion: gana.ubicacion, error: null }, esFinal: false }
      return await comoFinal()
    } catch {
      return await comoFinal()
    }
  })()
  return { primera, final }
}

/** El punto (con su precisión) y la hora de llegada con que sale una visita. */
export interface LugarDeLaVisita {
  punto: (Punto & { precision: number | null }) | null
  llegada: string
}

/**
 * Con qué punto y hora de llegada sale una visita (o se crea el consultorio de Nuevo médico): NUNCA con la primera.
 * `final` es la promesa de la final de esta llegada (null si lo que muestra la pantalla ya es final: no hubo dos
 * pasos, o se tocó "Actualizar"): si aún no llega se espera; si ya llegó se usa ella, aunque la pantalla todavía no se
 * haya vuelto a pintar con ella. Sin punto en la final, la visita sale sin punto (solo telefónica) y con la llegada de
 * la pantalla.
 */
export async function lugarDeLaVisita(final: Promise<ResultadoUbicacion> | null, enPantalla: LugarDeLaVisita): Promise<LugarDeLaVisita> {
  if (!final) return enPantalla
  const { ubicacion } = await final
  if (!ubicacion) return { punto: null, llegada: enPantalla.llegada }
  return { punto: { lat: ubicacion.lat, lng: ubicacion.lng, precision: ubicacion.precision }, llegada: ubicacion.tomada_at }
}

/** ¿El punto final se alejó tanto del primero que las sedes cercanas pueden ser otras? */
export function debeRecargarContexto(primera: Punto | null | undefined, final: Punto | null | undefined): boolean {
  if (!final || !esPunto(final.lat, final.lng)) return false
  if (!primera || !esPunto(primera.lat, primera.lng)) return true
  return haversineM(primera, final) > DISTANCIA_RECARGA_M
}

/**
 * Al volver a pedir el contexto con el punto final: las sedes elegidas o puestas en una tarjeta que ya no vienen entre
 * las cercanas se conservan (como sedes de más, con sus coordenadas: la distancia se vuelve a medir con el punto
 * nuevo), para que la elección y las tarjetas no se queden sin su sede.
 */
export function sedesQueSeConservan<S extends { id: string }>(
  anteriores: readonly S[],
  nuevasIds: Iterable<string>,
  enUso: Iterable<string | null | undefined>
): S[] {
  const nuevas = new Set(nuevasIds)
  const usadas = new Set(Array.from(enUso).filter((id): id is string => typeof id === 'string' && id.length > 0))
  return anteriores.filter(sede => usadas.has(sede.id) && !nuevas.has(sede.id)).map(sede => ({ ...sede }))
}

/**
 * Lo mismo con los contactos: el contexto solo trae los de las cuentas de las sedes cercanas. Los de una cuenta que se
 * está usando (en una tarjeta, la de la sede elegida o la de la cita elegida) y que ya no vienen se conservan, para
 * que el contacto elegido siga siendo de su cuenta al confirmar.
 */
export function contactosQueSeConservan<C extends { id: string; cuenta_id: string }>(
  anteriores: readonly C[],
  nuevosIds: Iterable<string>,
  cuentasEnUso: Iterable<string | null | undefined>
): C[] {
  const nuevos = new Set(nuevosIds)
  const cuentas = new Set(Array.from(cuentasEnUso).filter((id): id is string => typeof id === 'string' && id.length > 0))
  return anteriores.filter(contacto => cuentas.has(contacto.cuenta_id) && !nuevos.has(contacto.id)).map(contacto => ({ ...contacto }))
}

// ---------------------------------------------------------------------------------------------
// Reportar con los dos pasos (puro: reportar.tsx solo aplica lo que esto devuelve)
// ---------------------------------------------------------------------------------------------

/** Lo que la pantalla aplica al recibir la primera ubicación. */
export interface EstadoConLaPrimera {
  ubicacion: Ubicacion | null
  error: string | null
  /** Instante de llegada: el de la primera lectura (o ahora, si no hay punto). */
  llegada: string
  /**
   * La final que Confirmar y Nuevo médico esperan (lugarDeLaVisita); null si la primera ya es la final. Mientras no
   * llegue, la pantalla dice "afinando la ubicación…".
   */
  finalPendiente: Promise<ResultadoUbicacion> | null
}

export function estadoConLaPrimera(
  primera: { resultado: ResultadoUbicacion; esFinal: boolean },
  final: Promise<ResultadoUbicacion>,
  ahoraIso: () => string = () => isoBogota()
): EstadoConLaPrimera {
  return {
    ubicacion: primera.resultado.ubicacion,
    error: primera.resultado.error,
    llegada: primera.resultado.ubicacion?.tomada_at ?? ahoraIso(),
    finalPendiente: primera.esFinal ? null : final,
  }
}

/**
 * El arranque de una llegada en Reportar, en este orden:
 *   1. espera la primera ubicación y entrega su estado CON la final pendiente (`conLaPrimera`): desde ese momento
 *      Confirmar y Nuevo médico esperan la final, antes de que la lista se pueda tocar;
 *   2. pide el contexto con la primera (`cargar`);
 *   3. con el contexto ya en uso, afina con la final (`afinar`; va después para que el contexto pedido con la primera
 *      no llegue tarde y pise el que se pidió con la final).
 * Reportar muestra la lista solo cuando esto resuelve. Devuelve null (y no aplica nada más) si otra llegada empezó
 * mientras tanto (`vigente` da false).
 */
export async function arrancarLlegada<T>(
  pasos: UbicacionEnDosPasos,
  efectos: {
    vigente: () => boolean
    conLaPrimera: (estado: EstadoConLaPrimera) => void
    cargar: (ubicacion: Ubicacion | null) => Promise<T>
    afinar: (final: Promise<ResultadoUbicacion>, primera: Ubicacion | null) => void
    ahoraIso?: () => string
  }
): Promise<{ primera: EstadoConLaPrimera; cargado: T } | null> {
  const primera = estadoConLaPrimera(await pasos.primera, pasos.final, efectos.ahoraIso)
  if (!efectos.vigente()) return null
  efectos.conLaPrimera(primera)
  const cargado = await efectos.cargar(primera.ubicacion)
  if (!efectos.vigente()) return null
  if (primera.finalPendiente) efectos.afinar(primera.finalPendiente, primera.ubicacion)
  return { primera, cargado }
}

/**
 * ¿La pantalla sigue "afinando la ubicación…"? Solo si la final que se espera es la de la generación de ahora (cada
 * llegada o "Actualizar" es una generación): cuando empieza otra, el aviso no se queda pegado aunque la final vieja
 * llegue tarde o nunca (y "Actualizar" vuelve a aparecer).
 */
export function estaAfinando(afinandoDe: number | null, generacionActual: number): boolean {
  return afinandoDe !== null && afinandoDe === generacionActual
}

/** Lo último de Reportar (su `ultimo.current`): lo que se lee DESPUÉS de esperar, nunca lo que había al tocar. */
export interface EstadoDelReporte {
  contexto: ContextoResponse | null
  /** El punto con que se pidió ese contexto (null: sin punto, o el guardado sin señal). */
  puntoContexto: Punto | null
  extras: ExtrasCatalogo
  sinSenal: boolean
  catalogo: Catalogo | null
  sedeElegida: string | null
  /** La cita elegida en el paso 1 (o null). */
  cita: CitaItem | null
  /** Las tarjetas abiertas, como están ahora. */
  tarjetas: readonly Borrador[]
}

/** Con qué se valida y se manda una tarjeta. */
export interface DatosDeConfirmacion {
  punto: (Punto & { precision: number | null }) | null
  llegada: string
  catalogo: Catalogo
  borrador: Borrador
}

/**
 * Con qué sale una tarjeta al tocar Confirmar:
 *   - sin final pendiente (`final` null: no hubo dos pasos, o se tocó "Actualizar"): lo de la pantalla;
 *   - con final pendiente: la espera (lugarDeLaVisita: nunca la primera). Si mientras tanto empezó otra generación
 *     (otra llegada o "Actualizar") o la tarjeta ya no está, null: no se manda. Si no, la final y su hora, el catálogo
 *     armado con lo de AHORA (`ultimo`: el contexto pudo recargarse con la final) medido desde la final, y la tarjeta
 *     como quedó.
 * Lee `generacion.current` al llamarla (el toque) y otra vez después de esperar.
 */
export async function datosParaConfirmar(entrada: {
  clave: string
  final: Promise<ResultadoUbicacion> | null
  enPantalla: DatosDeConfirmacion
  generacion: { readonly current: number }
  ultimo: { readonly current: EstadoDelReporte }
}): Promise<DatosDeConfirmacion | null> {
  const { clave, final, enPantalla, generacion, ultimo } = entrada
  if (!final) return enPantalla
  const alTocar = generacion.current
  const lugar = await lugarDeLaVisita(final, { punto: enPantalla.punto, llegada: enPantalla.llegada })
  if (generacion.current !== alTocar) return null
  const ahora = ultimo.current
  const borrador = ahora.tarjetas.find(b => b.clave === clave)
  if (!borrador) return null
  const catalogo = ahora.contexto
    ? catalogoDesdeContexto(ahora.contexto, ahora.extras, lugar.punto, {
        sinSenal: ahora.sinSenal,
        distanciasDeOtroPunto: debeRecargarContexto(ahora.puntoContexto, lugar.punto),
      })
    : enPantalla.catalogo
  return { punto: lugar.punto, llegada: lugar.llegada, catalogo, borrador }
}

function soloIds(ids: readonly (string | null | undefined)[]): string[] {
  return Array.from(new Set(ids.filter((id): id is string => typeof id === 'string' && id.length > 0)))
}

/**
 * Las sedes y las cuentas en uso al recargar el contexto: la sede elegida (y su cuenta), la cita elegida (su sede y su
 * cuenta: "Por toques" con la cita sugiere un contacto de esa cuenta) y las de las tarjetas abiertas.
 */
export function enUsoAlRecargar(estado: Pick<EstadoDelReporte, 'catalogo' | 'sedeElegida' | 'cita' | 'tarjetas'>): { sedes: string[]; cuentas: string[] } {
  const sedeElegida = estado.sedeElegida ? (estado.catalogo?.sedes.find(s => s.id === estado.sedeElegida) ?? null) : null
  return {
    sedes: soloIds([estado.sedeElegida, estado.cita?.sede.id, ...estado.tarjetas.map(b => b.sede_id)]),
    cuentas: soloIds([...estado.tarjetas.map(b => b.cuenta_id), sedeElegida?.cuenta_id, estado.cita ? cuentaDeCita(estado.cita) : null]),
  }
}

/**
 * Al volver a pedir el contexto con la final: el contexto nuevo con los contactos de las cuentas en uso que ya no
 * vienen, y las sedes en uso que ya no vienen (Reportar las suma a sus sedes de más). Ver enUsoAlRecargar.
 */
export function contextoAlRecargar(
  anterior: Pick<EstadoDelReporte, 'contexto' | 'catalogo' | 'sedeElegida' | 'cita' | 'tarjetas'>,
  nuevo: ContextoResponse
): { contexto: ContextoResponse; sedes: SedeOpcion[] } {
  const enUso = enUsoAlRecargar(anterior)
  // Las que traerá el catálogo nuevo: las cercanas y las de las citas no canceladas (como catalogoDesdeContexto).
  const nuevas = [...nuevo.sedes_cerca.map(s => s.id), ...(nuevo.agenda_hoy ?? []).filter(c => c.estado !== 'cancelada').map(c => c.sede.id)]
  const sedes = sedesQueSeConservan(anterior.catalogo?.sedes ?? [], nuevas, enUso.sedes)
  const contactos = contactosQueSeConservan(anterior.contexto?.contactos ?? [], nuevo.contactos.map(c => c.id), enUso.cuentas)
  return { contexto: contactos.length > 0 ? { ...nuevo, contactos: [...nuevo.contactos, ...contactos] } : nuevo, sedes }
}

export type PasoDelReporte<R> = { accion: 'iniciar'; reintento: R | null } | { accion: 'aplazar'; reintento: R } | { accion: 'seguir' }

/**
 * Qué hace Reportar al recibir el foco (`motivo: 'foco'`) o al terminar de enviar una tarjeta (`'envio'`). Regla: no
 * empieza una llegada nueva (que borra las tarjetas) mientras alguna tarjeta se está enviando (esperando la final o la
 * respuesta de la cola): si no, la confirmación quedaría sin efecto y la visita confirmada se perdería sin aviso.
 *   - La primera vez que recibe el foco: iniciar (con el reintento, si lo hay).
 *   - Alguna tarjeta enviándose: el "Reportar de nuevo" que pidió Hoy se aplaza (Reportar lo guarda con
 *     fijarReintento; la visita sigue en la cola, en Hoy); sin reintento, seguir.
 *   - Al recibir el foco con reintento: iniciar con él (como siempre, aunque esté grabando o haya tarjetas abiertas: la
 *     persona fue a Hoy y lo pidió).
 *   - Al terminar el último envío con un reintento aplazado: iniciar con él solo si no se pierde nada, es decir, si no
 *     está grabando ni armando la propuesta y no queda ninguna tarjeta abierta (`abiertas`: la que el servidor acaba
 *     de rechazar sigue abierta con su rechazo y ya no está en la cola; otra sin confirmar, dictada o por toques). Si
 *     no, se aplaza otra vez: lo toma el siguiente envío que termine sin nada abierto, o la próxima vez que Reportar
 *     reciba el foco (lo que pase primero).
 *   - Al recibir el foco sin reintento: iniciar si `reiniciar` (debeReiniciarReporte); si no, seguir.
 */
export function pasoDelReporte<R>(estado: {
  motivo: 'foco' | 'envio'
  /** Ya hubo una llegada (false solo la primera vez que recibe el foco). */
  iniciado: boolean
  /** "Reportar de nuevo" pedido desde Hoy (tomarReintento), o null. */
  reintento: R | null
  /** Tarjetas que se están enviando. */
  enviando: number
  /** Ubicando, grabando, transcribiendo o armando la propuesta. */
  ocupada: boolean
  /** Tarjetas abiertas (sin guardar) al terminar el envío: abiertasAlTerminarEnvio. Solo cuenta en 'envio'. */
  abiertas: number
  /** debeReiniciarReporte (solo cuenta al recibir el foco sin reintento). */
  reiniciar: boolean
}): PasoDelReporte<R> {
  const { motivo, iniciado, reintento, enviando, ocupada, abiertas, reiniciar } = estado
  if (!iniciado) return { accion: 'iniciar', reintento }
  if (enviando > 0) return reintento ? { accion: 'aplazar', reintento } : { accion: 'seguir' }
  if (reintento) return motivo === 'envio' && (ocupada || abiertas > 0) ? { accion: 'aplazar', reintento } : { accion: 'iniciar', reintento }
  if (motivo === 'foco' && reiniciar) return { accion: 'iniciar', reintento: null }
  return { accion: 'seguir' }
}

/**
 * Las tarjetas que quedan abiertas al terminar un envío (para pasoDelReporte). `tarjetas` es lo último que pintó la
 * pantalla, que todavía incluye la que se acaba de guardar (su setBorradores aún no se aplica): esa no cuenta
 * (`guardada`: su clave, o null si no se guardó). Una que el servidor rechazó, que no pasó la validación o que falló
 * al enviar sigue abierta y cuenta.
 */
export function abiertasAlTerminarEnvio(tarjetas: readonly { clave: string }[], guardada: string | null): number {
  return tarjetas.filter(b => b.clave !== guardada).length
}
