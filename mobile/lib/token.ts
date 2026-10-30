/**
 * Lectura (sin verificar: eso lo hace el servidor) de la carga del token de sesión que firma web/lib/session.ts:
 * "<base64url(JSON { uid, pv, iat, exp })>.<firma>". La app solo la usa para saber de quién es la cola sin
 * señal y cuándo vence, aun sin conexión. Y MemoriaToken: el token en memoria, para no leer el llavero en cada
 * petición (spec 2026-10-15, paquete 4). Puro: lo prueban scripts/movil-check.ts y scripts/checks/18-tiempos.ts.
 */

export interface CargaToken {
  uid: string
  /** Vencimiento en segundos desde 1970 (UTC). */
  exp: number | null
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/** base64url → texto UTF-8, sin depender de atob ni Buffer. null si no es válido. */
export function decodificarBase64Url(entrada: string): string | null {
  const limpio = entrada.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '')
  if (/[^A-Za-z0-9+/]/.test(limpio) || limpio.length % 4 === 1) return null
  const bytes: number[] = []
  let acumulado = 0
  let bits = 0
  for (const caracter of limpio) {
    acumulado = (acumulado << 6) | B64.indexOf(caracter)
    bits += 6
    if (bits >= 8) {
      bits -= 8
      bytes.push((acumulado >> bits) & 0xff)
    }
  }
  try {
    // UTF-8 → texto
    return decodeURIComponent(bytes.map(b => `%${b.toString(16).padStart(2, '0')}`).join(''))
  } catch {
    return null
  }
}

export function leerCargaToken(token: string | null | undefined): CargaToken | null {
  if (!token) return null
  const partes = token.split('.')
  if (partes.length !== 2 || !partes[0]) return null
  const texto = decodificarBase64Url(partes[0])
  if (!texto) return null
  try {
    const datos = JSON.parse(texto) as { uid?: unknown; exp?: unknown }
    if (typeof datos.uid !== 'string' || !datos.uid) return null
    return { uid: datos.uid, exp: typeof datos.exp === 'number' && Number.isFinite(datos.exp) ? datos.exp : null }
  } catch {
    return null
  }
}

/** ¿El token ya venció (según su exp)? Sin exp legible → false (que decida el servidor). */
export function tokenVencido(token: string | null | undefined, ahora: Date = new Date()): boolean {
  const carga = leerCargaToken(token)
  if (!carga || carga.exp === null) return false
  return carga.exp * 1000 <= ahora.getTime()
}

// --- Token en memoria ----------------------------------------------------------------------------------------

/** El almacén seguro del teléfono (Keychain / Keystore; localStorage en el navegador), inyectado. */
export interface LlaveroToken {
  leer(): Promise<string | null>
  guardar(token: string): Promise<void>
  borrar(): Promise<void>
}

/**
 * El token de sesión en memoria: el llavero se lee UNA sola vez (aunque lo pidan varias peticiones a la vez); guardar y
 * borrar actualizan la memoria y el llavero; un 401 la borra (olvidarSiEs) para que ninguna petición siguiente lo
 * mande. Si el llavero falla al leer, cuenta como sin sesión (null), como antes.
 */
export class MemoriaToken {
  /** undefined: aún no se leyó el llavero. */
  private valor: string | null | undefined = undefined
  private lectura: Promise<string | null> | null = null

  constructor(private readonly llavero: LlaveroToken) {}

  leer(): Promise<string | null> {
    if (this.valor !== undefined) return Promise.resolve(this.valor)
    if (!this.lectura) {
      this.lectura = this.llavero
        .leer()
        .catch(() => null)
        .then(token => {
          this.lectura = null
          // Si mientras se leía se guardó, se borró o llegó un 401, manda eso: la lectura tardía no lo pisa.
          if (this.valor === undefined) this.valor = token || null
          return this.valor
        })
    }
    return this.lectura
  }

  /** Guarda en el llavero y, si salió bien, en memoria (si el llavero falla, lanza como antes). */
  async guardar(token: string): Promise<void> {
    await this.llavero.guardar(token)
    this.valor = token
    this.lectura = null
  }

  /** Olvida en memoria al instante y borra del llavero (nunca lanza). */
  async borrar(): Promise<void> {
    this.valor = null
    this.lectura = null
    try {
      await this.llavero.borrar()
    } catch {
      // en memoria ya no está
    }
  }

  /**
   * Otra pestaña del navegador cambió el token (evento storage): lo de memoria ya no vale y la próxima lectura vuelve al
   * llavero (revisión 2026-10-30). Devuelve el que había en memoria (undefined si aún no se había leído: entonces no
   * toca la lectura en curso).
   */
  releer(): string | null | undefined {
    const anterior = this.valor
    if (anterior !== undefined) {
      this.valor = undefined
      this.lectura = null
    }
    return anterior
  }

  /** Un 401 con este token: se olvida en memoria (si sigue siendo el de ahora). El llavero lo borra la sesión. */
  olvidarSiEs(token: string | null | undefined): void {
    if (!token || this.valor !== token) return
    this.valor = null
    this.lectura = null
  }
}
