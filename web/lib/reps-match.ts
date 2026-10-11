// Fase 3 · Cruce de IPS (hospitals) con las sedes del REPS (reps_sedes).
//
// Un NIT puede tener varias sedes; la IPS correcta es la SEDE, identificada por su código de
// habilitación (12 dígitos). Este módulo es PURO (sin red ni Supabase): lo usan
// scripts/reps-match.ts (informe y --apply), scripts/reps-check.ts (pruebas) y la API
// /api/hospitals/[id]/reps-link (ordenar candidatas en la ficha).
//
// Reglas del cruce (por IPS con NIT derivable de hospitals.code):
//   a) El NIT tiene 1 sede en reps_sedes            → matched (aunque el municipio no coincida; se avisa).
//   b) Varias sedes: se filtran las del municipio de la IPS (municipio_sede = municipality_id).
//      - queda 1                                     → matched.
//      - quedan varias (o ninguna: se usan todas)    → similitud de nombre normalizado (sin tildes, sin
//        S.A.S./E.S.E./IPS/CLINICA/HOSPITAL y conectores):
//          · una sola candidata con los mismos tokens que la IPS                → matched.
//          · varias con los mismos tokens: si solo una se escribe igual que la IPS (nombre completo
//            normalizado, o mismas palabras salvo forma societaria y conectores) → matched.
//          · si no, la mejor con puntaje ≥ NAME_MATCH_THRESHOLD y ventaja ≥ NAME_MATCH_MARGIN
//            sobre la segunda                                                  → matched.
//          · si no                                                             → ambiguous (con candidatas).
//   c) Ninguna sede con ese NIT (o code sin NIT)    → unmatched.
//   Una sede solo puede quedar vinculada a UNA IPS (hospitals.reps_code es UNIQUE): si dos IPS piden la
//   misma, gana la de mayor puntaje; con empate, las dos quedan ambiguous. Las IPS que ya tienen
//   reps_code (vínculos previos o manuales) no se tocan y sus sedes no se ofrecen a otras.

export const REPS_CODE_RE = /^\d{12}$/

export const REPS_MATCH_STATUSES = ['matched', 'ambiguous', 'unmatched'] as const
export type RepsMatchStatus = (typeof REPS_MATCH_STATUSES)[number]

export const REPS_STATUS_LABELS: Record<RepsMatchStatus, string> = {
  matched: 'Vinculada',
  ambiguous: 'Ambigua',
  unmatched: 'Sin cruce',
}

/**
 * NIT (9 dígitos, sin dígito de verificación) a partir de hospitals.code. MISMA regla que la columna
 * generada hospitals.nit de la migración 2026-10-11_0600_fase3_reps.sql:
 *   substring(btrim(code) from '^(\d{9})(?:-\d{1,2}|\d)$')
 * Acepta "890303208-5", " 900959048-4" (espacios), "800149384-10" (DV de 2 cifras, dato sucio) y
 * "9013620904" (NIT + DV sin guion).
 */
export const NIT_FROM_CODE_RE = /^(\d{9})(?:-\d{1,2}|\d)$/

export function nitFromCode(code: string | null | undefined): string | null {
  if (typeof code !== 'string') return null
  const match = NIT_FROM_CODE_RE.exec(code.trim())
  return match ? match[1] : null
}

/** Dígito de verificación de un NIT según la DIAN (módulo 11). Solo diagnóstico en el informe. */
export function nitCheckDigit(nit: string): number | null {
  if (!/^\d{1,15}$/.test(nit)) return null
  const weights = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71]
  const digits = nit.split('').reverse().map(Number)
  const sum = digits.reduce((acc, digit, index) => acc + digit * weights[index], 0)
  const remainder = sum % 11
  return remainder > 1 ? 11 - remainder : remainder
}

/** DV escrito en hospitals.code (lo que va tras el guion o el décimo dígito), si lo hay. */
export function checkDigitFromCode(code: string | null | undefined): number | null {
  if (typeof code !== 'string') return null
  const match = /^\d{9}(?:-(\d{1,2})|(\d))$/.exec(code.trim())
  if (!match) return null
  return Number(match[1] ?? match[2])
}

// ---------------------------------------------------------------------------------------------
// Normalización y similitud de nombres
// ---------------------------------------------------------------------------------------------

/**
 * Tokens que no distinguen una sede de otra: forma societaria, tipo de entidad y conectores.
 * HOSPITAL y CLINICA se quitan porque la sede suele repetir el nombre propio ("CLINICA VERSALLES SEDE
 * SAN MARCOS"); CENTRO, SALUD, MEDICO, etc. se conservan porque distinguen puestos y centros de salud.
 */
export const NAME_STOP_TOKENS = new Set([
  'SAS', 'SA', 'LTDA', 'LIMITADA', 'ESE', 'IPS', 'EPS', 'SEDE', 'CLINICA', 'HOSPITAL',
  'DE', 'DEL', 'LA', 'LAS', 'LOS', 'EL', 'Y', 'E', 'EN', 'AL',
  'SOCIEDAD', 'ANONIMA', 'SIMPLIFICADA', 'POR', 'ACCIONES', 'EMPRESA', 'SOCIAL', 'ESTADO', 'CIA',
])

/**
 * Mayúsculas, sin tildes ni signos; "S.A.S.", "S. A. S." y "SAS" quedan iguales (las letras sueltas
 * seguidas se unen: "E S E" → "ESE"). Los números de 6 o más cifras (códigos de habilitación o NIT
 * pegados al nombre, p. ej. "HOSPITAL X - (255130002801)") se quitan.
 */
export function normalizeName(name: string | null | undefined): string {
  if (!name) return ''
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ') // los puntos también separan: "E.S.E.Hospital" → "E S E HOSPITAL"
    .trim()
  if (!base) return ''
  // Une letras sueltas consecutivas ("S A S" → "SAS", "I P S" → "IPS")
  const out: string[] = []
  let letters = ''
  for (const token of base.split(' ')) {
    if (/^\d{6,}$/.test(token)) continue
    if (/^[A-Z]$/.test(token)) {
      letters += token
      continue
    }
    if (letters) {
      out.push(letters)
      letters = ''
    }
    out.push(token)
  }
  if (letters) out.push(letters)
  return out.join(' ')
}

/** Tokens significativos (sin NAME_STOP_TOKENS), sin repetir y ordenados. */
export function nameTokens(name: string | null | undefined): string[] {
  const normalized = normalizeName(name)
  if (!normalized) return []
  const tokens = new Set<string>()
  for (const token of normalized.split(' ')) {
    if (!NAME_STOP_TOKENS.has(token)) tokens.add(token)
  }
  return Array.from(tokens).sort()
}

function editDistanceAtMostOne(a: string, b: string): boolean {
  if (a === b) return true
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0
  let j = 0
  let edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++
      j++
      continue
    }
    if (++edits > 1) return false
    if (a.length > b.length) i++
    else if (a.length < b.length) j++
    else {
      i++
      j++
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1
}

/** Igualdad tolerante: idénticos, o una errata (1 edición) en palabras de 5+ letras sin cifras. */
function tokensEquivalent(a: string, b: string): boolean {
  if (a === b) return true
  if (a.length < 5 || b.length < 5 || /\d/.test(a) || /\d/.test(b)) return false
  return editDistanceAtMostOne(a, b)
}

/**
 * Similitud entre dos nombres (0..1): coeficiente de Dice sobre los tokens significativos, con
 * emparejamiento uno a uno y tolerancia a una errata. 1 = mismos tokens. Si un nombre no tiene tokens
 * significativos (p. ej. solo "CLINICA S.A.S."), devuelve 0.
 */
export function nameSimilarity(a: string | null | undefined, b: string | null | undefined): number {
  let best = 0
  for (const va of nameVariants(a)) {
    for (const vb of nameVariants(b)) {
      best = Math.max(best, tokenDice(nameTokens(va), nameTokens(vb)))
    }
  }
  return best
}

/** El nombre tal cual y, si tiene paréntesis, también sin lo que va entre ellos ("Hospital de Fontibón (Subred sur occidente)"). */
export function nameVariants(name: string | null | undefined): string[] {
  if (!name) return []
  const withoutParentheses = name.replace(/\([^)]*\)?/g, ' ').trim()
  return withoutParentheses && withoutParentheses !== name.trim() ? [name, withoutParentheses] : [name]
}

function tokenDice(ta: string[], tb: string[]): number {
  if (ta.length === 0 || tb.length === 0) return 0
  const used = new Array(tb.length).fill(false)
  let common = 0
  for (const token of ta) {
    let index = tb.indexOf(token)
    if (index === -1 || used[index]) {
      index = tb.findIndex((candidate, k) => !used[k] && tokensEquivalent(token, candidate))
    }
    if (index !== -1 && !used[index]) {
      used[index] = true
      common++
    }
  }
  return (2 * common) / (ta.length + tb.length)
}

/** Mismos tokens significativos (sin tolerancia a erratas), con o sin lo que va entre paréntesis. */
export function sameNameTokens(a: string | null | undefined, b: string | null | undefined): boolean {
  for (const va of nameVariants(a)) {
    const ta = nameTokens(va)
    for (const vb of nameVariants(b)) {
      const tb = nameTokens(vb)
      if (ta.length > 0 && ta.length === tb.length && ta.every((token, index) => token === tb[index])) return true
    }
  }
  return false
}

/** Forma societaria y conectores: lo único que se ignora al desempatar sedes con el mismo nombre. */
const STRICT_STOP_TOKENS = new Set([
  'SAS', 'SA', 'LTDA', 'LIMITADA', 'SOCIEDAD', 'ANONIMA', 'SIMPLIFICADA', 'POR', 'ACCIONES', 'CIA',
  'DE', 'DEL', 'LA', 'LAS', 'LOS', 'EL', 'Y', 'E', 'EN', 'AL',
])

/**
 * Desempate entre sedes con los mismos tokens significativos: ¿la sede se escribe igual que la IPS?
 * 2 = mismo nombre normalizado completo; 1 = mismas palabras salvo forma societaria y conectores
 * (conserva CLINICA, HOSPITAL, IPS, ESE, SEDE); 0 = no.
 */
export function strictNameEquality(a: string | null | undefined, b: string | null | undefined): 0 | 1 | 2 {
  const na = normalizeName(a)
  const nb = normalizeName(b)
  if (!na || !nb) return 0
  if (na === nb) return 2
  const strict = (value: string) =>
    Array.from(new Set(value.split(' ').filter(token => !STRICT_STOP_TOKENS.has(token)))).sort().join(' ')
  return strict(na) === strict(nb) ? 1 : 0
}

/** Nivel 1: nombre muy parecido y claramente mejor que la segunda candidata. */
export const NAME_MATCH_THRESHOLD = 0.8
export const NAME_MATCH_MARGIN = 0.15
/** Nivel 2: parecido algo menor, pero ninguna otra candidata se le acerca (p. ej. "Clínica Maraya" ↔ "Clinica Maraya sede 2" frente a "ONCOLOGOS DEL OCCIDENTE"). */
export const NAME_MATCH_THRESHOLD_LOW = 0.65
export const NAME_MATCH_MARGIN_WIDE = 0.5

// ---------------------------------------------------------------------------------------------
// Cruce
// ---------------------------------------------------------------------------------------------

/** Lo mínimo de una sede del REPS que necesita el cruce. */
export interface RepsSedeLite {
  codigo_habilitacion: string
  nit: string
  nombre_sede: string
  municipio_sede: string
}

/** Lo mínimo de una IPS (hospitals) que necesita el cruce. */
export interface HospitalLite {
  id: string
  code: string | null
  name: string
  municipality_id: string | null
  reps_code?: string | null
}

export type RepsMatchMethod =
  | 'unica_sede'      // el NIT tiene una sola sede
  | 'municipio'       // varias sedes, una sola en el municipio de la IPS
  | 'nombre_exacto'   // varias en el municipio; una sola con los mismos tokens de nombre
  | 'nombre_similar'  // varias en el municipio; la mejor supera umbral y margen
  | 'ya_vinculada'    // la IPS ya tenía reps_code: no se toca

export interface RepsCandidate {
  codigo_habilitacion: string
  nombre_sede: string
  municipio_sede: string
  same_municipality: boolean
  score: number
  /** Sede ya vinculada a otra IPS (id). */
  linked_hospital_id: string | null
}

export interface RepsMatchResult {
  hospital_id: string
  nit: string | null
  status: RepsMatchStatus
  reps_code: string | null
  method: RepsMatchMethod | null
  score: number | null
  /** Motivo legible (para el informe y la ficha). */
  reason: string
  /** a) con municipio distinto, o sede elegida fuera del municipio de la IPS. */
  municipality_mismatch: boolean
  /** Sedes del mismo NIT, ordenadas: mismo municipio, puntaje, código. */
  candidates: RepsCandidate[]
  /**
   * Solo en ambiguous: la candidata libre más probable (entre sedes con el mismo nombre, la de código
   * más bajo, que suele ser la sede principal "…01"; si no, la de mayor puntaje). NO se aplica sola:
   * la ficha la preselecciona para vincularla con un clic.
   */
  suggested_code: string | null
}

export function groupSedesByNit<T extends { nit: string }>(sedes: T[]): Map<string, T[]> {
  const byNit = new Map<string, T[]>()
  for (const sede of sedes) {
    const key = String(sede.nit).trim()
    const list = byNit.get(key)
    if (list) list.push(sede)
    else byNit.set(key, [sede])
  }
  return byNit
}

/** Candidatas de una IPS ordenadas (mismo municipio primero, luego puntaje de nombre, luego código). */
export function rankCandidates(
  hospital: Pick<HospitalLite, 'name' | 'municipality_id'>,
  sedes: RepsSedeLite[],
  linkedBy: Map<string, string> = new Map(),
  selfId: string | null = null
): RepsCandidate[] {
  return sedes
    .map(sede => {
      const linked = linkedBy.get(sede.codigo_habilitacion) ?? null
      return {
        codigo_habilitacion: sede.codigo_habilitacion,
        nombre_sede: sede.nombre_sede,
        municipio_sede: sede.municipio_sede,
        same_municipality: Boolean(hospital.municipality_id) && sede.municipio_sede === hospital.municipality_id,
        score: Math.round(nameSimilarity(hospital.name, sede.nombre_sede) * 1000) / 1000,
        linked_hospital_id: linked && linked !== selfId ? linked : null,
      }
    })
    .sort(
      (a, b) =>
        Number(b.same_municipality) - Number(a.same_municipality) ||
        b.score - a.score ||
        a.codigo_habilitacion.localeCompare(b.codigo_habilitacion)
    )
}

interface Proposal {
  result: RepsMatchResult
  /** Prioridad para resolver choques: método más fuerte primero, luego puntaje. */
  strength: number
}

const METHOD_STRENGTH: Record<Exclude<RepsMatchMethod, 'ya_vinculada'>, number> = {
  unica_sede: 3,
  municipio: 2,
  nombre_exacto: 2,
  nombre_similar: 1,
}

function decideOne(
  hospital: HospitalLite,
  nit: string,
  allSedes: RepsSedeLite[],
  linkedBy: Map<string, string>
): RepsMatchResult {
  const candidates = rankCandidates(hospital, allSedes, linkedBy, hospital.id)
  const base = { hospital_id: hospital.id, nit, candidates, suggested_code: null }
  const ambiguous = (reason: string, suggestion: RepsCandidate | null = null): RepsMatchResult => ({
    ...base,
    status: 'ambiguous',
    reps_code: null,
    method: null,
    score: null,
    reason,
    municipality_mismatch: false,
    suggested_code: suggestion && suggestion.score > 0 ? suggestion.codigo_habilitacion : null,
  })

  // Las sedes ya vinculadas a otra IPS no se ofrecen
  const free = candidates.filter(c => !c.linked_hospital_id)
  if (free.length === 0) {
    return ambiguous(
      `Las ${candidates.length} sede(s) del NIT ${nit} ya están vinculadas a otras IPS`
    )
  }

  // a) Una sola sede para el NIT
  if (candidates.length === 1) {
    const only = candidates[0]
    return {
      ...base,
      status: 'matched',
      reps_code: only.codigo_habilitacion,
      method: 'unica_sede',
      score: only.score,
      reason: only.same_municipality
        ? 'El NIT tiene una sola sede en el REPS'
        : `El NIT tiene una sola sede en el REPS, pero está en otro municipio (${only.municipio_sede})`,
      municipality_mismatch: !only.same_municipality,
    }
  }

  // b) Varias sedes: primero el municipio
  const inMunicipality = free.filter(c => c.same_municipality)
  const totalInMunicipality = candidates.filter(c => c.same_municipality).length
  if (inMunicipality.length === 1 && totalInMunicipality === 1) {
    const only = inMunicipality[0]
    return {
      ...base,
      status: 'matched',
      reps_code: only.codigo_habilitacion,
      method: 'municipio',
      score: only.score,
      reason: `El NIT tiene ${candidates.length} sedes y solo una en el municipio de la IPS`,
      municipality_mismatch: false,
    }
  }

  // Varias en el municipio (o ninguna: se compara con todas) → nombre
  const pool = totalInMunicipality > 0 ? inMunicipality : free
  const outside = totalInMunicipality === 0
  if (pool.length === 0) {
    return ambiguous(`Las sedes del NIT ${nit} en el municipio de la IPS ya están vinculadas a otras IPS`)
  }

  const exact = pool.filter(c => sameNameTokens(hospital.name, c.nombre_sede))
  if (exact.length === 1) {
    const best = exact[0]
    return {
      ...base,
      status: 'matched',
      reps_code: best.codigo_habilitacion,
      method: 'nombre_exacto',
      score: best.score,
      reason: outside
        ? `Ninguna sede en el municipio de la IPS; una sola con el mismo nombre (${best.municipio_sede})`
        : `${pool.length} sedes en el municipio; una sola con el mismo nombre`,
      municipality_mismatch: outside,
    }
  }
  if (exact.length > 1) {
    // Desempate: la única que se escribe igual que la IPS (nombre completo, o mismas palabras salvo
    // forma societaria y conectores). Si no hay una sola, ambigua con sugerida la de código más bajo.
    for (const level of [2, 1] as const) {
      const same = exact.filter(c => strictNameEquality(hospital.name, c.nombre_sede) === level)
      if (same.length === 1) {
        return {
          ...base,
          status: 'matched',
          reps_code: same[0].codigo_habilitacion,
          method: 'nombre_exacto',
          score: same[0].score,
          reason: `${exact.length} sedes con el mismo nombre; solo una se escribe igual que la IPS`,
          municipality_mismatch: outside,
        }
      }
      if (same.length > 1) break
    }
    const lowest = [...exact].sort((a, b) => a.codigo_habilitacion.localeCompare(b.codigo_habilitacion))[0]
    return ambiguous(`${exact.length} sedes con el mismo nombre que la IPS`, lowest)
  }

  const byScore = [...pool].sort((a, b) => b.score - a.score || a.codigo_habilitacion.localeCompare(b.codigo_habilitacion))
  const best = byScore[0]
  const second = byScore[1]
  const margin = second ? best.score - second.score : best.score
  if (
    (best.score >= NAME_MATCH_THRESHOLD && margin >= NAME_MATCH_MARGIN) ||
    (best.score >= NAME_MATCH_THRESHOLD_LOW && margin >= NAME_MATCH_MARGIN_WIDE)
  ) {
    return {
      ...base,
      status: 'matched',
      reps_code: best.codigo_habilitacion,
      method: 'nombre_similar',
      score: best.score,
      reason: `${pool.length} sedes${outside ? ' (ninguna en el municipio de la IPS)' : ' en el municipio'}; nombre parecido (${best.score.toFixed(2)}, ventaja ${margin.toFixed(2)})`,
      municipality_mismatch: outside,
    }
  }

  return ambiguous(
    `${pool.length} sedes${outside ? ' del NIT (ninguna en el municipio de la IPS)' : ' en el municipio'}; ninguna con nombre suficientemente parecido (mejor ${best.score.toFixed(2)}${second ? `, segunda ${second.score.toFixed(2)}` : ''})`,
    second && second.score === best.score ? null : best
  )
}

/**
 * Cruza todas las IPS con las sedes. `sedesByNit` = groupSedesByNit(reps_sedes).
 * Devuelve un resultado por IPS (en el mismo orden). No escribe nada.
 */
export function matchHospitalsToReps(
  hospitals: HospitalLite[],
  sedesByNit: Map<string, RepsSedeLite[]>
): RepsMatchResult[] {
  // Vínculos ya existentes: se respetan y bloquean su sede para las demás IPS
  const linkedBy = new Map<string, string>()
  for (const hospital of hospitals) {
    if (hospital.reps_code) linkedBy.set(hospital.reps_code, hospital.id)
  }

  const results = new Map<string, RepsMatchResult>()
  const proposals: Proposal[] = []

  for (const hospital of hospitals) {
    const nit = nitFromCode(hospital.code)
    const sedes = nit ? sedesByNit.get(nit) ?? [] : []

    if (hospital.reps_code) {
      const candidates = rankCandidates(hospital, sedes, linkedBy, hospital.id)
      const current = candidates.find(c => c.codigo_habilitacion === hospital.reps_code)
      results.set(hospital.id, {
        hospital_id: hospital.id,
        nit,
        status: 'matched',
        reps_code: hospital.reps_code,
        method: 'ya_vinculada',
        score: current?.score ?? null,
        reason: 'Ya estaba vinculada (no se modifica)',
        municipality_mismatch: current ? !current.same_municipality : false,
        candidates,
        suggested_code: null,
      })
      continue
    }

    if (!nit) {
      results.set(hospital.id, {
        hospital_id: hospital.id,
        nit: null,
        status: 'unmatched',
        reps_code: null,
        method: null,
        score: null,
        reason: `El código "${hospital.code ?? ''}" no tiene forma de NIT (9 dígitos y DV)`,
        municipality_mismatch: false,
        candidates: [],
        suggested_code: null,
      })
      continue
    }

    if (sedes.length === 0) {
      results.set(hospital.id, {
        hospital_id: hospital.id,
        nit,
        status: 'unmatched',
        reps_code: null,
        method: null,
        score: null,
        reason: `Ninguna sede del REPS cargada con el NIT ${nit}`,
        municipality_mismatch: false,
        candidates: [],
        suggested_code: null,
      })
      continue
    }

    const result = decideOne(hospital, nit, sedes, linkedBy)
    results.set(hospital.id, result)
    if (result.status === 'matched' && result.method && result.method !== 'ya_vinculada') {
      proposals.push({ result, strength: METHOD_STRENGTH[result.method] * 10 + (result.score ?? 0) })
    }
  }

  // Una sede, una IPS: si varias piden la misma, gana la más fuerte; con empate, ninguna.
  const byCode = new Map<string, Proposal[]>()
  for (const proposal of proposals) {
    const code = proposal.result.reps_code as string
    const list = byCode.get(code)
    if (list) list.push(proposal)
    else byCode.set(code, [proposal])
  }
  for (const [code, list] of Array.from(byCode.entries())) {
    if (list.length < 2) continue
    list.sort((a, b) => b.strength - a.strength)
    const winnerKept = list[0].strength > list[1].strength
    list.forEach((proposal, index) => {
      if (index === 0 && winnerKept) return
      const previous = proposal.result
      results.set(previous.hospital_id, {
        ...previous,
        status: 'ambiguous',
        reps_code: null,
        method: null,
        score: null,
        municipality_mismatch: false,
        reason: `La sede ${code} también corresponde a otra IPS del mismo NIT (${list.length} IPS la piden)`,
        suggested_code: null,
      })
    })
  }

  return hospitals.map(hospital => results.get(hospital.id) as RepsMatchResult)
}

/**
 * Cruce en varias vueltas: lo vinculado en una vuelta saca su sede de la competencia en la siguiente,
 * y una IPS que era ambigua (p. ej. dos sedes parecidas, una ya tomada por otra IPS del mismo NIT) puede
 * quedar con una sola candidata clara. Para cuando una vuelta no vincula nada nuevo (máx. maxRounds).
 * Cada resultado conserva el método de la vuelta en que se vinculó y su número de vuelta (`round`).
 */
export function matchHospitalsToRepsStable(
  hospitals: HospitalLite[],
  sedesByNit: Map<string, RepsSedeLite[]>,
  maxRounds = 5
): Array<RepsMatchResult & { round: number }> {
  const final = new Map<string, RepsMatchResult & { round: number }>()
  let current = hospitals.map(hospital => ({ ...hospital }))
  for (let round = 1; round <= maxRounds; round++) {
    let newMatches = 0
    for (const result of matchHospitalsToReps(current, sedesByNit)) {
      const previous = final.get(result.hospital_id)
      if (result.method === 'ya_vinculada' && previous?.status === 'matched') continue
      if (result.status === 'matched' && result.method !== 'ya_vinculada') newMatches++
      final.set(result.hospital_id, { ...result, round })
    }
    if (newMatches === 0) break
    current = current.map(hospital => ({ ...hospital, reps_code: final.get(hospital.id)?.reps_code ?? hospital.reps_code ?? null }))
  }
  return hospitals.map(hospital => final.get(hospital.id) as RepsMatchResult & { round: number })
}

export function summarizeMatches(results: RepsMatchResult[]) {
  const summary = {
    total: results.length,
    matched: 0,
    ambiguous: 0,
    unmatched: 0,
    byMethod: {} as Record<string, number>,
    municipalityMismatch: 0,
  }
  for (const result of results) {
    summary[result.status]++
    if (result.method) summary.byMethod[result.method] = (summary.byMethod[result.method] ?? 0) + 1
    if (result.status === 'matched' && result.municipality_mismatch) summary.municipalityMismatch++
  }
  return summary
}

// ---------------------------------------------------------------------------------------------
// Lectura del CSV del REPS (sin dependencias)
// ---------------------------------------------------------------------------------------------

/** Parser CSV RFC 4180 (comillas dobles, "" escapado, saltos de línea dentro de comillas, BOM). */
export function parseCsv(text: string, delimiter = ','): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0
  for (; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += c
    } else if (c === '"') quoted = true
    else if (c === delimiter) {
      row.push(field)
      field = ''
    } else if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (c !== '\r') field += c
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

const MONTHS: Record<string, string> = {
  JAN: '01', ENE: '01', FEB: '02', MAR: '03', APR: '04', ABR: '04', MAY: '05', JUN: '06',
  JUL: '07', AUG: '08', AGO: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12', DIC: '12',
}

/** "Fecha corte REPS: Mar 12 2026  3:11PM" → "2026-03-12". También acepta "2026-03-12" y "12/03/2026". */
export function parseRepsCutDate(value: string | null | undefined): string | null {
  if (!value) return null
  const text = value.trim()
  let match = /([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2})\s+(\d{4})/.exec(text)
  if (match) {
    const month = MONTHS[match[1].toUpperCase()]
    if (month) return `${match[3]}-${month}-${match[2].padStart(2, '0')}`
  }
  match = /(\d{4})-(\d{2})-(\d{2})/.exec(text)
  if (match) return `${match[1]}-${match[2]}-${match[3]}`
  match = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(text)
  if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`
  return null
}

/** Clases del REPS que se cargan en reps_sedes (decisión de la Fase 3, ver scripts/reps-load-sedes.ts). */
export const REPS_LOADED_CLASS_PREFIXES = [
  'Instituciones Prestadoras de Servicios de Salud',
  'Objeto Social Diferente',
  'Transporte Especial de Pacientes',
] as const

export function isLoadedRepsClass(clase: string | null | undefined): boolean {
  const value = (clase ?? '').trim()
  return REPS_LOADED_CLASS_PREFIXES.some(prefix => value.startsWith(prefix))
}

/** Fila de hospital_history tal como la lee el cruce (solo lo necesario). */
export interface RepsLinkHistoryRow {
  hospital_id: string | null
  created_at: string | null
  reason?: string | null
  changes: unknown
}

/**
 * IPS cuya ÚLTIMA acción sobre el vínculo REPS (changes.reps_link, escrita por PATCH .../reps-link y por
 * PUT /api/hospitals/[id]) fue desvincular a mano (after.reps_code = null). Devuelve hospital_id →
 * "AAAA-MM-DD motivo". El cruce automático (scripts/reps-match.ts) no vuelve a vincular estas IPS.
 * Filas sin changes.reps_link (u otras acciones) se ignoran.
 */
export function manualUnlinksFromHistory(rows: RepsLinkHistoryRow[]): Map<string, string> {
  const latest = new Map<string, { at: string; repsCode: string | null; reason: string }>()
  for (const row of rows) {
    const link = (row.changes as { reps_link?: { after?: { reps_code?: string | null } } } | null)?.reps_link
    if (!row.hospital_id || !link || !link.after || typeof link.after !== 'object' || !('reps_code' in link.after)) continue
    const at = row.created_at ?? ''
    const previous = latest.get(row.hospital_id)
    if (!previous || at >= previous.at) {
      latest.set(row.hospital_id, { at, repsCode: link.after.reps_code ?? null, reason: row.reason ?? '' })
    }
  }
  const manual = new Map<string, string>()
  latest.forEach((entry, hospitalId) => {
    if (entry.repsCode === null) manual.set(hospitalId, `${entry.at.slice(0, 10)} ${entry.reason}`.trim())
  })
  return manual
}
