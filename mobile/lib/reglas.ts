/**
 * Reglas y textos puros de las pantallas (sin React Native), espejo de los de la web cuando existen
 * (web/components/visitas/comun.tsx numeroTexto y porcentaje; web/lib/visits-rules.ts ejecutivaPuedeAnular y
 * textoOrigenMeta). Los prueba scripts/movil-check.ts.
 */
import type { CuotaTipo, DiaLibreItem, EstadoDiaLibre, OrigenMeta, VisitaItem } from './tipos'
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
    sales_manager: 'Ventas',
    contract_manager: 'Contratos',
    data_manager: 'Datos',
    viewer: 'Visualizador',
    user: 'Usuario',
    line_leader: 'Líder de línea',
    commercial_director: 'Dirección comercial',
    hr: 'Recursos humanos',
  }
  return (role && titulos[role]) || 'Usuario'
}
