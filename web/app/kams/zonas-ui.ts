// Helpers puros de presentación de la página "Zonas" (/kams; spec docs/specs/2026-10-23-zonas-por-linea-para-lideres.md):
// textos del estado de una Zona en la línea elegida, formato de minutos y cifras, agrupación de las celdas de Bogotá,
// resumen por estado y las reglas de los botones "Darle <línea> a…" / "Quitarle <línea>" (quién ya la lleva, a quién la
// dirección la limitó). Sin React, sin red y sin estado, para que page.tsx solo arme la pantalla y estas reglas se
// puedan leer (y probar) aparte. Contrato de datos: web/lib/types/zonas.ts (GET /api/kams/zonas?line=<code>).
// Vocabulario visible: "Ejecutivo Comercial", "Zona", "Sin cobertura" (la celda sin nadie; la vacante por contratar es
// una persona más y cuenta como "Reservada").
import { formatCopCompact } from '@/lib/giros-format'
import { ESTADO_PLAZA_LABELS, ESTADOS_PLAZA, type EstadoPlaza, type ZonaCifras, type ZonaEnLinea, type ZonaFila, type ZonaResidente, type ZonasResponse } from '@/lib/types/zonas'
import { fechaEs, rangoMesesEs } from '@/lib/zona-estadisticas'
import { zoneDisplayName } from '@/lib/zone-names'

// ---------------------------------------------------------------------------
// Estados: colores y textos
// ---------------------------------------------------------------------------

/** Insignia por estado: ocupada verde, reservada ámbar, por alcance azul, sin cobertura gris, conflicto rojo. */
export const ESTADO_BADGE: Record<EstadoPlaza, string> = {
  ocupada: 'bg-green-50 text-green-700 border-green-200',
  reservada: 'bg-amber-50 text-amber-800 border-amber-300',
  alcance: 'bg-blue-50 text-blue-700 border-blue-200',
  sin_cobertura: 'bg-gray-100 text-gray-600 border-gray-300',
  conflicto: 'bg-red-50 text-red-700 border-red-300',
}

/** Texto de los chips de resumen de la línea (en plural donde el español lo pide). */
export const ESTADO_PLAZA_PLURAL: Record<EstadoPlaza, string> = {
  ocupada: 'Ocupadas',
  reservada: 'Reservadas',
  alcance: 'Por alcance',
  sin_cobertura: 'Sin cobertura',
  conflicto: 'Conflicto',
}

/** Insignia "Sin equipo" (line_zones.has_equipment = false): borde punteado, como en /lines. */
export const CLASE_SIN_EQUIPO =
  'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border border-dashed border-gray-400 text-gray-600 whitespace-nowrap'

/** "2 h 30", "5 h 08", "45 min"; null → "—". Formato de la spec (sin "min" cuando hay horas). */
export function minutosCortos(minutos: number | null | undefined): string {
  if (minutos === null || minutos === undefined || !Number.isFinite(minutos)) return '—'
  const total = Math.max(0, Math.round(minutos))
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m} min`
  return `${h} h ${String(m).padStart(2, '0')}`
}

/** 12.345 (es-CO); null → "—". */
export function numero(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return '—'
  return Math.round(valor).toLocaleString('es-CO')
}

/** Nombre visible de una Zona: sin el prefijo heredado "KAM ". */
export function nombreZona(nombre: string | null | undefined): string {
  return zoneDisplayName(nombre) || (nombre ?? '')
}

/**
 * Estado de la Zona en la línea, en dos partes: la insignia (titulo) y el detalle de al lado.
 *   Ocupada · <nombre> (· ajuste manual desde <zona> si lo forzaron de otra ciudad)
 *   Reservada · Vacante <ciudad>
 *   Por alcance · <nombre> desde <zona> · 2 h 30
 *   Sin cobertura (más cercana: <nombre>, 5 h 08)
 *   Conflicto: <nombres> (la nota del cálculo)
 */
export function textoEstado(enLinea: ZonaEnLinea): { titulo: string; detalle: string | null } {
  const titulo = ESTADO_PLAZA_LABELS[enLinea.estado]
  const nombre = enLinea.ejecutivo?.nombre ?? null
  switch (enLinea.estado) {
    case 'ocupada':
    case 'reservada': {
      if (!nombre) return { titulo, detalle: null }
      const ajuste = enLinea.desde
        ? ` · ajuste manual desde ${enLinea.desde.nombre}${enLinea.minutos !== null && enLinea.minutos > 0 ? ` · ${minutosCortos(enLinea.minutos)}` : ''}`
        : ''
      return { titulo, detalle: `${nombre}${ajuste}` }
    }
    case 'alcance': {
      if (!nombre) return { titulo, detalle: null }
      const desde = enLinea.desde ? ` desde ${enLinea.desde.nombre}` : ''
      const minutos = enLinea.minutos !== null ? ` · ${minutosCortos(enLinea.minutos)}` : ''
      return { titulo, detalle: `${nombre}${desde}${minutos}` }
    }
    case 'sin_cobertura':
      return {
        titulo,
        detalle: enLinea.masCercano ? `más cercana: ${enLinea.masCercano.nombre}, ${minutosCortos(enLinea.masCercano.minutos)}` : null,
      }
    case 'conflicto':
      return { titulo, detalle: enLinea.nota }
  }
}

/** El estado en una sola línea de texto (tarjetas, títulos): "Sin cobertura (más cercana: Ana, 5 h 08)". */
export function textoEstadoCompleto(enLinea: ZonaEnLinea): string {
  const { titulo, detalle } = textoEstado(enLinea)
  if (!detalle) return titulo
  if (enLinea.estado === 'sin_cobertura') return `${titulo} (${detalle})`
  if (enLinea.estado === 'conflicto') return `${titulo}: ${detalle}`
  return `${titulo} · ${detalle}`
}

// ---------------------------------------------------------------------------
// Cifras de la Zona ("Qué hay")
// ---------------------------------------------------------------------------

/** Nombre visible de la fuente de los giros (ZonaCifras.girosFuente). */
export function fuenteGiros(fuente: string | null | undefined): string {
  if (fuente === 'identifica') return 'Identifica tu Giro'
  if (fuente === 'reporte29') return 'Reporte 29'
  return fuente ? fuente : 'ADRES'
}

export interface ResumenCifras {
  ips: string
  municipios: string
  municipiosDetalle: string
  poblacion: string | null
  poblacionFuente: string
  afiliados: string | null
  afiliadosFuente: string
  giros: string | null
  girosFuente: string
  departamentos: string[]
}

/** Las cifras de una Zona (o del grupo de Bogotá) ya formateadas para la columna "Qué hay". */
export function resumenCifras(cifras: ZonaCifras): ResumenCifras {
  const compartidos = cifras.municipiosCompartidos > 0 ? ` · ${numero(cifras.municipiosCompartidos)} compartidos` : ''
  const ventana = cifras.girosDesde && cifras.girosHasta ? ` · ${rangoMesesEs(cifras.girosDesde, cifras.girosHasta)}` : ''
  return {
    ips: `${numero(cifras.ips)} IPS · ${numero(cifras.camas)} camas`,
    municipios: `${numero(cifras.municipios)} ${cifras.municipios === 1 ? 'municipio' : 'municipios'}`,
    municipiosDetalle: `${numero(cifras.municipiosConIps)} con IPS · ${numero(cifras.municipiosAlcance)} de alcance${compartidos}`,
    poblacion: cifras.poblacion !== null ? `${numero(cifras.poblacion)} hab.` : null,
    poblacionFuente: cifras.poblacionAnio ? `DANE ${cifras.poblacionAnio}` : 'DANE',
    afiliados: cifras.afiliados !== null ? `${numero(cifras.afiliados)} afiliados` : null,
    afiliadosFuente: cifras.afiliadosCorte ? `BDUA · corte ${fechaEs(cifras.afiliadosCorte)}` : 'BDUA',
    giros: cifras.giros12m !== null ? formatCopCompact(cifras.giros12m) : null,
    girosFuente: `${fuenteGiros(cifras.girosFuente)}${ventana}`,
    departamentos: cifras.departamentos,
  }
}

// ---------------------------------------------------------------------------
// Filas de la tabla: una por Zona, Bogotá agrupada
// ---------------------------------------------------------------------------

export type FilaZonas =
  | { tipo: 'zona'; clave: string; nombre: string; zona: ZonaFila }
  | { tipo: 'bogota'; clave: 'bogota'; nombre: string; cifras: ZonaCifras; celdas: ZonaFila[]; kam_ids: string[] }

export function filaDeZona(zona: ZonaFila): FilaZonas {
  return { tipo: 'zona', clave: zona.kam_id, nombre: nombreZona(zona.nombre), zona }
}

const porNombre = (a: { nombre: string }, b: { nombre: string }) => nombreZona(a.nombre).localeCompare(nombreZona(b.nombre), 'es')

/**
 * Una fila por Zona, ordenadas por nombre, con las celdas de Bogotá (ZonasResponse.bogota.kam_ids, o zona.bogota)
 * agrupadas en una sola fila "Bogotá (4 zonas)" con el total del grupo y sus celdas debajo. Sin `bogota` en la
 * respuesta no hay con qué totalizar: las celdas salen como Zonas sueltas.
 */
export function agruparBogota(data: Pick<ZonasResponse, 'zonas' | 'bogota'>): FilaZonas[] {
  const grupo = data.bogota && data.bogota.kam_ids.length > 0 ? new Set(data.bogota.kam_ids) : null
  const filas: FilaZonas[] = []
  const celdas: ZonaFila[] = []
  for (const zona of data.zonas) {
    if (grupo && (grupo.has(zona.kam_id) || zona.bogota)) celdas.push(zona)
    else filas.push(filaDeZona(zona))
  }
  if (data.bogota && grupo && celdas.length > 0) {
    celdas.sort(porNombre)
    filas.push({
      tipo: 'bogota',
      clave: 'bogota',
      nombre: `Bogotá (${celdas.length} ${celdas.length === 1 ? 'zona' : 'zonas'})`,
      cifras: data.bogota.cifras,
      celdas,
      kam_ids: celdas.map(celda => celda.kam_id),
    })
  }
  return filas.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

/** Zonas de una fila (la Zona, o las celdas de Bogotá). */
export function zonasDeFila(fila: FilaZonas): ZonaFila[] {
  return fila.tipo === 'zona' ? [fila.zona] : fila.celdas
}

const normalizar = (texto: string | null | undefined) =>
  (texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()

/** Filtra por nombre de Zona, ciudad base, departamento o nombre de quien vive en ella (sin tildes ni mayúsculas). */
export function filtrarFilas(filas: FilaZonas[], busqueda: string): FilaZonas[] {
  const q = normalizar(busqueda)
  if (!q) return filas
  return filas.filter(fila => {
    const partes = [fila.nombre]
    for (const zona of zonasDeFila(fila)) {
      partes.push(nombreZona(zona.nombre), zona.ciudad_base ?? '', zona.departamento ?? '', ...zona.cifras.departamentos)
      for (const residente of zona.residentes) partes.push(residente.nombre)
    }
    return normalizar(partes.join(' ')).includes(q)
  })
}

// ---------------------------------------------------------------------------
// Resumen de la línea (chips)
// ---------------------------------------------------------------------------

export interface ResumenEstados {
  porEstado: Record<EstadoPlaza, number>
  sinEquipo: number
  /** Zonas con estado (enLinea distinto de null). */
  conLinea: number
}

export function resumenEstados(zonas: ReadonlyArray<ZonaFila>): ResumenEstados {
  const porEstado = Object.fromEntries(ESTADOS_PLAZA.map(estado => [estado, 0])) as Record<EstadoPlaza, number>
  let sinEquipo = 0
  let conLinea = 0
  for (const zona of zonas) {
    if (!zona.enLinea) continue
    conLinea += 1
    porEstado[zona.enLinea.estado] += 1
    if (zona.enLinea.sinEquipo) sinEquipo += 1
  }
  return { porEstado, sinEquipo, conLinea }
}

// ---------------------------------------------------------------------------
// Líneas y residentes: nombres y reglas de los botones
// ---------------------------------------------------------------------------

/**
 * Nombre visible de una línea a partir de su código. Las líneas que el usuario no ve no vienen en ZonasResponse.lineas,
 * pero sí pueden aparecer entre las de quien vive en la Zona: se muestra el código legible ("medicina_deportiva" →
 * "Medicina deportiva") antes que nada.
 */
export function nombreLinea(code: string, lineas: ReadonlyArray<{ code: string; name: string }>): string {
  const linea = lineas.find(item => item.code === code)
  if (linea) return linea.name
  const texto = code.replace(/[_-]+/g, ' ').trim()
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : code
}

/** Restricción de la dirección sobre una persona o vacante: null si no hay (null o lista vacía = sin restricción). */
export function restriccionDe(residente: Pick<ZonaResidente, 'lineasPermitidas'>): string[] | null {
  return residente.lineasPermitidas && residente.lineasPermitidas.length > 0 ? residente.lineasPermitidas : null
}

/** "solo puede tener: Sustitutos óseos, Reemplazo articular", o null si la dirección no la limitó. */
export function textoRestriccion(residente: ZonaResidente, lineas: ReadonlyArray<{ code: string; name: string }>): string | null {
  const permitidas = restriccionDe(residente)
  if (!permitidas) return null
  return `solo puede tener: ${permitidas.map(code => nombreLinea(code, lineas)).join(', ')}`
}

/** ¿Lleva la línea hoy? (entonces se le puede quitar). */
export function puedeQuitar(residente: Pick<ZonaResidente, 'lineas'>, lineaCode: string): boolean {
  return residente.lineas.includes(lineaCode)
}

/**
 * Por qué NO se le puede dar la línea a quien vive en la Zona (texto para el botón deshabilitado), o null si sí.
 * La API vuelve a validarlo: 409 "La dirección limitó a <nombre> a: <líneas>".
 */
export function motivoNoPuedeDar(
  residente: ZonaResidente,
  linea: { code: string; name: string },
  lineas: ReadonlyArray<{ code: string; name: string }>
): string | null {
  if (residente.lineas.includes(linea.code)) return `${residente.nombre} ya lleva ${linea.name}`
  const permitidas = restriccionDe(residente)
  if (permitidas && !permitidas.includes(linea.code)) {
    return `La dirección limitó a ${residente.nombre} a: ${permitidas.map(code => nombreLinea(code, lineas)).join(', ')}`
  }
  return null
}
