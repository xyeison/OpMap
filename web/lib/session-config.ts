// Configuración compartida de la sesión firmada.
// Este módulo NO importa nada de Node ni de WebCrypto: lo usan tanto lib/session.ts
// (runtime Node, rutas API) como lib/session-edge.ts (runtime Edge, middleware).

// Nombre de la cookie. En producción se usa el prefijo __Host-: el navegador solo la acepta si
// lleva Secure, Path=/ y ningún Domain (no la puede fijar un subdominio ni un sitio HTTP).
// En desarrollo (http://localhost, sin Secure) el prefijo haría que el navegador la rechazara.
export const SESSION_COOKIE_NAME_PRODUCTION = '__Host-opmap_session'
export const SESSION_COOKIE_NAME_DEVELOPMENT = 'opmap_session'

export const SESSION_COOKIE_NAME =
  process.env.NODE_ENV === 'production' ? SESSION_COOKIE_NAME_PRODUCTION : SESSION_COOKIE_NAME_DEVELOPMENT

// Todos los nombres posibles (logout los borra todos)
export const ALL_SESSION_COOKIE_NAMES = [SESSION_COOKIE_NAME_PRODUCTION, SESSION_COOKIE_NAME_DEVELOPMENT] as const

// Duración de la sesión: 7 días (cookie maxAge y exp del payload)
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7

// Longitud máxima aceptada para un token (evita trabajo inútil con cookies gigantes)
export const SESSION_TOKEN_MAX_LENGTH = 1024

// Tolerancia de reloj para el iat (segundos)
const CLOCK_SKEW_SECONDS = 300

const MIN_SECRET_LENGTH = 32

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const BASE64URL_RE = /^[A-Za-z0-9_-]+$/

// Claim pv ("password version"): 16 hex derivados del hash de users.password (ver
// passwordVersion en lib/session.ts). Al cambiar la contraseña cambia el pv y las sesiones
// anteriores dejan de valer en las rutas API (revocación sin DDL). Los tokens sin pv
// (emitidos antes de este cambio) se rechazan: obliga a iniciar sesión de nuevo una vez.
export const PASSWORD_VERSION_RE = /^[0-9a-f]{16}$/

export interface SessionPayload {
  uid: string
  pv: string
  iat: number
  exp: number
  // Empresa activa al firmar (uuid). Solo una caché: manda users.empresa_activa_id (lib/empresas.ts). Los tokens
  // firmados antes de las empresas no lo traen y siguen valiendo.
  emp: string | null
}

let devFallbackWarned = false

/**
 * Devuelve el secreto HMAC de la sesión.
 * - Producción (NODE_ENV=production, incluye Preview en Vercel): SESSION_SECRET es obligatorio;
 *   si falta o es demasiado corto se lanza un error (fail closed: nadie puede iniciar sesión
 *   ni pasar la verificación).
 * - Desarrollo: si falta, se usa un secreto derivado de SUPABASE_SERVICE_ROLE_KEY con un aviso.
 */
export function getSessionSecret(): string {
  const isProduction = process.env.NODE_ENV === 'production'
  const secret = process.env.SESSION_SECRET

  if (secret) {
    if (secret.length < MIN_SECRET_LENGTH) {
      if (isProduction) {
        throw new Error(`SESSION_SECRET demasiado corto (mínimo ${MIN_SECRET_LENGTH} caracteres)`)
      }
      console.warn(`[session] SESSION_SECRET tiene menos de ${MIN_SECRET_LENGTH} caracteres; genera uno con: openssl rand -base64 48`)
    }
    return secret
  }

  if (isProduction) {
    throw new Error('SESSION_SECRET no configurada')
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    throw new Error('SESSION_SECRET no configurada (y no hay SUPABASE_SERVICE_ROLE_KEY para el secreto de desarrollo)')
  }

  if (!devFallbackWarned) {
    devFallbackWarned = true
    console.warn('[session] SESSION_SECRET no configurada: usando un secreto derivado de SUPABASE_SERVICE_ROLE_KEY (solo desarrollo)')
  }

  return `opmap-dev-session:${serviceKey}`
}

/**
 * Valida el JSON del payload ya autenticado por la firma.
 * Devuelve null si la estructura no es la esperada o si la sesión expiró.
 */
export function parseSessionPayload(json: string, nowSeconds: number): SessionPayload | null {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    return null
  }

  if (!data || typeof data !== 'object') return null
  const { uid, pv, iat, exp, emp } = data as Record<string, unknown>

  if (typeof uid !== 'string' || !UUID_RE.test(uid)) return null
  if (typeof pv !== 'string' || !PASSWORD_VERSION_RE.test(pv)) return null
  if (typeof iat !== 'number' || !Number.isFinite(iat)) return null
  if (typeof exp !== 'number' || !Number.isFinite(exp)) return null

  // Expirada
  if (exp <= nowSeconds) return null
  // Emitida en el futuro (más allá de la tolerancia de reloj)
  if (iat > nowSeconds + CLOCK_SKEW_SECONDS) return null
  // Nunca aceptar una vigencia mayor que la configurada
  if (exp - iat > SESSION_MAX_AGE_SECONDS) return null

  // emp es opcional: si falta o no es un uuid se ignora (la empresa la decide la base, no el token)
  return { uid, pv, iat, exp, emp: typeof emp === 'string' && UUID_RE.test(emp) ? emp : null }
}
