// Tiempos de /api/me/* (spec docs/specs/2026-10-15-usabilidad-y-agenda-con-hora.md, "Medición" y paquete 4): cada ruta
// mide sus fases (auth, contexto, Claude…) con un cronómetro, responde la cabecera `Server-Timing` (aditiva: el cuerpo
// no cambia) y deja UNA línea `[tiempos]` en el log, que se lee con `vercel logs`:
//
//   [tiempos] POST /api/me/contexto auth=12 ctx=340 total=380 frio=1
//
// La línea lleva SOLO el patrón de la ruta (los ids se cambian por ":id") y números: nunca ids, textos, coordenadas ni
// nada de lo que mandó la persona. `frio=1` sale solo en la primera petición de la instancia (arranque en frío). Lo que
// no es 2xx lleva además `estado=NNN`. Los datos opcionales (p. ej. el `usage` de Claude) también son solo números.
// Puro: sin Supabase ni Next (lo prueba scripts/tiempos-check.ts con un reloj falso).

/** Lo mínimo de una respuesta que el cronómetro toca (NextResponse y Response lo cumplen). */
interface RespuestaConCabeceras {
  status: number
  headers: { set(nombre: string, valor: string): void }
}

export interface OpcionesCronometro {
  /** Milisegundos (monótono). Por defecto performance.now(). */
  reloj?: () => number
  /** A dónde va la línea. Por defecto console.info. */
  registrar?: (linea: string) => void
}

export interface Cronometro {
  /** Corre el trabajo y suma su duración a la fase `nombre`, también cuando falla (la falla se propaga). */
  fase<T>(nombre: string, trabajo: () => PromiseLike<T> | T): Promise<T>
  /** Un número para la línea (p. ej. claude_in=5123). Se suma si se repite. Lo que no es un número finito se ignora. */
  dato(nombre: string, valor: number | null | undefined): void
  /** La cabecera Server-Timing: "auth;dur=12, ctx;dur=340, total;dur=380". */
  cabecera(): string
  /** La línea del log: "[tiempos] POST /api/me/contexto auth=12 ctx=340 total=380 frio=1". */
  linea(estado?: number): string
  /** Pone la cabecera en la respuesta, deja la línea en el log (una sola vez) y devuelve la misma respuesta. */
  terminar<R extends RespuestaConCabeceras>(respuesta: R): R
}

/** Nombre de una fase o de un dato: minúsculas, dígitos y "_" (token válido de Server-Timing y sin contenido). */
const NOMBRE_VALIDO = /^[a-z][a-z0-9_]{0,23}$/
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi

/**
 * El patrón de la ruta tal como va al log: método y ruta, con cualquier uuid cambiado por ":id", sin consulta y solo con
 * letras, dígitos, "/", ":", "_", "-", "[" y "]". 'PATCH /api/me/visitas/<uuid>' → 'PATCH /api/me/visitas/:id'.
 */
export function patronDeRuta(ruta: string): string {
  const sinConsulta = ruta.split('?')[0] ?? ''
  return sinConsulta
    .replace(UUID, ':id')
    .replace(/[^A-Za-z0-9 /:_\-[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}

function relojPorDefecto(): number {
  const rendimiento = (globalThis as { performance?: { now?: () => number } }).performance
  return typeof rendimiento?.now === 'function' ? rendimiento.now() : Date.now()
}

function registrarPorDefecto(linea: string): void {
  console.info(linea)
}

/** La primera petición de esta instancia (módulo recién cargado) es "en frío". */
let instanciaFria = true

/** Solo para las pruebas: la próxima petición vuelve a contar como la primera de la instancia. */
export function reiniciarInstanciaTiempos(): void {
  instanciaFria = true
}

const ms = (valor: number) => Math.max(0, Math.round(valor))

export function cronometro(ruta: string, opciones: OpcionesCronometro = {}): Cronometro {
  const reloj = opciones.reloj ?? relojPorDefecto
  const registrar = opciones.registrar ?? registrarPorDefecto
  const patron = patronDeRuta(ruta)
  const inicio = reloj()
  const frio = instanciaFria
  instanciaFria = false
  const fases = new Map<string, number>()
  const datos = new Map<string, number>()
  let total: number | null = null
  let terminado = false

  const sumarFase = (nombre: string, duracion: number) => {
    if (!NOMBRE_VALIDO.test(nombre) || nombre === 'total' || !Number.isFinite(duracion)) return
    fases.set(nombre, (fases.get(nombre) ?? 0) + duracion)
  }
  const totalAhora = () => (total ?? reloj() - inicio)

  const yo: Cronometro = {
    async fase<T>(nombre: string, trabajo: () => PromiseLike<T> | T): Promise<T> {
      const desde = reloj()
      try {
        return await trabajo()
      } finally {
        sumarFase(nombre, reloj() - desde)
      }
    },
    dato(nombre, valor) {
      if (!NOMBRE_VALIDO.test(nombre) || nombre === 'total' || nombre === 'frio' || nombre === 'estado') return
      if (typeof valor !== 'number' || !Number.isFinite(valor)) return
      datos.set(nombre, (datos.get(nombre) ?? 0) + valor)
    },
    cabecera() {
      const partes = Array.from(fases.entries()).map(([nombre, duracion]) => `${nombre};dur=${ms(duracion)}`)
      partes.push(`total;dur=${ms(totalAhora())}`)
      return partes.join(', ')
    },
    linea(estado) {
      const partes = [`[tiempos] ${patron}`]
      for (const [nombre, duracion] of fases) partes.push(`${nombre}=${ms(duracion)}`)
      partes.push(`total=${ms(totalAhora())}`)
      for (const [nombre, valor] of datos) partes.push(`${nombre}=${Math.round(valor)}`)
      if (typeof estado === 'number' && Number.isInteger(estado) && (estado < 200 || estado > 299)) partes.push(`estado=${estado}`)
      if (frio) partes.push('frio=1')
      return partes.join(' ')
    },
    terminar(respuesta) {
      if (total === null) total = reloj() - inicio
      try {
        respuesta.headers.set('Server-Timing', yo.cabecera())
      } catch {
        // una respuesta con cabeceras inmutables sale sin Server-Timing
      }
      if (!terminado) {
        terminado = true
        try {
          registrar(yo.linea(respuesta.status))
        } catch {
          // el registro nunca rompe la respuesta
        }
      }
      return respuesta
    },
  }
  return yo
}

/**
 * Mide una ruta completa: crea el cronómetro, corre el manejador y termina con su respuesta (cabecera + línea). Si el
 * manejador lanza, deja la línea con estado=500 y relanza (Next responde 500 como antes).
 */
export async function medirRuta<R extends RespuestaConCabeceras>(
  ruta: string,
  manejar: (t: Cronometro) => Promise<R>,
  opciones?: OpcionesCronometro
): Promise<R> {
  const t = cronometro(ruta, opciones)
  let respuesta: R
  try {
    respuesta = await manejar(t)
  } catch (error) {
    t.terminar({ status: 500, headers: { set() {} } })
    throw error
  }
  return t.terminar(respuesta)
}

/** Lo que se registra del `usage` de Claude: solo números (tokens de entrada, de salida, leídos de caché y llamadas). */
export interface UsoClaude {
  entrada: number
  salida: number
  cache_leida: number
  llamadas: number
}

/** Suma el `usage` de una respuesta de Claude (lo que no es número cuenta 0). */
export function sumarUsoClaude(previo: UsoClaude | null, usage: unknown): UsoClaude {
  const u = usage && typeof usage === 'object' ? (usage as Record<string, unknown>) : {}
  const num = (valor: unknown) => (typeof valor === 'number' && Number.isFinite(valor) ? valor : 0)
  return {
    entrada: (previo?.entrada ?? 0) + num(u.input_tokens),
    salida: (previo?.salida ?? 0) + num(u.output_tokens),
    cache_leida: (previo?.cache_leida ?? 0) + num(u.cache_read_input_tokens),
    llamadas: (previo?.llamadas ?? 0) + 1,
  }
}

/** Deja el uso de Claude en la línea: claude_in, claude_out, claude_cache y claude_n. */
export function anotarUsoClaude(t: Pick<Cronometro, 'dato'>, uso: UsoClaude | null): void {
  if (!uso) return
  t.dato('claude_in', uso.entrada)
  t.dato('claude_out', uso.salida)
  t.dato('claude_cache', uso.cache_leida)
  t.dato('claude_n', uso.llamadas)
}
