// Hash y verificación de contraseñas con bcryptjs (solo servidor).
import bcrypt from 'bcryptjs'
import { createHash, timingSafeEqual } from 'crypto'

export const BCRYPT_COST = 12
export const PASSWORD_MIN_LENGTH = 6
// bcrypt solo usa los primeros 72 bytes: rechazamos contraseñas más largas al crearlas/cambiarlas
export const PASSWORD_MAX_BYTES = 72

// Hash de una contraseña aleatoria descartada; se compara contra él cuando el usuario no existe
// para que la respuesta tarde lo mismo (no revela si el email está registrado).
const DUMMY_HASH = '$2b$12$C0pPvPi0qap0L/NZwCWZxu5tl0EmawfVBocr.i4UqvT.cl747aL4G'

const BCRYPT_HASH_RE = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/

export function isBcryptHash(value: unknown): boolean {
  return typeof value === 'string' && value.length === 60 && BCRYPT_HASH_RE.test(value)
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST)
}

/**
 * Valida una contraseña nueva. Devuelve el mensaje de error o null si es válida.
 */
export function validateNewPassword(password: unknown): string | null {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
    return `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`
  }
  if (Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) {
    return `La contraseña no puede superar ${PASSWORD_MAX_BYTES} bytes`
  }
  return null
}

function constantTimeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a, 'utf8').digest()
  const hb = createHash('sha256').update(b, 'utf8').digest()
  return timingSafeEqual(ha, hb)
}

/**
 * Compara la contraseña con lo guardado en users.password.
 * - Hash bcrypt: bcrypt.compare.
 * - Texto plano heredado: igualdad en tiempo constante; si coincide, needsRehash = true para
 *   que el login lo sustituya por un hash (migración perezosa).
 */
export async function verifyPassword(
  password: string,
  stored: string | null | undefined
): Promise<{ valid: boolean; needsRehash: boolean }> {
  if (typeof stored === 'string' && isBcryptHash(stored)) {
    return { valid: await bcrypt.compare(password, stored), needsRehash: false }
  }

  // Igualar el coste temporal con el camino bcrypt
  await bcrypt.compare(password, DUMMY_HASH)

  if (typeof stored !== 'string' || stored.length === 0) {
    return { valid: false, needsRehash: false }
  }

  const valid = constantTimeEqual(password, stored)
  return { valid, needsRehash: valid }
}

/**
 * Consume el mismo tiempo que una verificación real (usuario inexistente).
 */
export async function burnPasswordCheck(password: string): Promise<void> {
  await bcrypt.compare(password, DUMMY_HASH)
}
