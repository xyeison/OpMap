/**
 * SIA Observa · pruebas SIN RED de los manejadores de /api/sia/* (app/api/sia/_lib/sia-server.ts) con el Supabase falso
 * (scripts/lib/fake-supabase.ts) y los permisos de las rutas. Criterios de aceptación de la spec
 * (docs/specs/2026-10-29-agente-sia-observa.md):
 *   - Fase 1: la Orinoquía muestra los contratos de la sección 4 con el valor vigente de SIA y el cruce con SECOP.
 *   - Fase 2: CD/26-1262 se precarga con los datos de la carga manual de referencia; el acta queda en anonimizacion_pendiente
 *     y solo los descargados se abren con enlace firmado de 10 minutos.
 *   - Fase 3: los indicadores leídos por la IA se precargan; CD/25-1111 aparece con la diferencia de valor para revisar;
 *     la bandeja no muestra lo ya importado ni lo descartado, y descartar exige motivo.
 *   - Sin la migración 0930: 503 con disponible: false (la UI no pinta nada).
 * Uso (desde web/): npx tsx scripts/sia-observa-api-check.ts
 */
import fs from 'fs'
import path from 'path'
import { fakeSupabase, type Fila } from './lib/fake-supabase'
import { mapFilaSia, type SiaFilaRaw } from '../lib/sia-observa/normalizar'
import { parseCtosBase } from '../lib/sia-observa/client'
import { CLASIFICACION_VERSION } from '../lib/secop'
import { hasPermission } from '../lib/permissions'
import {
  ENLACE_SEGUNDOS,
  conMigracion,
  contratosDeHospital,
  descartarDetectado,
  detectados,
  enlaceDocumento,
  importablesDeHospital,
  marcarImportado,
  pedirActualizacion,
  precargaFormulario,
  siaDeHospitalContract,
} from '../app/api/sia/_lib/sia-server'

for (const key of ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'ANTHROPIC_API_KEY']) delete process.env[key]
globalThis.fetch = (async (input: unknown) => {
  throw new Error(`sia-observa-api-check: la red está prohibida (${String(input)})`)
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
const HRO = 'e7926149-4217-4b3d-9bd1-ef02e826e8f4'
const GUID = 'fbb9612e-dd36-41a0-b4c3-757e281dcaf8'
const HOY = '2026-10-30'
const SECOP_1262 = 'f62d8b5e-0274-4e03-b431-5c10c8864f05'
const SECOP_1111 = '2e3db616-e17f-4725-b2fa-058a95d154b8'
const SECOP_1658 = '287aced8-2c7c-460b-b9df-46c1fd618fd5'

function semilla() {
  const { filas } = parseCtosBase(leer('get-ctos-base-orinoquia.json'))
  const secop = (JSON.parse(leer('secop-orinoquia.json')).filas as Fila[]).map(s => ({
    ...s,
    nit_entidad: '891855029',
    hospital_id: HRO,
    es_persona: false,
    proveedor_nombre: s.documento_proveedor === '901386177' ? 'FARMAORTOPEDICOS SAS' : 'ORITECH SAS',
    objeto: 'SUMINISTRO DE MATERIAL DE OSTEOSINTESIS',
    modalidad: 'Contratación régimen especial',
    fecha_inicio: s.fecha_firma,
    fecha_fin: '2026-12-31',
    linea: s.documento_proveedor === '901386177' ? 'neurocirugia' : 'trauma',
    lineas: [s.documento_proveedor === '901386177' ? 'neurocirugia' : 'trauma'],
    url: `https://community.secop.gov.co/${s.numero_contrato}`,
  }))
  const cruce: Record<string, string> = { 'CD/26-1262': SECOP_1262, 'CD/25-1111': SECOP_1111, 'CD/26-1103': 'c131d0ab-902b-49cc-b703-54a6219047dc', 'CD/25-1783': '7e4f087b-3435-45df-8030-94e27176f8c4', 'CD/25-1437': '0dc130a1-b077-49c1-8b20-7913c9c66608' }
  const sia: Fila[] = []
  for (const raw of filas as SiaFilaRaw[]) {
    const r = mapFilaSia(raw, { entidadGuid: GUID, hospitalPorNit: new Map([['891855029', HRO]]), clasificacionVersion: CLASIFICACION_VERSION })
    if (!('row' in r)) continue
    const id = `51a00000-0000-4000-8000-${String(r.row.sia_idc).padStart(12, '0')}`
    const secopId = r.row.codigo ? cruce[r.row.codigo] ?? null : null
    sia.push({ ...r.row, id, secop_contrato_id: secopId, secop_cruce: secopId ? 'codigo' : null, estado_revision: 'nuevo', motivo_descarte: null, hospital_contract_id: null, ficha_leida_at: '2026-10-30T07:30:00Z', refrescar_solicitado_at: null })
  }
  const id1262 = sia.find(s => s.codigo === 'CD/26-1262')?.id as string
  const docs = [
    ['13_contrato_1262_compressed.pdf', 'contrato', 'descargado'],
    ['ep_110_compressed_18.pdf', 'estudio_previo', 'descargado'],
    ['acta_de_inicio_1262.pdf', 'acta_inicio', 'anonimizacion_pendiente'],
    ['poliza_rce_1262.pdf', 'poliza', 'solo_enlace'],
  ].map(([nombre, tipo, estado], i) => ({
    id: `d0c00000-0000-4000-8000-00000000000${i}`,
    sia_contrato_id: id1262,
    nombre_archivo: nombre,
    tipo,
    estado,
    fuente_url: `https://siaobserva.auditoria.gov.co/handlers/filehandler_guess_anonimo.ashx?ianx=${i + 1}&ianxa=${i + 2}&eid=${GUID}`,
    storage_path: estado === 'descargado' ? `891855029/12910254/${'a'.repeat(63)}${i}.pdf` : null,
    fecha_cargue_sia: '2026-07-09',
    paginas: 8,
    tiene_texto: false,
  }))
  const extraccion = { id: 'e0000000-0000-4000-8000-000000000001', sia_contrato_id: id1262, modelo: 'claude-opus-5-5', version_prompt: 'v', datos: JSON.parse(leer('extraccion-cd-26-1262.json')).datos, discrepancias: [], created_at: '2026-10-30T08:00:00Z' }
  return fakeSupabase({
    tablas: {
      hospitals: [{ id: HRO, name: 'Hospital Regional de La Orinoquia E.S.E.', nit: '891855029', municipality_name: 'Yopal' }],
      sia_contratos: sia,
      secop_contratos: secop,
      secop_descartes_bandeja: [],
      contrato_documentos: docs,
      contrato_extracciones: [extraccion],
      proveedores: [{ id: '25ceb8d4-866e-4ada-b537-40a85789a2db', nit: '901.386.177-1', nombre: 'FARMAORTOPEDICOS' }],
      hospital_contracts: [
        { id: 'hc-1111', hospital_id: HRO, contract_number: 'CD/25-1111', contract_value: 1256302480, start_date: '2025-05-22', end_date: '2025-10-21', contracting_model: 'licitacion', documents_link: null, sia_contrato_id: null, secop_contrato_id: null, requires_liquidez: true, min_liquidez: 1.2, requires_endeudamiento: true, max_endeudamiento: 0.7, requires_capital_trabajo: false, min_capital_trabajo: 0, custom_requirements: null },
      ],
      assignments: [{ hospital_id: HRO, kam_id: 'k-yopal' }],
      kams: [{ id: 'k-yopal', name: 'Yopal' }],
    },
  })
}

async function main() {
  const { db, tablas } = semilla()
  const id = (codigo: string) => (tablas.get('sia_contratos') as Fila[]).find(s => s.codigo === codigo)?.id as string

  console.log('\nPermisos de las rutas')
  check('ver (contracts:view): contract_manager, sales_manager y admin', ['admin', 'contract_manager', 'sales_manager'].every(r => hasPermission(r as never, 'contracts:view')))
  check('importar/descartar (contracts:edit): no sales_manager', hasPermission('contract_manager' as never, 'contracts:edit') && !hasPermission('sales_manager' as never, 'contracts:edit'))
  check('diagnóstico de red (fuentes:manage): solo admin', hasPermission('admin' as never, 'fuentes:manage') && !hasPermission('contract_manager' as never, 'fuentes:manage'))

  console.log('\nFase 1 · Contratos SIA de la Orinoquía')
  const h = (await contratosDeHospital(db, HRO)).body as { contratos: Array<{ codigo: string; valor_vigente: number; secop: { id: string; valor: number } | null }> }
  const porCodigo = new Map(h.contratos.map(c => [c.codigo, c]))
  eq('los 4 de la tabla de la sección 4 con el valor vigente de SIA', ['CD/26-1103', 'CD/25-1783', 'CD/25-1437', 'CD/25-1111'].map(c => porCodigo.get(c)?.valor_vigente), [4524124620, 1658466448, 682313892, 1222105002])
  eq('y su cruce con SECOP (valor de SECOP al lado)', ['CD/25-1437', 'CD/25-1111'].map(c => porCodigo.get(c)?.secop?.valor), [1000000000, 1256302480])
  check('sin personas naturales en la respuesta', !JSON.stringify(h).includes('PERSONA') && !JSON.stringify(h).includes('1000000001'))

  console.log('\nFase 2 · Importar CD/26-1262')
  const imp = (await importablesDeHospital(db, HRO, HOY)).body as { contratos: Array<{ origen: string; codigo: string; id: string }> }
  check('lista: CD/26-1262 desde SIA (no repetido desde SECOP)', imp.contratos.filter(c => c.codigo === 'CD/26-1262').map(c => c.origen).join() === 'sia')
  check('lista: CD/25-1658 (solo en SECOP) aparece desde SECOP', imp.contratos.some(c => c.codigo === 'CD/25-1658' && c.origen === 'secop' && c.id === SECOP_1658))
  const viejo = await importablesDeHospital(db, HRO, '2028-01-15')
  check('lista: solo los últimos 24 meses (en 2028 ya no sale nada de 2025)', !(viejo.body as { contratos: Array<{ fecha_firma: string }> }).contratos.some(c => c.fecha_firma < '2026-01-15'))
  const p = (await precargaFormulario(db, { siaId: id('CD/26-1262') })).body as { precarga: Record<string, unknown>; indicadores: Record<string, unknown>; proveedor: { id: string } | null; extraccion: { fuentes: unknown[] } }
  eq('precarga = carga manual de referencia', [p.precarga.hospital_id, p.precarga.contract_number, p.precarga.current_provider, p.precarga.contract_value, p.precarga.contract_type, p.precarga.contracting_model, p.precarga.start_date, p.precarga.end_date, p.precarga.documents_link], [
    HRO, 'CD/26-1262', 'FARMAORTOPEDICOS S.A.S', 510281732, 'evento', 'contratacion_directa', '2026-07-02', '2026-12-31', 'https://siaobserva.auditoria.gov.co/guess/cto_ficha_resumen_guess.aspx?idc=12910254',
  ])
  eq('indicadores leídos por la IA: liquidez 1, endeudamiento 50 %, sin cobertura, capital 510,28 MM, sin años de experiencia', [p.indicadores.min_liquidez, p.indicadores.max_endeudamiento, p.indicadores.requires_cobertura, p.indicadores.min_capital_trabajo, p.indicadores.requires_experiencia], [1, 0.5, false, 510.28, false])
  eq('proveedor de proveedores por NIT (aunque esté escrito con DV y puntos)', p.proveedor?.id, '25ceb8d4-866e-4ada-b537-40a85789a2db')
  check('las fuentes (documento y página) viajan para mostrarlas', p.extraccion.fuentes.length >= 4)
  const pSecop = (await precargaFormulario(db, { secopId: SECOP_1262 })).body as { origen: string }
  eq('pedir la precarga desde el SECOP de un contrato que está en SIA: manda SIA', pSecop.origen, 'sia')
  const pSolo = (await precargaFormulario(db, { secopId: SECOP_1658 })).body as { origen: string; precarga: Record<string, unknown> }
  eq('solo en SECOP: precarga desde SECOP con la referencia como número', [pSolo.origen, pSolo.precarga.contract_number, pSolo.precarga.sia_contrato_id], ['secop', 'CD/25-1658', null])

  await marcarImportado(db, id('CD/26-1262'), 'hc-1262', 'u-1')
  const s1262 = (tablas.get('sia_contratos') as Fila[]).find(s => s.codigo === 'CD/26-1262')
  eq('al guardar: importado y enlazado', [s1262?.estado_revision, s1262?.hospital_contract_id, s1262?.revisado_por], ['importado', 'hc-1262', 'u-1'])
  ;(tablas.get('hospital_contracts') as Fila[]).push({ id: 'hc-1262', hospital_id: HRO, contract_number: 'CD/26-1262', contract_value: 510281732, start_date: '2026-07-02', end_date: '2026-12-31', contracting_model: 'contratacion_directa', documents_link: 'https://siaobserva.auditoria.gov.co/guess/cto_ficha_resumen_guess.aspx?idc=12910254', sia_contrato_id: id('CD/26-1262'), secop_contrato_id: SECOP_1262, requires_liquidez: true, min_liquidez: 1, requires_endeudamiento: true, max_endeudamiento: 0.5, requires_capital_trabajo: true, min_capital_trabajo: 510.28, custom_requirements: 'x' })
  const c1262 = (await siaDeHospitalContract(db, 'hc-1262')).body as { documentos: Array<{ tipo: string; estado: string; id: string }>; diferencias: unknown[] }
  eq('documentos de CD/26-1262: el acta en anonimizacion_pendiente', c1262.documentos.find(d => d.tipo === 'acta_inicio')?.estado, 'anonimizacion_pendiente')
  eq('contrato importado igual a SIA y a la IA: sin diferencias', c1262.diferencias, [])
  const enlace = (await enlaceDocumento(db, c1262.documentos.find(d => d.tipo === 'contrato')?.id as string)).body as { url: string; expira_en: number }
  check(`documento descargado: enlace firmado de ${ENLACE_SEGUNDOS / 60} minutos`, enlace.expira_en === 600 && enlace.url.includes('contratos-sia'))
  const sinCopia = await enlaceDocumento(db, c1262.documentos.find(d => d.tipo === 'acta_inicio')?.id as string)
  eq('documento sin copia: 409 (se abre en SIA)', sinCopia.status, 409)

  console.log('\nFase 3 · Diferencias de CD/25-1111 y bandeja')
  const c1111 = (await siaDeHospitalContract(db, 'hc-1111')).body as { sia: { codigo: string }; diferencias: Array<{ campo: string; actual: unknown; propuesto: unknown; cambios: Record<string, unknown> }> }
  const valor = c1111.diferencias.find(d => d.campo === 'contract_value')
  eq('CD/25-1111 (enlazado por número) aparece con la diferencia de valor 1.256.302.480 → 1.222.105.002', [c1111.sia?.codigo, valor?.actual, valor?.propuesto, valor?.cambios], ['CD/25-1111', 1256302480, 1222105002, { contract_value: 1222105002 }])
  const hc1111 = (tablas.get('hospital_contracts') as Fila[]).find(x => x.id === 'hc-1111')
  eq('y no se sobrescribe sola', hc1111?.contract_value, 1256302480)
  const act = await pedirActualizacion(db, 'hc-1111')
  const s1111 = (tablas.get('sia_contratos') as Fila[]).find(s => s.codigo === 'CD/25-1111')
  check('"Actualizar desde SIA": marca la relectura y enlaza, sin tocar el valor', act.status === 200 && Boolean(s1111?.refrescar_solicitado_at) && hc1111?.sia_contrato_id === s1111?.id && hc1111?.contract_value === 1256302480)

  const bandeja = (await detectados(db, {}, HOY)).body as { contratos: Array<{ codigo: string; origen: string; zona: string; id: string }> }
  const codigos = bandeja.contratos.map(c => `${c.origen}:${c.codigo}`)
  check('bandeja: sin CD/26-1262 (importado) ni CD/25-1111 (ya en Contratos)', !codigos.some(c => c.endsWith('CD/26-1262') || c.endsWith('CD/25-1111')), codigos)
  check('bandeja: SIA para los de SIA y SECOP solo para lo que no está en SIA (CD/25-1658)', codigos.includes('sia:CD/26-1103') && codigos.includes('secop:CD/25-1658') && !codigos.includes('secop:CD/26-1103'), codigos)
  eq('bandeja: con la Zona de la IPS', bandeja.contratos[0]?.zona, 'Yopal')
  const soloReemplazo = (await detectados(db, { linea: 'reemplazo' }, HOY)).body as { contratos: Array<{ codigo: string }> }
  eq('filtro por línea', soloReemplazo.contratos.map(c => c.codigo), ['CD/26-1300'])
  const otraZona = (await detectados(db, { kamId: 'otra' }, HOY)).body as { contratos: unknown[] }
  eq('filtro por Zona', otraZona.contratos.length, 0)
  eq('descartar sin motivo: 400', (await descartarDetectado(db, { siaId: id('CD/26-1103'), motivo: ' ' }, 'u-1')).status, 400)
  await descartarDetectado(db, { siaId: id('CD/26-1103'), motivo: 'Ya lo tenemos con otro número' }, 'u-1')
  await descartarDetectado(db, { secopId: SECOP_1658, motivo: 'No es de nuestras líneas' }, 'u-1')
  const despues = ((await detectados(db, {}, HOY)).body as { contratos: Array<{ codigo: string }> }).contratos.map(c => c.codigo)
  check('descartados (SIA y SECOP) salen de la bandeja', !despues.includes('CD/26-1103') && !despues.includes('CD/25-1658'), despues)
  check('el descarte de SECOP va a secop_descartes_bandeja (secop_contratos no cambia)', (tablas.get('secop_descartes_bandeja') as Fila[]).length === 1 && (tablas.get('secop_contratos') as Fila[]).length === 14)

  console.log('\nSin la migración 0930')
  const sinTablas = fakeSupabase({ tablas: { hospitals: [{ id: HRO, name: 'HRO', nit: '891855029', municipality_name: 'Yopal' }] } })
  const r = await conMigracion(() => contratosDeHospital(sinTablas.db, HRO))
  eq('503 con disponible: false', [r.status, (r.body as { disponible: boolean }).disponible], [503, false])

  console.log(`\n${passed} pasaron, ${failed} fallaron`)
  if (failed > 0) process.exit(1)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
