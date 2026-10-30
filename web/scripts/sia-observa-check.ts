/**
 * SIA Observa · pruebas SIN RED (spec docs/specs/2026-10-29-agente-sia-observa.md). Cubre:
 *   - Lectura de Get_CTOs_Base (dinero, fechas, idc, contratistas con espacios y consorcios), código normalizado y
 *     mapFilaSia: personas naturales NUNCA se guardan (ni en raw), empresas sin línea no entran salvo enlazadas.
 *   - Cruce con SECOP con las filas REALES de secop_contratos de la Orinoquía (criterio de la Fase 1).
 *   - Precarga del formulario para CD/26-1262 = la carga manual de referencia del dueño (criterio de la Fase 2) y la
 *     diferencia de valor de CD/25-1111 (criterio de la Fase 3).
 *   - Parser de la ficha (10 documentos deduplicados, tipos, acta de inicio, publicación en SECOP, sin supervisores) y
 *     la respuesta del handler (PDF, anonimización, restringido).
 *   - Cliente HTTP con fetch falso: pausa de 1,5 s, reintentos, login de invitado solo si hace falta, solo el handler
 *     de documentos, User-Agent identificable.
 *   - Sync con Supabase falso: upsert sin pisar la revisión, cruce, enlace con hospital_contracts y cursor.
 *   - Lectura con IA (Fase 3): esquema estricto de la herramienta, sanitización de personas, validación contra SIA y
 *     precarga de indicadores (sección 4).
 *
 * Fixtures en scripts/__fixtures__/sia/: SINTÉTICOS con el formato verificado (SIA corta conexiones fuera de Colombia;
 * cada archivo lo dice) salvo secop-orinoquia.json, que es real. Uso (desde web/): npx tsx scripts/sia-observa-check.ts
 */
import fs from 'fs'
import path from 'path'
import {
  codigoNorm,
  diferenciasConSia,
  elegirSecop,
  fichaUrl,
  idcDeFila,
  leerContratistas,
  mapFilaSia,
  mesesEntre,
  modeloContratacion,
  precargaDesdeSecop,
  precargaDesdeSia,
  siaDeEnlace,
  siaDinero,
  siaFecha,
  siaFechaHora,
  ventanasMensuales,
  type SecopCandidato,
  type SiaContratoLeido,
  type SiaContratoRow,
  type SiaFilaRaw,
} from '../lib/sia-observa/normalizar'
import { TIPOS_CLAVE, clasificarRespuestaDocumento, fichaParaGuardar, nombreDeContentDisposition, parseFicha, tipoDocumento } from '../lib/sia-observa/ficha'
import { SiaCliente, formularioInvitado, parseCtosBase, userAgentSia } from '../lib/sia-observa/client'
import { CLASIFICACION_VERSION } from '../lib/secop'
import { FUENTES, esFuenteAutomatica, definicionFuente } from '../lib/fuentes-estado'
import { fakeSupabase } from './lib/fake-supabase'

for (const key of ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'ANTHROPIC_API_KEY', 'SIA_CONTACTO']) delete process.env[key]
globalThis.fetch = (async (input: unknown) => {
  throw new Error(`sia-observa-check: la red está prohibida (${String(input)})`)
}) as typeof fetch

let passed = 0
let failed = 0
function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passed++
    console.log(`  ✓ ${name}`)
  } else {
    failed++
    console.log(`  ✗ ${name}${detail !== undefined ? `\n      ${JSON.stringify(detail)}` : ''}`)
  }
}
function eq(name: string, actual: unknown, esperado: unknown) {
  check(name, JSON.stringify(actual) === JSON.stringify(esperado), { actual, esperado })
}

const FIX = path.resolve(__dirname, '__fixtures__', 'sia')
const leer = (n: string) => fs.readFileSync(path.join(FIX, n), 'utf8')
const ORINOQUIA_GUID = 'fbb9612e-dd36-41a0-b4c3-757e281dcaf8'
const ORINOQUIA_HOSPITAL = 'e7926149-4217-4b3d-9bd1-ef02e826e8f4'
const ctx = { entidadGuid: ORINOQUIA_GUID, hospitalPorNit: new Map([['891855029', ORINOQUIA_HOSPITAL]]), clasificacionVersion: CLASIFICACION_VERSION }
const { filas: FILAS } = parseCtosBase(leer('get-ctos-base-orinoquia.json'))
const SECOP: SecopCandidato[] = JSON.parse(leer('secop-orinoquia.json')).filas
const filaDe = (codigo: string) => FILAS.find(f => String(f.cto_code).trim() === codigo) as SiaFilaRaw
function rowDe(codigo: string): SiaContratoRow {
  const r = mapFilaSia(filaDe(codigo), ctx)
  if (!('row' in r)) throw new Error(`${codigo} no mapeó: ${JSON.stringify(r)}`)
  return r.row
}
const leido = (row: SiaContratoRow, id = 'sia-1', secop: string | null = null): SiaContratoLeido => ({ ...row, id, secop_contrato_id: secop })

async function main() {
  console.log('\n1. Campos de Get_CTOs_Base')
  eq('dinero "$65,504,160.00", "$0.00", formato colombiano y vacío', [siaDinero('$65,504,160.00'), siaDinero('$0.00'), siaDinero('65.504.160,00'), siaDinero(''), siaDinero('abc')], [65504160, 0, 65504160, null, null])
  eq('fechas yyyy/mm/dd, dd/mm/yyyy, inválidas', [siaFecha('2026/06/25'), siaFecha('25/06/2026'), siaFecha('2026/02/30'), siaFecha('')], ['2026-06-25', '2026-06-25', null, null])
  eq('fecha de creación en hora de Colombia (PM, 12 AM)', [siaFechaHora('2024/02/12 07:03:21 PM'), siaFechaHora('2024/02/12 12:05:00 AM')], ['2024-02-12T19:03:21-05:00', '2024-02-12T00:05:00-05:00'])
  eq('idc desde DT_RowId y desde el botón de detalle', [idcDeFila({ DT_RowId: 'cto(12910254)' }), idcDeFila({ cto_boton_detalle: "location.href='cto_ficha_resumen_guess.aspx?idc=77'" }), idcDeFila({})], [12910254, 77, null])
  eq('codigo_norm: CD/26-1262 = CD-26-1262 = cd 26.1262', [codigoNorm('CD/26-1262'), codigoNorm('CD-26-1262'), codigoNorm(' cd 26.1262 '), codigoNorm('')], ['CD261262', 'CD261262', 'CD261262', null])
  const consorcio = leerContratistas(' 900111222 <br> 1000000002 ', ' CONSORCIO SAS <br> PERSONA DOS ', ' Persona Jurídica <br> Persona Natural ')
  eq('consorcio: la empresa con NIT y nombre; la persona sin nombre ni documento', consorcio, [
    { nit: '900111222', nombre: 'CONSORCIO SAS', tipo: 'Persona Jurídica', esEmpresa: true },
    { nit: null, nombre: null, tipo: null, esEmpresa: false },
  ])
  check('NIT de 9 dígitos que empieza por 8 pero con tipo "Persona Natural" es persona', !leerContratistas('800123456', 'X', 'Persona Natural')[0].esEmpresa)
  eq('ventanas de un mes, recortadas al rango', ventanasMensuales('2026-08-31', '2026-10-29'), [
    { desde: '2026-08-31', hasta: '2026-08-31' },
    { desde: '2026-09-01', hasta: '2026-09-30' },
    { desde: '2026-10-01', hasta: '2026-10-29' },
  ])

  console.log('\n2. mapFilaSia con el fixture de la Orinoquía')
  const resultados = FILAS.map(f => mapFilaSia(f, ctx))
  const guardadas = resultados.filter(r => 'row' in r).map(r => (r as { row: SiaContratoRow }).row)
  eq('entran las 5 de la sección 4 y la del consorcio; la persona y el aseo no', guardadas.map(r => r.codigo), ['CD/26-1262', 'CD/26-1103', 'CD/25-1783', 'CD/25-1437', 'CD/25-1111', 'CD/26-1300'])
  eq('motivos de descarte', resultados.filter(r => 'descarte' in r).map(r => (r as { descarte: string }).descarte), ['persona', 'sin_linea'])
  const r1262 = rowDe('CD/26-1262')
  eq('CD/26-1262: idc, contratista, valores, fechas, línea, IPS', [r1262.sia_idc, r1262.nit_contratista, r1262.contratista, r1262.valor_inicial, r1262.adiciones, r1262.valor_vigente, r1262.fecha_firma, r1262.fecha_inicio, r1262.fecha_fin, r1262.dias, r1262.linea, r1262.hospital_id, r1262.ficha_url], [
    12910254, '901386177', 'FARMAORTOPEDICOS S.A.S', 510281732, 0, 510281732, '2026-06-25', '2026-07-02', '2026-12-31', 182, 'neurocirugia', ORINOQUIA_HOSPITAL, 'https://siaobserva.auditoria.gov.co/guess/cto_ficha_resumen_guess.aspx?idc=12910254',
  ])
  eq('CD/25-1437: valor vigente de SIA 682.313.892 (liberaciones 317.686.108)', [rowDe('CD/25-1437').valor_vigente, rowDe('CD/25-1437').liberaciones], [682313892, 317686108])
  eq('CD/25-1111: vigente 1.222.105.002', rowDe('CD/25-1111').valor_vigente, 1222105002)
  const r1300 = rowDe('CD/26-1300')
  const texto1300 = JSON.stringify(r1300)
  check('consorcio mixto: solo la empresa; ni el nombre ni la cédula de la persona en la fila ni en raw', r1300.contratistas.length === 1 && !texto1300.includes('PERSONA DE PRUEBA DOS') && !texto1300.includes('1000000002') && r1300.raw.personas_omitidas === 1, r1300)
  check('raw sin el botón de detalle (HTML)', !('cto_boton_detalle' in r1262.raw))
  const persona = mapFilaSia(filaDe('PS/26-2001'), ctx)
  check('persona natural: descartada sin datos', 'descarte' in persona && persona.descarte === 'persona' && !JSON.stringify(persona).includes('1000000001'))
  const aseo = filaDe('CD/26-1301')
  const forzada = mapFilaSia(aseo, { ...ctx, idcEnlazados: new Set([idcDeFila(aseo) as number]) })
  check('empresa sin línea ya registrada en Contratos: entra como alcance enlazado', 'row' in forzada && forzada.row.alcance === 'enlazado' && forzada.row.linea === 'no_clasificado')

  console.log('\n3. Cruce con SECOP (filas reales de secop_contratos)')
  const esperado: Record<string, string> = {
    'CD/26-1262': 'f62d8b5e-0274-4e03-b431-5c10c8864f05',
    'CD/26-1103': 'c131d0ab-902b-49cc-b703-54a6219047dc',
    'CD/25-1783': '7e4f087b-3435-45df-8030-94e27176f8c4',
    'CD/25-1437': '0dc130a1-b077-49c1-8b20-7913c9c66608',
    'CD/25-1111': '2e3db616-e17f-4725-b2fa-058a95d154b8',
  }
  for (const [codigo, id] of Object.entries(esperado)) {
    const cruce = elegirSecop(rowDe(codigo), SECOP)
    eq(`${codigo} → la fila secop2 (no la del Integrado), por código`, [cruce?.secopId, cruce?.via], [id, 'codigo'])
  }
  check('CD/26-1300 (sin SECOP): sin cruce', elegirSecop(r1300, SECOP) === null)
  const sinCodigo = { ...r1262, codigo_norm: 'OTRO999' }
  eq('sin código que case: por contratista + firma ±7 días + valor', elegirSecop(sinCodigo, SECOP)?.via, 'contratista_fecha')
  check('por contratista con otro valor: sin cruce', elegirSecop({ ...sinCodigo, valor_inicial: 1 }, SECOP) === null)
  const duplicado: SecopCandidato[] = [...SECOP, { ...SECOP[12], id: 'otro', numero_contrato: 'CO1.PCCNTR.1', documento_proveedor: '900000001', fecha_firma: '2026-01-01' }]
  eq('mismo código en dos contratos: desempata el NIT del contratista y la firma', elegirSecop(r1262, duplicado)?.secopId, esperado['CD/26-1262'])
  const ambiguo: SecopCandidato[] = [...SECOP, { ...SECOP[12], id: 'gemelo', numero_contrato: 'CO1.PCCNTR.2', fuente: 'secop2' }]
  check('dos contratos con el mismo código, contratista y fecha: no se adivina', elegirSecop(r1262, ambiguo) === null)

  console.log('\n4. Enlace y precarga del formulario')
  eq('idc e ide del documents_link (con otro enlace detrás)', siaDeEnlace('https://siaobserva.auditoria.gov.co/guess/cto_ficha_resumen_guess.aspx?idc=10507512&ide=fab96045-a66b-4caf-9568-50aa8d2072be ;  https://community.secop.gov.co/x'), { idc: 10507512, ide: 'fab96045-a66b-4caf-9568-50aa8d2072be' })
  check('documents_link sin SIA: null', siaDeEnlace('https://drive.google.com/x') === null && siaDeEnlace(null) === null)
  eq('modelo de contratación', ['RÉGIMEN ESPECIAL', 'SIN OFERTAS', 'Licitación pública', 'Selección abreviada subasta inversa', 'Invitación pública', null].map(modeloContratacion), ['contratacion_directa', 'contratacion_directa', 'licitacion', 'subasta_inversa', 'invitacion_privada', 'contratacion_directa'])
  const p = precargaDesdeSia(leido(r1262, 'sia-1262', esperado['CD/26-1262']), { valorSecop: 510281732 })
  eq('CD/26-1262 = carga manual de referencia (sección 4)', [p.hospital_id, p.contract_number, p.current_provider, p.contract_value, p.contract_type, p.contracting_model, p.start_date, p.end_date, p.documents_link], [
    ORINOQUIA_HOSPITAL, 'CD/26-1262', 'FARMAORTOPEDICOS S.A.S', 510281732, 'evento', 'contratacion_directa', '2026-07-02', '2026-12-31', fichaUrl(12910254),
  ])
  eq('CD/26-1262: enlaces y líneas para guardar; sin valor de SECOP al lado (es igual)', [p.sia_contrato_id, p.secop_contrato_id, p.lineas, p.valor_secop, p.duration_months], ['sia-1262', esperado['CD/26-1262'], ['neurocirugia'], null, 6])
  const p1437 = precargaDesdeSia(leido(rowDe('CD/25-1437')), { valorSecop: 1000000000 })
  eq('CD/25-1437: vigente de SIA y el de SECOP al lado', [p1437.contract_value, p1437.valor_secop], [682313892, 1000000000])
  const sinActa = precargaDesdeSia({ ...leido(r1262), fecha_inicio: null, fecha_fin_ampliada: '2027-01-31' })
  eq('sin acta de inicio: la firma; con fin ampliada: la ampliada', [sinActa.start_date, sinActa.end_date], ['2026-06-25', '2027-01-31'])
  const ps = precargaDesdeSecop({ id: 's1', hospital_id: 'h', numero_contrato: 'CO1.PCCNTR.9587962', referencia: 'CD/26-1262', documento_proveedor: '901386177', proveedor_nombre: 'FARMAORTOPEDICOS SAS', es_persona: false, objeto: 'x', modalidad: 'Contratación régimen especial', valor: 510281732, fecha_firma: '2026-06-25', fecha_inicio: '2026-07-02', fecha_fin: '2026-12-31', linea: 'neurocirugia', lineas: ['neurocirugia'], url: 'https://community.secop.gov.co/x' })
  eq('precarga desde SECOP: referencia como número, sin SIA', [ps.contract_number, ps.sia_contrato_id, ps.secop_contrato_id, ps.contracting_model], ['CD/26-1262', null, 's1', 'contratacion_directa'])
  check('precarga desde SECOP de una persona natural: sin proveedor', precargaDesdeSecop({ id: 'x', hospital_id: null, numero_contrato: null, referencia: null, es_persona: true, proveedor_nombre: 'NOMBRE', documento_proveedor: null, objeto: null, modalidad: null, valor: null, fecha_firma: null, fecha_inicio: null, fecha_fin: null, linea: 'trauma', lineas: null, url: null }).current_provider === '')
  eq('meses del plazo', [mesesEntre('2026-07-02', '2026-12-31'), mesesEntre(null, '2026-12-31'), mesesEntre('2026-02-01', '2026-01-01')], [6, null, null])

  const actual1111 = { contract_number: 'CD/25-1111', contract_value: 1256302480, start_date: '2025-05-22', end_date: '2025-10-21', contracting_model: 'licitacion', documents_link: null }
  const dif = diferenciasConSia(actual1111, leido(rowDe('CD/25-1111')))
  const valor = dif.find(d => d.campo === 'contract_value')
  eq('CD/25-1111: diferencia de valor para revisar (1.256.302.480 → 1.222.105.002)', [valor?.actual, valor?.propuesto], [1256302480, 1222105002])
  eq('CD/25-1111: también fechas, modelo y el enlace a la ficha; no el número', dif.map(d => d.campo), ['contract_value', 'start_date', 'end_date', 'contracting_model', 'documents_link'])
  eq('contrato igual a SIA: sin diferencias', diferenciasConSia({ contract_number: 'CD-26-1262', contract_value: 510281732, start_date: '2026-07-02', end_date: '2026-12-31', contracting_model: 'contratacion_directa', documents_link: fichaUrl(12910254) }, leido(r1262)), [])
  const conOtroLink = diferenciasConSia({ ...actual1111, documents_link: 'https://drive.google.com/x' }, leido(rowDe('CD/25-1111'))).find(d => d.campo === 'documents_link')
  eq('link de documentos previo: se conserva detrás de la ficha', conOtroLink?.propuesto, `${rowDe('CD/25-1111').ficha_url} ; https://drive.google.com/x`)

  console.log('\n5. Ficha y documentos')
  const ficha = parseFicha(leer('ficha-12910254.html'))
  eq('10 documentos (los 20 enlaces deduplicados por ianx, ianxa)', ficha.documentos.length, 10)
  eq('tipos de los 10 documentos de CD/26-1262', ficha.documentos.map(d => d.tipo), ['cdp', 'rp', 'estudio_previo', 'estudio_previo', 'estudio_previo', 'poliza', 'poliza', 'contrato', 'designacion_supervisor', 'acta_inicio'])
  eq('los que se copian al bucket: 3 del estudio previo y el contrato', ficha.documentos.filter(d => TIPOS_CLAVE.includes(d.tipo)).map(d => d.nombre), ['ep_110_compressed_18.pdf', 'ep_1121_compressed_14.pdf', 'ep_2225_compressed.pdf', '13_contrato_1262_compressed.pdf'])
  check('URL absoluta del handler con eid de la entidad y fecha de cargue', ficha.documentos.every(d => d.url.startsWith('https://siaobserva.auditoria.gov.co/handlers/filehandler_guess_anonimo.ashx?ianx=') && d.eid === ORINOQUIA_GUID && d.fechaCargue === '2026-07-09'))
  eq('publicación en SECOP 2026-06-23 con su enlace; cargue en SIA 2026-07-09', [ficha.fechaPublicacionSecop, ficha.urlSecop?.startsWith('https://community.secop.gov.co/'), ficha.fechaCargueSia], ['2026-06-23', true, '2026-07-09'])
  eq('información básica de la ficha', [ficha.basica.codigo, ficha.basica.valorVigente, ficha.basica.modalidad, ficha.basica.procedimiento, ficha.basica.tipoContrato, ficha.basica.fechaInicio], ['CD/26-1262', 510281732, 'SIN OFERTAS', 'Manual de contratación', 'Suministro', '2026-07-02'])
  eq('contratistas: solo la empresa', ficha.contratistas.map(c => c.nit), ['901386177'])
  const guardable = JSON.stringify(fichaParaGuardar(ficha))
  check('lo que se guarda de la ficha no trae supervisores, traza ni cédulas', !guardable.includes('SUPERVISORA') && !guardable.includes('1000000099') && !guardable.includes('USUARIO INVENTADO'))
  eq('sin novedades ("No hay registros")', ficha.novedades, [])
  const conNovedad = parseFicha('<h3>Novedades</h3><h4>Adiciones</h4><table><tr><th>Fecha</th><th>Valor</th><th>Descripción</th></tr><tr><td>2025/11/10</td><td>$120,000,000.00</td><td>Adición No. 1 por mayor demanda</td></tr></table><h4>Liquidación</h4><table><tr><td>2026/01/15</td><td>Acta de liquidación bilateral</td></tr></table>')
  eq('novedades: adición con fecha y valor, y la liquidación', conNovedad.novedades.map(n => [n.tipo, n.fecha, n.valor, n.detalle]), [
    ['adiciones', '2025-11-10', 120000000, 'Adición No. 1 por mayor demanda'],
    ['liquidacion', '2026-01-15', null, 'Acta de liquidación bilateral'],
  ])
  eq('tipo por nombre de archivo (tabla de la spec)', [
    'Acta de liquidacion del contrato.pdf', 'adicion_1_contrato.pdf', 'OTROSI 2.pdf', 'prorroga.pdf', 'acta_inicio.pdf', 'anexo_tecnico_001.pdf', 'propuesta_economica.pdf', 'cotizacion.pdf', 'Estudio previo.pdf', 'contrato_firmado.pdf', 'acta_terminacion.pdf', 'certificado.pdf',
  ].map(tipoDocumento), ['liquidacion', 'novedad', 'novedad', 'novedad', 'acta_inicio', 'anexo_tecnico', 'propuesta', 'propuesta', 'estudio_previo', 'contrato', 'otro', 'otro'])
  const pdf = new TextEncoder().encode('%PDF-1.4\n%âãÏÓ\n1 0 obj')
  const enc = (t: string) => new TextEncoder().encode(t)
  eq('respuesta del handler: PDF, anonimización, restringido, HTML sin aviso, PDF con content-type HTML, HTTP 500', [
    clasificarRespuestaDocumento(200, 'application/pdf', pdf).estado,
    clasificarRespuestaDocumento(200, 'text/html; charset=utf-8', enc(leer('handler-anonimizacion.html'))).estado,
    clasificarRespuestaDocumento(200, 'text/html', enc(leer('handler-restringido.html'))).estado,
    clasificarRespuestaDocumento(200, 'text/html', enc('<html>hola</html>')).estado,
    clasificarRespuestaDocumento(200, 'text/html', pdf).estado,
    clasificarRespuestaDocumento(500, 'application/pdf', pdf).estado,
  ], ['pdf', 'anonimizacion_pendiente', 'restringido', 'error', 'error', 'error'])
  eq('nombre de Content-Disposition', [nombreDeContentDisposition('attachment; filename=13_contrato_1262_compressed.pdf'), nombreDeContentDisposition("attachment; filename*=UTF-8''p%C3%B3liza.pdf"), nombreDeContentDisposition(null)], ['13_contrato_1262_compressed.pdf', 'póliza.pdf', null])

  console.log('\n6. Cliente HTTP (fetch falso)')
  const login = formularioInvitado(leer('login.html'))
  eq('login de invitado: target del postback y campos ocultos', [login.eventTarget, Object.keys(login.campos).sort()], ['lnkInvitado', ['__EVENTARGUMENT', '__EVENTTARGET', '__EVENTVALIDATION', '__VIEWSTATE', '__VIEWSTATEGENERATOR']])
  check('User-Agent identificable; correo solo si SIA_CONTACTO es un correo', userAgentSia(undefined).startsWith('OpMap-SIA/1.0 (VG Medical') && userAgentSia('compras@empresa.co').includes('contacto compras@empresa.co') && !userAgentSia('no-es-correo').includes('contacto'))
  {
    const pedidos: Array<{ url: string; method: string; headers: Record<string, string>; body?: string }> = []
    const esperas: number[] = []
    let ctosLlamadas = 0
    const respuestas = (url: string, init: RequestInit): Response => {
      const u = new URL(url)
      if (u.pathname.endsWith('/Get_CTOs_Base')) {
        ctosLlamadas++
        if (ctosLlamadas === 1) return new Response('<html>Ingresa como Invitado</html>', { status: 200, headers: { 'content-type': 'text/html' } })
        if (ctosLlamadas === 2) return new Response('busy', { status: 503 })
        return new Response(leer('get-ctos-base-orinoquia.json'), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      if (u.pathname === '/Login.aspx' && init.method === 'GET') return new Response(leer('login.html'), { status: 200, headers: { 'set-cookie': 'ASP.NET_SessionId=abc; path=/; HttpOnly' } })
      if (u.pathname === '/Login.aspx' && init.method === 'POST') return new Response('', { status: 302, headers: { location: '/guess/', 'set-cookie': '.ASPXAUTH=invitado; path=/' } })
      if (u.pathname === '/guess/') return new Response('<html>Bienvenido</html>', { status: 200 })
      if (u.pathname.endsWith('filehandler_guess_anonimo.ashx')) return new Response(pdf, { status: 200, headers: { 'content-type': 'application/pdf', 'content-disposition': 'attachment; filename=13_contrato.pdf' } })
      return new Response('no', { status: 404 })
    }
    const fetchFalso = (async (input: unknown, init: RequestInit = {}) => {
      pedidos.push({ url: String(input), method: init.method ?? 'GET', headers: (init.headers ?? {}) as Record<string, string>, body: typeof init.body === 'string' ? init.body : undefined })
      return respuestas(String(input), init)
    }) as typeof fetch
    const cliente = new SiaCliente({ fetch: fetchFalso, esperar: async ms => void esperas.push(ms), userAgent: 'OpMap-SIA/test' })
    const r = await cliente.getContratosEntidad(ORINOQUIA_GUID, '2026-06-01', '2026-07-31')
    eq('Get_CTOs_Base: pide sesión → login de invitado → 503 → reintento → datos', [r.filas.length, ctosLlamadas, cliente.conSesion], [8, 3, true])
    const ctos = pedidos.filter(x => x.url.endsWith('/Get_CTOs_Base'))
    eq('cuerpo con las fechas en formato del datepicker', JSON.parse(ctos[0].body ?? '{}'), { ENTIDADES_ID: ORINOQUIA_GUID, txtFechaDesde: '2026/06/01', txtFechaHasta: '2026/07/31' })
    check('las cookies del login viajan en la petición siguiente', (ctos[1].headers.Cookie ?? '').includes('.ASPXAUTH=invitado'))
    check('postback del enlace "Ingresa como Invitado"', pedidos.some(x => x.method === 'POST' && x.url.endsWith('/Login.aspx?redirect=Inicio') && (x.body ?? '').includes('__EVENTTARGET=lnkInvitado')))
    check('User-Agent en todas las peticiones', pedidos.every(x => x.headers['User-Agent'] === 'OpMap-SIA/test'))
    check('pausa ≥ 1,5 s entre peticiones y espera creciente al reintentar', esperas.some(ms => ms >= 2900) && esperas.filter(ms => ms > 0).every(ms => ms <= 1500 * 2 ** 3), esperas)
    const d = await cliente.descargarDocumento('/handlers/filehandler_guess_anonimo.ashx?ianx=1&ianxa=2&eid=x', { referer: fichaUrl(1) })
    eq('descarga: bytes, content-type, nombre y Referer de la ficha', [d.bytes.length, d.contentType, d.nombre, pedidos[pedidos.length - 1].headers.Referer], [pdf.length, 'application/pdf', '13_contrato.pdf', fichaUrl(1)])
    let rechazo = ''
    await cliente.descargarDocumento('/handlers/otro.ashx?id=1').catch((e: Error) => (rechazo = e.message))
    check('otros handlers: rechazados sin pedirlos', rechazo.includes('no permitida') && !pedidos.some(x => x.url.includes('otro.ashx')))
    const antes = ctosLlamadas
    const cacheMem = new Map<string, string>()
    const conCache = new SiaCliente({ fetch: fetchFalso, esperar: async () => {}, cache: { get: async k => cacheMem.get(k) ?? null, set: async (k, v) => void cacheMem.set(k, v) } })
    await conCache.getContratosEntidad(ORINOQUIA_GUID, '2026-06-01', '2026-06-30')
    await conCache.getContratosEntidad(ORINOQUIA_GUID, '2026-06-01', '2026-06-30')
    eq('caché: la segunda consulta igual no va a SIA', ctosLlamadas - antes, 1)
    let sinReintento = 0
    const cliente404 = new SiaCliente({ fetch: (async () => (sinReintento++, new Response('x', { status: 404 }))) as unknown as typeof fetch, esperar: async () => {} })
    await cliente404.getFicha(1).catch(() => {})
    check('HTTP 404 no se reintenta (una petición, más el intento de login)', sinReintento <= 3, sinReintento)
  }

  console.log('\n7. Sync con Supabase falso')
  {
    const hcs = [
      { id: 'hc-1111', hospital_id: ORINOQUIA_HOSPITAL, contract_number: 'CD/25-1111', documents_link: null, sia_contrato_id: null },
      { id: 'hc-1262', hospital_id: ORINOQUIA_HOSPITAL, contract_number: 'otro', documents_link: `${fichaUrl(12910254)}&ide=${ORINOQUIA_GUID}`, sia_contrato_id: null },
    ]
    const { db, tablas } = fakeSupabase({
      tablas: {
        sia_contratos: [{ id: 'previo', sia_idc: 11800003, estado_revision: 'descartado', motivo_descarte: 'no es nuestro', hospital_contract_id: null }],
        secop_contratos: SECOP.map(s => ({ ...s, nit_entidad: '891855029' })),
        hospitals: [{ id: ORINOQUIA_HOSPITAL, nit: '891855029' }],
        hospital_contracts: hcs,
        fuentes_estado: [],
      },
      rpcs: { secop_nits_ips: [{ nit: '891855029', hospital_id: ORINOQUIA_HOSPITAL, publica: true }] },
    })
    const { sincronizarEntidad, cargarContextoSia } = await import('../lib/sia-observa/sync')
    const ctxSync = await cargarContextoSia(db)
    const cliente = new SiaCliente({ fetch: (async () => new Response(leer('get-ctos-base-orinoquia.json'), { status: 200 })) as unknown as typeof fetch, esperar: async () => {} })
    const r = await sincronizarEntidad(db, cliente, { guid: ORINOQUIA_GUID, nombre: 'HRO', nit: '891855029', prioridad: 1 }, [{ desde: '2025-01-01', hasta: '2026-10-29' }], ctxSync)
    const filas = tablas.get('sia_contratos') as Array<Record<string, unknown>>
    eq('guarda 6, descarta 1 persona y 1 sin línea; 5 cruces con SECOP; 2 enlaces', [r.guardadas, r.descartes.persona, r.descartes.sin_linea, r.cruces, r.enlaces, filas.length], [6, 1, 1, 5, 2, 6])
    const d1437 = filas.find(f => f.sia_idc === 11800003)
    eq('el upsert no pisa la revisión previa (descartado con motivo)', [d1437?.estado_revision, d1437?.motivo_descarte, d1437?.valor_vigente], ['descartado', 'no es nuestro', 682313892])
    const s1262 = filas.find(f => f.sia_idc === 12910254)
    eq('CD/26-1262: cruce secop2 por código y enlazado (por el idc del link) como importado', [s1262?.secop_contrato_id, s1262?.secop_cruce, s1262?.hospital_contract_id, s1262?.estado_revision], [esperado['CD/26-1262'], 'codigo', 'hc-1262', 'importado'])
    const hc = tablas.get('hospital_contracts') as Array<Record<string, unknown>>
    eq('CD/25-1111 enlazado por el número; hospital_contracts solo gana sia_contrato_id (nada más cambia)', [hc[0].sia_contrato_id === filas.find(f => f.sia_idc === 11300004)?.id, hc[0].contract_number], [true, 'CD/25-1111'])
    check('ninguna fila de persona en sia_contratos', !JSON.stringify(filas).includes('1000000001') && !JSON.stringify(filas).includes('PERSONA'))
  }

  console.log('\n8. Fuente sia_observa')
  const def = definicionFuente('sia_observa')
  eq('definida, manual (Mac del dueño), 02:00 Bogotá = 07:00 UTC', [def?.ejecutor, def?.programacion], ['manual', '0 7 * * *'])
  check('no es automática de Vercel (ni cron ni "Actualizar ahora")', !esFuenteAutomatica('sia_observa') && FUENTES.some(f => f.id === 'sia_observa'))
  const vercel = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'vercel.json'), 'utf8')) as { crons: Array<{ path: string }> }
  check('sin cron de Vercel para SIA (SIA corta conexiones fuera de Colombia)', !vercel.crons.some(c => c.path.includes('sia')))

  await extraccionChecks()

  console.log(`\n${passed} pasaron, ${failed} fallaron`)
  if (failed > 0) process.exit(1)
}

/** Fase 3 (lib/sia-observa/extraccion.ts). */
async function extraccionChecks() {
  const ext = await import('../lib/sia-observa/extraccion').catch(() => null)
  if (!ext) {
    check('lib/sia-observa/extraccion.ts existe', false)
    return
  }
  console.log('\n9. Lectura con IA (sin llamar a la API)')
  const datos = JSON.parse(leer('extraccion-cd-26-1262.json')).datos
  const r1262 = rowDe('CD/26-1262')
  const limpio = ext.sanearExtraccion(datos)
  const texto = JSON.stringify(limpio)
  check('saneada: sin cédulas ni nombres de personas (supervisión y otros)', !texto.includes('1.000.000.098') && !texto.includes('1000000098') && !/JUANA INVENTADA/.test(texto), limpio.contrato.supervision)
  check('cotizantes: solo empresas con NIT de persona jurídica', limpio.mercado.cotizantes.every((c: { nit: string | null }) => c.nit === null || /^[89]\d{8}$/.test(c.nit)) && limpio.mercado.cotizantes.length === 2)
  const disc = ext.validarContraSia(limpio, leido(r1262))
  eq('CD/26-1262: lo leído coincide con SIA (sin discrepancias)', disc, [])
  const disc2 = ext.validarContraSia({ ...limpio, contrato: { ...limpio.contrato, valor: 500000000, fecha_inicio: '2026-07-10', contratista: { nombre: 'X', nit: '900000000' } } }, leido(r1262))
  eq('discrepancias de valor, fecha y NIT', disc2.map((d: { campo: string }) => d.campo), ['valor', 'fecha_inicio', 'nit_contratista'])
  const pre = ext.precargaDesdeExtraccion(limpio, 510281732)
  eq('indicadores = carga manual de referencia (liquidez 1, endeudamiento 50 %, sin cobertura, capital 510,28 MM, sin años)', [pre.requires_liquidez, pre.min_liquidez, pre.requires_endeudamiento, pre.max_endeudamiento, pre.requires_cobertura, pre.requires_capital_trabajo, pre.min_capital_trabajo, pre.requires_experiencia], [true, 1, true, 0.5, false, true, 510.28, false])
  const req = pre.custom_requirements.toLowerCase()
  check('requisitos adicionales: experiencia 100 %, capital 1 vez, CIIU 4645, seriedad 10 %, instrumentador, INVIMA, importador', ['100%', 'una vez el presupuesto', 'ciiu 4645', 'seriedad', '10%', 'instrumentador', 'invima', 'importador'].every(t => req.includes(t)), pre.custom_requirements)
  const herramienta = ext.HERRAMIENTA_EXTRACCION
  const estricta = (s: Record<string, unknown>): boolean => {
    if (s.type === 'object' || (Array.isArray(s.type) && s.type.includes('object'))) {
      const props = (s.properties ?? {}) as Record<string, Record<string, unknown>>
      return s.additionalProperties === false && JSON.stringify([...((s.required as string[]) ?? [])].sort()) === JSON.stringify(Object.keys(props).sort()) && Object.values(props).every(estricta)
    }
    if (s.type === 'array') return estricta(s.items as Record<string, unknown>)
    return true
  }
  check('herramienta estricta: additionalProperties false y todo required en cada objeto', herramienta.strict === true && estricta(herramienta.input_schema as unknown as Record<string, unknown>))
  check('fuentes por página en el esquema', JSON.stringify(herramienta.input_schema).includes('"pagina"'))
  const params = ext.construirSolicitud({ contrato: leido(r1262), documentos: [{ id: 'd1', nombre: 'ep_110_compressed_18.pdf', tipo: 'estudio_previo', paginas: 10, base64: 'JVBERi0x' }] })
  eq('solicitud: modelo vigente, pensamiento adaptativo, esfuerzo alto, tool_choice auto (forzar está prohibido en este modelo)', [params.model, (params.thinking as { type: string }).type, (params.output_config as { effort: string }).effort, (params.tool_choice as { type: string }).type], ['claude-opus-5-5', 'adaptive', 'high', 'auto'])
  const contenido = (params.messages[0].content as Array<{ type: string }>).map(b => b.type)
  eq('el PDF va como bloque document antes del texto', contenido, ['document', 'text'])
  const sinTool = ext.leerRespuesta({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'hola' }] } as never)
  check('respuesta sin la herramienta: error claro', 'error' in sinTool)
  const conTool = ext.leerRespuesta({ stop_reason: 'tool_use', content: [{ type: 'tool_use', name: herramienta.name, input: datos, id: 't', caller: undefined }] } as never)
  check('respuesta con la herramienta: datos', 'datos' in conTool)
  eq('lote: partir por tamaño (32 MB por solicitud) y páginas (600)', ext.cabeEnSolicitud([{ bytes: 10_000_000, paginas: 100 }, { bytes: 10_000_000, paginas: 100 }]), true)
  eq('lote: demasiado grande', ext.cabeEnSolicitud([{ bytes: 20_000_000, paginas: 100 }, { bytes: 10_000_000, paginas: 100 }]), false)
  const vacio = { contract_number: 'CD/26-1262', contract_value: 510281732, start_date: '2026-07-02', end_date: '2026-12-31', contracting_model: 'contratacion_directa', documents_link: null, requires_liquidez: true, min_liquidez: 1.2, requires_endeudamiento: true, max_endeudamiento: 0.7, requires_capital_trabajo: false, min_capital_trabajo: 0, custom_requirements: '' }
  const difIa = ext.diferenciasConIa(vacio, pre)
  eq('diferencias con la IA: liquidez, endeudamiento, capital y requisitos, con las columnas a escribir', difIa.map((d: { campo: string; cambios: Record<string, unknown> }) => [d.campo, d.cambios]), [
    ['min_liquidez', { requires_liquidez: true, min_liquidez: 1 }],
    ['max_endeudamiento', { requires_endeudamiento: true, max_endeudamiento: 0.5 }],
    ['min_capital_trabajo', { requires_capital_trabajo: true, min_capital_trabajo: 510.28 }],
    ['custom_requirements', { custom_requirements: pre.custom_requirements }],
  ])
  eq('ya igual a lo leído: sin diferencias', ext.diferenciasConIa({ ...vacio, ...pre }, pre), [])
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
