/**
 * SIA Observa · catálogo de entidades (sia_entidades) y enlace con hospitals (Fase 1.4 de
 * docs/specs/2026-10-29-agente-sia-observa.md). Correr en el Mac del dueño (SIA corta conexiones fuera de Colombia).
 *
 * Modos (se pueden combinar; el orden es el de abajo):
 *   --desde-contratos   Sin navegador: siembra las entidades con el `ide` de los 53 hospital_contracts que ya enlazan la
 *                       ficha de SIA (el GUID de la entidad viene en el enlace). Lo más rápido para empezar.
 *   --cascada           Con Playwright (solo aquí, nunca en producción): recorre Departamento → Municipio → Entidades de
 *                       informe_cont_ciudadania1.aspx en los municipios donde OpMap tiene IPS públicas (--todos: todos)
 *                       y guarda cada GUID con su nombre. --departamentos 26,16 limita a esos ids de SIA.
 *                       Requiere `npx playwright install chromium` una vez en el Mac.
 *   (siempre)           Valida el NIT de las entidades sin validar que parecen de salud: Get_CTOs_Base del último mes
 *                       (si no hay filas, 12 meses) y entidad_nit de la primera fila. Luego enlaza con hospitals por NIT
 *                       (hospitals.sia_entidad_id en todas las sedes activas de ese NIT) y fija la prioridad = contratos
 *                       clasificados de ese NIT en secop_contratos (el sync empieza por las de más).
 *   --dry-run           No escribe en Supabase.
 *
 * Uso (desde web/):  npx tsx scripts/sia-entidades.ts --desde-contratos
 *                    npx tsx scripts/sia-entidades.ts --cascada --departamentos 26
 */
import { getSupabaseAdmin, type SupabaseAdminClient } from '../lib/supabase-admin'
import { SIA_BASE_URL, hoyBogota, siaDeEnlace, sumarDias } from '../lib/sia-observa/normalizar'
import { SIA_INFORME_PATH, SIA_LOGIN_PATH, type SiaCliente } from '../lib/sia-observa/client'
import { normalizeNit, normalizeText } from '../lib/secop'
import { normalizeMunicipioName } from '../lib/municipio-alias'
import { crearCliente, leerArgs, log } from './lib/sia-script'

/** Nombres de entidades de salud (las demás —alcaldías, colegios— no se validan para no cargar el portal). */
export const RE_ENTIDAD_SALUD = /\be\s?\.?\s?s\s?\.?\s?e\b|\bhospital|\bsalud\b|\bclinica|\bips\b|\bsanatorio|\bred (de )?salud|\binstituto (departamental|de salud|nacional de cancerologia)|\bcentro de salud/

interface FilaEntidad {
  guid: string
  nombre: string
  departamento_sia_id?: number | null
  departamento?: string | null
  municipio_sia_id?: number | null
  municipio?: string | null
  origen: 'cascada' | 'contratos'
  nit?: string | null
  hospital_id?: string | null
}

async function upsertEntidades(db: SupabaseAdminClient, filas: FilaEntidad[], dryRun: boolean) {
  if (dryRun || filas.length === 0) return
  for (let i = 0; i < filas.length; i += 200) {
    const { error } = await db.from('sia_entidades').upsert(filas.slice(i, i + 200), { onConflict: 'guid' })
    if (error) throw new Error(`sia_entidades: ${error.message}`)
  }
}

async function desdeContratos(db: SupabaseAdminClient, dryRun: boolean): Promise<number> {
  const { data, error } = await db.from('hospital_contracts').select('documents_link, hospitals(id, name, nit)').ilike('documents_link', '%siaobserva%')
  if (error) throw new Error(`hospital_contracts: ${error.message}`)
  const porGuid = new Map<string, FilaEntidad>()
  for (const hc of (data ?? []) as unknown as Array<{ documents_link: string; hospitals: { id: string; name: string; nit: string | null } | null }>) {
    const enlace = siaDeEnlace(hc.documents_link)
    if (!enlace?.ide || porGuid.has(enlace.ide)) continue
    porGuid.set(enlace.ide, { guid: enlace.ide, nombre: hc.hospitals?.name ?? 'Entidad de SIA', origen: 'contratos' })
  }
  // No se pisa una entidad que ya vino de la cascada (con su nombre oficial)
  const { data: existentes } = await db.from('sia_entidades').select('guid').in('guid', Array.from(porGuid.keys()))
  const ya = new Set((existentes ?? []).map(e => (e as { guid: string }).guid))
  const nuevas = Array.from(porGuid.values()).filter(e => !ya.has(e.guid))
  await upsertEntidades(db, nuevas, dryRun)
  log(`Desde contratos: ${porGuid.size} entidades en los enlaces, ${nuevas.length} nuevas`)
  return nuevas.length
}

/** Municipios (departamento|municipio normalizados) donde OpMap tiene IPS que son entidad de compra pública (secop_nits_ips). */
async function municipiosConIpsPublicas(db: SupabaseAdminClient): Promise<Set<string>> {
  const { data: nits, error } = await db.rpc('secop_nits_ips')
  if (error) throw new Error(`secop_nits_ips: ${error.message}`)
  const publicas = ((nits ?? []) as Array<{ nit: string; publica: boolean }>).filter(n => n.publica).map(n => n.nit)
  const out = new Set<string>()
  for (let i = 0; i < publicas.length; i += 200) {
    const { data, error: e2 } = await db.from('hospitals').select('municipality_name, department_name').eq('active', true).in('nit', publicas.slice(i, i + 200))
    if (e2) throw new Error(`hospitals: ${e2.message}`)
    for (const h of (data ?? []) as Array<{ municipality_name: string | null; department_name: string | null }>) {
      out.add(`${normalizeText(h.department_name)}|${normalizeMunicipioName(h.municipality_name)}`)
    }
  }
  return out
}

async function cascada(db: SupabaseAdminClient, opts: { todos: boolean; departamentos: number[] | null; dryRun: boolean }): Promise<number> {
  let playwright: { chromium: { launch: (o?: unknown) => Promise<any> } }
  try {
    const nombre = 'playwright'
    playwright = await import(nombre)
  } catch {
    throw new Error('Falta Playwright: npm i -D playwright && npx playwright install chromium (solo en el Mac)')
  }
  const municipios = opts.todos ? null : await municipiosConIpsPublicas(db)
  const browser = await playwright.chromium.launch({ headless: true })
  const page = await browser.newPage({ userAgent: (await import('../lib/sia-observa/client')).userAgentSia() })
  const pausa = () => page.waitForTimeout(1500)
  let guardadas = 0
  try {
    await page.goto(`${SIA_BASE_URL}${SIA_LOGIN_PATH}`)
    await page.getByText('Ingresa como Invitado').click()
    await page.waitForLoadState('networkidle')
    const continuar = page.getByRole('button', { name: /continuar/i })
    if (await continuar.count()) await continuar.first().click()
    await page.goto(`${SIA_BASE_URL}${SIA_INFORME_PATH}`)
    await page.waitForLoadState('networkidle')
    const selDepto = (await page.locator('select[id$="cmbDepartamento"]').count()) ? 'select[id$="cmbDepartamento"]' : 'select[id*="Departamento"]'
    const selMuni = (await page.locator('select[id$="cmbMunicipio"]').count()) ? 'select[id$="cmbMunicipio"]' : 'select[id*="Municipio"]'
    const selEnt = 'select[id$="cmbEntidades"]'
    const deptos: Array<{ value: string; text: string }> = await page.$$eval(`${selDepto} option`, (os: Array<{ value: string; textContent: string | null }>) => os.map(o => ({ value: o.value, text: (o.textContent ?? '').trim() })))
    for (const depto of deptos) {
      if (!/^\d+$/.test(depto.value)) continue
      if (opts.departamentos && !opts.departamentos.includes(Number(depto.value))) continue
      await page.selectOption(selDepto, depto.value)
      await page.waitForLoadState('networkidle')
      await pausa()
      const munis: Array<{ value: string; text: string }> = await page.$$eval(`${selMuni} option`, (os: Array<{ value: string; textContent: string | null }>) => os.map(o => ({ value: o.value, text: (o.textContent ?? '').trim() })))
      for (const muni of munis) {
        if (!/^\d+$/.test(muni.value)) continue
        if (municipios && !municipios.has(`${normalizeText(depto.text)}|${normalizeMunicipioName(muni.text)}`)) continue
        await page.selectOption(selMuni, muni.value)
        await page.waitForLoadState('networkidle')
        await pausa()
        const ents: Array<{ value: string; text: string }> = await page.$$eval(`${selEnt} option`, (os: Array<{ value: string; textContent: string | null }>) => os.map(o => ({ value: o.value, text: (o.textContent ?? '').trim() })))
        const filas: FilaEntidad[] = ents
          .filter(e => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(e.value))
          .map(e => ({ guid: e.value.toLowerCase(), nombre: e.text, departamento_sia_id: Number(depto.value), departamento: depto.text, municipio_sia_id: Number(muni.value), municipio: muni.text, origen: 'cascada' as const }))
        await upsertEntidades(db, filas, opts.dryRun)
        guardadas += filas.length
        log(`  ${depto.text} › ${muni.text}: ${filas.length} entidades`)
      }
    }
  } finally {
    await browser.close()
  }
  return guardadas
}

/** NIT desde Get_CTOs_Base (último mes; si no hay filas, 12 meses). null si la entidad no reporta contratos. */
async function nitDeEntidad(cliente: SiaCliente, guid: string, hoy: string): Promise<string | null> {
  for (const dias of [31, 365]) {
    const { filas } = await cliente.getContratosEntidad(guid, sumarDias(hoy, -dias), hoy)
    const nit = filas.map(f => normalizeNit(f.entidad_nit)).find(n => n && /^\d{9}$/.test(n))
    if (nit) return nit
  }
  return null
}

async function validarYEnlazar(db: SupabaseAdminClient, cliente: SiaCliente, dryRun: boolean) {
  const hoy = hoyBogota()
  const { data, error } = await db.from('sia_entidades').select('guid, nombre, nit, validado_at, origen')
  if (error) throw new Error(`sia_entidades: ${error.message}`)
  const entidades = (data ?? []) as Array<{ guid: string; nombre: string; nit: string | null; validado_at: string | null; origen: string }>
  let validadas = 0
  for (const e of entidades) {
    if (e.validado_at) continue
    if (e.origen === 'cascada' && !RE_ENTIDAD_SALUD.test(normalizeText(e.nombre))) continue
    const nit = await nitDeEntidad(cliente, e.guid, hoy)
    log(`  ${e.nombre}: NIT ${nit ?? 'sin contratos en 12 meses'}`)
    if (!nit || dryRun) continue
    const { error: e2 } = await db.from('sia_entidades').update({ nit, validado_at: new Date().toISOString() }).eq('guid', e.guid)
    if (e2) throw new Error(`sia_entidades: ${e2.message}`)
    e.nit = nit
    validadas++
  }
  log(`Validadas: ${validadas}`)

  const { data: nits, error: e3 } = await db.rpc('secop_nits_ips')
  if (e3) throw new Error(`secop_nits_ips: ${e3.message}`)
  const principal = new Map(((nits ?? []) as Array<{ nit: string; hospital_id: string }>).map(n => [n.nit, n.hospital_id]))
  let enlazadas = 0
  for (const e of entidades) {
    if (!e.nit) continue
    const hospitalId = principal.get(e.nit) ?? null
    const { count } = await db.from('secop_contratos').select('id', { count: 'exact', head: true }).eq('nit_entidad', e.nit).neq('linea', 'no_clasificado')
    if (dryRun) continue
    const { error: e4 } = await db.from('sia_entidades').update({ hospital_id: hospitalId, prioridad: count ?? 0 }).eq('guid', e.guid)
    if (e4) throw new Error(`sia_entidades: ${e4.message}`)
    if (hospitalId) {
      const { error: e5 } = await db.from('hospitals').update({ sia_entidad_id: e.guid, sia_mapeado_at: new Date().toISOString() }).eq('nit', e.nit).eq('active', true)
      if (e5) throw new Error(`hospitals: ${e5.message}`)
      enlazadas++
    }
  }
  log(`Enlazadas con IPS de OpMap: ${enlazadas}`)
}

async function main() {
  const args = leerArgs(process.argv.slice(2), ['departamentos'], ['desde-contratos', 'cascada', 'todos', 'dry-run'])
  const db = getSupabaseAdmin()
  const cliente = crearCliente()
  const dryRun = Boolean(args['dry-run'])
  if (args['desde-contratos']) await desdeContratos(db, dryRun)
  if (args.cascada) {
    const departamentos = typeof args.departamentos === 'string' ? args.departamentos.split(',').map(Number).filter(Number.isInteger) : null
    log(`Cascada: ${await cascada(db, { todos: Boolean(args.todos), departamentos, dryRun })} entidades leídas`)
  }
  await validarYEnlazar(db, cliente, dryRun)
  log(`Peticiones a Get_CTOs_Base: ${cliente.peticiones}`)
}

if (require.main === module) {
  main().catch(error => {
    console.error(error)
    process.exit(1)
  })
}
