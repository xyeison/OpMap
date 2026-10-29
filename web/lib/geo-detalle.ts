// Detalle de los polígonos al acercar (dueño, 2026-10-29: los colores deben seguir las fronteras reales del DANE).
// Funciones PURAS, sin E/S: las usa el mapa (components/MapComponent.tsx) y las prueba scripts/geo-detalle-check.ts.
// Spec: docs/specs/2026-10-29-mapa-poligonos-dane.md
//
// La vista de país (public/geo/municipios.json y localidades.json) es liviana. Desde DETALLE_ZOOM el mapa pide
// public/geo/detalle/<dd>.json de cada departamento que se ve y lo pinta en lugar de su versión liviana; al alejar
// vuelve a la vista de país. Los dos niveles salen de scripts/build-geojson.ts y en cada uno los vecinos comparten la
// misma frontera. Para no juntar los dos niveles en un borde, el detalle cambia por lotes: se pinta cuando llegaron
// todos los departamentos que se ven (mientras tanto sigue el lote anterior) y, si uno falla, vuelve la vista de país.

/** Zoom desde el que se pinta el detalle */
export const DETALLE_ZOOM = 10
/** Archivo de detalle de las 20 localidades de Bogotá */
export const DEPTO_LOCALIDADES = '11'
/** Margen alrededor de la vista (fracción del ancho y del alto): se pide también lo que está por entrar */
export const MARGEN_VISTA = 0.1

export const urlDetalle = (depto: string) => `/geo/detalle/${depto}.json`

/** [oeste, sur, este, norte] en grados */
export type Rectangulo = [number, number, number, number]

type Geometria = { type: string; coordinates: unknown } | null | undefined
export type FeatureGeo = { type?: string; properties?: { code?: string; dept?: string } | null; geometry?: Geometria }

/** Departamento de un territorio: properties.dept o los dos primeros dígitos del código (localidad → 11) */
export function deptoDe(feature: FeatureGeo): string {
  const dept = String(feature.properties?.dept ?? '').trim()
  return /^\d{2}$/.test(dept) ? dept : String(feature.properties?.code ?? '').slice(0, 2)
}

function extender(r: Rectangulo | null, nodo: unknown): Rectangulo | null {
  if (!Array.isArray(nodo)) return r
  if (nodo.length >= 2 && typeof nodo[0] === 'number' && typeof nodo[1] === 'number') {
    const [lng, lat] = nodo as number[]
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return r
    if (!r) return [lng, lat, lng, lat]
    return [Math.min(r[0], lng), Math.min(r[1], lat), Math.max(r[2], lng), Math.max(r[3], lat)]
  }
  for (const hijo of nodo) r = extender(r, hijo)
  return r
}

/**
 * Rectángulos de cada municipio (o localidad), agrupados por departamento, con los polígonos de la vista de país.
 * Por municipio y no por departamento: el rectángulo de un departamento grande (Meta, Tolima) toca vistas donde no
 * se ve ninguno de sus municipios.
 */
export function rectangulosPorDepto(features: readonly FeatureGeo[]): Record<string, Rectangulo[]> {
  const out: Record<string, Rectangulo[]> = {}
  for (const f of features) {
    const depto = deptoDe(f)
    if (!depto || !f.geometry) continue
    const r = extender(null, f.geometry.coordinates)
    if (r) (out[depto] ||= []).push(r)
  }
  return out
}

/**
 * Departamentos con algún municipio cuyo rectángulo toca la vista ampliada con MARGEN_VISTA, en orden. Vacío por
 * debajo de DETALLE_ZOOM.
 */
export function deptosEnVista(vista: Rectangulo, zoom: number, rectangulos: Readonly<Record<string, readonly Rectangulo[]>>): string[] {
  if (!(zoom >= DETALLE_ZOOM)) return []
  const dx = (vista[2] - vista[0]) * MARGEN_VISTA
  const dy = (vista[3] - vista[1]) * MARGEN_VISTA
  const [oeste, sur, este, norte] = [vista[0] - dx, vista[1] - dy, vista[2] + dx, vista[3] + dy]
  return Object.keys(rectangulos)
    .filter(depto => rectangulos[depto].some(r => r[0] <= este && r[2] >= oeste && r[1] <= norte && r[3] >= sur))
    .sort()
}

/**
 * Departamentos que deben llevar detalle tras mover el mapa: los que se ven, o ninguno por debajo de DETALLE_ZOOM.
 * Solo los que se ven: así el trabajo de cada zoom no crece al recorrer el país de cerca. Devuelve `antes` si no
 * cambia nada (el mapa no vuelve a pintar).
 */
export function siguientesDeptos(antes: readonly string[], visibles: readonly string[], zoom: number): readonly string[] {
  const siguiente = zoom >= DETALLE_ZOOM ? Array.from(new Set(visibles)).sort() : []
  return siguiente.join(',') === antes.join(',') ? antes : siguiente
}

/** Detalle pedido para unos departamentos: listo (llegaron todos), cargando o con error (falló alguno) */
export type LoteDetalle<T = FeatureGeo> = { estado: 'listo' | 'cargando' | 'error'; detalle: Record<string, T[]> }

/** Arma el lote con las respuestas, en el mismo orden que `deptos` */
export function loteDetalle<T = FeatureGeo>(
  deptos: readonly string[],
  respuestas: ReadonlyArray<{ data?: unknown; isError?: boolean }>
): LoteDetalle<T> {
  if (respuestas.some(r => r.isError)) return { estado: 'error', detalle: {} }
  const detalle: Record<string, T[]> = {}
  for (let i = 0; i < deptos.length; i++) {
    const features = (respuestas[i]?.data as { features?: unknown } | undefined)?.features
    if (!Array.isArray(features)) return { estado: 'cargando', detalle: {} }
    detalle[deptos[i]] = features as T[]
  }
  return { estado: 'listo', detalle }
}

/** Detalle que se pinta: el lote cuando está listo, el anterior mientras carga, ninguno (vista de país) si falló */
export function detalleVigente<T>(anterior: Record<string, T[]>, lote: LoteDetalle<T>): Record<string, T[]> {
  if (lote.estado === 'listo') return lote.detalle
  if (lote.estado === 'error') return Object.keys(anterior).length === 0 ? anterior : {}
  return anterior
}

/** Las features agrupadas por departamento */
export function porDepto<T extends FeatureGeo>(features: readonly T[]): Record<string, T[]> {
  const out: Record<string, T[]> = {}
  for (const f of features) {
    const depto = deptoDe(f)
    ;(out[depto] ||= []).push(f)
  }
  return out
}

/** La vista de país con las features de cada departamento que tiene detalle cambiadas por las de su detalle */
export function combinarDetalle<T extends FeatureGeo>(pais: readonly T[], detalle: Readonly<Record<string, readonly T[]>>): T[] {
  const conDetalle = new Set(Object.keys(detalle))
  if (conDetalle.size === 0) return [...pais]
  const out = pais.filter(f => !conDetalle.has(deptoDe(f)))
  const deptosPais = new Set(pais.map(deptoDe))
  for (const depto of Object.keys(detalle).sort()) {
    // Solo los departamentos de esta colección (el detalle de las localidades no entra en la de municipios)
    if (deptosPais.has(depto)) out.push(...detalle[depto])
  }
  return out
}
