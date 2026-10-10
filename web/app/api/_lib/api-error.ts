// Utilidades compartidas por las rutas de app/api/** (carpeta privada: "_lib" no genera rutas).
// Objetivo: no devolver nunca al cliente el mensaje crudo de PostgREST/Supabase ni stacks.
import { NextResponse } from 'next/server'
import type { ZodError } from 'zod'

/**
 * Registra el error en el servidor y responde con un mensaje genérico.
 * `context` identifica la ruta en los logs (p.ej. 'contracts/manage POST').
 */
export function serverError(
  context: string,
  error: unknown,
  message = 'Error interno del servidor',
  status = 500
) {
  console.error(`[api] ${context}:`, error)
  return NextResponse.json({ error: message }, { status })
}

/**
 * 400 con los problemas de validación de zod (son mensajes sobre la entrada del cliente,
 * no información interna de la BD).
 */
export function validationError(error: ZodError, message = 'Datos inválidos') {
  return NextResponse.json(
    {
      error: message,
      issues: error.issues.map(issue => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    },
    { status: 400 }
  )
}

/**
 * Lee el cuerpo JSON sin lanzar. Devuelve undefined si no es JSON válido.
 */
export async function readJsonBody(request: Request): Promise<unknown | undefined> {
  try {
    return await request.json()
  } catch {
    return undefined
  }
}

export function badJson() {
  return NextResponse.json({ error: 'El cuerpo de la petición debe ser JSON válido' }, { status: 400 })
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

/**
 * Lee todas las filas de una consulta paginando con .range() (PostgREST corta en 1.000 filas).
 * `build(from, to)` debe devolver la consulta ya filtrada con .range(from, to) aplicado.
 */
export async function fetchAllRows<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = 1000,
  maxRows = 200000
): Promise<{ data: T[]; error: unknown | null }> {
  const rows: T[] = []
  for (let from = 0; from < maxRows; from += pageSize) {
    const { data, error } = await build(from, from + pageSize - 1)
    if (error) return { data: rows, error }
    const page = data || []
    rows.push(...page)
    if (page.length < pageSize) break
  }
  return { data: rows, error: null }
}
