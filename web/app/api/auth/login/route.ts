import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS, passwordVersion, sessionCookieOptions, signSession } from '@/lib/session'
import { burnPasswordCheck, hashPassword, verifyPassword } from '@/lib/passwords'
import { ejecutivaEnlazada } from '@/lib/auth-server'
import type { LoginMovilResponse } from '@/lib/reporte-visitas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const INVALID_CREDENTIALS = 'Email o contraseña incorrectos'
const TOO_MANY_ATTEMPTS = 'Demasiados intentos de inicio de sesión. Intenta de nuevo más tarde.'

// Sesión del teléfono (decisión 1 de docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md): con
// { cliente: 'movil' } el MISMO token firmado se entrega en el cuerpo, sin Set-Cookie; la app lo guarda en
// el almacén seguro y lo manda en "Authorization: Bearer" (solo vale en /api/*). Mismos límites de intentos.
const CLIENTE_MOVIL = 'movil'
// La app de campo en el navegador (/campo, 2026-10-30): el cuerpo del móvil Y la cookie de la web, para que entrar en
// la app deje también dentro de OpMap (un solo ingreso; mismo origen, mismo token).
const CLIENTE_CAMPO_WEB = 'campo-web'

/** Instante ISO en que expira un token recién firmado (exp del payload, que es iat + 7 días). */
function expiraAt(token: string): string {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8')) as { exp?: unknown }
    if (typeof payload.exp === 'number' && Number.isFinite(payload.exp)) return new Date(payload.exp * 1000).toISOString()
  } catch {
    // se calcula abajo
  }
  return new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000).toISOString()
}

// ---------------------------------------------------------------------------
// Rate limit en memoria.
// IMPORTANTE: los contadores viven en la memoria de cada instancia (cada función serverless
// de Vercel tiene los suyos y se pierden en cada cold start). Frena la fuerza bruta desde una
// misma instancia, pero no es un límite global. Para un límite global usar un almacén
// compartido (Vercel KV / Upstash o una tabla de intentos en Supabase).
// ---------------------------------------------------------------------------
const IP_WINDOW_MS = 60 * 1000 // 1 minuto
const IP_MAX_ATTEMPTS = 10 // intentos (correctos o no) por IP y minuto
const EMAIL_WINDOW_MS = 15 * 60 * 1000 // 15 minutos
const EMAIL_MAX_FAILURES = 5 // fallos por email en 15 minutos
const MAX_TRACKED_KEYS = 5000

const ipAttempts = new Map<string, number[]>()
const emailFailures = new Map<string, number[]>()

function recentHits(store: Map<string, number[]>, key: string, windowMs: number, now: number): number[] {
  const hits = (store.get(key) || []).filter(t => now - t < windowMs)
  if (hits.length > 0) {
    store.set(key, hits)
  } else {
    store.delete(key)
  }
  return hits
}

function pruneStore(store: Map<string, number[]>, windowMs: number, now: number) {
  if (store.size <= MAX_TRACKED_KEYS) return
  store.forEach((hits, key) => {
    if (!hits.some(t => now - t < windowMs)) store.delete(key)
  })
  // Si aún hay demasiadas claves (ataque distribuido), descartar las insertadas primero
  let excess = store.size - MAX_TRACKED_KEYS
  if (excess > 0) {
    for (const key of Array.from(store.keys())) {
      if (excess-- <= 0) break
      store.delete(key)
    }
  }
}

function retryAfterSeconds(hits: number[], windowMs: number, now: number): number {
  const oldest = Math.min(...hits)
  return Math.max(1, Math.ceil((oldest + windowMs - now) / 1000))
}

function tooManyAttempts(retryAfter: number) {
  return NextResponse.json(
    { error: TOO_MANY_ATTEMPTS },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } }
  )
}

function getClientIp(request: NextRequest): string {
  return (
    request.ip ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'desconocida'
  )
}

function invalidCredentials() {
  return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 401 })
}

export async function POST(request: NextRequest) {
  try {
    const now = Date.now()
    pruneStore(ipAttempts, IP_WINDOW_MS, now)
    pruneStore(emailFailures, EMAIL_WINDOW_MS, now)

    // 1. Límite por IP (cuenta todos los intentos)
    const ip = getClientIp(request)
    const ipHits = recentHits(ipAttempts, ip, IP_WINDOW_MS, now)
    if (ipHits.length >= IP_MAX_ATTEMPTS) {
      return tooManyAttempts(retryAfterSeconds(ipHits, IP_WINDOW_MS, now))
    }
    ipAttempts.set(ip, [...ipHits, now])

    // 2. Validar el cuerpo
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Email y contraseña son requeridos' }, { status: 400 })
    }
    const { email: rawEmail, password, cliente } = (body || {}) as { email?: unknown; password?: unknown; cliente?: unknown }
    if (typeof rawEmail !== 'string' || typeof password !== 'string' || !rawEmail.trim() || !password) {
      return NextResponse.json({ error: 'Email y contraseña son requeridos' }, { status: 400 })
    }
    const conCookieTambien = cliente === CLIENTE_CAMPO_WEB
    const esMovil = cliente === CLIENTE_MOVIL || conCookieTambien
    if (rawEmail.length > 320 || password.length > 1024) {
      return invalidCredentials()
    }
    // Email normalizado (igual que emailSchema en lib/user-schemas.ts): se usa para la búsqueda
    // y como clave del rate limit, para que "A@x.com" y "a@x.com " cuenten como el mismo
    const email = rawEmail.trim().toLowerCase()
    const emailKey = email

    // 3. Límite de fallos por email (exista o no la cuenta, para no revelar cuáles existen)
    const failures = recentHits(emailFailures, emailKey, EMAIL_WINDOW_MS, now)
    if (failures.length >= EMAIL_MAX_FAILURES) {
      return tooManyAttempts(retryAfterSeconds(failures, EMAIL_WINDOW_MS, now))
    }

    const registerFailure = () => {
      const at = Date.now()
      emailFailures.set(emailKey, [...recentHits(emailFailures, emailKey, EMAIL_WINDOW_MS, at), at])
    }

    // 4. Buscar el usuario activo
    const supabase = getSupabaseAdmin()
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, full_name, role, active, created_at, password')
      .eq('email', email)
      .eq('active', true)
      .maybeSingle()

    if (error) {
      console.error('Error al buscar usuario en login:', error.message)
      return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }

    if (!user) {
      await burnPasswordCheck(password)
      registerFailure()
      return invalidCredentials()
    }

    // 5. Verificar la contraseña (bcrypt o texto plano heredado)
    const { valid, needsRehash } = await verifyPassword(password, user.password)
    if (!valid) {
      registerFailure()
      return invalidCredentials()
    }

    emailFailures.delete(emailKey)

    // 6. Migración perezosa: sustituir la contraseña en texto plano por su hash bcrypt.
    // storedPassword es el valor que queda en la BD tras este paso (base del claim pv).
    let storedPassword: string = user.password
    if (needsRehash) {
      try {
        const hashed = await hashPassword(password)
        // Filtrar solo por id: nunca poner la contraseña en la query (acabaría en los logs de la API)
        const { error: rehashError } = await supabase
          .from('users')
          .update({ password: hashed })
          .eq('id', user.id)
        if (rehashError) {
          console.error('No se pudo migrar la contraseña a bcrypt:', rehashError.message)
        } else {
          storedPassword = hashed
        }
      } catch (rehashException) {
        console.error('No se pudo migrar la contraseña a bcrypt:', rehashException)
      }
    }

    // 7. Emitir la sesión firmada (DESPUÉS del re-hash, con el hash definitivo)
    const token = signSession(user.id, passwordVersion(storedPassword))
    const { password: _password, ...userWithoutPassword } = user

    // 7a. App móvil: el token va en el cuerpo, sin cookie, con el Ejecutivo Comercial enlazado (si lo hay).
    // Si la base falla al buscar la ejecutiva, el login no se cae: ejecutiva null y la app vuelve a preguntar
    // en /api/auth/me.
    if (esMovil) {
      let ejecutiva: LoginMovilResponse['ejecutiva'] = null
      try {
        ejecutiva = await ejecutivaEnlazada(user.id)
      } catch (ejecutivaError) {
        console.error('No se pudo cargar el Ejecutivo Comercial enlazado en el login móvil:', ejecutivaError)
      }
      const respuesta: LoginMovilResponse = {
        token,
        expira_at: expiraAt(token),
        usuario: { id: user.id, full_name: user.full_name, role: user.role },
        ejecutiva,
      }
      const json = NextResponse.json(respuesta, { headers: { 'Cache-Control': 'no-store' } })
      if (conCookieTambien) json.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions())
      return json
    }

    // 7b. Web: cookie de sesión
    const response = NextResponse.json({
      user: userWithoutPassword,
      message: 'Login exitoso',
    })
    response.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions())
    return response
  } catch (error) {
    console.error('Error en login:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
