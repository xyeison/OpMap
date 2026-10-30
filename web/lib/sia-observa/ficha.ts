/**
 * SIA Observa · ficha del contrato (GET /guess/cto_ficha_resumen_guess.aspx?idc=…) y respuestas del handler de
 * documentos. Lógica pura (cheerio, sin red ni base de datos). Pruebas: scripts/sia-observa-check.ts.
 *
 * Lo verificado por el dueño el 29-oct (spec, 3.4 y 3.5) y en lo que este parser se apoya:
 *   - Los documentos son enlaces <a href="/handlers/filehandler_guess_anonimo.ashx?ianx=…&ianxa=…&eid=<GUID>">
 *     con el texto "nombre.pdf --> 2026/07/09", y vienen repetidos: se deduplican por (ianx, ianxa).
 *   - Secciones con encabezado h3/h4: Información Básica, Contratistas, Supervisores - Interventores, Fechas
 *     Registradas ("Fecha de Publicación en el SECOP" con enlace "Ver Pub"), Documentos, Novedades, Traza.
 *   - El handler responde 200 application/pdf, o 200 text/html con un aviso de bootbox (pide correo para anonimizar,
 *     o "se restringe su visualización" por la Ley 1581).
 * Lo que NO se pudo ver en HTML real desde aquí (SIA corta conexiones fuera de Colombia): el marcado exacto de los
 * pares etiqueta → valor. Por eso los datos básicos se leen de forma tolerante (celda de etiqueta y la siguiente con
 * texto) y el sync NO depende de ellos: los campos del contrato salen de Get_CTOs_Base. Privacidad: de Contratistas
 * solo quedan las empresas; Supervisores e interventores no se leen.
 */
import * as cheerio from 'cheerio'
import type { AnyNode } from 'domhandler'
import { esNitJuridico, normalizeNit, normalizeText } from '../secop'
import { SIA_BASE_URL, siaDinero, siaFecha, siaTexto } from './normalizar'
import { tipoDocumento, type TipoDocumento } from './tipos'

export { TIPOS_DOCUMENTO, TIPOS_CLAVE, TIPO_DOCUMENTO_LABELS, tipoDocumento, type TipoDocumento } from './tipos'

// ---------------------------------------------------------------------------------------------
// Respuesta del handler
// ---------------------------------------------------------------------------------------------

export type RespuestaDocumento =
  | { estado: 'pdf' }
  | { estado: 'anonimizacion_pendiente' }
  | { estado: 'restringido' }
  | { estado: 'error'; detalle: string }

const MAGIA_PDF = [0x25, 0x50, 0x44, 0x46] // %PDF

/** ¿Empieza por %PDF (se toleran hasta 1024 bytes de basura antes, como hacen los lectores)? */
export function esBytesPdf(bytes: Uint8Array): boolean {
  const limite = Math.min(bytes.length - 4, 1024)
  for (let i = 0; i <= limite; i++) {
    if (bytes[i] === MAGIA_PDF[0] && bytes[i + 1] === MAGIA_PDF[1] && bytes[i + 2] === MAGIA_PDF[2] && bytes[i + 3] === MAGIA_PDF[3]) return true
  }
  return false
}

/**
 * Clasifica lo que devolvió el handler: PDF solo si los bytes empiezan por %PDF Y el content-type es de PDF (o binario
 * genérico). Un HTML con bootbox: "introduce tu correo" / anonimización → anonimizacion_pendiente (NUNCA se manda el
 * correo); "se restringe su visualización" / Ley 1581 → restringido. Lo demás es error.
 */
export function clasificarRespuestaDocumento(status: number, contentType: string | null, bytes: Uint8Array): RespuestaDocumento {
  if (status < 200 || status >= 300) return { estado: 'error', detalle: `HTTP ${status}` }
  const tipo = (contentType ?? '').toLowerCase()
  const pareceBinario = tipo === '' || tipo.includes('pdf') || tipo.includes('octet-stream') || tipo.includes('force-download')
  if (esBytesPdf(bytes)) {
    return pareceBinario ? { estado: 'pdf' } : { estado: 'error', detalle: `bytes de PDF con content-type ${tipo}` }
  }
  const texto = normalizeText(new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(0, 200_000)))
  if (/introduce tu correo|introduzca su correo|proceso de anonimizacion|anonimizacion de su solicitud/.test(texto)) return { estado: 'anonimizacion_pendiente' }
  if (/se restringe su visualizacion|ley 1581|restringe la visualizacion/.test(texto)) return { estado: 'restringido' }
  return { estado: 'error', detalle: `respuesta inesperada (${tipo || 'sin content-type'}, ${bytes.length} bytes)` }
}

/** filename de Content-Disposition (attachment; filename=…), con filename* (RFC 5987) si viene. */
export function nombreDeContentDisposition(header: string | null): string | null {
  if (!header) return null
  const estrella = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/.exec(header)
  if (estrella) {
    try {
      return decodeURIComponent(estrella[1].trim())
    } catch {
      return estrella[1].trim()
    }
  }
  const simple = /filename\s*=\s*"?([^";]+)"?/i.exec(header)
  return simple ? simple[1].trim() : null
}

// ---------------------------------------------------------------------------------------------
// Ficha
// ---------------------------------------------------------------------------------------------

export interface FichaDocumento {
  nombre: string
  tipo: TipoDocumento
  fechaCargue: string | null
  ianx: number
  ianxa: number
  eid: string | null
  url: string
}

export interface FichaNovedad {
  tipo: string
  fecha: string | null
  valor: number | null
  detalle: string | null
}

export interface FichaContratista {
  nit: string
  nombre: string | null
  tipo: string | null
  fechaVinculacion: string | null
}

export interface FichaBasica {
  objeto: string | null
  codigo: string | null
  valorInicial: number | null
  adiciones: number | null
  valorVigente: number | null
  modalidad: string | null
  procedimiento: string | null
  tipoContrato: string | null
  fechaFirma: string | null
  fechaInicio: string | null
  fechaFin: string | null
  plazo: string | null
  estado: string | null
}

export interface FichaSia {
  basica: FichaBasica
  /** Solo empresas (personas naturales omitidas). */
  contratistas: FichaContratista[]
  personasOmitidas: number
  fechaPublicacionSecop: string | null
  urlSecop: string | null
  fechaCargueSia: string | null
  documentos: FichaDocumento[]
  novedades: FichaNovedad[]
  secciones: string[]
}

/** Solo el handler de documentos del propio portal (cualquier otro enlace se ignora). */
const HANDLER_PATH = '/handlers/filehandler_guess_anonimo.ashx'

/** Etiquetas de Información Básica (texto normalizado → campo). La primera que case gana. */
const ETIQUETAS: ReadonlyArray<[keyof FichaBasica, RegExp]> = [
  ['objeto', /^objeto( del contrato)?$/],
  ['codigo', /^(codigo|numero)( del)?( contrato)?$/],
  ['valorInicial', /^valor inicial/],
  ['adiciones', /^(valor )?(de )?adiciones$/],
  ['valorVigente', /^valor (vigente|total|actual)/],
  ['modalidad', /^modalidad/],
  ['procedimiento', /^(procedimiento|causal)/],
  ['tipoContrato', /^(tipo de contrato|tipologia|clase de contrato)/],
  ['fechaFirma', /^fecha (de )?(firma|suscripcion)/],
  ['fechaInicio', /^fecha (de )?(inicio|acta de inicio)/],
  ['fechaFin', /^fecha (de )?(terminacion|termino|fin|finalizacion)/],
  ['plazo', /^plazo/],
  ['estado', /^estado( del contrato)?$/],
]

const NOVEDADES = ['adiciones', 'adicion prorroga', 'prorroga', 'cesion', 'otrosi', 'suspension', 'reinicio', 'terminacion', 'liquidacion'] as const

function textoDe($: cheerio.CheerioAPI, el: AnyNode): string {
  return $(el).text().replace(/\s+/g, ' ').trim()
}

function etiquetaNormal(text: string): string {
  return normalizeText(text.replace(/:\s*$/, ''))
}

export function parseFicha(html: string): FichaSia {
  const $ = cheerio.load(html)
  $('script, style, noscript').remove()

  // Encabezados en orden y "celdas" hoja (texto sin elementos de bloque dentro), con el encabezado vigente
  const secciones: string[] = []
  const celdas: Array<{ text: string; seccion: string; el: AnyNode }> = []
  let seccion = ''
  const HOJAS = new Set(['td', 'th', 'label', 'span', 'dt', 'dd', 'b', 'strong', 'p', 'li', 'div', 'a', 'input', 'textarea'])
  $('body *').each((_, el) => {
    const tag = (el as { tagName?: string }).tagName?.toLowerCase() ?? ''
    if (/^h[1-6]$/.test(tag)) {
      seccion = normalizeText(textoDe($, el))
      if (seccion) secciones.push(seccion)
      return
    }
    if (!HOJAS.has(tag)) return
    const hijosBloque = $(el).children().filter((__, c) => HOJAS.has((c as { tagName?: string }).tagName?.toLowerCase() ?? '') && textoDe($, c) !== '')
    if (hijosBloque.length > 0 && tag !== 'td' && tag !== 'th') return
    if (tag === 'td' || tag === 'th') {
      // celda con hijos: se toma su texto completo y se saltan los hijos (se marcan como vistos)
      $(el).find('*').attr('data-sia-visto', '1')
    } else if ($(el).attr('data-sia-visto')) {
      return
    }
    const text = tag === 'input' || tag === 'textarea' ? String($(el).attr('value') ?? $(el).text() ?? '').trim() : textoDe($, el)
    if (text) celdas.push({ text, seccion, el })
  })

  // Información básica: etiqueta → la siguiente celda con texto que no sea otra etiqueta
  const basica: FichaBasica = {
    objeto: null, codigo: null, valorInicial: null, adiciones: null, valorVigente: null, modalidad: null,
    procedimiento: null, tipoContrato: null, fechaFirma: null, fechaInicio: null, fechaFin: null, plazo: null, estado: null,
  }
  const esEtiqueta = (text: string) => ETIQUETAS.some(([, re]) => re.test(etiquetaNormal(text)))
  const enBasica = (s: string) => s === '' || /informacion basica|datos basicos|informacion general/.test(s)
  for (let i = 0; i < celdas.length; i++) {
    const celda = celdas[i]
    if (!enBasica(celda.seccion)) continue
    const label = etiquetaNormal(celda.text)
    // "Etiqueta: valor" en la misma celda
    const enLinea = /^([^:]{3,60}):\s*(.+)$/.exec(celda.text)
    for (const [campo, re] of ETIQUETAS) {
      if (basica[campo] !== null) continue
      let valor: string | null = null
      if (re.test(label)) {
        const siguiente = celdas.slice(i + 1, i + 4).find(c => !esEtiqueta(c.text))
        valor = siguiente?.text ?? null
      } else if (enLinea && re.test(etiquetaNormal(enLinea[1]))) {
        valor = enLinea[2]
      }
      if (valor === null) continue
      if (campo === 'valorInicial' || campo === 'adiciones' || campo === 'valorVigente') basica[campo] = siaDinero(valor)
      else if (campo === 'fechaFirma' || campo === 'fechaInicio' || campo === 'fechaFin') basica[campo] = siaFecha(valor)
      else basica[campo] = siaTexto(valor, campo === 'objeto' ? 4000 : 300)
      break
    }
  }

  // Contratistas (solo empresas): filas de la tabla bajo el encabezado "Contratistas"
  const contratistas: FichaContratista[] = []
  let personasOmitidas = 0
  $('tr').each((_, tr) => {
    if (!/^contratistas?$/.test(seccionDe($, tr))) return
    const cells = $(tr).children('td').map((__, td) => textoDe($, td)).get()
    if (cells.length < 2) return
    const nit = normalizeNit(cells[0])
    if (!nit) return
    const tipo = cells[2] ?? null
    if (!esNitJuridico(nit) || /natural/.test(normalizeText(tipo))) {
      personasOmitidas++
      return
    }
    contratistas.push({ nit, nombre: siaTexto(cells[1], 300), tipo: siaTexto(tipo, 80), fechaVinculacion: siaFecha(cells[3] ?? '') })
  })

  // Fechas registradas: publicación en SECOP (y su enlace "Ver Pub") y cargue en SIA
  let fechaPublicacionSecop: string | null = null
  let fechaCargueSia: string | null = null
  for (let i = 0; i < celdas.length; i++) {
    const label = etiquetaNormal(celdas[i].text)
    const valorSiguiente = () => {
      for (const c of celdas.slice(i, i + 4)) {
        const f = siaFecha(c.text.replace(/^[^0-9]*/, ''))
        if (f) return f
      }
      return null
    }
    if (!fechaPublicacionSecop && /publicacion en (el )?secop/.test(label)) fechaPublicacionSecop = valorSiguiente()
    if (!fechaCargueSia && /fecha (de )?(cargue|creacion|registro)( en (el )?sia)?/.test(label) && !/secop/.test(label)) fechaCargueSia = valorSiguiente()
  }
  let urlSecop: string | null = null
  $('a').each((_, a) => {
    if (urlSecop) return
    const text = normalizeText($(a).text())
    const href = String($(a).attr('href') ?? '')
    if (/^ver pub/.test(text) || /secop\.gov\.co/i.test(href)) {
      const m = /https?:\/\/[^'"\s)]+/.exec(href + ' ' + String($(a).attr('onclick') ?? ''))
      if (m) urlSecop = m[0]
    }
  })

  // Documentos: enlaces del handler, deduplicados por (ianx, ianxa)
  const documentos: FichaDocumento[] = []
  const vistos = new Set<string>()
  $('a').each((_, a) => {
    const href = String($(a).attr('href') ?? '')
    let url: URL
    try {
      url = new URL(href, SIA_BASE_URL)
    } catch {
      return
    }
    if (url.origin !== SIA_BASE_URL || url.pathname.toLowerCase() !== HANDLER_PATH) return
    const ianx = Number(url.searchParams.get('ianx'))
    const ianxa = Number(url.searchParams.get('ianxa'))
    if (!Number.isSafeInteger(ianx) || !Number.isSafeInteger(ianxa) || ianx <= 0 || ianxa <= 0) return
    const clave = `${ianx}:${ianxa}`
    if (vistos.has(clave)) return
    vistos.add(clave)
    const texto = $(a).text().replace(/\s+/g, ' ').trim()
    const [nombreCrudo, fechaCruda] = texto.split(/\s*-->\s*/)
    const nombre = (nombreCrudo || `documento_${ianx}_${ianxa}`).trim()
    documentos.push({
      nombre,
      tipo: tipoDocumento(nombre),
      fechaCargue: siaFecha(fechaCruda ?? ''),
      ianx,
      ianxa,
      eid: (url.searchParams.get('eid') ?? '').toLowerCase() || null,
      url: url.toString(),
    })
  })

  // Novedades: tablas bajo cada subtítulo de "Novedades" (Adiciones, Prórroga, …, Liquidación)
  const novedades: FichaNovedad[] = []
  $('table').each((_, table) => {
    const tipo = seccionDe($, table)
    const nombre = NOVEDADES.find(n => tipo === n || tipo.replace(/[^a-z ]/g, '') === n)
    if (!nombre) return
    $(table)
      .find('tr')
      .each((__, tr) => {
        const cells = $(tr).children('td').map((___, td) => textoDe($, td)).get()
        if (cells.length === 0 || cells.every(c => !c) || /no (hay|existen|se encontraron) (registros|datos)/.test(normalizeText(cells.join(' ')))) return
        const fecha = cells.map(c => siaFecha(c)).find(Boolean) ?? null
        const valor = cells.map(c => (/\$|\d{1,3}(,\d{3})+/.test(c) ? siaDinero(c) : null)).find(v => v !== null) ?? null
        // En cesiones el texto suele ser el nombre de quien cede o recibe (puede ser una persona): no se guarda
        const detalle = nombre === 'cesion' ? null : [...cells].filter(c => !siaFecha(c) && siaDinero(c) === null).sort((a, b) => b.length - a.length)[0] ?? null
        novedades.push({ tipo: nombre, fecha, valor, detalle: siaTexto(detalle, 1000) })
      })
  })

  return { basica, contratistas, personasOmitidas, fechaPublicacionSecop, urlSecop, fechaCargueSia, documentos, novedades, secciones }
}

/** Encabezado (h1–h6) más cercano antes del elemento, normalizado. */
function seccionDe($: cheerio.CheerioAPI, el: AnyNode): string {
  let nodo: cheerio.Cheerio<AnyNode> = $(el)
  for (let saltos = 0; saltos < 12 && nodo.length > 0; saltos++) {
    let prev = nodo.prev()
    while (prev.length > 0) {
      const tag = (prev.get(0) as { tagName?: string }).tagName?.toLowerCase() ?? ''
      if (/^h[1-6]$/.test(tag)) return normalizeText(prev.text())
      const interno = prev.find('h1, h2, h3, h4, h5, h6').last()
      if (interno.length > 0) return normalizeText(interno.text())
      prev = prev.prev()
    }
    nodo = nodo.parent()
  }
  return ''
}

/** Ficha sin datos de personas, para guardar en sia_contratos.ficha (jsonb). */
export function fichaParaGuardar(ficha: FichaSia): Record<string, unknown> {
  return {
    basica: ficha.basica,
    contratistas: ficha.contratistas,
    personas_omitidas: ficha.personasOmitidas,
    fecha_publicacion_secop: ficha.fechaPublicacionSecop,
    url_secop: ficha.urlSecop,
    fecha_cargue_sia: ficha.fechaCargueSia,
    novedades: ficha.novedades,
    documentos: ficha.documentos.length,
  }
}
