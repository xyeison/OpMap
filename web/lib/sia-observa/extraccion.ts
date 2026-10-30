/**
 * SIA Observa · lectura de los PDF con Claude (Fase 3 de docs/specs/2026-10-29-agente-sia-observa.md). Lo puro (solicitud,
 * lectura de la respuesta, saneo, validación contra SIA y precarga del formulario) está aquí y se prueba sin red en
 * scripts/sia-observa-check.ts; la llamada a la API la hace scripts/sia-extraer.ts (Batch API de noche, o directo).
 *
 * Decisiones (documentación de la API consultada el 2026-10-30):
 *   - Modelo claude-opus-5-5 con pensamiento adaptativo y esfuerzo alto: leer estudios previos escaneados y sacar
 *     indicadores con su página es trabajo de criterio.
 *   - Salida por una herramienta (`registrar_contrato`) con `strict: true` y el esquema de la sección 7. En este modelo
 *     `tool_choice` forzado (any/tool) devuelve 400: va `auto` y el prompt exige llamarla una vez; si no la llama, la
 *     respuesta se marca como error y no se guarda nada.
 *   - Los PDF van como bloques `document` en base64 (también los escaneados: la API los lee como imagen). Límite por
 *     solicitud: 32 MB y 600 páginas; si no caben todos, van primero el contrato y el estudio previo.
 *   - Privacidad: el prompt prohíbe cédulas y nombres de personas naturales, y además sanearExtraccion los quita de lo
 *     que se guarda (patrones de cédula, cotizantes que no son empresa, supervisión reducida al cargo).
 */
import type Anthropic from '@anthropic-ai/sdk'
import { esNitJuridico, normalizeNit, normalizeText } from '../secop'
import { codigoNorm, type ContratoActual, type Diferencia, type SiaContratoLeido } from './normalizar'
import type { TipoDocumento } from './tipos'

export const MODELO_EXTRACCION = 'claude-opus-5-5'
export const VERSION_PROMPT = 'sia-extraccion-v1-2026-10-30'
export const MAX_BYTES_SOLICITUD = 32 * 1024 * 1024
export const MAX_PAGINAS_SOLICITUD = 600
/** Orden en que se mandan los documentos (si no caben todos, se quedan por fuera los últimos). */
export const ORDEN_TIPOS_IA: readonly TipoDocumento[] = ['contrato', 'estudio_previo', 'anexo_tecnico', 'propuesta', 'novedad', 'liquidacion']

// ---------------------------------------------------------------------------------------------
// Esquema (sección 7) en forma estricta: todo objeto con additionalProperties false y todas sus claves en required;
// lo opcional es nullable.
// ---------------------------------------------------------------------------------------------

type Schema = Record<string, unknown>
const str = (descripcion?: string): Schema => ({ type: 'string', ...(descripcion ? { description: descripcion } : {}) })
const strN = (descripcion?: string): Schema => ({ type: ['string', 'null'], ...(descripcion ? { description: descripcion } : {}) })
const numN = (descripcion?: string): Schema => ({ type: ['number', 'null'], ...(descripcion ? { description: descripcion } : {}) })
const fechaN = (descripcion: string): Schema => ({ type: ['string', 'null'], description: `${descripcion} (YYYY-MM-DD)` })
const obj = (properties: Record<string, Schema>): Schema => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false })
const arr = (items: Schema): Schema => ({ type: 'array', items })

export const ESQUEMA_EXTRACCION = obj({
  contrato: obj({
    numero: str('Número o código del contrato, tal cual (p. ej. CD/26-1262)'),
    proceso: strN('Número del proceso de selección (p. ej. "Contratación directa 061/2026")'),
    modalidad: strN('Modalidad de selección y si hubo una o varias ofertas'),
    entidad: obj({ nombre: str(), nit: str('NIT de la entidad contratante') }),
    contratista: obj({ nombre: str('Razón social de la EMPRESA contratista'), nit: str('NIT de la empresa') }),
    objeto: str(),
    valor: { type: 'number', description: 'Valor del contrato en pesos' },
    incluye_impuestos: { type: ['boolean', 'null'] },
    plazo_meses: numN(),
    fecha_firma: fechaN('Fecha de firma'),
    fecha_inicio: fechaN('Fecha del acta de inicio o de inicio de ejecución'),
    fecha_fin: fechaN('Fecha de terminación'),
    forma_pago: strN('Forma de pago (actas parciales, por paciente, sujeto a PAC…)'),
    soportes_factura: arr(str()),
    garantias: arr(obj({ tipo: str(), porcentaje: numN('Porcentaje del valor del contrato'), valor_smmlv: numN('Valor en salarios mínimos'), vigencia: strN() })),
    adiciones_max_pct: numN('Tope de adiciones en porcentaje'),
    supervision: strN('SOLO el cargo de quien supervisa, nunca su nombre ni documento'),
  }),
  requisitos: obj({
    liquidez_min: numN('Índice de liquidez mínimo (veces)'),
    endeudamiento_max_pct: numN('Índice de endeudamiento máximo en porcentaje (50 = 50 %)'),
    cobertura_intereses_min: numN('Razón de cobertura de intereses mínima (veces)'),
    capital_trabajo_min_cop: numN('Capital de trabajo mínimo en pesos, si el documento da la cifra o la regla permite calcularla'),
    capital_trabajo_regla: strN('La regla tal cual (p. ej. "mayor o igual a una vez el presupuesto oficial")'),
    experiencia: strN('Experiencia exigida tal cual'),
    experiencia_anos_min: numN('Años mínimos de experiencia, solo si el documento los pide en años'),
    ciiu: arr(str('Código CIIU')),
    seriedad_oferta_pct: numN('Garantía de seriedad de la oferta en porcentaje'),
    otros: arr(str()),
  }),
  operacion: obj({
    instrumentacion: strN('Exigencias de instrumentación quirúrgica'),
    tiempos_respuesta: strN(),
    registro_invima: strN('Exigencias de registro INVIMA y del importador'),
  }),
  mercado: obj({
    cotizantes: arr(obj({ nombre: str('Razón social de la empresa que cotizó'), nit: strN() })),
    ganador: strN(),
    base_presupuesto: strN('Cómo se calculó el presupuesto (contratos anteriores, consumo mensual…)'),
    gasto_historico: strN(),
  }),
  items: arr(obj({ referencia: strN(), descripcion: str(), unidad: strN(), cantidad: numN(), valor_unitario: numN() })),
  lineas: arr({ type: 'string', enum: ['perossal', 'reemplazo', 'deportiva', 'columna', 'trauma', 'neurocirugia', 'otra'] }),
  fuentes: arr(obj({ campo: str('Ruta del dato, p. ej. requisitos.liquidez_min'), documento: str('Nombre del archivo (título del documento)'), pagina: { type: 'number', description: 'Página del PDF (1 = la primera)' } })),
  faltantes: arr(str('Campo del esquema que NO está en los documentos')),
})

export const HERRAMIENTA_EXTRACCION = {
  name: 'registrar_contrato',
  description:
    'Registra los datos de un contrato público de una IPS leídos de sus documentos (contrato, estudio previo, anexos, propuesta, ' +
    'novedades). Llamar UNA vez con todo lo encontrado. Solo datos que estén en los documentos; lo demás en faltantes.',
  strict: true,
  input_schema: ESQUEMA_EXTRACCION as Anthropic.Tool['input_schema'],
} satisfies Anthropic.Tool

export const SISTEMA_EXTRACCION = `Lees documentos de contratos públicos de hospitales colombianos (IPS) para una empresa que vende material de osteosíntesis, columna, reemplazo articular, medicina deportiva, sustitutos óseos y neurocirugía. Tu respuesta es UNA llamada a la herramienta registrar_contrato; no escribas texto aparte.

Reglas:
- Solo datos que estén escritos en los documentos. No completes con supuestos. Lo que no esté va en "faltantes" (con la ruta del campo) y su valor en null o lista vacía.
- Cada dato importante (valor, fechas, garantías, indicadores financieros, experiencia, CIIU, seriedad, base del presupuesto, gasto histórico, cotizantes) lleva su fuente en "fuentes": el título del documento y la página del PDF.
- Privacidad: nunca escribas números de cédula ni nombres de personas naturales (representantes legales, supervisores, instrumentadores, funcionarios, pacientes). De la supervisión, solo el cargo. De contratistas y cotizantes, solo empresas con su razón social y NIT.
- Dinero en pesos como número (510281732, no "510.281.732"). Porcentajes como número (20 = 20 %). Fechas YYYY-MM-DD.
- Indicadores financieros y experiencia suelen estar en el estudio previo ("requisitos habilitantes"): copia la regla tal cual en *_regla / experiencia y la cifra en el campo numérico si se puede calcular.
- items: solo si el documento trae precios unitarios; si no, lista vacía y "items" en faltantes.
- lineas: las líneas de producto del objeto (perossal = sustitutos óseos).`

export interface DocumentoParaIA {
  id: string
  nombre: string
  tipo: TipoDocumento
  paginas: number | null
  /** PDF en base64 sin saltos de línea. */
  base64: string
}

/** ¿Caben estos documentos en una solicitud? (base64 ≈ 4/3 del tamaño, con 512 KB de margen; 600 páginas). */
export function cabeEnSolicitud(docs: ReadonlyArray<{ bytes: number; paginas: number | null }>): boolean {
  const bytes = docs.reduce((s, d) => s + Math.ceil((d.bytes * 4) / 3), 0) + 512 * 1024
  const paginas = docs.reduce((s, d) => s + (d.paginas ?? 0), 0)
  return bytes <= MAX_BYTES_SOLICITUD && paginas <= MAX_PAGINAS_SOLICITUD
}

/** Elige los documentos que caben, en el orden de ORDEN_TIPOS_IA. */
export function elegirDocumentos<T extends { tipo: TipoDocumento; bytes: number; paginas: number | null }>(docs: readonly T[]): T[] {
  const ordenados = [...docs].sort((a, b) => ORDEN_TIPOS_IA.indexOf(a.tipo) - ORDEN_TIPOS_IA.indexOf(b.tipo))
  const out: T[] = []
  for (const d of ordenados) if (ORDEN_TIPOS_IA.includes(d.tipo) && cabeEnSolicitud([...out, d])) out.push(d)
  return out
}

export function construirSolicitud(input: { contrato: SiaContratoLeido; documentos: DocumentoParaIA[] }): Anthropic.MessageCreateParamsNonStreaming {
  const c = input.contrato
  const contexto =
    `Contrato ${c.codigo ?? ''} de la entidad con NIT ${c.nit_entidad}, contratista ${c.contratista ?? ''} (NIT ${c.nit_contratista}). ` +
    `Según SIA Observa: valor inicial ${c.valor_inicial ?? 'sin dato'}, valor vigente ${c.valor_vigente ?? 'sin dato'}, firma ${c.fecha_firma ?? 'sin dato'}, ` +
    `inicio ${c.fecha_inicio ?? 'sin dato'}, fin ${c.fecha_fin_ampliada ?? c.fecha_fin ?? 'sin dato'}. Úsalo solo para ubicarte: registra lo que digan los documentos, aunque difiera.`
  const content: Anthropic.ContentBlockParam[] = [
    ...input.documentos.map(
      (d): Anthropic.DocumentBlockParam => ({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: d.base64 },
        title: d.nombre,
        context: `Tipo según SIA: ${d.tipo}${d.paginas ? ` · ${d.paginas} páginas` : ''}`,
      })
    ),
    { type: 'text', text: `${contexto}\n\nLee los ${input.documentos.length} documentos y llama a registrar_contrato una sola vez.` },
  ]
  return {
    model: MODELO_EXTRACCION,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high' },
    system: SISTEMA_EXTRACCION,
    tools: [HERRAMIENTA_EXTRACCION],
    tool_choice: { type: 'auto' },
    messages: [{ role: 'user', content }],
  }
}

// ---------------------------------------------------------------------------------------------
// Respuesta
// ---------------------------------------------------------------------------------------------

export interface DatosExtraccion {
  contrato: {
    numero: string
    proceso: string | null
    modalidad: string | null
    entidad: { nombre: string; nit: string | null }
    contratista: { nombre: string; nit: string | null }
    objeto: string
    valor: number
    incluye_impuestos: boolean | null
    plazo_meses: number | null
    fecha_firma: string | null
    fecha_inicio: string | null
    fecha_fin: string | null
    forma_pago: string | null
    soportes_factura: string[]
    garantias: Array<{ tipo: string; porcentaje: number | null; valor_smmlv: number | null; vigencia: string | null }>
    adiciones_max_pct: number | null
    supervision: string | null
  }
  requisitos: {
    liquidez_min: number | null
    endeudamiento_max_pct: number | null
    cobertura_intereses_min: number | null
    capital_trabajo_min_cop: number | null
    capital_trabajo_regla: string | null
    experiencia: string | null
    experiencia_anos_min: number | null
    ciiu: string[]
    seriedad_oferta_pct: number | null
    otros: string[]
  }
  operacion: { instrumentacion: string | null; tiempos_respuesta: string | null; registro_invima: string | null }
  mercado: { cotizantes: Array<{ nombre: string; nit: string | null }>; ganador: string | null; base_presupuesto: string | null; gasto_historico: string | null }
  items: Array<{ referencia: string | null; descripcion: string; unidad: string | null; cantidad: number | null; valor_unitario: number | null }>
  lineas: string[]
  fuentes: Array<{ campo: string; documento: string; pagina: number }>
  faltantes: string[]
}

type RespuestaIA = { stop_reason: string | null; content: Array<{ type: string; name?: string; input?: unknown }>; usage?: unknown }

/** Datos de la llamada a la herramienta, o el motivo por el que no sirve (rechazo, corte por tokens, sin herramienta). */
export function leerRespuesta(message: RespuestaIA): { datos: DatosExtraccion; uso: unknown } | { error: string } {
  if (message.stop_reason === 'refusal') return { error: 'El modelo rechazó la solicitud (stop_reason refusal)' }
  if (message.stop_reason === 'max_tokens') return { error: 'La respuesta se cortó por max_tokens' }
  const tool = message.content.find(b => b.type === 'tool_use' && b.name === HERRAMIENTA_EXTRACCION.name)
  if (!tool) return { error: 'El modelo no llamó a registrar_contrato' }
  const datos = tool.input as Partial<DatosExtraccion> | undefined
  if (!datos || typeof datos !== 'object' || !datos.contrato || !datos.requisitos || !Array.isArray(datos.fuentes)) return { error: 'La herramienta llegó sin la forma del esquema' }
  return { datos: datos as DatosExtraccion, uso: message.usage ?? null }
}

// ---------------------------------------------------------------------------------------------
// Saneo (privacidad)
// ---------------------------------------------------------------------------------------------

const RE_CEDULA = /\b(c\.?\s?c\.?|c[eé]dula( de ciudadan[ií]a)?|identificad[oa] con|documento( de identidad)?( n[oº°.]*)?)\s*(n[oº°.]*\s*)?[:#]?\s*\d{1,3}([.\s]?\d{3}){1,3}\b/gi
/** Razón social inequívoca de empresa (sin NIT, una palabra como "grupo" o "sociedad" no basta: "Grupo de María López"). */
const RE_EMPRESA = /(\bs\.?\s?a\.?\s?s\.?(?=\s|$|[),.;])|\bs\.?\s?a\.(?=\s|$|[),;])|\bltda\b|\blimitada\b|\be\.?\s?s\.?\s?e\.?(?=\s|$|[),;])|\bconsorcio\b|\buni[oó]n temporal\b|\bs\.?\s?en\s?c\.?)/i
/** Palabras de un cargo o dependencia: lo único que se guarda de la supervisión. */
const RE_CARGO = /\b(subgerent|gerent|director|jef[ea]|coordinador|supervisor|profesional|l[ií]der|secretari|asesor|auxiliar|enfermer|m[eé]dic|instrumentador|almac[eé]n|interventor|comit[eé]|oficina|[aá]rea|servicio|subdirector|referente|ingenier|qu[ií]mic|regente|administrador|tesorer|contador)/i

/** De la supervisión, el primer trozo que nombra un cargo o dependencia; si ninguno lo hace (¿un nombre?), nada. */
export function soloCargo(texto: string | null): string | null {
  if (!texto) return null
  const trozo = texto
    .split(/,|\(|\)|;| [–-] /)
    .map(t => t.trim())
    .find(t => t && RE_CARGO.test(t))
  return trozo ?? null
}

export function quitarDatosPersonales(texto: string): string {
  return texto.replace(RE_CEDULA, '[dato personal omitido]')
}

function sanearValor<T>(valor: T): T {
  if (typeof valor === 'string') return quitarDatosPersonales(valor) as T
  if (Array.isArray(valor)) return valor.map(sanearValor) as T
  if (valor && typeof valor === 'object') return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, sanearValor(v)])) as T
  return valor
}

/**
 * Lo que se guarda: sin patrones de cédula en ningún texto; NIT de contratista y entidad normalizados (el del contratista
 * solo si es de empresa); cotizantes solo empresas (NIT de persona jurídica, o sin NIT pero con razón social de empresa);
 * supervisión reducida al cargo (soloCargo: si ningún trozo nombra un cargo, null); el ganador solo si es una de esas empresas.
 */
export function sanearExtraccion(datos: DatosExtraccion): DatosExtraccion {
  const d = sanearValor(JSON.parse(JSON.stringify(datos)) as DatosExtraccion)
  const nitContratista = normalizeNit(d.contrato.contratista?.nit)
  d.contrato.contratista = { nombre: d.contrato.contratista?.nombre ?? '', nit: esNitJuridico(nitContratista) ? nitContratista : null }
  d.contrato.entidad = { nombre: d.contrato.entidad?.nombre ?? '', nit: normalizeNit(d.contrato.entidad?.nit) }
  d.contrato.supervision = soloCargo(d.contrato.supervision)
  d.mercado.cotizantes = (d.mercado.cotizantes ?? [])
    .map(c => ({ nombre: c.nombre, nit: normalizeNit(c.nit) }))
    .filter(c => (c.nit ? esNitJuridico(c.nit) : RE_EMPRESA.test(c.nombre)))
  // El ganador solo si es uno de los cotizantes empresa (o la empresa contratista)
  const empresas = [...d.mercado.cotizantes.map(c => c.nombre), d.contrato.contratista.nit ? d.contrato.contratista.nombre : ''].map(n => normalizeText(n)).filter(Boolean)
  const ganador = normalizeText(d.mercado.ganador)
  if (ganador && !empresas.some(e => ganador.includes(e) || e.includes(ganador))) d.mercado.ganador = null
  return d
}

// ---------------------------------------------------------------------------------------------
// Validación contra SIA y precarga del formulario
// ---------------------------------------------------------------------------------------------

export interface Discrepancia {
  campo: 'valor' | 'fecha_firma' | 'fecha_inicio' | 'fecha_fin' | 'nit_contratista' | 'nit_entidad' | 'numero'
  extraido: string | number | null
  sia: string | number | null
}

/** Diferencias entre lo leído y SIA (valor inicial o vigente, fechas, NIT, número). Vacío = coincide. */
export function validarContraSia(datos: DatosExtraccion, sia: SiaContratoLeido): Discrepancia[] {
  const out: Discrepancia[] = []
  const c = datos.contrato
  const valores = [sia.valor_inicial, sia.valor_vigente].filter((v): v is number => v !== null)
  if (valores.length > 0 && !valores.some(v => Math.abs(v - c.valor) < 1)) out.push({ campo: 'valor', extraido: c.valor, sia: sia.valor_inicial ?? sia.valor_vigente })
  if (c.fecha_firma && sia.fecha_firma && c.fecha_firma !== sia.fecha_firma) out.push({ campo: 'fecha_firma', extraido: c.fecha_firma, sia: sia.fecha_firma })
  if (c.fecha_inicio && sia.fecha_inicio && c.fecha_inicio !== sia.fecha_inicio) out.push({ campo: 'fecha_inicio', extraido: c.fecha_inicio, sia: sia.fecha_inicio })
  const finesSia = [sia.fecha_fin, sia.fecha_fin_ampliada].filter(Boolean)
  if (c.fecha_fin && finesSia.length > 0 && !finesSia.includes(c.fecha_fin)) out.push({ campo: 'fecha_fin', extraido: c.fecha_fin, sia: sia.fecha_fin_ampliada ?? sia.fecha_fin })
  const nitC = normalizeNit(c.contratista?.nit)
  if (nitC && nitC !== sia.nit_contratista) out.push({ campo: 'nit_contratista', extraido: nitC, sia: sia.nit_contratista })
  const nitE = normalizeNit(c.entidad?.nit)
  if (nitE && nitE !== sia.nit_entidad) out.push({ campo: 'nit_entidad', extraido: nitE, sia: sia.nit_entidad })
  if (c.numero && sia.codigo && codigoNorm(c.numero) !== codigoNorm(sia.codigo)) out.push({ campo: 'numero', extraido: c.numero, sia: sia.codigo })
  return out
}

export interface PrecargaIndicadores {
  requires_liquidez: boolean
  min_liquidez: number | null
  requires_endeudamiento: boolean
  max_endeudamiento: number | null
  requires_cobertura: boolean
  min_cobertura: number | null
  requires_capital_trabajo: boolean
  min_capital_trabajo: number | null
  requires_experiencia: boolean
  min_experiencia_years: number | null
  custom_requirements: string
}

const VECES: Record<string, number> = { una: 1, uno: 1, dos: 2, tres: 3, media: 0.5 }

/** Capital de trabajo en pesos: la cifra, o la regla "N vez/veces el presupuesto" × presupuesto. */
export function capitalDeTrabajo(req: DatosExtraccion['requisitos'], presupuesto: number | null): number | null {
  if (req.capital_trabajo_min_cop !== null && req.capital_trabajo_min_cop > 0) return req.capital_trabajo_min_cop
  const regla = (req.capital_trabajo_regla ?? '').toLowerCase()
  const m = /(\d+(?:[.,]\d+)?|una|uno|dos|tres|media)\s*(\(\d+\)\s*)?(vez|veces)/.exec(regla)
  if (!m || presupuesto === null || !/presupuesto/.test(regla)) return null
  const n = VECES[m[1]] ?? Number(m[1].replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n * presupuesto : null
}

/**
 * Indicadores y requisitos adicionales para el formulario (spec, Fase 3.3), en las unidades del formulario: endeudamiento
 * como fracción (50 % → 0,5) y capital de trabajo en millones (510.281.732 → 510,28). Lo que no se pide queda sin marcar.
 */
export function precargaDesdeExtraccion(datos: DatosExtraccion, presupuesto: number | null): PrecargaIndicadores {
  const r = datos.requisitos
  const capital = capitalDeTrabajo(r, presupuesto)
  const lineas: string[] = []
  if (r.experiencia) lineas.push(`Experiencia: ${r.experiencia}`)
  if (r.capital_trabajo_regla) lineas.push(`Capital de trabajo: ${r.capital_trabajo_regla}`)
  if (r.ciiu.length > 0) lineas.push(`CIIU ${r.ciiu.join(', ')}`)
  if (r.seriedad_oferta_pct !== null) lineas.push(`Garantía de seriedad de la oferta: ${r.seriedad_oferta_pct}%`)
  if (datos.operacion.instrumentacion) lineas.push(`Instrumentación: ${datos.operacion.instrumentacion}`)
  if (datos.operacion.registro_invima) lineas.push(`INVIMA: ${datos.operacion.registro_invima}`)
  for (const otro of r.otros) lineas.push(otro)
  return {
    requires_liquidez: r.liquidez_min !== null,
    min_liquidez: r.liquidez_min,
    requires_endeudamiento: r.endeudamiento_max_pct !== null,
    max_endeudamiento: r.endeudamiento_max_pct !== null ? Math.round(r.endeudamiento_max_pct * 100) / 10000 : null,
    requires_cobertura: r.cobertura_intereses_min !== null,
    min_cobertura: r.cobertura_intereses_min,
    requires_capital_trabajo: capital !== null,
    min_capital_trabajo: capital !== null ? Math.round(capital / 10_000) / 100 : null,
    requires_experiencia: r.experiencia_anos_min !== null,
    min_experiencia_years: r.experiencia_anos_min,
    custom_requirements: lineas.join('\n'),
  }
}

/**
 * Diferencias entre los indicadores guardados y los que leyó la IA (spec, Fase 3.5: se muestran para aprobar, nada se
 * escribe solo). Un indicador que la IA no encontró no propone nada; los requisitos adicionales solo se proponen si el
 * contrato no tiene.
 */
export function diferenciasConIa(actual: ContratoActual, pre: PrecargaIndicadores): Diferencia[] {
  const out: Diferencia[] = []
  const distinto = (a: number | null | undefined, b: number) => a === null || a === undefined || Math.abs(Number(a) - b) > 1e-9
  if (pre.min_liquidez !== null && (!actual.requires_liquidez || distinto(actual.min_liquidez, pre.min_liquidez))) {
    out.push({ campo: 'min_liquidez', etiqueta: 'Índice de liquidez mínimo (estudio previo)', actual: actual.requires_liquidez ? actual.min_liquidez ?? null : null, propuesto: pre.min_liquidez, fuente: 'ia', cambios: { requires_liquidez: true, min_liquidez: pre.min_liquidez } })
  }
  if (pre.max_endeudamiento !== null && (!actual.requires_endeudamiento || distinto(actual.max_endeudamiento, pre.max_endeudamiento))) {
    out.push({ campo: 'max_endeudamiento', etiqueta: 'Endeudamiento máximo (estudio previo)', actual: actual.requires_endeudamiento ? actual.max_endeudamiento ?? null : null, propuesto: pre.max_endeudamiento, fuente: 'ia', cambios: { requires_endeudamiento: true, max_endeudamiento: pre.max_endeudamiento } })
  }
  if (pre.min_capital_trabajo !== null && (!actual.requires_capital_trabajo || distinto(actual.min_capital_trabajo, pre.min_capital_trabajo))) {
    out.push({ campo: 'min_capital_trabajo', etiqueta: 'Capital de trabajo mínimo (millones)', actual: actual.requires_capital_trabajo ? actual.min_capital_trabajo ?? null : null, propuesto: pre.min_capital_trabajo, fuente: 'ia', cambios: { requires_capital_trabajo: true, min_capital_trabajo: pre.min_capital_trabajo } })
  }
  if (pre.custom_requirements && !(actual.custom_requirements ?? '').trim()) {
    out.push({ campo: 'custom_requirements', etiqueta: 'Requisitos adicionales', actual: null, propuesto: pre.custom_requirements, fuente: 'ia', cambios: { custom_requirements: pre.custom_requirements } })
  }
  return out
}
