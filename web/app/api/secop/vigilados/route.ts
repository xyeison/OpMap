import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/require-role'
import { tienePermiso } from '@/lib/empresas-reglas'
import { badJson, readJsonBody, serverError, validationError } from '@/app/api/_lib/api-error'
import { esFueraEscala, esServicio, normalizeNitEmpresa, type VigiladoFila, type VigiladosResponse } from '@/lib/compras-publicas'
import { SECOP_MISSING_MESSAGE, isMissingRelationError, loadHechos, loadVigilados, upsertVigilado } from '../_lib/secop-server'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  nit: z.union([z.string(), z.number()]),
  nombre: z.string().trim().max(200).optional().nullable(),
  nota: z.string().trim().max(500).optional().nullable(),
  activo: z.boolean().optional(),
})

// GET /api/secop/vigilados — lista vigilada de proveedores (Odoo + altas manuales) con sus ventas de
// material en SECOP (todas las líneas, incluido "Sin clasificar"; sin valores fuera de escala).
// Permiso intelligence:view (lectura); canEdit = fuentes:manage (solo admin).
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'intelligence:view')
  if (!auth.ok) return auth.response
  try {
    const rows = await loadVigilados()
    const facts = await loadHechos({ desde: null, hasta: null, proveedorNits: rows.map(row => row.nit) })
    const ventas = new Map<string, { valor: number; contratos: number; entidades: Set<string>; ultimaFecha: string | null }>()
    for (const fact of facts) {
      if (!fact.proveedor_nit || esServicio(fact) || esFueraEscala(fact)) continue
      const current = ventas.get(fact.proveedor_nit) ?? { valor: 0, contratos: 0, entidades: new Set<string>(), ultimaFecha: null }
      current.valor += fact.valor
      current.contratos += fact.contratos
      current.entidades.add(fact.nit_entidad)
      if (fact.fecha && (!current.ultimaFecha || fact.fecha > current.ultimaFecha)) current.ultimaFecha = fact.fecha
      ventas.set(fact.proveedor_nit, current)
    }
    const vigilados: VigiladoFila[] = rows
      .map(row => {
        const v = ventas.get(row.nit)
        return {
          ...row,
          ventas: v ? { valor: Math.round(v.valor * 100) / 100, contratos: v.contratos, entidades: v.entidades.size, ultimaFecha: v.ultimaFecha } : null,
        }
      })
      .sort((a, b) => Number(b.activo) - Number(a.activo) || (b.ventas?.valor ?? 0) - (a.ventas?.valor ?? 0) || (a.nombre || a.nit).localeCompare(b.nombre || b.nit, 'es'))
    const body: VigiladosResponse = { vigilados, canEdit: tienePermiso(auth.user.papeles, 'fuentes:manage') }
    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (isMissingRelationError(error)) return serverError('secop/vigilados GET', error, SECOP_MISSING_MESSAGE, 503)
    return serverError('secop/vigilados GET', error, 'Error al cargar la lista vigilada')
  }
}

// POST /api/secop/vigilados {nit, nombre?, nota?, activo?} — alta manual o (re)activación de un NIT.
// NIT de 9 dígitos (con o sin DV; el DV se valida). Solo admin (fuentes:manage).
export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'fuentes:manage')
  if (!auth.ok) return auth.response
  const raw = await readJsonBody(request)
  if (raw === undefined) return badJson()
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) return validationError(parsed.error)
  const nit = normalizeNitEmpresa(parsed.data.nit)
  if (!nit.ok) return NextResponse.json({ error: nit.error }, { status: 400 })
  try {
    const row = await upsertVigilado({
      nit: nit.nit,
      nombre: parsed.data.nombre ? parsed.data.nombre : null,
      nota: parsed.data.nota ? parsed.data.nota : null,
      activo: parsed.data.activo ?? true,
      userId: auth.user.id,
    })
    return NextResponse.json({ vigilado: row })
  } catch (error) {
    if (isMissingRelationError(error)) return serverError('secop/vigilados POST', error, SECOP_MISSING_MESSAGE, 503)
    return serverError('secop/vigilados POST', error, 'No se pudo guardar el proveedor vigilado')
  }
}

// DELETE /api/secop/vigilados?nit=<NIT> — desactiva (baja lógica; la fila se conserva). Solo admin.
export async function DELETE(request: NextRequest) {
  const auth = await requirePermission(request, 'fuentes:manage')
  if (!auth.ok) return auth.response
  const nit = normalizeNitEmpresa(request.nextUrl.searchParams.get('nit') || '')
  if (!nit.ok) return NextResponse.json({ error: nit.error }, { status: 400 })
  try {
    const existing = (await loadVigilados()).find(row => row.nit === nit.nit)
    if (!existing) return NextResponse.json({ error: 'Ese NIT no está en la lista vigilada' }, { status: 404 })
    const row = await upsertVigilado({ nit: nit.nit, nombre: null, nota: null, activo: false, userId: auth.user.id })
    return NextResponse.json({ vigilado: row })
  } catch (error) {
    if (isMissingRelationError(error)) return serverError('secop/vigilados DELETE', error, SECOP_MISSING_MESSAGE, 503)
    return serverError('secop/vigilados DELETE', error, 'No se pudo desactivar el proveedor vigilado')
  }
}
