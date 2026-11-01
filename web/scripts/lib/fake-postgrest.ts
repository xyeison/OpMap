/**
 * PostgREST FALSO de solo lectura (GET), por HTTP: para las pruebas de rutas que solo leen (p. ej. scripts/equipo-api-check.ts).
 * El mismo subconjunto que el de scripts/lineas-api-check.ts (select, eq, neq, in, is.null, not.is.null, gte, lte, gt, lt,
 * order, limit y offset). Tabla no sembrada → PGRST205 (como una migración sin aplicar); cualquier escritura → 42501.
 * No es un script ejecutable.
 */
export type Fila = Record<string, unknown>
export type Tablas = Record<string, Fila[]>

export interface PeticionFalsa {
  method: string
  table: string
  params: URLSearchParams
}

const PARAMETROS_DE_CONTROL = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'])

export function cumpleFiltros(row: Fila, params: URLSearchParams): boolean {
  for (const [key, raw] of Array.from(params.entries())) {
    if (PARAMETROS_DE_CONTROL.has(key)) continue
    const value = row[key] === null || row[key] === undefined ? 'null' : String(row[key])
    if (raw.startsWith('eq.')) {
      if (value !== raw.slice(3)) return false
    } else if (raw.startsWith('neq.')) {
      if (value === raw.slice(4)) return false
    } else if (raw.startsWith('in.(') && raw.endsWith(')')) {
      const options = raw.slice(4, -1).split(',').map(option => option.replace(/^"|"$/g, ''))
      if (!options.includes(value)) return false
    } else if (raw === 'is.null') {
      if (value !== 'null') return false
    } else if (raw === 'not.is.null') {
      if (value === 'null') return false
    } else if (/^(gte|lte|gt|lt)\./.test(raw)) {
      const [op, ...rest] = raw.split('.')
      const target = rest.join('.')
      if (value === 'null') return false
      if (op === 'gte' && !(value >= target)) return false
      if (op === 'lte' && !(value <= target)) return false
      if (op === 'gt' && !(value > target)) return false
      if (op === 'lt' && !(value < target)) return false
    } else {
      throw new Error(`PostgREST falso: filtro no soportado ${key}=${raw}`)
    }
  }
  return true
}

function comparar(a: unknown, b: unknown): number {
  if (a === b) return 0
  if (a === null || a === undefined) return 1
  if (b === null || b === undefined) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b)
  const x = String(a)
  const y = String(b)
  return x < y ? -1 : x > y ? 1 : 0
}

function proyectar(row: Fila, select: string | null): Fila {
  if (!select || select === '*' || select.includes('(')) return { ...row }
  const out: Fila = {}
  for (const column of select.split(',').map(part => part.trim()).filter(Boolean)) out[column] = row[column] ?? null
  return out
}

export function fakePostgrest(origen: string, tablas: Tablas) {
  const peticiones: PeticionFalsa[] = []
  const externas: string[] = []
  const json = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } })
  const pgError = (code: string, message: string, status: number) => json({ code, message, details: null, hint: null }, status)

  const handler = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const url = new URL(href)
    if (url.origin !== origen) {
      externas.push(url.origin)
      throw new Error(`PostgREST falso: intento de red a ${url.origin}`)
    }
    const method = (init?.method || 'GET').toUpperCase()
    const table = url.pathname.replace('/rest/v1/', '')
    peticiones.push({ method, table, params: url.searchParams })
    if (table.startsWith('rpc/')) return pgError('PGRST202', `Could not find the function public.${table.slice(4)}`, 404)
    if (!(table in tablas)) return pgError('PGRST205', `Could not find the table 'public.${table}' in the schema cache`, 404)
    if (method !== 'GET') return pgError('42501', `PostgREST falso: escritura no permitida (${method} ${table})`, 403)
    let rows = tablas[table].filter(row => cumpleFiltros(row, url.searchParams))
    const order = url.searchParams.get('order')
    if (order) {
      const keys = order.split(',').map(part => {
        const [column, direction] = part.split('.')
        return { column, desc: direction === 'desc' }
      })
      rows = [...rows].sort((a, b) => {
        for (const key of keys) {
          const result = comparar(a[key.column], b[key.column])
          if (result !== 0) return key.desc ? -result : result
        }
        return 0
      })
    }
    const offset = Number(url.searchParams.get('offset') ?? 0)
    const limit = url.searchParams.get('limit')
    rows = rows.slice(offset, limit === null ? undefined : offset + Number(limit))
    return json(rows.map(row => proyectar(row, url.searchParams.get('select'))))
  }
  return { handler, peticiones, externas, tablas }
}
