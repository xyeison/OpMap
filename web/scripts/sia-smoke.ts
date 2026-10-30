/**
 * SIA Observa · prueba de humo (Fase 0 de docs/specs/2026-10-29-agente-sia-observa.md). Correr en un equipo en COLOMBIA
 * (el Mac del dueño): desde fuera del país SIA corta la conexión TLS. No escribe en Supabase.
 *
 * Qué comprueba, en orden, y qué responde de la sección 3.7:
 *   0. Que el portal responde (si no: "SIA no responde desde esta red", 3.7.2).
 *   1. Get_CTOs_Base de la Orinoquía (fbb9612e-…) del 2026-06-01 al 2026-07-31 SIN cookies: debe traer el idc 12910254
 *      (CD/26-1262). Si no, hace el login de invitado por HTTP y repite (3.7.1).
 *   2. La ficha de 12910254 sin cookies (o con sesión): documentos (10 esperados), tipos y fecha de publicación en SECOP.
 *   3. La descarga del contrato (13_contrato_1262…) SIN Referer y, si falla, CON Referer de la ficha (3.7.3); y el acta de
 *      inicio, que debe responder con el aviso de anonimización (no se envía ningún correo).
 *   --guardar-fixtures: guarda las respuestas reales en scripts/__fixtures__/sia/ para las pruebas, SIN datos de personas:
 *   de Get_CTOs_Base solo las filas de empresas; de la ficha se quitan supervisores, interventores, la traza y las filas
 *   de contratistas personas naturales. Los PDF no se guardan.
 *
 * Uso (desde web/):  npx tsx scripts/sia-smoke.ts [--guardar-fixtures]
 */
import fs from 'fs'
import path from 'path'
import * as cheerio from 'cheerio'
import { SiaCliente, userAgentSia } from '../lib/sia-observa/client'
import { clasificarRespuestaDocumento, parseFicha } from '../lib/sia-observa/ficha'
import { SIA_BASE_URL, idcDeFila, leerContratistas, mapFilaSia } from '../lib/sia-observa/normalizar'
import { CLASIFICACION_VERSION, esNitJuridico, normalizeNit, normalizeText } from '../lib/secop'
import { leerArgs, log } from './lib/sia-script'

const ORINOQUIA = 'fbb9612e-dd36-41a0-b4c3-757e281dcaf8'
const IDC = 12910254
const FIXTURES = path.resolve(__dirname, '__fixtures__', 'sia')

function guardar(nombre: string, contenido: string) {
  fs.mkdirSync(FIXTURES, { recursive: true })
  fs.writeFileSync(path.join(FIXTURES, nombre), contenido, 'utf8')
  log(`  fixture: scripts/__fixtures__/sia/${nombre}`)
}

/** Ficha sin personas: fuera supervisores/interventores/traza y las filas de contratistas que no son empresa. */
function fichaSinPersonas(html: string): string {
  const $ = cheerio.load(html)
  $('script').remove()
  $('h1, h2, h3, h4, h5, h6').each((_, h) => {
    const titulo = normalizeText($(h).text())
    if (!/supervisor|interventor|traza/.test(titulo)) return
    let nodo = $(h).next()
    while (nodo.length > 0 && !/^h[1-6]$/i.test((nodo.get(0) as { tagName?: string }).tagName ?? '')) {
      const siguiente = nodo.next()
      nodo.remove()
      nodo = siguiente
    }
  })
  $('tr').each((_, tr) => {
    const celdas = $(tr).children('td').map((__, td) => $(td).text().trim()).get()
    const nit = normalizeNit(celdas[0])
    if (nit && !esNitJuridico(nit)) $(tr).remove()
  })
  return `<!-- Fixture REAL de SIA Observa (sia-smoke.ts --guardar-fixtures, ${new Date().toISOString().slice(0, 10)}), sin supervisores, interventores, traza ni personas naturales -->\n${$.html()}`
}

async function main() {
  const args = leerArgs(process.argv.slice(2), [], ['guardar-fixtures'])
  log(`User-Agent: ${userAgentSia()}`)
  const informe: string[] = []

  // 0. Portal
  try {
    const res = await fetch(`${SIA_BASE_URL}/Login.aspx?redirect=Inicio`, { headers: { 'User-Agent': userAgentSia() }, signal: AbortSignal.timeout(30_000) })
    log(`0. Portal: HTTP ${res.status}`)
    informe.push(`3.7.2: SIA responde desde esta red (HTTP ${res.status}).`)
  } catch (error) {
    const causa = (error as { cause?: { code?: string } }).cause?.code
    console.error(`0. SIA no responde desde esta red (${causa ?? (error as Error).message}). Si estás fuera de Colombia es el filtro geográfico del portal.`)
    process.exit(2)
  }

  // 1. Get_CTOs_Base sin cookies (el cliente hace el login solo si hace falta)
  const cliente = new SiaCliente({ log })
  const inicio = Date.now()
  const { total, filas } = await cliente.getContratosEntidad(ORINOQUIA, '2026-06-01', '2026-07-31')
  const fila = filas.find(f => idcDeFila(f) === IDC)
  log(`1. Get_CTOs_Base: ${filas.length} filas (iTotalRecords ${total}) en ${Math.round((Date.now() - inicio) / 1000)} s · idc ${IDC} ${fila ? 'SÍ' : 'NO'} está`)
  informe.push(`3.7.1: Get_CTOs_Base ${cliente.conSesion ? 'necesitó el login de invitado' : 'funciona SIN cookies'}.`)
  if (fila) {
    const r = mapFilaSia(fila, { entidadGuid: ORINOQUIA, clasificacionVersion: CLASIFICACION_VERSION })
    log(`   CD/26-1262 → ${'row' in r ? `${r.row.codigo} · ${r.row.contratista} · vigente ${r.row.valor_vigente} · línea ${r.row.linea}` : `descartada (${r.descarte})`}`)
  }
  const empresas = filas.filter(f => leerContratistas(f.cto_nit_contratistas, f.cto_contratistas, f.cto_tipo_contratistas).some(c => c.esEmpresa))
  log(`   ${empresas.length} de ${filas.length} filas son de empresas (las demás, personas naturales: no se guardan)`)
  if (args['guardar-fixtures']) {
    const soloEmpresas = empresas.map(f => {
      const contratistas = leerContratistas(f.cto_nit_contratistas, f.cto_contratistas, f.cto_tipo_contratistas).filter(c => c.esEmpresa)
      return { ...f, cto_nit_contratistas: contratistas.map(c => c.nit).join('<br>'), cto_contratistas: contratistas.map(c => c.nombre).join('<br>'), cto_tipo_contratistas: contratistas.map(c => c.tipo).join('<br>') }
    })
    guardar('get-ctos-base-orinoquia-2026-06.json', JSON.stringify({ d: JSON.stringify({ sEcho: 1, iTotalRecords: soloEmpresas.length, aaData: soloEmpresas }) }, null, 1))
  }

  // 2. Ficha
  const html = await cliente.getFicha(IDC)
  const ficha = parseFicha(html)
  log(`2. Ficha ${IDC}: ${ficha.documentos.length} documentos (esperados 10), publicación en SECOP ${ficha.fechaPublicacionSecop ?? '¿?'}, secciones: ${ficha.secciones.join(' | ')}`)
  for (const d of ficha.documentos) log(`   ${d.tipo.padEnd(22)} ${d.nombre} (${d.fechaCargue ?? 's/f'})`)
  log(`   básica: ${JSON.stringify(ficha.basica)}`)
  informe.push(`3.7.1: la ficha ${cliente.conSesion ? 'se leyó con sesión de invitado' : 'se lee SIN cookies'}.`)
  if (args['guardar-fixtures']) guardar(`ficha-${IDC}.html`, fichaSinPersonas(html))

  // 3. Descargas: contrato sin y con Referer; acta de inicio
  const contrato = ficha.documentos.find(d => d.tipo === 'contrato')
  if (contrato) {
    const sinReferer = new SiaCliente({ log })
    let d = await sinReferer.descargarDocumento(contrato.url, { referer: null })
    let r = clasificarRespuestaDocumento(d.status, d.contentType, d.bytes)
    if (r.estado === 'pdf') informe.push('3.7.3: el handler NO exige Referer (ni cookies).')
    else {
      d = await cliente.descargarDocumento(contrato.url, { referer: `${SIA_BASE_URL}/guess/cto_ficha_resumen_guess.aspx?idc=${IDC}` })
      r = clasificarRespuestaDocumento(d.status, d.contentType, d.bytes)
      informe.push(`3.7.3: sin Referer no bajó; con Referer de la ficha: ${r.estado}.`)
    }
    log(`3. Contrato ${contrato.nombre}: ${r.estado} · ${d.contentType} · ${d.bytes.length} bytes · nombre "${d.nombre ?? ''}"`)
  } else log('3. La ficha no trae un documento de tipo contrato')
  const acta = ficha.documentos.find(x => x.tipo === 'acta_inicio')
  if (acta) {
    const d = await cliente.descargarDocumento(acta.url, { referer: `${SIA_BASE_URL}/guess/cto_ficha_resumen_guess.aspx?idc=${IDC}` })
    const r = clasificarRespuestaDocumento(d.status, d.contentType, d.bytes)
    log(`   Acta de inicio: ${r.estado} (esperado: anonimizacion_pendiente; NO se envía ningún correo)`)
    if (args['guardar-fixtures'] && r.estado !== 'pdf') guardar('handler-anonimizacion.html', new TextDecoder().decode(d.bytes))
  }

  log(`Peticiones al portal: ${cliente.peticiones}`)
  console.log('\nResultado de la sección 3.7:\n' + informe.map(l => `  - ${l}`).join('\n'))
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
