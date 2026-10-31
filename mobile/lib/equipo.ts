/**
 * Equipo (Entrega 2, 2026-10-31; spec docs/specs/2026-10-31-equipo-en-la-app-y-ejecutivos-de-vuelta.md): los textos y
 * filtros de Equipo › Hoy, el día de una persona y Rendimiento. PURO (sin React Native): lo prueba
 * scripts/checks/26-equipo.ts. Todo sale de lo que el servidor reporta y agenda; nunca de la ubicación en vivo (C5).
 */
import type { CasoUbicacion, EstadoPaso, MarcaVisita, PapelEquipo, PasoRastroItem, PersonaEquipoItem, UbicacionItem } from './tipos'

/** El mismo texto del servidor (web/lib/reporte-visitas.ts TEXTO_FIJO_EQUIPO): va fijo arriba de Equipo › Hoy. */
export const TEXTO_FIJO_EQUIPO = 'Lo que cada persona reporta o agenda. La app no sigue la ubicación.'
/** Equipo › Hoy se relee cada 5 minutos mientras está a la vista (lee reportes, no pide ubicación). */
export const RELEER_CADA_MS = 5 * 60 * 1000

/** Las marcas del servidor (0940), con palabras: son su veredicto, nunca la distancia ni la precisión. */
export const ETIQUETA_MARCA: Record<MarcaVisita, string> = {
  en_sitio: 'En la sede',
  lejos_de_ips: 'Lejos de la sede',
  sin_ubicacion: 'Sin GPS',
  precision_baja: 'GPS impreciso',
  ips_sin_coordenadas: 'Sede sin ubicación',
  hora_inconsistente: 'Hora del teléfono rara',
  medico_por_validar: 'Médico por validar',
}

/** Marcas que no vale la pena mostrar (en_sitio es lo normal). */
export const MARCAS_VISIBLES: readonly MarcaVisita[] = ['lejos_de_ips', 'sin_ubicacion', 'precision_baja', 'ips_sin_coordenadas', 'hora_inconsistente', 'medico_por_validar']

/** El papel, con la terminología del dueño (2026-10-29). */
export const ETIQUETA_PAPEL: Record<PapelEquipo, string> = {
  lider: 'Líder',
  ejecutivo: 'Ejecutivo Comercial',
  lider_y_ejecutivo: 'Líder y Ejecutivo Comercial',
}

const ETIQUETA_CASO: Record<Exclude<CasoUbicacion, 'reportado' | 'reportado_hace_rato' | 'planeado'>, string> = {
  dia_libre: 'Día libre',
  festivo: 'Festivo',
  sin_nada: 'Sin reportes ni plan hoy',
}

/** "hace 35 min", "hace 4 h", "hace 1 h 20 min". */
export function textoHace(min: number): string {
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `hace ${h} h` : `hace ${h} h ${m} min`
}

const lugar = (sede: string | null, municipio: string | null): string => [sede, municipio].filter((x): x is string => !!x).join(', ')

/** La frase de dónde está una persona (Equipo › Hoy), por caso. */
export function textoUbicacion(u: UbicacionItem): string {
  if (u.caso === 'reportado') {
    const base = `${u.hora ?? ''} · ${lugar(u.sede, u.municipio)}`.trim()
    return u.hace_min === null ? base : `${base} (${textoHace(u.hace_min)})`
  }
  if (u.caso === 'reportado_hace_rato') {
    const hace = u.hace_min === null ? '' : ` ${textoHace(u.hace_min)}`
    return `Último reporte${hace}${u.municipio ? ` · ${u.municipio}` : ''}`
  }
  if (u.caso === 'planeado') return `Planeado ${u.hora ?? ''} · ${lugar(u.sede, u.municipio)}`.trim()
  return ETIQUETA_CASO[u.caso]
}

/** "Cartagena 2 · Bogotá 6 · Sin reporte ni plan 3". */
export function textoResumen(r: { ciudades: Array<{ nombre: string; personas: number }>; sin_nada: number }): string {
  const partes = r.ciudades.map(c => `${c.nombre} ${c.personas}`)
  if (r.sin_nada > 0) partes.push(`Sin reporte ni plan ${r.sin_nada}`)
  return partes.length === 0 ? 'Nadie' : partes.join(' · ')
}

export type FiltroPapel = 'todas' | 'lideres' | 'ejecutivos'
export const FILTROS_PAPEL: ReadonlyArray<{ valor: FiltroPapel; texto: string }> = [
  { valor: 'todas', texto: 'Todas' },
  { valor: 'lideres', texto: 'Líderes' },
  { valor: 'ejecutivos', texto: 'Ejecutivos Comerciales' },
]

/** Filtra por papel (líderes: lider y lider_y_ejecutivo; ejecutivos: ejecutivo y lider_y_ejecutivo) y por línea (la lleva). */
export function filtrarPersonas<T extends { persona: PersonaEquipoItem }>(filas: readonly T[], papel: FiltroPapel, linea: string | null): T[] {
  return filas.filter(f => {
    const p = f.persona.papel
    if (papel === 'lideres' && p === 'ejecutivo') return false
    if (papel === 'ejecutivos' && p === 'lider') return false
    if (linea && !f.persona.lineas.some(l => l.id === linea)) return false
    return true
  })
}

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
/** "19 oct". */
export function fechaCortita(fecha: string): string {
  return `${Number(fecha.slice(8, 10))} ${MESES_CORTOS[Number(fecha.slice(5, 7)) - 1] ?? ''}`.trim()
}

const ETIQUETA_ESTADO: Record<EstadoPaso, string> = {
  programada: 'Programada',
  atrasada: 'Atrasada',
  sin_cerrar: 'Sin cerrar',
  no_realizada: 'No se hizo',
  cancelada: 'Cancelada',
  hecha: 'Hecha',
  no_efectiva: 'No efectiva',
}

/** Tono de la insignia del estado de un paso. */
export function tonoEstado(estado: EstadoPaso): 'neutro' | 'exito' | 'alerta' | 'peligro' | 'info' {
  if (estado === 'hecha') return 'exito'
  if (estado === 'no_efectiva' || estado === 'no_realizada' || estado === 'cancelada') return 'peligro'
  if (estado === 'atrasada' || estado === 'sin_cerrar') return 'alerta'
  return 'info'
}

/** Un paso del rastro en tres textos: título ("10:30 · Dr. Uno"), detalle (lugar, líneas, planeación) y estado. */
export function textoPaso(p: PasoRastroItem): { titulo: string; detalle: string; estado: string } {
  const conQuien = p.con_quien ?? (p.tipo === 'institucional' ? 'Visita institucional' : 'Visita médica')
  const titulo = `${p.hora ?? 'Sin hora'} · ${conQuien}`
  const partes: string[] = []
  const donde = lugar(p.sede, p.municipio)
  if (p.modalidad === 'telefonica') partes.push(donde ? `Telefónica · ${donde}` : 'Telefónica')
  else if (donde) partes.push(donde)
  if (p.lineas.length > 0) partes.push(p.lineas.join(' + '))
  if (p.anticipacion_dias === null) partes.push('no planeada')
  else if (p.anticipacion_dias === 0) partes.push('planeada el mismo día')
  else partes.push(`planeada hace ${p.anticipacion_dias} ${p.anticipacion_dias === 1 ? 'día' : 'días'}`)
  if (p.viene_de_fecha) partes.push(`viene de la cita del ${fechaCortita(p.viene_de_fecha)}`)
  const estado = p.motivo && (p.estado === 'no_efectiva' || p.estado === 'no_realizada' || p.estado === 'cancelada') ? `${ETIQUETA_ESTADO[p.estado]} · ${p.motivo}` : ETIQUETA_ESTADO[p.estado]
  return { titulo, detalle: partes.join(' · '), estado }
}
