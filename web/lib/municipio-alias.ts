/**
 * Fase 4 · Población: normalización de nombres de municipio y resolución
 * "nombre + departamento" → código DANE de 5 dígitos.
 *
 * Puro (sin red ni base de datos): recibe `municipalities`, `departments` y las filas de
 * `municipio_alias` ya leídas. Lo usan scripts/bdua-load.ts (la BDUA publica nombres, no códigos) y
 * scripts/minsalud-cifras-load.ts (los archivos de jul-2025 a ene-2026 no traen IdMunicipio).
 *
 * Reglas:
 *   1. Normalización: "¥" (así llega la Ñ en la BDUA: "PIJI¥O") → Ñ; sin tildes; mayúsculas; todo lo
 *      que no sea letra o dígito pasa a espacio; espacios colapsados. "BOGOTÁ, D.C." → "BOGOTA D C".
 *   2. Departamento: nombre normalizado de `departments` o un alias fijo (VALLE → 76, SAN ANDRES → 88…).
 *   3. Municipio, dentro de ese departamento y en este orden:
 *        a. alias de la misma fuente (`municipio_alias.fuente`),
 *        b. nombre normalizado de `municipalities` (si dos municipios del mismo departamento
 *           normalizan igual, es ambiguo y NO se resuelve),
 *        c. alias de otra fuente.
 *      Nunca hay coincidencia aproximada ("contiene", distancia de edición): lo que no resuelve queda
 *      "sin cruce" y se reporta para añadir un alias verificado.
 */

export interface MunicipalityRef {
  code: string
  name: string
  department_code: string
}

export interface DepartmentRef {
  code: string
  name: string
}

export interface MunicipioAliasRow {
  nombre_normalizado: string
  department_code: string
  municipality_code: string
  fuente: string
}

export type ResolveVia = 'alias' | 'nombre' | 'alias_otra_fuente'

export interface ResolveResult {
  code: string
  via: ResolveVia
}

export const MUNICIPIO_CODE_RE = /^\d{5}$/
export const DEPARTMENT_CODE_RE = /^\d{2}$/

/** Fuentes conocidas de `municipio_alias` (PK: fuente + departamento + nombre normalizado). */
export const ALIAS_FUENTE_BDUA = 'bdua'
export const ALIAS_FUENTE_MINSALUD = 'minsalud_cifras'

/** Normaliza un nombre de municipio o departamento para compararlo (ver regla 1 arriba). */
export function normalizeMunicipioName(value: string | null | undefined): string {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/¥/g, 'Ñ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
}

/**
 * Alias fijos de departamento (nombre normalizado → código DANE). Solo variantes vistas en la BDUA y en
 * las cifras de MinSalud que no coinciden con `departments.name`.
 */
export const DEPARTMENT_NAME_ALIASES: Readonly<Record<string, string>> = {
  BOGOTA: '11',
  'BOGOTA D C': '11',
  'BOGOTA DC': '11',
  'BOGOTA DISTRITO CAPITAL': '11',
  VALLE: '76',
  'SAN ANDRES': '88',
  'SAN ANDRES Y PROVIDENCIA': '88',
  'SAN ANDRES PROVIDENCIA Y SANTA CATALINA': '88',
  'ARCHIPIELAGO DE SAN ANDRES PROVIDENCIA Y SANTA CATALINA': '88',
  GUAJIRA: '44',
  'NORTE SANTANDER': '54',
}

export interface MunicipioResolver {
  /** Código DANE de 2 dígitos del departamento, o null si no se reconoce. */
  departmentCode(name: string | null | undefined): string | null
  /** Resuelve un municipio dentro de un departamento ya identificado por código. */
  resolveInDepartment(municipio: string | null | undefined, departmentCode: string | null | undefined): ResolveResult | null
  /** Resuelve nombre de municipio + nombre de departamento. */
  resolve(municipio: string | null | undefined, departamento: string | null | undefined): ResolveResult | null
  /** Nombres normalizados ambiguos dentro de un departamento ("dd|NOMBRE"). */
  ambiguous: ReadonlySet<string>
}

const key = (departmentCode: string, normalized: string) => `${departmentCode}|${normalized}`

export function createMunicipioResolver(input: {
  municipalities: MunicipalityRef[]
  departments: DepartmentRef[]
  aliases?: MunicipioAliasRow[]
  /** Fuente preferida para los alias (p. ej. 'bdua'). */
  fuente?: string
}): MunicipioResolver {
  const fuente = input.fuente ?? null

  const deptByName = new Map<string, string>()
  for (const d of input.departments) {
    const code = String(d.code).padStart(2, '0')
    deptByName.set(normalizeMunicipioName(d.name), code)
  }
  for (const [name, code] of Object.entries(DEPARTMENT_NAME_ALIASES)) {
    if (!deptByName.has(name)) deptByName.set(name, code)
  }

  const byName = new Map<string, string>()
  const ambiguous = new Set<string>()
  for (const m of input.municipalities) {
    const k = key(String(m.department_code).padStart(2, '0'), normalizeMunicipioName(m.name))
    if (byName.has(k) && byName.get(k) !== m.code) ambiguous.add(k)
    else byName.set(k, m.code)
  }
  for (const k of Array.from(ambiguous)) byName.delete(k)

  const validCodes = new Set(input.municipalities.map(m => m.code))
  const ownAlias = new Map<string, string>()
  const otherAlias = new Map<string, string>()
  for (const a of input.aliases ?? []) {
    if (!validCodes.has(a.municipality_code)) continue // alias hacia un código que ya no existe
    const k = key(a.department_code, normalizeMunicipioName(a.nombre_normalizado))
    if (fuente !== null && a.fuente === fuente) ownAlias.set(k, a.municipality_code)
    else if (!otherAlias.has(k)) otherAlias.set(k, a.municipality_code)
  }

  function departmentCode(name: string | null | undefined): string | null {
    const raw = String(name ?? '').trim()
    if (DEPARTMENT_CODE_RE.test(raw)) return raw
    const normalized = normalizeMunicipioName(raw)
    if (!normalized) return null
    return deptByName.get(normalized) ?? null
  }

  function resolveInDepartment(municipio: string | null | undefined, dept: string | null | undefined): ResolveResult | null {
    if (!dept || !DEPARTMENT_CODE_RE.test(dept)) return null
    const normalized = normalizeMunicipioName(municipio)
    if (!normalized) return null
    const k = key(dept, normalized)
    const own = ownAlias.get(k)
    if (own) return { code: own, via: 'alias' }
    const exact = byName.get(k)
    if (exact) return { code: exact, via: 'nombre' }
    const other = otherAlias.get(k)
    if (other) return { code: other, via: 'alias_otra_fuente' }
    return null
  }

  return {
    departmentCode,
    resolveInDepartment,
    resolve: (municipio, departamento) => resolveInDepartment(municipio, departmentCode(departamento)),
    ambiguous,
  }
}

/**
 * Cobertura de afiliación como la publica MinSalud: afiliados / población DANE, con tope en 1
 * (Medellín, agosto-2026: 2.956.619 / 2.526.335 → 1). Sin población (o población 0) → null.
 */
export function computeCobertura(afiliados: number | null | undefined, poblacion: number | null | undefined): number | null {
  if (afiliados === null || afiliados === undefined || !Number.isFinite(afiliados)) return null
  if (poblacion === null || poblacion === undefined || !Number.isFinite(poblacion) || poblacion <= 0) return null
  return Math.min(1, Math.max(0, afiliados) / poblacion)
}
