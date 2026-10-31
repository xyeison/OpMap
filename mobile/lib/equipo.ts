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
/** Claves del almacén con lo último cargado (sin señal se muestra con "Visto hace"; lib/equipo-cache.ts). */
export const CLAVE_EQUIPO_HOY = 'opmap.equipo.hoy.v1'
export const CLAVE_EQUIPO_RENDIMIENTO = 'opmap.equipo.rendimiento.v1'

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

// ---------------------------------------------------------------------------------------------
// Rendimiento: periodos, orden y "visto hace"
// ---------------------------------------------------------------------------------------------

export type TipoPeriodo = 'semana' | 'quincena' | 'mes' | 'mes_anterior' | 'tres_meses'
export const PERIODOS: ReadonlyArray<{ valor: TipoPeriodo; texto: string }> = [
  { valor: 'semana', texto: 'Esta semana' },
  { valor: 'quincena', texto: '15 días' },
  { valor: 'mes', texto: 'Este mes' },
  { valor: 'mes_anterior', texto: 'Mes anterior' },
  { valor: 'tres_meses', texto: '3 meses' },
]

const DIA_MS = 24 * 60 * 60 * 1000
const aUtc = (fecha: string) => Date.parse(`${fecha}T00:00:00Z`)
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10)
const ultimoDiaDelMes = (anio: number, mes1a12: number) => new Date(Date.UTC(anio, mes1a12, 0)).getUTCDate()

/**
 * El periodo de Rendimiento (el servidor acepta hasta 93 días): semana = lunes a domingo de hoy; quincena = 15 días hasta
 * hoy; mes = el calendario completo (solo así hay cuota); mes anterior; 3 meses = los últimos 92 días hasta hoy.
 */
export function periodo(tipo: TipoPeriodo, hoy: string): { desde: string; hasta: string } {
  const ms = aUtc(hoy)
  const anio = Number(hoy.slice(0, 4))
  const mes = Number(hoy.slice(5, 7))
  if (tipo === 'semana') {
    const dia = new Date(ms).getUTCDay() // 0 domingo
    const lunes = ms - ((dia + 6) % 7) * DIA_MS
    return { desde: iso(lunes), hasta: iso(lunes + 6 * DIA_MS) }
  }
  if (tipo === 'quincena') return { desde: iso(ms - 14 * DIA_MS), hasta: hoy }
  if (tipo === 'tres_meses') return { desde: iso(ms - 92 * DIA_MS), hasta: hoy }
  if (tipo === 'mes_anterior') {
    const a = mes === 1 ? anio - 1 : anio
    const m = mes === 1 ? 12 : mes - 1
    const mm = String(m).padStart(2, '0')
    return { desde: `${a}-${mm}-01`, hasta: `${a}-${mm}-${String(ultimoDiaDelMes(a, m)).padStart(2, '0')}` }
  }
  return { desde: `${hoy.slice(0, 7)}-01`, hasta: `${hoy.slice(0, 7)}-${String(ultimoDiaDelMes(anio, mes)).padStart(2, '0')}` }
}

/** "Visto hace 3 min" (lo último guardado, sin señal). */
export function textoVisto(vistoAt: string, ahora: Date = new Date()): string {
  const min = Math.max(0, Math.round((ahora.getTime() - Date.parse(vistoAt)) / 60000))
  return min === 0 ? 'Visto ahora' : `Visto ${textoHace(min)}`
}

/** Filas por cumplimiento del plan ascendente (quien va atrás primero), null al final, y por nombre. */
export function ordenFilas<T extends { persona: { nombre: string }; cumplimiento_plan: { ratio: number | null } }>(filas: readonly T[]): T[] {
  return [...filas].sort((a, b) => {
    const ra = a.cumplimiento_plan.ratio
    const rb = b.cumplimiento_plan.ratio
    if (ra !== rb) {
      if (ra === null) return 1
      if (rb === null) return -1
      return ra - rb
    }
    return a.persona.nombre.localeCompare(b.persona.nombre, 'es')
  })
}

/** "3 de 4 (75 %)", "—" sin plan. */
export function textoCumplimiento(c: { programadas: number; cumplidas: number; ratio: number | null }): string {
  return c.ratio === null ? '—' : `${c.cumplidas} de ${c.programadas} (${Math.round(c.ratio * 100)} %)`
}

/** "Osteosíntesis 4 · Columna 1". */
export function textoPorLinea(porLinea: { lineas: Array<{ nombre: string; hechas: number }> }): string {
  return porLinea.lineas.map(l => `${l.nombre} ${l.hechas}`).join(' · ')
}

/** "cliente 2 · prioridad 1". */
export function textoMotivos(motivos: Record<string, number>): string {
  return Object.entries(motivos)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))
    .map(([motivo, n]) => `${motivo} ${n}`)
    .join(' · ')
}

/** ¿Falló por falta de señal o tiempo (y vale mostrar lo último guardado)? */
export function esSinSenal(tipo: string): boolean {
  return tipo === 'red' || tipo === 'tiempo'
}
