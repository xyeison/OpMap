/**
 * PR 7 · Compras públicas (SECOP): lógica PURA (sin red, sin base de datos, sin node:*), para que la usen
 * el script de carga (scripts/secop-load.ts), la carga incremental del cron (lib/secop-sync.ts) y, si hace
 * falta, componentes del navegador. Pruebas: scripts/secop-check.ts.
 *
 * Fuentes (datos abiertos de Colombia Compra Eficiente en datos.gov.co, SoQL sin token):
 *   - SECOP II Contratos  jbjy-vk9h → fuente 'secop2'    (marca de agua: ultima_actualizacion)
 *   - SECOP Integrado     rpmr-utcd → fuente 'integrado' (marca de agua: fecha_de_firma_del_contrato)
 *
 * Qué hay aquí:
 *   1. NIT: normalizeNit (siempre 9 dígitos para un NIT de persona jurídica), DV de la DIAN y variantes.
 *   2. Clasificación por línea (classifyLinea / clasificarContrato) y especialidad del médico
 *      (detectEspecialidad), con el prefiltro SoQL que es un SUPERCONJUNTO de la clasificación.
 *   3. esAtipico (misma regla que la función SQL secop_marcar_atipicos de la migración 0710).
 *   4. Mapeo de filas de los dos datasets al modelo común (mapSecopRow) y regla de alcance.
 *   5. URLs SoQL por tarea y cursor de la carga incremental (pasadas reanudables).
 */
import { nitCheckDigit } from './reps-match'

// ---------------------------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------------------------

export const SECOP_BASE_URL = 'https://www.datos.gov.co'
export type SecopFuente = 'secop2' | 'integrado'
export const SECOP_FUENTES: readonly SecopFuente[] = ['secop2', 'integrado'] as const
export const SECOP_DATASETS: Record<SecopFuente, string> = { secop2: 'jbjy-vk9h', integrado: 'rpmr-utcd' }
/** Clave de cada dataset en fuentes_estado (la misma que usa el panel y la ruta /api/cron/<clave>). */
export const SECOP_FUENTE_ESTADO: Record<SecopFuente, 'secop_ii' | 'secop_integrado'> = { secop2: 'secop_ii', integrado: 'secop_integrado' }

export const SECOP_LINEAS = ['trauma', 'reemplazo', 'columna', 'deportiva', 'neurocirugia', 'otros_implantes', 'no_clasificado'] as const
export type SecopLinea = (typeof SECOP_LINEAS)[number]
export type SecopLineaProducto = Exclude<SecopLinea, 'no_clasificado'>
export const SECOP_LINEA_LABELS: Record<SecopLinea, string> = {
  trauma: 'Trauma y osteosíntesis',
  reemplazo: 'Reemplazo articular',
  columna: 'Columna',
  deportiva: 'Medicina deportiva',
  neurocirugia: 'Neurocirugía',
  otros_implantes: 'Otros ortopédicos',
  no_clasificado: 'Sin clasificar',
}

export const ESPECIALIDADES = ['ortopedia', 'neurocirugia', 'columna', 'deportiva'] as const
export type Especialidad = (typeof ESPECIALIDADES)[number]
export const ESPECIALIDAD_LABELS: Record<Especialidad, string> = {
  ortopedia: 'Ortopedia y traumatología',
  neurocirugia: 'Neurocirugía',
  columna: 'Cirugía de columna',
  deportiva: 'Medicina deportiva / artroscopia',
}

/** Versión de las reglas de clasificación (secop_contratos.clasificacion_version). */
export const CLASIFICACION_VERSION = 'v2'
/** Atípico: valor por encima de 50.000 millones de pesos, o del p99 de su entidad. */
export const VALOR_ATIPICO_COP = 50_000_000_000
/** El p99 solo cuenta si la entidad tiene al menos este número de contratos (si no, su mayor contrato siempre sería "atípico"). */
export const ATIPICO_MIN_CONTRATOS = 100
/** numeric(18,2): valores iguales o mayores no caben (y en SECOP son errores de digitación). */
export const VALOR_MAXIMO = 1e16

// ---------------------------------------------------------------------------------------------
// 1. Texto y NIT
// ---------------------------------------------------------------------------------------------

/** Minúsculas, sin tildes (ñ → n), solo letras y dígitos separados por un espacio. */
export function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Dígito de verificación DIAN de un NIT (módulo 11). */
export function dvNit(nit: string): number | null {
  return nitCheckDigit(nit)
}

/** NIT jurídico: 9 dígitos que empiezan por 8 o 9 (las personas naturales usan su cédula). */
export function esNitJuridico(nit: string | null | undefined): boolean {
  return typeof nit === 'string' && /^[89]\d{8}$/.test(nit)
}

/**
 * NIT a 9 dígitos (sin DV) desde lo que publica SECOP: '900294380', '9002943801', '900.294.380-1',
 * '900294380 1', '860.529.890 - 0', '830.035.101 ¿ 8', '860.529.8900'. Regla: se quitan puntos y espacios
 * pegados al número, se toma la primera tira de dígitos antes de un separador (guion, '¿', espacio) y,
 * si tiene 10 dígitos y empieza por 8 o 9, el último es el DV. Otros largos (5–12 dígitos: cédulas, NIT
 * de persona natural) se devuelven tal cual. null si no hay número.
 */
export function normalizeNit(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null
  const text = String(raw).trim()
  if (!text) return null
  // "900.294.380 - 1" → "900294380 - 1"; se conservan los separadores entre número y DV
  const sinPuntos = text.replace(/(\d)\.(?=\d)/g, '$1')
  const first = sinPuntos.split(/[^0-9]+/).filter(Boolean)
  if (first.length === 0) return null
  let digits = first[0]
  // "900294380 1" o "860529890 0": el DV llegó separado por un espacio → la primera tira ya es el NIT
  if (digits.length === 10 && /^[89]/.test(digits)) digits = digits.slice(0, 9)
  if (digits.length < 5 || digits.length > 12) return null
  return digits
}

/** Formas en que SECOP escribe un NIT de 9 dígitos: sin DV, con DV pegado y con guion. */
export function variantesNit(nit9: string): string[] {
  const dv = dvNit(nit9)
  return dv === null ? [nit9] : [nit9, `${nit9}${dv}`, `${nit9}-${dv}`]
}

/** '900294380' → '900.294.380' (como lo escriben algunas entidades de SECOP I). */
export function nitConPuntos(nit9: string): string {
  return `${nit9.slice(0, 3)}.${nit9.slice(3, 6)}.${nit9.slice(6)}`
}

const TIPOS_PERSONA = [
  'cedula de ciudadania',
  'cedula de extranjeria',
  'pasaporte',
  'tarjeta de identidad',
  'registro civil',
  'permiso especial de permanencia',
  'permiso por proteccion temporal',
  'nit de persona natural',
  'carne diplomatico',
]

/**
 * ¿El proveedor es una persona natural? Por el tipo de documento; y un "NIT" que no parece de persona
 * jurídica (no son 9 dígitos que empiezan por 8 o 9) también se trata como persona: es su cédula + DV.
 */
export function esDocumentoPersona(tipoDoc: unknown, documento: unknown): boolean {
  const tipo = normalizeText(tipoDoc)
  if (TIPOS_PERSONA.includes(tipo)) return true
  const nit = normalizeNit(documento)
  if (!nit) return false
  return !esNitJuridico(nit)
}

/** Solo los dígitos del documento (para el hash de una persona). */
export function digitosDocumento(documento: unknown): string | null {
  const digits = String(documento ?? '').replace(/\D/g, '')
  return digits.length >= 3 ? digits : null
}

// ---------------------------------------------------------------------------------------------
// 2. Clasificación por línea y especialidad
// ---------------------------------------------------------------------------------------------

/**
 * Prefiltro de texto para la consulta SoQL inicial (upper(campo) like '%RAÍZ%'). Debe ser un
 * SUPERCONJUNTO de la clasificación: todo contrato que clasifica en una línea o con especialidad contiene
 * al menos una de estas raíces (scripts/secop-check.ts lo comprueba con los textos de prueba). Las raíces
 * con tilde van en las dos formas porque SoQL compara tal cual.
 */
export const SECOP_PREFILTRO_RAICES: readonly string[] = [
  'ORTOP', 'ORTÓP', 'TRAUMA', 'OSTEO', 'OSEO', 'ÓSEO', 'ORTESIS', 'ÓRTESIS',
  'ARTROPLAST', 'ARTROSC', 'ARTRODESIS', 'PROTESIS', 'PRÓTESIS', 'REEMPLAZO', 'COTILO', 'ACETABUL', 'ACETÁBUL',
  'NEUROCIRU', 'CRANE', 'CRÁNE', 'ANEURISM', 'HIDROCEF', 'HIDROCÉF', 'DERIVACI',
  'COLUMNA', 'VERTEBR', 'VÉRTEBR', 'ESPINAL', 'PEDICUL', 'PEDÍCUL', 'INTERSOM', 'CIFOPLAST',
  'MENISC', 'LIGAMENT', 'ANCLA', 'TENODESIS', 'ROTADOR', 'DEPORTOLOG', 'MEDICINA DEPORTIVA',
  'FIJACI', 'FIJADOR', 'TUTOR', 'FRACTURA', 'MEDULAR', 'KIRSCHNER', 'STEINMANN', 'CANULAD',
  'TORNILLO', 'PLACA', 'CLAVO',
]

/** Familias UNSPSC de implantes y productos ortopédicos (SECOP II: codigo_de_categoria_principal). */
export const SECOP_UNSPSC_ORTOPEDIA_PREFIJOS: readonly string[] = ['4232']

/** ¿El texto pasaría el prefiltro SoQL? (mismo criterio: mayúsculas, comparación literal). */
export function pasaPrefiltro(...textos: unknown[]): boolean {
  const upper = textos.map(t => (t === null || t === undefined ? '' : String(t).toUpperCase())).join(' \n ')
  return SECOP_PREFILTRO_RAICES.some(raiz => upper.includes(raiz))
}

interface PatronLinea {
  linea: Exclude<SecopLineaProducto, 'otros_implantes'>
  re: RegExp
  /** Señal débil (ítems de osteosíntesis): solo cuenta si ninguna otra línea específica aparece. */
  debil?: boolean
}

/** Patrones específicos de cada línea, sobre texto normalizado (minúsculas, sin tildes). */
const PATRONES: readonly PatronLinea[] = [
  // Neurocirugía
  { linea: 'neurocirugia', re: /\bneurocirug|\bneurocirujan/ },
  { linea: 'neurocirugia', re: /\bcraneotom|\bcraneoplast|\bcraneal(es)?\b|\bcraneos?\b|\bcraneo ?encefalic/ },
  { linea: 'neurocirugia', re: /\bhidrocefal|\bvalvulas? de derivacion|\bderivacion(es)? ventricul/ },
  // "Aneurisma" solo es neurocirugía si no es de aorta (endoprótesis vasculares: cardiovascular, excluido; ver RE_ANEURISMA_VASCULAR)
  { linea: 'neurocirugia', re: /\baneurism/ },
  // Columna
  { linea: 'columna', re: /\bcolumna (vertebral|lumbar|cervical|dorsal|toracica|toracolumbar|lumbosacra|espinal)\b/ },
  {
    linea: 'columna',
    re: /\b(cirugia|cirugias|material|materiales|implantes?|instrumentacion|instrumental|sistemas?|patologia|patologias|procedimientos?|insumos|dispositivos|osteosintesis|especialista|subespecialista|cirujano|grupo|reconstruccion) (de|para|en) (la )?columna\b/,
  },
  { linea: 'columna', re: /\bvertebr|\bcifoplast|\bintersomatic|\bdisco intervertebral|\bpedicul|\bartrodesis (lumbar|cervical|vertebral|de columna)/ },
  { linea: 'columna', re: /\bfusion (vertebral|espinal|lumbar|cervical|intersomatica)/ },
  // Reemplazo articular
  { linea: 'reemplazo', re: /\bartroplast|\bhemiartroplast|\bcotilo|\bacetabul|\bvastagos? femoral/ },
  { linea: 'reemplazo', re: /\breemplazos? articular|\breemplazos? (total(es)?|parcial(es)?)( y (total(es)?|parcial(es)?))? de (cadera|rodilla|hombro|codo|tobillo)/ },
  { linea: 'reemplazo', re: /\breemplazos? de (cadera|rodilla|hombro|codo|tobillo)|\bprotesis (total(es)? |parcial(es)? )?(de )?(cadera|rodilla|hombro|codo|tobillo)|\bprotesis articular/ },
  // Medicina deportiva
  { linea: 'deportiva', re: /\bartroscop|\bmedicina deportiva|\bdeportolog|\bligamentos?\b|\bmenisc|\btenodesis|\bmanguito rotador/ },
  { linea: 'deportiva', re: /\b(anclas?|anclajes?) (oseos?|de sutura|para sutura|biodegradables?|bioabsorbibles?|de titanio|peek|todo sutura)/ },
  { linea: 'deportiva', re: /\btornillos? interferencial/ },
  // Trauma (términos específicos; "osteosíntesis" a secas es genérico, ver abajo)
  { linea: 'trauma', re: /\bosteosintesis (general|basica)|\bfijacion(es)? extern|\bfijador(es)? extern|\btutor(es)? extern|\bminifijador/ },
  { linea: 'trauma', re: /\btrauma\b|\btraumatismos?\b|\bfracturas?\b/ },
  { linea: 'trauma', re: /\bendo ?medular|\bintra ?medular|\bkirschner|\bsteinmann|\btornillos? canulad/ },
  // Ítems de osteosíntesis (SECOP I lista el ítem: "TORNILLO CORTICAL 4.5", "PLACA TIBIA PROXIMAL"). Un tornillo
  // o una placa a secas es ferretería; con calificativo ortopédico o anatómico es trauma (v2, 2026-10-11).
  {
    linea: 'trauma',
    debil: true,
    re: /\b(tornillos?|placas?|clavos?)\b[^.;|]{0,40}?\b(cortical(es)?|esponjos[oa]s?|maleolar(es)?|bloquead[oa]s?|de bloqueo|tibia(l|les)?|femur|humero|humeral(es)?|radio distal|cubito|clavicula|perone|olecranon|calcane[oa]|condilar(es)?|lcp|dcp|dhs|pfn|tercio de tubo|de reconstruccion)\b/,
  },
]

/** Aneurisma de aorta / endovascular: cirugía vascular (excluida), no neurocirugía. */
const RE_ANEURISMA_VASCULAR = /\baort|\bendovascular|\bendoprotesis|\biliac|\btoracoabdominal|\bvena cava/
/** Aneurisma cerebral: neurocirugía aunque el contrato hable también de lo vascular. */
const RE_ANEURISMA_CEREBRAL = /\baneurismas? (cerebral|intracranea)|\bclips? (de|para) aneurism/

/** Osteosíntesis genérica (incluye errores de digitación vistos: "osteosistesis", "osteosinteis"). */
const RE_OSTEO = /\bosteos(?!arcoma)[a-z]*/
/** Ortopedia genérica: no dice la línea, pero es material o servicio ortopédico. */
const RE_ORTO_GENERICO = /\bortoped|\btraum[ao]tolog|\binjertos? oseos?|\bsustitutos? oseos?|\bcemento oseo|\btejidos? oseos?|\bosteoarticular|\breconstructivas? oseas?|\bortesis\b/
/** Lo que nunca es ortopedia aunque comparta palabras o categoría UNSPSC. */
const RE_EXCLUIDO = /\baort|\bendovascular|\bodontolog|\bdental(es)?\b|\boftalm|\bocular(es)?\b|\bintraocular|\bcardiac|\bcardiovascular|\bcoronari|\bmarcapas|\bstents?\b|\bmamari|\bcoclear|\bauditiv|\bmedicamentos?\b/
/** Contratos que nunca son de material ortopédico aunque lo nombren (p. ej. disposición de residuos de osteosíntesis). */
const RE_EXCLUIDO_TOTAL = /\b(desechos|residuos|incineracion|disposicion final|recoleccion)\b/
/** "espinal" de anestesia (agujas espinales, bloqueo espinal) o el municipio de El Espinal (Tolima) no es columna. */
const RE_ESPINAL_ANESTESIA = /\b(anestesia|agujas?|bloqueos?|raquidea|raquideas|kit|kits|trocar) (\w+ )?espinal(es)?\b|\b(el|de|del) espinal\b/g
const RE_ESPINAL = /\bespinal(es)?\b/
/** Varias especialidades en un mismo contrato de osteosíntesis → la línea principal es trauma. */
const RE_ESPECIALIDADES = /\bespecialidades\b/
/** "Ortopedia (artroscopia)", "ortopedia (columna)": la especialidad viene calificada → manda la línea. */
const RE_ORTOPEDIA_CALIFICADA = /\bortopedia (artroscop|columna|reemplazo|medicina deportiva|deportiva)/

/** Servicio profesional (médicos, especialistas) sin compra de material. */
const RE_SERVICIO =
  /\b(prestacion de (los )?servicios?|prestar (sus |los )?servicios|servicios? profesional(es)?|servicios? personal(es)?|apoyo a la gestion|como medico|medicos? especialistas?|especialistas? en|medicina especializada|servicios? de salud|servicios? medicos?|servicios? asistencial(es)?|ortopedista|neurocirujan[oa]|(ejecutar|ejecucion de|desarrollo de|desarrollar) (los )?(sub)?procesos|atencion en (ortopedia|neurocirugia|traumatologia)|contratar (el )?personal|personal (tecnico|asistencial|profesional|medico)|servic[a-z]* especializad[a-z]*|operar de manera independiente|autogobierno|contrato sindical|(contratar|vincular) (a )?(un|una|el|la|los|las) (profesional|medic[oa]|especialista)[a-z]*|profesional(es)? (medic[oa]s?|en medicina|especializad[oa]s?)|que ejerza sus funciones|procesos? asistencial(es)?|subprocesos?|especialidades medicas|(garantizar|realizar|desarrollar|ejecutar) (las |los )?(actividades|procesos|procedimientos) (de|en)|instrumentador[a]?)\b/
const RE_PRODUCTO = /\b(suministros?|suministrar|materiales?|implantes?|insumos?|dispositivos?|compras?|adquisicion|adquirir|osteos[a-z]*|protesis|alquiler|arrendamiento|comodato|equipos?|instrumental|elementos)\b/

/** ¿Es un contrato de servicios profesionales sin compra de material? */
export function esServicioProfesional(texto: string): boolean {
  // Objetos que empiezan por el rol de la persona ("INSTRUMENTADORA OSTEOSINTESIS", "MEDICO ORTOPEDISTA")
  if (/^(instrumentador[a]?|auxiliar|enfermer[oa]|tecnic[oa]|tecnolog[oa]|medic[oa]|especialista|profesional|ortopedista|neurocirujan[oa])\b/.test(texto) && !/\b(suministros?|compras?|adquisicion)\b/.test(texto)) return true
  const servicio = RE_SERVICIO.exec(texto)
  if (!servicio) return false
  // "Adquisición / compra / contratación de servicios" es un servicio, no una compra de material
  const producto = RE_PRODUCTO.exec(texto.replace(/\b(adquisicion|adquirir|compras?|contratacion) (de )?(los )?servicios\b/g, 'servicios'))
  if (!producto) return true
  // "Prestación de servicios profesionales de ortopedia … incluye insumos": manda cómo empieza el objeto,
  // salvo que la compra aparezca pronto ("prestación de servicios de arrendamiento de equipos…")
  return servicio.index < 40 && producto.index >= 60
}

export interface Clasificacion {
  linea: SecopLinea
  /** Todas las líneas detectadas (la principal primero); vacío si no clasifica. */
  lineas: SecopLineaProducto[]
  motivo: 'servicio' | 'especifica' | 'multiple' | 'osteosintesis' | 'generico' | 'unspsc' | 'excluido' | 'ninguno'
}

function textoClasificable(objeto: unknown, descripcion: unknown): string {
  const obj = normalizeText(objeto)
  const desc = normalizeText(descripcion)
  return desc && desc !== obj ? `${obj} . ${desc}` : obj
}

/**
 * Clasifica un contrato en una línea de producto. Regla (v2), sobre objeto + descripción sin tildes:
 *   0. Servicio profesional sin material (p. ej. "médico especialista en ortopedia") → no_clasificado
 *      (la especialidad va en detectEspecialidad).
 *   1. Líneas específicas nombradas (neurocirugía, columna, reemplazo, deportiva y trauma: fijación
 *      externa, fracturas, clavos endomedulares…). "Osteosíntesis" a secas NO es específica.
 *   2. Ninguna específica: "osteosíntesis" → trauma; ortopedia genérica → otros_implantes; categoría
 *      UNSPSC 4232 (implantes ortopédicos) → otros_implantes; lo excluido (dental, oftálmico,
 *      cardiovascular…) nunca entra por genérico ni por UNSPSC.
 *   3. Una específica: esa línea ("material de osteosíntesis para neurocirugía" → neurocirugia), salvo
 *      un contrato de osteosíntesis "de ortopedia" que nombra la otra línea después de "ortopedia" o para
 *      varias "especialidades" → trauma. "Ortopedia (artroscopia)" sí manda la línea calificada.
 *   Nunca clasifican los contratos de residuos (recolección, incineración) aunque nombren osteosíntesis.
 *   4. Dos o más: si nombra trauma u osteosíntesis → trauma (contrato general); si no, la que aparece
 *      primero en el texto.
 */
export function clasificarContrato(objeto: unknown, descripcion: unknown, unspsc?: unknown): Clasificacion {
  const texto = textoClasificable(objeto, descripcion)
  if (!texto) return { linea: 'no_clasificado', lineas: [], motivo: 'ninguno' }
  if (esServicioProfesional(texto)) return { linea: 'no_clasificado', lineas: [], motivo: 'servicio' }
  if (RE_EXCLUIDO_TOTAL.test(texto)) return { linea: 'no_clasificado', lineas: [], motivo: 'excluido' }

  const sinAnestesia = texto.replace(RE_ESPINAL_ANESTESIA, ' ')
  const posiciones = new Map<PatronLinea['linea'], number>()
  const aneurismaVascular = RE_ANEURISMA_VASCULAR.test(sinAnestesia) && !RE_ANEURISMA_CEREBRAL.test(sinAnestesia)
  let itemTrauma: number | null = null
  for (const patron of PATRONES) {
    if (aneurismaVascular && patron.re.source === '\\baneurism') continue
    const match = patron.re.exec(sinAnestesia)
    if (!match) continue
    if (patron.debil) {
      itemTrauma = match.index
      continue
    }
    if (!posiciones.has(patron.linea) || match.index < (posiciones.get(patron.linea) as number)) {
      posiciones.set(patron.linea, match.index)
    }
  }
  const espinal = RE_ESPINAL.exec(sinAnestesia)
  if (espinal && (!posiciones.has('columna') || espinal.index < (posiciones.get('columna') as number))) posiciones.set('columna', espinal.index)
  // Ítem de osteosíntesis ("tornillo cortical", "placa de tibia"): trauma solo si no hay otra línea (los tornillos
  // de un cotilo son de reemplazo; un tornillo interferencial es de deportiva)
  if (itemTrauma !== null && posiciones.size === 0 && !/\binterferencial/.test(sinAnestesia)) posiciones.set('trauma', itemTrauma)

  const osteo = RE_OSTEO.test(texto)
  const ordenadas = Array.from(posiciones.entries())
    .sort((a, b) => a[1] - b[1])
    .map(([linea]) => linea)

  if (ordenadas.length === 0) {
    if (osteo) return { linea: 'trauma', lineas: ['trauma'], motivo: 'osteosintesis' }
    const excluido = RE_EXCLUIDO.test(texto)
    if (!excluido && RE_ORTO_GENERICO.test(texto)) return { linea: 'otros_implantes', lineas: ['otros_implantes'], motivo: 'generico' }
    const codigo = String(unspsc ?? '').replace(/^V1\./i, '')
    if (!excluido && SECOP_UNSPSC_ORTOPEDIA_PREFIJOS.some(prefijo => codigo.startsWith(prefijo))) {
      return { linea: 'otros_implantes', lineas: ['otros_implantes'], motivo: 'unspsc' }
    }
    return { linea: 'no_clasificado', lineas: [], motivo: excluido ? 'excluido' : 'ninguno' }
  }

  if (ordenadas.length === 1) {
    const unica = ordenadas[0]
    const orto = /\bortoped/.exec(texto)
    if (unica !== 'trauma' && osteo && orto && !RE_ORTOPEDIA_CALIFICADA.test(texto)) {
      // "Osteosíntesis de ortopedia … y neurocirugía": contrato general de osteosíntesis → trauma, salvo que
      // la línea se nombre antes que "ortopedia" ("material para cirugía de columna del servicio de ortopedia")
      if (RE_ESPECIALIDADES.test(texto) || orto.index < (posiciones.get(unica) as number)) {
        return { linea: 'trauma', lineas: ['trauma', unica], motivo: 'multiple' }
      }
    }
    return { linea: unica, lineas: [unica], motivo: 'especifica' }
  }

  if (ordenadas.includes('trauma') || osteo) {
    return { linea: 'trauma', lineas: ['trauma', ...ordenadas.filter(l => l !== 'trauma')], motivo: 'multiple' }
  }
  return { linea: ordenadas[0], lineas: ordenadas, motivo: 'multiple' }
}

/** Línea principal del contrato (ver clasificarContrato). */
export function classifyLinea(objeto: unknown, descripcion: unknown, unspsc?: unknown): SecopLinea {
  return clasificarContrato(objeto, descripcion, unspsc).linea
}

/** Roles que no son el médico especialista aunque el objeto nombre la especialidad. */
const RE_NO_ESPECIALISTA =
  /\b(auxiliar(es)?|enfermer[oa]s?|enfermeria|instrumentador[a]?|instrumentacion quirurgica|tecnic[oa]s?|tecnolog[oa]s?|fisioterap[a-z]*|terapeutas?|terapia fisica|camilleros?|secretari[oa]s?|administrativ[oa]s?|facturador[a]?|aseo|vigilancia|conductor(es)?|psicolog[a-z]*|nutricionista|optometr[a-z]*|bacteriolog[a-z]*|regente|farmac[a-z]*|odontolog[a-z]*|fonoaudiolog[a-z]*|trabajador[a]? social|medicos? generales?|medico general|apoyo a la gestion|adecuacion(es)?|locativ[a-z]*|obras?|mantenimiento|remodelacion|construccion|reparacion(es)?|transporte|alimentacion|lavanderia)\b/

/**
 * Especialidad de un contrato de servicios profesionales (persona natural o empresa de especialistas):
 * columna > deportiva > neurocirugía > ortopedia. null si no es un servicio profesional, si nombra otro
 * rol (auxiliar, enfermería, instrumentación, médico general…) o si no nombra ninguna de las cuatro.
 */
export function detectEspecialidad(objeto: unknown, descripcion?: unknown): Especialidad | null {
  const texto = textoClasificable(objeto, descripcion)
  if (!texto || !esServicioProfesional(texto)) return null
  if (RE_NO_ESPECIALISTA.test(texto)) return null
  if (/\bcirug[a-z]* de (la )?columna|\bcolumna vertebral|\b(sub)?especialista en (cirugia de )?columna|\bcirujano de columna|\bpatologia de columna/.test(texto)) return 'columna'
  if (/\bmedicina deportiva|\bdeportolog|\bartroscop/.test(texto)) return 'deportiva'
  if (/\bneurocirug|\bneurocirujan/.test(texto)) return 'neurocirugia'
  if (/\bortoped|\bortopedista|\btraum[ao]tolog/.test(texto)) return 'ortopedia'
  return null
}

// ---------------------------------------------------------------------------------------------
// 3. Atípicos
// ---------------------------------------------------------------------------------------------

/**
 * Misma regla que la función SQL secop_marcar_atipicos(): valor > 50.000 M, o > p99 de los contratos de
 * su entidad cuando la entidad tiene al menos ATIPICO_MIN_CONTRATOS contratos.
 */
export function esAtipico(valor: number | null | undefined, entidad?: { p99: number | null; contratos: number } | null): boolean {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return false
  if (valor > VALOR_ATIPICO_COP) return true
  if (!entidad || entidad.p99 === null || entidad.contratos < ATIPICO_MIN_CONTRATOS) return false
  return valor > entidad.p99
}

/** Percentil continuo (como percentile_cont de PostgreSQL). */
export function percentilContinuo(valores: number[], p: number): number | null {
  const sorted = valores.filter(v => Number.isFinite(v)).sort((a, b) => a - b)
  if (sorted.length === 0) return null
  const pos = (sorted.length - 1) * p
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

// ---------------------------------------------------------------------------------------------
// 4. Mapeo de filas al modelo común
// ---------------------------------------------------------------------------------------------

export type SecopRaw = Record<string, unknown>

/** Fila lista para secop_contratos (sin id, atipico ni imported_at). */
export interface SecopContratoRow {
  fuente: SecopFuente
  origen: 'SECOPI' | 'SECOPII'
  id_contrato: string
  numero_contrato: string | null
  referencia: string | null
  proceso: string | null
  nit_entidad: string
  nombre_entidad: string | null
  departamento_entidad: string | null
  municipio_entidad: string | null
  nivel_entidad: string | null
  hospital_id: string | null
  documento_proveedor: string | null
  proveedor_hash: string | null
  tipo_doc_proveedor: string | null
  proveedor_nombre: string | null
  proveedor_vigilado_id: string | null
  es_persona: boolean
  tipo_contrato: string | null
  modalidad: string | null
  categoria_unspsc: string | null
  objeto: string | null
  descripcion: string | null
  linea: SecopLinea
  lineas: SecopLineaProducto[]
  especialidad_medico: Especialidad | null
  clasificacion_version: string
  valor: number | null
  valor_pagado: number | null
  fecha_firma: string | null
  fecha_inicio: string | null
  fecha_fin: string | null
  estado: string | null
  url: string | null
  ultima_actualizacion: string | null
}

export interface SecopMapContext {
  /** sha256 con la sal del proyecto de los dígitos del documento (personas naturales). */
  hashDocumento: (digitos: string) => string
  /** NIT de 9 dígitos → IPS principal de OpMap con ese NIT. */
  hospitalPorNit?: ReadonlyMap<string, string>
  /** NIT (9 dígitos) de los proveedores vigilados activos. */
  vigilados?: ReadonlySet<string>
}

const VACIOS = new Set(['', 'no definido', 'sin descripcion', 'no aplica', 'unspecified', 'null', 'n a', 'na'])

/** Texto limpio: espacios colapsados; null si viene vacío o "NO DEFINIDO". */
export function cleanText(value: unknown, max = 4000): string | null {
  if (value === null || value === undefined) return null
  const raw = typeof value === 'object' ? (value as { url?: unknown }).url ?? '' : value
  const text = String(raw).replace(/\s+/g, ' ').trim()
  if (VACIOS.has(normalizeText(text))) return null
  return text.length > max ? text.slice(0, max) : text
}

/** 'YYYY-MM-DD' desde un floating timestamp de Socrata; null si no es fecha o está fuera de 1990–2100. */
export function toIsoDate(value: unknown): string | null {
  const text = String(value ?? '').trim()
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text)
  if (!match) return null
  const year = Number(match[1])
  if (year < 1990 || year > 2100) return null
  const iso = `${match[1]}-${match[2]}-${match[3]}`
  return Number.isNaN(Date.parse(`${iso}T00:00:00Z`)) ? null : iso
}

/** Pesos: número ≥ 0 y < 1e16; null en otro caso (texto, negativo o error de digitación gigante). */
export function toMoney(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(String(value).replace(/[$\s,]/g, ''))
  if (!Number.isFinite(n) || n < 0 || n >= VALOR_MAXIMO) return null
  return Math.round(n * 100) / 100
}

export type SecopMapResult = { row: SecopContratoRow } | { error: string }

/** Mapea una fila cruda de jbjy-vk9h (SECOP II) o rpmr-utcd (Integrado) al modelo común. */
export function mapSecopRow(fuente: SecopFuente, raw: SecopRaw, ctx: SecopMapContext): SecopMapResult {
  const s2 = fuente === 'secop2'
  const nitEntidad = normalizeNit(s2 ? raw.nit_entidad : raw.nit_de_la_entidad)
  if (!nitEntidad) return { error: `NIT de entidad ilegible (${String(s2 ? raw.nit_entidad : raw.nit_de_la_entidad)})` }

  const origenRaw = s2 ? 'SECOPII' : String(raw.origen ?? '').trim().toUpperCase()
  if (origenRaw !== 'SECOPI' && origenRaw !== 'SECOPII') return { error: `origen desconocido (${String(raw.origen)})` }
  const origen = origenRaw as 'SECOPI' | 'SECOPII'

  const tipoDoc = cleanText(s2 ? raw.tipodocproveedor : raw.tipo_documento_proveedor, 80)
  const documentoRaw = cleanText(raw.documento_proveedor, 80)
  const esPersona = documentoRaw !== null && esDocumentoPersona(tipoDoc, documentoRaw)
  let documento: string | null = null
  let hash: string | null = null
  if (documentoRaw !== null) {
    if (esPersona) {
      const digitos = digitosDocumento(documentoRaw)
      hash = digitos ? ctx.hashDocumento(digitos) : null
    } else {
      documento = normalizeNit(documentoRaw)
    }
  }

  const objeto = cleanText(s2 ? raw.objeto_del_contrato : raw.objeto_del_proceso)
  const descripcionRaw = cleanText(s2 ? raw.descripcion_del_proceso : raw.objeto_a_contratar)
  const descripcion = descripcionRaw && descripcionRaw !== objeto ? descripcionRaw : null
  const unspsc = s2 ? cleanText(raw.codigo_de_categoria_principal, 40) : null
  const clasificacion = clasificarContrato(objeto, descripcion, unspsc)
  const especialidad = detectEspecialidad(objeto, descripcion)

  const numero = cleanText(s2 ? raw.id_contrato : raw.numero_del_contrato, 200)
  const fechaFirma = toIsoDate(s2 ? raw.fecha_de_firma : raw.fecha_de_firma_del_contrato)
  const proveedorNombre = cleanText(s2 ? raw.proveedor_adjudicado : raw.nom_raz_social_contratista, 300)
  let idContrato: string
  if (s2) {
    if (!numero) return { error: 'SECOP II sin id_contrato' }
    idContrato = numero
  } else {
    if (!numero && !fechaFirma) return { error: 'Integrado sin número de contrato ni fecha de firma' }
    const proveedorClave = documento ?? (hash ? `h${hash.slice(0, 24)}` : normalizeText(proveedorNombre).slice(0, 60))
    idContrato = [origen, numero ?? '', proveedorClave, fechaFirma ?? ''].join('|')
  }

  const vigilado = documento && ctx.vigilados?.has(documento) ? documento : null

  return {
    row: {
      fuente,
      origen,
      id_contrato: idContrato,
      numero_contrato: numero,
      referencia: cleanText(s2 ? raw.referencia_del_contrato : raw.numero_de_proceso, 300),
      proceso: s2 ? cleanText(raw.proceso_de_compra, 200) : null,
      nit_entidad: nitEntidad,
      nombre_entidad: cleanText(s2 ? raw.nombre_entidad : raw.nombre_de_la_entidad, 300),
      departamento_entidad: cleanText(s2 ? raw.departamento : raw.departamento_entidad, 100),
      municipio_entidad: cleanText(s2 ? raw.ciudad : raw.municipio_entidad, 100),
      nivel_entidad: cleanText(s2 ? raw.orden : raw.nivel_entidad, 60),
      hospital_id: ctx.hospitalPorNit?.get(nitEntidad) ?? null,
      documento_proveedor: documento,
      proveedor_hash: hash,
      tipo_doc_proveedor: tipoDoc,
      proveedor_nombre: proveedorNombre,
      proveedor_vigilado_id: vigilado,
      es_persona: esPersona,
      tipo_contrato: cleanText(raw.tipo_de_contrato, 120),
      modalidad: cleanText(s2 ? raw.modalidad_de_contratacion : raw.modalidad_de_contrataci_n, 200),
      categoria_unspsc: unspsc,
      objeto,
      descripcion,
      linea: clasificacion.linea,
      lineas: clasificacion.lineas,
      especialidad_medico: especialidad,
      clasificacion_version: CLASIFICACION_VERSION,
      valor: toMoney(s2 ? raw.valor_del_contrato : raw.valor_contrato),
      valor_pagado: s2 ? toMoney(raw.valor_pagado) : null,
      fecha_firma: fechaFirma,
      fecha_inicio: toIsoDate(s2 ? raw.fecha_de_inicio_del_contrato : raw.fecha_inicio_ejecuci_n),
      fecha_fin: toIsoDate(s2 ? raw.fecha_de_fin_del_contrato : raw.fecha_fin_ejecuci_n),
      estado: cleanText(s2 ? raw.estado_contrato : raw.estado_del_proceso, 120),
      url: cleanText(s2 ? raw.urlproceso : raw.url_contrato, 1000),
      ultima_actualizacion: s2 ? toIsoDate(raw.ultima_actualizacion) : null,
    },
  }
}

export type SecopAlcance = 'vigilado' | 'linea' | 'especialidad' | null

/**
 * ¿Se guarda el contrato? Todo lo de un proveedor vigilado (con cualquier entidad); y de las entidades
 * objetivo (IPS públicas o mixtas), lo que clasifica en una línea o es un servicio de especialista.
 * Lo demás (aseo, vigilancia, medicamentos…) no se guarda.
 */
export function decidirAlcance(row: Pick<SecopContratoRow, 'proveedor_vigilado_id' | 'nit_entidad' | 'linea' | 'especialidad_medico'>, entidades: ReadonlySet<string>): SecopAlcance {
  if (row.proveedor_vigilado_id) return 'vigilado'
  if (!entidades.has(row.nit_entidad)) return null
  if (row.linea !== 'no_clasificado') return 'linea'
  if (row.especialidad_medico) return 'especialidad'
  return null
}

/** Marca de agua de la fila para el cursor incremental (secop2: ultima_actualizacion; integrado: firma). */
export function watermarkDeFila(fuente: SecopFuente, raw: SecopRaw): string | null {
  return toIsoDate(fuente === 'secop2' ? raw.ultima_actualizacion : raw.fecha_de_firma_del_contrato)
}

// ---------------------------------------------------------------------------------------------
// 5. Tareas, URLs SoQL y cursor incremental
// ---------------------------------------------------------------------------------------------

export type SecopModo = 'inicial' | 'incremental'

export interface SecopTarea {
  tipo: 'entidades' | 'proveedores'
  /** NIT de 9 dígitos. */
  nits: string[]
  /**
   * Histórico completo aunque la pasada sea incremental: entidades o proveedores que entraron después de la
   * última pasada completa (p. ej. un NIT añadido a la lista vigilada) traen todo su historial una vez.
   */
  historico?: boolean
}

/** Tamaño de los grupos de NIT por consulta (la URL debe quedar por debajo de ~7 KB). */
export const SECOP_TAREA_TAMANO = { entidades: 40, proveedores: 40 } as const

export function buildSecopTareas(
  entidades: readonly string[],
  proveedores: readonly string[],
  tamano: { entidades: number; proveedores: number } = SECOP_TAREA_TAMANO,
  nuevos?: { entidades: readonly string[]; proveedores: readonly string[] } | null
): SecopTarea[] {
  const tareas: SecopTarea[] = []
  const ent = Array.from(new Set(entidades)).sort()
  const prov = Array.from(new Set(proveedores)).sort()
  for (let i = 0; i < ent.length; i += tamano.entidades) tareas.push({ tipo: 'entidades', nits: ent.slice(i, i + tamano.entidades) })
  for (let i = 0; i < prov.length; i += tamano.proveedores) tareas.push({ tipo: 'proveedores', nits: prov.slice(i, i + tamano.proveedores) })
  const nEnt = Array.from(new Set(nuevos?.entidades ?? [])).sort()
  const nProv = Array.from(new Set(nuevos?.proveedores ?? [])).sort()
  for (let i = 0; i < nEnt.length; i += tamano.entidades) tareas.push({ tipo: 'entidades', nits: nEnt.slice(i, i + tamano.entidades), historico: true })
  for (let i = 0; i < nProv.length; i += tamano.proveedores) tareas.push({ tipo: 'proveedores', nits: nProv.slice(i, i + tamano.proveedores), historico: true })
  return tareas
}

/** NIT que no estaban en la última pasada completa (null = no se sabe: no se pide histórico extra). */
export function nitsNuevos(actuales: readonly string[], completos: readonly string[] | null | undefined): string[] {
  if (!completos) return []
  const antes = new Set(completos)
  return Array.from(new Set(actuales)).filter(nit => !antes.has(nit)).sort()
}

/** Huella corta de la lista de tareas (si cambia la lista de entidades o proveedores, la pasada se reinicia). */
export function huellaTareas(fuente: SecopFuente, tareas: readonly SecopTarea[]): string {
  const text = `${fuente}#${tareas.map(t => `${t.historico ? 'h' : ''}${t.tipo}:${t.nits.join(',')}`).join(';')}`
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0
    h2 = Math.imul(h2 ^ c, 2246822519) >>> 0
  }
  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}-${tareas.length}`
}

const sq = (value: string) => `'${value.replace(/'/g, "''")}'`

/** Cláusula del prefiltro de texto (y UNSPSC en SECOP II) para la carga inicial. */
export function prefiltroSoql(fuente: SecopFuente): string {
  const campos = fuente === 'secop2' ? ['objeto_del_contrato', 'descripcion_del_proceso'] : ['objeto_del_proceso', 'objeto_a_contratar']
  const partes = campos.flatMap(campo => SECOP_PREFILTRO_RAICES.map(raiz => `upper(${campo}) like ${sq(`%${raiz}%`)}`))
  if (fuente === 'secop2') for (const prefijo of SECOP_UNSPSC_ORTOPEDIA_PREFIJOS) partes.push(`codigo_de_categoria_principal like ${sq(`V1.${prefijo}%`)}`)
  return partes.join(' OR ')
}

export interface SecopUrlOptions {
  modo: SecopModo
  /** Límite inferior de la marca de agua (incremental); 'YYYY-MM-DD'. */
  desde: string | null
  offset: number
  limit: number
  base?: string
}

/** URL SoQL de una página de una tarea. Orden estable por :id (recomendado por Socrata para paginar). */
export function buildSecopUrl(fuente: SecopFuente, tarea: SecopTarea, opciones: SecopUrlOptions): string {
  const opts: SecopUrlOptions = tarea.historico ? { ...opciones, modo: 'inicial', desde: null } : opciones
  const condiciones: string[] = []
  if (tarea.tipo === 'entidades') {
    const columna = fuente === 'secop2' ? 'nit_entidad' : 'nit_de_la_entidad'
    // En SECOP II nit_entidad es numérico: la forma con guion daría "type mismatch"
    const valores = tarea.nits.flatMap(nit => variantesNit(nit)).filter(v => fuente === 'integrado' || /^\d+$/.test(v))
    condiciones.push(`${columna} in (${valores.map(sq).join(',')})`)
    if (opts.modo === 'inicial') condiciones.push(`(${prefiltroSoql(fuente)})`)
  } else if (fuente === 'secop2') {
    const valores = tarea.nits.flatMap(nit => variantesNit(nit))
    condiciones.push(`documento_proveedor in (${valores.map(sq).join(',')})`)
  } else {
    // SECOP I escribe el NIT del contratista de muchas formas ('900294380-1', '900.294.380 - 1', '900294380 1')
    const prefijos = tarea.nits.flatMap(nit => [nit, nitConPuntos(nit)])
    condiciones.push(`(${prefijos.map(p => `starts_with(documento_proveedor, ${sq(p)})`).join(' OR ')})`)
  }
  if (opts.modo === 'incremental' && opts.desde) {
    const columna = fuente === 'secop2' ? 'ultima_actualizacion' : 'fecha_de_firma_del_contrato'
    condiciones.push(`${columna} >= ${sq(`${opts.desde}T00:00:00.000`)}`)
  }
  const params = new URLSearchParams({
    $where: condiciones.join(' AND '),
    $order: ':id',
    $limit: String(opts.limit),
    $offset: String(opts.offset),
  })
  return `${opts.base ?? SECOP_BASE_URL}/resource/${SECOP_DATASETS[fuente]}.json?${params.toString()}`
}

/** Días que se re-leen en cada pasada incremental (SECOP publica tarde y corrige). */
export const SECOP_SOLAPE_DIAS: Record<SecopFuente, number> = { secop2: 3, integrado: 30 }

export interface SecopCursor {
  version: 1
  en_curso: boolean
  modo: SecopModo
  /** Marca de agua mínima de la pasada en curso (null = carga inicial completa). */
  desde: string | null
  paso: number
  offset: number
  max_visto: string | null
  inicio_pasada: string | null
  huella: string | null
  /** Para la próxima pasada (se fija al cerrar). */
  siguiente_desde: string | null
  leidas: number
  guardadas: number
  ultima_pasada: { fin: string; modo: SecopModo; leidas: number; guardadas: number; desde: string | null } | null
  /** Entidades y proveedores ya cubiertos por una pasada completa (los nuevos traen su histórico). */
  nits_completos: { entidades: string[]; proveedores: string[] } | null
  /** Invocaciones seguidas en que la página actual no cupo en el tiempo de la función (cron). */
  agotados: number
}

export function cursorVacio(): SecopCursor {
  return {
    version: 1,
    en_curso: false,
    modo: 'inicial',
    desde: null,
    paso: 0,
    offset: 0,
    max_visto: null,
    inicio_pasada: null,
    huella: null,
    siguiente_desde: null,
    leidas: 0,
    guardadas: 0,
    ultima_pasada: null,
    nits_completos: null,
    agotados: 0,
  }
}

const isoDateOrNull = (value: unknown) => (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null)
const intOr = (value: unknown, fallback: number) => (typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : fallback)

/** Lee el cursor guardado en fuentes_estado.cursor (tolerante: lo que no reconoce vuelve al valor vacío). */
export function parseSecopCursor(value: unknown): SecopCursor {
  const base = cursorVacio()
  if (!value || typeof value !== 'object') return base
  const v = value as Record<string, unknown>
  const ultima = v.ultima_pasada && typeof v.ultima_pasada === 'object' ? (v.ultima_pasada as SecopCursor['ultima_pasada']) : null
  const nc = v.nits_completos && typeof v.nits_completos === 'object' ? (v.nits_completos as Record<string, unknown>) : null
  const listaNits = (x: unknown) => (Array.isArray(x) ? x.filter((n): n is string => typeof n === 'string' && /^\d{5,12}$/.test(n)) : [])
  const nitsCompletos = nc ? { entidades: listaNits(nc.entidades), proveedores: listaNits(nc.proveedores) } : null
  return {
    version: 1,
    en_curso: v.en_curso === true,
    modo: v.modo === 'incremental' ? 'incremental' : 'inicial',
    desde: isoDateOrNull(v.desde),
    paso: intOr(v.paso, 0),
    offset: intOr(v.offset, 0),
    max_visto: isoDateOrNull(v.max_visto),
    inicio_pasada: typeof v.inicio_pasada === 'string' ? v.inicio_pasada : null,
    huella: typeof v.huella === 'string' ? v.huella : null,
    siguiente_desde: isoDateOrNull(v.siguiente_desde),
    leidas: intOr(v.leidas, 0),
    guardadas: intOr(v.guardadas, 0),
    ultima_pasada: ultima,
    nits_completos: nitsCompletos,
    agotados: intOr(v.agotados, 0),
  }
}

/** 'YYYY-MM-DD' menos n días. */
export function restarDias(isoDate: string, dias: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - dias)
  return d.toISOString().slice(0, 10)
}

/**
 * Empieza (o retoma) una pasada. Si hay una en curso con la misma lista de tareas, sigue donde iba; si la
 * lista cambió, vuelve a la tarea 0 con el mismo "desde". Si no hay pasada en curso, abre una nueva desde
 * siguiente_desde (incremental) o desde cero (inicial, o si se fuerza).
 */
export function iniciarPasada(cursor: SecopCursor, opts: { ahora: Date; huella: string; forzarInicial?: boolean }): SecopCursor {
  if (cursor.en_curso && !opts.forzarInicial) {
    if (cursor.huella === opts.huella) return cursor
    return { ...cursor, paso: 0, offset: 0, huella: opts.huella }
  }
  const desde = opts.forzarInicial ? null : cursor.siguiente_desde
  return {
    ...cursor,
    en_curso: true,
    modo: desde ? 'incremental' : 'inicial',
    desde,
    paso: 0,
    offset: 0,
    max_visto: null,
    inicio_pasada: opts.ahora.toISOString(),
    huella: opts.huella,
    leidas: 0,
    guardadas: 0,
    agotados: 0,
  }
}

/** Tras esta cantidad de invocaciones seguidas sin poder leer la página actual, la carga pide el script. */
export const SECOP_MAX_AGOTADOS = 3

/**
 * Registra una página leída: avanza el offset; si la página vino incompleta, pasa a la siguiente tarea.
 * La marca de agua máxima ignora fechas futuras (errores de digitación como 2099) para no saltarse datos.
 */
export function registrarPagina(cursor: SecopCursor, page: { filas: number; limite: number; guardadas: number; maxVisto: string | null; ahora: Date }): SecopCursor {
  const manana = new Date(page.ahora.getTime() + 86400000).toISOString().slice(0, 10)
  const visto = page.maxVisto && page.maxVisto <= manana ? page.maxVisto : null
  const maxVisto = visto && (!cursor.max_visto || visto > cursor.max_visto) ? visto : cursor.max_visto
  const completa = page.filas >= page.limite
  return {
    ...cursor,
    paso: completa ? cursor.paso : cursor.paso + 1,
    offset: completa ? cursor.offset + page.filas : 0,
    max_visto: maxVisto,
    leidas: cursor.leidas + page.filas,
    guardadas: cursor.guardadas + page.guardadas,
    agotados: 0,
  }
}

export function pasadaTerminada(cursor: SecopCursor, totalTareas: number): boolean {
  return cursor.paso >= totalTareas
}

/**
 * Cierra la pasada: la próxima empezará en (máxima marca de agua vista − solape). `nits` = entidades y
 * proveedores que esta pasada cubrió entera (para saber cuáles son nuevos la próxima vez).
 */
export function cerrarPasada(cursor: SecopCursor, opts: { ahora: Date; solapeDias: number; nits?: { entidades: string[]; proveedores: string[] } }): SecopCursor {
  const referencia = cursor.max_visto ?? cursor.desde
  return {
    ...cursor,
    nits_completos: opts.nits ? { entidades: [...opts.nits.entidades].sort(), proveedores: [...opts.nits.proveedores].sort() } : cursor.nits_completos,
    en_curso: false,
    paso: 0,
    offset: 0,
    siguiente_desde: referencia ? restarDias(referencia, opts.solapeDias) : cursor.siguiente_desde,
    ultima_pasada: { fin: opts.ahora.toISOString(), modo: cursor.modo, leidas: cursor.leidas, guardadas: cursor.guardadas, desde: cursor.desde },
  }
}
