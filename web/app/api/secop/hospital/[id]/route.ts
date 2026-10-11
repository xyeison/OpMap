import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { isUuid, serverError } from '@/app/api/_lib/api-error'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { nitFromHospitalCode } from '@/lib/adres-parse.mjs'
import {
  FILTRO_ATIPICOS,
  FILTRO_MEDICOS,
  LINEAS_FILTRO,
  normalizeLinea,
  summarizeHospitalSecop,
  type HospitalSecopResponse,
} from '@/lib/compras-publicas'
import {
  SECOP_MISSING_MESSAGE,
  isMissingRelationError,
  loadContratosEntidad,
  loadSecopActualizado,
  loadVigiladosActivos,
  naturalezaDeNit,
} from '../../_lib/secop-server'
import { hoyBogota } from '../../_lib/hoy'

export const dynamic = 'force-dynamic'

const NOTES = [
  'Fuente: SECOP II (contratos) y SECOP Integrado (SECOP I y II desde 2005) de Colombia Compra Eficiente, en datos.gov.co. Solo contratos ortopédicos y de neurocirugía según el objeto, la descripción y el código UNSPSC.',
  'SECOP I publica el valor del proceso en cada contratista: esas filas se cuentan una vez, repartiendo el valor por partes iguales (la lista lo indica en cada contrato).',
  'El NIT es de la entidad, no de la sede: si tiene varias sedes en OpMap, estas cifras son de la entidad completa.',
  'Médicos: información pública de contratación estatal. Se guarda nombre, entidad, objeto, valor, fechas, enlace y especialidad; nunca el número de documento.',
  '"Sin clasificar": contratos de proveedores vigilados sin línea ortopédica detectada; se muestran pero no suman en el total. Un contrato de más de 50.000 millones ("fuera de escala": suele ser un error de digitación o el valor de un proceso entero) se lista pero no suma; los marcados "valor alto para la entidad" (por encima de su percentil 99) sí suman.',
]

// GET /api/secop/hospital/[id]?page=N&linea=<código de línea|no_clasificado|medicos|atipicos>
// Tarjeta "Contratación pública (SECOP)" de la ficha: resumen 24 meses y total histórico por línea de
// producto, compras por año, proveedores (marca "vigilado"), médicos contratados y contratos con enlace al
// expediente (paginados). Solo para IPS públicas o mixtas (REPS) o cuyo NIT figura como entidad en SECOP.
// Permiso intelligence:view.
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(request, 'intelligence:view')
  if (!auth.ok) return auth.response

  const id = String(params?.id || '')
  if (!isUuid(id)) return NextResponse.json({ error: 'ID de IPS no válido' }, { status: 400 })
  const pageRaw = Number(request.nextUrl.searchParams.get('page') || '1')
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1
  const lineaRaw = (request.nextUrl.searchParams.get('linea') || '').trim()
  const lineaContratos = lineaRaw === FILTRO_MEDICOS || lineaRaw === FILTRO_ATIPICOS ? lineaRaw : lineaRaw ? normalizeLinea(lineaRaw) : null
  if (lineaContratos && lineaContratos !== FILTRO_MEDICOS && lineaContratos !== FILTRO_ATIPICOS && !LINEAS_FILTRO.some(item => item.code === lineaContratos)) {
    return NextResponse.json({ error: 'linea no válida' }, { status: 400 })
  }

  try {
    const { data: hospitalData, error: hospitalError } = await supabaseAdmin.from('hospitals').select('id, name, code').eq('id', id).limit(1)
    if (hospitalError) throw Object.assign(new Error(`Error leyendo hospitals: ${hospitalError.message}`), { dbError: hospitalError })
    const hospital = hospitalData?.[0] as { id: string; name: string; code: string | null } | undefined
    if (!hospital) return NextResponse.json({ error: 'IPS no encontrada' }, { status: 404 })

    const nit = nitFromHospitalCode(hospital.code)
    if (!nit) {
      const body: HospitalSecopResponse = {
        hospital: { id: hospital.id, name: hospital.name, nit: null },
        naturaleza: null,
        publica: false,
        entidad: null,
        summary: null,
        actualizado: {},
        notes: ['El código de esta IPS no es un NIT válido; no se puede cruzar con SECOP.'],
      }
      return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
    }

    const [naturaleza, contratos, vigilados, actualizado] = await Promise.all([
      naturalezaDeNit(nit),
      loadContratosEntidad(nit),
      loadVigiladosActivos(),
      loadSecopActualizado(),
    ])
    const publica = naturaleza === 'Pública' || naturaleza === 'Mixta' || contratos.length > 0
    const masReciente = contratos
      .filter(c => c.nombre_entidad)
      .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))[0]

    const body: HospitalSecopResponse = {
      hospital: { id: hospital.id, name: hospital.name, nit },
      naturaleza,
      publica,
      entidad: { nit, nombre: masReciente?.nombre_entidad ?? null },
      summary: publica ? summarizeHospitalSecop({ contratos, vigilados, hoy: hoyBogota(), page, lineaContratos }) : null,
      actualizado,
      notes: NOTES,
    }
    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (isMissingRelationError(error)) return serverError('secop/hospital GET', error, SECOP_MISSING_MESSAGE, 503)
    return serverError('secop/hospital GET', error, 'Error al cargar la contratación pública')
  }
}
