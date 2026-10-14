/**
 * Lectura (sin verificar: eso lo hace el servidor) de la carga del token de sesión que firma web/lib/session.ts:
 * "<base64url(JSON { uid, pv, iat, exp })>.<firma>". La app solo la usa para saber de quién es la cola sin
 * señal y cuándo vence, aun sin conexión. Puro: lo prueba scripts/movil-check.ts.
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
