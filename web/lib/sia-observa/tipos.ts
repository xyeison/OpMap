// SIA Observa · tipos de documento de la ficha (puro y liviano: lo usan también componentes del navegador; el parser con
// cheerio está en ./ficha). Pruebas: scripts/sia-observa-check.ts.
import { normalizeText } from '../secop'

export const TIPOS_DOCUMENTO = [
  'contrato',
  'estudio_previo',
  'anexo_tecnico',
  'propuesta',
  'poliza',
  'cdp',
  'rp',
  'acta_inicio',
  'designacion_supervisor',
  'novedad',
  'liquidacion',
  'otro',
] as const
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number]

/** Los que se copian al bucket (spec, Fase 2.3); los demás quedan con su enlace. */
export const TIPOS_CLAVE: readonly TipoDocumento[] = ['contrato', 'estudio_previo', 'anexo_tecnico', 'propuesta', 'novedad', 'liquidacion']

export const TIPO_DOCUMENTO_LABELS: Record<TipoDocumento, string> = {
  contrato: 'Contrato',
  estudio_previo: 'Estudio previo',
  anexo_tecnico: 'Anexo técnico',
  propuesta: 'Propuesta',
  poliza: 'Póliza',
  cdp: 'CDP',
  rp: 'RP',
  acta_inicio: 'Acta de inicio',
  designacion_supervisor: 'Designación de supervisor',
  novedad: 'Novedad (adición, otrosí, prórroga)',
  liquidacion: 'Liquidación',
  otro: 'Otro',
}

/**
 * Tipo por el nombre del archivo (tabla de la spec, Fase 2.2). El orden importa: "acta de liquidación del contrato" es
 * liquidación, "adición al contrato" es novedad, "acta de inicio" no es contrato, "designación de supervisor del
 * contrato" es designación y "póliza de cumplimiento del contrato" es póliza.
 */
export function tipoDocumento(nombreArchivo: string): TipoDocumento {
  const crudo = String(nombreArchivo ?? '').toLowerCase()
  const t = normalizeText(crudo.replace(/\.[a-z0-9]{2,4}$/, ''))
  if (/liquid/.test(t)) return 'liquidacion'
  if (/adici|otrosi|otro si|prorrog|modific/.test(t)) return 'novedad'
  if (/\bacta\b/.test(t) && /inicio/.test(t)) return 'acta_inicio'
  if (/desig/.test(t)) return 'designacion_supervisor'
  if (/poliza|garantia/.test(t)) return 'poliza'
  if (/\bcdp\b|disponibilidad presupuestal/.test(t)) return 'cdp'
  if (/\brp\b|registro presupuestal/.test(t)) return 'rp'
  if (/^ep[_\s-]/.test(crudo) || /\bep\b/.test(t) || /estudio/.test(t)) return 'estudio_previo'
  if (/anexo/.test(t)) return 'anexo_tecnico'
  if (/propuesta|oferta|cotiz/.test(t)) return 'propuesta'
  if (/contrato/.test(t) && !/\bacta\b/.test(t)) return 'contrato'
  return 'otro'
}

