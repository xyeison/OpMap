/**
 * Supabase FALSO en memoria para las pruebas sin red (PostgREST mínimo). Lo usan scripts/sia-observa-check.ts y
 * scripts/sia-observa-api-check.ts. Mismo enfoque que el de secop-procesos-sync-check.ts, con los filtros que usa SIA:
 * select/eq/neq/is/not/gte/lte/lt/in/ilike/order/range/limit/maybeSingle/single, count head, upsert con onConflict e
 * ignoreDuplicates, update, insert y delete; rpc sembradas; storage con upload y createSignedUrl. Tabla no sembrada =
 * PGRST205 (como una migración sin aplicar). No es un script ejecutable.
 */
export type Fila = Record<string, unknown>
export interface Escritura {
  op: 'upsert' | 'update' | 'insert' | 'delete' | 'upload'
  tabla: string
  filas: number
  onConflict?: string
}

const clonar = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)))

function like(patron: string, valor: unknown): boolean {
  if (valor === null || valor === undefined) return false
  const re = new RegExp(`^${patron.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.')}$`, 'is')
  return re.test(String(valor))
}

export function fakeSupabase(semilla: { tablas: Record<string, Fila[]>; rpcs?: Record<string, Fila[]> }) {
  const tablas = new Map<string, Fila[]>(Object.entries(semilla.tablas).map(([t, filas]) => [t, clonar(filas)]))
  const escrituras: Escritura[] = []
  const archivos = new Map<string, number>()
  let secuencia = 0
  const faltante = (t: string) => ({ data: null, error: { code: 'PGRST205', message: `Could not find the table 'public.${t}' in the schema cache` }, count: null })

  function from(tabla: string) {
    let op: 'select' | Escritura['op'] = 'select'
    let payload: Fila[] | Fila = []
    let conflicto: { onConflict?: string; ignoreDuplicates?: boolean } = {}
    let devolver = false
    let head = false
    let conteo = false
    let unico: 'single' | 'maybe' | null = null
    const filtros: Array<(r: Fila) => boolean> = []
    const ordenes: Array<{ col: string; asc: boolean }> = []
    let rango: [number, number] | null = null
    let limite: number | null = null
    const ejecutar = () => {
      const filas = tablas.get(tabla)
      if (!filas) {
        if (op !== 'select') escrituras.push({ op, tabla, filas: Array.isArray(payload) ? payload.length : 1 })
        return faltante(tabla)
      }
      const terminar = (out: Fila[]) => {
        if (unico) {
          if (out.length === 0) return unico === 'maybe' ? { data: null, error: null } : { data: null, error: { code: 'PGRST116', message: 'no rows' } }
          return { data: clonar(out[0]), error: null }
        }
        return { data: head ? null : clonar(out), error: null, count: conteo ? out.length : null }
      }
      if (op === 'select') {
        let out = filas.filter(r => filtros.every(f => f(r)))
        if (conteo) return { data: head ? null : clonar(out), error: null, count: out.length }
        for (const { col, asc } of [...ordenes].reverse()) {
          out = [...out].sort((a, b) => {
            const va = a[col] ?? ''
            const vb = b[col] ?? ''
            const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va) < String(vb) ? -1 : String(va) > String(vb) ? 1 : 0
            return cmp * (asc ? 1 : -1)
          })
        }
        if (rango) out = out.slice(rango[0], rango[1] + 1)
        if (limite !== null) out = out.slice(0, limite)
        return terminar(out)
      }
      const n = Array.isArray(payload) ? payload.length : 1
      escrituras.push({ op, tabla, filas: n, onConflict: conflicto.onConflict })
      if (op === 'upsert' || op === 'insert') {
        const claves = String(conflicto.onConflict ?? 'id').split(',')
        const tocadas: Fila[] = []
        for (const row of payload as Fila[]) {
          const existente = op === 'upsert' ? filas.find(r => claves.every(k => r[k] === row[k])) : undefined
          if (existente && conflicto.ignoreDuplicates) continue
          if (existente) {
            Object.assign(existente, clonar(row))
            tocadas.push(existente)
          } else {
            const nueva = { id: `00000000-0000-4000-8000-${String(++secuencia).padStart(12, '0')}`, ...clonar(row) }
            filas.push(nueva)
            tocadas.push(nueva)
          }
        }
        return devolver ? terminar(tocadas) : { data: null, error: null }
      }
      if (op === 'update') {
        const afectadas = filas.filter(r => filtros.every(f => f(r)))
        for (const r of afectadas) Object.assign(r, clonar(payload as Fila))
        return devolver ? terminar(afectadas) : { data: null, error: null }
      }
      if (op === 'delete') {
        const quedan = filas.filter(r => !filtros.every(f => f(r)))
        tablas.set(tabla, quedan)
        return { data: null, error: null }
      }
      return { data: null, error: { code: '42501', message: `${op} no soportado` } }
    }
    const builder = {
      select(_cols?: string, o?: { count?: string; head?: boolean }) {
        if (op !== 'select') devolver = true
        if (o?.count) conteo = true
        if (o?.head) head = true
        return builder
      },
      eq(col: string, value: unknown) {
        filtros.push(r => r[col] === value)
        return builder
      },
      neq(col: string, value: unknown) {
        filtros.push(r => r[col] !== value)
        return builder
      },
      is(col: string, value: unknown) {
        filtros.push(r => (r[col] ?? null) === value)
        return builder
      },
      not(col: string, operador: string, value: unknown) {
        if (operador !== 'is') throw new Error(`not(${operador}) no soportado`)
        filtros.push(r => (r[col] ?? null) !== value)
        return builder
      },
      gte(col: string, value: unknown) {
        filtros.push(r => r[col] !== null && r[col] !== undefined && String(r[col]) >= String(value))
        return builder
      },
      lte(col: string, value: unknown) {
        filtros.push(r => r[col] !== null && r[col] !== undefined && String(r[col]) <= String(value))
        return builder
      },
      lt(col: string, value: unknown) {
        filtros.push(r => r[col] !== null && r[col] !== undefined && String(r[col]) < String(value))
        return builder
      },
      in(col: string, values: unknown[]) {
        filtros.push(r => values.includes(r[col]))
        return builder
      },
      ilike(col: string, patron: string) {
        filtros.push(r => like(patron, r[col]))
        return builder
      },
      order(col: string, o?: { ascending?: boolean }) {
        ordenes.push({ col, asc: o?.ascending !== false })
        return builder
      },
      range(a: number, b: number) {
        rango = [a, b]
        return builder
      },
      limit(n: number) {
        limite = n
        return builder
      },
      maybeSingle() {
        unico = 'maybe'
        return builder
      },
      single() {
        unico = 'single'
        return builder
      },
      upsert(rows: Fila[] | Fila, o?: { onConflict?: string; ignoreDuplicates?: boolean }) {
        op = 'upsert'
        payload = Array.isArray(rows) ? rows : [rows]
        conflicto = o ?? {}
        return builder
      },
      insert(rows: Fila[] | Fila) {
        op = 'insert'
        payload = Array.isArray(rows) ? rows : [rows]
        return builder
      },
      update(patch: Fila) {
        op = 'update'
        payload = patch
        return builder
      },
      delete() {
        op = 'delete'
        return builder
      },
      then<T>(resolve: (v: unknown) => T, reject?: (e: unknown) => T) {
        return Promise.resolve().then(ejecutar).then(resolve, reject)
      },
    }
    return builder
  }

  function rpc(nombre: string) {
    let rango: [number, number] | null = null
    const builder = {
      range(a: number, b: number) {
        rango = [a, b]
        return builder
      },
      then<T>(resolve: (v: unknown) => T, reject?: (e: unknown) => T) {
        const filas = semilla.rpcs?.[nombre]
        const r = filas ? { data: clonar(rango ? filas.slice(rango[0], rango[1] + 1) : filas), error: null } : { data: null, error: { code: 'PGRST202', message: `function ${nombre} not found` } }
        return Promise.resolve(r).then(resolve, reject)
      },
    }
    return builder
  }

  const storage = {
    from(bucket: string) {
      return {
        async upload(ruta: string, cuerpo: Uint8Array) {
          escrituras.push({ op: 'upload', tabla: `storage:${bucket}`, filas: 1 })
          archivos.set(`${bucket}/${ruta}`, cuerpo.length)
          return { data: { path: ruta }, error: null }
        },
        async createSignedUrl(ruta: string, segundos: number) {
          if (!archivos.has(`${bucket}/${ruta}`) && !ruta) return { data: null, error: { message: 'Object not found' } }
          return { data: { signedUrl: `https://falso.supabase.co/storage/v1/object/sign/${bucket}/${ruta}?token=t&expires=${segundos}` }, error: null }
        },
        async download(ruta: string) {
          const n = archivos.get(`${bucket}/${ruta}`)
          if (n === undefined) return { data: null, error: { message: 'Object not found' } }
          return { data: new Blob([new Uint8Array(n)]), error: null }
        },
      }
    },
  }

  return { db: { from, rpc, storage } as never, tablas, escrituras, archivos }
}
