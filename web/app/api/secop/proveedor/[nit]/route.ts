import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { serverError } from '@/app/api/_lib/api-error'
import { loadIntelHospitals } from '@/app/api/intelligence/_lib/giros-server'
import { normalizeNitEmpresa, summarizeProveedorSecop, type ProveedorSecopResponse } from '@/lib/compras-publicas'
import { SECOP_MISSING_MESSAGE, isMissingRelationError, loadHechos, loadSecopActualizado, loadVigilados } from '../../_lib/secop-server'

export const dynamic = 'force-dynamic'

// GET /api/secop/proveedor/[nit] — dónde vende un proveedor (empresa) en SECOP: entidades por línea de
// producto y año, todo el histórico cargado, marcando las que son IPS de OpMap. NIT con o sin DV.
// Permiso intelligence:view.
export async function GET(request: NextRequest, { params }: { params: { nit: string } }) {
  const auth = await requirePermission(request, 'intelligence:view')
  if (!auth.ok) return auth.response

  let raw = String(params?.nit || '')
  try {
    raw = decodeURIComponent(raw)
  } catch {
    // ya venía decodificado o mal formado: normalizeNitEmpresa lo rechaza si no es un NIT
  }
  const normalized = normalizeNitEmpresa(raw)
  if (!normalized.ok) return NextResponse.json({ error: normalized.error }, { status: 400 })
  const nit = normalized.nit

  try {
    const [facts, hospitals, vigilados, actualizado] = await Promise.all([
      loadHechos({ desde: null, hasta: null, proveedorNits: [nit] }),
      loadIntelHospitals(null),
      loadVigilados(),
      loadSecopActualizado(),
    ])
    const activos = new Set(vigilados.filter(v => v.activo).map(v => v.nit))
    const enLista = vigilados.find(v => v.nit === nit) ?? null
    const summary = summarizeProveedorSecop({ nit, facts, hospitals, vigilados: activos })
    const body: ProveedorSecopResponse = {
      ...summary,
      nombre: summary.nombre ?? enLista?.nombre ?? null,
      lista: enLista ? { nombre: enLista.nombre, ciudad: enLista.ciudad, origen: enLista.origen, activo: enLista.activo } : null,
      actualizado,
      notes: [
        'Fuente: SECOP II y SECOP Integrado (datos.gov.co). Contratos de material de este proveedor, todo el histórico cargado (incluye "Sin clasificar"); sin los de más de 50.000 millones (fuera de escala).',
        'SECOP I publica el valor del proceso en cada contratista: aquí cuenta la parte de este proveedor (valor repartido por partes iguales).',
        'Las entidades marcadas "IPS de OpMap" tienen al menos una sede activa en OpMap con ese NIT.',
      ],
    }
    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (isMissingRelationError(error)) return serverError('secop/proveedor GET', error, SECOP_MISSING_MESSAGE, 503)
    return serverError('secop/proveedor GET', error, 'Error al cargar el proveedor')
  }
}
