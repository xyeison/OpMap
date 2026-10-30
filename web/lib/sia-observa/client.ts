/**
 * SIA Observa · cliente HTTP del portal de invitado (solo scripts locales: SIA corta las conexiones que no vienen de
 * Colombia, ver "Notas de implementación" de docs/specs/2026-10-29-agente-sia-observa.md; Vercel no lo usa).
 *
 * Reglas del dueño (spec, sección 8) que este cliente hace cumplir:
 *   - Como un ciudadano: solo Get_CTOs_Base, la ficha y el handler de documentos que la ficha enlaza. No prueba otros
 *     handlers ni manda el correo de anonimización.
 *   - Carga baja: UNA petición a la vez (cola), 1,5 s entre peticiones, 3 reintentos con espera creciente (solo red,
 *     429 y 5xx), 60 s de timeout, User-Agent que identifica a la empresa y caché opcional de respuestas.
 *   - Sesión: primero sin cookies (así lo probó el dueño desde el navegador). Si Get_CTOs_Base o la ficha devuelven la
 *     página de login en vez de datos, hace UNA vez el login de invitado por HTTP (postback del enlace "Ingresa como
 *     Invitado", 3.7.1) y reutiliza las cookies. Las descargas mandan el Referer de la ficha (3.7.3).
 */
import * as cheerio from 'cheerio'
import { SIA_BASE_URL, fechaParaSia, fichaUrl, type SiaFilaRaw } from './normalizar'
import { nombreDeContentDisposition } from './ficha'

export const SIA_PAUSA_MS = 1500
export const SIA_TIMEOUT_MS = 60_000
export const SIA_REINTENTOS = 3
export const SIA_INFORME_PATH = '/guess/informe_cont_ciudadania1.aspx'
export const SIA_CTOS_PATH = `${SIA_INFORME_PATH}/Get_CTOs_Base`
export const SIA_LOGIN_PATH = '/Login.aspx?redirect=Inicio'

/** User-Agent: identifica a la empresa; el correo de contacto va en SIA_CONTACTO (lo define el dueño). */
export function userAgentSia(contacto = process.env.SIA_CONTACTO): string {
  const extra = contacto && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contacto) ? `; contacto ${contacto}` : ''
  return `OpMap-SIA/1.0 (VG Medical; consulta ciudadana de contratos publicos${extra})`
}

export interface SiaCache {
  get(clave: string): Promise<string | null>
  set(clave: string, valor: string): Promise<void>
}

export interface SiaClienteOpciones {
  fetch?: typeof fetch
  pausaMs?: number
  timeoutMs?: number
  reintentos?: number
  userAgent?: string
  cache?: SiaCache
  log?: (mensaje: string) => void
  /** Reloj inyectable (pruebas). */
  esperar?: (ms: number) => Promise<void>
}

export interface SiaDescarga {
  status: number
  contentType: string | null
  nombre: string | null
  bytes: Uint8Array
}

export class SiaError extends Error {
  constructor(
    message: string,
    readonly reintentable: boolean
  ) {
    super(message)
    this.name = 'SiaError'
  }
}

/** ¿La respuesta es la página de login (sesión exigida) en vez de lo pedido? */
export function esPaginaLogin(url: string, html: string): boolean {
  return /login\.aspx/i.test(url) || /Ingresa como Invitado/i.test(html)
}

/** Lee {"d":"<json>"} de un WebMethod de ASP.NET y devuelve aaData. Lanza si la forma no es la esperada. */
export function parseCtosBase(texto: string): { total: number | null; filas: SiaFilaRaw[] } {
  let externo: unknown
  try {
    externo = JSON.parse(texto)
  } catch {
    throw new SiaError('Get_CTOs_Base no devolvió JSON (¿página de login o error del portal?)', false)
  }
  const d = (externo as { d?: unknown })?.d
  const interno = typeof d === 'string' ? (JSON.parse(d) as unknown) : d
  const aaData = (interno as { aaData?: unknown })?.aaData
  if (!Array.isArray(aaData)) throw new SiaError('Get_CTOs_Base: la respuesta no trae aaData', false)
  const total = Number((interno as { iTotalRecords?: unknown }).iTotalRecords)
  return { total: Number.isFinite(total) ? total : null, filas: aaData as SiaFilaRaw[] }
}

/** Campos ocultos del formulario ASP.NET y el destino del postback del enlace "Ingresa como Invitado". */
export function formularioInvitado(html: string): { campos: Record<string, string>; eventTarget: string | null } {
  const $ = cheerio.load(html)
  const campos: Record<string, string> = {}
  $('input[type="hidden"]').each((_, el) => {
    const name = $(el).attr('name')
    if (name) campos[name] = String($(el).attr('value') ?? '')
  })
  let eventTarget: string | null = null
  $('a').each((_, a) => {
    if (eventTarget || !/invitado/i.test($(a).text())) return
    const onclick = `${$(a).attr('onclick') ?? ''} ${$(a).attr('href') ?? ''}`
    const postback = /__doPostBack\(\s*['"]([^'"]+)['"]/.exec(onclick)
    if (postback) eventTarget = postback[1]
    else if ($(a).attr('id')) eventTarget = String($(a).attr('id')).replace(/_/g, '$')
  })
  if (!eventTarget) {
    const enScript = /__doPostBack\(\s*['"]([^'"]*[Ii]nvitad[^'"]*)['"]/.exec(html)
    if (enScript) eventTarget = enScript[1]
  }
  return { campos, eventTarget }
}

export class SiaCliente {
  private readonly fetchImpl: typeof fetch
  private readonly pausaMs: number
  private readonly timeoutMs: number
  private readonly reintentos: number
  private readonly userAgent: string
  private readonly cache?: SiaCache
  private readonly log: (mensaje: string) => void
  private readonly esperar: (ms: number) => Promise<void>
  private cola: Promise<unknown> = Promise.resolve()
  private ultimaPeticion = 0
  private cookies = new Map<string, string>()
  private sesionIntentada = false
  /** Peticiones hechas al portal (para el resumen del script). */
  peticiones = 0

  constructor(opts: SiaClienteOpciones = {}) {
    this.fetchImpl = opts.fetch ?? fetch
    this.pausaMs = opts.pausaMs ?? SIA_PAUSA_MS
    this.timeoutMs = opts.timeoutMs ?? SIA_TIMEOUT_MS
    this.reintentos = opts.reintentos ?? SIA_REINTENTOS
    this.userAgent = opts.userAgent ?? userAgentSia()
    this.cache = opts.cache
    this.log = opts.log ?? (() => {})
    this.esperar = opts.esperar ?? (ms => new Promise(resolve => setTimeout(resolve, ms)))
  }

  /** ¿Se hizo login de invitado? (para el informe de la prueba de humo). */
  get conSesion(): boolean {
    return this.cookies.size > 0
  }

  /** Una petición a la vez, con la pausa desde el final de la anterior. */
  private enCola<T>(fn: () => Promise<T>): Promise<T> {
    const siguiente = this.cola.then(async () => {
      const espera = this.ultimaPeticion + this.pausaMs - Date.now()
      if (this.ultimaPeticion > 0 && espera > 0) await this.esperar(espera)
      try {
        return await fn()
      } finally {
        this.ultimaPeticion = Date.now()
      }
    })
    this.cola = siguiente.catch(() => undefined)
    return siguiente
  }

  private cabeceraCookies(): string | undefined {
    if (this.cookies.size === 0) return undefined
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ')
  }

  private guardarCookies(res: Response) {
    const lista = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [res.headers.get('set-cookie') ?? ''].filter(Boolean)
    for (const linea of lista) {
      const [par] = linea.split(';')
      const i = par.indexOf('=')
      if (i > 0) this.cookies.set(par.slice(0, i).trim(), par.slice(i + 1).trim())
    }
  }

  /** fetch con timeout, reintentos (red, 429, 5xx) y espera creciente. Sigue redirecciones guardando cookies. */
  private async pedir(url: string, init: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> }): Promise<Response> {
    let ultimo: unknown = null
    for (let intento = 1; intento <= this.reintentos; intento++) {
      try {
        this.peticiones++
        const headers: Record<string, string> = { 'User-Agent': this.userAgent, 'Accept-Language': 'es-CO,es;q=0.9', ...(init.headers ?? {}) }
        const cookie = this.cabeceraCookies()
        if (cookie) headers.Cookie = cookie
        let res = await this.fetchImpl(url, { ...init, headers, redirect: 'manual', signal: AbortSignal.timeout(this.timeoutMs) })
        this.guardarCookies(res)
        let saltos = 0
        let actual = url
        while (res.status >= 300 && res.status < 400 && res.headers.get('location') && saltos < 5) {
          actual = new URL(res.headers.get('location') as string, actual).toString()
          const cookieSalto = this.cabeceraCookies()
          res = await this.fetchImpl(actual, {
            method: 'GET',
            headers: { 'User-Agent': this.userAgent, ...(cookieSalto ? { Cookie: cookieSalto } : {}) },
            redirect: 'manual',
            signal: AbortSignal.timeout(this.timeoutMs),
          })
          this.guardarCookies(res)
          saltos++
        }
        Object.defineProperty(res, 'urlFinal', { value: actual })
        if (res.status === 429 || res.status >= 500) throw new SiaError(`SIA respondió HTTP ${res.status}`, true)
        return res
      } catch (error) {
        ultimo = error
        const reintentable = error instanceof SiaError ? error.reintentable : true
        if (!reintentable || intento === this.reintentos) break
        const espera = this.pausaMs * 2 ** intento
        this.log(`  SIA: reintento ${intento} en ${Math.round(espera / 1000)} s (${error instanceof Error ? error.message : String(error)})`)
        await this.esperar(espera)
      }
    }
    const causa = (ultimo as { cause?: { code?: string } } | null)?.cause?.code
    const mensaje = ultimo instanceof Error ? ultimo.message : String(ultimo)
    throw new SiaError(causa ? `${mensaje} (${causa})` : mensaje, false)
  }

  /** Login de invitado por HTTP (postback ASP.NET). Devuelve true si quedó con cookies de sesión. */
  async loginInvitado(): Promise<boolean> {
    return this.enCola(async () => {
      this.sesionIntentada = true
      const loginUrl = `${SIA_BASE_URL}${SIA_LOGIN_PATH}`
      const pagina = await this.pedir(loginUrl, { method: 'GET' })
      const html = await pagina.text()
      const { campos, eventTarget } = formularioInvitado(html)
      if (!eventTarget) throw new SiaError('No se encontró el enlace "Ingresa como Invitado" en Login.aspx', false)
      await this.esperar(this.pausaMs)
      const body = new URLSearchParams({ ...campos, __EVENTTARGET: eventTarget, __EVENTARGUMENT: '' })
      const res = await this.pedir(loginUrl, {
        method: 'POST',
        body: body.toString(),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Referer: loginUrl, Origin: SIA_BASE_URL },
      })
      await res.text()
      this.log(`  SIA: login de invitado ${this.cookies.size > 0 ? 'con' : 'SIN'} cookies (${this.cookies.size})`)
      return this.cookies.size > 0
    })
  }

  private async conCache(clave: string, fn: () => Promise<string>, sinCache = false): Promise<string> {
    const guardado = this.cache && !sinCache ? await this.cache.get(clave) : null
    if (guardado !== null) return guardado
    const valor = await fn()
    if (this.cache) await this.cache.set(clave, valor)
    return valor
  }

  /** Contratos de una entidad entre dos fechas 'YYYY-MM-DD' (Get_CTOs_Base; sin paginación: usar ventanas de un mes). */
  async getContratosEntidad(guid: string, desde: string, hasta: string): Promise<{ total: number | null; filas: SiaFilaRaw[] }> {
    const texto = await this.conCache(`ctos:${guid}:${desde}:${hasta}`, async () => {
      const intentar = () =>
        this.enCola(async () => {
          const res = await this.pedir(`${SIA_BASE_URL}${SIA_CTOS_PATH}`, {
            method: 'POST',
            body: JSON.stringify({ ENTIDADES_ID: guid, txtFechaDesde: fechaParaSia(desde), txtFechaHasta: fechaParaSia(hasta) }),
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              Accept: 'application/json, text/javascript, */*; q=0.01',
              'X-Requested-With': 'XMLHttpRequest',
              Referer: `${SIA_BASE_URL}${SIA_INFORME_PATH}`,
              Origin: SIA_BASE_URL,
            },
          })
          return { status: res.status, url: (res as Response & { urlFinal?: string }).urlFinal ?? '', text: await res.text() }
        })
      let r = await intentar()
      if ((r.status >= 400 || esPaginaLogin(r.url, r.text) || !r.text.trim().startsWith('{')) && !this.sesionIntentada) {
        this.log('  SIA: Get_CTOs_Base pidió sesión; login de invitado')
        await this.loginInvitado()
        r = await intentar()
      }
      if (r.status >= 400) throw new SiaError(`Get_CTOs_Base HTTP ${r.status}`, false)
      parseCtosBase(r.text) // valida antes de guardar en caché
      return r.text
    })
    return parseCtosBase(texto)
  }

  /** HTML de la ficha del contrato. */
  async getFicha(idc: number, opts: { sinCache?: boolean } = {}): Promise<string> {
    return this.conCache(`ficha:${idc}`, async () => {
      const intentar = () =>
        this.enCola(async () => {
          const res = await this.pedir(fichaUrl(idc), { method: 'GET', headers: { Accept: 'text/html', Referer: `${SIA_BASE_URL}${SIA_INFORME_PATH}` } })
          return { status: res.status, url: (res as Response & { urlFinal?: string }).urlFinal ?? '', text: await res.text() }
        })
      let r = await intentar()
      if ((r.status >= 400 || esPaginaLogin(r.url, r.text)) && !this.sesionIntentada) {
        this.log('  SIA: la ficha pidió sesión; login de invitado')
        await this.loginInvitado()
        r = await intentar()
      }
      if (r.status >= 400) throw new SiaError(`Ficha ${idc}: HTTP ${r.status}`, false)
      if (esPaginaLogin(r.url, r.text)) throw new SiaError(`Ficha ${idc}: el portal pidió sesión aun después del login de invitado`, false)
      return r.text
    }, opts.sinCache)
  }

  /** Descarga un documento del handler que enlaza la ficha (solo esas URL; nunca otros handlers). */
  async descargarDocumento(url: string, opts: { referer?: string | null } = {}): Promise<SiaDescarga> {
    const destino = new URL(url, SIA_BASE_URL)
    if (destino.origin !== SIA_BASE_URL || !/^\/handlers\/filehandler_guess_anonimo\.ashx$/i.test(destino.pathname)) {
      throw new SiaError(`URL de documento no permitida: ${destino.pathname}`, false)
    }
    return this.enCola(async () => {
      const headers: Record<string, string> = { Accept: 'application/pdf,*/*' }
      if (opts.referer !== null) headers.Referer = opts.referer ?? `${SIA_BASE_URL}/guess/`
      const res = await this.pedir(destino.toString(), { method: 'GET', headers })
      const bytes = new Uint8Array(await res.arrayBuffer())
      return { status: res.status, contentType: res.headers.get('content-type'), nombre: nombreDeContentDisposition(res.headers.get('content-disposition')), bytes }
    })
  }
}
