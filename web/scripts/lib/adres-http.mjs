/**
 * Consulta HTTP de los reportes públicos de la ADRES (ASP.NET + ReportViewer / SSRS). Lo comparten
 * scripts/adres-giros.mjs (Reporte 29) y scripts/adres-identifica-giro.mjs ("Identifica tu Giro").
 *
 * - Peticiones HTTP normales con un User-Agent que se identifica como el script; SIN navegador y sin
 *   hacerse pasar por uno. Si el firewall de la ADRES devuelve su página de bloqueo, se lanza
 *   BlockedError y el script se detiene (no reintenta ni lo evade).
 * - TLS: el servidor de la ADRES envía una cadena incompleta (le falta "Go Daddy Secure Certificate
 *   Authority - G2"); buildAgent() descarga ese intermedio de la URL AIA del propio certificado (como
 *   hacen los navegadores) y la verificación sigue siendo completa contra las raíces de Node.
 */
import https from 'node:https'
import http from 'node:http'
import tls from 'node:tls'
import crypto from 'node:crypto'
import { extractExportUrlBase, extractFormFields, isBlockedPage } from '../../lib/adres-parse.mjs'

export const ADRES_HOST = 'aplicaciones.adres.gov.co'

export class BlockedError extends Error {}

function peerCertificate(host) {
  return new Promise((resolve, reject) => {
    // Solo se lee el certificado que presenta el servidor; no se envía ningún dato por esta conexión.
    const socket = tls.connect({ host, port: 443, servername: host, rejectUnauthorized: false }, () => {
      const cert = socket.getPeerCertificate(true)
      socket.end()
      resolve(cert)
    })
    socket.setTimeout(30000, () => socket.destroy(new Error('Tiempo de espera agotado leyendo el certificado')))
    socket.on('error', reject)
  })
}

function httpGetBuffer(url, userAgent) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: 30000, headers: { 'user-agent': userAgent } }, res => {
      if (res.statusCode !== 200) {
        res.resume()
        reject(new Error(`HTTP ${res.statusCode} descargando ${url}`))
        return
      }
      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => resolve(Buffer.concat(chunks)))
    })
    req.on('timeout', () => req.destroy(new Error(`Tiempo de espera agotado descargando ${url}`)))
    req.on('error', reject)
  })
}

/** Agente HTTPS con la cadena completa (intermedio por AIA). @param {string} userAgent */
export async function buildAgent(userAgent, host = ADRES_HOST) {
  const ca = [...tls.rootCertificates]
  try {
    const leaf = await peerCertificate(host)
    const issuers = (leaf.infoAccess && leaf.infoAccess['CA Issuers - URI']) || []
    for (const url of issuers.filter(u => /^http:\/\//.test(u))) {
      const der = await httpGetBuffer(url, userAgent)
      const intermediate = new crypto.X509Certificate(der)
      ca.push(intermediate.toString())
    }
  } catch (error) {
    console.warn(`Aviso: no se pudo completar la cadena TLS por AIA (${error.message}); se intenta con las raíces de Node.`)
  }
  // La verificación sigue siendo completa (rejectUnauthorized por defecto = true).
  return new https.Agent({ keepAlive: true, maxSockets: 2, ca })
}

/**
 * Sesión con el formulario de un ReportViewer (una por consulta simultánea).
 * config: { host, path, userAgent, timeoutMs, fields: { desde, hasta, nit }, button: [nombre, valor] }
 */
export class ReportViewerSession {
  constructor(agent, config) {
    this.agent = agent
    this.config = config
    this.reset()
  }

  reset() {
    this.cookies = new Map()
    this.formHtml = null
    this.lastNit = null // salvaguarda: el reporte de un NIT nuevo no puede traer el prestador del anterior
    this.lastPrestador = null
  }

  request(method, requestPath, body = null) {
    const { host, path: pagePath, userAgent, timeoutMs } = this.config
    return new Promise((resolve, reject) => {
      const headers = { 'user-agent': userAgent, accept: '*/*', 'accept-language': 'es-CO,es;q=0.9' }
      if (this.cookies.size > 0) headers.cookie = Array.from(this.cookies, ([k, v]) => `${k}=${v}`).join('; ')
      if (body !== null) {
        headers['content-type'] = 'application/x-www-form-urlencoded'
        headers['content-length'] = Buffer.byteLength(body)
        headers.referer = `https://${host}${pagePath}`
        headers.origin = `https://${host}`
      }
      const req = https.request({ host, path: requestPath, method, agent: this.agent, headers, timeout: timeoutMs }, res => {
        for (const cookie of res.headers['set-cookie'] || []) {
          const pair = cookie.split(';')[0]
          const eq = pair.indexOf('=')
          if (eq > 0) this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1))
        }
        const chunks = []
        res.on('data', chunk => chunks.push(chunk))
        res.on('end', () => resolve({ status: res.statusCode || 0, headers: res.headers, body: Buffer.concat(chunks) }))
        res.on('error', reject)
      })
      req.on('timeout', () => req.destroy(new Error(`Tiempo de espera agotado (${timeoutMs / 1000} s)`)))
      req.on('error', reject)
      if (body !== null) req.write(body)
      req.end()
    })
  }

  async loadForm() {
    const res = await this.request('GET', this.config.path)
    const html = res.body.toString('utf8')
    if (isBlockedPage(html)) throw new BlockedError('El firewall de la ADRES bloqueó la consulta (página "Web Page Blocked")')
    if (res.status !== 200 || !html.includes(this.config.fields.nit)) throw new Error(`La página del reporte no cargó (HTTP ${res.status})`)
    this.formHtml = html
  }

  /** Pide el reporte del NIT y el rango (fechas ya en dd/mm/aaaa) y devuelve la URL base de exportación. */
  async run(nit, desdeAdres, hastaAdres) {
    const { fields: f, button } = this.config
    if (!this.formHtml) await this.loadForm()
    const fields = extractFormFields(this.formHtml).filter(([name]) => ![f.desde, f.hasta, f.nit].includes(name))
    fields.push([f.desde, desdeAdres], [f.hasta, hastaAdres], [f.nit, nit], button)
    const body = fields.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
    const res = await this.request('POST', this.config.path, body)
    const html = res.body.toString('utf8')
    if (isBlockedPage(html)) throw new BlockedError('El firewall de la ADRES bloqueó la consulta (página "Web Page Blocked")')
    if (res.status !== 200) throw new Error(`HTTP ${res.status} al pedir el reporte`)
    const exportBase = extractExportUrlBase(html)
    if (!exportBase) {
      this.formHtml = null
      throw new Error('El reporte no devolvió la URL de exportación (¿parámetros rechazados?)')
    }
    this.formHtml = html // siguiente consulta: se envía desde esta página, como haría una persona
    return exportBase
  }

  /** Descarga el reporte ya pedido en CSV o XML (texto). */
  async exportAs(exportBase, format) {
    const res = await this.request('GET', exportBase + format)
    const text = res.body.toString('utf8')
    if (isBlockedPage(text)) throw new BlockedError('El firewall de la ADRES bloqueó la descarga del reporte')
    const type = String(res.headers['content-type'] || '')
    const expected = format === 'CSV' ? /csv|text\/plain/i : /xml/i
    if (res.status !== 200 || !expected.test(type)) throw new Error(`Exportación ${format}: HTTP ${res.status} ${type}`)
    return text
  }
}

/** Cliente de Supabase con service_role (solo si hay que leer/escribir la base). */
export async function supabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (web/.env.local)')
  const { createClient } = await import('@supabase/supabase-js')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
}
