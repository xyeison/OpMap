/**
 * Reglas y textos puros de las pantallas (sin React Native), espejo de los de la web cuando existen
 * (web/components/visitas/comun.tsx numeroTexto y porcentaje; web/lib/visits-rules.ts ejecutivaPuedeAnular y
 * textoOrigenMeta). Los prueba scripts/movil-check.ts.
 */
import { diasEntre, fechaLarga, sumarDias } from './fechas'
import type { CitaItem, CuotaTipo, DiaLibreItem, EstadoDiaLibre, OrigenMeta, VisitaItem } from './tipos'
import { ETIQUETA_MEDIO } from './tipos'

/** Número con coma decimal, punto de miles y hasta 2 decimales ("0,5", "72", "1.250"); "—" si no es número. */
export function numeroTexto(valor: number | string | null | undefined): string {
  const numero = Number(valor)
  if (valor === null || valor === undefined || valor === '' || !Number.isFinite(numero)) return '—'
  const redondeado = Math.round((numero + Number.EPSILON) * 100) / 100
  const negativo = redondeado < 0
  const [entero, decimales = ''] = Math.abs(redondeado).toFixed(2).split('.')
  const miles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const fraccion = decimales.replace(/0+$/, '')
  return `${negativo ? '-' : ''}${miles}${fraccion ? `,${fraccion}` : ''}`
}

/** Porcentaje entero ("50 %"); "—" si no hay (cuota 0). */
export function porcentaje(fraccion: number | null | undefined): string {
  if (fraccion === null || fraccion === undefined || !Number.isFinite(fraccion)) return '—'
  return `${Math.round(fraccion * 100)} %`
}

/** Fracción 0..1 para una barra (null o negativo → 0; más de 1 → 1). */
export function fraccionBarra(valor: number | null | undefined): number {
  if (valor === null || valor === undefined || !Number.isFinite(valor) || valor <= 0) return 0
  return Math.min(1, valor)
}

/** hechas ÷ meta para la barra de hoy (meta 0 → null). */
export function avance(hechas: number, meta: number): number | null {
  return meta > 0 ? hechas / meta : null
}

/** De dónde sale la meta que rige hoy. */
export function textoOrigenMeta(origen: OrigenMeta | undefined): string {
  switch (origen) {
    case 'ejecutiva':
      return 'excepción personal'
    case 'zona':
      return 'meta de la zona'
    case 'general':
      return 'meta de toda la empresa'
    default:
      return 'sin meta'
  }
}

/** ¿Se muestra la cuota de ese tipo? (no está en el perfil ese mes y la cuota es 0 → no). */
export function muestraCuota(tipo: CuotaTipo | null | undefined): boolean {
  if (!tipo) return false
  return !(tipo.aplica === false && !(Number(tipo.cuota) > 0))
}

/** La ejecutiva anula su día libre: por aprobar siempre; registrado o aprobado si la fecha es hoy o después. */
export function ejecutivaPuedeAnular(dia: { estado: EstadoDiaLibre; fecha: string }, hoy: string): boolean {
  if (dia.estado === 'por_aprobar') return true
  return (dia.estado === 'registrado' || dia.estado === 'aprobado') && dia.fecha >= hoy
}

export function textoFraccion(fraccion: number): string {
  return fraccion === 0.5 ? 'Medio día' : fraccion === 1 ? 'Día completo' : `${numeroTexto(fraccion)} día`
}

/** Días libres para la lista: los de hoy en adelante primero (más cercano arriba), luego los pasados (reciente arriba). */
export function ordenarDiasLibres(items: readonly DiaLibreItem[], hoy: string): DiaLibreItem[] {
  const futuros = items.filter(d => d.fecha >= hoy).sort((a, b) => a.fecha.localeCompare(b.fecha))
  const pasados = items.filter(d => d.fecha < hoy).sort((a, b) => b.fecha.localeCompare(a.fecha))
  return [...futuros, ...pasados]
}

/** Con quién fue la visita ("Dra. Ana Gómez" o "Clínica Norte · Compras"). Nunca documentos. */
export function conQuien(visita: Pick<VisitaItem, 'tipo' | 'medico' | 'cuenta' | 'subtipo' | 'contacto'>): string {
  if (visita.tipo === 'medica') return visita.medico?.nombre ?? 'Médico'
  const partes = [visita.cuenta?.nombre ?? 'Cuenta', visita.subtipo?.nombre].filter(Boolean)
  return partes.join(' · ')
}

/** Espacios no separables: "60 m" nunca se parte en dos líneas. */
export function sinCortes(texto: string): string {
  return texto.replace(/ /g, '\u00a0')
}

/** Detalle corto de la visita ("Presencial · 120 m", "Telefónica · Llamada"); la distancia no se parte. */
export function detalleModalidad(visita: Pick<VisitaItem, 'modalidad' | 'medio' | 'distance_m'>, textoDistancia: (m: number) => string): string {
  if (visita.modalidad === 'telefonica') return `Telefónica${visita.medio ? ` · ${ETIQUETA_MEDIO[visita.medio]}` : ''}`
  return `Presencial${visita.distance_m !== null && visita.distance_m !== undefined ? ` · ${sinCortes(textoDistancia(visita.distance_m))}` : ''}`
}

/** Plural sencillo: plural(1, 'visita') → "1 visita"; plural(3, 'visita') → "3 visitas". */
export function plural(n: number, singular: string, pluralTexto: string = `${singular}s`): string {
  return `${numeroTexto(n)} ${n === 1 ? singular : pluralTexto}`
}

/** Valida un correo de forma básica (el servidor decide). */
export function pareceCorreo(texto: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(texto.trim())
}

/** Título del rol en español (igual que getRoleTitle de web/lib/permissions.ts). */
export function tituloRol(role: string | null | undefined): string {
  const titulos: Record<string, string> = {
    admin: 'Administrador',
    sales_manager: 'Ejecutivo comercial',
    contract_manager: 'Contratos',
    data_manager: 'Datos',
    viewer: 'Visualizador',
    user: 'Usuario',
    line_leader: 'Líder de negocio',
    commercial_director: 'Director comercial',
    hr: 'Recursos humanos',
  }
  return (role && titulos[role]) || 'Usuario'
}

// ---------------------------------------------------------------------------------------------
// Agenda (F4.1): textos de las citas en Hoy, Agenda y Reportar
// ---------------------------------------------------------------------------------------------

/** Con quién es la cita ("Dra. Ana Gómez" o "Clínica Norte · Compras"). Nunca documentos. */
export function conQuienCita(cita: Pick<CitaItem, 'tipo' | 'medico' | 'cuenta' | 'subtipo'>): string {
  if (cita.tipo === 'medica') return cita.medico?.nombre ?? 'Médico'
  return [cita.cuenta?.nombre ?? 'Cuenta', cita.subtipo?.nombre].filter(Boolean).join(' · ')
}

/** "10:30" o "Sin hora". */
export function textoHoraCita(hora: string | null | undefined): string {
  return hora ? hora.slice(0, 5) : 'Sin hora'
}

/** "Hoy · martes 14 de octubre", "Mañana · miércoles 15 de octubre" o "jueves 16 de octubre" (con mayúscula inicial). */
export function tituloDiaAgenda(fecha: string, hoy: string): string {
  const larga = fechaLarga(fecha, new Date(`${hoy}T12:00:00-05:00`))
  const diferencia = diasEntre(hoy, fecha)
  if (diferencia === 0) return `Hoy · ${larga}`
  if (diferencia === 1) return `Mañana · ${larga}`
  return larga ? larga[0].toUpperCase() + larga.slice(1) : larga
}

/**
 * Mi agenda (F4.1): "3 citas" cuenta las que siguen en pie (pendientes y hechas); las canceladas y (0850) las que no se
 * hicieron también se muestran, con su insignia, porque una cita no se borra: se cierra (A7). Si hay, se añade
 * " · 1 cancelada" y " · 1 no se hizo". Las eliminadas por error no llegan (no salen en ninguna lectura).
 */
export function textoTotalAgenda(citas: readonly Pick<CitaItem, 'estado'>[]): string {
  const canceladas = citas.filter(cita => cita.estado === 'cancelada').length
  const noHechas = citas.filter(cita => cita.estado === 'no_realizada').length
  const enPie = citas.filter(cita => cita.estado === 'pendiente' || cita.estado === 'hecha').length
  const partes = [enPie === 1 ? '1 cita' : `${enPie} citas`]
  if (canceladas > 0) partes.push(canceladas === 1 ? '1 cancelada' : `${canceladas} canceladas`)
  if (noHechas > 0) partes.push(noHechas === 1 ? '1 no se hizo' : `${noHechas} no se hicieron`)
  return partes.join(' · ')
}

/** Las citas por día, de `desde` a `hasta` (ambos incluidos, también los días sin citas), cada día por hora. */
export function agruparCitasPorDia<T extends Pick<CitaItem, 'id' | 'fecha' | 'hora'>>(citas: readonly T[], desde: string, hasta: string): { fecha: string; citas: T[] }[] {
  const dias: { fecha: string; citas: T[] }[] = []
  const total = Math.max(0, Math.min(62, diasEntre(desde, hasta)))
  for (let i = 0; i <= total; i++) {
    const fecha = sumarDias(desde, i)
    const delDia = citas
      .filter(cita => cita.fecha === fecha)
      .sort((a, b) => (a.hora === b.hora ? (a.id < b.id ? -1 : 1) : a.hora === null ? 1 : b.hora === null ? -1 : a.hora < b.hora ? -1 : 1))
    dias.push({ fecha, citas: delDia })
  }
  return dias
}

/**
 * El nombre de la cuenta junto al de la sede solo si dice algo más ("Portoazul Torre Médica · Clínica Portoazul S.A.S."
 * sí; "Clínica Portoazul · Clínica Portoazul S.A.S." no): ninguno contiene al otro, sin tildes ni mayúsculas.
 */
export function cuentaDistinta(sede: string, cuenta: string | null | undefined): string | null {
  if (!cuenta) return null
  const limpio = (texto: string) =>
    texto
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
  const a = limpio(sede)
  const b = limpio(cuenta)
  return a && b && !a.includes(b) && !b.includes(a) ? cuenta : null
}
