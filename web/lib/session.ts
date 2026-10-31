// Sesión firmada con HMAC-SHA256 (runtime Node: rutas API y server components).
// Formato del token: base64url(JSON{uid,pv,iat,exp[,emp]}) + "." + base64url(HMAC-SHA256(primera parte)).
// La verificación equivalente para el middleware (Edge runtime) está en lib/session-edge.ts
// (esa NO valida pv; el pv lo valida getUserFromRequest en lib/auth-server.ts).
import { createHmac, timingSafeEqual } from 'crypto'
import {
  ALL_SESSION_COOKIE_NAMES,
  BASE64URL_RE,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  SESSION_TOKEN_MAX_LENGTH,
  UUID_RE,
  getSessionSecret,
  parseSessionPayload,
  type SessionPayload,
} from './session-config'

export { ALL_SESSION_COOKIE_NAMES, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS }

function toBase64Url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url')
}

function sign(data: string, secret: string): string {
  return toBase64Url(createHmac('sha256', secret).update(data).digest())
}

/**
 * "Versión" de la contraseña para el claim pv: primeros 16 hex de un SHA-256 del valor guardado
 * en users.password (hash bcrypt, o texto plano heredado antes de la migración perezosa).
 * Se usa HMAC-SHA256 con SESSION_SECRET en lugar de un SHA-256 desnudo porque el payload de la
 * cookie se puede leer (solo está firmado): con una contraseña heredada en texto plano, un
 * SHA-256 sin clave dejaría en la cookie una huella crackeable offline.
 */
export function passwordVersion(storedPassword: string): string {
  const secret = getSessionSecret()
  return createHmac('sha256', secret).update(`opmap-pv:${storedPassword}`).digest('hex').slice(0, 16)
}

/**
 * Compara dos pv en tiempo constante.
 */
export function passwordVersionMatches(expected: string, given: string): boolean {
  const a = Buffer.from(expected)
  const b = Buffer.from(given)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * Firma una sesión para el usuario indicado. `pv` es passwordVersion(users.password) con el
 * hash definitivo (después de la migración perezosa a bcrypt, si la hubo). `emp` es la empresa activa
 * (caché; manda users.empresa_activa_id): solo entra al payload si es un uuid.
 * Lanza si falta SESSION_SECRET en producción.
 */
export function signSession(uid: string, pv: string, emp?: string | null): string {
  const secret = getSessionSecret()
  const iat = Math.floor(Date.now() / 1000)
  const payload: Record<string, unknown> = { uid, pv, iat, exp: iat + SESSION_MAX_AGE_SECONDS }
  if (typeof emp === 'string' && UUID_RE.test(emp)) payload.emp = emp
  const body = toBase64Url(JSON.stringify(payload))
  return `${body}.${sign(body, secret)}`
}

/**
 * Verifica firma (comparación en tiempo constante) y expiración.
 * Devuelve { uid, pv, emp } o null (emp null si el token no lo trae); quien llama debe comparar pv con el de la BD.
 * Lanza si falta SESSION_SECRET en producción (fail closed).
 */
export function verifySession(token: string | null | undefined): { uid: string; pv: string; emp: string | null } | null {
  const payload = payloadVerificado(token)
  return payload ? { uid: payload.uid, pv: payload.pv, emp: payload.emp } : null
}

/**
 * Vuelve a firmar una sesión válida con otra empresa activa: mismo uid, mismo pv y la MISMA expiración (cambiar de
 * empresa o pasar la sesión a la app no la alarga). `emp` null o no uuid → sin claim. null si el token no es válido.
 * Devuelve el token nuevo y su exp (segundos Unix), para la cookie (maxAge) o para el expira_at de la app.
 */
export function refirmarSesion(token: string | null | undefined, emp: string | null): { token: string; exp: number } | null {
  const payload = payloadVerificado(token)
  if (!payload) return null
  const secret = getSessionSecret()
  const iat = Math.floor(Date.now() / 1000)
  const exp = Math.min(payload.exp, iat + SESSION_MAX_AGE_SECONDS)
  const nuevo: Record<string, unknown> = { uid: payload.uid, pv: payload.pv, iat, exp }
  if (typeof emp === 'string' && UUID_RE.test(emp)) nuevo.emp = emp
  const body = toBase64Url(JSON.stringify(nuevo))
  return { token: `${body}.${sign(body, secret)}`, exp }
}

/** Firma (en tiempo constante) y expiración; el payload completo o null. */
function payloadVerificado(token: string | null | undefined): SessionPayload | null {
  if (!token || token.length > SESSION_TOKEN_MAX_LENGTH) return null

  const secret = getSessionSecret()

  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [body, signature] = parts
  if (!body || !signature || !BASE64URL_RE.test(body) || !BASE64URL_RE.test(signature)) return null

  const expected = Buffer.from(sign(body, secret))
  const given = Buffer.from(signature)
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null

  const json = Buffer.from(body, 'base64url').toString('utf8')
  return parseSessionPayload(json, Math.floor(Date.now() / 1000))
}

/**
 * Opciones de la cookie de sesión. Con maxAge = 0 sirve para borrarla.
 * En producción Secure + Path=/ y sin Domain: requisitos del prefijo __Host-.
 * `forceSecure` permite borrar la cookie __Host- también fuera de producción.
 */
export function sessionCookieOptions(maxAge: number = SESSION_MAX_AGE_SECONDS, forceSecure = false) {
  return {
    httpOnly: true,
    secure: forceSecure || process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  }
}
