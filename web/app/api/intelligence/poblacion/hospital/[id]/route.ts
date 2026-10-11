import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { fetchAllRows, serverError, UUID_RE } from '@/app/api/_lib/api-error'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  closestCorte,
  hospitalGiroMap,
  pickDaneYear,
  rankInMunicipio,
  resolveMunicipios,
  summarizeBduaRows,
  summarizeEntorno,
  type BduaRegimenRow,
  type CifrasMunicipioRow,
  type EpsAfiliadosRow,
  type HospitalEntornoResponse,
} from '@/lib/poblacion-intelligence'
import {
  loadBduaMunicipioRows,
  loadCifrasMunicipio,
  loadDane,
  loadGirosTotales,
  loadPoblacionCortes,
  optionalSource,
} from '../../../_lib/poblacion-server'

export const dynamic = 'force-dynamic'

interface HospitalLite {
  id: string
  name: string
  code: string | null
  beds: number | null
  municipality_id: string | null
  active: boolean | null
}

// GET /api/intelligence/poblacion/hospital/[id] — tarjeta "Entorno del municipio" de la ficha de IPS:
// afiliados por régimen, cobertura y 3 EPS dominantes del municipio de la IPS (último corte), y la
// posición de la IPS en el ranking de giros ADRES de su municipio (12 meses, reparto por sede).
// Permiso hospitals:view (quien ve la ficha): son datos públicos del municipio y de la ADRES. No
// devuelve nombres ni cifras de otras IPS, solo la posición y el total del municipio.
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(request, 'hospitals:view')
  if (!auth.ok) return auth.response

  const id = String(params?.id || '')
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'ID de IPS no válido' }, { status: 400 })

  try {
    const { data: hospitalData, error: hospitalError } = await supabaseAdmin
      .from('hospitals')
      .select('id, name, code, beds, municipality_id, active')
      .eq('id', id)
      .limit(1)
    if (hospitalError) throw new Error(`Error leyendo hospitals: ${hospitalError.message}`)
    const hospital = hospitalData?.[0] as HospitalLite | undefined
    if (!hospital) return NextResponse.json({ error: 'IPS no encontrada' }, { status: 404 })
    const municipio = (hospital.municipality_id || '').trim()

    const [cortes, municipalityResult, activeResult] = await Promise.all([
      loadPoblacionCortes(),
      municipio
        ? supabaseAdmin.from('municipalities').select('code, name, department_code, population_2025').eq('code', municipio).limit(1)
        : Promise.resolve({ data: [], error: null }),
      // Todas las IPS activas: el giro de un NIT se reparte entre TODAS sus sedes, estén donde estén.
      // Paginado: PostgREST corta en 1.000 filas (hoy hay 783 IPS activas).
      fetchAllRows<Omit<HospitalLite, 'active'>>((from, to) =>
        supabaseAdmin.from('hospitals').select('id, name, code, beds, municipality_id').eq('active', true).order('id').range(from, to)
      ),
    ])
    if (municipalityResult.error) throw new Error(`Error leyendo municipalities: ${municipalityResult.error.message}`)
    if (activeResult.error) throw new Error(`Error leyendo hospitals: ${(activeResult.error as { message?: string }).message}`)

    const actives = activeResult.data
    const giros = await loadGirosTotales(actives.map(item => item.code))
    const cifrasDate = cortes.cifras.length > 0 ? cortes.cifras[cortes.cifras.length - 1] : null
    const bduaCorte = closestCorte(cifrasDate, cortes.bdua)
    const daneYear = pickDaneYear(cifrasDate ?? bduaCorte, cortes.dane)

    let entorno: HospitalEntornoResponse['municipio'] = null
    let sources: HospitalEntornoResponse['sources'] = { cifras: false, bdua: false, dane: false }
    const municipality = (municipalityResult.data?.[0] as { code: string; name: string; department_code: string; population_2025: number | null } | undefined) ?? null
    if (municipality) {
      const [cifras, bdua, dane, deptResult] = await Promise.all([
        cifrasDate ? optionalSource(() => loadCifrasMunicipio(cifrasDate, municipio), [] as CifrasMunicipioRow[]) : Promise.resolve({ value: [] as CifrasMunicipioRow[], available: false }),
        bduaCorte
          ? optionalSource(async () => summarizeBduaRows(await loadBduaMunicipioRows(bduaCorte, municipio)), { regimen: [] as BduaRegimenRow[], eps: [] as EpsAfiliadosRow[] })
          : Promise.resolve({ value: { regimen: [] as BduaRegimenRow[], eps: [] as EpsAfiliadosRow[] }, available: false }),
        daneYear !== null ? optionalSource(() => loadDane(daneYear, municipio), new Map<string, number>()) : Promise.resolve({ value: new Map<string, number>(), available: false }),
        supabaseAdmin.from('departments').select('code, name').eq('code', municipality.department_code).limit(1),
      ])
      const departmentNames = new Map<string, string>((deptResult.data || []).map(row => [row.code as string, row.name as string]))
      const [resolved] = resolveMunicipios({
        municipalities: [municipality],
        departmentNames,
        cifras: cifras.value,
        bdua: bdua.value.regimen,
        dane: dane.value,
      })
      entorno = summarizeEntorno(resolved, bdua.value.eps)
      sources = { cifras: cifras.value.length > 0, bdua: bdua.value.regimen.length > 0, dane: dane.value.size > 0 }
    }

    const ranking = hospital.active && municipio ? rankInMunicipio(actives, hospitalGiroMap(actives, giros.totals), hospital.id) : null

    const body: HospitalEntornoResponse = {
      municipio: entorno,
      ranking,
      corte: cifrasDate ? cifrasDate.slice(0, 7) : null,
      bduaCorte: bduaCorte ? bduaCorte.slice(0, 7) : null,
      poblacionAnio: sources.dane ? daneYear : null,
      giros: giros.info,
      sources,
    }
    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return serverError('intelligence/poblacion/hospital GET', error, 'Error al cargar el entorno del municipio')
  }
}
