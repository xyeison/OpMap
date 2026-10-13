// Fase 7 · F2: cómo se lee cada valor de configuración en la pantalla ("6 al día", "Suma a la meta institucional
// · peso 0,5", "Lunes a viernes"...). Sin React: lo usan la línea de tiempo, la vista previa y las tarjetas.
// Contrato: docs/fases/fase7-visitas-f2-config-calendario.md (sección "Interfaz").
import {
  GENERAL_POR_DEFECTO,
  VALORES_TIPO_VISITA,
  etiquetaMedioTelefonica,
  etiquetaModoConteo,
  etiquetaPeriodoMeta,
  etiquetaRolAprobador,
  type ConfigAprobacionDiasLibres,
  type ConfigTelefonicas,
  type DiasHabilesSemana,
  type MotivoDiaLibre,
  type OrigenMeta,
  type ParametroGeneral,
} from '@/lib/visits-rules'
import { NOMBRES_DIA_ISO, conMayuscula, numeroTexto, porcentaje, unirLista } from './comun'

/** "6 al día", "10 a la semana". */
export function textoMeta(meta: { cantidad: number | string; periodo: string }): string {
  return `${numeroTexto(meta.cantidad)} ${etiquetaPeriodoMeta(meta.periodo).toLowerCase()}`
}

/** "Suma a la meta institucional · peso 0,5" o "Solo seguimiento". */
export function textoConteo(conteo: { modo: string; peso: number | string }): string {
  const modo = etiquetaModoConteo(conteo.modo)
  return conteo.modo === 'seguimiento' ? modo : `${modo} · peso ${numeroTexto(conteo.peso)}`
}

/** "Médica e institucional", "Solo médica", "Solo institucional". */
export function textoPerfil(perfil: readonly string[]): string {
  const tiene = VALORES_TIPO_VISITA.filter(tipo => perfil.includes(tipo))
  if (tiene.length === 2) return 'Médica e institucional'
  if (tiene[0] === 'medica') return 'Solo médica'
  if (tiene[0] === 'institucional') return 'Solo institucional'
  return 'Sin perfil'
}

/** Configuración de una persona en una línea: perfil, telefónica, tope y radio (vacío = el general). */
export function textoPersona(persona: {
  perfil: readonly string[]
  telefonica_habilitada: boolean
  tope_telefonicas_dia: number | null
  radio_m: number | null
}): string {
  const partes = [textoPerfil(persona.perfil)]
  if (persona.telefonica_habilitada) {
    partes.push(
      persona.tope_telefonicas_dia === null || persona.tope_telefonicas_dia === undefined
        ? 'telefónica habilitada (tope general)'
        : `telefónica habilitada (hasta ${persona.tope_telefonicas_dia} al día)`
    )
  } else {
    partes.push('sin telefónica')
  }
  partes.push(persona.radio_m === null || persona.radio_m === undefined ? 'radio general' : `radio de ${numeroTexto(persona.radio_m)} m`)
  return partes.join(' · ')
}

const CLAVES_SEMANA = ['1', '2', '3', '4', '5', '6', '7'] as const

/** "Lunes a viernes, día completo", o "lunes, martes y miércoles (día completo); sábado (medio día)". */
export function textoDiasSemana(dias: DiasHabilesSemana | null | undefined): string {
  if (!dias) return '—'
  const valor = (clave: string) => Number((dias as Record<string, unknown>)[clave] ?? 0)
  const completos = CLAVES_SEMANA.filter(clave => valor(clave) === 1)
  const medios = CLAVES_SEMANA.filter(clave => valor(clave) === 0.5)
  if (completos.join('') === '12345' && medios.length === 0) return 'Lunes a viernes, día completo'
  const partes: string[] = []
  if (completos.length > 0) partes.push(`${unirLista(completos.map(c => NOMBRES_DIA_ISO[c]))} (día completo)`)
  if (medios.length > 0) partes.push(`${unirLista(medios.map(c => NOMBRES_DIA_ISO[c]))} (medio día)`)
  return partes.length > 0 ? conMayuscula(partes.join('; ')) : 'Ningún día hábil'
}

export function textoTelefonicas(valor: ConfigTelefonicas | null | undefined): string {
  if (!valor) return '—'
  const medios = unirLista((valor.medios ?? []).map(medio => etiquetaMedioTelefonica(medio).toLowerCase()))
  return `Hasta ${numeroTexto(valor.tope_dia)} al día · peso ${numeroTexto(valor.peso)} · ${medios || 'sin medios'}`
}

export function textoAprobacion(valor: ConfigAprobacionDiasLibres | null | undefined): string {
  if (!valor) return '—'
  if (!valor.requiere) return 'No requieren aprobación: cuentan desde que se registran'
  const quienes = unirLista((valor.aprueban ?? []).map(rol => etiquetaRolAprobador(rol)), 'o')
  return quienes ? `Requieren aprobación de ${quienes} (o un administrador)` : 'Requieren aprobación de un administrador'
}

export function textoMotivos(valor: readonly MotivoDiaLibre[] | null | undefined): string {
  if (!valor || valor.length === 0) return 'Sin motivos'
  return `${valor.length} ${valor.length === 1 ? 'motivo' : 'motivos'}: ${valor.map(m => m.nombre).join(', ')}`
}

/** Valor de un parámetro de config_general en palabras. */
export function textoGeneral(parametro: ParametroGeneral | string, valor: unknown): string {
  switch (parametro) {
    case 'radio_presencial_m':
      return `${numeroTexto(valor as number)} metros`
    case 'plazo_gracia_horas':
      return `${numeroTexto(valor as number)} horas después de terminar el día`
    case 'dias_habiles_semana':
      return textoDiasSemana(valor as DiasHabilesSemana)
    case 'tope_visitas_medico_dia': {
      const n = Number(valor)
      return `${numeroTexto(n)} ${n === 1 ? 'visita' : 'visitas'} por médico al día`
    }
    case 'telefonicas':
      return textoTelefonicas(valor as ConfigTelefonicas)
    case 'aprobacion_dias_libres':
      return textoAprobacion(valor as ConfigAprobacionDiasLibres)
    case 'motivos_dia_libre':
      return textoMotivos(valor as MotivoDiaLibre[])
    case 'primer_mes_factor':
      return `${porcentaje(Number(valor))} de la meta en el mes de entrada`
    case 'alertas_mezcla': {
      const n = valor && typeof valor === 'object' ? Object.keys(valor as object).length : 0
      return n === 0 ? 'Sin alertas' : `${n} ${n === 1 ? 'alerta' : 'alertas'}`
    }
    default:
      return JSON.stringify(valor)
  }
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

/** Ayuda de cada parámetro general. */
export const AYUDA_GENERAL: Partial<Record<ParametroGeneral, string>> = {
  radio_presencial_m: 'Distancia máxima a la sede para que una visita cuente como presencial. Cada persona puede tener el suyo.',
  plazo_gracia_horas: `Horas después de terminar un día en que todavía se puede registrar como libre. Con ${GENERAL_POR_DEFECTO.plazo_gracia_horas} horas, un lunes se puede registrar hasta el martes a las 23:59.`,
  dias_habiles_semana: 'Qué días de la semana generan cuota y con qué fracción. Los festivos y los días de empresa o de ciudad mandan sobre esto.',
  tope_visitas_medico_dia: 'Cuántas visitas al mismo médico suman en un mismo día.',
  telefonicas: 'Visitas por llamada o videollamada para quien las tenga habilitadas (en Personas).',
  aprobacion_dias_libres: 'Si los días libres quedan "por aprobar" hasta que alguien los apruebe en bloque, y quién puede aprobarlos.',
  motivos_dia_libre: 'Lista de motivos que se eligen al registrar un día libre.',
  primer_mes_factor: 'Parte de la meta que se exige en el mes calendario en que alguien entra.',
}
