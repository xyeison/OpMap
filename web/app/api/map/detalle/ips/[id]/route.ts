// GET /api/map/detalle/ips/[id]
// Tarjeta de IPS del mapa (con Zona y sin Zona): giros ADRES y compras públicas SECOP de los últimos 12 meses de
// ESTA sede (IpsDetalle, lib/types/mapa-detalle.ts: parte por camas del NIT; la ficha muestra el NIT completo) y los
// procesos de SECOP II publicados sin contrato de su NIT. Permiso intelligence:view (todo: alcance 'completo') o
// secop:procesos (solo los procesos: alcance 'procesos'); sin ninguno 403 sin leer tablas. 400 si el id no es UUID;
// 404 si la IPS no existe o está inactiva. Specs: docs/specs/2026-10-24-mapa-giros-y-compras-12-meses.md y
// docs/specs/2026-10-25-secop-procesos-radar.md.
import { NextRequest, NextResponse } from 'next/server'
import { isUuid, serverError } from '@/app/api/_lib/api-error'
import { isMissingRelationError } from '@/app/api/intelligence/_lib/giros-server'
import { PERMISOS_DETALLE, alcanceDelRol, cargarDetalleIps } from '@/app/api/map/_lib/detalle-server'
import { requireAnyPermission } from '@/lib/require-role'
import type { IpsDetalle } from '@/lib/types/mapa-detalle'

// Nunca el Data Cache de Next (CLAUDE.md): los datos cambian a diario y la respuesta depende del usuario.
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAnyPermission(request, PERMISOS_DETALLE)
  if (!auth.ok) return auth.response
  const alcance = alcanceDelRol(auth.user.papeles) ?? 'procesos'

  const id = String(params?.id || '')
  if (!isUuid(id)) return NextResponse.json({ error: 'ID de IPS no válido' }, { status: 400 })

  try {
    const body: IpsDetalle | null = await cargarDetalleIps(id, alcance)
    if (!body) return NextResponse.json({ error: 'IPS no encontrada' }, { status: 404 })
    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (isMissingRelationError(error)) {
      return serverError('map/detalle/ips GET', error, 'Faltan tablas de giros ADRES o SECOP: aplicar las migraciones de las fases 3 y 5', 503)
    }
    const que = alcance === 'procesos' ? 'los procesos de SECOP' : 'los giros y compras'
    return serverError('map/detalle/ips GET', error, `No se pudieron cargar ${que} de la IPS`)
  }
}
