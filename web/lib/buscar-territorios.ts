// Buscador de municipios del mapa (dueño, 2026-10-28: "si alguien esta en el mapa y escribe 'Yop' que pueda salir los
// municipios y si le doy clic que me lleve a ese municipio con zoom moderado"). Funciones PURAS, sin E/S: las usa el
// mapa (components/MapSearchBox.tsx) y las prueba scripts/mapa-buscar-check.ts.
//
// Se busca en los 1.121 municipios (sin Bogotá, que se pinta por localidades), las 20 localidades de Bogotá y la
// ciudad de Bogotá. Sin importar tildes ni mayúsculas ("cucuta" encuentra Cúcuta). Orden: el nombre empieza por lo
// escrito; luego una palabra del nombre empieza por lo escrito ("gai" → Puerto Gaitán); luego lo contiene. A igualdad,
// el nombre más corto y después el orden alfabético.

/** Departamentos de Colombia por código DANE (los mismos de /api/locations/departments). */
export const DEPARTAMENTOS: Readonly<Record<string, string>> = {
  '05': 'Antioquia',
  '08': 'Atlántico',
  '11': 'Bogotá D.C.',
  '13': 'Bolívar',
  '15': 'Boyacá',
  '17': 'Caldas',
  '18': 'Caquetá',
  '19': 'Cauca',
  '20': 'Cesar',
  '23': 'Córdoba',
  '25': 'Cundinamarca',
  '27': 'Chocó',
  '41': 'Huila',
  '44': 'La Guajira',
  '47': 'Magdalena',
  '50': 'Meta',
  '52': 'Nariño',
  '54': 'Norte de Santander',
  '63': 'Quindío',
  '66': 'Risaralda',
  '68': 'Santander',
  '70': 'Sucre',
  '73': 'Tolima',
  '76': 'Valle del Cauca',
  '81': 'Arauca',
  '85': 'Casanare',
  '86': 'Putumayo',
  '88': 'San Andrés y Providencia',
  '91': 'Amazonas',
  '94': 'Guainía',
  '95': 'Guaviare',
  '97': 'Vaupés',
  '99': 'Vichada',
}

/** Nombres con tildes de las 20 localidades (el GeoJSON los trae sin tildes: "Usaquen", "los Martires"). */
export const LOCALIDADES_BOGOTA: Readonly<Record<string, string>> = {
  '1100101': 'Usaquén',
  '1100102': 'Chapinero',
  '1100103': 'Santa Fe',
  '1100104': 'San Cristóbal',
  '1100105': 'Usme',
  '1100106': 'Tunjuelito',
  '1100107': 'Bosa',
  '1100108': 'Kennedy',
  '1100109': 'Fontibón',
  '1100110': 'Engativá',
  '1100111': 'Suba',
  '1100112': 'Barrios Unidos',
  '1100113': 'Teusaquillo',
  '1100114': 'Los Mártires',
  '1100115': 'Antonio Nariño',
  '1100116': 'Puente Aranda',
  '1100117': 'La Candelaria',
  '1100118': 'Rafael Uribe Uribe',
  '1100119': 'Ciudad Bolívar',
  '1100120': 'Sumapaz',
}

/** Código del resultado "Bogotá D.C." (la ciudad: el mapa la encuadra por sus localidades urbanas, sin Sumapaz). */
export const BOGOTA_CIUDAD = '11001'

export type TipoTerritorio = 'municipio' | 'localidad' | 'ciudad'

export interface TerritorioBuscable {
  /** Código DANE: municipio (5 dígitos), localidad (7) o la ciudad de Bogotá (11001) */
  code: string
  nombre: string
  /** Lo que va después de la coma: el departamento, o "Bogotá D.C. · localidad" */
  detalle: string
  tipo: TipoTerritorio
}

/** Minúsculas, sin tildes ni diéresis y con un solo espacio entre palabras. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Mínimo de letras para buscar ("Yo" ya muestra Yopal, Yolombó...). */
export const MIN_LETRAS = 2

/**
 * Territorios que coinciden con lo escrito, en orden: empieza por (0), una palabra empieza por (1), contiene (2); a
 * igualdad, nombre más corto y después alfabético (es). Como mucho `limite`. Vacío con menos de MIN_LETRAS letras.
 */
export function buscarTerritorios(termino: string, lista: readonly TerritorioBuscable[], limite = 8): TerritorioBuscable[] {
  const t = normalizar(termino)
  if (t.length < MIN_LETRAS) return []
  const conRango: Array<{ territorio: TerritorioBuscable; rango: number; nombre: string }> = []
  for (const territorio of lista) {
    const nombre = normalizar(territorio.nombre)
    let rango = -1
    if (nombre.startsWith(t)) rango = 0
    else if (nombre.split(/[\s-]+/).some(palabra => palabra.startsWith(t))) rango = 1
    else if (nombre.includes(t)) rango = 2
    if (rango >= 0) conRango.push({ territorio, rango, nombre })
  }
  conRango.sort(
    (a, b) =>
      a.rango - b.rango ||
      a.nombre.length - b.nombre.length ||
      a.territorio.nombre.localeCompare(b.territorio.nombre, 'es') ||
      a.territorio.detalle.localeCompare(b.territorio.detalle, 'es')
  )
  return conRango.slice(0, limite).map(item => item.territorio)
}

/** Texto de un resultado: "Yopal, Casanare" · "Usaquén, Bogotá D.C. · localidad". */
export function etiquetaTerritorio(territorio: Pick<TerritorioBuscable, 'nombre' | 'detalle'>): string {
  return territorio.detalle ? `${territorio.nombre}, ${territorio.detalle}` : territorio.nombre
}

type Posicion = number[]
type Geometria = { type: string; coordinates: unknown } | null | undefined

/**
 * Rectángulo [[sur, oeste], [norte, este]] de una o varias geometrías GeoJSON (Polygon o MultiPolygon), para encuadrar
 * el mapa. null si no hay coordenadas.
 */
export function rectanguloDeGeometrias(geometrias: readonly Geometria[]): [[number, number], [number, number]] | null {
  let sur = Infinity
  let oeste = Infinity
  let norte = -Infinity
  let este = -Infinity
  const visitar = (nodo: unknown) => {
    if (!Array.isArray(nodo)) return
    if (nodo.length >= 2 && typeof nodo[0] === 'number' && typeof nodo[1] === 'number') {
      const [lng, lat] = nodo as Posicion
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        sur = Math.min(sur, lat)
        norte = Math.max(norte, lat)
        oeste = Math.min(oeste, lng)
        este = Math.max(este, lng)
      }
      return
    }
    for (const hijo of nodo) visitar(hijo)
  }
  for (const geometria of geometrias) {
    if (geometria && (geometria.type === 'Polygon' || geometria.type === 'MultiPolygon')) visitar(geometria.coordinates)
  }
  return Number.isFinite(sur) ? [[sur, oeste], [norte, este]] : null
}

/**
 * Lista para el buscador a partir de las capas del mapa: municipios (nombre de la base si existe), las localidades con
 * su nombre con tildes y la ciudad de Bogotá (si hay localidades).
 */
export function territoriosBuscables(
  municipios: ReadonlyArray<{ code: string; name?: string | null; dept?: string | null }>,
  localidades: ReadonlyArray<{ code: string; name?: string | null }>,
  nombreDeMunicipio: (code: string) => string | null | undefined
): TerritorioBuscable[] {
  const lista: TerritorioBuscable[] = []
  for (const m of municipios) {
    const nombre = (nombreDeMunicipio(m.code) || m.name || '').trim()
    if (!nombre) continue
    const dept = (m.dept || m.code.slice(0, 2)).padStart(2, '0')
    lista.push({ code: m.code, nombre, detalle: DEPARTAMENTOS[dept] ?? '', tipo: 'municipio' })
  }
  for (const l of localidades) {
    const nombre = LOCALIDADES_BOGOTA[l.code] ?? (l.name || '').trim()
    if (!nombre) continue
    lista.push({ code: l.code, nombre, detalle: 'Bogotá D.C. · localidad', tipo: 'localidad' })
  }
  if (localidades.length > 0) lista.push({ code: BOGOTA_CIUDAD, nombre: 'Bogotá D.C.', detalle: 'ciudad', tipo: 'ciudad' })
  return lista
}

/** Sumapaz: localidad rural enorme; la ciudad de Bogotá se encuadra sin ella. */
export const SUMAPAZ = '1100120'

type ConGeometria = { properties?: { code?: string } | null; geometry?: Geometria }

/** Geometrías que encuadran un resultado: su polígono, o las localidades urbanas para la ciudad de Bogotá. */
export function geometriasDeTerritorio(code: string, municipios: readonly ConGeometria[], localidades: readonly ConGeometria[]): Geometria[] {
  if (code === BOGOTA_CIUDAD) {
    return localidades.filter(f => f.properties?.code !== SUMAPAZ).map(f => f.geometry)
  }
  const capa = code.length === 7 ? localidades : municipios
  return capa.filter(f => f.properties?.code === code).map(f => f.geometry)
}
