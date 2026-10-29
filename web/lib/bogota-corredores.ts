// Bogotá como UNA ciudad hacia afuera, con reparto por corredor de salida (PR 3, 2026-10-11).
// Spec: docs/specs/2026-10-11-bogota-corredores.md
//
// Módulo PURO (sin E/S, sin Supabase): lo usan lib/opmap-algorithm-simplified.ts (motor), la API de
// configuración (/api/kams/bogota-config), scripts/bogota-simulate.ts y scripts/bogota-check.ts.
// Imports relativos (no '@/') para que los scripts lo usen con tsx.
//
// Conceptos:
//  - CELDA: una fila de `kams` con area_id de localidad de Bogotá ('11001xx'). Hoy son cuatro:
//    Chapinero 1100102, Engativá 1100110, Kennedy 1100108 y San Cristóbal 1100104.
//  - CORREDOR: salida de Bogotá hacia un municipio de fuera (norte, occidente, sur, oriente). Se toma
//    de la tabla `bogota_corredores` (department_code / municipality_code -> corredor).
//  - GRUPOS: `bogota_config.grupos`, mapa corredor -> kam_id de la celda que recibe ese corredor.
//    Con k = 4 cada corredor tiene su celda; con k < 4 varios corredores apuntan a la misma celda.

export const CORREDORES = ['norte', 'occidente', 'sur', 'oriente'] as const
export type Corredor = (typeof CORREDORES)[number]

export const CORREDOR_LABEL: Record<Corredor, string> = {
  norte: 'Norte',
  occidente: 'Occidente',
  sur: 'Sur',
  oriente: 'Oriente',
}

export function isCorredor(value: unknown): value is Corredor {
  return typeof value === 'string' && (CORREDORES as readonly string[]).includes(value)
}

/** Fila de `bogota_corredores`. municipality_code null = fila del departamento entero. */
export interface CorredorRow {
  department_code: string
  municipality_code: string | null
  corredor: Corredor
  nota?: string | null
}

export type BogotaK = 1 | 2 | 3 | 4

/** Fila normalizada de `bogota_config` (id = 1, una sola fila). */
export interface BogotaConfig {
  k: BogotaK
  /** Tope único (minutos) del candidato "Bogotá" hacia afuera. Ignora kams.max_travel_time de las celdas. */
  max_travel_minutes: number
  /** corredor -> kam_id de la celda que recibe ese corredor */
  grupos: Partial<Record<Corredor, string>>
}

export const DEFAULT_BOGOTA_K: BogotaK = 4
export const DEFAULT_BOGOTA_MAX_TRAVEL_MINUTES = 240

/** area_id de la celda que recibe cada corredor con k = 4 (configuración inicial aprobada). */
export const CELDA_AREA_POR_CORREDOR: Record<Corredor, string> = {
  norte: '1100102', // Chapinero
  occidente: '1100110', // Engativá
  sur: '1100108', // Kennedy
  oriente: '1100104', // San Cristóbal
}

/**
 * Agrupación de corredores por número de celdas k. Cada grupo lo recibe UNA celda.
 *  - k = 4: cada corredor su celda.
 *  - k = 3: Norte | Occidente | Sur + Oriente.
 *  - k = 2: Norte + Oriente | Occidente + Sur.
 *  - k = 1: los cuatro corredores a una sola celda.
 * Celda receptora por defecto de cada grupo: la del PRIMER corredor del grupo en este orden
 * (k = 3: Sur + Oriente -> celda del Sur; k = 2: Norte + Oriente -> celda del Norte y
 * Occidente + Sur -> celda del Occidente; k = 1: celda del Norte). El administrador puede elegir otra.
 */
export const AGRUPACIONES_POR_K: Record<BogotaK, Corredor[][]> = {
  1: [['norte', 'occidente', 'sur', 'oriente']],
  2: [
    ['norte', 'oriente'],
    ['occidente', 'sur'],
  ],
  3: [['norte'], ['occidente'], ['sur', 'oriente']],
  4: [['norte'], ['occidente'], ['sur'], ['oriente']],
}

export function isBogotaK(value: unknown): value is BogotaK {
  return value === 1 || value === 2 || value === 3 || value === 4
}

/**
 * Corredor de un municipio: primero la fila con municipality_code = municipio de la IPS; si no, la
 * fila del departamento (municipality_code null); si no, null ("sin corredor": la IPS se asigna a la
 * celda con menor tiempo real y la simulación la lista).
 */
export function resolveCorredor(
  municipalityCode: string | null | undefined,
  departmentCode: string | null | undefined,
  filas: readonly CorredorRow[]
): Corredor | null {
  return resolveCorredorConFuente(municipalityCode, departmentCode, filas)?.corredor ?? null
}

export function resolveCorredorConFuente(
  municipalityCode: string | null | undefined,
  departmentCode: string | null | undefined,
  filas: readonly CorredorRow[]
): { corredor: Corredor; fuente: 'municipio' | 'departamento' } | null {
  if (municipalityCode) {
    const porMunicipio = filas.find(f => f.municipality_code === municipalityCode)
    if (porMunicipio) return { corredor: porMunicipio.corredor, fuente: 'municipio' }
  }
  const dept = departmentCode || (municipalityCode ? municipalityCode.substring(0, 2) : null)
  if (dept) {
    const porDepartamento = filas.find(f => f.municipality_code === null && f.department_code === dept)
    if (porDepartamento) return { corredor: porDepartamento.corredor, fuente: 'departamento' }
  }
  return null
}

/** kam_id de la celda que recibe el corredor según la configuración, o null si no está configurado. */
export function celdaParaCorredor(corredor: Corredor, config: Pick<BogotaConfig, 'grupos'>): string | null {
  const kamId = config.grupos[corredor]
  return typeof kamId === 'string' && kamId.length > 0 ? kamId : null
}

/**
 * Sector de cada localidad de Bogotá (dueño, 2026-10-28: "Si, hazlo. Norte, Occidente, Sur y Oriente"; spec
 * docs/specs/2026-10-28-bogota-4-sectores.md). El sector es el mismo corredor que usan los municipios de afuera, así
 * cada Zona de Bogotá recibe su sector de la ciudad y lo que sale por su corredor:
 *  - IPS de Bogotá: van a la celda del corredor de su localidad (bogotaSectorCell), sin minutos ni tope.
 *  - Mapa: una localidad sin IPS se pinta con la celda de su corredor según el último recálculo.
 * `bogota_corredores` solo acepta municipios de 5 dígitos; por eso la tabla vive aquí.
 */
export const CORREDOR_DE_LOCALIDAD: Readonly<Record<string, Corredor>> = {
  '1100101': 'norte', // Usaquén
  '1100111': 'occidente', // Suba
  '1100110': 'occidente', // Engativá
  '1100109': 'occidente', // Fontibón
  '1100112': 'occidente', // Barrios Unidos
  '1100113': 'occidente', // Teusaquillo
  '1100108': 'sur', // Kennedy
  '1100107': 'sur', // Bosa
  '1100119': 'sur', // Ciudad Bolívar
  '1100106': 'sur', // Tunjuelito
  '1100116': 'sur', // Puente Aranda
  '1100114': 'sur', // Los Mártires
  '1100115': 'sur', // Antonio Nariño
  '1100102': 'oriente', // Chapinero
  '1100103': 'oriente', // Santa Fe
  '1100117': 'oriente', // La Candelaria
  '1100104': 'oriente', // San Cristóbal
  '1100118': 'oriente', // Rafael Uribe Uribe
  '1100105': 'oriente', // Usme
  '1100120': 'oriente', // Sumapaz
}

/** Corredor (sector) de una localidad de Bogotá, o null si no es una localidad de la tabla. */
export function corredorDeLocalidad(localityId: string | null | undefined): Corredor | null {
  const code = (localityId || '').trim()
  return code ? CORREDOR_DE_LOCALIDAD[code] ?? null : null
}

export interface LocalidadPorCorredor {
  kam_id: string
  corredor: Corredor
}

/**
 * Celda que el último recálculo le dio a cada corredor: la celda de Bogotá que más municipios del corredor recibieron
 * (filas 'ips' o 'reach' de municipality_zone). Las localidades sin IPS la usan en vez de `bogota_config.grupos`, así
 * guardar la configuración no las cambia antes de recalcular, igual que a los municipios y las IPS. Empate: el kam_id
 * menor (determinista). `esCelda` dice qué kam_id son celdas de Bogotá.
 */
export function celdasAplicadasPorCorredor(
  filas: Iterable<{ municipality_code: string; kam_id: string | null; kind: string }>,
  corredores: readonly CorredorRow[],
  esCelda: (kamId: string) => boolean
): Partial<Record<Corredor, string>> {
  const votos = new Map<Corredor, Map<string, number>>()
  for (const fila of Array.from(filas)) {
    if (!fila.kam_id || (fila.kind !== 'ips' && fila.kind !== 'reach') || !esCelda(fila.kam_id)) continue
    const corredor = resolveCorredor(fila.municipality_code, null, corredores)
    if (!corredor) continue
    const porCelda = votos.get(corredor) ?? new Map<string, number>()
    porCelda.set(fila.kam_id, (porCelda.get(fila.kam_id) ?? 0) + 1)
    votos.set(corredor, porCelda)
  }
  const grupos: Partial<Record<Corredor, string>> = {}
  votos.forEach((porCelda, corredor) => {
    const [celda] = Array.from(porCelda.entries()).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))[0]
    grupos[corredor] = celda
  })
  return grupos
}

/**
 * Celda de cada localidad de CORREDOR_DE_LOCALIDAD según `grupos` (en el servidor, los de celdasAplicadasPorCorredor),
 * solo si esa celda está entre las activas (activa y en la asignación). Sin grupos, o con la celda inactiva, la
 * localidad no sale y el mapa aplica la regla anterior.
 */
export function localidadesPorCorredor(
  config: Pick<BogotaConfig, 'grupos'> | null,
  activeCellIds: ReadonlySet<string>
): Record<string, LocalidadPorCorredor> {
  const localidades: Record<string, LocalidadPorCorredor> = {}
  if (!config) return localidades
  for (const [code, corredor] of Object.entries(CORREDOR_DE_LOCALIDAD)) {
    const kamId = celdaParaCorredor(corredor, config)
    if (kamId && activeCellIds.has(kamId)) localidades[code] = { kam_id: kamId, corredor }
  }
  return localidades
}

/**
 * Construye `grupos` para k a partir de la celda de cada corredor con k = 4.
 * receptoras[i] (opcional) elige la celda del grupo i de AGRUPACIONES_POR_K[k]; por defecto, la celda
 * del primer corredor del grupo.
 */
export function gruposParaK(
  k: BogotaK,
  celdaPorCorredor: Record<Corredor, string>,
  receptoras?: ReadonlyArray<string | null | undefined>
): Record<Corredor, string> {
  const grupos = {} as Record<Corredor, string>
  AGRUPACIONES_POR_K[k].forEach((grupo, index) => {
    const celda = receptoras?.[index] || celdaPorCorredor[grupo[0]]
    for (const corredor of grupo) grupos[corredor] = celda
  })
  return grupos
}

/**
 * Errores (en español) de unos `grupos` frente a k: corredores sin celda, corredores del mismo grupo
 * en celdas distintas, o grupos distintos en la misma celda. Lista vacía = válido.
 */
export function validarGrupos(k: BogotaK, grupos: Partial<Record<Corredor, string>>): string[] {
  const errores: string[] = []
  for (const corredor of CORREDORES) {
    if (!celdaParaCorredor(corredor, { grupos })) errores.push(`El corredor ${CORREDOR_LABEL[corredor]} no tiene celda asignada.`)
  }
  if (errores.length > 0) return errores
  const celdaDeGrupo: string[] = []
  for (const grupo of AGRUPACIONES_POR_K[k]) {
    const celdas = new Set(grupo.map(c => grupos[c] as string))
    if (celdas.size > 1) {
      errores.push(`Con k = ${k}, ${grupo.map(c => CORREDOR_LABEL[c]).join(' + ')} deben ir a la misma celda.`)
    }
    celdaDeGrupo.push(grupos[grupo[0]] as string)
  }
  if (errores.length === 0 && new Set(celdaDeGrupo).size !== celdaDeGrupo.length) {
    errores.push(`Con k = ${k} hacen falta ${k} celdas distintas (una por grupo).`)
  }
  return errores
}

/**
 * Normaliza una fila de `bogota_config` leída de la base. null si no hay fila o si k / tope no son
 * válidos (el motor vuelve entonces al comportamiento anterior: cada celda compite sola).
 * Las entradas de `grupos` que no son corredores o no son texto se descartan.
 */
export function parseBogotaConfig(row: unknown): BogotaConfig | null {
  if (!row || typeof row !== 'object') return null
  const r = row as Record<string, unknown>
  const k = Number(r.k)
  const max = Number(r.max_travel_minutes)
  if (!isBogotaK(k) || !Number.isInteger(max) || max <= 0) return null
  const grupos: Partial<Record<Corredor, string>> = {}
  const raw = r.grupos
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (isCorredor(key) && typeof value === 'string' && value.length > 0) grupos[key] = value
    }
  }
  return { k, max_travel_minutes: max, grupos }
}

/** Normaliza filas de `bogota_corredores` (descarta corredores desconocidos). */
export function parseCorredorRows(rows: unknown): CorredorRow[] {
  if (!Array.isArray(rows)) return []
  const out: CorredorRow[] = []
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    if (typeof r.department_code !== 'string' || !isCorredor(r.corredor)) continue
    out.push({
      department_code: r.department_code,
      municipality_code: typeof r.municipality_code === 'string' && r.municipality_code.length > 0 ? r.municipality_code : null,
      corredor: r.corredor,
      nota: typeof r.nota === 'string' ? r.nota : null,
    })
  }
  return out
}

// ---------------------------------------------------------------------------
// Semilla de `bogota_corredores` (la misma que siembra la migración; la simulación la usa en memoria
// mientras la tabla no exista o esté vacía).
// ---------------------------------------------------------------------------

const POR_DEPARTAMENTO: Array<[string, string, Corredor, string?]> = [
  // Norte
  ['15', 'Boyacá', 'norte'],
  ['68', 'Santander', 'norte'],
  ['54', 'Norte de Santander', 'norte'],
  ['20', 'Cesar', 'norte'],
  ['44', 'La Guajira', 'norte'],
  ['47', 'Magdalena', 'norte'],
  ['08', 'Atlántico', 'norte'],
  ['13', 'Bolívar', 'norte'],
  ['70', 'Sucre', 'norte'],
  ['23', 'Córdoba', 'norte'],
  // Occidente
  ['73', 'Tolima', 'occidente'],
  ['17', 'Caldas', 'occidente'],
  ['66', 'Risaralda', 'occidente'],
  ['63', 'Quindío', 'occidente'],
  ['05', 'Antioquia', 'occidente'],
  ['76', 'Valle del Cauca', 'occidente'],
  ['19', 'Cauca', 'occidente'],
  ['52', 'Nariño', 'occidente'],
  // Sur
  ['41', 'Huila', 'sur'],
  ['18', 'Caquetá', 'sur'],
  ['86', 'Putumayo', 'sur'],
  // Oriente
  ['50', 'Meta', 'oriente'],
  ['85', 'Casanare', 'oriente', 'Casanare entero al Oriente; el dueño puede cambiarlo (p. ej. Casanare norte al Norte).'],
  ['81', 'Arauca', 'oriente'],
  ['95', 'Guaviare', 'oriente'],
  ['99', 'Vichada', 'oriente'],
  ['97', 'Vaupés', 'oriente'],
  ['94', 'Guainía', 'oriente'],
  ['91', 'Amazonas', 'oriente'],
]

// Cundinamarca (25) por municipio según provincia (códigos DANE de la tabla municipalities, 116).
const CUNDINAMARCA: Array<[Corredor, string, Array<[string, string]>]> = [
  ['norte', 'Sabana Centro', [
    ['25126', 'Cajicá'], ['25175', 'Chía'], ['25200', 'Cogua'], ['25214', 'Cota'], ['25295', 'Gachancipá'],
    ['25486', 'Nemocón'], ['25758', 'Sopó'], ['25785', 'Tabio'], ['25799', 'Tenjo'], ['25817', 'Tocancipá'],
    ['25899', 'Zipaquirá'],
  ]],
  ['norte', 'Ubaté', [
    ['25154', 'Carmen de Carupa'], ['25224', 'Cucunubá'], ['25288', 'Fúquene'], ['25317', 'Guachetá'],
    ['25407', 'Lenguazaque'], ['25745', 'Simijaca'], ['25779', 'Susa'], ['25781', 'Sutatausa'], ['25793', 'Tausa'],
    ['25843', 'Villa de San Diego de Ubaté'],
  ]],
  ['norte', 'Almeidas', [
    ['25183', 'Chocontá'], ['25426', 'Machetá'], ['25436', 'Manta'], ['25736', 'Sesquilé'], ['25772', 'Suesca'],
    ['25807', 'Tibirita'], ['25873', 'Villapinzón'],
  ]],
  ['norte', 'Guavio norte', [['25322', 'Guasca'], ['25326', 'Guatavita']]],
  ['norte', 'Guavio (La Calera: salida natural por la vía a La Calera desde Chapinero/Usaquén)', [['25377', 'La Calera']]],
  ['occidente', 'Sabana Occidente', [
    ['25099', 'Bojacá'], ['25260', 'El Rosal'], ['25269', 'Facatativá'], ['25286', 'Funza'], ['25430', 'Madrid'],
    ['25473', 'Mosquera'], ['25769', 'Subachoque'], ['25898', 'Zipacón'],
  ]],
  ['occidente', 'Gualivá', [
    ['25019', 'Albán'], ['25398', 'La Peña'], ['25402', 'La Vega'], ['25489', 'Nimaima'], ['25491', 'Nocaima'],
    ['25592', 'Quebradanegra'], ['25658', 'San Francisco'], ['25718', 'Sasaima'], ['25777', 'Supatá'],
    ['25851', 'Útica'], ['25862', 'Vergara'], ['25875', 'Villeta'],
  ]],
  ['occidente', 'Rionegro', [
    ['25258', 'El Peñón'], ['25394', 'La Palma'], ['25513', 'Pacho'], ['25518', 'Paime'], ['25653', 'San Cayetano'],
    ['25823', 'Topaipí'], ['25871', 'Villagómez'], ['25885', 'Yacopí'],
  ]],
  ['occidente', 'Magdalena Centro', [
    ['25086', 'Beltrán'], ['25095', 'Bituima'], ['25168', 'Chaguaní'], ['25328', 'Guayabal de Síquima'],
    ['25580', 'Pulí'], ['25662', 'San Juan de Rioseco'], ['25867', 'Vianí'],
  ]],
  ['occidente', 'Bajo Magdalena', [['25148', 'Caparrapí'], ['25320', 'Guaduas'], ['25572', 'Puerto Salgar']]],
  ['sur', 'Soacha', [['25740', 'Sibaté'], ['25754', 'Soacha']]],
  ['sur', 'Sumapaz', [
    ['25053', 'Arbeláez'], ['25120', 'Cabrera'], ['25290', 'Fusagasugá'], ['25312', 'Granada'], ['25524', 'Pandi'],
    ['25535', 'Pasca'], ['25649', 'San Bernardo'], ['25743', 'Silvania'], ['25805', 'Tibacuy'], ['25506', 'Venecia'],
  ]],
  ['sur', 'Alto Magdalena', [
    ['25001', 'Agua de Dios'], ['25307', 'Girardot'], ['25324', 'Guataquí'], ['25368', 'Jerusalén'],
    ['25483', 'Nariño'], ['25488', 'Nilo'], ['25612', 'Ricaurte'], ['25815', 'Tocaima'],
  ]],
  ['sur', 'Tequendama', [
    ['25035', 'Anapoima'], ['25040', 'Anolaima'], ['25599', 'Apulo'], ['25123', 'Cachipay'], ['25245', 'El Colegio'],
    ['25386', 'La Mesa'], ['25596', 'Quipile'], ['25645', 'San Antonio del Tequendama'], ['25797', 'Tena'],
    ['25878', 'Viotá'],
  ]],
  ['oriente', 'Oriente', [
    ['25151', 'Cáqueza'], ['25178', 'Chipaque'], ['25181', 'Choachí'], ['25279', 'Fómeque'], ['25281', 'Fosca'],
    ['25335', 'Guayabetal'], ['25339', 'Gutiérrez'], ['25594', 'Quetame'], ['25841', 'Ubaque'], ['25845', 'Une'],
  ]],
  ['oriente', 'Medina', [['25438', 'Medina'], ['25530', 'Paratebueno']]],
  ['oriente', 'Guavio sur', [
    ['25297', 'Gachetá'], ['25372', 'Junín'], ['25299', 'Gama'], ['25839', 'Ubalá'], ['25293', 'Gachalá'],
  ]],
]

/**
 * Semilla aprobada (2026-10-11): 29 filas por departamento + 116 municipios de Cundinamarca.
 * Bogotá (11), Chocó (27) y San Andrés (88) no tienen corredor (Bogotá no compite hacia sí misma;
 * Chocó y San Andrés están excluidos y sin ruta útil desde Bogotá).
 */
export const SEMILLA_CORREDORES: readonly CorredorRow[] = [
  ...POR_DEPARTAMENTO.map(([department_code, nombre, corredor, nota]) => ({
    department_code,
    municipality_code: null,
    corredor,
    nota: nota ?? `${nombre}: departamento entero al corredor ${CORREDOR_LABEL[corredor]}.`,
  })),
  ...CUNDINAMARCA.flatMap(([corredor, provincia, municipios]) =>
    municipios.map(([municipality_code, nombre]) => ({
      department_code: '25',
      municipality_code,
      corredor,
      nota: `${nombre} (provincia ${provincia}) -> ${CORREDOR_LABEL[corredor]}.`,
    }))
  ),
]

/**
 * `grupos` por defecto para k a partir de las celdas activas (area_id -> kam_id) usando
 * CELDA_AREA_POR_CORREDOR. Devuelve null si falta alguna de las cuatro celdas base.
 */
export function gruposPorDefecto(
  k: BogotaK,
  celdas: ReadonlyArray<{ id: string; area_id: string }>
): Record<Corredor, string> | null {
  const porArea = new Map(celdas.map(c => [c.area_id, c.id]))
  const celdaPorCorredor = {} as Record<Corredor, string>
  for (const corredor of CORREDORES) {
    const id = porArea.get(CELDA_AREA_POR_CORREDOR[corredor])
    if (!id) return null
    celdaPorCorredor[corredor] = id
  }
  return gruposParaK(k, celdaPorCorredor)
}
