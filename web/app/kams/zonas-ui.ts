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
/** Quien atiende, con "(por contratar)" si es una vacante (sin repetir "vacante" cuando el nombre ya empieza así). */
function quienAtiende(persona: { nombre: string; status: 'active' | 'placeholder' } | null | undefined): string | null {
  if (!persona) return null
  if (persona.status !== 'placeholder') return persona.nombre
  return /^vacante\b/i.test(persona.nombre) ? `${persona.nombre} (por contratar)` : `la vacante ${persona.nombre} (por contratar)`
}

/** Lo que textoEstado necesita de la línea elegida: su nombre y el tope de alcance (minutos). */
export interface LineaParaTexto {
  name: string
  max_reach_minutes?: number | null
}

/**
 * El estado de una Zona en la línea, en lenguaje llano (dueño, 2026-10-23: "necesito mejor usabilidad"):
 *   Ocupada       → "La atiende Joana, que vive en la Zona."
 *   Reservada     → "Reservada para Vacante Barranquilla (por contratar), que vive en la Zona."
 *   Por alcance   → "La atiende Vacante Barranquilla (por contratar) desde Barranquilla, a 2 h 26 por carretera."
 *   Sin cobertura → "Nadie que lleve Medicina deportiva llega en menos de 4 h por carretera. La más cercana es
 *                    Vacante Bogotá (por contratar), a 9 h 15."
 *   Conflicto     → "Más de una persona de la Zona lleva Medicina deportiva: Ana y Beto. Resuélvelo con un ajuste manual."
 */
export function textoEstado(enLinea: ZonaEnLinea, linea?: LineaParaTexto | null): { titulo: string; detalle: string | null } {
  const titulo = ESTADO_PLAZA_LABELS[enLinea.estado]
  const quien = quienAtiende(enLinea.ejecutivo)
  const nombreLinea = linea?.name ?? 'la línea'
  const porCarretera = (minutos: number | null | undefined) => (minutos !== null && minutos !== undefined && minutos > 0 ? `, a ${minutosCortos(minutos)} por carretera` : '')
  switch (enLinea.estado) {
    // Ocupada/Reservada con `desde`: por ajuste manual (ajuste ≠ null) o, dentro de Bogotá, porque vive en otra celda de
    // la misma ciudad (la ruta lo marca así: "Bogotá compite como una ciudad").
    case 'ocupada': {
      if (!quien) return { titulo, detalle: null }
      if (enLinea.desde && enLinea.ajuste) return { titulo, detalle: `La atiende ${quien} por ajuste manual desde ${enLinea.desde.nombre}${porCarretera(enLinea.minutos)}.` }
      if (enLinea.desde) return { titulo, detalle: `La atiende ${quien}, que vive en ${enLinea.desde.nombre} (Bogotá).` }
      return { titulo, detalle: `La atiende ${quien}, que vive en la Zona.` }
    }
    case 'reservada': {
      if (!quien) return { titulo, detalle: null }
      if (enLinea.desde && enLinea.ajuste) return { titulo, detalle: `Reservada para ${quien} por ajuste manual desde ${enLinea.desde.nombre}${porCarretera(enLinea.minutos)}.` }
      if (enLinea.desde) return { titulo, detalle: `Reservada para ${quien}, que vive en ${enLinea.desde.nombre} (Bogotá).` }
      return { titulo, detalle: `Reservada para ${quien}, que vive en la Zona.` }
    }
    case 'alcance': {
      if (!quien) return { titulo, detalle: null }
      const desde = enLinea.desde ? ` desde ${enLinea.desde.nombre}` : ''
      return { titulo, detalle: `La atiende ${quien}${desde}${porCarretera(enLinea.minutos)}.` }
    }
    case 'sin_cobertura': {
      // El tope se dice redondo ("4 h"), no "4 h 00"
      const topeMin = linea?.max_reach_minutes ?? null
      const tope = topeMin ? ` en menos de ${topeMin % 60 === 0 ? `${topeMin / 60} h` : minutosCortos(topeMin)}` : ' dentro del tope'
      const cercana = quienAtiende(enLinea.masCercano)
      const minutos = enLinea.masCercano?.minutos
      const masCercana = cercana ? ` La más cercana es ${cercana}${minutos !== null && minutos !== undefined ? `, a ${minutosCortos(minutos)}` : ''}.` : ''
      return { titulo, detalle: `Nadie que lleve ${nombreLinea} llega${tope} por carretera.${masCercana}` }
    }
    case 'conflicto':
      return { titulo, detalle: `Más de una persona de la Zona lleva ${nombreLinea}${enLinea.nota ? `: ${enLinea.nota}` : ''}. Resuélvelo con un ajuste manual.` }
  }
}

/** El estado en una sola línea de texto (tarjetas, títulos): "Sin cobertura. Nadie que lleve … llega …". */
export function textoEstadoCompleto(enLinea: ZonaEnLinea, linea?: LineaParaTexto | null): string {
  const { titulo, detalle } = textoEstado(enLinea, linea)
  return detalle ? `${titulo}. ${detalle}` : titulo
}

/**
 * Qué puede hacer la líder cuando a la Zona no la atiende alguien de aquí (por alcance o sin cobertura): a quién de la
 * Zona darle la línea; si nadie vive ahí, forzar desde otra ciudad. null cuando no aplica.
 */
export function sugerenciaCobertura(zona: ZonaFila, linea: { code: string; name: string }, lineas: ReadonlyArray<{ code: string; name: string }>): string | null {
  const estado = zona.enLinea?.estado
  if (estado !== 'alcance' && estado !== 'sin_cobertura') return null
  const candidatos = zona.residentes.filter(residente => motivoNoPuedeDar(residente, linea, lineas) === null)
  if (candidatos.length > 0) return `Para que la atienda alguien de aquí, dale ${linea.name} a ${candidatos.map(residente => residente.nombre).join(' o a ')}.`
  if (zona.residentes.length === 0) {
    return 'Nadie vive en esta Zona: para cubrirla desde aquí hace falta una vacante o una persona con base aquí. Mientras tanto, puedes forzar a alguien de otra ciudad.'
  }
  return null
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

/**
 * Restricción de la dirección sobre una persona o vacante: null si no hay. GET /api/kams/zonas manda null = sin
 * restricción y recorta la lista a las líneas que el usuario ve, así que [] = "la dirección la limitó a líneas que tú no
 * ves" (sigue siendo una restricción: la API respondería 409).
 */
export function restriccionDe(residente: Pick<ZonaResidente, 'lineasPermitidas'>): string[] | null {
  return residente.lineasPermitidas ?? null
}

/** "solo puede tener: Sustitutos óseos, Reemplazo articular", o null si la dirección no la limitó. */
export function textoRestriccion(residente: ZonaResidente, lineas: ReadonlyArray<{ code: string; name: string }>): string | null {
  const permitidas = restriccionDe(residente)
  if (!permitidas) return null
  if (permitidas.length === 0) return 'solo puede tener líneas que no ves'
  return `solo puede tener: ${permitidas.map(code => nombreLinea(code, lineas)).join(', ')}`
}

/**
 * Siempre visible junto al nombre (dueño, 2026-10-23: "ese empleado o esa vacante está destinado con posibilidad a estas
 * unidades de negocio"): "Puede tener cualquier línea" si la dirección no la limitó; si la limitó, "Solo puede tener: …".
 */
export function textoPuedeTener(residente: Pick<ZonaResidente, 'lineasPermitidas'>, lineas: ReadonlyArray<{ code: string; name: string }>): string {
  const permitidas = restriccionDe(residente)
  if (!permitidas) return 'Puede tener cualquier línea'
  if (permitidas.length === 0) return 'Solo puede tener líneas que no ves'
  return `Solo puede tener: ${permitidas.map(code => nombreLinea(code, lineas)).join(', ')}`
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
    if (permitidas.length === 0) return `La dirección limitó a ${residente.nombre} a líneas que no ves`
    return `La dirección limitó a ${residente.nombre} a: ${permitidas.map(code => nombreLinea(code, lineas)).join(', ')}`
  }
  return null
}
