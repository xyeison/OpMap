// Cuentas de usuario para las Ejecutivas Comerciales (app de visita, Fase 0).
// Funciones puras: qué hacer con cada ejecutiva y cómo generar una contraseña temporal. La ruta
// app/api/users/from-executives las usa; las pruebas están en scripts/ips-routes-check.ts.

export interface ExecutiveForAccount {
  id: string
  full_name: string
  email: string | null
  status: string
  user_id: string | null
}

export interface UserForAccount {
  id: string
  email: string
}

export type ExecutiveAccountAction =
  | { kind: 'create'; executive: ExecutiveForAccount; email: string }
  | { kind: 'link'; executive: ExecutiveForAccount; email: string; userId: string }
  | { kind: 'skip'; executive: ExecutiveForAccount; reason: string }

/** Rol con el que se crean los usuarios de las ejecutivas (spec de la app de visita, sección 13). */
export const EXECUTIVE_ACCOUNT_ROLE = 'sales_manager' as const

const normalizeEmail = (email: string) => email.trim().toLowerCase()

/**
 * Plan por ejecutiva activa: crear usuario, enlazar con uno que ya existe con su email, u omitirla con el
 * motivo. Las vacantes (placeholder) y las inactivas no se tocan; tampoco las que ya tienen usuario. Si dos
 * ejecutivas comparten email, ninguna se toca (no se adivina).
 */
export function planExecutiveAccounts(executives: ExecutiveForAccount[], users: UserForAccount[]): ExecutiveAccountAction[] {
  const userByEmail = new Map(users.map(user => [normalizeEmail(user.email), user]))
  const linkedUserIds = new Set(executives.map(executive => executive.user_id).filter((id): id is string => Boolean(id)))
  const emailCount = new Map<string, number>()
  for (const executive of executives) {
    if (executive.email) emailCount.set(normalizeEmail(executive.email), (emailCount.get(normalizeEmail(executive.email)) || 0) + 1)
  }

  const actions: ExecutiveAccountAction[] = []
  for (const executive of [...executives].sort((a, b) => a.full_name.localeCompare(b.full_name, 'es'))) {
    if (executive.status !== 'active') continue
    if (executive.user_id) continue
    if (!executive.email) {
      actions.push({ kind: 'skip', executive, reason: 'No tiene email: agrégalo en Ejecutivas Comerciales' })
      continue
    }
    const email = normalizeEmail(executive.email)
    if ((emailCount.get(email) || 0) > 1) {
      actions.push({ kind: 'skip', executive, reason: 'Otra ejecutiva tiene el mismo email: corrígelo primero' })
      continue
    }
    const existing = userByEmail.get(email)
    if (existing) {
      if (linkedUserIds.has(existing.id)) {
        actions.push({ kind: 'skip', executive, reason: 'Ya existe un usuario con ese email enlazado a otra ejecutiva' })
      } else {
        actions.push({ kind: 'link', executive, email, userId: existing.id })
      }
      continue
    }
    actions.push({ kind: 'create', executive, email })
  }
  return actions
}

// Sin caracteres que se confunden al dictarlos o copiarlos (0/O, 1/l/I).
const LOWER = 'abcdefghijkmnpqrstuvwxyz'
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const DIGITS = '23456789'
const ALL = LOWER + UPPER + DIGITS

/**
 * Contraseña temporal de 12 caracteres con al menos una minúscula, una mayúscula y un dígito. Recibe la fuente
 * de bytes aleatorios (crypto.randomBytes en el servidor) para poder probarla de forma determinista.
 */
export function generateTempPassword(randomBytes: (size: number) => Uint8Array, length = 12): string {
  const pick = (alphabet: string, byte: number) => alphabet[byte % alphabet.length]
  const bytes = randomBytes(length * 2)
  const chars = [pick(LOWER, bytes[0]), pick(UPPER, bytes[1]), pick(DIGITS, bytes[2])]
  for (let i = 3; i < length; i++) chars.push(pick(ALL, bytes[i]))
  // Mezcla (Fisher-Yates) con el resto de los bytes para que las tres clases no queden siempre al inicio
  for (let i = chars.length - 1; i > 0; i--) {
    const j = bytes[length + i] % (i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}
